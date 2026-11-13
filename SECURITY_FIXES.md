# DOKUMENTASI PERBAIKAN SUMBER KODE (SECURITY FIXES LOG)
**Aplikasi:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Tipe Laporan:** Source Code Hardening & Remediation Log  
**Tanggal:** 13 November 2026  

---

## 1. Daftar File yang Dimodifikasi dan Dibuat

Berikut adalah daftar lengkap seluruh berkas kode yang telah ditambahkan atau diperbarui demi mengamankan sistem:

| No | File Path | Tipe Aksi | Fokus Hardening & Perlindungan |
|---|---|---|---|
| 1 | `src/lib/security.ts` | **BARU** | Pusat keamanan terintegrasi: Cryptographic HMAC token engine, dynamic RBAC middleware, in-memory token revocation, sliding-window rate limiting, SSRF guard, dan magic bytes buffer validator. |
| 2 | `src/middleware.ts` | **BARU** | Global HTTP response headers: Content-Security-Policy (CSP), X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy, HSTS, dan URL path traversal block. |
| 3 | `src/lib/auth.ts` | **UPDATE** | Refactoring untuk mendelegasikan ke `security.ts`. Eliminasi default password fallback (`admin123`/`actis123`), validasi timing-safe Scrypt hash, dan invalidasi sesi saat logout/password change. |
| 4 | `src/lib/backupCrypto.ts` | **UPDATE** | Mengganti hardcoded fallback string dengan `getSafeSessionSecret()`. Memastikan AES-256-GCM derive key menggunakan secret dengan entropi tinggi. |
| 5 | `src/lib/icmpMonitorService.ts` | **UPDATE** | Mengganti `exec` menjadi `execFile("ping", args)` untuk mencegah Command Injection. Validasi IP strictly dan memblokir target SSRF (cloud metadata & loopback). |
| 6 | `src/app/api/auth/login/route.ts` | **UPDATE** | Menerapkan rate limiting (maksimal 5 attempt/menit) dan mengubah atribut cookie sesi menjadi `httpOnly: true`, `secure`, dan `sameSite: "lax"`. |
| 7 | `src/app/api/auth/logout/route.ts` | **UPDATE** | Menginvalidasi cryptographic token pada token revocation list (`jti`) dan menghapus cookie via `maxAge: 0`. |
| 8 | `src/app/api/users/change-password/route.ts` | **UPDATE** | Mewajibkan `requireAuth()`, validasi password lama, rotasi token sesi baru, dan mencabut token lama. |
| 9 | `src/app/api/users/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAuth({ requireAdmin: true })`. Menghapus spoofing `actorRole`. |
| 10 | `src/app/api/users/[id]/route.ts` | **UPDATE** | PUT dan DELETE dilindungi `requireAdmin: true`. Mencegah self-deletion dan menjaga foreign-key integrity log. |
| 11 | `src/app/api/settings/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAdmin: true`. Menghapus spoofing `actorRole`. |
| 12 | `src/app/api/logs/route.ts` | **UPDATE** | GET & POST dilindungi `requireAuth()`. DELETE dilindungi `requireAdmin: true` (mencegah unauthenticated log wipe). |
| 13 | `src/app/api/orders/route.ts` | **UPDATE** | GET & POST dilindungi `requireAuth()`. Mengikat `creatorId` strictly ke `auth.user.id`. |
| 14 | `src/app/api/orders/[id]/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 15 | `src/app/api/orders/[id]/status/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. Mengikat `authorId` ke `auth.user.id`. |
| 16 | `src/app/api/orders/[id]/progress/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. Mengikat `authorId` ke `auth.user.id`. |
| 17 | `src/app/api/orders/[id]/cancel/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. Mengikat `authorId` ke `auth.user.id`. |
| 18 | `src/app/api/orders/[id]/test-results/route.ts` | **UPDATE** | Menerapkan `requireAuth()`, validasi magic bytes (PNG, JPG, PDF) max 10MB, dan randomisasi nama file. |
| 19 | `src/app/api/monitoring/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 20 | `src/app/api/monitoring/[id]/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 21 | `src/app/api/monitoring/[id]/ping/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. |
| 22 | `src/app/api/monitoring/ping-all/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. |
| 23 | `src/app/api/monitoring/telegram/route.ts` | **UPDATE** | GET & Test notification dilindungi `requireAuth()`. Simpan konfigurasi bot dilindungi `requireAdmin: true`. |
| 24 | `src/app/api/orders/telegram/route.ts` | **UPDATE** | GET & Test notification dilindungi `requireAuth()`. Simpan konfigurasi bot dilindungi `requireAdmin: true`. |
| 25 | `src/app/api/pop-sites/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 26 | `src/app/api/pop-sites/[id]/route.ts` | **UPDATE** | GET & PATCH dilindungi `requireAuth()`. DELETE dilindungi `requireAdmin: true` dan menghapus bypass via `?user_id=...`. |
| 27 | `src/app/api/pop-sites/bulk-delete/route.ts` | **UPDATE** | POST dilindungi `requireAdmin: true`. Menghapus bypass via body `user_id`. |
| 28 | `src/app/api/pop-sites/bulk-actions/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. `creatorId` strictly dari sesi pengguna. |
| 29 | `src/app/api/pop-sites/import/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAdmin: true`. Menghapus fallback ke default admin. |
| 30 | `src/app/api/pop-sites/[id]/actions/route.ts` | **UPDATE** | POST dilindungi `requireAuth()`. |
| 31 | `src/app/api/pop-sites/[id]/monitoring/route.ts` | **UPDATE** | GET & POST dilindungi `requireAuth()`. |
| 32 | `src/app/api/dcim/racks/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 33 | `src/app/api/dcim/racks/[id]/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, PATCH dilindungi NOC/Admin, DELETE dilindungi Super Admin. |
| 34 | `src/app/api/dcim/racks/[id]/slots/route.ts` | **UPDATE** | POST dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 35 | `src/app/api/dcim/racks/[id]/slots/[slotId]/route.ts` | **UPDATE** | PATCH & DELETE dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 36 | `src/app/api/dcim/otbs/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 37 | `src/app/api/dcim/otbs/[id]/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, PATCH dilindungi NOC/Admin, DELETE dilindungi Super Admin. |
| 38 | `src/app/api/dcim/otbs/[id]/ports/route.ts` | **UPDATE** | PATCH dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 39 | `src/app/api/ipam/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 40 | `src/app/api/ipam/prefixes/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. POST, PUT, DELETE dilindungi `requireAdmin: true`. Menghapus role spoofing `actorRole`. |
| 41 | `src/app/api/sync/sheets/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`, POST dilindungi `requireAuth({ allowedRoles: ["admin", "noc_engineer"] })`. |
| 42 | `src/app/api/dashboard/stats/route.ts` | **UPDATE** | GET dilindungi `requireAuth()`. |
| 43 | `src/app/api/notifications/route.ts` | **UPDATE** | GET & POST dilindungi `requireAuth()`. Menghapus bypass query param `userId`. |
| 44 | `prisma/seed.js` | **UPDATE** | Pre-hashing password awal pengguna dengan Scrypt + cryptographic salt sehingga tidak ada akun dengan `password_hash = null`. |
| 45 | `.gitignore` | **UPDATE** | Menambahkan `/public/uploads/*`, `uploads/`, `*.pem`, `*.key`, `backup_export_*.zip`. |
| 46 | `.env.example` | **UPDATE** | Menambahkan dokumentasi konfigurasi `SESSION_SECRET` berentropi tinggi (minimal 32 karakter). |
| 47 | `scripts/security-audit-test.js` | **BARU** | Skrip verifikasi keamanan otomatis mencakup 48 skenario pengujian. |
| 48 | `package.json` | **UPDATE** | Menambahkan script `"test:security": "node scripts/security-audit-test.js"`. |

---

## 2. Perbandingan Kode Sebelum dan Sesudah Hardening (Before vs After)

### Contoh 1: BFLA & Parameter Role Spoofing (`src/app/api/settings/route.ts`)
#### Sebelum (VULNERABLE):
```typescript
// Mengambil role dari body atau query param - dapat dipalsukan penyerang
const body = await request.json().catch(() => ({}));
const { actorRole } = body;
const searchRole = new URL(request.url).searchParams.get("actorRole");
const effectiveRole = actorRole || searchRole || "admin"; // Bypassed!
if (effectiveRole !== "admin") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```
#### Sesudah (HARDENED):
```typescript
// Terpusat via requireAuth: memvalidasi HMAC token dan role aktual di DB
const auth = await requireAuth(request, { requireAdmin: true });
if (!auth.ok) return auth.response;

// auth.user.role terjamin 'admin' langsung dari database PostgreSQL
const actorName = auth.user.nama;
```

---

### Contoh 2: Arbitrary File Upload di Test Results (`src/app/api/orders/[id]/test-results/route.ts`)
#### Sebelum (VULNERABLE):
```typescript
// Tanpa autentikasi, tanpa cek magic bytes, nama file hanya sanitasi biasa
const formData = await request.formData();
const file = formData.get("file") as File;
const fileName = file.name;
const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
fs.writeFileSync(path.join(uploadsDir, `${Date.now()}_${sanitizedName}`), buffer);
```
#### Sesudah (HARDENED):
```typescript
// Autentikasi ketat: NOC, Field Engineer, atau Admin
const auth = await requireAuth(request, {
  allowedRoles: ["admin", "noc_engineer", "field_engineer"],
});
if (!auth.ok) return auth.response;

// Validasi Magic Bytes Buffer (PNG, JPG, PDF) + Max 10MB
const validation = validateUploadedBuffer(buffer, file.name);
if (!validation.valid) {
  return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
}

// Random token kriptografis mencegah file guessing / path collision
const randomPrefix = crypto.randomBytes(12).toString("hex");
const storedFileName = `${Date.now()}_${randomPrefix}_${sanitizedName}`;
```

---

### Contoh 3: Command Injection & SSRF pada ICMP Ping (`src/lib/icmpMonitorService.ts`)
#### Sebelum (VULNERABLE):
```typescript
// Shell interpolation rentan injeksi perintah sistem operasi
const cmd = isWin ? `ping -n 1 -w 2000 ${cleanHost}` : `ping -c 1 -W 2 ${cleanHost}`;
exec(cmd, (error, stdout, stderr) => { ... });
```
#### Sesudah (HARDENED):
```typescript
// 1. Validasi IP format & Hostname aman
if (!isValidIpAddress(cleanHost) && !isValidHostname(cleanHost)) {
  return resolve({ status: "DOWN", latency_ms: null, msg: "Format target host/IP tidak valid." });
}

// 2. Proteksi SSRF terhadap IP lokal & cloud metadata (169.254.169.254)
if (isRestrictedNetworkTarget(cleanHost)) {
  return resolve({ status: "DOWN", latency_ms: null, msg: "Akses target ditolak: Alamat IP internal/link-local diblokir." });
}

// 3. Eksekusi aman tanpa shell interpreter melalui execFile
const pingArgs = isWin ? ["-n", "1", "-w", "2000", cleanHost] : ["-c", "1", "-W", "2", cleanHost];
execFile("ping", pingArgs, { timeout: 4000 }, (error, stdout, stderr) => { ... });
```

---

### Contoh 4: Insecure Cookie & Brute Force Protection (`src/app/api/auth/login/route.ts`)
#### Sebelum (VULNERABLE):
```typescript
// Cookie dapat diakses JavaScript (httpOnly: false), tanpa rate limiting
response.cookies.set("actis_session", token, {
  httpOnly: false, // XSS can steal session
  secure: false,
  path: "/",
});
```
#### Sesudah (HARDENED):
```typescript
// Proteksi brute force login: Max 5 percobaan per menit per IP & Email
const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
const ipLimit = checkRateLimit(`login-ip:${ip}`, 5, 60);
if (!ipLimit.allowed) {
  return NextResponse.json({ success: false, error: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit." }, { status: 429 });
}

// Cookie sesi aman (HttpOnly, Secure di production, SameSite Lax)
response.cookies.set("actis_session", token, getSessionCookieOptions(86400 * 7));
```

---

## 3. Peningkatan Arsitektural Keamanan

1. **Centralized RBAC Middleware (`requireAuth`)**:  
   Tidak ada lagi endpoint yang melakukan pengecekan hak akses secara parsial atau ad-hoc. Setiap request internal diverifikasi melalui satu fungsi standar yang memeriksa keaslian token kriptografis dan memvalidasi eksistensi serta peran pengguna secara live di PostgreSQL.

2. **Defense-in-Depth HTTP Headers**:  
   Melalui `src/middleware.ts`, peramban klien dipaksa mengaktifkan seluruh proteksi modern, memblokir rendering di dalam iframe luar (anti-clickjacking), menolak interpretasi MIME yang salah (anti-MIME sniffing), dan menerapkan Content Security Policy yang ketat.

3. **In-Memory Token Revocation (`jti`)**:  
   Ketika pengguna melakukan logout atau mengganti password, token sesi lama dicatat dalam daftar *revocation map* sehingga token lama tersebut tidak dapat digunakan kembali meskipun masa berlakunya belum habis.

