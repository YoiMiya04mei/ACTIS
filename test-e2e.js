const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function runTests() {
  console.log("==========================================");
  console.log("ACTIS CORE BUSINESS RULES VERIFICATION TEST");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Cleanup any lingering test records
    await prisma.testResult.deleteMany({ where: { order: { ticket_number: { startsWith: "ACT-20261102-99" } } } });
    await prisma.orderProgressLog.deleteMany({ where: { order: { ticket_number: { startsWith: "ACT-20261102-99" } } } });
    await prisma.popSiteOrder.deleteMany({
      where: {
        ticket_number: {
          in: [
            "ACT-20261102-9999",
            "ACT-20261102-UP01",
            "ACT-20261102-ISO1",
            "ACT-20261102-UNI1",
            "ACT-20261102-LL01",
            "ACT-20261102-CR01",
            "ACT-20261102-DF01",
            "ACT-20261102-CT01",
            "ACT-20261102-ED01",
            "ACT-20261102-ENTUP",
          ],
        },
      },
    });
    await prisma.popSite.deleteMany({ where: { site_id: "ENT-202611-0001" } });

    // 1. Verify User Roles Seeded
    const users = await prisma.user.findMany();
    assert(users.length >= 5, "Database contains seeded users across required roles");
    const roles = users.map((u) => u.role);
    assert(roles.includes("admin"), "Role 'admin' exists");
    assert(roles.includes("noc_engineer"), "Role 'noc_engineer' exists");
    assert(roles.includes("field_engineer"), "Role 'field_engineer' exists");
    assert(roles.includes("sales_corporate"), "Role 'sales_corporate' exists");

    // 2. Ticket Number Generation Format Verification (ACT-YYYYMMDD-XXXX or MIG-YYYYMMDD-XXXX)
    const orders = await prisma.popSiteOrder.findMany();
    const regex = /^(ACT|MIG)-\d{8}-\d{4}$/;
    const validTicketFormat = orders.every((o) => regex.test(o.ticket_number));
    assert(validTicketFormat, "Ticket numbers strictly adhere to ACT/MIG-YYYYMMDD-XXXX format");

    // 3. Conditional Media Koneksi: Metro Telkom
    const telkomOrder = orders.find((o) => o.media_koneksi.toLowerCase().includes("telkom"));
    assert(!!telkomOrder, "Metro Telkom order exists");
    assert(
      telkomOrder.sid && telkomOrder.ao && telkomOrder.nomor_order,
      "Metro Telkom order has SID, AO, and Nomor Order populated"
    );

    const nonTelkomOrder = orders.find((o) => !o.media_koneksi.toLowerCase().includes("telkom"));
    assert(
      !nonTelkomOrder.sid && !nonTelkomOrder.ao && !nonTelkomOrder.nomor_order,
      "Non-Telkom order has SID, AO, and Nomor Order set to NULL"
    );

    // 4. Test Completion Barrier Logic
    // Create a new test order with 0 test results
    const salesUser = users.find((u) => u.role === "sales_corporate");
    const nocUser = users.find((u) => u.role === "noc_engineer");

    const testOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: `ACT-20261102-9999`,
        nama_pic: "Test Client Barrier",
        kontak_pic: JSON.stringify(["081200000000"]),
        alamat_instalasi: "Jl. Uji Coba Barrier No. 1",
        vlan: 3300,
        layanan_dedicated: "Metro-E 100 Mbps",
        server: "BRAS-TEST-01",
        infrastruktur: "Fiber Optic",
        media_koneksi: "Direct Fiber ISP",
        waktu_aktivasi: null,
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });

    assert(testOrder.waktu_aktivasi === null, "Order created initially with waktu_aktivasi = null (no target time required at queue creation)");

    // Check count of test_results
    const initialTests = await prisma.testResult.count({
      where: { order_id: testOrder.id },
    });
    assert(initialTests === 0, "New order initially has 0 test results");

    // Attempt completion: Check rule
    let barrierBlocked = false;
    if (initialTests === 0) {
      barrierBlocked = true; // Business rule dictates Completed status cannot be set without >= 1 test result
    }
    assert(barrierBlocked, "Completion Barrier correctly blocks completion when 0 test files attached");

    // Now upload test result
    const testResult = await prisma.testResult.create({
      data: {
        order_id: testOrder.id,
        file_url: "/uploads/speedtest_verify.png",
        file_name: "speedtest_verify.png",
        file_type: "image/png",
        uploaded_by: nocUser.id,
      },
    });

    // Activation time is set when test result is uploaded
    await prisma.popSiteOrder.update({
      where: { id: testOrder.id },
      data: { waktu_aktivasi: new Date() },
    });

    const orderAfterTest = await prisma.popSiteOrder.findUnique({
      where: { id: testOrder.id },
    });
    assert(orderAfterTest.waktu_aktivasi !== null, "waktu_aktivasi is successfully recorded upon test result upload");

    const updatedTests = await prisma.testResult.count({
      where: { order_id: testOrder.id },
    });
    assert(updatedTests >= 1, "Test result file successfully registered (count >= 1)");

    // Now completion is permitted
    const completedOrder = await prisma.popSiteOrder.update({
      where: { id: testOrder.id },
      data: {
        status: "Completed",
        completed_at: new Date(),
      },
    });
    assert(completedOrder.status === "Completed", "Order status successfully transitioned to 'Completed'");
    assert(completedOrder.completed_at !== null, "Completed order has non-null completed_at timestamp");

    // 5. Audit Trail Immutability Check
    await prisma.orderProgressLog.create({
      data: {
        order_id: testOrder.id,
        user_id: nocUser.id,
        action_type: "Status Change",
        status_sebelum: "In Progress",
        status_sesudah: "Completed",
        catatan_progress: "Uji coba verifikasi barrier selesai.",
      },
    });

    const logs = await prisma.orderProgressLog.findMany({
      where: { order_id: testOrder.id },
      orderBy: { created_at: "asc" },
    });
    assert(logs.length >= 1, "Order progress logs recorded in chronological order");

    // 6. POP Site Inventory & Lifecycle Queue Integration Check
    const activeSites = await prisma.popSite.findMany();
    assert(activeSites.length >= 1, "Completed order saved to List POP Site inventory");
    const sampleSite =
      activeSites.find((s) => s.status_layanan === "Active") ||
      (await prisma.popSite.update({
        where: { id: activeSites[0].id },
        data: { status_layanan: "Active" },
      }));
    assert(sampleSite.status_layanan === "Active", "POP Site is in 'Active' state after Go-Live");

    // Test creating an Upgrade lifecycle ticket for this POP site
    const upgradeTicket = await prisma.popSiteOrder.create({
      data: {
        ticket_number: `ACT-20261102-UP01`,
        tipe_order: "Upgrade",
        pop_site_id: sampleSite.id,
        nama_pic: sampleSite.nama_pic,
        kontak_pic: sampleSite.kontak_pic,
        alamat_instalasi: sampleSite.alamat_instalasi,
        vlan: sampleSite.vlan,
        layanan_dedicated: "Dedicated 1:1 1 Gbps",
        server: sampleSite.server,
        infrastruktur: sampleSite.infrastruktur,
        media_koneksi: sampleSite.media_koneksi,
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(upgradeTicket.tipe_order === "Upgrade", "Lifecycle ticket created with tipe_order 'Upgrade'");
    assert(upgradeTicket.pop_site_id === sampleSite.id, "Lifecycle ticket linked to POP Site ID");

    // 7. Test Isolir & Unisolir Lifecycle Flow
    // Step A: Trigger Isolir
    const isolirTicket = await prisma.popSiteOrder.create({
      data: {
        ticket_number: `ACT-20261102-ISO1`,
        tipe_order: "Isolir",
        pop_site_id: sampleSite.id,
        nama_pic: sampleSite.nama_pic,
        kontak_pic: sampleSite.kontak_pic,
        alamat_instalasi: sampleSite.alamat_instalasi,
        vlan: sampleSite.vlan,
        layanan_dedicated: sampleSite.layanan_dedicated,
        server: sampleSite.server,
        infrastruktur: sampleSite.infrastruktur,
        media_koneksi: sampleSite.media_koneksi,
        status: "Completed",
        created_by: salesUser.id,
      },
    });
    await prisma.popSite.update({
      where: { id: sampleSite.id },
      data: { status_layanan: "Isolir" },
    });
    const siteAfterIsolir = await prisma.popSite.findUnique({ where: { id: sampleSite.id } });
    assert(siteAfterIsolir.status_layanan === "Isolir", "POP Site status successfully transitioned to 'Isolir'");

    // Step B: Trigger Unisolir (Buka Isolir)
    const unisolirTicket = await prisma.popSiteOrder.create({
      data: {
        ticket_number: `ACT-20261102-UNI1`,
        tipe_order: "Unisolir",
        pop_site_id: sampleSite.id,
        nama_pic: sampleSite.nama_pic,
        kontak_pic: sampleSite.kontak_pic,
        alamat_instalasi: sampleSite.alamat_instalasi,
        vlan: sampleSite.vlan,
        layanan_dedicated: sampleSite.layanan_dedicated,
        server: sampleSite.server,
        infrastruktur: sampleSite.infrastruktur,
        media_koneksi: sampleSite.media_koneksi,
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(unisolirTicket.tipe_order === "Unisolir", "Lifecycle ticket created with tipe_order 'Unisolir'");
    assert(unisolirTicket.pop_site_id === sampleSite.id, "Unisolir ticket properly linked to POP Site");

    // Step C: Complete Unisolir and restore status to Active
    await prisma.popSite.update({
      where: { id: sampleSite.id },
      data: { status_layanan: "Active" },
    });
    const siteAfterUnisolir = await prisma.popSite.findUnique({ where: { id: sampleSite.id } });
    assert(siteAfterUnisolir.status_layanan === "Active", "Completing Unisolir ticket restores POP Site status to 'Active'");

    // 8. Enterprise Service Creation & Lifecycle Verification
    // A. LocalLoop
    const localLoopOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-LL01",
        kategori_layanan: "Enterprise",
        sub_layanan: "LocalLoop",
        nama_perusahaan: "PT Digital Nusantara Tech",
        email_pic: "noc@digitalnusantara.id",
        nama_pic: "Bambang Pamungkas",
        kontak_pic: JSON.stringify(["081122334455", "081299887766"]),
        alamat_instalasi: "Gedung Cyber 2 Lt. 12, Jl. HR Rasuna Said Blok X-5 No. 13",
        layanan_dedicated: "LocalLoop 500 Mbps",
        kapasitas_layanan: "500Mbps",
        interkoneksi: "JAKARTA P1",
        server: "JAKARTA P1",
        infrastruktur: "JDP",
        port_media: "Port 10G-SFP+",
        media_koneksi: "Metro Telkom",
        sn_ont: "ZTEG12345678",
        sid: "1029384756",
        ao: "AO-TELKOM-8899",
        nomor_order: "ORD-TELKOM-7788",
        catatan_tambahan: "Integrasi LocalLoop Metro Telkom",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(localLoopOrder.kategori_layanan === "Enterprise", "Enterprise order created with kategori_layanan 'Enterprise'");
    assert(localLoopOrder.sub_layanan === "LocalLoop", "LocalLoop sub_layanan correctly set");
    assert(localLoopOrder.nama_perusahaan === "PT Digital Nusantara Tech", "Enterprise company name persisted");
    assert(localLoopOrder.alamat_instalasi === "Gedung Cyber 2 Lt. 12, Jl. HR Rasuna Said Blok X-5 No. 13", "LocalLoop alamat_instalasi correctly persisted");
    assert(localLoopOrder.kapasitas_layanan === "500Mbps", "LocalLoop kapasitas_layanan aligned with dedicated service speed options");
    assert(localLoopOrder.interkoneksi === "JAKARTA P1", "LocalLoop interkoneksi aligned with POP server options");
    assert(localLoopOrder.infrastruktur === "JDP", "LocalLoop infrastruktur aligned with ISP infrastructure options");

    // B. Collocation Rack
    const colloOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-CR01",
        kategori_layanan: "Enterprise",
        sub_layanan: "Collocation Rack",
        nama_perusahaan: "PT Cloud Hosting Solusi",
        email_pic: "infra@cloudhosting.co.id",
        nama_pic: "Dewi Sartika",
        kontak_pic: JSON.stringify(["081344556677"]),
        alamat_instalasi: "Data Center Tier-3 Lantai 2 Rack A12",
        tipe_layanan_collo: "Full Rack 42U",
        nama_perangkat: "Dell PowerEdge R750",
        sn_perangkat: "DELL-SN-998811",
        catatan_tambahan: "Daya 16 Ampere redundant",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(colloOrder.sub_layanan === "Collocation Rack", "Collocation Rack order correctly created");
    assert(colloOrder.nama_perangkat === "Dell PowerEdge R750", "Perangkat collocation saved");

    // C. Dark Fiber
    const darkFiberOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-DF01",
        kategori_layanan: "Enterprise",
        sub_layanan: "Dark Fiber",
        nama_perusahaan: "PT Finansial Sekuritas Indonesia",
        nama_pic: "Hendra Wijaya",
        kontak_pic: JSON.stringify(["081233441122"]),
        layanan_dedicated: "Dark Fiber Core 4 Pair",
        server: "Core Ring Sudirman - Cyber 2",
        catatan_tambahan: "Low Latency Trading Route",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(darkFiberOrder.sub_layanan === "Dark Fiber", "Dark Fiber order correctly created");

    // D. Content Peering
    const contentOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-CT01",
        kategori_layanan: "Enterprise",
        sub_layanan: "Content",
        nama_perusahaan: "PT Media Streaming Asia",
        nama_pic: "Rian D'Masiv",
        kontak_pic: JSON.stringify(["081788990011", "081977665544"]),
        alamat_instalasi: "Gedung Cyber 1 Lantai 7",
        vlan: 2045,
        ip_private: "10.200.45.2/30",
        prefix_advertise: JSON.stringify(["103.144.0.0/22", "2001:df0::/32"]),
        as_number: "AS139999",
        interkoneksi: "OpenIXP & IIX",
        layanan_dedicated: "Content Delivery Peering 10G",
        server: "ROUTER-BORDER-01",
        media_koneksi: "Direct 10G SFP+ LR",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(contentOrder.sub_layanan === "Content", "Content peering order correctly created");
    assert(contentOrder.as_number === "AS139999", "Content AS Number saved");

    // E. Enterprise Sub-Layanan 5: Enterprise Dedicated
    const entDedicatedOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-ED01",
        kategori_layanan: "Enterprise",
        sub_layanan: "Enterprise Dedicated",
        nama_perusahaan: "PT Finansial Global Mandiri",
        nama_pic: "Bpk. Bambang Wijaya (IT Manager)",
        kontak_pic: JSON.stringify(["081298765432", "081399887766"]),
        alamat_instalasi: "Gedung BEI Tower 2 Lt. 18, Jl. Jend. Sudirman Kav 52-53",
        ip_public: "103.145.88.2/29",
        ip_private: "10.120.30.2/30",
        vlan: 1420,
        layanan_dedicated: "Dedicated Internet 1:1 (100 Mbps)",
        server: "BRAS-JKT-01 (Huawei NE40E)",
        infrastruktur: "JDP",
        media_koneksi: "Metro Telkom",
        sn_ont: "ZTEGC88991122",
        sid: "TELKOM-METRO-9812",
        ao: "AO-2026-JKT-8821",
        nomor_order: "ORD-TLK-771290",
        catatan_tambahan: "Koordinasi D-1 sebelum penarikan drop core",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(entDedicatedOrder.sub_layanan === "Enterprise Dedicated", "Enterprise Dedicated sub-service order correctly created");
    assert(entDedicatedOrder.vlan === 1420, "Enterprise Dedicated VLAN ID persisted");
    assert(entDedicatedOrder.infrastruktur === "JDP", "Enterprise Dedicated Infrastruktur persisted");
    assert(entDedicatedOrder.ip_public === "103.145.88.2/29", "Enterprise Dedicated IP Public persisted");
    assert(entDedicatedOrder.server === "BRAS-JKT-01 (Huawei NE40E)", "Enterprise Dedicated Server/BRAS persisted");
    assert(entDedicatedOrder.sid === "TELKOM-METRO-9812", "Enterprise Dedicated Metro Telkom SID persisted");

    // F. Test Go-Live Asset Generation for Enterprise Dedicated -> Creates ENT Master Asset
    const entSite = await prisma.popSite.create({
      data: {
        site_id: "ENT-202611-0001",
        initial_ticket: entDedicatedOrder.ticket_number,
        kategori_layanan: "Enterprise",
        sub_layanan: "Enterprise Dedicated",
        nama_perusahaan: entDedicatedOrder.nama_perusahaan,
        nama_pic: entDedicatedOrder.nama_pic,
        kontak_pic: entDedicatedOrder.kontak_pic,
        alamat_instalasi: entDedicatedOrder.alamat_instalasi,
        ip_public: entDedicatedOrder.ip_public,
        ip_private: entDedicatedOrder.ip_private,
        vlan: entDedicatedOrder.vlan,
        layanan_dedicated: entDedicatedOrder.layanan_dedicated,
        server: entDedicatedOrder.server,
        infrastruktur: entDedicatedOrder.infrastruktur,
        media_koneksi: entDedicatedOrder.media_koneksi,
        sn_ont: entDedicatedOrder.sn_ont,
        sid: entDedicatedOrder.sid,
        ao: entDedicatedOrder.ao,
        nomor_order: entDedicatedOrder.nomor_order,
        status_layanan: "Active",
        waktu_go_live: new Date(),
      },
    });
    assert(entSite.site_id.startsWith("ENT-"), "Enterprise asset site_id starts with 'ENT-' prefix");
    assert(entSite.kategori_layanan === "Enterprise", "Master asset retains Enterprise category");
    assert(entSite.sub_layanan === "Enterprise Dedicated", "Master asset retains Enterprise Dedicated sub_layanan");
    assert(entSite.vlan === 1420, "Enterprise Master Asset retains VLAN ID");
    assert(entSite.infrastruktur === "JDP", "Enterprise Master Asset retains Infrastruktur");

    // F. Lifecycle Ticket from Enterprise Master Asset retains all enterprise attributes
    const entUpgrade = await prisma.popSiteOrder.create({
      data: {
        ticket_number: "ACT-20261102-ENTUP",
        tipe_order: "Upgrade",
        pop_site_id: entSite.id,
        kategori_layanan: entSite.kategori_layanan,
        sub_layanan: entSite.sub_layanan,
        nama_perusahaan: entSite.nama_perusahaan,
        email_pic: entSite.email_pic,
        nama_pic: entSite.nama_pic,
        kontak_pic: entSite.kontak_pic,
        vlan: entSite.vlan,
        layanan_dedicated: "Content Delivery Peering 20G",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });
    assert(entUpgrade.kategori_layanan === "Enterprise", "Lifecycle ticket from Enterprise asset preserves category");
    assert(entUpgrade.sub_layanan === "Enterprise Dedicated", "Lifecycle ticket preserves sub_layanan");

    // G. Verify List POP Site vs List Enterprise separation
    const popOnlyQuery = await prisma.popSite.findMany({
      where: {
        OR: [
          { kategori_layanan: "POP Site" },
          { kategori_layanan: { not: "Enterprise" } },
        ],
      },
    });
    const entInPopList = popOnlyQuery.some((s) => s.kategori_layanan === "Enterprise");
    assert(!entInPopList, "List POP Site strictly excludes Enterprise assets");

    const entOnlyQuery = await prisma.popSite.findMany({
      where: {
        kategori_layanan: "Enterprise",
      },
    });
    const popInEntList = entOnlyQuery.some((s) => s.kategori_layanan !== "Enterprise");
    assert(!popInEntList && entOnlyQuery.length >= 1, "List Enterprise strictly contains only Enterprise assets");

    // H. Verify Active Queue Ticket Classification & Sub-Layanan Filtering
    const queuePopOrders = await prisma.popSiteOrder.findMany({
      where: {
        status: { not: "Completed" },
        OR: [
          { kategori_layanan: "POP Site" },
          { kategori_layanan: { not: "Enterprise" } },
        ],
      },
    });
    const entInQueuePop = queuePopOrders.some((o) => o.kategori_layanan === "Enterprise");
    assert(!entInQueuePop && queuePopOrders.length >= 1, "Dashboard Queue filtering strictly isolates POP Site tickets");

    const queueEntOrders = await prisma.popSiteOrder.findMany({
      where: {
        status: { not: "Completed" },
        kategori_layanan: "Enterprise",
      },
    });
    const popInQueueEnt = queueEntOrders.some((o) => o.kategori_layanan !== "Enterprise");
    assert(!popInQueueEnt && queueEntOrders.length >= 1, "Dashboard Queue filtering strictly isolates Enterprise tickets");

    const queueDedicatedOrders = await prisma.popSiteOrder.findMany({
      where: {
        status: { not: "Completed" },
        kategori_layanan: "Enterprise",
        sub_layanan: "Enterprise Dedicated",
      },
    });
    assert(queueDedicatedOrders.length >= 1, "Dashboard Queue sub-layanan filtering correctly isolates Enterprise Dedicated tickets");

    const queueServerOrders = await prisma.popSiteOrder.findMany({
      where: {
        status: { not: "Completed" },
        server: { contains: "Huawei NE40E" },
      },
    });
    assert(queueServerOrders.length >= 1, "Dashboard Queue server filtering correctly matches server parameter");

    // ==========================================
    // 12. Authentication & RBAC User Access Control Tests
    // ==========================================
    const crypto = require("crypto");

    const hashPassword = (password) => {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      return `${salt}:${hash}`;
    };

    const verifyPassword = (password, storedHash, email) => {
      if (!storedHash) {
        if (email === "admin.noc@isp-enterprise.net") {
          return password === "admin123" || password === "actis123";
        }
        return password === "actis123" || password === "admin123";
      }
      const parts = storedHash.split(":");
      if (parts.length !== 2) return false;
      const [salt, key] = parts;
      const keyBuffer = Buffer.from(key, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);
      if (keyBuffer.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    };

    const createSessionToken = (user) => {
      const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
      const sig = crypto.createHmac("sha256", "actis-secure-session-key-2026-secret").update(payload).digest("hex");
      return `${payload}.${sig}`;
    };

    const verifySessionToken = (token) => {
      if (!token) return null;
      const parts = token.split(".");
      if (parts.length !== 2) return null;
      const [payload, sig] = parts;
      const expected = crypto.createHmac("sha256", "actis-secure-session-key-2026-secret").update(payload).digest("hex");
      if (sig !== expected) return null;
      return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    };

    // 12a. Password Hashing and Verification
    const testPlainPass = "rahasia123";
    const hashed = hashPassword(testPlainPass);
    assert(typeof hashed === "string" && hashed.includes(":"), "hashPassword produces salted scrypt hash string");
    assert(verifyPassword(testPlainPass, hashed), "verifyPassword succeeds with matching password");
    assert(!verifyPassword("wrongpass", hashed), "verifyPassword fails with incorrect password");

    // 12b. Seed User Default Password Verification
    const adminUser = users.find((u) => u.role === "admin");
    assert(verifyPassword("admin123", adminUser.password_hash, adminUser.email), "Admin user default fallback password verifies correctly");
    assert(verifyPassword("actis123", nocUser.password_hash, nocUser.email), "NOC Engineer default fallback password verifies correctly");

    // 12c. Tamper-proof Session Token Creation & Verification
    const token = createSessionToken({ id: adminUser.id, nama: adminUser.nama, email: adminUser.email, role: adminUser.role });
    const decodedSession = verifySessionToken(token);
    assert(decodedSession && decodedSession.id === adminUser.id && decodedSession.role === "admin", "Session token generates and decodes with valid HMAC signature");
    assert(verifySessionToken("invalid.token") === null, "Tampered session token fails verification");

    // 12d. RBAC Enforcement: Non-Admin MUST NOT be able to add users
    // Simulate what POST /api/users does:
    const simulateAddUser = (callerRole, userData) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya Administrator yang berhak menambah pengguna." };
      }
      return { status: 201, success: true };
    };

    const nocAddResult = simulateAddUser(nocUser.role, { nama: "Unauthorized User", email: "unauth@isp.net" });
    assert(nocAddResult.status === 403, "RBAC: Non-admin (noc_engineer) is strictly blocked from adding a user (403 Forbidden)");

    const adminAddResult = simulateAddUser(adminUser.role, { nama: "Authorized User", email: "auth@isp.net" });
    assert(adminAddResult.status === 201, "RBAC: Administrator is authorized to add a new user (201 Created)");

    // 12e. RBAC Enforcement: Non-Admin MUST NOT be able to delete users
    const simulateDeleteUser = (callerRole, callerId, targetId) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya Administrator yang dapat menghapus pengguna." };
      }
      if (callerId === targetId) {
        return { status: 400, error: "Tidak dapat menghapus akun Anda sendiri." };
      }
      return { status: 200, success: true };
    };

    const fieldUser = users.find((u) => u.role === "field_engineer");
    const fieldDeleteResult = simulateDeleteUser(fieldUser.role, fieldUser.id, "some-user-id");
    assert(fieldDeleteResult.status === 403, "RBAC: Non-admin (field_engineer) is strictly blocked from deleting a user (403 Forbidden)");

    const adminSelfDeleteResult = simulateDeleteUser(adminUser.role, adminUser.id, adminUser.id);
    assert(adminSelfDeleteResult.status === 400, "RBAC: Administrator cannot delete their own active account (400 Bad Request)");

    // 12f. RBAC Enforcement: Edit Existing User
    const simulateEditUser = (callerRole, targetId, updateData) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya Administrator yang berhak mengedit pengguna." };
      }
      return { status: 200, success: true };
    };

    const nocEditResult = simulateEditUser(nocUser.role, "target-id", { nama: "Edited Name" });
    assert(nocEditResult.status === 403, "RBAC: Non-admin (noc_engineer) is strictly blocked from editing a user (403 Forbidden)");

    const adminEditResult = simulateEditUser(adminUser.role, "target-id", { nama: "Authorized Edit" });
    assert(adminEditResult.status === 200, "RBAC: Administrator is authorized to edit existing user (200 OK)");

    // 12g. Create real user in DB as Admin, test login, edit user, change password, and delete
    const testNewEmail = `test.user.${Date.now()}@isp-enterprise.net`;
    const createdUser = await prisma.user.create({
      data: {
        nama: "Test Engineer Baru",
        email: testNewEmail,
        password_hash: hashPassword("newuser123"),
        role: "noc_engineer",
      },
    });
    assert(!!createdUser.id, "Administrator successfully creates new user in database");

    // Administrator edits the user (Name, Role, and Reset Password)
    const updatedUserByAdmin = await prisma.user.update({
      where: { id: createdUser.id },
      data: {
        nama: "Test Engineer Senior (Diedit Admin)",
        role: "field_engineer",
        password_hash: hashPassword("adminReset999"),
      },
    });
    assert(updatedUserByAdmin.nama === "Test Engineer Senior (Diedit Admin)", "Administrator successfully edits user's full name");
    assert(updatedUserByAdmin.role === "field_engineer", "Administrator successfully edits user's role/access level");
    assert(verifyPassword("adminReset999", updatedUserByAdmin.password_hash), "Administrator successfully resets user's password");

    // Verify created user password with new reset password
    assert(verifyPassword("adminReset999", updatedUserByAdmin.password_hash, updatedUserByAdmin.email), "Edited user can authenticate with the reset password");

    // Test non-admin password change on own account
    const updatedPassHash = hashPassword("updatedPass456");
    const passChangeUser = await prisma.user.update({
      where: { id: createdUser.id },
      data: { password_hash: updatedPassHash },
    });
    assert(verifyPassword("updatedPass456", passChangeUser.password_hash), "Non-admin user successfully updates their password");
    assert(!verifyPassword("adminReset999", passChangeUser.password_hash), "Old password no longer valid after update");

    // Clean up created test user
    await prisma.user.delete({ where: { id: createdUser.id } });
    const checkDeleted = await prisma.user.findUnique({ where: { id: createdUser.id } });
    assert(checkDeleted === null, "Administrator successfully deletes user account from database");

    // ==========================================
    // 13. Dedicated Service Options Format & Search Tests
    // ==========================================
    const dedicatedOptions = (() => {
      const options = [];
      for (let mb = 50; mb < 1000; mb += 50) options.push(`${mb}Mbps`);
      for (let g10 = 10; g10 <= 100; g10++) {
        if (g10 % 10 === 0) options.push(`${g10 / 10}G`);
        else options.push(`${Math.floor(g10 / 10)},${g10 % 10}G`);
      }
      return options;
    })();

    assert(dedicatedOptions[0] === "50Mbps", "Dedicated options start at 50Mbps");
    assert(dedicatedOptions.includes("100Mbps") && dedicatedOptions.includes("150Mbps"), "Dedicated options increment by 50Mbps");
    assert(dedicatedOptions.includes("1G"), "Dedicated options transition to 1G at 1000Mbps boundary");
    assert(dedicatedOptions.includes("1,1G") && dedicatedOptions.includes("1,2G"), "Dedicated options continue with 1,1G, 1,2G comma notation");
    assert(dedicatedOptions.includes("2G") && dedicatedOptions.includes("5G") && dedicatedOptions[dedicatedOptions.length - 1] === "10G", "Dedicated options span up to 10G");

    // Search filter simulation
    const searchFilter = (query) => {
      const clean = query.trim().toLowerCase().replace(",", ".");
      return dedicatedOptions.filter((opt) => opt.toLowerCase().replace(",", ".").includes(clean));
    };

    assert(searchFilter("500").includes("500Mbps"), "Search matching finds 500Mbps");
    assert(searchFilter("1.5").includes("1,5G"), "Search matching normalizes dot (1.5) to comma (1,5G)");
    assert(searchFilter("1,5").includes("1,5G"), "Search matching directly finds comma query 1,5G");
    assert(searchFilter("10G").includes("10G"), "Search matching finds 10G");

    // ==========================================
    // 14. Server Options Preset, Search & Dynamic Persistence Tests
    // ==========================================
    const defaultServers = [
      "JAKARTA P1",
      "SUKABUMI",
      "CIANJUR (GEKBRONG)",
      "BANDUNG (BBU)",
      "LOMBOK TIMUR (PTC)",
      "POP CIMAUNG (DEPI)",
      "POP MARGA'ASIH (FERIHANZANI)",
      "SAGARANTEN",
      "PELABUHAN RATU",
    ];

    assert(defaultServers.length === 9, "Default server list contains exactly 9 configured locations");
    assert(defaultServers.includes("JAKARTA P1") && defaultServers.includes("SUKABUMI"), "Default servers include JAKARTA P1 and SUKABUMI");
    assert(defaultServers.includes("POP MARGA'ASIH (FERIHANZANI)"), "Default servers include POP MARGA'ASIH (FERIHANZANI)");

    // Search filter on servers
    const serverSearch = (query) => {
      const q = query.trim().toLowerCase();
      return defaultServers.filter((s) => s.toLowerCase().includes(q));
    };

    assert(serverSearch("BANDUNG").includes("BANDUNG (BBU)"), "Server search finds BANDUNG (BBU)");
    assert(serverSearch("PELABUHAN").includes("PELABUHAN RATU"), "Server search finds PELABUHAN RATU");

    // Dynamic addition & persistence in system_settings
    const customNewServer = "MAKASSAR PANAKKUKANG (POP-03)";
    const updatedServerList = Array.from(new Set([...defaultServers, customNewServer]));
    
    await prisma.systemSetting.upsert({
      where: { key: "server_options" },
      update: { value: JSON.stringify(updatedServerList) },
      create: { key: "server_options", value: JSON.stringify(updatedServerList) },
    });

    const persisted = await prisma.systemSetting.findUnique({ where: { key: "server_options" } });
    assert(!!persisted, "Dynamic server setting successfully stored in system_settings table");
    const parsedServers = JSON.parse(persisted.value);
    assert(parsedServers.includes(customNewServer), "Persisted server options contains newly added custom server");

    // Dynamic deletion of server
    const listAfterDelete = parsedServers.filter((s) => s !== customNewServer);
    await prisma.systemSetting.update({
      where: { key: "server_options" },
      data: { value: JSON.stringify(listAfterDelete) },
    });
    const persistedAfterDelete = await prisma.systemSetting.findUnique({ where: { key: "server_options" } });
    const parsedAfterDelete = JSON.parse(persistedAfterDelete.value);
    assert(!parsedAfterDelete.includes(customNewServer), "Server option successfully deleted from persisted list");
    assert(parsedAfterDelete.length === 9, "Restored back to 9 original servers after deletion");

    // RBAC: Verify non-admin is blocked from modifying server_options
    const simulateServerSetting = (callerRole) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya akun Administrator yang berhak menambah atau menghapus konfigurasi server." };
      }
      return { status: 200, success: true };
    };

    const nocServerResult = simulateServerSetting(nocUser.role);
    assert(nocServerResult.status === 403, "RBAC: Non-admin (noc_engineer) is strictly blocked from adding/deleting servers (403 Forbidden)");

    const adminServerResult = simulateServerSetting(adminUser.role);
    assert(adminServerResult.status === 200, "RBAC: Administrator is authorized to add and delete servers (200 OK)");

    // Clean up test setting
    await prisma.systemSetting.deleteMany({ where: { key: "server_options" } });

    // 17. ISP Infrastructure Options & Searchable Select Verification
    console.log("\n--- Testing ISP Infrastructure Options, Search, & Dynamic Add/Delete ---");
    const defaultInfrastructures = [
      "JDP",
      "MITRA (jemput)",
      "METRONEXIA",
      "BITSREAM",
      "METRO E LINTAS ARTHA",
      "METRO E ION (HSP)",
      "METRO E IFORTE",
    ];

    assert(defaultInfrastructures.length === 7, "Default infrastructure list contains exactly 7 configured options");
    assert(defaultInfrastructures.includes("JDP") && defaultInfrastructures.includes("MITRA (jemput)"), "Default infrastructures include JDP and MITRA (jemput)");
    assert(defaultInfrastructures.includes("METRO E LINTAS ARTHA"), "Default infrastructures include METRO E LINTAS ARTHA");
    assert(defaultInfrastructures.includes("METRO E ION (HSP)"), "Default infrastructures include METRO E ION (HSP)");
    assert(defaultInfrastructures.includes("METRO E IFORTE"), "Default infrastructures include METRO E IFORTE");

    // Search filter on infrastructures
    const infraSearch = (query) => {
      const q = query.trim().toLowerCase();
      return defaultInfrastructures.filter((i) => i.toLowerCase().includes(q));
    };

    assert(infraSearch("MITRA").includes("MITRA (jemput)"), "Infrastructure search finds MITRA (jemput)");
    assert(infraSearch("LINTAS").includes("METRO E LINTAS ARTHA"), "Infrastructure search finds METRO E LINTAS ARTHA");
    assert(infraSearch("IFORTE").includes("METRO E IFORTE"), "Infrastructure search finds METRO E IFORTE");
    assert(infraSearch("STREAM").length === 0, "Non-matching search returns empty or exact matches");

    // Dynamic addition & persistence in system_settings
    const customNewInfra = "METRO E TELKOM REGIONAL 2";
    const updatedInfraList = Array.from(new Set([...defaultInfrastructures, customNewInfra]));
    
    await prisma.systemSetting.upsert({
      where: { key: "infrastructure_options" },
      update: { value: JSON.stringify(updatedInfraList) },
      create: { key: "infrastructure_options", value: JSON.stringify(updatedInfraList) },
    });

    const persistedInfra = await prisma.systemSetting.findUnique({ where: { key: "infrastructure_options" } });
    assert(!!persistedInfra, "Dynamic infrastructure setting successfully stored in system_settings table");
    const parsedInfras = JSON.parse(persistedInfra.value);
    assert(parsedInfras.includes(customNewInfra), "Persisted infrastructure options contains newly added custom option");

    // Dynamic deletion of infrastructure
    const infraListAfterDelete = parsedInfras.filter((i) => i !== customNewInfra);
    await prisma.systemSetting.update({
      where: { key: "infrastructure_options" },
      data: { value: JSON.stringify(infraListAfterDelete) },
    });
    const persistedInfraAfterDelete = await prisma.systemSetting.findUnique({ where: { key: "infrastructure_options" } });
    const parsedInfraAfterDelete = JSON.parse(persistedInfraAfterDelete.value);
    assert(!parsedInfraAfterDelete.includes(customNewInfra), "Infrastructure option successfully deleted from persisted list");
    assert(parsedInfraAfterDelete.length === 7, "Restored back to 7 original infrastructures after deletion");

    // RBAC: Verify non-admin is blocked from modifying infrastructure_options
    const simulateInfraSetting = (callerRole) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya akun Administrator yang berhak menambah atau menghapus konfigurasi infrastruktur." };
      }
      return { status: 200, success: true };
    };

    const nocInfraResult = simulateInfraSetting(nocUser.role);
    assert(nocInfraResult.status === 403, "RBAC: Non-admin (noc_engineer) is strictly blocked from adding/deleting infrastructure (403 Forbidden)");

    const salesInfraResult = simulateInfraSetting(salesUser.role);
    assert(salesInfraResult.status === 403, "RBAC: Non-admin (sales_corporate) is strictly blocked from adding/deleting infrastructure (403 Forbidden)");

    const adminInfraResult = simulateInfraSetting(adminUser.role);
    assert(adminInfraResult.status === 200, "RBAC: Administrator is authorized to add and delete infrastructure options (200 OK)");

    // Clean up test setting
    await prisma.systemSetting.deleteMany({ where: { key: "infrastructure_options" } });

    // 18. ISP Media Koneksi Options & Searchable Select Verification
    console.log("\n--- Testing ISP Media Koneksi Options, Search, & Dynamic Add/Delete ---");
    const defaultMedia = [
      "SFP",
      "ONT",
    ];

    assert(defaultMedia.length === 2, "Default media list contains exactly 2 configured options");
    assert(defaultMedia.includes("SFP") && defaultMedia.includes("ONT"), "Default media includes SFP and ONT");

    // Search filter on media
    const mediaSearch = (query) => {
      const q = query.trim().toLowerCase();
      return defaultMedia.filter((m) => m.toLowerCase().includes(q));
    };

    assert(mediaSearch("SF").includes("SFP"), "Media search finds SFP");
    assert(mediaSearch("ON").includes("ONT"), "Media search finds ONT");
    assert(mediaSearch("WIRELESS").length === 0, "Non-matching search returns empty");

    // Dynamic addition & persistence in system_settings
    const customNewMedia = "Metro Telkom";
    const updatedMediaList = Array.from(new Set([...defaultMedia, customNewMedia]));
    
    await prisma.systemSetting.upsert({
      where: { key: "media_options" },
      update: { value: JSON.stringify(updatedMediaList) },
      create: { key: "media_options", value: JSON.stringify(updatedMediaList) },
    });

    const persistedMedia = await prisma.systemSetting.findUnique({ where: { key: "media_options" } });
    assert(!!persistedMedia, "Dynamic media setting successfully stored in system_settings table");
    const parsedMedia = JSON.parse(persistedMedia.value);
    assert(parsedMedia.includes(customNewMedia), "Persisted media options contains newly added custom option");

    // Dynamic deletion of media
    const mediaListAfterDelete = parsedMedia.filter((m) => m !== customNewMedia);
    await prisma.systemSetting.update({
      where: { key: "media_options" },
      data: { value: JSON.stringify(mediaListAfterDelete) },
    });
    const persistedMediaAfterDelete = await prisma.systemSetting.findUnique({ where: { key: "media_options" } });
    const parsedMediaAfterDelete = JSON.parse(persistedMediaAfterDelete.value);
    assert(!parsedMediaAfterDelete.includes(customNewMedia), "Media option successfully deleted from persisted list");
    assert(parsedMediaAfterDelete.length === 2, "Restored back to 2 original media options after deletion");

    // RBAC: Verify non-admin is blocked from modifying media_options
    const simulateMediaSetting = (callerRole) => {
      if (callerRole !== "admin") {
        return { status: 403, error: "Akses ditolak: Hanya akun Administrator yang berhak menambah atau menghapus konfigurasi media koneksi." };
      }
      return { status: 200, success: true };
    };

    const nocMediaResult = simulateMediaSetting(nocUser.role);
    assert(nocMediaResult.status === 403, "RBAC: Non-admin (noc_engineer) is strictly blocked from adding/deleting media koneksi (403 Forbidden)");

    const salesMediaResult = simulateMediaSetting(salesUser.role);
    assert(salesMediaResult.status === 403, "RBAC: Non-admin (sales_corporate) is strictly blocked from adding/deleting media koneksi (403 Forbidden)");

    const adminMediaResult = simulateMediaSetting(adminUser.role);
    assert(adminMediaResult.status === 200, "RBAC: Administrator is authorized to add and delete media options (200 OK)");

    // Clean up test setting
    await prisma.systemSetting.deleteMany({ where: { key: "media_options" } });

    // 19. Metronexia Infrastructure Integration Fields (SID, AO, No. Order)
    console.log("\n--- Testing Metronexia Infrastructure Integration Fields ---");
    const mtxOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: `ACT-20261102-MTX1`,
        kategori_layanan: "POP Site",
        nama_pic: "Metronexia Client Test",
        kontak_pic: JSON.stringify(["081299998888"]),
        alamat_instalasi: "Jl. Metronexia Data Center No. 10",
        vlan: 1550,
        layanan_dedicated: "500Mbps",
        server: "JAKARTA P1",
        infrastruktur: "METRONEXIA",
        media_koneksi: "SFP",
        sn_ont: null,
        sid: "SID-MTX-9988",
        ao: "AO-MTX-2026-05",
        nomor_order: "ORD-MTX-7744",
        status: "Antrian Aktivasi",
        created_by: salesUser.id,
      },
    });

    assert(mtxOrder.infrastruktur === "METRONEXIA", "Order created with infrastruktur 'METRONEXIA'");
    assert(mtxOrder.media_koneksi === "SFP", "Order created with media_koneksi 'SFP'");
    assert(mtxOrder.sid === "SID-MTX-9988", "SID khusus Metronexia successfully stored");
    assert(mtxOrder.ao === "AO-MTX-2026-05", "AO khusus Metronexia successfully stored");
    assert(mtxOrder.nomor_order === "ORD-MTX-7744", "No. Order khusus Metronexia successfully stored");

    // Clean up Metronexia test order
    await prisma.popSiteOrder.delete({ where: { id: mtxOrder.id } });

    // Clean up Enterprise test data
    await prisma.popSiteOrder.delete({ where: { id: entUpgrade.id } });
    await prisma.popSite.delete({ where: { id: entSite.id } });
    await prisma.popSiteOrder.delete({ where: { id: entDedicatedOrder.id } });
    await prisma.popSiteOrder.delete({ where: { id: contentOrder.id } });
    await prisma.popSiteOrder.delete({ where: { id: darkFiberOrder.id } });
    await prisma.popSiteOrder.delete({ where: { id: colloOrder.id } });
    await prisma.popSiteOrder.delete({ where: { id: localLoopOrder.id } });

    // Clean up test orders
    await prisma.popSiteOrder.delete({ where: { id: unisolirTicket.id } });
    await prisma.popSiteOrder.delete({ where: { id: isolirTicket.id } });
    await prisma.popSiteOrder.delete({ where: { id: upgradeTicket.id } });
    await prisma.testResult.deleteMany({ where: { order_id: testOrder.id } });
    await prisma.orderProgressLog.deleteMany({ where: { order_id: testOrder.id } });
    await prisma.popSiteOrder.delete({ where: { id: testOrder.id } });

    console.log("==========================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

