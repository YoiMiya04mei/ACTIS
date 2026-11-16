"use client";

import { useState, useCallback } from "react";
import type { DeleteDialogTarget, DeleteTargetEntity } from "@/components/inventory/DeleteTransactionDialog";

/**
 * Shared client state, multi-row selection, and API mutation handler
 * for Administrator-only single/selected/bulk deletion on inventory histories.
 */
export function useDeleteInventoryTransaction({
  isAdministrator,
  entity,
  onSuccess,
}: {
  isAdministrator: boolean;
  entity: DeleteTargetEntity;
  onSuccess: (deletedIds: string[] | "ALL", message: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteDialogTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearBothHistoryTabs, setClearBothHistoryTabs] = useState(true);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback((visibleIds: string[]) => {
    if (visibleIds.length === 0) return;
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.includes(id));
      if (allSelected) {
        const visibleSet = new Set(visibleIds);
        return prev.filter((id) => !visibleSet.has(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const openSingleDelete = useCallback(
    (tx: {
      id: string;
      transaction_number: string;
      type: "IN" | "OUT";
      warehouse_officer?: string | null;
      pic_name?: string | null;
    }) => {
      setDeleteError(null);
      setDeleteTarget({
        scope: "single",
        entity: tx.type,
        id: tx.id,
        transaction_number: tx.transaction_number,
        warehouse_officer: tx.warehouse_officer,
        pic_name: tx.pic_name,
      });
    },
    []
  );

  const openSelectedDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteError(null);
    setDeleteTarget({
      scope: "selected",
      entity,
      ids: selectedIds,
    });
  }, [entity, selectedIds]);

  const openAllDelete = useCallback(
    (totalCount?: number) => {
      setDeleteError(null);
      const isHistory = entity === "MOVEMENTS" || entity === "AUDITS";
      setClearBothHistoryTabs(true);
      setDeleteTarget({
        scope: "all",
        entity,
        totalCount,
        allowClearBothHistoryTabs: isHistory,
        clearBothHistoryTabs: true,
        onToggleClearBothHistoryTabs: (val: boolean) => {
          setClearBothHistoryTabs(val);
          setDeleteTarget((prev) =>
            prev && prev.scope === "all" ? { ...prev, clearBothHistoryTabs: val } : prev
          );
        },
      });
    },
    [entity]
  );

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || !isAdministrator) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      let res: Response;
      if (deleteTarget.scope === "single") {
        res = await fetch(`/api/inventory/transactions/${deleteTarget.id}`, {
          method: "DELETE",
        });
      } else if (deleteTarget.entity === "IN" || deleteTarget.entity === "OUT") {
        res = await fetch("/api/inventory/transactions/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: deleteTarget.entity,
            mode: deleteTarget.scope,
            ids: deleteTarget.scope === "selected" ? deleteTarget.ids : undefined,
          }),
        });
      } else {
        const targetParam =
          deleteTarget.scope === "all" && clearBothHistoryTabs
            ? "both"
            : deleteTarget.entity === "AUDITS"
              ? "audits"
              : "movements";
        res = await fetch("/api/inventory/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: targetParam,
            mode: deleteTarget.scope,
            ids: deleteTarget.scope === "selected" ? deleteTarget.ids : undefined,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menghapus riwayat.");
      }

      if (deleteTarget.scope === "single") {
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
        onSuccess([deleteTarget.id], json.message);
      } else if (deleteTarget.scope === "selected") {
        const deletedSet = new Set(deleteTarget.ids);
        setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
        onSuccess(deleteTarget.ids, json.message);
      } else {
        setSelectedIds([]);
        onSuccess("ALL", json.message);
      }

      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Terjadi kesalahan saat menghapus riwayat.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, isAdministrator, clearBothHistoryTabs, onSuccess]);

  return {
    selectedIds,
    deleteTarget,
    deleting,
    deleteError,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    openSingleDelete,
    openSelectedDelete,
    openAllDelete,
    closeDeleteDialog,
    confirmDelete,
  };
}
