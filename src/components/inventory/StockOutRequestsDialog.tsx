"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

export interface InventoryRequestItemRecord {
  id: string;
  item_id: string;
  quantity: string | number;
  unit: string;
  notes?: string | null;
  item?: {
    id: string;
    code: string;
    name: string;
    unit: string;
    type: string;
    category?: { name: string } | null;
    stock?: { available_stock: string | number } | null;
  } | null;
}

export interface InventoryRequestRecord {
  id: string;
  request_number: string;
  pic_name: string;
  pic_phone?: string | null;
  request_date: string;
  work_types: string;
  work_types_parsed?: string[];
  work_type_other?: string | null;
  work_type_label?: string;
  pickup_location: string;
  notes?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  out_transaction_id?: string | null;
  out_transaction?: {
    id: string;
    transaction_number: string;
    status: string;
    transaction_date: string;
  } | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejected_by_name?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  created_at: string;
  items: InventoryRequestItemRecord[];
}

interface StockOutRequestsDialogProps {
  open: boolean;
  requests: InventoryRequestRecord[];
  loading: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
  onAcceptRequest: (req: InventoryRequestRecord) => void;
  onRejectSuccess: (requestNumber: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  APPROVED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED:
    "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu ACC",
  APPROVED: "Sudah ACC",
  REJECTED: "Ditolak",
};

export function StockOutRequestsDialog({
  open,
  requests,
  loading,
  isAdmin,
  onClose,
  onRefresh,
  onAcceptRequest,
  onRejectSuccess,
}: StockOutRequestsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Inline rejection UI state (avoids browser prompt())
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    setRejectingId(null);
    setRejectReason("");
    setActionError(null);
    if (open) {
      onClose();
    }
  };

  const handleCancelEvent = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (rejectSubmitting) {
      e.preventDefault();
    }
  };

  const handleCopyPublicLink = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/request-barang`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleConfirmReject = async (req: InventoryRequestRecord) => {
    setRejectSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/inventory/requests/${req.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || "Ditolak oleh petugas gudang" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menolak request.");
      }
      setRejectingId(null);
      setRejectReason("");
      await onRefresh();
      onRejectSuccess(req.request_number);
    } catch (err: any) {
      setActionError(err?.message || "Terjadi kesalahan saat menolak request.");
    } finally {
      setRejectSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
      if (!q) return true;
      const itemNames = (req.items || []).map((it) => it.item?.name || "").join(" ").toLowerCase();
      return (
        req.request_number.toLowerCase().includes(q) ||
        req.pic_name.toLowerCase().includes(q) ||
        req.pickup_location.toLowerCase().includes(q) ||
        (req.work_type_label || "").toLowerCase().includes(q) ||
        itemNames.includes(q)
      );
    });
  }, [requests, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      ALL: requests.length,
      PENDING: requests.filter((r) => r.status === "PENDING").length,
      APPROVED: requests.filter((r) => r.status === "APPROVED").length,
      REJECTED: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: rejectSubmitting ? "none" : "any" } as any)}
      onCancel={handleCancelEvent}
      onClose={handleClose}
      className="actis-dialog m-auto w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl p-0"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Daftar Request Barang (Portal Teknisi)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Request dari portal <code className="font-mono">/request-barang</code> untuk di-ACC atau diproses keluar di menu Barang Keluar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Salin link portal request barang (/request-barang)"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">Link Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link Form</span>
                </>
              )}
            </button>
            <a
              href="/request-barang"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka Form
            </a>
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={loading}
              title="Segarkan daftar request"
              aria-label="Segarkan daftar request"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={rejectSubmitting}
              aria-label="Tutup daftar request"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => {
              const active = statusFilter === tab;
              const label =
                tab === "ALL"
                  ? "Semua"
                  : tab === "PENDING"
                    ? "Menunggu ACC"
                    : tab === "APPROVED"
                      ? "Sudah ACC"
                      : "Ditolak";
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {label} ({counts[tab]})
                </button>
              );
            })}
          </div>

          <search>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Cari nomor request, nama PIC, lokasi, atau barang"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. Request / PIC / Gudang..."
                className="pl-8 pr-3 py-1.5 text-xs w-60 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>
          </search>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {actionError && (
            <div
              role="alert"
              className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {loading && requests.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Memuat daftar request barang...
            </p>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Belum ada request barang sesuai filter ini.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bagikan link <code className="font-mono font-bold">/request-barang</code> kepada
                PIC/teknisi yang telah diberi izin di menu Pengaturan User Akses.
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const badgeCls =
                STATUS_BADGE[req.status] ||
                "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
              const isRejecting = rejectingId === req.id;

              return (
                <article
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-extrabold text-xs text-blue-700 dark:text-blue-400">
                          {req.request_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}
                        >
                          {STATUS_LABEL[req.status] || req.status}
                        </span>
                        {req.out_transaction && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[10px] font-bold">
                            Tx: {req.out_transaction.transaction_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-100 font-bold">
                        PIC Penerima: {req.pic_name}
                        {req.pic_phone ? (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {" "}
                            ({req.pic_phone})
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        Tgl Request:{" "}
                        {new Date(req.request_date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div>
                        Dikirim:{" "}
                        {new Date(req.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium">
                      <Wrench className="w-3.5 h-3.5 text-slate-400" />
                      Pekerjaan: <strong>{req.work_type_label || req.work_types}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Lokasi Ambil: <strong>{req.pickup_location}</strong>
                    </span>
                  </div>

                  {req.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="font-semibold text-slate-500">Catatan:</span> {req.notes}
                    </p>
                  )}

                  {/* Requested items */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5" />
                      Barang Diminta ({req.items?.length || 0})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(req.items || []).map((ri) => {
                        const avail = ri.item?.stock ? Number(ri.item.stock.available_stock) : 0;
                        const qty = Number(ri.quantity);
                        const insufficient = req.status === "PENDING" && qty > avail;
                        return (
                          <div
                            key={ri.id}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {ri.item?.name || "Barang"}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">
                                {ri.item?.code} • Stok Gudang: {avail} {ri.unit}
                              </p>
                              {ri.notes && (
                                <p className="text-[10px] text-slate-500 italic truncate">
                                  Ket: {ri.notes}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded font-bold text-xs ${
                                insufficient
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {qty} {ri.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audit status footer or Actions */}
                  {req.status === "APPROVED" && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1">
                      Di-ACC oleh <strong>{req.approved_by_name || "-"}</strong>
                      {req.approved_at
                        ? ` pada ${new Date(req.approved_at).toLocaleString("id-ID")}`
                        : ""}
                    </div>
                  )}

                  {req.status === "REJECTED" && (
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                      Ditolak oleh <strong>{req.rejected_by_name || "-"}</strong>
                      {req.rejected_reason ? ` — Alasan: ${req.rejected_reason}` : ""}
                    </div>
                  )}

                  {req.status === "PENDING" && isAdmin && (
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                      {!isRejecting ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(req.id);
                              setRejectReason("");
                              setActionError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => onAcceptRequest(req)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ACC &amp; Proses Barang Keluar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Alasan penolakan request..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled={rejectSubmitting}
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={rejectSubmitting}
                              onClick={() => handleConfirmReject(req)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                            >
                              {rejectSubmitting ? "Menolak..." : "Konfirmasi Tolak"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </dialog>
  );
}
