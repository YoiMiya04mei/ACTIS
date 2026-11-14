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
  Barcode,
  Copy,
  Check,
  ExternalLink,
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

  // Item Detail & Available SNs Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [snSearch, setSnSearch] = useState("");
  const [snStatusFilter, setSnStatusFilter] = useState<"AVAILABLE" | "IN_USE" | "ALL">("AVAILABLE");
  const [copiedSn, setCopiedSn] = useState<string | null>(null);

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

  const handleOpenDetail = async (item: any) => {
    setDetailItem(item);
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    setSnSearch("");
    setSnStatusFilter("AVAILABLE");
    setCopiedSn(null);

    try {
      const res = await fetch(`/api/inventory/items/${item.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetailItem(json.data);
      }
    } catch (err: any) {
      console.error("Gagal memuat detail barang:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopySn = (sn: string) => {
    if (!sn) return;
    navigator.clipboard.writeText(sn);
    setCopiedSn(sn);
    setTimeout(() => setCopiedSn(null), 2000);
  };

  const handleCopyAllAvailableSn = () => {
    if (!detailItem?.units) return;
    const availableSns = detailItem.units
      .filter((u: any) => u.status === "AVAILABLE")
      .map((u: any) => u.serial_number)
      .join("\n");
    if (availableSns) {
      navigator.clipboard.writeText(availableSns);
      setCopiedSn("__ALL__");
      setTimeout(() => setCopiedSn(null), 2000);
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
                  <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Memuat saldo stok...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
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
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="text-left group cursor-pointer focus:outline-hidden block w-full"
                          title="Klik untuk melihat deskripsi detail barang & SN yang tersedia"
                        >
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline inline-flex items-center gap-1.5">
                            {item.code}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.category?.name} &bull; Lokasi: {item.storage_location || "-"}
                          </p>
                        </button>
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

      {/* MODAL: DETAIL BARANG & SN TERSEDIA (UNTUK PERANGKAT AKTIF) */}
      {isDetailModalOpen && detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-800/40">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {detailItem.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      detailItem.category?.name?.toLowerCase().includes("aktif")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Kategori: {detailItem.category?.name || "Perangkat"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {detailItem.type === "REUSABLE" ? "Reusable" : "Consumable"}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {detailItem.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs">
              {/* Quick Stock Balances */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50">
                  <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Stok Siap Pakai</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {Number(detailItem.stock?.available_stock || 0).toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-semibold">{detailItem.unit}</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50">
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Sedang Digunakan</span>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {detailItem.type === "REUSABLE"
                      ? Number(detailItem.stock?.total_in_use || 0).toLocaleString("id-ID")
                      : "-"}{" "}
                    <span className="text-xs font-semibold">{detailItem.unit}</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/50">
                  <span className="text-[11px] font-medium text-rose-800 dark:text-rose-300">Total Keluar</span>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {Number(detailItem.stock?.total_out || 0).toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-semibold">{detailItem.unit}</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500">Stok Minimum</span>
                  <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                    {Number(detailItem.min_stock || 0).toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-semibold">{detailItem.unit}</span>
                  </p>
                </div>
              </div>

              {/* Deskripsi & Spesifikasi Barang */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Info className="w-4 h-4 text-blue-600" />
                  Spesifikasi &amp; Deskripsi Barang
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Brand / Merk:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detailItem.brand || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Model / Tipe:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detailItem.model || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Lokasi Rak:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detailItem.storage_location || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Satuan Unit:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detailItem.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Status Barang:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {detailItem.is_active ? "Aktif" : "Non-aktif"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Rusak / Karantina:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {Number(detailItem.stock?.total_damaged || 0)} {detailItem.unit}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Deskripsi Barang:</span>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {detailItem.description || "Tidak ada catatan deskripsi spesifikasi tambahan untuk barang ini."}
                  </div>
                </div>
              </div>

              {/* SECTION: SERIAL NUMBER (SN) UNTUK KATEGORI PERANGKAT AKTIF */}
              {(() => {
                const isPerangkatAktif =
                  detailItem.category?.name?.toLowerCase().includes("aktif") ||
                  detailItem.type === "REUSABLE" ||
                  (detailItem.units && detailItem.units.length > 0);

                if (!isPerangkatAktif) {
                  return (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                      <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          Kategori Perangkat Pasif / Non-SN
                        </p>
                        <p className="text-slate-600 dark:text-slate-400">
                          Barang ini terdaftar pada kategori <strong>{detailItem.category?.name || "Pasif"}</strong> dan tidak memiliki pelacakan serial number individual. Jumlah fisik dikelola langsung berdasarkan kuantitas ({detailItem.unit}).
                        </p>
                      </div>
                    </div>
                  );
                }

                const units: any[] = detailItem.units || [];
                const availableUnits = units.filter((u) => u.status === "AVAILABLE");
                const inUseUnits = units.filter((u) => u.status === "IN_USE");

                const filteredUnits = units.filter((u) => {
                  if (snStatusFilter === "AVAILABLE" && u.status !== "AVAILABLE") return false;
                  if (snStatusFilter === "IN_USE" && u.status !== "IN_USE") return false;
                  if (snSearch.trim()) {
                    const q = snSearch.toLowerCase();
                    const sn = (u.serial_number || "").toLowerCase();
                    const mac = (u.mac_address || "").toLowerCase();
                    const pic = (u.current_pic || "").toLowerCase();
                    const loc = (u.current_location || "").toLowerCase();
                    return sn.includes(q) || mac.includes(q) || pic.includes(q) || loc.includes(q);
                  }
                  return true;
                });

                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Barcode className="w-4 h-4 text-blue-600" />
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                            Serial Number (SN) Perangkat Aktif
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Daftar unit serial number siap pakai dan terlacak untuk perangkat ini.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {availableUnits.length > 0 && (
                          <button
                            type="button"
                            onClick={handleCopyAllAvailableSn}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 shadow-xs transition cursor-pointer"
                            title="Salin semua SN yang berstatus Siap Pakai"
                          >
                            {copiedSn === "__ALL__" ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Tersalin!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                Salin Semua SN Tersedia ({availableUnits.length})
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter and Search Bar for SN */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSnStatusFilter("AVAILABLE")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            snStatusFilter === "AVAILABLE"
                              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          SN Tersedia ({availableUnits.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSnStatusFilter("IN_USE")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            snStatusFilter === "IN_USE"
                              ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          Sedang Digunakan ({inUseUnits.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSnStatusFilter("ALL")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            snStatusFilter === "ALL"
                              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          Semua ({units.length})
                        </button>
                      </div>

                      <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari SN, MAC, PIC..."
                          value={snSearch}
                          onChange={(e) => setSnSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* SN Table / List */}
                    {loadingDetail ? (
                      <div className="py-8 text-center text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        Memuat daftar unit serial number...
                      </div>
                    ) : filteredUnits.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                        <p className="font-semibold text-slate-600 dark:text-slate-300">
                          {units.length === 0
                            ? "Belum ada serial number yang didaftarkan untuk barang ini."
                            : snStatusFilter === "AVAILABLE"
                            ? "Tidak ada serial number yang berstatus Siap Pakai (Tersedia) saat ini."
                            : "Tidak ditemukan serial number yang sesuai filter pencarian."}
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">No</th>
                              <th className="py-2.5 px-3">Serial Number (SN)</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Kondisi</th>
                              <th className="py-2.5 px-3">Lokasi / PIC</th>
                              <th className="py-2.5 px-3 text-center w-16">Salin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredUnits.map((u, idx) => (
                              <tr
                                key={u.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                              >
                                <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {u.serial_number}
                                  </div>
                                  {u.mac_address && (
                                    <div className="font-mono text-[10px] text-slate-400">
                                      MAC: {u.mac_address}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      u.status === "AVAILABLE"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : u.status === "IN_USE"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                    }`}
                                  >
                                    {u.status === "AVAILABLE"
                                      ? "Tersedia"
                                      : u.status === "IN_USE"
                                      ? "Digunakan"
                                      : u.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                    {u.condition || "BAIK"}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-500">
                                  {u.current_pic
                                    ? `PIC: ${u.current_pic}`
                                    : u.current_location || detailItem.storage_location || "Gudang"}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleCopySn(u.serial_number)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                    title="Salin Serial Number"
                                  >
                                    {copiedSn === u.serial_number ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <span className="text-[11px] text-slate-400">
                Data diperbarui secara otomatis dari sistem saldo fisik ACTIS.
              </span>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

