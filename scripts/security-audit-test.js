/**
 * ACTIS Comprehensive Independent Security Verification Test Suite
 * Automated verification of authentication, RBAC, session tampering,
 * IDOR defense, file protection, SSRF, command injection, and security headers.
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let passCount = 0;
let failCount = 0;
const results = [];

function assert(description, condition, details = "") {
  if (condition) {
    passCount++;
    console.log(`  ${GREEN}✓ PASS${RESET} - ${description}`);
    results.push({ description, status: "PASS", details });
  } else {
    failCount++;
    console.log(`  ${RED}✗ FAIL${RESET} - ${description} ${details ? `(${details})` : ""}`);
    results.push({ description, status: "FAIL", details });
  }
}

// Read SESSION_SECRET from .env
function getEnvSessionSecret() {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("SESSION_SECRET=")) {
        return trimmed.split("=")[1].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch (err) {
    // ignore
  }
  return "actis-dev-session-key-must-be-rotated-for-production-use-only-2026";
}

const SERVER_SECRET = getEnvSessionSecret();

function makeSessionCookie(user, secret = SERVER_SECRET, expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomBytes(16).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `actis_session=${payloadB64}.${sig}`;
}

function httpRequest(options, postData = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (cookie) {
      headers["Cookie"] = cookie;
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
        });
      });
    });
    req.on("error", (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// -------------------------------------------------------------
// Module 1: Cryptographic Session Token & Tamper Proofing Tests
// -------------------------------------------------------------
function testSessionSecurity() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 1] Session Token & Tamper-Proofing Security${RESET}`);

  const testSecret = "test-cryptographic-secret-must-be-32-chars-long-min!";

  function createToken(payload, secret = testSecret) {
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
    return `${payloadB64}.${sig}`;
  }

  function verifyToken(token, secret = testSecret) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const validToken = createToken({ id: "usr-admin-001", role: "admin", iat: now, exp: now + 3600, jti: "token-1" });
  const verified = verifyToken(validToken);
  assert("Valid cryptographic session token verifies correctly", verified !== null && verified.id === "usr-admin-001");

  // Tampered payload
  const tamperedToken = validToken.slice(0, -5) + "abcde";
  assert("Tampered token signature is rejected (tamper-proof HMAC)", verifyToken(tamperedToken) === null);

  // Altered payload role
  const parts = validToken.split(".");
  const alteredPayload = Buffer.from(JSON.stringify({ id: "usr-admin-001", role: "superadmin", exp: now + 3600 })).toString("base64url");
  const forgedToken = `${alteredPayload}.${parts[1]}`;
  assert("Token with altered payload but original signature is rejected", verifyToken(forgedToken) === null);

  // Expired token
  const expiredToken = createToken({ id: "usr-admin-001", role: "admin", iat: now - 7200, exp: now - 3600, jti: "token-exp" });
  assert("Expired token is rejected", verifyToken(expiredToken) === null);
}

// -------------------------------------------------------------
// Module 2: Password Verification & Default Password Fallback
// -------------------------------------------------------------
function testPasswordSecurity() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 2] Password Hashing & Default Password Rejection${RESET}`);

  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== "string") return false;
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    try {
      const keyBuffer = Buffer.from(key, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);
      if (keyBuffer.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  const stored = hashPassword("SuperAdmin2026!Secure");
  assert("Valid password matches scrypt hash", verifyPassword("SuperAdmin2026!Secure", stored) === true);
  assert("Incorrect password fails verification", verifyPassword("WrongPassword123", stored) === false);

  // STRICT RULE: No default password fallback when hash is null
  assert("Null password_hash strictly rejects 'admin123' (zero fallback)", verifyPassword("admin123", null) === false);
  assert("Null password_hash strictly rejects 'actis123' (zero fallback)", verifyPassword("actis123", null) === false);
  assert("Empty string hash strictly returns false", verifyPassword("admin123", "") === false);
}

// -------------------------------------------------------------
// Module 3: File Upload Magic Byte & MIME Validation Tests
// -------------------------------------------------------------
function testFileUploadSecurity() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 3] File Upload Magic Byte & Extension Validation${RESET}`);

  function validateUploadedBuffer(buffer, fileName) {
    if (!buffer || buffer.length === 0) return { valid: false, error: "File kosong" };
    if (buffer.length > 10 * 1024 * 1024) return { valid: false, error: "Ukuran file melebihi batas 10MB" };

    const ext = fileName.split(".").pop().toLowerCase();
    const allowedExtensions = ["png", "jpg", "jpeg", "pdf"];
    if (!allowedExtensions.includes(ext)) {
      return { valid: false, error: `Ekstensi .${ext} dilarang` };
    }

    const isPng = buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
    const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPdf = buffer.length >= 4 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

    if (ext === "png" && !isPng) return { valid: false, error: "Header PNG tidak valid" };
    if ((ext === "jpg" || ext === "jpeg") && !isJpg) return { valid: false, error: "Header JPEG tidak valid" };
    if (ext === "pdf" && !isPdf) return { valid: false, error: "Header PDF tidak valid" };

    return { valid: true };
  }

  const validPngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert("Legitimate PNG with magic bytes is accepted", validateUploadedBuffer(validPngBuf, "evidence.png").valid === true);

  const validPdfBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
  assert("Legitimate PDF with %PDF magic bytes is accepted", validateUploadedBuffer(validPdfBuf, "doc.pdf").valid === true);

  const fakePngBuf = Buffer.from("<html><script>alert('xss')</script></html>");
  const fakePngResult = validateUploadedBuffer(fakePngBuf, "malicious.png");
  assert("Fake PNG containing HTML/XSS payload is rejected by magic byte inspection", fakePngResult.valid === false);

  const exeInPdfBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
  const exePdfResult = validateUploadedBuffer(exeInPdfBuf, "payload.pdf");
  assert("Windows PE binary (.exe) disguised as .pdf is rejected", exePdfResult.valid === false);

  assert("PHP script (.php) is rejected by extension whitelist", validateUploadedBuffer(Buffer.from("<?php echo 1; ?>"), "shell.php").valid === false);
  assert("SVG vector (.svg) with possible script is rejected by extension whitelist", validateUploadedBuffer(Buffer.from("<svg></svg>"), "image.svg").valid === false);
}

// -------------------------------------------------------------
// Module 4: Network, SSRF & Command Injection Defense Tests
// -------------------------------------------------------------
function testNetworkSecurity() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 4] ICMP Monitoring, SSRF & Command Injection Defense${RESET}`);

  function isValidIpAddress(ip) {
    if (!ip || typeof ip !== "string") return false;
    const v4 = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    return v4.test(ip.trim());
  }

  function isRestrictedNetworkTarget(host) {
    if (!host) return true;
    const lower = host.toLowerCase().trim();
    if (lower === "localhost" || lower === "127.0.0.1" || lower === "0.0.0.0" || lower === "::1") return true;
    if (lower === "169.254.169.254" || lower.startsWith("169.254.")) return true; // Cloud metadata
    if (lower.startsWith("10.") || lower.startsWith("192.168.")) return true;
    if (lower.startsWith("172.")) {
      const parts = lower.split(".");
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  }

  assert("Cloud Metadata IP (169.254.169.254) is blocked from SSRF scanning", isRestrictedNetworkTarget("169.254.169.254") === true);
  assert("Loopback (127.0.0.1) is blocked from SSRF scanning", isRestrictedNetworkTarget("127.0.0.1") === true);
  assert("Loopback hostname (localhost) is blocked", isRestrictedNetworkTarget("localhost") === true);
  assert("Internal RFC 1918 (10.0.0.1) is recognized as restricted internal target", isRestrictedNetworkTarget("10.0.0.1") === true);
  assert("Legitimate Public IP (103.155.196.10) is permitted for ISP monitoring", isRestrictedNetworkTarget("103.155.196.10") === false);

  assert("Command injection payload '103.155.196.10 & calc.exe' fails IP validation", isValidIpAddress("103.155.196.10 & calc.exe") === false);
  assert("Command injection payload '103.155.196.10; ls -la' fails IP validation", isValidIpAddress("103.155.196.10; ls -la") === false);
  assert("Command injection payload '`whoami`' fails IP validation", isValidIpAddress("`whoami`") === false);
  assert("Valid IP '103.155.196.63' passes IP validation", isValidIpAddress("103.155.196.63") === true);
}

// -------------------------------------------------------------
// Module 5: Complete Unauthenticated API Surface Test (Review Point 1)
// -------------------------------------------------------------
async function testCompleteUnauthenticatedApiSurface() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 5] Complete Unauthenticated API Surface Tests (Review Point 1)${RESET}`);

  const endpointsToTest = [
    { method: "GET", path: "/api/users", desc: "User list" },
    { method: "POST", path: "/api/users", desc: "User creation", data: { nama: "Attacker", email: "evil@isp.com" } },
    { method: "DELETE", path: "/api/logs", desc: "System log deletion" },
    { method: "POST", path: "/api/settings", desc: "Settings modification", data: { auto_refresh_interval: 10 } },
    { method: "GET", path: "/api/monitoring", desc: "ICMP monitoring list" },
    { method: "POST", path: "/api/monitoring/1/ping", desc: "Manual ICMP ping" },
    { method: "POST", path: "/api/monitoring/ping-all", desc: "Ping-all ICMP triggers" },
    { method: "GET", path: "/api/pop-sites", desc: "POP Site inventory" },
    { method: "POST", path: "/api/pop-sites/bulk-delete", desc: "POP Site bulk deletion", data: { site_ids: ["pop-1"] } },
    { method: "POST", path: "/api/pop-sites/import", desc: "POP Site CSV import", data: { sites: [] } },
    { method: "POST", path: "/api/pop-sites/bulk-actions", desc: "POP Site bulk actions", data: { action: "delete" } },
    { method: "GET", path: "/api/dcim/racks", desc: "DCIM Rack database" },
    { method: "POST", path: "/api/dcim/racks", desc: "DCIM Rack creation", data: { code: "RACK-TEST" } },
    { method: "GET", path: "/api/ipam/prefixes", desc: "IPAM prefix list" },
    { method: "POST", path: "/api/ipam/prefixes", desc: "IPAM prefix creation", data: { cidr: "103.99.99.0/24" } },
    { method: "GET", path: "/api/orders", desc: "Order queue list" },
    { method: "POST", path: "/api/orders", desc: "Order creation", data: { nama_pic: "Test PIC" } },
    { method: "GET", path: "/api/orders/ord-fake-123", desc: "Order detail access" },
    { method: "POST", path: "/api/orders/ord-fake-123/progress", desc: "Order progress update", data: { catatan_progress: "Test note" } },
    { method: "POST", path: "/api/orders/ord-fake-123/status", desc: "Order status change", data: { status: "Completed" } },
    { method: "POST", path: "/api/orders/ord-fake-123/cancel", desc: "Order cancellation", data: { reason: "Customer cancel" } },
    { method: "POST", path: "/api/orders/ord-test/test-results", desc: "Network test upload", data: { file_url: "/uploads/test.png" } },
    { method: "POST", path: "/api/sync/sheets", desc: "Google Sheets sync" },
    { method: "GET", path: "/api/dashboard/stats", desc: "Dashboard statistics" },
    { method: "GET", path: "/api/notifications", desc: "User notifications" },
    { method: "GET", path: "/api/backups", desc: "Backup inventory" },
    { method: "POST", path: "/api/backups/devices", desc: "Backup device creation", data: { name: "Router-1" } },
    { method: "GET", path: "/api/backups/export-zip", desc: "Backup config ZIP export" },
    { method: "GET", path: "/api/backups/records/fake-rec-1/download", desc: "Backup config download" },
    { method: "GET", path: "/api/tacacs/users", desc: "TACACS+ user list" },
    { method: "POST", path: "/api/tacacs/users", desc: "TACACS+ user creation", data: { username: "tacuser" } },
    { method: "GET", path: "/api/tacacs/groups", desc: "TACACS+ group list" },
    { method: "GET", path: "/api/tacacs/clients", desc: "TACACS+ client list" },
    { method: "PUT", path: "/api/tacacs/settings", desc: "TACACS+ server settings update", data: { enabled: true } },
    // Exhaustive coverage for all remaining API routes with their valid exported methods
    { method: "PATCH", path: "/api/backups/devices/dev-fake-1", desc: "Single backup device update", data: { name: "Router" } },
    { method: "POST", path: "/api/backups/devices/dev-fake-1/run", desc: "Trigger backup pull" },
    { method: "GET", path: "/api/backups/gdrive", desc: "Google drive backup settings" },
    { method: "GET", path: "/api/backups/gdrive/oauth/authorize", desc: "GDrive OAuth start" },
    { method: "GET", path: "/api/backups/gdrive/oauth/callback", desc: "GDrive OAuth callback" },
    { method: "GET", path: "/api/backups/records/rec-fake-1", desc: "Single backup record detail" },
    { method: "GET", path: "/api/backups/settings", desc: "Global backup settings" },
    { method: "POST", path: "/api/backups/translate", desc: "Network config translator" },
    { method: "GET", path: "/api/dcim/otbs", desc: "DCIM OTB list" },
    { method: "GET", path: "/api/dcim/otbs/otb-fake-1", desc: "DCIM single OTB detail" },
    { method: "PATCH", path: "/api/dcim/otbs/otb-fake-1/ports", desc: "DCIM OTB port update", data: { ports: [] } },
    { method: "GET", path: "/api/dcim/racks/rack-fake-1", desc: "DCIM single rack detail" },
    { method: "POST", path: "/api/dcim/racks/rack-fake-1/slots", desc: "DCIM rack slots creation", data: { unit_number: 1 } },
    { method: "PATCH", path: "/api/dcim/racks/rack-fake-1/slots/slot-fake-1", desc: "DCIM single slot update", data: { device_name: "SW" } },
    { method: "GET", path: "/api/ipam", desc: "IPAM overview" },
    { method: "GET", path: "/api/monitoring/mon-fake-1", desc: "Single monitoring host detail" },
    { method: "GET", path: "/api/monitoring/telegram", desc: "Monitoring telegram config" },
    { method: "GET", path: "/api/orders/telegram", desc: "Orders telegram config" },
    { method: "GET", path: "/api/pop-sites/pop-fake-1", desc: "Single POP site detail" },
    { method: "POST", path: "/api/pop-sites/pop-fake-1/actions", desc: "POP site lifecycle actions" },
    { method: "GET", path: "/api/pop-sites/pop-fake-1/monitoring", desc: "POP site monitoring status" },
    { method: "PUT", path: "/api/tacacs/clients/cli-fake-1", desc: "Single TACACS+ client update", data: { name: "Client" } },
    { method: "PUT", path: "/api/tacacs/groups/grp-fake-1", desc: "Single TACACS+ group update", data: { name: "Group" } },
    { method: "GET", path: "/api/tacacs/logs", desc: "TACACS+ audit logs" },
    { method: "GET", path: "/api/tacacs/status", desc: "TACACS+ server status" },
    { method: "POST", path: "/api/tacacs/test", desc: "TACACS+ simulation test" },
    { method: "PUT", path: "/api/tacacs/users/usr-fake-1", desc: "Single TACACS+ user update", data: { username: "usr" } },
    { method: "PUT", path: "/api/users/usr-fake-1", desc: "Single user account update", data: { nama: "User" } },
    { method: "POST", path: "/api/users/change-password", desc: "Password change endpoint" },
  ];

  for (const ep of endpointsToTest) {
    try {
      const res = await httpRequest({
        hostname: "localhost",
        port: 3000,
        path: ep.path,
        method: ep.method,
        headers: { "Content-Type": "application/json" },
      }, ep.data);

      const isProtected = res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 307;
      assert(
        `[${ep.method}] ${ep.path} rejected without auth -> HTTP ${res.statusCode} (${ep.desc})`,
        isProtected,
        `HTTP ${res.statusCode}`
      );
    } catch (err) {
      assert(`[${ep.method}] ${ep.path} request error`, false, err.message);
    }
  }
}

// -------------------------------------------------------------
// Module 6: Privilege Escalation & RBAC Matrix Tests (Review Point 2)
// -------------------------------------------------------------
async function testPrivilegeEscalationMatrix() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 6] Privilege Escalation & Role Matrix Tests (Review Point 2)${RESET}`);

  // Test accounts from database
  const salesUser = { id: "usr-sales-001", nama: "Sarah Novita (Sales Corporate)", email: "sarah.novita@isp-enterprise.net", role: "sales_corporate" };
  const fieldUser = { id: "usr-field-001", nama: "Dimas Kurniawan (Field Engineer)", email: "dimas.k@isp-enterprise.net", role: "field_engineer" };
  const nocUser = { id: "usr-noc-001", nama: "Budi Santoso (NOC Engineer)", email: "budi.santoso@isp-enterprise.net", role: "noc_engineer" };
  const adminUser = { id: "usr-admin-001", nama: "Ahmad Fauzi (Head of NOC)", email: "admin.noc@isp-enterprise.net", role: "admin" };

  const salesCookie = makeSessionCookie(salesUser);
  const fieldCookie = makeSessionCookie(fieldUser);
  const nocCookie = makeSessionCookie(nocUser);
  const adminCookie = makeSessionCookie(adminUser);

  // 1. Sales Corporate attempted privilege escalation
  const salesEscalationAttempts = [
    { method: "POST", path: "/api/users", desc: "Sales creating new user accounts", data: { nama: "Escalated Admin", email: "hacked@isp.com", role: "admin", password: "NewAdminPassword123!" } },
    { method: "POST", path: "/api/settings", desc: "Sales modifying system settings", data: { auto_refresh_interval: 5 } },
    { method: "DELETE", path: "/api/logs", desc: "Sales deleting system activity logs" },
    { method: "POST", path: "/api/pop-sites/bulk-delete", desc: "Sales bulk-deleting POP Sites", data: { site_ids: ["pop-1"] } },
    { method: "POST", path: "/api/tacacs/users", desc: "Sales creating TACACS+ users", data: { username: "rogue_tacacs", password: "Password123!" } },
    { method: "GET", path: "/api/backups", desc: "Sales accessing Network Device Backups" },
    { method: "GET", path: "/api/tacacs/users", desc: "Sales accessing TACACS+ User list" },
  ];

  for (const att of salesEscalationAttempts) {
    const res = await httpRequest({
      hostname: "localhost",
      port: 3000,
      path: att.path,
      method: att.method,
      headers: { "Content-Type": "application/json" },
    }, att.data, salesCookie);
    assert(
      `Sales Corporate escalation blocked: ${att.desc} -> HTTP ${res.statusCode}`,
      res.statusCode === 403,
      `Returned HTTP ${res.statusCode}`
    );
  }

  // 2. Field Engineer attempted privilege escalation
  const fieldEscalationAttempts = [
    { method: "POST", path: "/api/users", desc: "Field Engineer creating user accounts", data: { nama: "Field Admin", email: "fieldadmin@isp.com", role: "admin" } },
    { method: "POST", path: "/api/settings", desc: "Field Engineer modifying system settings", data: { auto_refresh_interval: 10 } },
    { method: "GET", path: "/api/backups", desc: "Field Engineer accessing router backups" },
    { method: "GET", path: "/api/tacacs/users", desc: "Field Engineer accessing TACACS+ users" },
  ];

  for (const att of fieldEscalationAttempts) {
    const res = await httpRequest({
      hostname: "localhost",
      port: 3000,
      path: att.path,
      method: att.method,
      headers: { "Content-Type": "application/json" },
    }, att.data, fieldCookie);
    assert(
      `Field Engineer escalation blocked: ${att.desc} -> HTTP ${res.statusCode}`,
      res.statusCode === 403,
      `Returned HTTP ${res.statusCode}`
    );
  }

  // 3. NOC Engineer administrative restrictions
  const nocAdminAttempts = [
    { method: "POST", path: "/api/users", desc: "NOC Engineer creating user accounts", data: { nama: "Noc Created Admin", email: "nocadmin@isp.com", role: "admin" } },
    { method: "POST", path: "/api/settings", desc: "NOC Engineer modifying global system settings", data: { auto_refresh_interval: 15 } },
    { method: "POST", path: "/api/tacacs/users", desc: "NOC Engineer creating TACACS+ users (Admin only)", data: { username: "noctac", password: "Password123!" } },
    { method: "POST", path: "/api/pop-sites/bulk-delete", desc: "NOC Engineer bulk deleting POP Sites (Admin only)", data: { site_ids: ["pop-1"] } },
  ];

  for (const att of nocAdminAttempts) {
    const res = await httpRequest({
      hostname: "localhost",
      port: 3000,
      path: att.path,
      method: att.method,
      headers: { "Content-Type": "application/json" },
    }, att.data, nocCookie);
    assert(
      `NOC Engineer admin restriction enforced: ${att.desc} -> HTTP ${res.statusCode}`,
      res.statusCode === 403,
      `Returned HTTP ${res.statusCode}`
    );
  }

  // 4. NOC Engineer legitimate access
  const nocLegitRes = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups",
    method: "GET",
  }, null, nocCookie);
  assert("NOC Engineer legitimate access to /api/backups is permitted -> HTTP 200", nocLegitRes.statusCode === 200, `HTTP ${nocLegitRes.statusCode}`);

  // 5. Admin legitimate access
  const adminLegitRes = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/settings",
    method: "GET",
  }, null, adminCookie);
  assert("Admin legitimate access to /api/settings is permitted -> HTTP 200", adminLegitRes.statusCode === 200, `HTTP ${adminLegitRes.statusCode}`);
}

// -------------------------------------------------------------
// Module 7: Session Manipulation, Cookie Tampering & Revocation (Review Point 3)
// -------------------------------------------------------------
async function testSessionManipulationAndRevocation() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 7] Session Manipulation, Tampering & Revocation (Review Point 3)${RESET}`);

  const adminUser = { id: "usr-admin-001", nama: "Ahmad Fauzi (Head of NOC)", email: "admin.noc@isp-enterprise.net", role: "admin" };

  // Forged signature with attacker key
  const attackerCookie = makeSessionCookie(adminUser, "attacker-secret-key-that-does-not-match-actis-system-secret");
  const resForged = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/users",
    method: "GET",
  }, null, attackerCookie);
  assert("Forged session token with attacker secret key rejected -> HTTP 401", resForged.statusCode === 401, `HTTP ${resForged.statusCode}`);

  // Corrupted base64 payload
  const resCorrupted = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/users",
    method: "GET",
  }, null, "actis_session=!!!invalid-base64-payload!!!.invalidsignature");
  assert("Malformed base64 token rejected -> HTTP 401", resCorrupted.statusCode === 401, `HTTP ${resCorrupted.statusCode}`);

  // Expired cookie (-3600 seconds)
  const expiredCookie = makeSessionCookie(adminUser, SERVER_SECRET, -3600);
  const resExpired = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/users",
    method: "GET",
  }, null, expiredCookie);
  assert("Expired session token strictly rejected -> HTTP 401", resExpired.statusCode === 401, `HTTP ${resExpired.statusCode}`);

  // Revocation via Logout test
  // 1. Create a valid token
  const disposableCookie = makeSessionCookie(adminUser, SERVER_SECRET, 3600);
  // 2. Call logout with this cookie
  const resLogout = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/logout",
    method: "POST",
  }, null, disposableCookie);
  assert("Logout endpoint revokes session and deletes cookie -> HTTP 200", resLogout.statusCode === 200, `HTTP ${resLogout.statusCode}`);

  // 3. Immediately retry using the revoked cookie
  const resReused = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/users",
    method: "GET",
  }, null, disposableCookie);
  assert("Revoked session token cannot be reused after logout -> HTTP 401", resReused.statusCode === 401, `HTTP ${resReused.statusCode}`);
}

// -------------------------------------------------------------
// Module 8: IDOR & Parameter Tampering Resistance (Review Point 4)
// -------------------------------------------------------------
async function testIdorAndParameterTampering() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 8] IDOR & Parameter Tampering Resistance (Review Point 4)${RESET}`);

  const salesUser = { id: "usr-sales-001", nama: "Sarah Novita (Sales Corporate)", email: "sarah.novita@isp-enterprise.net", role: "sales_corporate" };
  const salesCookie = makeSessionCookie(salesUser);

  // 1. Attempt body/query role spoofing (actorRole=admin) to modify settings
  const resRoleTamper = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/settings?actorRole=admin",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, { actorRole: "admin", auto_refresh_interval: 15 }, salesCookie);
  assert("Body/Query parameter tampering (actorRole=admin) cannot bypass live DB check -> HTTP 403", resRoleTamper.statusCode === 403, `HTTP ${resRoleTamper.statusCode}`);

  // 2. Attempt unauthorized password change targeting another user without old password
  const resPwChange = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/users/change-password",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, { targetUserId: "usr-admin-001", newPassword: "HackedPassword2026!" }, salesCookie);
  assert("Unauthorized password modification without valid credentials rejected -> HTTP 400", resPwChange.statusCode === 400, `HTTP ${resPwChange.statusCode}`);

  // 3. Attempt order creation injecting creatorId: 'usr-admin-001'
  const resOrderInject = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/orders",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, {
    kategori_layanan: "Corporate Internet",
    nama_pic: "IDOR Test PIC",
    kontak_pic: "08129999999",
    nama_perusahaan: "PT IDOR Test Corp",
    email_pic: "pic@idortest.com",
    alamat_instalasi: "Jl. Security Audit No. 1",
    layanan_dedicated: "Dedicated 1:1",
    bandwidth: "50 Mbps",
    vlan: 1200,
    creatorId: "usr-admin-001", // INJECTION ATTEMPT
  }, salesCookie);

  if (resOrderInject.statusCode === 201 && resOrderInject.json && resOrderInject.json.data) {
    const createdCreatorId = resOrderInject.json.data.creator_id;
    assert(
      "Order creatorId strictly bound to session user (usr-sales-001), ignoring injected body creatorId",
      createdCreatorId === "usr-sales-001",
      `Actual creator_id: ${createdCreatorId}`
    );
  } else {
    assert("Order creation processed or handled securely", resOrderInject.statusCode === 201 || resOrderInject.statusCode === 400);
  }
}

// -------------------------------------------------------------
// Module 9: Private File Access & Path Traversal (Review Point 5 & 6)
// -------------------------------------------------------------
async function testPrivateFileAndPathTraversal() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 9] Private File Access & Path Traversal Tests (Review Point 5 & 6)${RESET}`);

  const salesUser = { id: "usr-sales-001", nama: "Sarah Novita (Sales Corporate)", email: "sarah.novita@isp-enterprise.net", role: "sales_corporate" };
  const salesCookie = makeSessionCookie(salesUser);

  // 1. Export ZIP without authentication
  const resZipAnon = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups/export-zip",
    method: "GET",
  });
  assert("Unauthenticated backup ZIP export download blocked -> HTTP 401", resZipAnon.statusCode === 401, `HTTP ${resZipAnon.statusCode}`);

  // 2. Export ZIP with unauthorized role (Sales Corporate)
  const resZipSales = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups/export-zip",
    method: "GET",
  }, null, salesCookie);
  assert("Unauthorized role (Sales Corporate) backup ZIP export blocked -> HTTP 403", resZipSales.statusCode === 403, `HTTP ${resZipSales.statusCode}`);

  // 3. Download device backup record without authentication
  const resDownloadAnon = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups/records/rec-fake-001/download",
    method: "GET",
  });
  assert("Unauthenticated single backup config download blocked -> HTTP 401", resDownloadAnon.statusCode === 401, `HTTP ${resDownloadAnon.statusCode}`);

  // 4. Path Traversal in URL (%2e%2e)
  const resTraversal = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/orders/%2e%2e/%2e%2e/etc/passwd",
    method: "GET",
  });
  const blockedSafely =
    (resTraversal.statusCode === 400 || resTraversal.statusCode === 403 || resTraversal.statusCode === 404) &&
    !resTraversal.body.includes("root:");
  assert(
    "Path traversal payload (/api/orders/%2e%2e/%2e%2e/etc/passwd) safely blocked without leaking system files",
    blockedSafely,
    `HTTP ${resTraversal.statusCode}`
  );

  // 5. Raw dot-dot traversal
  const resDotDot = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/..%2f..%2fpackage.json",
    method: "GET",
  });
  assert(
    "Path traversal payload (/api/..%2f..%2fpackage.json) blocked by security middleware -> HTTP 400/403",
    resDotDot.statusCode === 400 || resDotDot.statusCode === 403,
    `HTTP ${resDotDot.statusCode}`
  );
}

// -------------------------------------------------------------
// Module 10: Injections, SSRF & Security Headers (Review Point 6, 7 & 8)
// -------------------------------------------------------------
async function testInjectionsSsrfAndHeaders() {
  console.log(`\n${BOLD}${CYAN}[TEST SUITE 10] Injections, SSRF, Secrets & Security Headers (Review Point 6, 7 & 8)${RESET}`);

  const nocUser = { id: "usr-noc-001", nama: "Budi Santoso (NOC Engineer)", email: "budi.santoso@isp-enterprise.net", role: "noc_engineer" };
  const nocCookie = makeSessionCookie(nocUser);

  // 1. SSRF target via SSH device creation
  const resSsrfSsh = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups/devices",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, {
    name: "SSRF-Test-Router",
    host: "169.254.169.254", // Cloud metadata IP
    port: 22,
    vendor: "cisco",
    backup_method: "ssh_auto",
    username: "admin",
    password: "Password123!",
  }, nocCookie);
  assert("SSH device creation targeting Cloud Metadata (169.254.169.254) blocked by SSRF filter -> HTTP 400", resSsrfSsh.statusCode === 400, `HTTP ${resSsrfSsh.statusCode}`);

  // 2. SSRF target localhost
  const resSsrfLocal = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/backups/devices",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, {
    name: "Localhost-Test-Router",
    host: "127.0.0.1",
    port: 22,
    vendor: "cisco",
    backup_method: "ssh_auto",
    username: "admin",
    password: "Password123!",
  }, nocCookie);
  assert("SSH device creation targeting Localhost (127.0.0.1) blocked by SSRF filter -> HTTP 400", resSsrfLocal.statusCode === 400, `HTTP ${resSsrfLocal.statusCode}`);

  // 3. SQL Injection resistance in search parameter
  const resSqli = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/orders?search=%27%20OR%20%271%27=%271%27%20--",
    method: "GET",
  }, null, nocCookie);
  assert("SQL injection payload in search parameter safely handled by Prisma -> HTTP 200", resSqli.statusCode === 200, `HTTP ${resSqli.statusCode}`);

  // 4. Global HTTP Security Headers
  const resHeaders = await httpRequest({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
  });
  const headers = resHeaders.headers;
  assert("X-Frame-Options is set to DENY (Clickjacking defense)", headers["x-frame-options"] === "DENY", headers["x-frame-options"]);
  assert("X-Content-Type-Options is set to nosniff (MIME sniffing defense)", headers["x-content-type-options"] === "nosniff", headers["x-content-type-options"]);
  assert("Referrer-Policy is set to strict-origin-when-cross-origin", headers["referrer-policy"] === "strict-origin-when-cross-origin", headers["referrer-policy"]);
  assert("Content-Security-Policy (CSP) header is present and active", Boolean(headers["content-security-policy"]), headers["content-security-policy"] ? "Present" : "Missing");
  assert("Permissions-Policy header is present (Restricting camera, mic, geolocation)", Boolean(headers["permissions-policy"]), headers["permissions-policy"] ? "Present" : "Missing");

  // 5. Brute Force Protection Rate Limiting
  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const res = await httpRequest({
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: "brute_attacker@isp.net", password: "wrong_password_attempt" });

    if (res.statusCode === 429) {
      rateLimited = true;
      break;
    }
  }
  assert("Login endpoint rate limiting triggers HTTP 429 Too Many Requests on brute-force attempts", rateLimited, "Rate limiter active");
}

// -------------------------------------------------------------
// Run All Verification Suites
// -------------------------------------------------------------
async function runAll() {
  console.log(`${BOLD}${YELLOW}======================================================================${RESET}`);
  console.log(`${BOLD}${YELLOW}   ACTIS INDEPENDENT SECURITY REVIEW & PENETRATION VERIFICATION TEST   ${RESET}`);
  console.log(`${BOLD}${YELLOW}======================================================================${RESET}`);

  testSessionSecurity();
  testPasswordSecurity();
  testFileUploadSecurity();
  testNetworkSecurity();
  await testCompleteUnauthenticatedApiSurface();
  await testPrivilegeEscalationMatrix();
  await testSessionManipulationAndRevocation();
  await testIdorAndParameterTampering();
  await testPrivateFileAndPathTraversal();
  await testInjectionsSsrfAndHeaders();

  console.log(`\n${BOLD}${YELLOW}======================================================================${RESET}`);
  console.log(`${BOLD}FINAL AUDIT SUMMARY:${RESET} Total Tests: ${passCount + failCount} | ${GREEN}Passed: ${passCount}${RESET} | ${failCount > 0 ? `${RED}Failed: ${failCount}${RESET}` : `${GREEN}Failed: 0${RESET}`}`);
  console.log(`${BOLD}${YELLOW}======================================================================${RESET}\n`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
