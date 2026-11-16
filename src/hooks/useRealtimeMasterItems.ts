"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  fetchActiveMasterItems,
  pruneRemovedMasterItemRows,
  subscribeMasterInventorySync,
} from "@/lib/inventoryMasterSync";

interface UseRealtimeMasterItemsOptions<TRow extends { item_id: string }> {
  rows: TRow[];
  setRows: Dispatch<SetStateAction<TRow[]>>;
  resetRow: (row: TRow) => TRow;
  onStaleSelectionRemoved?: () => void;
  minSyncGapMs?: number;
  pollIntervalMs?: number;
}

/**
 * Keeps transaction item selectors (e.g. Barang Masuk / Barang Keluar)
 * synchronized in realtime with active Master Barang records.
 */
export function useRealtimeMasterItems<
  TItem extends { id: string },
  TRow extends { item_id: string },
>({
  rows,
  setRows,
  resetRow,
  onStaleSelectionRemoved,
  minSyncGapMs = 800,
  pollIntervalMs = 8000,
}: UseRealtimeMasterItemsOptions<TRow>) {
  const [availableItems, setAvailableItems] = useState<TItem[]>([]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const resetRowRef = useRef(resetRow);
  resetRowRef.current = resetRow;
  const onRemovedRef = useRef(onStaleSelectionRemoved);
  onRemovedRef.current = onStaleSelectionRemoved;

  const lastMasterSyncAtRef = useRef<number>(0);
  const syncingMasterRef = useRef<boolean>(false);

  const applyMasterItems = useCallback(
    (freshItems: TItem[]) => {
      lastMasterSyncAtRef.current = Date.now();
      setAvailableItems(freshItems);

      const { nextRows, removedCount } = pruneRemovedMasterItemRows(
        rowsRef.current,
        freshItems,
        (r) => resetRowRef.current(r)
      );
      if (removedCount > 0) {
        setRows(nextRows);
        onRemovedRef.current?.();
      }
    },
    [setRows]
  );

  const syncMasterItems = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (syncingMasterRef.current) return;
      if (!force && now - lastMasterSyncAtRef.current < minSyncGapMs) return;

      syncingMasterRef.current = true;
      try {
        const freshItems = await fetchActiveMasterItems<TItem>();
        if (freshItems) {
          applyMasterItems(freshItems);
        }
      } finally {
        syncingMasterRef.current = false;
      }
    },
    [applyMasterItems, minSyncGapMs]
  );

  useEffect(() => {
    return subscribeMasterInventorySync(() => {
      void syncMasterItems(true);
    }, pollIntervalMs);
  }, [syncMasterItems, pollIntervalMs]);

  return {
    availableItems,
    applyMasterItems,
    syncMasterItems,
  };
}
