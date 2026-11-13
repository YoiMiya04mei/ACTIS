"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  Filter,
  SlidersHorizontal,
  ClipboardCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  RotateCcw,
  Cable,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

export default function StokInventoryPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [targetStock, setTargetStock] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameOfficer, setOpnameOfficer] = useState("");
  const [opnameNotes, setOpnameNotes] = useState("");
  const [opnameEntries, setOpnameEntries] = useState<Record<string, string>>({});

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchStock = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category_id: selectedCategory,
        type: selectedType,
        low_stock: lowStockOnly ? "true" : "false",
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/inventory/stock?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Gagal memuat saldo stok." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedType, lowStockOnly, page]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleOpenAdjust = (item: any) => {
    setAdjustItem(item);
    setTargetStock(String(item.stock?.available_stock || 0));
    setAdjustReason("");
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    try {
      const res = await fetch("/api/inventory/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: adjustItem.id,
          new_available_stock: targetStock,
          reason: adjustReason,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      setIsAdjustModalOpen(false);
      fetchStock();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    }
  };

  const handleOpenOpname = () => {
    setOpnameOfficer(currentUser?.nama || "Admin Gudang");
    setOpnameNotes("");
    const initial: Record<string, string> = {};
    items.forEach((it) => {
      initial[it.id] = String(it.stock?.available_stock || 0);
    });
    setOpnameEntries(initial);
    setIsOpnameModalOpen(true);
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedItems = Object.entries(opnameEntries).map(([id, val]) => ({
        item_id: id,
        physical_count: val,
      }));

      const res = await fetch("/api/inventory/stock/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_officer: opnameOfficer,
          notes: opnameNotes,
          items: formattedItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      setIsOpnameModalOpen(false);
      fetchStock();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              Monitoring Saldo Gudang
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Stok Masuk, Keluar, Sedang Digunakan, Kembali & Terpakai
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Layers className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Stok Inventory & Mutasi
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pencatatan saldo fisik real-time dengan penghitungan otomatis untuk perangkat reusable dan material consumable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchStock(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleOpenOpname}
                className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold shadow-xs transition"
              >
                <ClipboardCheck className="w-4 h-4 mr-1.5" />
                Stock Opname Fisik
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Formulas Callout */}
      <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
        <div className="flex items-center font-bold">
          <Info className="w-4 h-4 mr-2 text-blue-600 shrink-0" />
          Rumus Perhitungan Stok Otomatis ACTIS:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pl-6">
          <p>
            <span className="font-bold">Barang Reusable:</span> Stok Tersedia = Total Masuk &minus; Total Sedang Digunakan (di luar gudang) &minus; Rusak/Hilang.
          </p>
          <p>
            <span className="font-bold">Barang Consumable:</span> Stok Tersedia = Total Masuk &minus; Total Terpakai (Dikeluarkan Permanen).
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari kode barang, nama, lokasi rak..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="">Semua Jenis Barang</option>
            <option value="REUSABLE">Reusable (Dapat Kembali)</option>
            <option value="CONSUMABLE">Consumable (Habis Pakai)</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className={lowStockOnly ? "font-bold text-rose-600" : ""}>
              Hanya Stok Minimum
            </span>
          </label>
        </div>
      </div>

      {/* Main Stock Balance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Kode & Nama Barang</th>
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4 text-right">Stok Awal</th>
                <th className="py-3 px-4 text-right text-emerald-600">Total Masuk</th>
                <th className="py-3 px-4 text-right text-rose-600">Total Keluar</th>
                <th className="py-3 px-4 text-right text-amber-600">Digunakan</th>
                <th className="py-3 px-4 text-right text-blue-600">Kembali</th>
                <th className="py-3 px-4 text-right text-purple-600">Terpakai</th>
                <th className="py-3 px-4 text-right">Stok Siap Pakai</th>
                {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Memuat saldo stok...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ada data stok yang sesuai filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const s = item.stock || {};
                  const avail = Number(s.available_stock || 0);
                  const isLow = Number(item.min_stock) > 0 && avail <= Number(item.min_stock);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.code}
                        </span>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {item.category?.name} &bull; Lokasi: {item.storage_location || "-"}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {item.type === "REUSABLE" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Reusable
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Consumable
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {Number(s.initial_stock || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        +{Number(s.total_in || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        -{Number(s.total_out || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">
                        {item.type === "REUSABLE" ? Number(s.total_in_use || 0) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        {item.type === "REUSABLE" ? Number(s.total_returned || 0) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-purple-600">
                        {item.type === "CONSUMABLE" ? Number(s.total_consumed || 0) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded-xl ${
                            isLow
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {avail.toLocaleString("id-ID")}{" "}
                          <span className="text-[10px] font-normal">{item.unit}</span>
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenAdjust(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                            title="Penyesuaian Stok (Adjustment)"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Menampilkan {items.length} dari {totalCount} barang
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-bold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: STOCK ADJUSTMENT */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <SlidersHorizontal className="w-5 h-5 mr-2 text-indigo-600" />
                Penyesuaian Stok (Adjustment)
              </h2>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-500">Barang:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{adjustItem.name}</p>
                <p className="font-mono text-slate-500">{adjustItem.code}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Stok Saat Ini:</span>
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {adjustItem.stock?.available_stock || 0} {adjustItem.unit}
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Stok Siap Pakai Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={targetStock}
                  onChange={(e) => setTargetStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Alasan Penyesuaian (Audit Trail) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Koreksi selisih fisik saat audit triwulan / barang bonus vendor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK OPNAME */}
      {isOpnameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <ClipboardCheck className="w-5 h-5 mr-2 text-indigo-600" />
                Formulir Stock Opname Fisik Gudang
              </h2>
              <button
                onClick={() => setIsOpnameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpname} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Petugas Pemeriksa Gudang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={opnameOfficer}
                    onChange={(e) => setOpnameOfficer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Catatan / Berita Acara Opname
                  </label>
                  <input
                    type="text"
                    value={opnameNotes}
                    onChange={(e) => setOpnameNotes(e.target.value)}
                    placeholder="Contoh: Stock Opname Bulanan November 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">Kode & Nama Barang</th>
                      <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                      <th className="py-2.5 px-3 text-right w-36">Hitungan Fisik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it) => {
                      const sysStock = Number(it.stock?.available_stock || 0);
                      const currentEntry = opnameEntries[it.id] ?? String(sysStock);
                      const diff = Number(currentEntry) - sysStock;

                      return (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-blue-600">{it.code}</span>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{it.name}</p>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                            {sysStock} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <input
                                type="number"
                                min="0"
                                required
                                value={currentEntry}
                                onChange={(e) =>
                                  setOpnameEntries({ ...opnameEntries, [it.id]: e.target.value })
                                }
                                className="w-20 text-right px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                              />
                              <span className="text-[10px] text-slate-400 w-10">{it.unit}</span>
                            </div>
                            {diff !== 0 && (
                              <span
                                className={`text-[10px] font-bold ${
                                  diff > 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpnameModalOpen(false)}
                  className="px-4 py-2 rounded-xl border font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
                >
                  Finalisasi & Terapkan Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

