"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Cable,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
  MapPin,
  User,
  Boxes,
} from "lucide-react";

export default function BarangHabisPakaiPage() {
  const [items, setItems] = useState<any[]>([]);
  const [recentConsumption, setRecentConsumption] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchConsumables = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        low_stock: lowStockOnly ? "true" : "false",
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/inventory/consumables?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        setRecentConsumption(json.recent_consumption || []);
        setTotalPages(json.pagination.totalPages || 1);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [search, lowStockOnly, page]);

  useEffect(() => {
    fetchConsumables();
  }, [fetchConsumables]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
              Material Habis Pakai
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Pengelolaan Kabel, Konektor, Patch Cord & Material Instalasi
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Cable className="w-7 h-7 mr-3 text-purple-600 dark:text-purple-400" />
            Barang Habis Pakai (Consumable)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Material sekali pakai yang dikeluarkan dari gudang akan mengurangi stok secara permanen dan tidak dapat diproses sebagai pengembalian reusable.
          </p>
        </div>

        <button
          onClick={() => fetchConsumables(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-purple-600 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari kabel, konektor, isolasi, baut..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
          />
          <span className={lowStockOnly ? "font-bold text-rose-600" : ""}>
            Hanya Material Stok Minimum
          </span>
        </label>
      </div>

      {/* Main Consumables Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
              <tr>
                <th className="py-3 px-4">Kode & Nama Material</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Stok Masuk</th>
                <th className="py-3 px-4 text-right text-purple-600">Terpakai Permanen</th>
                <th className="py-3 px-4 text-right">Stok Siap Pakai</th>
                <th className="py-3 px-4 text-right">Batas Min</th>
                <th className="py-3 px-4">Lokasi Rak</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    Memuat data barang habis pakai...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada material habis pakai yang ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const s = item.stock || {};
                  const avail = Number(s.available_stock || 0);
                  const isLow = Number(item.min_stock) > 0 && avail <= Number(item.min_stock);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-purple-600">{item.code}</span>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.brand ? `Merek: ${item.brand}` : ""} {item.model ? `(${item.model})` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                        {item.category?.name}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-600">
                        {Number(s.total_in || 0)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-purple-600">
                        {Number(s.total_consumed || 0)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded-xl ${
                            isLow
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {avail.toLocaleString("id-ID")}{" "}
                          <span className="text-[10px] font-normal">{item.unit}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {item.min_stock} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.storage_location || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/inventory/transactions/out?item_id=${item.id}`}
                          className="text-xs font-bold text-rose-600 hover:underline"
                        >
                          Gunakan
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Consumption Events */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <ArrowUpRight className="w-4 h-4 mr-2 text-purple-600" />
          Riwayat Penggunaan Material Habis Pakai Terbaru
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-[10px] text-slate-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Nama Material</th>
                <th className="py-2.5 px-3 text-right">Jumlah Terpakai</th>
                <th className="py-2.5 px-3">PIC Pengambil</th>
                <th className="py-2.5 px-3">Lokasi / Tujuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentConsumption.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Belum ada riwayat konsumsi material.
                  </td>
                </tr>
              ) : (
                recentConsumption.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-purple-600">
                      {c.transaction?.transaction_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(c.transaction?.transaction_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {c.item?.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-purple-600">
                      {Number(c.quantity)} {c.unit}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {c.transaction?.pic_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {c.transaction?.location || c.transaction?.purpose || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

