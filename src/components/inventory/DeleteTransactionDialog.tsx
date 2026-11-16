"use client";

import React, { useEffect, useId, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteTransactionDialogProps {
  transaction: {
    id: string;
    transaction_number: string;
    type: "IN" | "OUT";
    warehouse_officer?: string | null;
    pic_name?: string | null;
  } | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Destructive confirmation modal using native <dialog>.
 * Keeps focus initially on the safe Cancel button per modern accessibility guidance.
 */
export function DeleteTransactionDialog({
  transaction,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteTransactionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const isOpen = Boolean(transaction);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    if (transaction && !deleting) {
      onCancel();
    }
  };

  const handleCancelEvent = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (deleting) {
      e.preventDefault();
    }
  };

  const isOut = transaction?.type === "OUT";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: deleting ? "none" : "closerequest" } as any)}
      onCancel={handleCancelEvent}
      onClose={handleClose}
      className="actis-dialog m-auto w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden"
    >
      {transaction && (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id={titleId}
                  className="text-sm font-extrabold text-slate-900 dark:text-slate-100"
                >
                  Hapus Riwayat Transaksi {isOut ? "Barang Keluar" : "Barang Masuk"}?
                </h2>
                <p className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                  {transaction.transaction_number}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              aria-label="Tutup dialog"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <p className="leading-relaxed">
              Transaksi <strong className="font-mono text-slate-900 dark:text-slate-100">{transaction.transaction_number}</strong>{" "}
              {isOut && transaction.pic_name
                ? `(PIC: ${transaction.pic_name})`
                : transaction.warehouse_officer
                  ? `(Petugas: ${transaction.warehouse_officer})`
                  : ""}{" "}
              akan dihapus secara permanen.
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] leading-relaxed">
              {isOut ? (
                <>
                  Saldo <strong>Stok Inventory</strong>, status Serial Number terkait, riwayat pemakaian client, dan data pengembalian dari transaksi ini akan otomatis dikembalikan ke kondisi sebelum barang keluar.
                </>
              ) : (
                <>
                  Saldo <strong>Stok Inventory</strong> dan Serial Number yang berasal dari transaksi masuk ini akan otomatis dikurangi/dibatalkan. Penghapusan ditolak bila stok atau SN sudah terpakai di transaksi keluar.
                </>
              )}
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              disabled={deleting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Menghapus..." : "Ya, Hapus Transaksi"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
