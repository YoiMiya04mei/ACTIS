# INVENTORY MANAGEMENT SYSTEM - PRODUCTION DEPLOYMENT GUIDE
**Application:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Production URL:** `https://actis.jembatandata.com`  
**Target Environment:** Linux / Node.js 18+ / PostgreSQL / Nginx / PM2 or Docker  

---

## 1. Important Safety Principles

> [!CAUTION]
> **ATURAN KESELAMATAN PRODUKSI:**
> 1. DILARANG menjalankan perintah `npx prisma migrate reset` atau perintah apapun yang menghapus/mereset database produksi.
> 2. DILARANG mengubah skema tabel lama ACTIS secara destruktif. Seluruh penambahan modul inventory bersifat **additive** (hanya menambahkan 11 tabel baru berawalan `inventory_`).
> 3. DILARANG melakukan deployment otomatis tanpa persetujuan tim DevOps & Manajer Operasional ACTIS.

---

## 2. Environment Variables Checklist

Pastikan environment variable berikut telah terkonfigurasi dengan benar di file `.env` server produksi:

```env
# Koneksi Database PostgreSQL
DATABASE_URL="postgresql://actis_user:SECURE_PASSWORD@localhost:5432/actis_db?schema=public"

# Kunci Keamanan & Sesi ACTIS
JWT_SECRET="YOUR_PRODUCTION_JWT_SECRET"
NEXTAUTH_SECRET="YOUR_PRODUCTION_NEXTAUTH_SECRET"
NEXT_PUBLIC_APP_URL="https://actis.jembatandata.com"

# Pengaturan Opsional Google Sheets Mirror (jika aktif)
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="..."
GOOGLE_SHEET_ID="..."
```

---

## 3. Step-by-Step Production Deployment Procedure

### Tahap 1: Backup Database Produksi (Wajib)
Sebelum menerapkan pembaruan, buat salinan snapshot database PostgreSQL yang sedang berjalan:

```bash
# Backup database PostgreSQL
pg_dump -U actis_user -h localhost -d actis_db -F c -b -v -f "/backup/actis_db_pre_inventory_$(date +%Y%m%d_%H%M%S).dump"
```

### Tahap 2: Tarik Kode Sumber Terbaru (Git Pull)
```bash
git fetch origin
git checkout main
git pull origin main
```

### Tahap 3: Instal Dependensi
```bash
npm ci --legacy-peer-deps
```

### Tahap 4: Sinkronisasi Skema Database Prisma (Non-Destructive)
Terapkan model baru ke database PostgreSQL produksi tanpa mereset data:

```bash
# Verifikasi skema valid
npx prisma validate

# Terapkan skema baru secara aman (hanya membuat tabel baru inventory_*)
npx prisma db push --skip-generate

# Generate Prisma Client
npx prisma generate
```

### Tahap 5: Seeding Kategori & Master Barang Awal (Opsional / Sekali Saja)
Jika database baru dan belum memiliki data katalog awal:
```bash
node prisma/seed-inventory.js
```
*Catatan:* Skrip `seed-inventory.js` bersifat idempoten (menggunakan mekanisme pengecekan `findFirst` sehingga tidak akan menduplikasi kategori atau barang yang telah ada).

### Tahap 6: Build Aplikasi Next.js
```bash
npm run build
```

### Tahap 7: Jalankan Verifikasi Uji Otomatis
```bash
# Verifikasi 14 skenario inventory
npm run test:inventory

# Verifikasi test suite ACTIS
npm test
```

### Tahap 8: Restart Layanan Produksi
Jika menggunakan PM2:
```bash
pm2 reload actis --update-env
```
Atau jika menggunakan systemd:
```bash
sudo systemctl restart actis
```

---

## 4. Post-Deployment Sanity Checklist

Lakukan pemeriksaan fungsionalitas dasar segera setelah deployment selesai:

1. **Akses Dashboard Utama:** Buka `https://actis.jembatandata.com` dan pastikan login akun admin dan NOC berjalan normal.
2. **Navigasi Sidebar:** Pastikan menu **INVENTORY MANAGEMENT** muncul dengan 12 submenunya.
3. **Cek Fitur Lama:**
   - [ ] Buka menu **Permit Barang** dan buat 1 contoh permit; pastikan PDF dan format teks tetap keluar normal.
   - [ ] Buka menu **POP Site & DCIM Racks**; pastikan visualisasi 3D rack dan OTB tetap berfungsi.
   - [ ] Buka menu **TACACS+ & ICMP Ping**; pastikan monitoring jaringan tetap aktif.
4. **Cek Fitur Inventory Baru:**
   - [ ] Buka `/inventory/dashboard`; pastikan widget metrik dan grafik termuat.
   - [ ] Buka `/inventory/items`; pastikan daftar barang muncul dan tombol filter bekerja.
   - [ ] Uji transaksi barang keluar `/inventory/transactions/out` menggunakan fitur "Ambil Dari Permit Barang".
   - [ ] Uji pengembalian barang `/inventory/returns` dan pastikan saldo stok bertambah kembali.

---

## 5. Rollback Procedure (Rencana Pemulihan)

Jika ditemukan anomali kritis pasca-deployment:

### Rollback Kode Aplikasi
```bash
# Kembalikan kode aplikasi ke commit rilis sebelumnya
git checkout <PREVIOUS_COMMIT_HASH>
npm ci --legacy-peer-deps
npm run build
pm2 reload actis
```

### Rollback Database (Jika Diperlukan)
Karena modul Inventory hanya menambahkan 11 tabel baru yang terisolasi (`inventory_*`) dan tidak mengubah struktur kolom tabel ACTIS eksisting, rollback skema database dapat dilakukan dengan aman tanpa mengganggu data operasional lainnya:

```sql
-- Skrip penghapusan aman tabel modul inventory (jika darurat dibatalkan):
DROP TABLE IF EXISTS inventory_audit_logs CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS inventory_return_details CASCADE;
DROP TABLE IF EXISTS inventory_returns CASCADE;
DROP TABLE IF EXISTS inventory_transaction_details CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_item_units CASCADE;
DROP TABLE IF EXISTS inventory_stocks CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS inventory_categories CASCADE;
DROP TABLE IF EXISTS inventory_settings CASCADE;
```
Atau pulihkan snapshot database yang diambil pada **Tahap 1**:
```bash
pg_restore -U actis_user -h localhost -d actis_db -v -c "/backup/actis_db_pre_inventory_....dump"
```

