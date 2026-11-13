# PANDUAN DEPLOYMENT AMAN KE PRODUCTION (SECURITY DEPLOYMENT GUIDE)
**Aplikasi:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Target Lingkungan:** On-Premises Server / Private Cloud VPS / Dedicated Server  
**Kepatuhan:** CIS Benchmarks, OWASP ASVS Level 2, DevSecOps Best Practices  

---

## 1. Daftar Periksa Keamanan Pra-Deployment (Production Checklist)

Sebelum merilis ACTIS ke lingkungan production, pastikan seluruh item berikut telah terverifikasi:

- [ ] **Secret Kriptografis Wajib:** `SESSION_SECRET` telah dibuat menggunakan generator acak berkekuatan tinggi (minimal 32 byte) dan tidak menggunakan string default.
- [ ] **Enkripsi Kredensial Perangkat:** `BACKUP_ENCRYPTION_KEY` telah diatur untuk mengamankan password SSH router/switch di database.
- [ ] **Isolasi Database:** Port PostgreSQL (`15432` atau `5432`) **TIDAK** dibuka ke publik (0.0.0.0/0). Port hanya boleh diakses melalui jaringan internal Docker (`postgres:5432`) atau bind lokal `127.0.0.1:15432`.
- [ ] **Firewall TACACS+ RFC 8907:** Port TCP `49` hanya diizinkan untuk IP management router/switch jaringan ISP (Whitelisting subnet NOC/Core Network).
- [ ] **HTTPS / TLS Mandatory:** Aplikasi berjalan di balik Reverse Proxy (Nginx, Caddy, atau Traefik) dengan sertifikat TLS valid (Let's Encrypt / Enterprise SSL).
- [ ] **Non-Root Container:** Container berjalan dengan pengguna non-root di dalam Dockerfile.
- [ ] **Environment Secrecy:** Berkas `.env` tidak pernah dikomit ke Git (telah diverifikasi di `.gitignore`).

---

## 2. Pembuatan Kunci Rahasia Kriptografis (Secret Generation)

Jalankan perintah berikut di terminal Linux/macOS atau PowerShell untuk menghasilkan secret berentropi tinggi:

```bash
# 1. Menghasilkan SESSION_SECRET (Wajib - 64 karakter hex / 32 bytes)
openssl rand -hex 32

# 2. Menghasilkan BACKUP_ENCRYPTION_KEY (Wajib - Kunci enkripsi AES-256 router credentials)
openssl rand -hex 32

# 3. Menghasilkan password database PostgreSQL yang kuat
openssl rand -base64 24
```

Masukkan nilai tersebut ke dalam berkas `.env` server production Anda:
```env
SESSION_SECRET="d58f3b92c4a17e089d2e1b4c6a8f7e9123456789abcdef0123456789abcdef01"
BACKUP_ENCRYPTION_KEY="f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
POSTGRES_PASSWORD="ganti-dengan-password-database-yang-sangat-kuat"
```

---

## 3. Konfigurasi Docker & Docker Compose Aman

### A. Konfigurasi `docker-compose.yml`
Pastikan database tidak mengekspos port ke alamat publik:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: actis_postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-actis_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # HANYA bind ke localhost jika butuh akses dari host mesin lokal:
    ports:
      - "127.0.0.1:15432:5432"
    networks:
      - actis_internal_net

  actis_app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: actis_app
    restart: always
    depends_on:
      - postgres
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      - SESSION_SECRET=${SESSION_SECRET}
      - BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
    ports:
      - "127.0.0.1:3000:3000" # Hanya diakses via Reverse Proxy Nginx lokal
      - "0.0.0.0:49:49"       # TACACS+ Server (RFC 8907) dilindungi UFW Firewall
    volumes:
      - uploads_data:/app/public/uploads
    networks:
      - actis_internal_net

networks:
  actis_internal_net:
    driver: bridge

volumes:
  postgres_data:
  uploads_data:
```

---

## 4. Konfigurasi Reverse Proxy (Nginx) dengan SSL & Hardened Headers

Gunakan template konfigurasi Nginx berikut pada server host Anda (`/etc/nginx/sites-available/actis.conf`):

```nginx
# Redirect HTTP ke HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name actis.isp-enterprise.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name actis.isp-enterprise.net;

    # Konfigurasi Sertifikat SSL/TLS
    ssl_certificate /etc/letsencrypt/live/actis.isp-enterprise.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/actis.isp-enterprise.net/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Pembatasan Ukuran Maksimal Upload (10MB)
    client_max_body_size 12M;

    # Rate Limiting Nginx untuk proteksi DDoS / Bruteforce
    limit_req_zone $binary_remote_addr zone=actis_login_limit:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=actis_general_limit:10m rate=30r/s;

    # Security Headers Tambahan di Level Web Server
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Khusus Endpoint Autentikasi Login (Rate Limited Ketat)
    location /api/auth/login {
        limit_req zone=actis_login_limit burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Penanganan Utama
    location / {
        limit_req zone=actis_general_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Konfigurasi Firewall Host (UFW Linux)

Amankan port server dari pemindaian internet publik:

```bash
# 1. Default policy: tolak semua koneksi masuk
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Izinkan akses SSH administrasi server (dari IP kantor / jump host)
sudo ufw allow from 103.155.196.0/24 to any port 22 proto tcp

# 3. Izinkan akses Web HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 4. Batasi akses port TACACS+ (Port 49) HANYA untuk router / switch network ISP
sudo ufw allow from 10.240.0.0/16 to any port 49 proto tcp
sudo ufw allow from 103.155.196.0/24 to any port 49 proto tcp

# 5. Aktifkan Firewall
sudo ufw enable
sudo ufw status verbose
```

---

## 6. Prosedur Rotasi Secret & Password

1. **Rotasi Session Secret:**  
   Bila terjadi insiden keamanan, ubah `SESSION_SECRET` di `.env` dan restart container (`docker compose restart actis_app`). Tindakan ini secara otomatis membatalkan seluruh sesi login lama tanpa merusak data pelanggan.
2. **Rotasi Password Admin:**  
   Gunakan menu ganti password internal di ACTIS (`POST /api/users/change-password`) yang secara otomatis menerapkan algoritma Scrypt ber-salt acak dan mencabut token sesi lama.

