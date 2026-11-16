"use client";

import { useState, useCallback } from "react";

interface DeletableTransactionSummary {
  id: string;
  transaction_number: string;
  type: "IN" | "OUT";
  warehouse_officer?: string | null;
  pic_name?: string | null;
}

/**
 * Shared client state and handler for Administrator-only transaction deletion.
 */
export function useDeleteInventoryTransaction({
  isAdministrator,
  onSuccess,
}: {
  isAdministrator: boolean;
  onSuccess: (deletedId: string, message: string) => void;
}) {
  const [txToDelete, setTxToDelete] = useState<DeletableTransactionSummary | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDeleteDialog = useCallback((tx: DeletableTransactionSummary) => {
    setDeleteError(null);
    setTxToDelete(tx);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deletingTx) return;
    setDeleteError(null);
    setTxToDelete(null);
  }, [deletingTx]);

  const confirmDelete = useCallback(async () => {
    if (!txToDelete || !isAdministrator) return;

    setDeletingTx(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/inventory/transactions/${txToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menghapus transaksi.");
      }

      const deletedId = txToDelete.id;
      setTxToDelete(null);
      onSuccess(
        deletedId,
        json.message || `Transaksi ${txToDelete.transaction_number} berhasil dihapus.`
      );
    } catch (err: any) {
      setDeleteError(err?.message || "Terjadi kesalahan saat menghapus transaksi.");
    } finally {
      setDeletingTx(false);
    }
  }, [txToDelete, isAdministrator, onSuccess]);

  return {
    txToDelete,
    deletingTx,
    deleteError,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  };
}
