"use client";

import React, { useState, useEffect, useCallback, useRef, useId } from "react";
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
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { computeRemainingSerialsForDetail } from "@/lib/inventoryClientFinish";

interface FinishItemAllocation {
  transaction_detail_id: string;
  quantity: number;
  serial_numbers: string[];
}

interface FinishClientDraft {
  localId: string;
  client_name: string;
  client_address: string;
  client_phone: string;
  notes: string;
  items: Record<string, FinishItemAllocation>;
}

const createEmptyClientDraft = (): FinishClientDraft => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  client_name: "",
  client_address: "",
  client_phone: "",
  notes: "",
  items: {},
});

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

  // Finish / Client Usage Popup Dialog State
  const finishDialogRef = useRef<HTMLDialogElement | null>(null);
  const finishTitleId = useId();
  const [finishTx, setFinishTx] = useState<any | null>(null);
  const [finishClients, setFinishClients] = useState<FinishClientDraft[]>([createEmptyClientDraft()]);
  const [finishNotes, setFinishNotes] = useState("");
  const [noClientUsageMode, setNoClientUsageMode] = useState(false);
  const [submittingFinish, setSubmittingFinish] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

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

      const res = await fetch(`/api/inventory/in-use?${params.toString()}`, { cache: "no-store" });
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

  const getDetailMaxAllocatable = (tx: any, detail: any): number => {
    if (detail.status === "CONSUMED") {
      return Math.max(0, Number(detail.quantity) - Number(detail.qty_used || 0));
    }
    return Math.max(0, Number(detail.qty_remaining || 0));
  };

  const getAllocatedByOtherClients = (detailId: string, excludeClientId?: string): number => {
    return finishClients.reduce((sum, c) => {
      if (c.localId === excludeClientId) return sum;
      return sum + Number(c.items[detailId]?.quantity || 0);
    }, 0);
  };

  const getSerialsUsedByOtherClients = (detailId: string, excludeClientId?: string): Set<string> => {
    const used = new Set<string>();
    for (const c of finishClients) {
      if (c.localId === excludeClientId) continue;
      for (const sn of c.items[detailId]?.serial_numbers || []) {
        used.add(sn);
      }
    }
    return used;
  };

  const handleOpenFinishModal = (tx: any) => {
    setFinishTx(tx);
    setFinishClients([createEmptyClientDraft()]);
    setFinishNotes("");
    setNoClientUsageMode(false);
    setFinishError(null);
    finishDialogRef.current?.showModal();
  };

  const handleCloseFinishModal = () => {
    if (finishDialogRef.current?.open) {
      finishDialogRef.current.close("cancel");
    } else {
      setFinishTx(null);
      setFinishError(null);
    }
  };

  const handleFinishDialogClose = () => {
    if (finishDialogRef.current) {
      finishDialogRef.current.returnValue = "";
    }
    setFinishTx(null);
    setFinishError(null);
  };

  const handleAddFinishClient = () => {
    setFinishClients((prev) => [...prev, createEmptyClientDraft()]);
    setFinishError(null);
  };

  const handleRemoveFinishClient = (localId: string) => {
    setFinishClients((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.localId !== localId)));
    setFinishError(null);
  };

  const handleFinishClientFieldChange = (
    localId: string,
    field: "client_name" | "client_address" | "client_phone" | "notes",
    value: string
  ) => {
    setFinishClients((prev) =>
      prev.map((c) => (c.localId === localId ? { ...c, [field]: value } : c))
    );
    if (finishError) setFinishError(null);
  };

  const handleToggleFinishItem = (localId: string, detail: any) => {
    if (!finishTx) return;
    const maxAlloc = getDetailMaxAllocatable(finishTx, detail);
    const availSns = computeRemainingSerialsForDetail(
      detail,
      finishTx.client_usages || [],
      finishTx.returns || []
    );

    setFinishClients((prev) =>
      prev.map((c) => {
        if (c.localId !== localId) return c;
        const nextItems = { ...c.items };
        if (nextItems[detail.id]) {
          delete nextItems[detail.id];
          return { ...c, items: nextItems };
        }

        const otherQty = prev.reduce(
          (sum, oc) => (oc.localId === localId ? sum : sum + Number(oc.items[detail.id]?.quantity || 0)),
          0
        );
        const remainingQty = Math.max(0, maxAlloc - otherQty);
        if (remainingQty <= 0) return c;

        if (availSns.length > 0) {
          const usedSns = new Set<string>();
          for (const oc of prev) {
            if (oc.localId === localId) continue;
            for (const sn of oc.items[detail.id]?.serial_numbers || []) usedSns.add(sn);
          }
          const freeSns = availSns.filter((sn) => !usedSns.has(sn));
          const initialSns = freeSns.length > 0 ? [freeSns[0]] : [];
          nextItems[detail.id] = {
            transaction_detail_id: detail.id,
            quantity: initialSns.length,
            serial_numbers: initialSns,
          };
        } else {
          nextItems[detail.id] = {
            transaction_detail_id: detail.id,
            quantity: Math.min(1, remainingQty),
            serial_numbers: [],
          };
        }
        return { ...c, items: nextItems };
      })
    );
    if (finishError) setFinishError(null);
  };

  const handleFinishItemQtyChange = (localId: string, detail: any, rawQty: string) => {
    if (!finishTx) return;
    const maxAlloc = getDetailMaxAllocatable(finishTx, detail);
    const otherQty = getAllocatedByOtherClients(detail.id, localId);
    const maxForClient = Math.max(0, maxAlloc - otherQty);
    const parsed = Number(rawQty);
    const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maxForClient)) : 0;

    setFinishClients((prev) =>
      prev.map((c) => {
        if (c.localId !== localId) return c;
        const nextItems = { ...c.items };
        const existing = nextItems[detail.id] || {
          transaction_detail_id: detail.id,
          quantity: 0,
          serial_numbers: [],
        };
        nextItems[detail.id] = { ...existing, quantity: clamped };
        return { ...c, items: nextItems };
      })
    );
    if (finishError) setFinishError(null);
  };

  const handleToggleFinishItemSn = (localId: string, detail: any, sn: string) => {
    if (!finishTx) return;
    setFinishClients((prev) =>
      prev.map((c) => {
        if (c.localId !== localId) return c;
        const nextItems = { ...c.items };
        const existing = nextItems[detail.id] || {
          transaction_detail_id: detail.id,
          quantity: 0,
          serial_numbers: [],
        };
        const hasSn = existing.serial_numbers.includes(sn);
        const nextSns = hasSn
          ? existing.serial_numbers.filter((s) => s !== sn)
          : [...existing.serial_numbers, sn];
        nextItems[detail.id] = {
          transaction_detail_id: detail.id,
          quantity: nextSns.length,
          serial_numbers: nextSns,
        };
        return { ...c, items: nextItems };
      })
    );
    if (finishError) setFinishError(null);
  };

  const handleSubmitFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishTx) return;

    setFinishError(null);

    let clientsPayload: Array<{
      client_name: string;
      client_address: string;
      client_phone?: string;
      notes?: string;
      items: FinishItemAllocation[];
    }> = [];

    if (!noClientUsageMode) {
      for (let i = 0; i < finishClients.length; i++) {
        const c = finishClients[i];
        const activeItems = Object.values(c.items).filter((it) => Number(it.quantity) > 0);
        if (!c.client_name.trim()) {
          setFinishError(`Client #${i + 1}: Nama Client wajib diisi.`);
          return;
        }
        if (!c.client_address.trim()) {
          setFinishError(`Client #${i + 1}: Alamat Client wajib diisi.`);
          return;
        }
        if (activeItems.length === 0) {
          setFinishError(
            `Client #${i + 1} (${c.client_name.trim()}): Pilih minimal 1 barang yang digunakan dengan kuantitas lebih dari 0.`
          );
          return;
        }
        clientsPayload.push({
          client_name: c.client_name.trim(),
          client_address: c.client_address.trim(),
          client_phone: c.client_phone.trim() || undefined,
          notes: c.notes.trim() || undefined,
          items: activeItems,
        });
      }
    }

    setSubmittingFinish(true);
    try {
      const res = await fetch("/api/inventory/in-use/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: finishTx.id,
          notes: finishNotes.trim() || undefined,
          clients: clientsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyelesaikan penggunaan barang.");
      }

      setNotification({ type: "success", message: json.message });
      finishDialogRef.current?.close("submitted");
      fetchInUse();
    } catch (err: any) {
      setFinishError(err.message || "Terjadi kesalahan saat menyimpan data pemakaian client.");
    } finally {
      setSubmittingFinish(false);
    }
  };

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

      {/* Native Modal Dialog: Selesai Penggunaan & Input Pemakaian Client */}
      <dialog
        ref={finishDialogRef}
        aria-labelledby={finishTitleId}
        {...({ closedby: "closerequest" } as any)}
        onClose={handleFinishDialogClose}
        className="actis-dialog m-auto w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl p-0"
      >
        {finishTx && (
          <form onSubmit={handleSubmitFinish} className="flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {finishTx.transaction_number}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    PIC: {finishTx.pic_name}
                  </span>
                </div>
                <h2 id={finishTitleId} className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  Selesai Penggunaan &amp; Detail Pemakaian Client
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Catat barang yang terpakai di lokasi client. Barang terpakai otomatis masuk ke menu{" "}
                  <strong className="text-purple-600 dark:text-purple-400">Stok Inventory (Terpakai)</strong>, sedangkan sisa barang akan masuk ke antrean{" "}
                  <strong className="text-orange-600 dark:text-orange-400">Pengembalian Barang</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseFinishModal}
                aria-label="Tutup dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {finishError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{finishError}</span>
                </div>
              )}

              {/* Summary of All Outbound Items */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Ringkasan Keseluruhan Barang Keluar &amp; Sisa Pengembalian
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-[10px] uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Barang</th>
                      <th className="py-2 px-3 text-right">Dapat Dipakai</th>
                      <th className="py-2 px-3 text-right text-purple-600">Dipakai Client</th>
                      <th className="py-2 px-3 text-right text-orange-600">Sisa ke Pengembalian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(finishTx.details || []).map((d: any) => {
                      const isLegacyConsumed = d.status === "CONSUMED";
                      const maxAlloc = getDetailMaxAllocatable(finishTx, d);
                      const allocatedTotal = noClientUsageMode
                        ? 0
                        : finishClients.reduce((sum, c) => sum + Number(c.items[d.id]?.quantity || 0), 0);
                      const remainingToReturn = isLegacyConsumed
                        ? 0
                        : Math.max(0, Number(d.qty_remaining || 0) - allocatedTotal);
                      return (
                        <tr key={d.id}>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{d.item?.name}</p>
                            <span className="font-mono text-[10px] text-slate-400">{d.item?.code}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {maxAlloc} {d.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                            {allocatedTotal} {d.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                            {isLegacyConsumed ? "-" : `${remainingToReturn} ${d.unit}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Optional Toggle: Full return without client consumption */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                <input
                  id="finish-no-client-usage"
                  type="checkbox"
                  checked={noClientUsageMode}
                  onChange={(e) => {
                    setNoClientUsageMode(e.target.checked);
                    setFinishError(null);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="finish-no-client-usage" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Tidak ada barang terpakai oleh client (masukkan semua sisa perangkat langsung ke antrean Pengembalian Barang)
                </label>
              </div>

              {/* Client Cards */}
              {!noClientUsageMode && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Daftar Client &amp; Barang yang Digunakan ({finishClients.length} Client)
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddFinishClient}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 font-bold text-[11px] transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Client
                    </button>
                  </div>

                  {finishClients.map((client, cIdx) => {
                    const allocatableDetails = (finishTx.details || []).filter(
                      (d: any) => getDetailMaxAllocatable(finishTx, d) > 0
                    );
                    return (
                      <fieldset
                        key={client.localId}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-white dark:bg-slate-900 shadow-xs"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <legend className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            Client #{cIdx + 1}
                          </legend>
                          {finishClients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFinishClient(client.localId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus Client
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor={`client-name-${client.localId}`}
                              className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                            >
                              Nama Client <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id={`client-name-${client.localId}`}
                              name={`client_name_${cIdx}`}
                              type="text"
                              required={!noClientUsageMode}
                              autoFocus={cIdx === 0 && !noClientUsageMode}
                              autoComplete="name"
                              placeholder="Contoh: PT Maju Jaya / Bpk. Andi"
                              value={client.client_name}
                              onChange={(e) =>
                                handleFinishClientFieldChange(client.localId, "client_name", e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`client-phone-${client.localId}`}
                              className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                            >
                              No HP
                            </label>
                            <input
                              id={`client-phone-${client.localId}`}
                              name={`client_phone_${cIdx}`}
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="Contoh: 0812xxxxxxxx"
                              value={client.client_phone}
                              onChange={(e) =>
                                handleFinishClientFieldChange(client.localId, "client_phone", e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`client-address-${client.localId}`}
                              className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                            >
                              Alamat <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              id={`client-address-${client.localId}`}
                              name={`client_address_${cIdx}`}
                              rows={2}
                              required={!noClientUsageMode}
                              autoComplete="street-address"
                              placeholder="Alamat pemasangan / lokasi client..."
                              value={client.client_address}
                              onChange={(e) =>
                                handleFinishClientFieldChange(client.localId, "client_address", e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Item Picker from ALL outbound items */}
                        <div className="space-y-2">
                          <span className="block font-semibold text-slate-700 dark:text-slate-300">
                            Barang yang Digunakan (bisa lebih dari satu) <span className="text-rose-500">*</span>
                          </span>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                            {allocatableDetails.map((d: any) => {
                              const selected = client.items[d.id];
                              const isChecked = Boolean(selected);
                              const maxAlloc = getDetailMaxAllocatable(finishTx, d);
                              const usedByOthers = getAllocatedByOtherClients(d.id, client.localId);
                              const maxForThisClient = Math.max(0, maxAlloc - usedByOthers);
                              const availSns = computeRemainingSerialsForDetail(
                                d,
                                finishTx.client_usages || [],
                                finishTx.returns || []
                              );
                              const snsUsedByOthers = getSerialsUsedByOtherClients(d.id, client.localId);

                              return (
                                <div key={d.id} className="p-3 bg-slate-50/40 dark:bg-slate-900/40 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label
                                      htmlFor={`client-${client.localId}-item-${d.id}`}
                                      className="inline-flex items-center gap-2 cursor-pointer"
                                    >
                                      <input
                                        id={`client-${client.localId}-item-${d.id}`}
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={!isChecked && maxForThisClient <= 0}
                                        onChange={() => handleToggleFinishItem(client.localId, d)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                                      />
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {d.item?.name}
                                      </span>
                                      <span className="font-mono text-[10px] text-slate-400">
                                        ({d.item?.code})
                                      </span>
                                    </label>

                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-slate-500">
                                        Sisa tersedia: <strong>{maxForThisClient} {d.unit}</strong>
                                      </span>
                                      {isChecked && availSns.length === 0 && (
                                        <div className="flex items-center gap-1">
                                          <label
                                            htmlFor={`client-${client.localId}-qty-${d.id}`}
                                            className="text-[11px] font-medium text-slate-600 dark:text-slate-300"
                                          >
                                            Qty:
                                          </label>
                                          <input
                                            id={`client-${client.localId}-qty-${d.id}`}
                                            type="number"
                                            min={1}
                                            max={maxForThisClient}
                                            step="any"
                                            value={selected.quantity}
                                            onChange={(e) =>
                                              handleFinishItemQtyChange(client.localId, d, e.target.value)
                                            }
                                            className="w-20 px-2 py-1 text-right font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                                          />
                                        </div>
                                      )}
                                      {isChecked && availSns.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px]">
                                          {selected.quantity} SN dipilih
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {isChecked && availSns.length > 0 && (
                                    <div className="pl-6 pt-1 flex flex-wrap gap-1.5">
                                      {availSns.map((sn) => {
                                        const isPickedHere = selected.serial_numbers.includes(sn);
                                        const isTakenElsewhere = snsUsedByOthers.has(sn);
                                        const snInputId = `sn-${client.localId}-${d.id}-${sn}`;
                                        return (
                                          <label
                                            key={sn}
                                            htmlFor={snInputId}
                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border font-mono text-[10px] transition ${
                                              isTakenElsewhere
                                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed line-through"
                                                : isPickedHere
                                                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold cursor-pointer"
                                                  : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 cursor-pointer"
                                            }`}
                                          >
                                            <input
                                              id={snInputId}
                                              type="checkbox"
                                              disabled={isTakenElsewhere}
                                              checked={isPickedHere}
                                              onChange={() => handleToggleFinishItemSn(client.localId, d, sn)}
                                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>{sn}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              )}

              <div>
                <label
                  htmlFor="finish-global-notes"
                  className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Catatan Penyelesaian (Opsional)
                </label>
                <input
                  id="finish-global-notes"
                  name="finish_notes"
                  type="text"
                  placeholder="Keterangan tambahan penyelesaian pekerjaan..."
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCloseFinishModal}
                disabled={submittingFinish}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingFinish}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submittingFinish ? "Menyimpan..." : "Simpan & Selesaikan Penggunaan"}
              </button>
            </div>
          </form>
        )}
      </dialog>

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
            <option value="MENUNGGU_PENGEMBALIAN">Menunggu Pengembalian</option>
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
                                  Keluar: {Number(d.quantity)}
                                  {Number(d.qty_used || 0) > 0 && (
                                    <span className="text-purple-600 dark:text-purple-400">
                                      {" "}
                                      | Terpakai: {Number(d.qty_used)}
                                    </span>
                                  )}
                                  {" | Sisa: "}
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
                        {tx.client_usages && tx.client_usages.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                              Dipakai Client ({tx.client_usages.length}):
                            </span>
                            {tx.client_usages.map((cu: any) => (
                              <div
                                key={cu.id}
                                className="p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/50 text-[10px] space-y-0.5"
                              >
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                  {cu.client_name}
                                  {cu.client_phone ? ` (${cu.client_phone})` : ""}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">{cu.client_address}</p>
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {(cu.items || []).map((ci: any) => {
                                    let ciSns: string[] = [];
                                    if (ci.serial_numbers) {
                                      try {
                                        ciSns = JSON.parse(ci.serial_numbers);
                                      } catch {}
                                    }
                                    return (
                                      <span
                                        key={ci.id}
                                        className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-semibold"
                                      >
                                        {ci.item?.name}: {Number(ci.quantity)} {ci.unit}
                                        {ciSns.length > 0 ? ` [${ciSns.join(", ")}]` : ""}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          tx.status === "SUDAH_KEMBALI"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : tx.status === "MENUNGGU_PENGEMBALIAN"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
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
                        {(tx.status === "SEDANG_DIGUNAKAN" || tx.status === "SEBAGIAN_KEMBALI") && (
                          <button
                            type="button"
                            onClick={() => handleOpenFinishModal(tx)}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[11px] shadow-xs transition cursor-pointer"
                            title="Selesaikan penggunaan & input pemakaian barang oleh client"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Selesai
                          </button>
                        )}
                        {tx.status === "MENUNGGU_PENGEMBALIAN" && (
                          <Link
                            href={`/inventory/returns?tx_id=${tx.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 font-bold text-[11px] border border-orange-200/80 dark:border-orange-800 transition"
                            title="Konfirmasi sisa barang ke menu Pengembalian Barang"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Proses Pengembalian
                          </Link>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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

