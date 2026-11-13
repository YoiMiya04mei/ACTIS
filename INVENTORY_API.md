# INVENTORY MANAGEMENT SYSTEM - API DOCUMENTATION
**Application:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Base URL:** `/api/inventory`  
**Authentication:** Cookie Session JWT or Bearer Token (`requireAuth`)  
**Format:** JSON (`application/json`)  

---

## 1. Authentication & Response Format

Setiap request ke endpoint `/api/inventory/*` membutuhkan sesi login pengguna aktif ACTIS.

### Format Respons Sukses (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operasi berhasil diselesaikan."
}
```

### Format Respons Gagal (HTTP 400 / 401 / 403 / 404 / 500)
```json
{
  "success": false,
  "error": "Pesan deskripsi kesalahan teknis atau validasi bisnis."
}
```

---

## 2. API Endpoints Catalog

### 2.1 Dashboard Analytics
- **GET `/api/inventory/dashboard`**
  - **Deskripsi:** Mengambil metrik ringkasan inventaris, ketersediaan stok, peringatan stok minimum, transaksi terbaru, dan grafik tren bulanan.
  - **Izin:** Semua role terautentikasi (Admin, Warehouse Admin, NOC, Field Engineer, Sales).
  - **Respons:**
    ```json
    {
      "success": true,
      "data": {
        "summary": {
          "total_items": 13,
          "total_available_stock": 1420,
          "total_reusable_items": 7,
          "total_consumable_items": 6,
          "total_in_use": 18,
          "total_unreturned": 18,
          "total_consumed": 450,
          "total_low_stock": 2
        },
        "low_stock_items": [ ... ],
        "recent_in": [ ... ],
        "recent_out": [ ... ],
        "recent_returns": [ ... ],
        "monthly_chart": [
          { "month": "Jan", "stock_in": 100, "stock_out": 40 },
          { "month": "Feb", "stock_in": 150, "stock_out": 65 }
        ],
        "category_distribution": [ ... ]
      }
    }
    ```

---

### 2.2 Master Kategori Barang
- **GET `/api/inventory/categories`**
  - **Deskripsi:** Mendapatkan daftar seluruh kategori barang beserta jumlah item terdaftar.
- **POST `/api/inventory/categories`**
  - **Deskripsi:** Menambah kategori baru.
  - **Izin:** Admin & Warehouse Admin.
  - **Body:**
    ```json
    {
      "name": "Optical Transport",
      "description": "Perangkat DWDM dan transponder optik"
    }
    ```
- **PUT `/api/inventory/categories/:id`**
  - **Deskripsi:** Memperbarui nama atau deskripsi kategori.
- **DELETE `/api/inventory/categories/:id`**
  - **Deskripsi:** Menghapus kategori. Ditolak jika terdapat barang aktif di dalamnya.

---

### 2.3 Master Katalog Barang
- **GET `/api/inventory/items`**
  - **Query Params:**
    - `page` (default 1)
    - `limit` (default 20)
    - `search` (pencarian kode, nama, model, atau merek)
    - `category_id` (filter kategori)
    - `type` (`REUSABLE` / `CONSUMABLE`)
    - `status` (`active` / `inactive` / `all`)
- **POST `/api/inventory/items`**
  - **Deskripsi:** Registrasi barang baru ke Master Katalog dan menginisialisasi saldo stok awal.
  - **Izin:** Admin & Warehouse Admin.
  - **Body:**
    ```json
    {
      "name": "MikroTik CCR2004-16G-2S+",
      "category_id": "cat-uuid",
      "type": "REUSABLE",
      "brand": "MikroTik",
      "model": "CCR2004-16G-2S+",
      "unit": "Unit",
      "min_stock": 5,
      "storage_location": "Gudang Utama - Rak B2",
      "initial_stock": 10,
      "description": "Router Core 16 Port Gigabit & 2 Port SFP+ 10G",
      "serials": ["SN-CCR-001", "SN-CCR-002"]
    }
    ```
- **GET `/api/inventory/items/:id`**
  - **Deskripsi:** Detail lengkap barang beserta saldo stok, serial unit, dan pergerakan terakhir.
- **PUT `/api/inventory/items/:id`**
  - **Deskripsi:** Memperbarui data katalog master barang.
- **DELETE `/api/inventory/items/:id`**
  - **Deskripsi:** Menghapus barang. Jika barang memiliki riwayat transaksi/pergerakan, sistem otomatis melakukan **soft-delete** (`is_active = false`).
- **GET `/api/inventory/items/export`**
  - **Deskripsi:** Mengunduh seluruh master barang dalam format spreadsheet CSV/Excel.
- **POST `/api/inventory/items/import`**
  - **Deskripsi:** Import massal barang dari file CSV/Excel.

---

### 2.4 Monitoring & Penyesuaian Stok
- **GET `/api/inventory/stock`**
  - **Deskripsi:** Memantau saldo stok seluruh barang (Stok Awal, Masuk, Keluar, Digunakan, Kembali, Terpakai, Rusak, Hilang, dan Stok Tersedia).
- **POST `/api/inventory/stock/adjust`**
  - **Deskripsi:** Koreksi saldo stok dengan audit trail wajib.
  - **Izin:** Admin & Warehouse Admin.
  - **Body:**
    ```json
    {
      "item_id": "item-uuid",
      "new_stock": 15,
      "reason": "Hasil rekonsiliasi stok fisik rak A1",
      "warehouse_officer": "Budi Santoso"
    }
    ```
- **POST `/api/inventory/stock/opname`**
  - **Deskripsi:** Mencatat hasil stock opname periodik untuk banyak barang sekaligus.
  - **Body:**
    ```json
    {
      "opname_date": "2026-11-13T00:00:00Z",
      "warehouse_officer": "Budi Santoso",
      "notes": "Stock Opname Triwulan IV",
      "items": [
        { "item_id": "item-uuid-1", "physical_stock": 12, "notes": "Sesuai" },
        { "item_id": "item-uuid-2", "physical_stock": 8, "notes": "Selisih -1 unit" }
      ]
    }
    ```

---

### 2.5 Transaksi Gudang (Barang Masuk & Keluar)
- **POST `/api/inventory/transactions/in`**
  - **Deskripsi:** Mencatat penerimaan barang masuk ke gudang (Pengadaan baru / Transfer).
  - **Body:**
    ```json
    {
      "transaction_date": "2026-11-13T09:00:00Z",
      "supplier_or_sender": "PT Distributor Jaringan",
      "warehouse_officer": "Budi Santoso",
      "notes": "Penerimaan PO #2026-11-09",
      "items": [
        {
          "item_id": "item-uuid",
          "quantity": 10,
          "unit_cost": 2500000,
          "serials": ["SN-101", "SN-102"]
        }
      ]
    }
    ```

- **POST `/api/inventory/transactions/out`**
  - **Deskripsi:** Transaksi pengeluaran barang dari gudang. Sistem memeriksa ketersediaan stok secara atomik menggunakan row locking (`FOR UPDATE`). Jika stok tidak mencukupi, transaksi dibatalkan (rollback).
  - **Body:**
    ```json
    {
      "transaction_date": "2026-11-13T10:00:00Z",
      "pic_name": "Rahmat & Hendrik",
      "pic_phone": "085759535195",
      "department": "Field Operations / NOC",
      "location": "Gedung Wisma Bumi Putera Suite 701A",
      "purpose": "Aktivasi Link Pelanggan Baru",
      "warehouse_officer": "Budi Santoso",
      "permit_ref_id": "permit-doc-123",
      "permit_ref_number": "001/P-KLR/JDP/XI/2026",
      "notes": "Berdasarkan Dokumen Permit Resmi",
      "items": [
        {
          "item_id": "item-uuid-reusable",
          "quantity": 1,
          "notes": "Router Core Pelanggan"
        },
        {
          "item_id": "item-uuid-consumable",
          "quantity": 50,
          "notes": "Tarikan kabel UTP 50 Meter"
        }
      ]
    }
    ```

- **DELETE `/api/inventory/transactions` & `/api/inventory/transactions/:id`**
  - **Status:** **HTTP 403 Forbidden** (Append-Only Enforcement).

---

### 2.6 Monitoring Barang Sedang Digunakan (In-Use)
- **GET `/api/inventory/in-use`**
  - **Deskripsi:** Menampilkan seluruh barang reusable yang berada di luar gudang beserta sisa unit yang belum kembali.
  - **Query Params:** `pic_name`, `location`, `status`, `search`, `page`, `limit`.
- **PUT `/api/inventory/in-use`**
  - **Deskripsi:** Memperbarui data penanggung jawab (PIC), lokasi penggunaan, atau keterangan tanpa mengubah angka stok inventaris. Seluruh perubahan dicatat dalam `inventory_audit_logs`.
  - **Body:**
    ```json
    {
      "transaction_detail_id": "detail-uuid",
      "new_pic_name": "Ahmad Fauzi",
      "new_pic_phone": "081234567890",
      "new_location": "POP Sukabumi Kota Rak 02",
      "reason": "Rotasi tugas teknisi shift siang"
    }
    ```

---

### 2.7 Pengembalian Barang (Returns)
- **POST `/api/inventory/returns`**
  - **Deskripsi:** Memproses pengembalian barang reusable ke gudang (sebagian atau penuh).
  - **Aturan:**
    - Kuantitas kembali tidak boleh melebihi sisa barang keluar.
    - Barang berstatus `CONSUMABLE` otomatis ditolak (HTTP 400).
    - Kondisi `RUSAK_RINGAN`, `RUSAK_BERAT`, atau `HILANG` tidak menambah `available_stock`.
  - **Body:**
    ```json
    {
      "transaction_id": "tx-out-uuid",
      "return_date": "2026-11-13T16:00:00Z",
      "received_by": "Budi Santoso",
      "notes": "Pengembalian selesai maintenance",
      "items": [
        {
          "transaction_detail_id": "detail-uuid",
          "quantity": 1,
          "condition": "BAIK",
          "notes": "Berfungsi normal, kabel power lengkap"
        }
      ]
    }
    ```

---

### 2.8 Barang Habis Pakai & Riwayat
- **GET `/api/inventory/consumables`**
  - **Deskripsi:** Ringkasan stok dan log konsumsi barang habis pakai.
- **GET `/api/inventory/history`**
  - **Query Params:** `tab` (`movements` / `audits`), `item_id`, `movement_type`, `search`, `page`, `limit`.
- **DELETE `/api/inventory/history`**
  - **Status:** **HTTP 403 Forbidden**.

---

### 2.9 Integrasi Permit Barang
- **POST `/api/inventory/permit-sync`**
  - **Body:**
    ```json
    {
      "action": "check_stock",
      "devices": [
        { "name": "Mikrotik CCR2004", "quantity": "1" },
        { "name": "Kabel Cat6", "quantity": "100" }
      ]
    }
    ```
  - **Respons:**
    ```json
    {
      "success": true,
      "data": [
        {
          "device_name": "Mikrotik CCR2004",
          "matched_item_name": "MikroTik CCR2004-16G-2S+",
          "matched_item_code": "ITM-ROU-0001",
          "available_stock": 8,
          "is_sufficient": true
        }
      ]
    }
    ```

