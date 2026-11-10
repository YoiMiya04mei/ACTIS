import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicketNumber } from "@/lib/ticketUtils";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const mediaKoneksi = searchParams.get("media_koneksi");
    const serverParam = searchParams.get("server");
    const tipeOrder = searchParams.get("tipe_order");
    const isQueue = searchParams.get("is_queue") === "true";
    const kategori = searchParams.get("kategori") || searchParams.get("kategori_layanan");
    const subLayanan = searchParams.get("sub_layanan");

    const andConditions: any[] = [];

    if (status && status !== "Semua") {
      andConditions.push({ status });
    } else if (isQueue) {
      // Dashboard Antrian excludes Completed and Cancelled orders
      andConditions.push({ status: { notIn: ["Completed", "Cancelled"] } });
    }

    if (tipeOrder && tipeOrder !== "Semua") {
      andConditions.push({ tipe_order: tipeOrder });
    }

    if (mediaKoneksi && mediaKoneksi !== "Semua") {
      andConditions.push({ media_koneksi: mediaKoneksi });
    }

    if (serverParam && serverParam !== "Semua") {
      andConditions.push({ server: { contains: serverParam } });
    }

    if (kategori && kategori !== "Semua") {
      if (kategori === "POP Site") {
        andConditions.push({
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        });
      } else {
        andConditions.push({ kategori_layanan: kategori });
      }
    }

    if (subLayanan && subLayanan !== "Semua") {
      andConditions.push({ sub_layanan: subLayanan });
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      const searchOr: any[] = [
        { ticket_number: { contains: q } },
        { nama_pic: { contains: q } },
        { nama_perusahaan: { contains: q } },
        { alamat_instalasi: { contains: q } },
        { media_koneksi: { contains: q } },
        { server: { contains: q } },
        { as_number: { contains: q } },
        { sub_layanan: { contains: q } },
      ];
      const parsedVlan = parseInt(q, 10);
      if (!isNaN(parsedVlan)) {
        searchOr.push({ vlan: parsedVlan });
      }
      andConditions.push({ OR: searchOr });
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const orders = await prisma.popSiteOrder.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        creator: {
          select: { id: true, nama: true, email: true, role: true },
        },
        test_results: true,
        _count: {
          select: { test_results: true, progress_logs: true },
        },
        progress_logs: {
          orderBy: { created_at: "desc" },
          take: 1,
          include: {
            user: { select: { id: true, nama: true, role: true } },
          },
        },
      },
    });

    // Queue antrian statistics (strictly active tasks, excluding Completed and Cancelled)
    const activeScope = { status: { notIn: ["Completed", "Cancelled"] } };
    const queueCounts = {
      total: await prisma.popSiteOrder.count({ where: activeScope }),
      aktivasi: await prisma.popSiteOrder.count({ where: { tipe_order: "Aktivasi Baru", ...activeScope } }),
      upgrade: await prisma.popSiteOrder.count({ where: { tipe_order: "Upgrade", ...activeScope } }),
      downgrade: await prisma.popSiteOrder.count({ where: { tipe_order: "Downgrade", ...activeScope } }),
      isolir: await prisma.popSiteOrder.count({ where: { tipe_order: "Isolir", ...activeScope } }),
      unisolir: await prisma.popSiteOrder.count({ where: { tipe_order: "Unisolir", ...activeScope } }),
      unterminated: await prisma.popSiteOrder.count({ where: { tipe_order: { in: ["Unterminate", "Unterminated"] }, ...activeScope } }),
      terminate: await prisma.popSiteOrder.count({ where: { tipe_order: "Terminate", ...activeScope } }),
      cancelled: await prisma.popSiteOrder.count({ where: { status: "Cancelled" } }),
    };

    // Classification statistics for Active Queue
    const classificationCounts = {
      all: await prisma.popSiteOrder.count({ where: activeScope }),
      pop_site: await prisma.popSiteOrder.count({
        where: {
          ...activeScope,
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        },
      }),
      enterprise: await prisma.popSiteOrder.count({
        where: {
          ...activeScope,
          kategori_layanan: "Enterprise",
        },
      }),
      sub_layanan: {
        localloop: await prisma.popSiteOrder.count({
          where: { ...activeScope, kategori_layanan: "Enterprise", sub_layanan: "LocalLoop" },
        }),
        collocation: await prisma.popSiteOrder.count({
          where: { ...activeScope, kategori_layanan: "Enterprise", sub_layanan: "Collocation Rack" },
        }),
        darkfiber: await prisma.popSiteOrder.count({
          where: { ...activeScope, kategori_layanan: "Enterprise", sub_layanan: "Dark Fiber" },
        }),
        content: await prisma.popSiteOrder.count({
          where: { ...activeScope, kategori_layanan: "Enterprise", sub_layanan: "Content" },
        }),
        dedicated: await prisma.popSiteOrder.count({
          where: { ...activeScope, kategori_layanan: "Enterprise", sub_layanan: "Enterprise Dedicated" },
        }),
      },
    };

    // Get unique servers from active queue
    const distinctServerRows = await prisma.popSiteOrder.findMany({
      where: isQueue ? { status: { not: "Completed" } } : {},
      select: { server: true },
      distinct: ["server"],
    });
    const uniqueServers = distinctServerRows
      .map((r) => r.server)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);

    return NextResponse.json({
      success: true,
      data: orders,
      queue_counts: queueCounts,
      classification_counts: classificationCounts,
      unique_servers: uniqueServers,
    });
  } catch (err: any) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      kategori_layanan = "POP Site",
      sub_layanan,
      nama_pic,
      kontak_pic,
      nama_perusahaan,
      email_pic,
      alamat_instalasi,
      ip_public,
      ip_private,
      vlan,
      layanan_dedicated,
      server,
      infrastruktur,
      media_koneksi,
      sn_ont,
      kapasitas_layanan,
      interkoneksi,
      port_media,
      tipe_layanan_collo,
      nama_perangkat,
      sn_perangkat,
      prefix_advertise,
      as_number,
      sid,
      ao,
      nomor_order,
      waktu_aktivasi,
      catatan_tambahan,
      created_by,
    } = body;

    // Validate PIC Name
    if (!nama_pic || !String(nama_pic).trim()) {
      return NextResponse.json(
        { success: false, error: "Nama PIC wajib diisi." },
        { status: 400 }
      );
    }

    // Validate kontak_pic
    let kontakArr: string[] = [];
    if (Array.isArray(kontak_pic)) {
      kontakArr = kontak_pic.filter((k) => typeof k === "string" && k.trim().length > 0);
    } else if (typeof kontak_pic === "string" && kontak_pic.trim().length > 0) {
      kontakArr = [kontak_pic.trim()];
    }

    if (kontakArr.length === 0) {
      return NextResponse.json(
        { success: false, error: "Minimal cantumkan 1 nomor kontak PIC/WhatsApp." },
        { status: 400 }
      );
    }

    // Process Prefix Advertise if array
    let prefixArr: string[] = [];
    if (Array.isArray(prefix_advertise)) {
      prefixArr = prefix_advertise.filter((p) => typeof p === "string" && p.trim().length > 0);
    } else if (typeof prefix_advertise === "string" && prefix_advertise.trim().length > 0) {
      prefixArr = [prefix_advertise.trim()];
    }

    // Validation per Category & Sub-service
    if (kategori_layanan === "Enterprise") {
      if (!sub_layanan) {
        return NextResponse.json(
          { success: false, error: "Wajib memilih jenis sub-layanan Enterprise (LocalLoop, Collocation Rack, Dark Fiber, Content, Enterprise Dedicated)." },
          { status: 400 }
        );
      }

      if (!nama_perusahaan || !String(nama_perusahaan).trim()) {
        return NextResponse.json(
          { success: false, error: "Nama Perusahaan wajib diisi untuk layanan Enterprise." },
          { status: 400 }
        );
      }

      if (sub_layanan === "LocalLoop") {
        if (!email_pic || !alamat_instalasi || !layanan_dedicated || !kapasitas_layanan || !interkoneksi || !port_media || !media_koneksi) {
          return NextResponse.json(
            { success: false, error: "Mohon lengkapi field wajib LocalLoop: Email, Alamat Instalasi, Layanan, Kapasitas, Interkoneksi, Port Interkoneksi, dan Media Koneksi." },
            { status: 400 }
          );
        }
      } else if (sub_layanan === "Collocation Rack") {
        if (!email_pic || !alamat_instalasi || !tipe_layanan_collo || !nama_perangkat || !sn_perangkat) {
          return NextResponse.json(
            { success: false, error: "Mohon lengkapi field wajib Collocation Rack: Email, Alamat Instalasi, Tipe Layanan, Nama Perangkat, dan SN Perangkat." },
            { status: 400 }
          );
        }
      } else if (sub_layanan === "Dark Fiber") {
        if (!layanan_dedicated || !server) {
          return NextResponse.json(
            { success: false, error: "Mohon lengkapi field wajib Dark Fiber: Layanan Dark Fiber dan Server/Hub Datacenter." },
            { status: 400 }
          );
        }
      } else if (sub_layanan === "Content") {
        if (!alamat_instalasi || vlan === undefined || !ip_private || prefixArr.length === 0 || !as_number || !interkoneksi || !layanan_dedicated || !server || !media_koneksi) {
          return NextResponse.json(
            { success: false, error: "Mohon lengkapi field wajib Content: Alamat, VLAN, IP Private, Prefix Advertise, AS Number, Interkoneksi, Layanan, Server, dan Media Koneksi." },
            { status: 400 }
          );
        }
      } else if (sub_layanan === "Enterprise Dedicated") {
        if (!alamat_instalasi || vlan === undefined || vlan === null || !layanan_dedicated || !server || !infrastruktur || !media_koneksi) {
          return NextResponse.json(
            { success: false, error: "Mohon lengkapi field wajib Enterprise Dedicated: Alamat Instalasi, VLAN ID, Layanan Dedicated, Server, Infrastruktur, dan Media Koneksi." },
            { status: 400 }
          );
        }
      }
    } else {
      // Default: POP Site
      if (!alamat_instalasi || vlan === undefined || !layanan_dedicated || !server || !infrastruktur || !media_koneksi) {
        return NextResponse.json(
          { success: false, error: "Mohon lengkapi seluruh field wajib registrasi POP Site." },
          { status: 400 }
        );
      }
    }

    // Conditional rule for Metro Telkom & Metronexia
    const isTelkom = media_koneksi && media_koneksi.trim().toLowerCase().includes("telkom");
    const isMetronexia = infrastruktur && infrastruktur.trim().toLowerCase().includes("metronexia");
    let finalSid = null;
    let finalAo = null;
    let finalNomorOrder = null;

    if (isTelkom || isMetronexia) {
      if (!sid || !ao || !nomor_order) {
        return NextResponse.json(
          {
            success: false,
            error: isMetronexia
              ? "Untuk infrastruktur 'METRONEXIA', field SID, AO, dan No. Order wajib diisi."
              : "Untuk media 'Metro Telkom', field SID, AO, dan Nomor Order wajib diisi.",
          },
          { status: 400 }
        );
      }
      finalSid = String(sid).trim();
      finalAo = String(ao).trim();
      finalNomorOrder = String(nomor_order).trim();
    }

    // Find or fallback creator user
    let creatorId = created_by;
    if (!creatorId) {
      const defaultUser = await prisma.user.findFirst({
        where: { role: "sales_corporate" },
      });
      creatorId = defaultUser?.id || "usr-sales-001";
    }

    const ticketNumber = await generateTicketNumber();

    const newOrder = await prisma.popSiteOrder.create({
      data: {
        ticket_number: ticketNumber,
        kategori_layanan: String(kategori_layanan).trim(),
        sub_layanan: sub_layanan ? String(sub_layanan).trim() : null,
        nama_pic: String(nama_pic).trim(),
        kontak_pic: JSON.stringify(kontakArr),
        nama_perusahaan: nama_perusahaan ? String(nama_perusahaan).trim() : null,
        email_pic: email_pic ? String(email_pic).trim() : null,
        alamat_instalasi: alamat_instalasi ? String(alamat_instalasi).trim() : null,
        ip_public: ip_public ? String(ip_public).trim() : null,
        ip_private: ip_private ? String(ip_private).trim() : null,
        vlan: vlan !== undefined && vlan !== null && vlan !== "" ? parseInt(String(vlan), 10) : null,
        layanan_dedicated: layanan_dedicated ? String(layanan_dedicated).trim() : null,
        server: server ? String(server).trim() : null,
        infrastruktur: infrastruktur ? String(infrastruktur).trim() : null,
        media_koneksi: media_koneksi ? String(media_koneksi).trim() : null,
        sn_ont: sn_ont ? String(sn_ont).trim() : null,
        kapasitas_layanan: kapasitas_layanan ? String(kapasitas_layanan).trim() : null,
        interkoneksi: interkoneksi ? String(interkoneksi).trim() : null,
        port_media: port_media ? String(port_media).trim() : null,
        tipe_layanan_collo: tipe_layanan_collo ? String(tipe_layanan_collo).trim() : null,
        nama_perangkat: nama_perangkat ? String(nama_perangkat).trim() : null,
        sn_perangkat: sn_perangkat ? String(sn_perangkat).trim() : null,
        prefix_advertise: prefixArr.length > 0 ? JSON.stringify(prefixArr) : null,
        as_number: as_number ? String(as_number).trim() : null,
        sid: finalSid,
        ao: finalAo,
        nomor_order: finalNomorOrder,
        waktu_aktivasi: waktu_aktivasi ? new Date(waktu_aktivasi) : null,
        catatan_tambahan: catatan_tambahan ? String(catatan_tambahan).trim() : null,
        status: "Antrian Aktivasi",
        created_by: creatorId,
      },
    });

    // Immutable initial audit log
    await prisma.orderProgressLog.create({
      data: {
        order_id: newOrder.id,
        user_id: creatorId,
        action_type: "Status Change",
        status_sebelum: null,
        status_sesudah: "Antrian Aktivasi",
        catatan_progress: "Tiket aktivasi baru dibuat dan masuk antrean.",
      },
    });

    // Record application-wide activity log
    prisma.user
      .findUnique({ where: { id: creatorId } })
      .then((u) => {
        recordActivity({
          nama_lengkap: u?.nama || nama_pic || "NOC User",
          email: u?.email || null,
          ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
          tipe: "CREATE_TICKET",
          aktifitas: `Membuat tiket dengan nomor ${ticketNumber}`,
          detail: JSON.stringify({ kategori_layanan, sub_layanan }),
          user_agent: parseUserAgent(request.headers.get("user-agent")),
        }).catch(() => {});
      })
      .catch(() => {
        recordActivity({
          nama_lengkap: nama_pic || "NOC User",
          ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
          tipe: "CREATE_TICKET",
          aktifitas: `Membuat tiket dengan nomor ${ticketNumber}`,
          detail: JSON.stringify({ kategori_layanan, sub_layanan }),
          user_agent: parseUserAgent(request.headers.get("user-agent")),
        }).catch(() => {});
      });

    // Trigger async sync to Google Spreadsheet (non-blocking)
    buildPayloadForOrder(newOrder.id, "CREATE_ORDER", {
      statusSebelum: null,
      statusSesudah: "Antrian Aktivasi",
      progressNote: "Tiket aktivasi baru dibuat dan masuk antrean.",
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, newOrder.id);
    });

    return NextResponse.json({
      success: true,
      message: `Tiket ${ticketNumber} berhasil didaftarkan ke antrian aktivasi!`,
      data: newOrder,
    });
  } catch (err: any) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create order" },
      { status: 500 }
    );
  }
}

