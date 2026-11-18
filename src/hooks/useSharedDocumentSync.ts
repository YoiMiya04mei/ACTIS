"use client";

import { useEffect, useRef } from "react";
import type { SharedStorageKey } from "@/lib/sharedDocumentKeys";
import { indexedDbStorage, type SyncChangeSource } from "@/services/indexedDbStorage";

export function useSharedDocumentSync(
  watchedKeys: readonly SharedStorageKey[],
  onSync: (changedKeys: SharedStorageKey[], source: SyncChangeSource) => void,
  options?: { enabled?: boolean; pollIntervalMs?: number }
): void {
  const enabled = options?.enabled !== false;
  const pollIntervalMs = options?.pollIntervalMs ?? 4000;

  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const keysSignature = watchedKeys.join(",");

  useEffect(() => {
    if (!enabled || !keysSignature) return;

    const watchedSet = new Set<string>(keysSignature.split(",").filter(Boolean));

    const unsubscribe = indexedDbStorage.subscribe((changedKeys, source) => {
      const relevant = changedKeys.filter((k) => watchedSet.has(k));
      if (relevant.length > 0) {
        onSyncRef.current(relevant, source);
      }
    });

    const stopPolling = indexedDbStorage.startBackgroundPolling(pollIntervalMs);

    return () => {
      unsubscribe();
      stopPolling();
    };
  }, [enabled, keysSignature, pollIntervalMs]);
}
