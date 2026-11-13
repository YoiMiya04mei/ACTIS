"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Eye,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

function PengembalianBarangContent() {
  const { currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const preselectedTxId = searchParams.get("tx_id");

  const [activeOutTxs, setActiveOutTxs] = useState<any[]>([]);
  const [recentReturns, setRecentReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form
  const [selectedTxId, setSelectedTxId] = useState(preselectedTxId || "");
  const [picName, setPicName] = useState("");
  const [recipientOfficer, setRecipientOfficer] = useState(currentUser?.nama || "Admin Gudang");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [returnDetails, setReturnDetails] = useState<
    Array<{
      transaction_detail_id: string;
      item_name: string;
      item_code: string;
      unit: string;
      qty_out: number;
      qty_remaining: number;
      return_qty: string;
      condition: "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT" | "HILANG";
      notes: string;
    }>
  >([]);

  // View Modal
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOut, resRet] = await Promise.all([
        fetch("/api/inventory/in-use?limit=50"),
        fetch("/api/inventory/returns?limit=20"),
      ]);

      const jsonOut = await resOut.json();
      const jsonRet = await resRet.json();

      if (jsonOut.success) setActiveOutTxs(jsonOut.data);
      if (jsonRet.success) setRecentReturns(jsonRet.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When selected transaction changes, populate return rows
  useEffect(() => {
    if (!selectedTxId) {
      setReturnDetails([]);
      return;
    }

    const tx = activeOutTxs.find((t) => t.id === selectedTxId);
    if (tx) {
      setPicName(tx.pic_name || "");
      const details = (tx.details || [])
        .filter((d: any) => d.item?.type === "REUSABLE" && Number(d.qty_remaining) > 0)
        .map((d: any) => ({
          transaction_detail_id: d.id,
          item_name: d.item?.name,
          item_code: d.item?.code,
          unit: d.unit,
          qty_out: Number(d.quantity),
          qty_remaining: Number(d.qty_remaining),
          return_qty: String(d.qty_remaining), // default to full return
          condition: "BAIK" as const,
          notes: "",
        }));

      setReturnDetails(details);
    }
  }, [selectedTxId, activeOutTxs]);

  const handleReturnDetailChange = (index: number, field: string, value: any) => {
    const updated = [...returnDetails];
    updated[index] = { ...updated[index], [field]: value };
    setReturnDetails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxId) {
      setNotification({ type: "error", message: "Pilih transaksi barang keluar terlebih dahulu." });
      return;
    }

    const itemsToReturn = returnDetails.filter((d) => Number(d.return_qty) > 0);
    if (itemsToReturn.length === 0) {
      setNotification({ type: "error", message: "Tentukan jumlah barang yang dikembalikan (minimal 1 unit)." });
      return;
    }

    // Validation
    for (const d of itemsToReturn) {
      if (Number(d.return_qty) > d.qty_remaining) {
        setNotification({
          type: "error",
          message: `Jumlah kembali (${d.return_qty}) melebihi sisa barang keluar (${d.qty_remaining}) untuk '${d.item_name}'.`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        out_transaction_id: selectedTxId,
        return_date: returnDate,
        pic_name: picName,
        recipient_officer: recipientOfficer,
        notes,
        details: itemsToReturn.map((d) => ({
          transaction_detail_id: d.transaction_detail_id,
          quantity: Number(d.return_qty),
          condition: d.condition,
          notes: d.notes || null,
        })),
      };

      const res = await fetch("/api/inventory/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      setSelectedTxId("");
      setReturnDetails([]);
      setNotes("");
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              Return & Restock
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Pengembalian Perangkat Reusable Sebagian & Penuh
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <RotateCcw className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Pengembalian Barang (Returns)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pemeriksaan kondisi fisik perangkat yang dikembalikan oleh teknisi. Barang kondisi Baik otomatis masuk stok siap pakai, sedangkan barang rusak diisolasi.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-blue-600 shadow-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
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

      {/* Return Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <RotateCcw className="w-5 h-5 mr-2 text-blue-600" />
          Formulir Pengembalian Barang Reusable
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Pilih Transaksi Barang Keluar <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedTxId}
                onChange={(e) => setSelectedTxId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
              >
                <option value="">-- Pilih Transaksi Keluar yang Masih Aktif --</option>
                {activeOutTxs.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    [{tx.transaction_number}] PIC: {tx.pic_name} ({tx.location || "Lokasi -"}) - Status: {tx.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Tanggal Pengembalian <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
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
          </div>

          {returnDetails.length > 0 && (
            <div className="border rounded-xl overflow-hidden mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                  <tr>
                    <th className="py-2.5 px-3">Nama & Kode Barang</th>
                    <th className="py-2.5 px-3 text-right">Keluar</th>
                    <th className="py-2.5 px-3 text-right">Sisa Belum Kembali</th>
                    <th className="py-2.5 px-3 text-right w-28">Jumlah Dikembalikan</th>
                    <th className="py-2.5 px-3 w-40">Kondisi Fisik</th>
                    <th className="py-2.5 px-3">Catatan Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnDetails.map((detail, idx) => (
                    <tr key={detail.transaction_detail_id}>
                      <td className="py-2 px-3">
                        <span className="font-mono text-blue-600 font-bold">{detail.item_code}</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{detail.item_name}</p>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-500">
                        {detail.qty_out} {detail.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-600">
                        {detail.qty_remaining} {detail.unit}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={detail.qty_remaining}
                          value={detail.return_qty}
                          onChange={(e) =>
                            handleReturnDetailChange(idx, "return_qty", e.target.value)
                          }
                          className="w-20 px-2 py-1 text-right font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={detail.condition}
                          onChange={(e) =>
                            handleReturnDetailChange(idx, "condition", e.target.value)
                          }
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        >
                          <option value="BAIK">Baik (Masuk Stok Siap)</option>
                          <option value="RUSAK_RINGAN">Rusak Ringan (Karantina)</option>
                          <option value="RUSAK_BERAT">Rusak Berat (Afkir/Scrap)</option>
                          <option value="HILANG">Hilang (Klaim Ganti)</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={detail.notes}
                          onChange={(e) =>
                            handleReturnDetailChange(idx, "notes", e.target.value)
                          }
                          placeholder="Keterangan port/kondisi..."
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-3">
            <span className="text-[11px] text-slate-500">
              * Pengembalian sebagian tetap mempertahankan sisa unit yang belum kembali.
            </span>

            <button
              type="submit"
              disabled={submitting || returnDetails.length === 0}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              {submitting ? "Memproses..." : "Simpan Pengembalian Barang"}
            </button>
          </div>
        </form>
      </div>

      {/* Return History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <RotateCcw className="w-4 h-4 mr-2 text-blue-600" />
          Riwayat Pengembalian Barang
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">No. Pengembalian</th>
                <th className="py-2.5 px-3">No. Transaksi Keluar</th>
                <th className="py-2.5 px-3">Nama PIC</th>
                <th className="py-2.5 px-3">Penerima Gudang</th>
                <th className="py-2.5 px-3">Tanggal Kembali</th>
                <th className="py-2.5 px-3">Detail Barang</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada riwayat pengembalian.
                  </td>
                </tr>
              ) : (
                recentReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {ret.return_number}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {ret.out_transaction?.transaction_number || "-"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {ret.pic_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {ret.recipient_officer}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(ret.return_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        {ret.details?.map((d: any) => (
                          <div key={d.id} className="flex items-center space-x-1.5 text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {d.item?.name} ({Number(d.quantity)} {d.item?.unit})
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                                d.condition === "BAIK"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {d.condition}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedReturn(ret)}
                        className="p-1 rounded text-slate-500 hover:text-blue-600"
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
      </div>

      {/* View Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedReturn.return_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Detail Pengembalian Barang
                </h2>
              </div>
              <button onClick={() => setSelectedReturn(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><span className="font-semibold text-slate-500">Ref. Transaksi Keluar:</span> {selectedReturn.out_transaction?.transaction_number}</p>
              <p><span className="font-semibold text-slate-500">PIC Pengembali:</span> {selectedReturn.pic_name}</p>
              <p><span className="font-semibold text-slate-500">Petugas Gudang:</span> {selectedReturn.recipient_officer}</p>
              <p><span className="font-semibold text-slate-500">Tanggal:</span> {new Date(selectedReturn.return_date).toLocaleString("id-ID")}</p>

              <div className="border rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-[10px] text-slate-600 border-b">
                    <tr>
                      <th className="py-2 px-3">Barang</th>
                      <th className="py-2 px-3 text-right">Jumlah</th>
                      <th className="py-2 px-3">Kondisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReturn.details?.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3 font-semibold">{d.item?.name}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-600">{Number(d.quantity)} {d.item?.unit}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.condition === "BAIK" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {d.condition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button onClick={() => setSelectedReturn(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PengembalianBarangPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Memuat data pengembalian...</div>}>
      <PengembalianBarangContent />
    </Suspense>
  );
}

