"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
  ShieldCheck,
  Bell,
  Barcode,
  Layers,
  Lock,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

export default function InventorySettingsPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isWarehouseAdmin = currentUser?.role === "warehouse_admin";
  const canEdit = isAdmin || isWarehouseAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    DEFAULT_WAREHOUSE_NAME: "Gudang Utama JDP",
    DEFAULT_STORAGE_LOCATION: "Gudang Utama - Rak A1",
    DEFAULT_MIN_STOCK: "5",
    ENABLE_AUTO_ITEM_CODE: "true",
    ALLOW_NEGATIVE_STOCK: "false",
    NOTIFY_ON_LOW_STOCK: "true",
    ITEM_CODE_PREFIX: "ITM",
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/settings");
      const json = await res.json();
      if (json.success && json.data) {
        setFormData((prev) => ({
          ...prev,
          ...json.data,
        }));
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Gagal memuat pengaturan." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setNotification({ type: "error", message: "Hanya Admin yang memiliki hak akses untuk menyimpan pengaturan." });
      return;
    }

    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch("/api/inventory/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan pengaturan.");
      }
      setNotification({ type: "success", message: "Pengaturan inventory berhasil disimpan ke database." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/inventory/dashboard" className="hover:underline">
              Inventory
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-gray-200 font-medium">Pengaturan Inventory</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            Pengaturan Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola parameter sistem gudang, threshold stok minimum, proteksi race-condition, dan format penomoran.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSettings()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {notification.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Access info banner if non-admin */}
      {!canEdit && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            Mode hanya baca: Anda masuk sebagai <strong>{currentUser?.role || "Staff"}</strong>. Hanya peran Admin atau Warehouse Admin yang dapat mengubah pengaturan sistem.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Warehouse Configuration */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Warehouse className="w-5 h-5 text-indigo-600" />
                Identitas Gudang Utama
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nama Gudang Default
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || loading}
                    value={formData.DEFAULT_WAREHOUSE_NAME}
                    onChange={(e) => setFormData({ ...formData, DEFAULT_WAREHOUSE_NAME: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    placeholder="Contoh: Gudang Utama JDP"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nama lokasi gudang sentral yang akan tertera secara otomatis pada dokumen surat jalan & Bukti Pengeluaran Barang.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lokasi / Rak Penyimpanan Default
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || loading}
                    value={formData.DEFAULT_STORAGE_LOCATION}
                    onChange={(e) => setFormData({ ...formData, DEFAULT_STORAGE_LOCATION: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    placeholder="Contoh: Gudang Utama - Rak A1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lokasi penempatan barang baru jika kolom lokasi pada Master Barang dikosongkan.
                  </p>
                </div>
              </div>
            </div>

            {/* Threshold & Notification Settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-indigo-600" />
                Ambang Batas & Monitoring Stok
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stok Minimum Default
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={!canEdit || loading}
                    value={formData.DEFAULT_MIN_STOCK}
                    onChange={(e) => setFormData({ ...formData, DEFAULT_MIN_STOCK: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nilai ambang batas bawaan untuk barang baru jika tidak diisi manual saat pendaftaran Master Barang.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Peringatan Stok Rendah</div>
                    <div className="text-xs text-gray-500">Tampilkan badge peringatan & alert pada Dashboard ketika stok mencapai minimum.</div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit || loading}
                    checked={formData.NOTIFY_ON_LOW_STOCK === "true"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        NOTIFY_ON_LOW_STOCK: e.target.checked ? "true" : "false",
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Item Code & Numbering Settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Barcode className="w-5 h-5 text-indigo-600" />
                Penomoran & Kodifikasi Otomatis
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Otomatisasi Kode Barang</div>
                    <div className="text-xs text-gray-500">
                      Generate kode unik berformat <code>ITM-KATEGORI-XXXX</code> otomatis saat menambah barang baru.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!canEdit || loading}
                    checked={formData.ENABLE_AUTO_ITEM_CODE === "true"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ENABLE_AUTO_ITEM_CODE: e.target.checked ? "true" : "false",
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Format Prefiks Kode Barang
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || loading}
                    value={formData.ITEM_CODE_PREFIX}
                    onChange={(e) => setFormData({ ...formData, ITEM_CODE_PREFIX: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 uppercase disabled:opacity-60"
                    placeholder="ITM"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Security & Integrity Rules */}
          <div className="space-y-6">
            {/* System Security & Integrity Rules */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Integritas Database & Audit
              </h2>

              <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Strict Non-Negative Stock
                  </div>
                  <p>
                    Stok negatif secara absolut dinonaktifkan di tingkat transaksi database dengan row-level locking
                    (<code>SELECT ... FOR UPDATE</code>). Transaksi otomatis rollback jika stok tidak mencukupi.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Append-Only Audit Trail
                  </div>
                  <p>
                    Tabel <code>inventory_movements</code> dan <code>inventory_audit_logs</code> tidak memiliki endpoint
                    penghapusan. Setiap request DELETE diblokir dengan status HTTP 403.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Soft-Delete Protection
                  </div>
                  <p>
                    Barang yang telah memiliki riwayat pergerakan stok dilindungi dari penghapusan fisik. Sistem
                    menerapkan soft-delete melalui atribut <code>is_active: false</code>.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Standar Nomor Transaksi
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-500 dark:text-gray-400">
                    <li>Masuk: <code>IN-YYYYMMDD-XXXX</code></li>
                    <li>Keluar: <code>OUT-YYYYMMDD-XXXX</code></li>
                    <li>Kembali: <code>RET-YYYYMMDD-XXXX</code></li>
                    <li>Opname: <code>OPN-YYYYMMDD-XXXX</code></li>
                    <li>Koreksi: <code>ADJ-YYYYMMDD-XXXX</code></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Navigasi Cepat
              </h3>
              <div className="space-y-2 text-xs">
                <Link
                  href="/inventory/categories"
                  className="block p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                >
                  → Kelola Kategori Barang
                </Link>
                <Link
                  href="/inventory/stock"
                  className="block p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                >
                  → Stock Opname & Penyesuaian
                </Link>
                <Link
                  href="/inventory/history"
                  className="block p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                >
                  → Lihat Audit Log Lengkap
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={fetchSettings}
              disabled={loading || saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Reset Perubahan
            </button>
            <button
              type="submit"
              disabled={loading || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

