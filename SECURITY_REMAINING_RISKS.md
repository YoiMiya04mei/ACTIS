# ANALISIS RISIKO RESIDU & PANDUAN PENGEMBANGAN JANGKA PANJANG (SECURITY REMAINING RISKS & ROADMAP)
**Aplikasi:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Tipe Dokumen:** Residual Risk Assessment & Security Roadmap  
**Tanggal:** 13 November 2026  

---

## 1. Analisis Risiko Residu (Residual Risk Assessment)

Meskipun seluruh kerentanan kode kritis (Critical & High) telah berhasil ditambal 100% dan lolos 48 uji penetrasi, dalam arsitektur aplikasi enterprise berskala besar terdapat risiko residu yang bergantung pada lingkungan infrastruktur dan operasional tingkat lanjut:

| Aspek Keamanan | Status Saat Ini | Batasan & Potensi Risiko Residu | Rekomendasi Defense-in-Depth |
|---|---|---|---|
| **Rate Limiter Multikontainer** | In-Memory Sliding Window (`Map`) | Jika ACTIS di-scale secara horizontal menjadi beberapa container Node.js di balik load balancer, memory map tidak terbagi antar instance. | Integrasikan **Redis** sebagai centralized rate limit store jika aplikasi di-deploy dalam cluster multi-node. |
| **Pembersihan File Malware / Antivirus** | Magic Bytes & Extension Whitelist | Mencegah polyglot XSS, executable disguise, dan script web, tetapi tidak mendeteksi embedded exploit tingkat lanjut (misal: CVE zero-day pada parser PDF pembaca). | Integrasikan daemon **ClamAV** atau AWS GuardDuty / GCP VirusScan untuk melakukan pemindaian asinkron pada file yang baru diunggah. |
| **Penyimpanan Sesi Kriptografis** | HMAC-SHA256 Stateless + In-Memory Revocation | Sesi dicabut seketika dalam memori container. Jika container di-restart, daftar token yang dicabut (revoked tokens) terhapus dari RAM. | Simpan tabel `revoked_tokens` di PostgreSQL atau Redis dengan TTL sesuai waktu kedaluwarsa token. |
| **Kunci Enkripsi Root (KMS)** | Environment Variable (`BACKUP_ENCRYPTION_KEY`) | Jika server host fisik atau file `.env` di-dump oleh penyerang dengan hak root OS, kunci enkripsi dapat terbaca. | Pertimbangkan integrasi **HashiCorp Vault**, AWS KMS, atau hardware security module (HSM) untuk enterprise skala tinggi. |
| **Autentikasi Multi-Faktor (MFA / 2FA)** | Password Scrypt Kuat + Session Rotation | Kredensial akun rentan jika perangkat engineer NOC terinfeksi malware pencatat penekanan tombol (*keylogger*). | Implementasikan TOTP (Google Authenticator / Authy) atau WebAuthn/FIDO2 Hardware Keys untuk peran Admin dan NOC. |

---

## 2. Peta Jalan Peningkatan Keamanan (Security Roadmap)

### Q1 2027: Multi-Factor Authentication & Advanced Session Store
- [ ] Implementasi **Time-based One-Time Password (TOTP 2FA)** untuk role `admin` dan `noc_engineer`.
- [ ] Migrasi blacklist/revocation token sesi dari in-memory Map ke tabel database PostgreSQL ber-index TTL.
- [ ] Audit berkala dependensi pihak ketiga menggunakan `npm audit` terautomasi dalam CI/CD pipeline (GitHub Actions).

### Q2 2027: Integrasi Antivirus Scanning & Storage Private Object Storage
- [ ] Penambahan microservice **ClamAV Daemon** untuk pemindaian asinkron setiap file hasil uji jaringan yang diunggah.
- [ ] Pemindahan penyimpanan file dari lokal `/public/uploads` ke Private S3/MinIO Object Storage yang diakses melalui URL bertanda tangan sementara (*presigned URLs* dengan masa berlaku 15 menit).

### Q3 2027: Security Information and Event Management (SIEM)
- [ ] Ekspor log audit keamanan ACTIS (`recordActivity`) ke format syslog standar RFC 5424.
- [ ] Integrasi webhook alert ke platform monitoring enterprise (seperti Wazuh, Graylog, atau Splunk) untuk mendeteksi anomali login di luar jam kerja NOC.

### Q4 2027: Zero Trust Network Access (ZTNA) & Hardware Security
- [ ] Pembatasan akses web ACTIS menggunakan Cloudflare Access / Tailscale / WireGuard VPN privat internal perusahaan.
- [ ] Integrasi HashiCorp Vault untuk rotasi berkala password router/switch dan shared secrets TACACS+.

