"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Users, X } from "lucide-react";
import { computeRemainingSerialsForDetail } from "@/lib/inventoryClientFinish";

export interface FinishItemAllocation {
  transaction_detail_id: string;
  quantity: number;
  serial_numbers: string[];
}

export interface FinishClientDraft {
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

export interface FinishInUseDialogProps {
  tx: any | null;
  submitEndpoint?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function FinishInUseDialog({
  tx,
  submitEndpoint = "/api/inventory/in-use/finish",
  onClose,
  onSuccess,
}: FinishInUseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [finishClients, setFinishClients] = useState<FinishClientDraft[]>([
    createEmptyClientDraft(),
  ]);
  const [finishNotes, setFinishNotes] = useState("");
  const [noClientUsageMode, setNoClientUsageMode] = useState(false);
  const [submittingFinish, setSubmittingFinish] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    if (tx) {
      setFinishClients([createEmptyClientDraft()]);
      setFinishNotes("");
      setNoClientUsageMode(false);
      setFinishError(null);
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (dialogRef.current?.open) {
      dialogRef.current.close("reset");
    }
  }, [tx]);

  const getDetailMaxAllocatable = (detail: any): number => {
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

  const getSerialsUsedByOtherClients = (
    detailId: string,
    excludeClientId?: string
  ): Set<string> => {
    const used = new Set<string>();
    for (const c of finishClients) {
      if (c.localId === excludeClientId) continue;
      for (const sn of c.items[detailId]?.serial_numbers || []) {
        used.add(sn);
      }
    }
    return used;
  };

  const handleCloseModal = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close("cancel");
    } else {
      onClose();
    }
  };

  const handleDialogClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    setFinishError(null);
    onClose();
  };

  const handleAddClient = () => {
    setFinishClients((prev) => [...prev, createEmptyClientDraft()]);
    setFinishError(null);
  };

  const handleRemoveClient = (localId: string) => {
    setFinishClients((prev) =>
      prev.length <= 1 ? prev : prev.filter((c) => c.localId !== localId)
    );
    setFinishError(null);
  };

  const handleClientFieldChange = (
    localId: string,
    field: "client_name" | "client_address" | "client_phone" | "notes",
    value: string
  ) => {
    setFinishClients((prev) =>
      prev.map((c) => (c.localId === localId ? { ...c, [field]: value } : c))
    );
    if (finishError) setFinishError(null);
  };

  const handleToggleItem = (localId: string, detail: any) => {
    if (!tx) return;
    const maxAlloc = getDetailMaxAllocatable(detail);
    const availSns = computeRemainingSerialsForDetail(
      detail,
      tx.client_usages || [],
      tx.returns || []
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
          (sum, oc) =>
            oc.localId === localId ? sum : sum + Number(oc.items[detail.id]?.quantity || 0),
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

  const handleItemQtyChange = (localId: string, detail: any, rawQty: string) => {
    if (!tx) return;
    const maxAlloc = getDetailMaxAllocatable(detail);
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

  const handleToggleItemSn = (localId: string, detail: any, sn: string) => {
    if (!tx) return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx) return;

    setFinishError(null);

    const clientsPayload: Array<{
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
      const res = await fetch(submitEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: tx.id,
          notes: finishNotes.trim() || undefined,
          clients: clientsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyelesaikan penggunaan barang.");
      }

      dialogRef.current?.close("submitted");
      onSuccess(json.message);
    } catch (err: any) {
      setFinishError(
        err?.message || "Terjadi kesalahan saat menyimpan data pemakaian client."
      );
    } finally {
      setSubmittingFinish(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "closerequest" } as any)}
      onClose={handleDialogClose}
      className="actis-dialog m-auto w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl p-0"
    >
      {tx && (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  {tx.transaction_number}
                </span>
                <span className="text-[11px] text-slate-500">
                  PIC: {tx.pic_name}
                </span>
              </div>
              <h2
                id={titleId}
                className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                Selesai Penggunaan &amp; Detail Pemakaian Client
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Catat barang yang terpakai di lokasi client. Barang terpakai otomatis masuk ke menu{" "}
                <strong className="text-purple-600 dark:text-purple-400">
                  Stok Inventory (Terpakai)
                </strong>
                , sedangkan sisa barang akan masuk ke antrean{" "}
                <strong className="text-orange-600 dark:text-orange-400">
                  Pengembalian Barang
                </strong>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
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
                    <th className="py-2 px-3 text-right text-orange-600">
                      Sisa ke Pengembalian
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(tx.details || []).map((d: any) => {
                    const isLegacyConsumed = d.status === "CONSUMED";
                    const maxAlloc = getDetailMaxAllocatable(d);
                    const allocatedTotal = noClientUsageMode
                      ? 0
                      : finishClients.reduce(
                          (sum, c) => sum + Number(c.items[d.id]?.quantity || 0),
                          0
                        );
                    const remainingToReturn = isLegacyConsumed
                      ? 0
                      : Math.max(0, Number(d.qty_remaining || 0) - allocatedTotal);
                    return (
                      <tr key={d.id}>
                        <td className="py-2 px-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {d.item?.name}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {d.item?.code}
                          </span>
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
                id={`finish-no-client-${titleId}`}
                type="checkbox"
                checked={noClientUsageMode}
                onChange={(e) => {
                  setNoClientUsageMode(e.target.checked);
                  setFinishError(null);
                }}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor={`finish-no-client-${titleId}`}
                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
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
                    onClick={handleAddClient}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 font-bold text-[11px] transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Client
                  </button>
                </div>

                {finishClients.map((client, cIdx) => {
                  const allocatableDetails = (tx.details || []).filter(
                    (d: any) => getDetailMaxAllocatable(d) > 0
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
                            onClick={() => handleRemoveClient(client.localId)}
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
                              handleClientFieldChange(
                                client.localId,
                                "client_name",
                                e.target.value
                              )
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
                              handleClientFieldChange(
                                client.localId,
                                "client_phone",
                                e.target.value
                              )
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
                              handleClientFieldChange(
                                client.localId,
                                "client_address",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Item Picker from ALL outbound items */}
                      <div className="space-y-2">
                        <span className="block font-semibold text-slate-700 dark:text-slate-300">
                          Barang yang Digunakan (bisa lebih dari satu){" "}
                          <span className="text-rose-500">*</span>
                        </span>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                          {allocatableDetails.map((d: any) => {
                            const selected = client.items[d.id];
                            const isChecked = Boolean(selected);
                            const maxAlloc = getDetailMaxAllocatable(d);
                            const usedByOthers = getAllocatedByOtherClients(
                              d.id,
                              client.localId
                            );
                            const maxForThisClient = Math.max(0, maxAlloc - usedByOthers);
                            const availSns = computeRemainingSerialsForDetail(
                              d,
                              tx.client_usages || [],
                              tx.returns || []
                            );
                            const snsUsedByOthers = getSerialsUsedByOtherClients(
                              d.id,
                              client.localId
                            );

                            return (
                              <div
                                key={d.id}
                                className="p-3 bg-slate-50/40 dark:bg-slate-900/40 space-y-2"
                              >
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
                                      onChange={() => handleToggleItem(client.localId, d)}
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
                                      Sisa tersedia:{" "}
                                      <strong>
                                        {maxForThisClient} {d.unit}
                                      </strong>
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
                                            handleItemQtyChange(
                                              client.localId,
                                              d,
                                              e.target.value
                                            )
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
                                      const isPickedHere =
                                        selected.serial_numbers.includes(sn);
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
                                            onChange={() =>
                                              handleToggleItemSn(client.localId, d, sn)
                                            }
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
                htmlFor={`finish-global-notes-${titleId}`}
                className="block font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Catatan Penyelesaian (Opsional)
              </label>
              <input
                id={`finish-global-notes-${titleId}`}
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
              onClick={handleCloseModal}
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
  );
}
