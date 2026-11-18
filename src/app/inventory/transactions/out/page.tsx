"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  PlusCircle,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  Clock,
  Boxes,
  Check,
  Search,
  Zap,
  Users,
  ClipboardList,
  FileDown,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { fetchActiveMasterItems } from "@/lib/inventoryMasterSync";
import { computeOutTransactionSummary } from "@/lib/inventoryTransactionSummary";
import { parseSerialList } from "@/lib/inventoryClientFinish";
import { buildStockOutNotesFromRequest } from "@/lib/inventoryRequest";
import { useRealtimeMasterItems } from "@/hooks/useRealtimeMasterItems";
import { useDeleteInventoryTransaction } from "@/hooks/useDeleteInventoryTransaction";
import { DeleteTransactionDialog } from "@/components/inventory/DeleteTransactionDialog";
import { HistoryBulkActionsBar } from "@/components/inventory/HistoryBulkActionsBar";
import { SearchableItemSelect } from "@/components/inventory/SearchableItemSelect";
import { PageSizeSelector, PaginationNavigator } from "@/components/Pagination";
import {
  StockOutRequestsDialog,
  type InventoryRequestRecord,
} from "@/components/inventory/StockOutRequestsDialog";

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
  const { currentUser, hasMenuAccess } = useCurrentUser();
  const isAdministrator = currentUser?.role === "admin";
  const canProcessOut = Boolean(
    currentUser && (isAdministrator || hasMenuAccess("inv_out"))
  );

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [picName, setPicName] = useState("");
  const [picPhone, setPicPhone] = useState("");
  const [department, setDepartment] = useState("Field Operations");
  const [officer, setOfficer] = useState(currentUser?.nama || "Admin Gudang");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState<RowItem[]>([
    { item_id: "", quantity: "1", notes: "", serials: [], isSelectorOpen: false, searchQuery: "", manualSnInput: "" },
  ]);

  // View Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Public Requests Modal & ACC State
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [inventoryRequests, setInventoryRequests] = useState<InventoryRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [activeRequest, setActiveRequest] = useState<InventoryRequestRecord | null>(null);

  const { availableItems, applyMasterItems, syncMasterItems } = useRealtimeMasterItems<
    ItemOption,
    RowItem
  >({
    rows,
    setRows,
    resetRow: (r) => ({ ...r, item_id: "", serials: [], manualSnInput: "", searchQuery: "" }),
    onStaleSelectionRemoved: () => {
      setNotification({
        type: "error",
        message:
          "Barang yang sebelumnya dipilih sudah dihapus atau dinonaktifkan di Master Barang dan otomatis dilepas dari pilihan.",
      });
    },
  });

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/inventory/requests?limit=150", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setInventoryRequests(json.data);
        setPendingRequestCount(
          typeof json.pendingCount === "number"
            ? json.pendingCount
            : json.data.filter((r: InventoryRequestRecord) => r.status === "PENDING").length
        );
      }
    } catch (err) {
      console.error("Gagal memuat daftar request barang:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: "OUT",
        page: String(page),
        limit: String(pageSize),
      });
      const [freshItems, resTx] = await Promise.all([
        fetchActiveMasterItems<ItemOption>(),
        fetch(`/api/inventory/transactions?${params.toString()}`, { cache: "no-store" }),
        fetchRequests(),
      ]);

      if (freshItems) applyMasterItems(freshItems);
      const jsonTx = await resTx.json();
      if (jsonTx.success) {
        const nextTotalPages = jsonTx.pagination?.totalPages || 1;
        setRecentTransactions(jsonTx.data);
        setTotalPages(nextTotalPages);
        setTotalCount(jsonTx.pagination?.total || jsonTx.data.length || 0);
        setSelectedTx((prev: any) =>
          prev ? jsonTx.data.find((t: any) => t.id === prev.id) || prev : null
        );
        if (nextTotalPages > 0 && page > nextTotalPages) {
          setPage(nextTotalPages);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data inventaris:", err);
    }
    setLoading(false);
  }, [applyMasterItems, fetchRequests, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const {
    selectedIds,
    deleteTarget,
    deleting,
    deleteError,
    toggleSelectOne,
    toggleSelectAll,
    openSingleDelete,
    openSelectedDelete,
    openAllDelete,
    closeDeleteDialog,
    confirmDelete,
  } = useDeleteInventoryTransaction({
    isAdministrator,
    entity: "OUT",
    onSuccess: (deletedIds, message) => {
      if (selectedTx && (deletedIds === "ALL" || deletedIds.includes(selectedTx.id))) {
        setSelectedTx(null);
      }
      setNotification({ type: "success", message });
      fetchData();
    },
  });

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [fetchData]);

  useEffect(() => {
    if (currentUser?.nama) {
      setOfficer((prev) => (!prev || prev === "Admin Gudang" ? currentUser.nama : prev));
    }
  }, [currentUser?.nama]);

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

  const handleOpenRequestsModal = () => {
    setRequestsModalOpen(true);
    fetchRequests();
  };

  const handleLoadRequestForAcc = (req: InventoryRequestRecord) => {
    setActiveRequest(req);
    setPicName(req.pic_name);
    setPicPhone(req.pic_phone || "");
    setNotes(buildStockOutNotesFromRequest(req));

    const missingOrLow: string[] = [];
    const mappedRows: RowItem[] = (req.items || []).map((ri) => {
      const catalogMatch = availableItems.find((it) => it.id === ri.item_id);
      if (!catalogMatch) {
        missingOrLow.push(ri.item?.name || ri.item_id);
      }
      return {
        item_id: catalogMatch ? ri.item_id : "",
        quantity: String(Number(ri.quantity) || 1),
        notes: ri.notes || "",
        serials: [],
        isSelectorOpen: catalogMatch?.category?.name?.toLowerCase() === "aktif",
        searchQuery: "",
        manualSnInput: "",
      };
    });

    if (mappedRows.length > 0) {
      setRows(mappedRows);
    }

    setRequestsModalOpen(false);
    setNotification({
      type: missingOrLow.length > 0 ? "error" : "success",
      message:
        missingOrLow.length > 0
          ? `Request ${req.request_number} dimuat, namun barang berikut tidak aktif/tidak tersedia: ${missingOrLow.join(", ")}.`
          : `Request ${req.request_number} (${req.pic_name}) siap di-ACC. Pilih Serial Number (jika kategori Aktif) lalu kirim form Barang Keluar.`,
    });
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
          location: activeRequest?.pickup_location || undefined,
          purpose: activeRequest?.work_type_label || undefined,
          warehouse_officer: officer,
          notes,
          request_id: activeRequest?.id || undefined,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      // Reset form
      setActiveRequest(null);
      setPicName("");
      setPicPhone("");
      setNotes("");
      setRows([
        { item_id: "", quantity: "1", notes: "", serials: [], isSelectorOpen: false, searchQuery: "", manualSnInput: "" },
      ]);
      if (page !== 1) {
        setPage(1);
      } else {
        fetchData();
      }
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
            Pencatatan serah terima barang kepada PIC/teknisi, validasi stok otomatis, dan pemilihan Serial Number aktif dari inventory.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchData}
            title="Segarkan Data"
            aria-label="Segarkan Data"
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-rose-600 shadow-sm transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenRequestsModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span>Daftar Request</span>
            {pendingRequestCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[10px] leading-none font-extrabold">
                {pendingRequestCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${notification.type === "success"
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
      {canProcessOut && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <ArrowUpRight className="w-5 h-5 mr-2 text-rose-600" />
              Formulir Pengeluaran Barang Keluar
            </h2>
          </div>

          {activeRequest && (
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Memproses ACC Request{" "}
                  <span className="font-mono">{activeRequest.request_number}</span>
                </p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  Pekerjaan: <strong>{activeRequest.work_type_label}</strong> • Lokasi Ambil:{" "}
                  <strong>{activeRequest.pickup_location}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-200 font-semibold hover:bg-emerald-100 transition cursor-pointer"
              >
                Lepas Tautan Request
              </button>
            </div>
          )}

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
                        <td className="py-2.5 px-3 align-top min-w-[260px]">
                          <SearchableItemSelect
                            ariaLabel={`Pilih barang keluar baris ${idx + 1}`}
                            value={row.item_id}
                            items={availableItems}
                            placeholder="-- Pilih Barang --"
                            emptyItemsPlaceholder="-- Tidak ada barang aktif di Master --"
                            searchPlaceholder="Cari kode atau nama barang..."
                            mode="bracket"
                            showStock
                            showCategory
                            disableOutOfStock
                            onOpen={() => void syncMasterItems(false)}
                            onChange={(itemId) => handleItemSelect(idx, itemId)}
                            triggerClassName="py-1.5 text-xs"
                          />
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
                              className={`w-20 px-2 py-1 text-right font-bold rounded-lg border bg-white dark:bg-slate-950 ${isExceed ? "border-rose-500 text-rose-600" : "border-slate-300 dark:border-slate-700"
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
                                            className={`p-2 flex items-center justify-between cursor-pointer select-none transition ${isSelected
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
                                                onChange={() => { }}
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

      {/* Recent Out Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <ArrowUpRight className="w-4 h-4 mr-2 text-rose-600" />
              Riwayat Transaksi Barang Keluar
            </h2>
            <PageSizeSelector
              value={pageSize}
              onChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              options={[10, 30, 50, 100]}
            />
          </div>

          <HistoryBulkActionsBar
            visible={isAdministrator}
            selectedCount={selectedIds.length}
            hasItems={recentTransactions.length > 0}
            onDeleteSelected={openSelectedDelete}
            onDeleteAll={() => openAllDelete(totalCount || recentTransactions.length)}
          />
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label="Tabel riwayat transaksi barang keluar"
          className="overflow-x-auto"
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                {isAdministrator && (
                  <th scope="col" className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua transaksi barang keluar"
                      checked={
                        recentTransactions.length > 0 &&
                        recentTransactions.every((t) => selectedIds.includes(t.id))
                      }
                      onChange={() => toggleSelectAll(recentTransactions.map((t) => t.id))}
                      className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </th>
                )}
                <th scope="col" className="py-2.5 px-3">No. Transaksi</th>
                <th scope="col" className="py-2.5 px-3">Nama PIC</th>
                <th scope="col" className="py-2.5 px-3">Petugas Gudang</th>
                <th scope="col" className="py-2.5 px-3">Departemen</th>
                <th scope="col" className="py-2.5 px-3 text-right">Barang Masuk</th>
                <th scope="col" className="py-2.5 px-3 text-right">Barang Keluar</th>
                <th scope="col" className="py-2.5 px-3 text-right">Barang Terpakai</th>
                <th scope="col" className="py-2.5 px-3 text-right">Barang Kembali</th>
                <th scope="col" className="py-2.5 px-3">Tanggal</th>
                <th scope="col" className="py-2.5 px-3">Status</th>
                {isAdministrator && (
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={isAdministrator ? 12 : 10} className="py-8 text-center text-slate-400">
                    Belum ada riwayat transaksi barang keluar.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => {
                  const s = tx.summary || computeOutTransactionSummary(tx);
                  const unitText = s.unit ? ` ${s.unit}` : "";

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {isAdministrator && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Pilih transaksi ${tx.transaction_number}`}
                            checked={selectedIds.includes(tx.id)}
                            onChange={() => toggleSelectOne(tx.id)}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          title={
                            s.items_tooltip
                              ? `${s.items_tooltip} — Klik untuk melihat detail transaksi`
                              : "Klik untuk melihat detail transaksi"
                          }
                          className="font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer text-left"
                        >
                          {tx.transaction_number}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {tx.pic_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {tx.warehouse_officer || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {tx.department || "-"}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                        title={s.items_tooltip || undefined}
                      >
                        {Number(s.barang_masuk || 0).toLocaleString("id-ID")}
                        {unitText}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap"
                        title={s.items_tooltip || undefined}
                      >
                        {Number(s.barang_keluar || 0).toLocaleString("id-ID")}
                        {unitText}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        {Number(s.barang_terpakai || 0).toLocaleString("id-ID")}
                        {unitText}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {Number(s.barang_kembali || 0).toLocaleString("id-ID")}
                        {unitText}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.status === "SUDAH_KEMBALI"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : tx.status === "MENUNGGU_PENGEMBALIAN"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                                : tx.status === "SEBAGIAN_KEMBALI"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                  : tx.status === "TERPAKAI"
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      {isAdministrator && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              openSingleDelete({
                                id: tx.id,
                                transaction_number: tx.transaction_number,
                                type: "OUT",
                                pic_name: tx.pic_name,
                                warehouse_officer: tx.warehouse_officer,
                              })
                            }
                            title={`Hapus transaksi ${tx.transaction_number}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950/80 border border-rose-200/80 dark:border-rose-800 font-bold text-[11px] transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <PaginationNavigator
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            entryLabel="transaksi"
          />
        </div>
      </div>

      {/* View Detail Modal (Lokasi & Tujuan Removed) */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {selectedTx.transaction_number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedTx.status === "SUDAH_KEMBALI"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : selectedTx.status === "MENUNGGU_PENGEMBALIAN"
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                          : selectedTx.status === "SEBAGIAN_KEMBALI"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            : selectedTx.status === "TERPAKAI"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    {selectedTx.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Detail Transaksi Barang Keluar
                </h2>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <p><span className="font-semibold text-slate-500">PIC:</span> {selectedTx.pic_name} ({selectedTx.pic_phone || "-"})</p>
                <p><span className="font-semibold text-slate-500">Departemen:</span> {selectedTx.department || "-"}</p>
                <p><span className="font-semibold text-slate-500">Petugas Gudang:</span> {selectedTx.warehouse_officer}</p>
                <p><span className="font-semibold text-slate-500">Tanggal:</span> {new Date(selectedTx.transaction_date).toLocaleDateString("id-ID")}</p>
              </div>
              {selectedTx.notes && (
                <p><span className="font-semibold text-slate-500">Keterangan:</span> {selectedTx.notes}</p>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-[10px] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Barang &amp; Serial Number</th>
                      <th className="py-2 px-3 text-right">Keluar</th>
                      <th className="py-2 px-3 text-right text-purple-600">Terpakai</th>
                      <th className="py-2 px-3 text-right text-blue-600">Kembali</th>
                      <th className="py-2 px-3 text-right text-amber-600">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTx.details?.map((d: any) => {
                      const parsedSns = parseSerialList(d.unit_serial_numbers);

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
                          <td className="py-2.5 px-3 text-right font-bold text-purple-600 align-top">
                            {Number(d.qty_used || 0)} {d.unit}
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

              {selectedTx.client_usages && selectedTx.client_usages.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Rincian Pemakaian oleh Client ({selectedTx.client_usages.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedTx.client_usages.map((cu: any, idx: number) => (
                      <div
                        key={cu.id}
                        className="p-3 rounded-xl border border-purple-200/80 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {idx + 1}. {cu.client_name}
                          </span>
                          {cu.client_phone && (
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              HP: {cu.client_phone}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Alamat: {cu.client_address}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(cu.items || []).map((ci: any) => {
                            const ciSns = parseSerialList(ci.serial_numbers);
                            return (
                              <span
                                key={ci.id}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-[10px] font-semibold text-purple-700 dark:text-purple-300"
                              >
                                {ci.item?.name}: {Number(ci.quantity)} {ci.unit}
                                {ciSns.length > 0 ? ` (SN: ${ciSns.join(", ")})` : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/inventory/form-barang?tx_id=${selectedTx.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F2B59] hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Generate Form Barang (PDF)</span>
              </Link>
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

      <DeleteTransactionDialog
        target={deleteTarget}
        deleting={deleting}
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
      />

      <StockOutRequestsDialog
        open={requestsModalOpen}
        requests={inventoryRequests}
        loading={requestsLoading}
        canManageRequests={canProcessOut}
        onClose={() => setRequestsModalOpen(false)}
        onRefresh={fetchRequests}
        onAcceptRequest={handleLoadRequestForAcc}
        onRejectSuccess={(reqNo) => {
          setNotification({
            type: "success",
            message: `Request ${reqNo} berhasil ditolak.`,
          });
        }}
      />
    </div>
  );
}
