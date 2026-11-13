"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowUpRight,
  PlusCircle,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  FileText,
  User,
  MapPin,
  Clock,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { permitBarangStorage } from "@/services/permitBarangStorage";

interface ItemOption {
  id: string;
  name: string;
  code: string;
  unit: string;
  type: string;
  stock?: { available_stock: number };
}

export default function BarangKeluarPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [picName, setPicName] = useState("");
  const [picPhone, setPicPhone] = useState("");
  const [department, setDepartment] = useState("Field Operations");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [officer, setOfficer] = useState(currentUser?.nama || "Admin Gudang");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [permitRefId, setPermitRefId] = useState<string | null>(null);
  const [permitRefNumber, setPermitRefNumber] = useState<string | null>(null);

  const [rows, setRows] = useState<Array<{ item_id: string; quantity: string; notes: string; serials: string }>>([
    { item_id: "", quantity: "1", notes: "", serials: "" },
  ]);

  // Permit Picker Modal
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [permitDocs, setPermitDocs] = useState<any[]>([]);

  // View Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resItems, resTx] = await Promise.all([
        fetch("/api/inventory/items?limit=100"),
        fetch("/api/inventory/transactions?type=OUT&limit=20"),
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

  const handleOpenPermitPicker = async () => {
    try {
      const docs = await permitBarangStorage.getAllPermitBarang();
      setPermitDocs(docs);
      setIsPermitModalOpen(true);
    } catch {
      alert("Gagal memuat arsip Surat Permit Barang.");
    }
  };

  const handleSelectPermitDoc = (doc: any) => {
    setPicName(doc.applicantName || "");
    setPicPhone(doc.applicantPhone || "");
    setLocation(doc.location || "");
    setPurpose(doc.subject || "Permit Keluar Barang");
    setPermitRefId(doc.id);
    setPermitRefNumber(doc.letterNumber || doc.id);
    setNotes(`Berdasarkan Surat Permit No. ${doc.letterNumber || doc.id}`);

    // Map devices to inventory items
    if (doc.devices && doc.devices.length > 0) {
      const newRows: Array<{ item_id: string; quantity: string; notes: string; serials: string }> = [];
      doc.devices.forEach((dev: any) => {
        const cleanName = dev.name.toLowerCase();
        const matched = availableItems.find(
          (it) => it.name.toLowerCase().includes(cleanName) || cleanName.includes(it.name.toLowerCase())
        );

        const qtyMatch = dev.quantity ? String(dev.quantity).match(/\d+/) : null;
        const qtyStr = qtyMatch ? qtyMatch[0] : "1";

        newRows.push({
          item_id: matched ? matched.id : "",
          quantity: qtyStr,
          notes: dev.notes || (dev.serialNumber ? `SN: ${dev.serialNumber}` : ""),
          serials: dev.serialNumber || "",
        });
      });

      if (newRows.length > 0) {
        setRows(newRows);
      }
    }

    setIsPermitModalOpen(false);
    setNotification({
      type: "success",
      message: `Data Surat Permit '${doc.letterNumber || doc.id}' berhasil dimuat ke formulir barang keluar.`,
    });
  };

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
    if (!picName.trim()) {
      setNotification({ type: "error", message: "Nama PIC wajib diisi." });
      return;
    }

    setSubmitting(true);
    try {
      const validItems = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error("Pilih minimal satu barang dan tentukan kuantitas yang valid.");
      }

      // Check client-side available stock validation
      for (const r of validItems) {
        const itm = availableItems.find((it) => it.id === r.item_id);
        const avail = itm?.stock ? Number(itm.stock.available_stock) : 0;
        if (Number(r.quantity) > avail) {
          throw new Error(
            `Kuantitas keluar (${r.quantity} ${itm?.unit}) melebihi stok tersedia (${avail} ${itm?.unit}) untuk '${itm?.name}'.`
          );
        }
      }

      const itemsPayload = validItems.map((r) => ({
        item_id: r.item_id,
        quantity: Number(r.quantity),
        notes: r.notes || null,
        serial_numbers: r.serials ? r.serials.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      }));

      const res = await fetch("/api/inventory/transactions/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: txDate,
          pic_name: picName,
          pic_phone: picPhone,
          department,
          location,
          purpose,
          warehouse_officer: officer,
          notes,
          permit_id: permitRefId,
          permit_number: permitRefNumber,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      // Reset form
      setPicName("");
      setPicPhone("");
      setLocation("");
      setPurpose("");
      setNotes("");
      setPermitRefId(null);
      setPermitRefNumber(null);
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
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider">
              Logistik Keluar
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Pengeluaran Perangkat untuk PIC, Teknisi & Instalasi
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <ArrowUpRight className="w-7 h-7 mr-3 text-rose-600 dark:text-rose-400" />
            Barang Keluar (Stock Out)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pencatatan serah terima barang kepada PIC/teknisi, lokasi penggunaan, validasi stok otomatis, dan integrasi Surat Permit.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-rose-600 shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenPermitPicker}
              className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-purple-300 dark:border-purple-800/70 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold shadow-xs transition"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Tarik dari Surat Permit Keluar
            </button>
          )}
        </div>
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

      {/* Main Stock Out Form */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <ArrowUpRight className="w-5 h-5 mr-2 text-rose-600" />
              Formulir Pengeluaran Barang Keluar
            </h2>
            {permitRefNumber && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                Terkait Permit: {permitRefNumber}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Tanggal Keluar <span className="text-rose-500">*</span>
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
                  Nama PIC Penerima <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Contoh: Rahmat & Hendrik"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  No. Telepon / WhatsApp PIC
                </label>
                <input
                  type="text"
                  value={picPhone}
                  onChange={(e) => setPicPhone(e.target.value)}
                  placeholder="Contoh: 085759535195"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Departemen / Tim
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Field Operations">Field Operations</option>
                  <option value="NOC Network Desk">NOC Network Desk</option>
                  <option value="Infrastructure Core">Infrastructure Core</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Sales / Project">Sales / Project</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Lokasi Penggunaan
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Gedung Wisma Bumi Putera Suite 701A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Tujuan Penggunaan
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Contoh: Instalasi Pelanggan Baru / Maintenance POP"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Petugas Penyerah Gudang <span className="text-rose-500">*</span>
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
                  Keterangan Tambahan
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan surat tugas / nomor tiket"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Multi-Item Selection Table */}
            <div className="border rounded-xl overflow-hidden mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
                  <tr>
                    <th className="py-2.5 px-3">Pilih Barang</th>
                    <th className="py-2.5 px-3 text-right w-24">Stok Siap</th>
                    <th className="py-2.5 px-3 text-right w-28">Jumlah Keluar</th>
                    <th className="py-2.5 px-3">Catatan / Serial Number</th>
                    <th className="py-2.5 px-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, idx) => {
                    const selItem = availableItems.find((it) => it.id === row.item_id);
                    const avail = selItem?.stock ? Number(selItem.stock.available_stock) : 0;
                    const isExceed = Number(row.quantity) > avail;

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
                            {availableItems.map((it) => {
                              const st = it.stock ? Number(it.stock.available_stock) : 0;
                              return (
                                <option key={it.id} value={it.id} disabled={st <= 0}>
                                  [{it.code}] {it.name} - Tersedia: {st} {it.unit} ({it.type})
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-600">
                          {selItem ? `${avail} ${selItem.unit}` : "-"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="number"
                              min="1"
                              max={avail > 0 ? avail : 1}
                              required
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", e.target.value)}
                              className={`w-20 px-2 py-1 text-right font-bold rounded-lg border bg-white dark:bg-slate-950 ${
                                isExceed ? "border-rose-500 text-rose-600" : "border-slate-300 dark:border-slate-700"
                              }`}
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
                            placeholder="Catatan / serial number unit..."
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
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Keluarkan Barang Sekarang"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Out Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <ArrowUpRight className="w-4 h-4 mr-2 text-rose-600" />
          Riwayat Transaksi Barang Keluar
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 uppercase border-b">
              <tr>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Nama PIC</th>
                <th className="py-2.5 px-3">Lokasi Penggunaan</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada riwayat transaksi barang keluar.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                      {tx.transaction_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.pic_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {tx.location || "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === "SUDAH_KEMBALI"
                            ? "bg-emerald-100 text-emerald-700"
                            : tx.status === "SEBAGIAN_KEMBALI"
                            ? "bg-blue-100 text-blue-700"
                            : tx.status === "TERPAKAI"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {tx.status}
                      </span>
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

      {/* MODAL: PERMIT BARANG PICKER */}
      {isPermitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-600" />
                Pilih Dokumen Surat Permit Keluar Barang
              </h2>
              <button onClick={() => setIsPermitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pilih surat permit resmi yang telah diterbitkan untuk mengisi data PIC, lokasi, dan daftar perangkat secara otomatis:
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              {permitDocs.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 text-center">Belum ada arsip surat permit.</p>
              ) : (
                permitDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectPermitDoc(doc)}
                    className="p-3 hover:bg-purple-50/60 dark:hover:bg-purple-950/30 cursor-pointer flex items-center justify-between transition"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-purple-600 text-xs">
                          {doc.letterNumber || doc.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {doc.createdDate}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        PIC: {doc.applicantName} &bull; {doc.location}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {doc.devices?.length || 0} Perangkat ({doc.devices?.map((d: any) => d.name).join(", ")})
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700"
                    >
                      Pilih &rarr;
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPermitModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="font-mono text-xs font-bold text-rose-600">
                  {selectedTx.transaction_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Detail Transaksi Barang Keluar
                </h2>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><span className="font-semibold text-slate-500">PIC:</span> {selectedTx.pic_name} ({selectedTx.pic_phone || "-"})</p>
              <p><span className="font-semibold text-slate-500">Lokasi:</span> {selectedTx.location || "-"}</p>
              <p><span className="font-semibold text-slate-500">Tujuan:</span> {selectedTx.purpose || "-"}</p>
              <p><span className="font-semibold text-slate-500">Petugas Gudang:</span> {selectedTx.warehouse_officer}</p>

              <div className="border rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-[10px] text-slate-600 border-b">
                    <tr>
                      <th className="py-2 px-3">Barang</th>
                      <th className="py-2 px-3 text-right">Keluar</th>
                      <th className="py-2 px-3 text-right">Kembali</th>
                      <th className="py-2 px-3 text-right">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTx.details?.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 px-3">
                          <p className="font-semibold">{d.item?.name}</p>
                          <span className="font-mono text-[10px] text-slate-400">{d.item?.code}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">
                          {Number(d.quantity)} {d.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-blue-600">
                          {Number(d.qty_returned || 0)} {d.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-600">
                          {Number(d.qty_remaining || 0)} {d.unit}
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

