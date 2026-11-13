# INVENTORY MANAGEMENT SYSTEM - ARCHITECTURE DESIGN
**Application:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Document Version:** 1.0.0  
**Target Environment:** Node.js 18+ / Next.js 15 (App Router) / PostgreSQL / Prisma ORM  

---

## 1. Executive Summary
Modul **Inventory Management System** pada ACTIS dirancang untuk mengelola seluruh siklus hidup aset perangkat keras (hardware) dan material instalasi pada operasional ISP (Internet Service Provider). Modul ini terintegrasi langsung ke dalam arsitektur aplikasi ACTIS yang telah berjalan tanpa mengubah fondasi database lama, teknologi dasar (Next.js 15, React 19, Tailwind CSS), maupun merusak fungsionalitas inti (Permit Barang, POP Site, NOC, Rack/DCIM, TACACS+, ICMP Ping Monitoring).

---

## 2. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                   ACTIS FRONTEND                                  |
|   +------------------------------------+    +----------------------------------+  |
|   |   Sidebar: INVENTORY MANAGEMENT    |    |   Existing Modules               |  |
|   |   - Dashboard Inventory            |    |   - Permit Generator             |  |
|   |   - Master Barang                  |    |   - POP Sites & Racks (DCIM)     |  |
|   |   - Kategori & Stok Inventory      |    |   - TACACS+ & ICMP Monitor       |  |
|   |   - Transaksi (Masuk, Keluar)      |    +----------------------------------+  |
|   |   - Sedang Digunakan (In-Use)      |                     |                    |
|   |   - Pengembalian (Returns)         |                     v                    |
|   |   - Habis Pakai (Consumables)      |          IndexedDB / LocalStorage        |
|   |   - Riwayat & Laporan & Pengaturan |          (Permit Documents Archive)      |
|   +------------------------------------+                     |                    |
+--------------------------------------------------------------|--------------------+
                                | (Fetch / JSON)               |
                                v                              v
+-----------------------------------------------------------------------------------+
|                                NEXT.JS APP ROUTER API                             |
|  /api/inventory/dashboard  |  /api/inventory/items       |  /api/inventory/stock  |
|  /api/inventory/categories |  /api/inventory/transactions|  /api/inventory/in-use|
|  /api/inventory/returns    |  /api/inventory/consumables |  /api/inventory/permit |
|  /api/inventory/history    |  /api/inventory/settings    |                        |
+-----------------------------------------------------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
+------------------------------------+    +--------------------------------------+
|     AUTH & AUTHORIZATION (RBAC)    |    |    INVENTORY CORE SERVICE LAYER      |
|  - JWT Session Validation          |    |  - processStockIn()                  |
|  - User Roles Matrix               |    |  - processStockOut()                 |
|  - Role-Based Permissions Guard    |    |  - processReturn()                   |
+------------------------------------+    |  - updateInUseAssignment()           |
                                          |  - adjustStock() & performOpname()   |
                                          |  - Concurrency Lock (FOR UPDATE)     |
                                          |  - Auto-Numbering Engine             |
                                          +--------------------------------------+
                                                             |
                                                             v
+------------------------------------------------------------------------------------+
|                               PRISMA ORM & POSTGRESQL                              |
|   inventory_categories      | inventory_items        | inventory_item_units        |
|   inventory_stocks          | inventory_transactions | inventory_transaction_detail|
|   inventory_returns         | inventory_return_detail| inventory_movements         |
|   inventory_audit_logs      | inventory_settings                                   |
+------------------------------------------------------------------------------------+
```

---

## 3. Reusable vs Consumable Lifecycle & Formulas

Sistem membedakan secara tegas alur kerja dua jenis barang:

### A. Reusable Items (Barang Tidak Habis Pakai)
*Contoh:* Router (MikroTik CCR), Switch (Ruijie), SFP+ Transceiver, OTB, Fusion Splicer, OPM, Toolkit Teknisi, Laptop.
- **Siklus Hidup:** Masuk Gudang $\rightarrow$ Diserahkan ke Teknisi/Lokasi (Status: Sedang Digunakan) $\rightarrow$ Dikembalikan ke Gudang (Status: Baik, Rusak, atau Hilang).
- **Rumus Ketersediaan Stok:**
  $$\text{Stok Tersedia} = \text{Total Masuk} - \text{Total Sedang Digunakan} - \text{Total Rusak} - \text{Total Hilang} + \text{Penyesuaian Opname}$$
- **Aturan Pengembalian (Return Rules):**
  - **Kondisi Baik:** Stok bertambah kembali ke `available_stock`, `in_use_stock` berkurang.
  - **Kondisi Rusak (Ringan/Berat):** `in_use_stock` berkurang, barang dialokasikan ke `damaged_stock`. **Tidak menambah `available_stock`**.
  - **Kondisi Hilang:** `in_use_stock` berkurang, barang dialokasikan ke `lost_stock`. **Tidak menambah `available_stock`**.
  - **Pengembalian Parsial (Partial Return):** Mendukung pengembalian bertahap (misal keluar 5 unit, kembali 3 unit; sisa 2 unit tetap berstatus `SEDANG_DIGUNAKAN`).
  - **Pengembalian Penuh (Full Return):** Ketika sisa yang belum kembali mencapai 0, status transaksi detail otomatis berubah menjadi `SUDAH_KEMBALI`.

### B. Consumable Items (Barang Habis Pakai)
*Contoh:* Kabel UTP Cat6, Kabel Dropcore Fiber Optic, Konektor RJ45, Patch Cord, Protection Sleeve, Kabel Ties, Isolasi, Baut Rack.
- **Siklus Hidup:** Masuk Gudang $\rightarrow$ Dikeluarkan untuk Penggunaan/Instalasi $\rightarrow$ Stok berkurang secara permanen.
- **Rumus Ketersediaan Stok:**
  $$\text{Stok Tersedia} = \text{Total Masuk} - \text{Total Terpakai (Consumed)} + \text{Penyesuaian Opname}$$
- **Aturan Konsumsi (Consumption Rules):**
  - Pengeluaran consumable langsung mengkreditkan kuantitas ke `consumed_stock`.
  - **Dilarang keras:** Mengembalikan barang consumable melalui alur reusable return. Sistem secara otomatis menolak request return untuk barang bertipe `CONSUMABLE` dengan error HTTP 400.

---

## 4. Concurrency Protection & Transaction Atomicity

Untuk mencegah **Race Condition** dan **Negative Stock** akibat transaksi bersamaan dari banyak teknisi/petugas gudang, seluruh mutasi stok wajib dijalankan dalam transaksi atomik Prisma:

1. **Prisma Interactive Transaction (`prisma.$transaction`):**
   Setiap operasi Stock Out, Stock In, Return, dan Adjustment dibungkus dalam blok transaksi terisolasi.
2. **Row-Level Pessimistic Locking (`SELECT ... FOR UPDATE`):**
   Sebelum mengurangi stok, sistem mengunci baris `inventory_stocks` terkait:
   ```sql
   SELECT * FROM inventory_stocks WHERE item_id = $1 FOR UPDATE;
   ```
   Operasi konkuren lainnya harus menunggu hingga transaksi pertama selesai (commit atau rollback).
3. **Pemeriksaan Ketersediaan Stok:**
   ```typescript
   if (stock.available_stock.lessThan(requestedQty)) {
     throw new Error(`Stok tidak mencukupi untuk barang ${item.name}. Tersedia: ${stock.available_stock}, Diminta: ${requestedQty}`);
   }
   ```
4. **Append-Only Movement Logging:**
   Setiap mutasi stok diwajibkan menyertakan catatan `InventoryMovement` yang merekam saldo sebelum (`balance_before`) dan saldo sesudah (`balance_after`).

---

## 5. Role-Based Access Control (RBAC) Matrix

Tabel otorisasi diimplementasikan pada `src/lib/inventoryAuth.ts`:

| Hak Akses / Kemampuan | Admin | Warehouse Admin | NOC Engineer | Field Engineer | Sales / Guest |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Lihat Dashboard & Stok** | Ya | Ya | Ya | Ya | Hanya Baca |
| **Kelola Master Barang & Kategori** | Ya | Ya | Tidak | Tidak | Tidak |
| **Transaksi Barang Masuk (Stock In)** | Ya | Ya | Tidak | Tidak | Tidak |
| **Transaksi Barang Keluar (Stock Out)** | Ya | Ya | Ya | Tidak | Tidak |
| **Proses Pengembalian (Returns)** | Ya | Ya | Ya | Tidak | Tidak |
| **Update PIC / Lokasi In-Use** | Ya | Ya | Ya | Tidak | Tidak |
| **Stock Opname & Adjustment** | Ya | Ya | Tidak | Tidak | Tidak |
| **Export Excel / CSV & Laporan** | Ya | Ya | Ya | Ya | Tidak |
| **Ubah Pengaturan Sistem** | Ya | Tidak | Tidak | Tidak | Tidak |
| **Hapus Histori Transaksi / Movement** | **DITOLAK (403)** | **DITOLAK (403)** | **DITOLAK (403)** | **DITOLAK (403)** | **DITOLAK (403)** |

---

## 6. Permit Barang Integration Strategy

Fitur **Permit Barang** yang sudah ada di ACTIS menghasilkan dokumen resmi (PDF & Teks WhatsApp) izin keluar/masuk barang ke gedung/data center. Integrasi ke Inventory dirancang dengan prinsip **Decoupled Verification**:

1. **Pembuatan Dokumen Izin (Permit Creation):**
   - Teknisi membuat Surat Permit Keluar di `/tools/documents` atau Generator Permit.
   - Form permit menyediakan tombol **"Cek Stok Gudang"** yang memanggil endpoint `/api/inventory/permit-sync?action=check_stock`.
   - Sistem menampilkan badge ketersediaan stok fisik di gudang.
   - **PENTING:** Stok database **TIDAK** berkurang pada tahap pembuatan surat izin ini.
2. **Penyerahan Fisik Barang (Physical Handover):**
   - Setelah surat disetujui pihak gedung/manajemen dan barang diambil secara fisik dari gudang, petugas gudang membuka menu **Barang Keluar** (`/inventory/transactions/out`).
   - Petugas dapat mengklik tombol **"Ambil Dari Permit Barang"**, memilih dokumen surat izin terkait, dan form akan otomatis terisi (PIC, No HP, Lokasi, Perihal, No Referensi Permit, serta daftar perangkat).
   - Saat formulir Barang Keluar disimpan, sistem menjalankan transaksi atomik `processStockOut`, memotong stok fisik, mencatat `InventoryMovement`, dan mengalihkan status unit ke **Barang Sedang Digunakan**.
3. **Pengembalian Reusable (Return Handover):**
   - Saat barang kembali ke gudang, petugas membuka `/inventory/returns`, memasukkan nomor transaksi keluar atau nomor referensi permit, dan mencatat kondisi fisik perangkat.

---

## 7. Append-Only Audit Trail & Data Protection

1. **Larangan Penghapusan Histori:**
   - Seluruh request `DELETE` pada endpoint `/api/inventory/transactions`, `/api/inventory/returns`, dan `/api/inventory/history` secara permanen mengembalikan status `HTTP 403 Forbidden`.
2. **Audit Logging Komprehensif:**
   - Tabel `inventory_audit_logs` mencatat seluruh tindakan:
     - Siapa pelaksana (`user_id`, `user_name`, `user_email`).
     - Alamat IP (`ip_address`).
     - Data sebelum perubahan (`old_data` format JSON).
     - Data sesudah perubahan (`new_data` format JSON).
     - Alasan perubahan (`reason`).
3. **Soft Delete pada Master Barang:**
   - Jika barang pernah memiliki riwayat transaksi/pergerakan, barang tidak dapat di-`DELETE` secara fisik dari database. Sistem menerapkan soft-delete dengan mengubah `is_active = false`.

