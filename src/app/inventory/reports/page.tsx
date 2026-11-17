"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageSizeSelector, PaginationNavigator } from "@/components/Pagination";
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  Filter,
  RefreshCw,
  Printer,
  Boxes,
  RotateCcw,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export default function LaporanInventoryPage() {
  const [reportType, setReportType] = useState<"stock" | "movements" | "in_use" | "returns">("stock");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      let url = `/api/inventory/stock?${qs.toString()}`;
      if (reportType === "movements") {
        qs.set("tab", "movements");
        qs.set("start_date", startDate);
        qs.set("end_date", endDate);
        url = `/api/inventory/history?${qs.toString()}`;
      } else if (reportType === "in_use") {
        url = `/api/inventory/in-use?${qs.toString()}`;
      } else if (reportType === "returns") {
        qs.set("start_date", startDate);
        qs.set("end_date", endDate);
        url = `/api/inventory/returns?${qs.toString()}`;
      }

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        const nextTotalPages = json.pagination?.totalPages || 1;
        setReportData(json.data);
        setTotalPages(nextTotalPages);
        setTotalCount(json.pagination?.total || json.data?.length || 0);
        if (nextTotalPages > 0 && page > nextTotalPages) {
          setPage(nextTotalPages);
        }
      }
    } catch {}
    setLoading(false);
  }, [reportType, startDate, endDate, page, pageSize]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (reportType === "stock") {
      window.open("/api/inventory/items/export?format=csv", "_blank");
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
              Rekapitulasi & Ekspor
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Laporan Logistik, Opname & Audit Inventaris
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <BarChart3 className="w-7 h-7 mr-3 text-indigo-600 dark:text-indigo-400" />
            Laporan Inventory
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Ekspor rekapitulasi posisi saldo stok, mutasi pergerakan barang, status barang sedang digunakan di lapangan, dan pengembalian barang.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Export Data
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Cetak Laporan / PDF
          </button>
        </div>
      </div>

      {/* Report Configuration Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Pilih Parameter Laporan
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Jenis Laporan
            </label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
            >
              <option value="stock">Laporan Saldo Stok Saat Ini</option>
              <option value="movements">Laporan Mutasi Fisik (Movements)</option>
              <option value="in_use">Laporan Perangkat Sedang Digunakan</option>
              <option value="returns">Laporan Pengembalian Barang</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                if (page !== 1) {
                  setPage(1);
                } else {
                  generateReport();
                }
              }}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {loading ? "Membuat Laporan..." : "Tampilkan Laporan"}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Report Output Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 print:p-0 print:border-none print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              PT JEMBATAN DATA PANGRANGO
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {reportType === "stock"
                ? "LAPORAN SALDO STOK GUDANG TERKINI"
                : reportType === "movements"
                ? `LAPORAN MUTASI LOGISTIK (${startDate} s.d ${endDate})`
                : reportType === "in_use"
                ? "LAPORAN PERANGKAT REUSABLE SEDANG DIGUNAKAN"
                : "LAPORAN PENGEMBALIAN BARANG GUDANG"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="print:hidden">
              <PageSizeSelector
                value={pageSize}
                onChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                options={[10, 30, 50, 100]}
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Dicetak: {new Date().toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-700 dark:text-slate-300 uppercase border-b">
              {reportType === "stock" && (
                <tr>
                  <th className="py-2.5 px-3">Kode</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3 text-right">Stok Masuk</th>
                  <th className="py-2.5 px-3 text-right">Stok Keluar</th>
                  <th className="py-2.5 px-3 text-right">Stok Siap Pakai</th>
                  <th className="py-2.5 px-3">Lokasi</th>
                </tr>
              )}
              {reportType === "movements" && (
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Barang</th>
                  <th className="py-2.5 px-3">Tipe Mutasi</th>
                  <th className="py-2.5 px-3 text-right">Perubahan</th>
                  <th className="py-2.5 px-3 text-right">Saldo Sesudah</th>
                  <th className="py-2.5 px-3">Petugas</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                </tr>
              )}
              {reportType === "in_use" && (
                <tr>
                  <th className="py-2.5 px-3">No. Transaksi</th>
                  <th className="py-2.5 px-3">Tanggal Keluar</th>
                  <th className="py-2.5 px-3">PIC</th>
                  <th className="py-2.5 px-3">Lokasi</th>
                  <th className="py-2.5 px-3">Barang & Sisa Belum Kembali</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              )}
              {reportType === "returns" && (
                <tr>
                  <th className="py-2.5 px-3">No. Return</th>
                  <th className="py-2.5 px-3">Tgl Kembali</th>
                  <th className="py-2.5 px-3">PIC Pengembali</th>
                  <th className="py-2.5 px-3">Penerima Gudang</th>
                  <th className="py-2.5 px-3">Barang & Kondisi</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Membuat laporan...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada data untuk periode ini.
                  </td>
                </tr>
              ) : (
                reportData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    {reportType === "stock" && (
                      <>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{row.code}</td>
                        <td className="py-2.5 px-3 font-semibold">{row.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{row.category?.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{row.type}</td>
                        <td className="py-2.5 px-3 text-right">{Number(row.stock?.total_in || 0)}</td>
                        <td className="py-2.5 px-3 text-right">{Number(row.stock?.total_out || 0)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                          {Number(row.stock?.available_stock || 0)} {row.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{row.storage_location || "-"}</td>
                      </>
                    )}
                    {reportType === "movements" && (
                      <>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{new Date(row.created_at).toLocaleString("id-ID")}</td>
                        <td className="py-2.5 px-3 font-semibold">{row.item?.name}</td>
                        <td className="py-2.5 px-3 font-bold">{row.movement_type}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{row.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-black">{Number(row.balance_after)}</td>
                        <td className="py-2.5 px-3">{row.performed_by}</td>
                        <td className="py-2.5 px-3 text-slate-500">{row.notes || "-"}</td>
                      </>
                    )}
                    {reportType === "in_use" && (
                      <>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-600">{row.transaction_number}</td>
                        <td className="py-2.5 px-3">{new Date(row.transaction_date).toLocaleDateString("id-ID")}</td>
                        <td className="py-2.5 px-3 font-bold">{row.pic_name}</td>
                        <td className="py-2.5 px-3">{row.location}</td>
                        <td className="py-2.5 px-3">
                          {row.details?.map((d: any) => `${d.item?.name} (${Number(d.qty_remaining)} ${d.unit})`).join(", ")}
                        </td>
                        <td className="py-2.5 px-3 text-center">{row.status}</td>
                      </>
                    )}
                    {reportType === "returns" && (
                      <>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{row.return_number}</td>
                        <td className="py-2.5 px-3">{new Date(row.return_date).toLocaleDateString("id-ID")}</td>
                        <td className="py-2.5 px-3 font-bold">{row.pic_name}</td>
                        <td className="py-2.5 px-3">{row.recipient_officer}</td>
                        <td className="py-2.5 px-3">
                          {row.details?.map((d: any) => `${d.item?.name} (${Number(d.quantity)} unit - ${d.condition})`).join(", ")}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
          <PaginationNavigator
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            entryLabel="data"
          />
        </div>
      </div>
    </div>
  );
}

