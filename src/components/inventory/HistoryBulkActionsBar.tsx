"use client";

import React from "react";
import { Trash2 } from "lucide-react";

interface HistoryBulkActionsBarProps {
  visible: boolean;
  selectedCount: number;
  hasItems: boolean;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
}

/**
 * Top-right bulk delete action bar for Administrator-only history management.
 */
export function HistoryBulkActionsBar({
  visible,
  selectedCount,
  hasItems,
  onDeleteSelected,
  onDeleteAll,
}: HistoryBulkActionsBarProps) {
  if (!visible || (!hasItems && selectedCount === 0)) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={onDeleteSelected}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-950/90 border border-rose-200 dark:border-rose-800 font-bold text-xs transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Terpilih ({selectedCount})
        </button>
      )}
      {hasItems && (
        <button
          type="button"
          onClick={onDeleteAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Semua
        </button>
      )}
    </div>
  );
}
