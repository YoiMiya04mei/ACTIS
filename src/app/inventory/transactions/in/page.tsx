"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowDownLeft,
  PlusCircle,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Calendar,
  User,
  Boxes,
  ShieldCheck,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

interface ItemOption {
  id: string;
  name: string;
  code: string;
  unit: string;
  type: string;
  category?: {
    id: string;
    name: string;
  };
  stock?: { available_stock: number };
}

export default function BarangMasukPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Array<{ item_id: string; quantity: string; notes: string; serials: string }>>([
    { item_id: "", quantity: "1", notes: "", serials: "" },
  ]);

  // View Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resItems, resTx] = await Promise.all([
        fetch("/api/inventory/items?limit=100"),
        fetch("/api/inventory/transactions?type=IN&limit=20"),
      ]);

      const jsonItems = await resItems.json();
      const jsonTx = await resTx.json();

      if (jsonItems.success) setAvailableItems(jsonItems.data);
      if (jsonTx.success) setRecentTransactions(jsonTx.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddRow = () => {
    setRows([...rows, { item_id: "", quantity: "1", notes: "", serials: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const validItems = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error("Pilih minimal satu barang dan tentukan kuantitas yang valid.");
      }

      // Validasi Serial Number untuk Barang Kategori Aktif
      const allTxSerialNumbers = new Set<string>();

      for (let i = 0; i < validItems.length; i++) {
        const row = validItems[i];
        const selItem = availableItems.find((it) => it.id === row.item_id);
        const isAktif = selItem?.category?.name?.toLowerCase() === "aktif";
        const qtyNum = Number(row.quantity) || 0;

        if (isAktif) {
          const parsedSns = row.serials
            ? row.serials
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

          if (parsedSns.length !== qtyNum) {
            throw new Error(
              `Baris ${i + 1} (${selItem?.name || "Barang Aktif"}): Kategori Aktif kuantitas ${qtyNum} wajib mengisi tepat ${qtyNum} Serial Number (saat ini terisi: ${parsedSns.length}).`
            );
          }

          // Cek duplikat dalam satu baris
          const uniqueSns = new Set(parsedSns);
          if (uniqueSns.size !== parsedSns.length) {
            throw new Error(
              `Baris ${i + 1} (${selItem?.name || "Barang Aktif"}): Terdapat Serial Number duplikat pada input.`
            );
          }

          // Cek duplikat lintas baris transaksi
          for (const sn of parsedSns) {
            if (allTxSerialNumbers.has(sn)) {
              throw new Error(
                `Serial Number '${sn}' dimasukkan lebih dari satu kali dalam transaksi ini.`
              );
            }
            allTxSerialNumbers.add(sn);
          }
        }
      }

      const itemsPayload = validItems.map((r) => {
        const selItem = availableItems.find((it) => it.id === r.item_id);
        const isAktif = selItem?.category?.name?.toLowerCase() === "aktif";
        const parsedSns = isAktif && r.serials
          ? r.serials
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        return {
          item_id: r.item_id,
          quantity: Number(r.quantity),
          notes: r.notes || null,
          serial_numbers: parsedSns,
        };
      });

      const res = await fetch("/api/inventory/transactions/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: txDate,
          warehouse_officer: currentUser?.nama || "Admin Gudang",
          notes,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      // Reset form
      setNotes("");
      setRows([{ item_id: "", quantity: "1", notes: "", serials: "" }]);
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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
              Logistik Masuk
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Penerimaan Stok Baru & Pengadaan Barang
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <ArrowDownLeft className="w-7 h-7 mr-3 text-emerald-600 dark:text-emerald-400" />
            Barang Masuk (Stock In)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pencatatan barang masuk dari vendor, distributor, atau mutasi antar kantor dengan penomoran otomatis.
          </p>
        </div>

        <button
          onClick={fetchData}
          title="Segarkan Data"
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-emerald-600 shadow-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Form (Stock In) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <ArrowDownLeft className="w-5 h-5 mr-2 text-emerald-600" />
              Formulir Penerimaan Barang Masuk
            </h2>
            {/* Auto Session Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400">Petugas Penerima:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {currentUser?.nama || "Admin Gudang"}
              </span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold ml-1">
                Sesi Login
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Tanggal Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Keterangan / No. Surat Jalan / DO Vendor
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: DO-2026-VND-0881 (Pengadaan Switch Kantor)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Item Rows Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Pilih Barang</th>
                    <th className="py-2.5 px-3 w-32">Kategori</th>
                    <th className="py-2.5 px-3 text-right w-28">Kuantitas</th>
                    <th className="py-2.5 px-3">Serial Number (SN)</th>
                    <th className="py-2.5 px-3 w-44">Catatan (Opsional)</th>
                    <th className="py-2.5 px-3 text-center w-14">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, idx) => {
                    const selItem = availableItems.find((it) => it.id === row.item_id);
                    const categoryName = selItem?.category?.name || "";
                    const isAktif = categoryName.toLowerCase() === "aktif";
                    const isPasif = categoryName.toLowerCase() === "pasif";
                    const qtyNum = Number(row.quantity) || 0;

                    // Parse SNs
                    const enteredSns = row.serials
                      ? row.serials
                          .split(/[\n,]+/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : [];
                    const hasDuplicates = new Set(enteredSns).size !== enteredSns.length;
                    const isCountMatch = enteredSns.length === qtyNum && qtyNum > 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                        {/* Pilih Barang */}
                        <td className="py-2 px-3 align-top">
                          <select
                            required
                            value={row.item_id}
                            onChange={(e) => {
                              const newId = e.target.value;
                              const selected = availableItems.find((it) => it.id === newId);
                              const isNewlyPasif = selected?.category?.name?.toLowerCase() === "pasif";
                              const updated = [...rows];
                              updated[idx] = {
                                ...updated[idx],
                                item_id: newId,
                                // Jika kategori pasif dipilih, otomatis kosongkan serials
                                serials: isNewlyPasif ? "" : updated[idx].serials,
                              };
                              setRows(updated);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                          >
                            <option value="">-- Pilih Barang --</option>
                            {availableItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                [{it.code}] {it.name} ({it.unit}) {it.category?.name ? `• [${it.category.name}]` : ""}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Kategori Badge */}
                        <td className="py-2 px-3 align-top pt-3">
                          {isAktif ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Aktif (Wajib SN)
                            </span>
                          ) : isPasif ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Pasif (Tanpa SN)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">-</span>
                          )}
                        </td>

                        {/* Kuantitas */}
                        <td className="py-2 px-3 align-top text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", e.target.value)}
                              className="w-16 px-2 py-1 text-right font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                            <span className="text-[10px] text-slate-400 w-8 text-left truncate">
                              {selItem?.unit || "Unit"}
                            </span>
                          </div>
                        </td>

                        {/* Serial Number (SN) */}
                        <td className="py-2 px-3 align-top">
                          {isPasif ? (
                            <div>
                              <input
                                type="text"
                                disabled
                                value=""
                                placeholder="Tidak memerlukan SN (Barang Pasif)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed text-xs"
                              />
                              <p className="text-[10px] text-slate-400 mt-1 italic">
                                Kolom SN dikunci untuk barang kategori pasif.
                              </p>
                            </div>
                          ) : isAktif ? (
                            <div className="space-y-1">
                              {qtyNum > 1 ? (
                                <textarea
                                  rows={2}
                                  required
                                  value={row.serials}
                                  onChange={(e) => handleRowChange(idx, "serials", e.target.value)}
                                  placeholder={`Masukkan ${qtyNum} Serial Number (pisahkan dengan koma atau baris baru)...`}
                                  className={`w-full px-2.5 py-1 rounded-lg border text-xs font-mono bg-white dark:bg-slate-950 resize-y transition ${
                                    isCountMatch && !hasDuplicates
                                      ? "border-emerald-500 focus:ring-emerald-500"
                                      : "border-amber-400 focus:ring-amber-500"
                                  }`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  required
                                  value={row.serials}
                                  onChange={(e) => handleRowChange(idx, "serials", e.target.value)}
                                  placeholder="Contoh: SN-2026-001"
                                  className={`w-full px-2.5 py-1 rounded-lg border text-xs font-mono bg-white dark:bg-slate-950 transition ${
                                    isCountMatch && !hasDuplicates
                                      ? "border-emerald-500 focus:ring-emerald-500"
                                      : "border-amber-400 focus:ring-amber-500"
                                  }`}
                                />
                              )}

                              {/* Helper Text / Realtime Validation Indicator */}
                              <div className="text-[10px]">
                                {hasDuplicates ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 inline" /> Ada Serial Number duplikat!
                                  </span>
                                ) : isCountMatch ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 inline" /> {enteredSns.length}/{qtyNum} SN terisi (Valid & Otomatis Masuk Stok)
                                  </span>
                                ) : enteredSns.length === 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    * Wajib diisi {qtyNum} Serial Number (1 SN per unit)
                                  </span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    * Terisi {enteredSns.length} dari {qtyNum} SN yang wajib
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="text"
                                disabled
                                value=""
                                placeholder="Pilih barang terlebih dahulu..."
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 cursor-not-allowed text-xs"
                              />
                            </div>
                          )}
                        </td>

                        {/* Catatan (Opsional) */}
                        <td className="py-2 px-3 align-top">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleRowChange(idx, "notes", e.target.value)}
                            placeholder="Catatan kondisi/vendor..."
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          />
                        </td>

                        {/* Hapus */}
                        <td className="py-2 px-3 align-top text-center pt-2">
                          <button
                            type="button"
                            disabled={rows.length === 1}
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center text-xs font-bold text-blue-600 hover:underline"
              >
                + Tambah Baris Barang
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>Memproses...</>
                ) : (
                  <>
                    <ArrowDownLeft className="w-4 h-4" />
                    Simpan Barang Masuk
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent In Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <ArrowDownLeft className="w-4 h-4 mr-2 text-emerald-600" />
          Riwayat Transaksi Barang Masuk
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Petugas Gudang</th>
                <th className="py-2.5 px-3">Jumlah Item</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada riwayat transaksi barang masuk.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {tx.transaction_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.warehouse_officer}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                      {tx.details?.length || 0} barang
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {tx.notes || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        title="Lihat Detail Transaksi"
                        className="p-1 rounded text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
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

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedTx.transaction_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Detail Transaksi Barang Masuk
                </h2>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p>
                <span className="font-semibold text-slate-500">Petugas Penerima:</span> {selectedTx.warehouse_officer}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Tanggal Transaksi:</span> {new Date(selectedTx.transaction_date).toLocaleString("id-ID")}
              </p>
              {selectedTx.notes && (
                <p>
                  <span className="font-semibold text-slate-500">Keterangan / DO:</span> {selectedTx.notes}
                </p>
              )}

              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Barang & Serial Number</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTx.details?.map((d: any) => {
                      let parsedSns: string[] = [];
                      if (d.unit_serial_numbers) {
                        try {
                          parsedSns = JSON.parse(d.unit_serial_numbers);
                        } catch {}
                      }

                      return (
                        <tr key={d.id}>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{d.item?.name}</p>
                            <span className="font-mono text-[10px] text-slate-400">{d.item?.code}</span>
                            {parsedSns.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {parsedSns.map((sn, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] border border-emerald-200 dark:border-emerald-800"
                                  >
                                    SN: {sn}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 align-top">
                            +{Number(d.quantity)} {d.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition"
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
