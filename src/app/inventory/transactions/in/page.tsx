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
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

interface ItemOption {
  id: string;
  name: string;
  code: string;
  unit: string;
  type: string;
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
  const [officer, setOfficer] = useState(currentUser?.nama || "Admin Gudang");
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

      const itemsPayload = validItems.map((r) => ({
        item_id: r.item_id,
        quantity: Number(r.quantity),
        notes: r.notes || null,
        serial_numbers: r.serials ? r.serials.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      }));

      const res = await fetch("/api/inventory/transactions/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: txDate,
          warehouse_officer: officer,
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
          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-emerald-600 shadow-sm transition"
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

      {/* Main Form (Stock In) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <ArrowDownLeft className="w-5 h-5 mr-2 text-emerald-600" />
            Formulir Penerimaan Barang Masuk
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Tanggal Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
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
                  value={officer}
                  onChange={(e) => setOfficer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
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
            <div className="border rounded-xl overflow-hidden mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                  <tr>
                    <th className="py-2.5 px-3">Pilih Barang</th>
                    <th className="py-2.5 px-3 text-right w-28">Kuantitas</th>
                    <th className="py-2.5 px-3">Catatan / Serial Number</th>
                    <th className="py-2.5 px-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, idx) => {
                    const selItem = availableItems.find((it) => it.id === row.item_id);

                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <select
                            required
                            value={row.item_id}
                            onChange={(e) => handleRowChange(idx, "item_id", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          >
                            <option value="">-- Pilih Barang --</option>
                            {availableItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                [{it.code}] {it.name} ({it.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="number"
                              min="1"
                              required
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", e.target.value)}
                              className="w-20 px-2 py-1 text-right font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                            <span className="text-[10px] text-slate-400 w-8">
                              {selItem?.unit || "Unit"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleRowChange(idx, "notes", e.target.value)}
                            placeholder="Catatan kondisi / serial number..."
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            disabled={rows.length === 1}
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 disabled:opacity-30"
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
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Simpan Barang Masuk"}
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
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
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
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                      {tx.transaction_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.warehouse_officer}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">
                      {tx.details?.length || 0} barang
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {tx.notes || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedTx(tx)}
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

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-600">
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
                <span className="font-semibold text-slate-500">Petugas:</span> {selectedTx.warehouse_officer}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Tanggal:</span> {new Date(selectedTx.transaction_date).toLocaleString("id-ID")}
              </p>
              {selectedTx.notes && (
                <p>
                  <span className="font-semibold text-slate-500">Catatan:</span> {selectedTx.notes}
                </p>
              )}

              <div className="border rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 border-b">
                    <tr>
                      <th className="py-2 px-3">Barang</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTx.details?.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3">
                          <p className="font-semibold">{d.item?.name}</p>
                          <span className="font-mono text-[10px] text-slate-400">{d.item?.code}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          +{Number(d.quantity)} {d.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-xs"
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

