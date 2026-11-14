"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  Boxes,
  PlusCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Cable,
  CheckCircle2,
} from "lucide-react";

interface DashboardData {
  summary: {
    total_item_types: number;
    total_available_stock: number;
    total_reusable_items: number;
    total_consumable_items: number;
    total_in_use: number;
    total_pending_return: number;
    total_consumed: number;
    low_stock_count: number;
  };
  low_stock_items: Array<{
    id: string;
    name: string;
    code: string;
    unit: string;
    available: number;
    min_stock: number;
    category: string;
  }>;
  recent_in: any[];
  recent_out: any[];
  recent_returns: any[];
  monthly_chart: Array<{ month: string; in_count: number; out_count: number }>;
  category_distribution: Array<{ name: string; item_count: number; total_stock: number }>;
}

export default function InventoryDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/inventory/dashboard");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat statistik inventory.");
      }
      setData(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat data Dashboard Inventory...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    total_item_types: 0,
    total_available_stock: 0,
    total_reusable_items: 0,
    total_consumable_items: 0,
    total_in_use: 0,
    total_pending_return: 0,
    total_consumed: 0,
    low_stock_count: 0,
  };

  // Find max count for monthly chart scaling
  const maxMonthlyVal = Math.max(
    ...(data?.monthly_chart?.flatMap((m) => [m.in_count, m.out_count]) || [1]),
    1
  );

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              Inventory & Material Desk
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Manajemen Logistik, Perangkat Jaringan & Material ISP
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Package className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Dashboard Inventory Management
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Monitoring stok riil barang reusable & consumable, penugasan perangkat ke PIC, pengembalian, dan riwayat mutasi gudang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <Link
            href="/inventory/transactions/in"
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold shadow-xs transition"
          >
            <ArrowDownLeft className="w-4 h-4 mr-1.5" />
            + Barang Masuk
          </Link>

          <Link
            href="/inventory/transactions/out"
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold shadow-xs transition"
          >
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            + Barang Keluar
          </Link>

          <Link
            href="/inventory/items"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Master Barang
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center">
          <AlertTriangle className="w-5 h-5 mr-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 8 Primary Inventory Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 2xl:gap-3.5">
        {/* Total Jenis Barang */}
        <Link
          href="/inventory/items"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Jenis Barang</span>
            <Boxes className="w-4 h-4 text-blue-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
            {summary.total_item_types}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Master SKU aktif</p>
        </Link>

        {/* Total Kuantitas Stok Tersedia */}
        <Link
          href="/inventory/stock"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Stok Siap Pakai</span>
            <Layers className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
            {summary.total_available_stock.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Tersedia di gudang</p>
        </Link>

        {/* Total Barang Reusable */}
        <Link
          href="/inventory/items?type=REUSABLE"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Barang Reusable</span>
            <RotateCcw className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5">
            {summary.total_reusable_items}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Bisa dikembalikan</p>
        </Link>

        {/* Total Barang Consumable */}
        <Link
          href="/inventory/consumables"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Consumable</span>
            <Cable className="w-4 h-4 text-purple-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
            {summary.total_consumable_items}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Habis pakai</p>
        </Link>

        {/* Total Sedang Digunakan */}
        <Link
          href="/inventory/in-use"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Sedang Digunakan</span>
            <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
            {summary.total_in_use.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Di lokasi / PIC</p>
        </Link>

        {/* Pending Return (Tiket belum kembali) */}
        <Link
          href="/inventory/in-use"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Pending Kembali</span>
            <ArrowUpRight className="w-4 h-4 text-sky-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1.5">
            {summary.total_pending_return}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Item belum kembali</p>
        </Link>

        {/* Total Consumable Terpakai */}
        <Link
          href="/inventory/consumables"
          className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Total Terpakai</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition" />
          </div>
          <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1.5">
            {summary.total_consumed.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Pemakaian material</p>
        </Link>

        {/* Stok Minimum (Alert) */}
        <Link
          href="/inventory/stock?low_stock=true"
          className={`p-3.5 rounded-2xl border shadow-sm transition group ${
            summary.low_stock_count > 0
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 hover:border-rose-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className={summary.low_stock_count > 0 ? "text-rose-700 dark:text-rose-300 font-bold" : ""}>
              Stok Minimum
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                summary.low_stock_count > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-400"
              }`}
            />
          </div>
          <p
            className={`text-xl font-black mt-1.5 ${
              summary.low_stock_count > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {summary.low_stock_count}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Perlu restock segera</p>
        </Link>
      </div>

      {/* Charts & Category Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Activity Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Aktivitas Barang Masuk vs Keluar per Bulan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tren transaksi fisik logistik selama 6 bulan terakhir
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium">
              <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                <span className="w-3 h-3 rounded-md bg-emerald-500 mr-1.5 inline-block" />
                Barang Masuk (In)
              </span>
              <span className="flex items-center text-rose-600 dark:text-rose-400">
                <span className="w-3 h-3 rounded-md bg-rose-500 mr-1.5 inline-block" />
                Barang Keluar (Out)
              </span>
            </div>
          </div>

          {/* SVG Bar Chart Visualization */}
          <div className="h-56 w-full flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100 dark:border-slate-800/80">
            {data?.monthly_chart?.map((item, idx) => {
              const inHeight = Math.max(12, Math.round((item.in_count / maxMonthlyVal) * 160));
              const outHeight = Math.max(12, Math.round((item.out_count / maxMonthlyVal) * 160));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="flex items-end gap-1.5 w-full justify-center">
                    {/* In Bar */}
                    <div
                      style={{ height: `${inHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-emerald-500 rounded-t-lg transition-all duration-300 relative group-hover:opacity-90 flex items-start justify-center pt-1"
                      title={`${item.month}: ${item.in_count} Masuk`}
                    >
                      {item.in_count > 0 && (
                        <span className="text-[10px] font-bold text-white leading-none">
                          {item.in_count}
                        </span>
                      )}
                    </div>
                    {/* Out Bar */}
                    <div
                      style={{ height: `${outHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-rose-500 rounded-t-lg transition-all duration-300 relative group-hover:opacity-90 flex items-start justify-center pt-1"
                      title={`${item.month}: ${item.out_count} Keluar`}
                    >
                      {item.out_count > 0 && (
                        <span className="text-[10px] font-bold text-white leading-none">
                          {item.out_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Stok per Kategori
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sebaran kuantitas stok berdasarkan kelompok barang
              </p>
            </div>
            <Link
              href="/inventory/categories"
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Kelola &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {data?.category_distribution?.map((cat, idx) => {
              const maxCatStock = Math.max(
                ...(data?.category_distribution?.map((c) => c.total_stock) || [1]),
                1
              );
              const pct = Math.min(100, Math.round((cat.total_stock / maxCatStock) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                      {cat.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-bold">
                      {cat.total_stock.toLocaleString("id-ID")}{" "}
                      <span className="text-[10px] font-normal">({cat.item_count} SKU)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Low Stock Alert Table */}
      {data?.low_stock_items && data.low_stock_items.length > 0 && (
        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div>
                <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Peringatan Stok Minimum ({data.low_stock_items.length} Barang)
                </h2>
                <p className="text-xs text-rose-700 dark:text-rose-400">
                  Barang berikut telah mencapai atau berada di bawah ambang batas stok minimum dan perlu di-restock.
                </p>
              </div>
            </div>
            <Link
              href="/inventory/transactions/in"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition"
            >
              + Buat Barang Masuk
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-100/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-2 px-3 rounded-l-lg">Kode</th>
                  <th className="py-2 px-3">Nama Barang</th>
                  <th className="py-2 px-3">Kategori</th>
                  <th className="py-2 px-3 text-right">Stok Tersedia</th>
                  <th className="py-2 px-3 text-right">Batas Min</th>
                  <th className="py-2 px-3 text-center rounded-r-lg">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-rose-900/30">
                {data.low_stock_items.map((item) => (
                  <tr key={item.id} className="hover:bg-rose-100/40 dark:hover:bg-rose-900/20">
                    <td className="py-2 px-3 font-mono font-bold text-rose-800 dark:text-rose-300">
                      {item.code}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                      {item.category}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-rose-600 dark:text-rose-400">
                      {item.available} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                      {item.min_stock} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Link
                        href={`/inventory/transactions/in?item_id=${item.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3 Recent Activity Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaksi Barang Masuk Terbaru */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <ArrowDownLeft className="w-4 h-4 mr-2 text-emerald-600" />
                Barang Masuk Terbaru
              </h2>
              <Link
                href="/inventory/transactions/in"
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            {(!data?.recent_in || data.recent_in.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi barang masuk.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recent_in.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {tx.transaction_number}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID")} &bull; Petugas: {tx.warehouse_officer}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {tx.details?.length || 0} item
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transaksi Barang Keluar Terbaru */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <ArrowUpRight className="w-4 h-4 mr-2 text-rose-600" />
                Barang Keluar Terbaru
              </h2>
              <Link
                href="/inventory/transactions/out"
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            {(!data?.recent_out || data.recent_out.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi barang keluar.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recent_out.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {tx.transaction_number}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        PIC: <span className="font-semibold text-slate-700 dark:text-slate-300">{tx.pic_name}</span> &bull; {tx.location || "Lokasi -"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {tx.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pengembalian Barang Terbaru */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <RotateCcw className="w-4 h-4 mr-2 text-blue-600" />
                Pengembalian Terbaru
              </h2>
              <Link
                href="/inventory/returns"
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Lihat Semua
              </Link>
            </div>

            {(!data?.recent_returns || data.recent_returns.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi pengembalian.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recent_returns.map((ret) => (
                  <div key={ret.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {ret.return_number}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Oleh: <span className="font-semibold text-slate-700 dark:text-slate-300">{ret.pic_name}</span> &bull; Ref: {ret.out_transaction?.transaction_number}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      {ret.details?.length || 0} unit
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

