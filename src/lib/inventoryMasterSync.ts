export const INVENTORY_MASTER_CHANNEL = "actis-inventory-master";
export const INVENTORY_MASTER_STORAGE_KEY = "actis_inventory_master_updated_at";
export const INVENTORY_MASTER_EVENT = "actis:inventory-master-updated";

export type MasterInventoryChangeReason = "create" | "update" | "delete" | "import";

/**
 * Notifies same-tab and cross-tab inventory pages that Master Barang changed
 * (created, updated, imported, deactivated, or deleted) so selectors refresh immediately.
 */
export function notifyMasterInventoryChanged(reason: MasterInventoryChangeReason = "update"): void {
  if (typeof window === "undefined") return;

  const payload = { reason, at: Date.now() };

  try {
    window.dispatchEvent(new CustomEvent(INVENTORY_MASTER_EVENT, { detail: payload }));
  } catch {
    // ignore event dispatch errors in constrained environments
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(INVENTORY_MASTER_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // ignore BroadcastChannel failures
  }

  try {
    window.localStorage.setItem(INVENTORY_MASTER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota / private mode failures
  }
}

/**
 * Fetches all currently active items from Master Barang bypassing HTTP caches.
 * Returns null if the request fails or returns an invalid payload so callers
 * can avoid wiping existing UI state on transient network glitches.
 */
export async function fetchActiveMasterItems<T>(): Promise<T[] | null> {
  try {
    const res = await fetch(`/api/inventory/items?is_active=true&all=true&_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.success && Array.isArray(json.data)) {
      return json.data as T[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Subscribes to realtime Master Barang changes across same-tab actions, cross-tab broadcasts,
 * window focus/visibility changes, and visible-tab background polling.
 */
export function subscribeMasterInventorySync(
  onRefresh: () => void,
  pollIntervalMs = 8000
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(INVENTORY_MASTER_CHANNEL);
      channel.onmessage = () => onRefresh();
    }
  } catch {
    channel = null;
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === INVENTORY_MASTER_STORAGE_KEY) {
      onRefresh();
    }
  };

  const handleCustomEvent = () => onRefresh();
  const handleFocus = () => onRefresh();
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      onRefresh();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(INVENTORY_MASTER_EVENT, handleCustomEvent);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  const timer =
    pollIntervalMs > 0
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") {
            onRefresh();
          }
        }, pollIntervalMs)
      : null;

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INVENTORY_MASTER_EVENT, handleCustomEvent);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore close errors
      }
    }
    if (timer !== null) {
      window.clearInterval(timer);
    }
  };
}

/**
 * Clears any selected row whose item_id no longer exists in active Master Barang.
 * Returns the original array reference unchanged when no stale selections exist.
 */
export function pruneRemovedMasterItemRows<TRow extends { item_id: string }>(
  rows: TRow[],
  activeItems: ReadonlyArray<{ id: string }>,
  resetRow: (row: TRow) => TRow
): { nextRows: TRow[]; removedCount: number } {
  const validIds = new Set(activeItems.map((item) => item.id));
  let removedCount = 0;

  const nextRows = rows.map((row) => {
    if (row.item_id && !validIds.has(row.item_id)) {
      removedCount += 1;
      return resetRow(row);
    }
    return row;
  });

  return {
    nextRows: removedCount > 0 ? nextRows : rows,
    removedCount,
  };
}
