# INVENTORY MANAGEMENT SYSTEM - TESTING & VERIFICATION REPORT
**Application:** ACTIS (Activation, Configuration, & Termination ISP System)  
**Test Suite File:** `test-inventory.js`  
**NPM Script:** `npm run test:inventory`  
**Execution Environment:** Windows Server / Node.js 18+ / PostgreSQL  
**Overall Status:** **14 / 14 SCENARIOS PASSED (100% SUCCESS)**  

---

## 1. Testing Strategy Overview

Pengujian modul Inventory Management System dilakukan menggunakan skrip otomasi end-to-end (`test-inventory.js`) yang menguji seluruh lapisan logika bisnis:
1. Integritas rumus matematis saldo stok pada database PostgreSQL.
2. Keamanan konkurensi (row-level locking & transaksi atomik).
3. Validasi batasan bisnis (reusable vs consumable, partial vs full return, over-return rejection, over-dispatch rejection).
4. Penegakan hak akses peran pengguna (RBAC).
5. Sifat append-only histori pergerakan dan audit trail (penolakan penghapusan).
6. Alur integrasi dengan modul Permit Barang.

---

## 2. Mandatory 14 Test Scenarios & Results

| No | Nama Skenario Uji | Kriteria Keberhasilan | Status |
| :---: | :--- | :--- | :---: |
| **01** | **Stock In & Rumus Stok Bertambah** | Transaksi Stock In menambahkan `available_stock` dan `total_in` secara eksak dan mencatat `InventoryMovement`. | **PASSED** |
| **02** | **Stock Out Reusable** | `available_stock` berkurang sesuai jumlah keluar, `total_in_use` bertambah, status detail menjadi `SEDANG_DIGUNAKAN`. | **PASSED** |
| **03** | **Pengembalian Sebagian (Partial Return)** | Mengembalikan 2 dari 5 unit: `available_stock` bertambah 2, `total_in_use` berkurang 2, sisa 3 unit tetap berstatus `SEBAGIAN_KEMBALI`. | **PASSED** |
| **04** | **Pengembalian Penuh (Full Return)** | Mengembalikan sisa 3 unit: `available_stock` bertambah 3, sisa di luar gudang menjadi 0, status detail berubah menjadi `SUDAH_KEMBALI`. | **PASSED** |
| **05** | **Penolakan Over-Stock Out** | Meminta keluar 100 unit saat stok tersedia hanya 10: Sistem menolak dan melempar exception *"Stok tidak mencukupi"*, stok tidak berubah. | **PASSED** |
| **06** | **Stock Out Consumable** | Pengeluaran barang consumable mengurangi `available_stock` secara permanen dan mencatat kuantitas ke `total_consumed`. | **PASSED** |
| **07** | **Penolakan Return Consumable** | Mencoba memproses return untuk barang consumable: Sistem melempar exception *"Barang habis pakai (Consumable) tidak dapat dikembalikan"*. | **PASSED** |
| **08** | **Penolakan Return Melebihi Keluar** | Mencoba mengembalikan 10 unit saat sisa keluar hanya 5 unit: Sistem menolak dengan exception *"Jumlah pengembalian melebihi sisa barang di luar gudang"*. | **PASSED** |
| **09** | **Pengembalian Rusak & Hilang** | Mengembalikan 1 unit rusak dan 1 unit hilang: `in_use_stock` berkurang 2, `total_damaged` bertambah 1, `total_lost` bertambah 1, **`available_stock` TIDAK BERTAMBAH**. | **PASSED** |
| **10** | **Proteksi Race Condition & Stok Negatif** | 5 permintaan pengeluaran simultan (@3 unit = total 15 unit) pada barang dengan stok 10: Sistem atomik hanya meloloskan 3 transaksi (9 unit), menolak 2 transaksi sisa. Saldo akhir tetap $\ge 0$ tanpa minus. | **PASSED** |
| **11** | **Otorisasi Hak Akses Pengguna (RBAC)** | Role `sales` atau `field_engineer` yang mencoba menambah master barang atau mengubah pengaturan ditolak dengan izin `canManageItems = false`. | **PASSED** |
| **12** | **Edit PIC / Lokasi Tanpa Ubah Stok** | Memperbarui nama PIC atau lokasi pemakaian pada barang sedang digunakan: data tersimpan ke audit log tanpa mengubah angka saldo stok sedikitpun. | **PASSED** |
| **13** | **Penolakan Penghapusan Histori Transaksi** | Permintaan DELETE pada transaksi gudang, pengembalian, atau mutasi ditolak (HTTP 403 Forbidden). Database menerapkan append-only logging. | **PASSED** |
| **14** | **Integrasi Alur Permit Barang** | Pembuatan dokumen Surat Permit Keluar diuji: stok barang di gudang **TIDAK TERPOTONG** sampai transaksi Barang Keluar fisik diproses. | **PASSED** |

---

## 3. How to Execute Tests

Untuk menjalankan pengujian otomatis modul inventory di lingkungan pengembangan atau staging:

```bash
# Menjalankan pengujian 14 skenario inventory
npm run test:inventory
```

Untuk menjalankan unit test menyeluruh ACTIS (termasuk 130 test eksisting):
```bash
npm test
```

---

## 4. Test Execution Evidence

Berikut cuplikan log eksekusi aktual:

```text
======================================================================
  ACTIS - INVENTORY MANAGEMENT SYSTEM VERIFICATION TEST SUITE
======================================================================
[INFO] Menghubungkan ke database PostgreSQL...
[INFO] Menginisialisasi kategori & data uji terisolasi...

[TEST 01] Stock In & Rumus Stok Bertambah...
  [OK] Stok awal: 0, Total In: 10, Stok Tersedia: 10
  [OK] InventoryMovement tercatat: IN (+10)

[TEST 02] Stock Out Reusable...
  [OK] Stok keluar: 5, Sisa tersedia: 5, Sedang Digunakan: 5
  [OK] Status detail: SEDANG_DIGUNAKAN, Sisa di luar: 5

[TEST 03] Pengembalian Sebagian (Partial Return)...
  [OK] Kembali: 2 dari 5. Tersedia sekarang: 7, Sedang Digunakan: 3
  [OK] Status detail: SEBAGIAN_KEMBALI, Sisa di luar: 3

[TEST 04] Pengembalian Penuh (Full Return)...
  [OK] Kembali sisa 3 unit. Tersedia sekarang: 10, Sedang Digunakan: 0
  [OK] Status detail: SUDAH_KEMBALI, Sisa di luar: 0

[TEST 05] Penolakan Stock Out jika Stok Tidak Mencukupi...
  [OK] Sistem berhasil menolak pengeluaran 100 unit saat stok hanya 10.

[TEST 06] Stock Out Consumable (Pengurangan Permanen)...
  [OK] Consumable keluar 50 meter: Tersedia: 50, Total Terpakai: 50
  [OK] Status detail: TERPAKAI

[TEST 07] Penolakan Pengembalian Barang Consumable...
  [OK] Sistem berhasil memblokir pengembalian barang tipe CONSUMABLE.

[TEST 08] Penolakan Pengembalian Melebihi Jumlah Keluar...
  [OK] Sistem berhasil menolak return kuantitas melebihi sisa barang keluar.

[TEST 09] Pengembalian Barang Kondisi Rusak & Hilang...
  [OK] 1 unit rusak & 1 unit hilang dikeluarkan dari In-Use.
  [OK] Stok tersedia TIDAK BERTAMBAH (tetap aman di 8 unit).

[TEST 10] Race Condition Protection (5 Transaksi Simultan)...
  [OK] Sukses: 3 transaksi, Gagal: 2 transaksi karena stok habis.
  [OK] Stok akhir: 1 unit (TIDAK PERNAH NEGATIF).

[TEST 11] Otorisasi Peran Pengguna (RBAC)...
  [OK] Admin memiliki hak akses penuh.
  [OK] Sales ditolak untuk membuat transaksi keluar dan master barang.

[TEST 12] Update PIC & Lokasi Tanpa Mengubah Stok...
  [OK] PIC berhasil diubah ke 'Ahmad Fauzi'.
  [OK] Stok fisik dan saldo in-use tidak mengalami perubahan sedikitpun.

[TEST 13] Penolakan Penghapusan Histori Transaksi (Append-Only)...
  [OK] Penghapusan riwayat pergerakan stok diblokir (403 Forbidden).

[TEST 14] Integrasi Siklus Permit Barang...
  [OK] Dokumen permit dibuat: Stok tersedia tetap 10 unit.
  [OK] Penyerahan fisik diproses: Stok terpotong menjadi 9 unit.

======================================================================
  HASIL AKHIR: 14 / 14 SKENARIO PENGUJIAN LOLOS DENGAN SUKSES!
======================================================================
```

