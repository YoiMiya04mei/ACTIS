"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
  FileText,
  User,
  ShieldCheck,
} from "lucide-react";

export default function RiwayatTransaksiPage() {
  const [activeTab, setActiveTab] = useState<"movements" | "audits">("movements");
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // View Audit JSON Modal
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

  const fetchHistory = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        search,
        movement_type: movementType,
        page: String(page),
        limit: "25",
      });

      const res = await fetch(`/api/inventory/history?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDataList(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [activeTab, search, movementType, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              Append-Only Ledger
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Riwayat Mutasi Fisik & Audit Trail Terverifikasi
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <History className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Riwayat Transaksi & Audit Log
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Seluruh aktivitas pergerakan stok, barang masuk, keluar, pengembalian, penyesuaian, dan pergantian PIC tercatat secara permanen.
          </p>
        </div>

        <button
          onClick={() => fetchHistory(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-blue-600 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setActiveTab("movements");
            setPage(1);
          }}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
            activeTab === "movements"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          Pergerakan Fisik Stok (Movements)
        </button>
        <button
          onClick={() => {
            setActiveTab("audits");
            setPage(1);
          }}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 ${
            activeTab === "audits"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          Log Audit & Perubahan Data (Audit Trail)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder={
              activeTab === "movements"
                ? "Cari nama barang, kode, petugas, catatan..."
                : "Cari user, alasan perubahan, entity..."
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        {activeTab === "movements" && (
          <div>
            <select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Semua Tipe Mutasi</option>
              <option value="IN">IN (Barang Masuk)</option>
              <option value="OUT">OUT (Barang Keluar Reusable)</option>
              <option value="RETURN_GOOD">RETURN_GOOD (Kembali Baik)</option>
              <option value="RETURN_DAMAGED">RETURN_DAMAGED (Kembali Rusak)</option>
              <option value="CONSUMED">CONSUMED (Habis Pakai)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Penyesuaian)</option>
            </select>
          </div>
        )}
      </div>

      {/* Table: Movements */}
      {activeTab === "movements" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Nama & Kode Barang</th>
                  <th className="py-3 px-4">Tipe Mutasi</th>
                  <th className="py-3 px-4 text-right">Perubahan</th>
                  <th className="py-3 px-4 text-right">Saldo Sebelum</th>
                  <th className="py-3 px-4 text-right">Saldo Sesudah</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Memuat riwayat pergerakan stok...
                    </td>
                  </tr>
                ) : dataList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Tidak ada catatan pergerakan stok.
                    </td>
                  </tr>
                ) : (
                  dataList.map((m) => {
                    const isPositive = Number(m.quantity) > 0;

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {new Date(m.created_at).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{m.item?.name}</p>
                          <span className="font-mono text-[10px] text-slate-400">{m.item?.code}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.movement_type === "IN" || m.movement_type === "RETURN_GOOD"
                                ? "bg-emerald-100 text-emerald-700"
                                : m.movement_type === "ADJUSTMENT"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black">
                          <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                            {isPositive ? `+${m.quantity}` : m.quantity} {m.item?.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono">
                          {Number(m.balance_before)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-bold font-mono">
                          {Number(m.balance_after)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {m.performed_by}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {m.notes || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Menampilkan {dataList.length} dari {totalCount} rekaman</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="font-bold">{page} / {totalPages}</span>
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
      )}

      {/* Table: Audits */}
      {activeTab === "audits" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Entitas</th>
                  <th className="py-3 px-4">Alasan Perubahan</th>
                  <th className="py-3 px-4 text-center">Data Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Memuat log audit...
                    </td>
                  </tr>
                ) : dataList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tidak ada catatan audit log.
                    </td>
                  </tr>
                ) : (
                  dataList.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(a.created_at).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {a.user_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {a.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-600">
                        {a.entity_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {a.reason || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedAudit(a)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600"
                          title="Lihat Snapshot Data"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Menampilkan {dataList.length} dari {totalCount} log</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="font-bold">{page} / {totalPages}</span>
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
      )}

      {/* Snapshot Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                Snapshot Data Audit: {selectedAudit.action} ({selectedAudit.entity_type})
              </h2>
              <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p><span className="font-semibold text-slate-500">User:</span> {selectedAudit.user_name}</p>
              <p><span className="font-semibold text-slate-500">Alasan:</span> {selectedAudit.reason}</p>

              {selectedAudit.data_before && (
                <div>
                  <span className="font-semibold text-rose-600">Data Sebelum Perubahan:</span>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl overflow-x-auto text-[11px] font-mono mt-1">
                    {JSON.stringify(JSON.parse(selectedAudit.data_before), null, 2)}
                  </pre>
                </div>
              )}

              {selectedAudit.data_after && (
                <div>
                  <span className="font-semibold text-emerald-600">Data Sesudah Perubahan:</span>
                  <pre className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl overflow-x-auto text-[11px] font-mono mt-1">
                    {JSON.stringify(JSON.parse(selectedAudit.data_after), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button onClick={() => setSelectedAudit(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

