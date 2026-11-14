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
  Clock,
  Boxes,
  Check,
  Search,
  Zap,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { permitBarangStorage } from "@/services/permitBarangStorage";

interface ItemUnit {
  id: string;
  serial_number: string;
  mac_address?: string | null;
  status: string;
  condition: string;
}

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
  units?: ItemUnit[];
}

interface RowItem {
  item_id: string;
  quantity: string;
  notes: string;
  serials: string[];
  manualSnInput?: string;
  isSelectorOpen?: boolean;
  searchQuery?: string;
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
  const [officer, setOfficer] = useState(currentUser?.nama || "Admin Gudang");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [permitRefId, setPermitRefId] = useState<string | null>(null);
  const [permitRefNumber, setPermitRefNumber] = useState<string | null>(null);

  const [rows, setRows] = useState<RowItem[]>([
    { item_id: "", quantity: "1", notes: "", serials: [], isSelectorOpen: false, searchQuery: "", manualSnInput: "" },
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
    } catch (err) {
      console.error("Gagal memuat data inventaris:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (currentUser?.nama && !officer) {
      setOfficer(currentUser.nama);
    }
  }, [currentUser]);

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
    setPermitRefId(doc.id);
    setPermitRefNumber(doc.letterNumber || doc.id);
    setNotes(`Berdasarkan Surat Permit No. ${doc.letterNumber || doc.id}`);

    // Map devices to inventory items
    if (doc.devices && doc.devices.length > 0) {
      const newRows: RowItem[] = [];
      doc.devices.forEach((dev: any) => {
        const cleanName = dev.name.toLowerCase();
        const matched = availableItems.find(
          (it) => it.name.toLowerCase().includes(cleanName) || cleanName.includes(it.name.toLowerCase())
        );

        const qtyMatch = dev.quantity ? String(dev.quantity).match(/\d+/) : null;
        const qtyStr = qtyMatch ? qtyMatch[0] : "1";
        const qtyNum = Number(qtyStr) || 1;

        const isAktif = matched?.category?.name?.toLowerCase() === "aktif";
        let autoSerials: string[] = [];

        if (isAktif) {
          if (dev.serialNumber) {
            autoSerials = [dev.serialNumber.trim()];
          } else if (matched?.units && matched.units.length > 0) {
            autoSerials = matched.units.slice(0, qtyNum).map((u) => u.serial_number);
          }
        }

        newRows.push({
          item_id: matched ? matched.id : "",
          quantity: qtyStr,
          notes: dev.notes || (dev.serialNumber ? `SN: ${dev.serialNumber}` : ""),
          serials: isAktif ? autoSerials : [],
          isSelectorOpen: false,
          searchQuery: "",
          manualSnInput: "",
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
    setRows([
      ...rows,
      { item_id: "", quantity: "1", notes: "", serials: [], isSelectorOpen: false, searchQuery: "", manualSnInput: "" },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index: number, field: keyof RowItem, value: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleItemSelect = (index: number, itemId: string) => {
    const selected = availableItems.find((it) => it.id === itemId);
    const isAktif = selected?.category?.name?.toLowerCase() === "aktif";
    const isPasif = selected?.category?.name?.toLowerCase() === "pasif";
    const qtyNum = Number(rows[index].quantity) || 1;

    let initialSerials: string[] = [];
    if (isAktif && selected?.units && selected.units.length > 0) {
      // Find other rows selected serials
      const usedInOtherRows = rows
        .filter((_, rIdx) => rIdx !== index)
        .flatMap((r) => r.serials || []);
      const availableUnitsForThis = selected.units.filter((u) => !usedInOtherRows.includes(u.serial_number));
      initialSerials = availableUnitsForThis.slice(0, qtyNum).map((u) => u.serial_number);
    }

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      item_id: itemId,
      serials: isPasif ? [] : initialSerials,
      isSelectorOpen: false,
      searchQuery: "",
      manualSnInput: "",
    };
    setRows(updated);
  };

  const handleQuantityChange = (index: number, qtyStr: string) => {
    const qtyNum = Math.max(1, parseInt(qtyStr, 10) || 1);
    const updated = [...rows];
    const currentRow = updated[index];
    const selItem = availableItems.find((it) => it.id === currentRow.item_id);
    const isAktif = selItem?.category?.name?.toLowerCase() === "aktif";

    let nextSerials = currentRow.serials || [];
    if (isAktif) {
      // If quantity is reduced, slice serials to match
      if (nextSerials.length > qtyNum) {
        nextSerials = nextSerials.slice(0, qtyNum);
      }
    }

    updated[index] = {
      ...currentRow,
      quantity: qtyStr,
      serials: nextSerials,
    };
    setRows(updated);
  };

  const handleToggleSerial = (rowIndex: number, sn: string) => {
    const updated = [...rows];
    const row = updated[rowIndex];
    const qtyNum = Number(row.quantity) || 1;
    const currentSerials = row.serials || [];

    if (currentSerials.includes(sn)) {
      // Deselect
      updated[rowIndex].serials = currentSerials.filter((s) => s !== sn);
    } else {
      // Select
      if (currentSerials.length >= qtyNum) {
        setNotification({
          type: "error",
          message: `Kuantitas baris adalah ${qtyNum}. Hapus salah satu serial number terlebih dahulu atau naikkan kuantitas.`,
        });
        return;
      }
      updated[rowIndex].serials = [...currentSerials, sn];
    }
    setRows(updated);
  };

  const handleRemoveSerial = (rowIndex: number, sn: string) => {
    const updated = [...rows];
    updated[rowIndex].serials = (updated[rowIndex].serials || []).filter((s) => s !== sn);
    setRows(updated);
  };

  const handleAutoSelectSerials = (rowIndex: number) => {
    const updated = [...rows];
    const row = updated[rowIndex];
    const selItem = availableItems.find((it) => it.id === row.item_id);
    const qtyNum = Number(row.quantity) || 1;
    if (!selItem?.units || selItem.units.length === 0) return;

    const usedInOtherRows = rows
      .filter((_, rIdx) => rIdx !== rowIndex)
      .flatMap((r) => r.serials || []);

    const availableForSelect = selItem.units
      .filter((u) => !usedInOtherRows.includes(u.serial_number))
      .slice(0, qtyNum)
      .map((u) => u.serial_number);

    updated[rowIndex].serials = availableForSelect;
    setRows(updated);
  };

  const handleClearSerials = (rowIndex: number) => {
    const updated = [...rows];
    updated[rowIndex].serials = [];
    setRows(updated);
  };

  const handleAddManualSn = (rowIndex: number) => {
    const updated = [...rows];
    const row = updated[rowIndex];
    const sn = (row.manualSnInput || "").trim();
    if (!sn) return;

    const qtyNum = Number(row.quantity) || 1;
    const current = row.serials || [];

    if (current.includes(sn)) {
      setNotification({ type: "error", message: `Serial Number '${sn}' sudah terpilih pada baris ini.` });
      return;
    }

    if (current.length >= qtyNum) {
      setNotification({
        type: "error",
        message: `Kuantitas adalah ${qtyNum}. Tidak dapat memilih lebih dari ${qtyNum} SN.`,
      });
      return;
    }

    updated[rowIndex].serials = [...current, sn];
    updated[rowIndex].manualSnInput = "";
    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picName.trim()) {
      setNotification({ type: "error", message: "Nama PIC Penerima wajib diisi." });
      return;
    }

    setSubmitting(true);
    try {
      const validItems = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error("Pilih minimal satu barang dan tentukan kuantitas yang valid.");
      }

      // Check client-side available stock validation & Active Item SN requirements
      const allTxSerialNumbers = new Set<string>();

      for (let i = 0; i < validItems.length; i++) {
        const r = validItems[i];
        const itm = availableItems.find((it) => it.id === r.item_id);
        const avail = itm?.stock ? Number(itm.stock.available_stock) : 0;
        const qtyNum = Number(r.quantity) || 0;

        if (qtyNum > avail) {
          throw new Error(
            `Kuantitas keluar (${r.quantity} ${itm?.unit}) melebihi stok tersedia (${avail} ${itm?.unit}) untuk '${itm?.name}'.`
          );
        }

        const isAktif = itm?.category?.name?.toLowerCase() === "aktif";
        if (isAktif) {
          const rowSerials = r.serials || [];
          if (rowSerials.length !== qtyNum) {
            throw new Error(
              `Baris ${i + 1} (${itm?.name || "Barang Aktif"}): Kategori Aktif kuantitas ${qtyNum} wajib memilih tepat ${qtyNum} Serial Number dari inventory (saat ini terpilih: ${rowSerials.length}).`
            );
          }

          // Check duplicate in same row
          const uniqueSns = new Set(rowSerials);
          if (uniqueSns.size !== rowSerials.length) {
            throw new Error(`Baris ${i + 1} (${itm?.name}): Terdapat Serial Number duplikat pada pilihan.`);
          }

          // Check duplicate across rows
          for (const sn of rowSerials) {
            if (allTxSerialNumbers.has(sn)) {
              throw new Error(`Serial Number '${sn}' dipilih lebih dari satu kali dalam transaksi ini.`);
            }
            allTxSerialNumbers.add(sn);
          }
        }
      }

      const itemsPayload = validItems.map((r) => {
        const itm = availableItems.find((it) => it.id === r.item_id);
        const isAktif = itm?.category?.name?.toLowerCase() === "aktif";
        return {
          item_id: r.item_id,
          quantity: Number(r.quantity),
          notes: r.notes || null,
          serial_numbers: isAktif ? r.serials : [],
        };
      });

      const res = await fetch("/api/inventory/transactions/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_date: txDate,
          pic_name: picName,
          pic_phone: picPhone,
          department,
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
      setNotes("");
      setPermitRefId(null);
      setPermitRefNumber(null);
      setRows([
        { item_id: "", quantity: "1", notes: "", serials: [], isSelectorOpen: false, searchQuery: "", manualSnInput: "" },
      ]);
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
            Pencatatan serah terima barang kepada PIC/teknisi, validasi stok otomatis, pemilihan Serial Number aktif dari inventory, dan integrasi Surat Permit.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchData}
            title="Segarkan Data"
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
            {/* Header Form Inputs (Lokasi Penggunaan & Tujuan Penggunaan Removed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  Petugas Penyerah Gudang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={officer}
                  onChange={(e) => setOfficer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
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
                  placeholder="Catatan surat tugas / nomor tiket / keperluan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Multi-Item Selection Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[220px]">Pilih Barang</th>
                    <th className="py-2.5 px-3 w-28 text-center">Kategori</th>
                    <th className="py-2.5 px-3 text-right w-24">Stok Siap</th>
                    <th className="py-2.5 px-3 text-right w-28">Jumlah Keluar</th>
                    <th className="py-2.5 px-3 min-w-[300px]">Pilihan Serial Number (SN)</th>
                    <th className="py-2.5 px-3 w-32">Catatan</th>
                    <th className="py-2.5 px-3 text-center w-14">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row, idx) => {
                    const selItem = availableItems.find((it) => it.id === row.item_id);
                    const avail = selItem?.stock ? Number(selItem.stock.available_stock) : 0;
                    const isExceed = Number(row.quantity) > avail;
                    const isAktif = selItem?.category?.name?.toLowerCase() === "aktif";
                    const isPasif = selItem?.category?.name?.toLowerCase() === "pasif";
                    const qtyNum = Number(row.quantity) || 0;
                    const availableUnits = selItem?.units || [];

                    // Collect serials used in other rows to prevent selecting same unit twice
                    const usedInOtherRows = rows
                      .filter((_, rIdx) => rIdx !== idx)
                      .flatMap((r) => r.serials || []);

                    const filteredUnits = availableUnits.filter((u) => {
                      if (!row.searchQuery?.trim()) return true;
                      return u.serial_number.toLowerCase().includes(row.searchQuery.toLowerCase());
                    });

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                        {/* 1. Pilih Barang */}
                        <td className="py-2.5 px-3 align-top">
                          <select
                            required
                            value={row.item_id}
                            onChange={(e) => handleItemSelect(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                          >
                            <option value="">-- Pilih Barang --</option>
                            {availableItems.map((it) => {
                              const st = it.stock ? Number(it.stock.available_stock) : 0;
                              return (
                                <option key={it.id} value={it.id} disabled={st <= 0}>
                                  [{it.code}] {it.name} - Tersedia: {st} {it.unit} {it.category?.name ? `• [${it.category.name}]` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </td>

                        {/* 2. Kategori Badge */}
                        <td className="py-2.5 px-3 align-top pt-3 text-center">
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

                        {/* 3. Stok Siap */}
                        <td className="py-2.5 px-3 text-right font-black text-slate-600 dark:text-slate-300 align-top pt-3">
                          {selItem ? `${avail} ${selItem.unit}` : "-"}
                        </td>

                        {/* 4. Jumlah Keluar */}
                        <td className="py-2.5 px-3 text-right align-top">
                          <div className="flex items-center justify-end space-x-1">
                            <input
                              type="number"
                              min="1"
                              max={avail > 0 ? avail : 1}
                              required
                              value={row.quantity}
                              onChange={(e) => handleQuantityChange(idx, e.target.value)}
                              className={`w-20 px-2 py-1 text-right font-bold rounded-lg border bg-white dark:bg-slate-950 ${
                                isExceed ? "border-rose-500 text-rose-600" : "border-slate-300 dark:border-slate-700"
                              }`}
                            />
                            <span className="text-[10px] text-slate-400 w-8 truncate text-left">
                              {selItem?.unit || "Unit"}
                            </span>
                          </div>
                        </td>

                        {/* 5. Serial Number Selection (Aktif vs Pasif) */}
                        <td className="py-2.5 px-3 align-top">
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
                            <div className="space-y-1.5">
                              {/* Selected Chips */}
                              {row.serials && row.serials.length > 0 && (
                                <div className="flex flex-wrap gap-1 p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                                  {row.serials.map((sn, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[11px] font-bold"
                                    >
                                      <span>{sn}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSerial(idx, sn)}
                                        className="text-blue-400 hover:text-rose-500 font-bold ml-0.5"
                                        title="Hapus serial number ini"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Validation Status Indicator */}
                              <div className="text-[11px]">
                                {row.serials.length === qtyNum && qtyNum > 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    Tepat {row.serials.length}/{qtyNum} SN terpilih dari stok (Valid)
                                  </span>
                                ) : row.serials.length < qtyNum ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    Wajib pilih {qtyNum - row.serials.length} SN lagi ({row.serials.length}/{qtyNum} terpilih)
                                  </span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    Kelebihan {row.serials.length - qtyNum} SN terpilih (Kuantitas: {qtyNum})
                                  </span>
                                )}
                              </div>

                              {/* Trigger Button to Open SN Drawer/Picker */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRowChange(idx, "isSelectorOpen", !row.isSelectorOpen)}
                                  className="flex-1 inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    <Boxes className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>
                                      {availableUnits.length > 0
                                        ? `Pilih dari ${availableUnits.length} SN Tersedia di Stok`
                                        : `Belum Ada SN Terdaftar di Stok`}
                                    </span>
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 ml-1">
                                    {row.isSelectorOpen ? "Tutup ▲" : "Buka Daftar ▼"}
                                  </span>
                                </button>

                                {availableUnits.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAutoSelectSerials(idx)}
                                    title={`Otomatis pilih ${qtyNum} SN pertama yang tersedia`}
                                    className="px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 shrink-0 transition"
                                  >
                                    <Zap className="w-3 h-3" />
                                    Auto {qtyNum}
                                  </button>
                                )}

                                {row.serials.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearSerials(idx)}
                                    title="Bersihkan semua pilihan SN"
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 text-[11px] font-medium shrink-0"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              {/* Expandable Inventory SN Selector Panel */}
                              {row.isSelectorOpen && (
                                <div className="mt-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shadow-sm space-y-2">
                                  {/* Filter & Search */}
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                                      <input
                                        type="text"
                                        value={row.searchQuery || ""}
                                        onChange={(e) => handleRowChange(idx, "searchQuery", e.target.value)}
                                        placeholder="Cari Serial Number di stok..."
                                        className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                                      {row.serials.length}/{qtyNum} Terpilih
                                    </span>
                                  </div>

                                  {/* List of Available Units */}
                                  {availableUnits.length === 0 ? (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                                      <p className="font-semibold flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Belum ada unit Serial Number terdaftar di inventory untuk barang ini.
                                      </p>
                                      <p className="text-[10px] text-amber-700/80 dark:text-amber-400">
                                        Anda dapat menginput nomor SN secara manual di bawah ini:
                                      </p>
                                    </div>
                                  ) : filteredUnits.length === 0 ? (
                                    <p className="p-2 text-center text-slate-400 text-[11px]">
                                      Tidak ada serial number yang cocok dengan filter pencarian.
                                    </p>
                                  ) : (
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950">
                                      {filteredUnits.map((u) => {
                                        const isSelected = row.serials.includes(u.serial_number);
                                        const isUsedElsewhere = usedInOtherRows.includes(u.serial_number);

                                        return (
                                          <div
                                            key={u.id}
                                            onClick={() => {
                                              if (!isUsedElsewhere) handleToggleSerial(idx, u.serial_number);
                                            }}
                                            className={`p-2 flex items-center justify-between cursor-pointer select-none transition ${
                                              isSelected
                                                ? "bg-blue-50/80 dark:bg-blue-950/60 font-semibold text-blue-900 dark:text-blue-200"
                                                : isUsedElsewhere
                                                ? "opacity-40 bg-slate-100/50 cursor-not-allowed text-slate-400"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                              <input
                                                type="checkbox"
                                                disabled={isUsedElsewhere}
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                                              />
                                              <span className="font-mono text-xs truncate">
                                                {u.serial_number}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                                {u.condition || "BAIK"}
                                              </span>
                                              {isUsedElsewhere && (
                                                <span className="text-[10px] text-rose-500 italic">
                                                  (Dipilih di baris lain)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Manual Input Fallback */}
                                  <div className="pt-1 border-t border-slate-200/80 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={row.manualSnInput || ""}
                                        onChange={(e) => handleRowChange(idx, "manualSnInput", e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddManualSn(idx);
                                          }
                                        }}
                                        placeholder="Ketik SN manual jika belum terdaftar..."
                                        className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddManualSn(idx)}
                                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0"
                                      >
                                        + Tambah SN
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <input
                                type="text"
                                disabled
                                value=""
                                placeholder="Pilih barang terlebih dahulu..."
                                className="w-full px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 text-slate-400 cursor-not-allowed text-xs"
                              />
                            </div>
                          )}
                        </td>

                        {/* 6. Catatan Baris */}
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleRowChange(idx, "notes", e.target.value)}
                            placeholder="Catatan..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                          />
                        </td>

                        {/* 7. Hapus Baris */}
                        <td className="py-2.5 px-3 text-center align-top pt-3">
                          <button
                            type="button"
                            disabled={rows.length === 1}
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                            title="Hapus baris ini"
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

      {/* Recent Out Transactions Table (Lokasi Penggunaan Column Removed) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
          <ArrowUpRight className="w-4 h-4 mr-2 text-rose-600" />
          Riwayat Transaksi Barang Keluar
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Nama PIC</th>
                <th className="py-2.5 px-3">Departemen</th>
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
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {tx.transaction_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {tx.pic_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {tx.department || "-"}
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
                        title="Lihat Detail Transaksi"
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
              Pilih surat permit resmi yang telah diterbitkan untuk mengisi data PIC dan daftar perangkat secara otomatis:
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
                        PIC: {doc.applicantName}
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

      {/* View Detail Modal (Lokasi & Tujuan Removed) */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
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
              <p><span className="font-semibold text-slate-500">Departemen:</span> {selectedTx.department || "-"}</p>
              <p><span className="font-semibold text-slate-500">Petugas Gudang:</span> {selectedTx.warehouse_officer}</p>
              {selectedTx.notes && (
                <p><span className="font-semibold text-slate-500">Keterangan:</span> {selectedTx.notes}</p>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-[10px] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Barang & Serial Number</th>
                      <th className="py-2 px-3 text-right">Keluar</th>
                      <th className="py-2 px-3 text-right">Kembali</th>
                      <th className="py-2 px-3 text-right">Sisa</th>
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
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{d.item?.name}</p>
                            <span className="font-mono text-[10px] text-slate-400">{d.item?.code}</span>
                            {parsedSns.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {parsedSns.map((sn, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono text-[10px] border border-blue-200 dark:border-blue-800"
                                  >
                                    SN: {sn}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600 align-top">
                            {Number(d.quantity)} {d.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-600 align-top">
                            {Number(d.qty_returned || 0)} {d.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-600 align-top">
                            {Number(d.qty_remaining || 0)} {d.unit}
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
