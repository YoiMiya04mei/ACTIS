"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Share2,
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  Calendar,
  Building2,
  Package,
  Layers,
  ArrowDownLeft,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

export default function BarangDipinjamkanPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total_loaned_devices: 0,
    total_clients: 0,
    active_loans_count: 0,
    returned_loans_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("DIPINJAMKAN");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Return Loan Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [returnCondition, setReturnCondition] = useState<"BAIK" | "RUSAK_BISA_DIPERBAIKI" | "RUSAK_TOTAL">("BAIK");
  const [recipientOfficer, setRecipientOfficer] = useState(currentUser?.nama || "Admin Gudang");
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoan, setDetailLoan] = useState<any | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchLoanedData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/inventory/loaned?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data);
        if (json.stats) setStats(json.stats);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotalCount(json.pagination.total || 0);
        }
      } else {
        throw new Error(json.error || "Gagal memuat data barang dipinjamkan.");
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Gagal memuat data." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchLoanedData();
  }, [fetchLoanedData]);

  // Open Return Modal
  const handleOpenReturnModal = (tx: any) => {
    setSelectedLoan(tx);
    setReturnCondition("BAIK");
    setRecipientOfficer(currentUser?.nama || "Admin Gudang");
    setReturnNotes(`Penarikan kembali perangkat dari pelanggan ${tx.pic_name}`);
    setIsReturnModalOpen(true);
  };

  // Submit Return to Warehouse
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setSubmittingReturn(true);
    try {
      const res = await fetch(`/api/inventory/loaned/${selectedLoan.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_officer: recipientOfficer,
          condition: returnCondition,
          notes: returnNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal menarik barang kembali");

      setNotification({
        type: "success",
        message: json.message || "Perangkat berhasil ditarik dan dikembalikan ke stok gudang!",
      });
      setIsReturnModalOpen(false);
      fetchLoanedData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleOpenDetailModal = (tx: any) => {
    setDetailLoan(tx);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
              Asset Tracking & Customer Premises
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Monitoring Perangkat Terpasang di Pelanggan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Share2 className="w-7 h-7 mr-3 text-indigo-600 dark:text-indigo-400" />
            Barang Dipinjamkan
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Daftar perangkat (modem, ONT, router, switch) yang dipinjamkan atau terpasang di lokasi pelanggan beserta nomor serial dan status penarikan.
          </p>
        </div>

        <button
          onClick={() => fetchLoanedData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-indigo-600 shadow-sm transition disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
        </button>
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

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Unit Dipinjam</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.total_loaned_devices}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pelanggan Aktif</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.total_clients}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Peminjaman Aktif</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.active_loans_count}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sudah Ditarik</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.returned_loans_count}</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari pelanggan, no. transaksi, SN, barang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
          >
            <option value="">Semua Status</option>
            <option value="DIPINJAMKAN">Dipinjamkan (Aktif di Client)</option>
            <option value="SUDAH_DITARIK">Sudah Ditarik (Kembali ke Gudang)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">No. Transaksi & Tgl</th>
                <th className="py-3 px-4">Nama Pelanggan & Kontak</th>
                <th className="py-3 px-4">Lokasi Pemasangan</th>
                <th className="py-3 px-4">Detail Perangkat & SN</th>
                <th className="py-3 px-4">Teknisi / Asal</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Memuat data barang dipinjamkan...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada barang yang sedang dipinjamkan sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {tx.transaction_number}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                        <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {tx.pic_name}
                      </p>
                      {tx.pic_phone && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          {tx.pic_phone}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-slate-800 dark:text-slate-200 flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                        {tx.location || "Lokasi tidak dispesifikasikan"}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        {tx.details?.map((d: any) => {
                          let parsedSns: string[] = [];
                          if (d.unit_serial_numbers) {
                            try {
                              parsedSns = JSON.parse(d.unit_serial_numbers);
                            } catch {}
                          }

                          return (
                            <div key={d.id} className="text-[11px]">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {d.item?.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold font-mono text-[10px]">
                                  {Number(d.quantity)} {d.unit}
                                </span>
                              </div>
                              {parsedSns.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {parsedSns.map((sn, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] border border-indigo-200 dark:border-indigo-900 font-semibold"
                                    >
                                      SN: {sn}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p className="text-[11px] font-semibold">{tx.purpose || "-"}</p>
                      {tx.permit_number && (
                        <span className="font-mono text-[10px] text-slate-400">
                          Ref: {tx.permit_number}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {tx.notes || "-"}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          tx.status === "DIPINJAMKAN"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {tx.status === "DIPINJAMKAN" ? "DIPINJAMKAN" : "SUDAH DITARIK"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {tx.status === "DIPINJAMKAN" && (
                          <button
                            onClick={() => handleOpenReturnModal(tx)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800 transition shadow-2xs"
                            title="Tarik Perangkat Kembali ke Stok Gudang"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                            Tarik ke Gudang
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetailModal(tx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan {transactions.length} dari {totalCount} transaksi peminjaman</span>
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

      {/* MODAL: TARIK KE GUDANG */}
      {isReturnModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedLoan.transaction_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center mt-0.5">
                  <ArrowDownLeft className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Tarik Perangkat Kembali ke Gudang
                </h2>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLoan.pic_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lokasi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLoan.location}</span>
              </div>
              <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block mb-1">Perangkat yang ditarik:</span>
                {selectedLoan.details?.map((d: any) => (
                  <div key={d.id} className="font-medium text-slate-700 dark:text-slate-300">
                    • {d.item?.name} ({Number(d.quantity)} {d.unit})
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Kondisi Perangkat Saat Diterima Gudang <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                >
                  <option value="BAIK">Baik (Langsung Masuk Stok Siap Pakai)</option>
                  <option value="RUSAK_BISA_DIPERBAIKI">Rusak (Perlu Perbaikan / Reparasi)</option>
                  <option value="RUSAK_TOTAL">Rusak Total (Afkir)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Petugas Penerima Gudang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={recipientOfficer}
                  onChange={(e) => setRecipientOfficer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Keterangan / Alasan Penarikan
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Contoh: Putus langganan / pergantian ke tipe baru"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={submittingReturn}
                  className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center disabled:opacity-50"
                >
                  {submittingReturn ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Konfirmasi Tarik ke Gudang
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL PEMINJAMAN */}
      {isDetailModalOpen && detailLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {detailLoan.transaction_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Detail Barang Dipinjamkan
                </h2>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Pelanggan</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{detailLoan.pic_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Kontak</span>
                  <span className="font-semibold">{detailLoan.pic_phone || "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Lokasi Pemasangan</span>
                  <span className="font-semibold">{detailLoan.location || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Tanggal Pemasangan</span>
                  <span>{new Date(detailLoan.transaction_date).toLocaleDateString("id-ID")}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Status Saat Ini</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{detailLoan.status}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  Daftar Perangkat & Serial Number:
                </h4>
                <div className="space-y-2">
                  {detailLoan.details?.map((d: any) => {
                    let parsedSns: string[] = [];
                    if (d.unit_serial_numbers) {
                      try {
                        parsedSns = JSON.parse(d.unit_serial_numbers);
                      } catch {}
                    }
                    return (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{d.item?.name}</span>
                          <span className="font-mono font-bold text-indigo-600">
                            {Number(d.quantity)} {d.unit}
                          </span>
                        </div>
                        {parsedSns.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {parsedSns.map((sn, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] border border-indigo-200 dark:border-indigo-800 font-semibold"
                              >
                                SN: {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {detailLoan.notes && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Catatan Pemasangan</span>
                  <p className="text-slate-700 dark:text-slate-300">{detailLoan.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border font-semibold text-slate-600 hover:bg-slate-100"
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
