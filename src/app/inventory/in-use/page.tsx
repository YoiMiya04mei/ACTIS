"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  RotateCcw,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  Calendar,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

export default function BarangSedangDigunakanPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [picFilter, setPicFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Edit PIC Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [editPicName, setEditPicName] = useState("");
  const [editPicPhone, setEditPicPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchInUse = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        pic: picFilter,
        location: locationFilter,
        status: statusFilter,
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/inventory/in-use?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Gagal memuat barang digunakan." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, picFilter, locationFilter, statusFilter, page]);

  useEffect(() => {
    fetchInUse();
  }, [fetchInUse]);

  const handleOpenEditModal = (tx: any) => {
    setSelectedTx(tx);
    setEditPicName(tx.pic_name || "");
    setEditPicPhone(tx.pic_phone || "");
    setEditLocation(tx.location || "");
    setEditNotes(tx.notes || "");
    setEditReason("");
    setIsEditModalOpen(true);
  };

  const handleSaveEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;

    try {
      const res = await fetch("/api/inventory/in-use", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: selectedTx.id,
          pic_name: editPicName,
          pic_phone: editPicPhone,
          location: editLocation,
          notes: editNotes,
          reason: editReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      setIsEditModalOpen(false);
      fetchInUse();
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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
              Asset Tracking
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Monitoring Perangkat Reusable di Luar Gudang
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Clock className="w-7 h-7 mr-3 text-amber-600 dark:text-amber-400" />
            Barang Sedang Digunakan
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pantau keberadaan seluruh perangkat aktif (router, switch, OTB, laptop) yang sedang dipegang oleh teknisi atau terpasang di POP site.
          </p>
        </div>

        <button
          onClick={() => fetchInUse(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-amber-600 shadow-sm transition disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-amber-600" : ""}`} />
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800"
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

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari transaksi, PIC, barang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Filter PIC..."
            value={picFilter}
            onChange={(e) => {
              setPicFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Filter Lokasi..."
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="">Semua Status Aktif</option>
            <option value="SEDANG_DIGUNAKAN">Sedang Digunakan</option>
            <option value="SEBAGIAN_KEMBALI">Sebagian Kembali</option>
            <option value="SUDAH_KEMBALI">Sudah Kembali (Arsip)</option>
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
                <th className="py-3 px-4">Nama PIC & Kontak</th>
                <th className="py-3 px-4">Lokasi Penggunaan</th>
                <th className="py-3 px-4">Detail Perangkat</th>
                <th className="py-3 px-4">Keterangan Barang</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Memuat barang sedang digunakan...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada perangkat yang sedang berada di luar gudang.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {tx.transaction_number}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
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
                      {tx.purpose && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.purpose}</p>
                      )}
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
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {d.item?.name}
                                </span>
                                <span className="font-bold font-mono text-slate-600 dark:text-slate-300 shrink-0">
                                  Keluar: {Number(d.quantity)} | Sisa:{" "}
                                  <span className="text-amber-600 dark:text-amber-400 font-black">
                                    {Number(d.qty_remaining)} {d.unit}
                                  </span>
                                </span>
                              </div>
                              {parsedSns.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {parsedSns.map((sn, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700"
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
                    {/* Keterangan Barang (di samping Detail Perangkat) */}
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        {tx.details?.map((d: any) => {
                          const note = d.notes || tx.notes;
                          return (
                            <div key={d.id} className="text-[11px]">
                              {note ? (
                                <div>
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    {note}
                                  </span>
                                  {d.notes && tx.notes && d.notes !== tx.notes && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {tx.notes}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">-</span>
                              )}
                            </div>
                          );
                        })}
                        {(!tx.details || tx.details.length === 0) && (
                          <span className="text-slate-400 italic text-[11px]">
                            {tx.notes || "-"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          tx.status === "SUDAH_KEMBALI"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : tx.status === "SEBAGIAN_KEMBALI"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {tx.status !== "SUDAH_KEMBALI" && (
                          <Link
                            href={`/inventory/returns?tx_id=${tx.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px]"
                            title="Proses Pengembalian"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Kembalikan
                          </Link>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            title="Ubah PIC / Lokasi (Dengan Audit Trail)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
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
          <span>Menampilkan {transactions.length} transaksi</span>
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

      {/* MODAL: EDIT PIC / LOKASI (AUDIT TRAIL STRICT) */}
      {isEditModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="font-mono text-xs font-bold text-amber-600">
                  {selectedTx.transaction_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Perubahan PIC & Lokasi Penggunaan
                </h2>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900">
              Perubahan PIC dan lokasi tidak akan mengubah histori stok. Setiap pergantian akan dicatat pada Audit Trail.
            </p>

            <form onSubmit={handleSaveEditAssignment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Nama PIC Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPicName}
                  onChange={(e) => setEditPicName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPicPhone}
                  onChange={(e) => setEditPicPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Lokasi Penggunaan Baru
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Keterangan / Catatan Barang
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Keterangan atau catatan barang..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Alasan Perubahan (Wajib Audit) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Contoh: Serah terima teknisi shift malam / relokasi rack POP"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

