/**
 * Client-Server Hybrid Storage Service (PostgreSQL Server + Local IndexedDB/localStorage Cache)
 *
 * Keys in `ALL_SHARED_STORAGE_KEYS` (documents & templates) are synchronized with PostgreSQL
 * via `/api/storage/[key]` & `/api/storage/sync-meta`, with safe legacy IndexedDB migration,
 * atomic per-document upsert/delete, and cross-tab / cross-account real-time change events.
 *
 * Non-shared keys (e.g., per-user unsaved drafts `*_active_draft_v1`) remain strictly local
 * to the current browser profile so one user's draft never overwrites another's.
 */

import {
  ALL_SHARED_STORAGE_KEYS,
  getSampleIdsForKey,
  hasNonSampleDocuments,
  isSharedDocumentKey,
  isSharedStorageKey,
  isSharedTemplateKey,
  isTemplateCustomized,
  parseTimestampMs,
  type SharedDocumentKey,
  type SharedStorageKey,
  type SharedTemplateKey,
} from "@/lib/sharedDocumentKeys";

const DB_NAME = "jdp_tools_database_v1";
const STORE_NAME = "keyval_store";
const DB_VERSION = 1;
const MIGRATION_PREFIX = "actis_sync_migrated_v1_";
const BROADCAST_CHANNEL_NAME = "actis_shared_docs_sync";
const BROADCAST_STORAGE_EVENT_KEY = "actis_shared_docs_sync_signal";
const SERVER_BACKOFF_MS = 5000;

export type SyncChangeSource = "local" | "remote";
export type SyncChangeListener = (
  changedKeys: SharedStorageKey[],
  source: SyncChangeSource
) => void;

export interface ServerStorageEntry<T = unknown> {
  key: string;
  exists: boolean;
  value: T | null;
  version: number;
  isDefaultSeed: boolean;
  deletedIds: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ServerSyncMetaItem {
  version: number;
  isDefaultSeed: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

type DocRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

function isLocalBrowser(): boolean {
  return typeof window !== "undefined";
}

function getMigrationFlagKey(key: string): string {
  return `${MIGRATION_PREFIX}${key}`;
}

function hasMigratedLocally(key: string): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(getMigrationFlagKey(key)) === "1";
  } catch {
    return false;
  }
}

function markMigratedLocally(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(getMigrationFlagKey(key), "1");
  } catch {
    // ignore storage quota errors
  }
}

class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private serverBackoffUntil = 0;
  private knownVersions = new Map<string, number>();
  private inflightSyncs = new Map<string, Promise<unknown>>();
  private listeners = new Set<SyncChangeListener>();
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  private crossTabInitialized = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollSubscribersCount = 0;
  private pollInflight: Promise<SharedStorageKey[]> | null = null;

  private ensureCrossTabListeners(): void {
    if (this.crossTabInitialized || !isLocalBrowser()) return;
    this.crossTabInitialized = true;

    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          const payload = event?.data;
          if (
            payload &&
            payload.sender !== this.tabId &&
            Array.isArray(payload.keys) &&
            payload.keys.length > 0
          ) {
            const validKeys = payload.keys.filter((k: unknown) =>
              typeof k === "string" && isSharedStorageKey(k)
            ) as SharedStorageKey[];
            if (validKeys.length > 0) {
              if (payload.versions && typeof payload.versions === "object") {
                for (const k of validKeys) {
                  const v = Number(payload.versions[k]);
                  if (Number.isFinite(v)) {
                    this.knownVersions.set(k, v);
                  }
                }
              }
              this.emitListeners(validKeys, "remote");
            }
          }
        };
      }
    } catch {
      // ignore BroadcastChannel unavailability
    }

    try {
      window.addEventListener("storage", (e) => {
        if (e.key === BROADCAST_STORAGE_EVENT_KEY && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue);
            if (
              payload &&
              payload.sender !== this.tabId &&
              Array.isArray(payload.keys)
            ) {
              const validKeys = payload.keys.filter((k: unknown) =>
                typeof k === "string" && isSharedStorageKey(k)
              ) as SharedStorageKey[];
              if (validKeys.length > 0) {
                this.emitListeners(validKeys, "remote");
              }
            }
          } catch {
            // ignore malformed event payload
          }
        }
      });
    } catch {
      // ignore window listener errors
    }
  }

  private emitListeners(
    keys: SharedStorageKey[],
    source: SyncChangeSource
  ): void {
    if (keys.length === 0) return;
    for (const listener of this.listeners) {
      try {
        listener(keys, source);
      } catch (e) {
        console.warn("SharedDocument sync listener error:", e);
      }
    }
  }

  private broadcastMutation(
    keys: SharedStorageKey[],
    source: SyncChangeSource = "local"
  ): void {
    if (keys.length === 0) return;
    this.ensureCrossTabListeners();
    this.emitListeners(keys, source);

    const versionsObj: Record<string, number> = {};
    for (const k of keys) {
      const v = this.knownVersions.get(k);
      if (v !== undefined) versionsObj[k] = v;
    }

    const msg = {
      sender: this.tabId,
      keys,
      versions: versionsObj,
      ts: Date.now(),
    };

    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // ignore
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(BROADCAST_STORAGE_EVENT_KEY, JSON.stringify(msg));
      }
    } catch {
      // ignore
    }
  }

  subscribe(listener: SyncChangeListener): () => void {
    this.ensureCrossTabListeners();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  startBackgroundPolling(intervalMs = 4000): () => void {
    this.ensureCrossTabListeners();
    this.pollSubscribersCount += 1;

    const triggerPoll = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      this.pollServerSyncMeta().catch(() => {});
    };

    if (!this.pollTimer && isLocalBrowser()) {
      this.pollTimer = setInterval(triggerPoll, intervalMs);
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerPoll();
      }
    };
    const onFocus = () => {
      triggerPoll();
    };

    if (isLocalBrowser()) {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibility);
      // Warm initial known versions silently on mount
      this.pollServerSyncMeta({ suppressEmitOnInitialFill: true }).catch(() => {});
    }

    return () => {
      this.pollSubscribersCount = Math.max(0, this.pollSubscribersCount - 1);
      if (isLocalBrowser()) {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (this.pollSubscribersCount === 0 && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  getKnownVersion(key: string): number | undefined {
    return this.knownVersions.get(key);
  }

  async pollServerSyncMeta(
    opts: { suppressEmitOnInitialFill?: boolean } = {}
  ): Promise<SharedStorageKey[]> {
    if (!isLocalBrowser() || typeof fetch === "undefined") return [];
    if (Date.now() < this.serverBackoffUntil) return [];

    if (this.pollInflight) return this.pollInflight;

    const run = async (): Promise<SharedStorageKey[]> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch("/api/storage/sync-meta", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          return [];
        }
        if (!res.ok) {
          if (res.status >= 500) {
            this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
          }
          return [];
        }

        const json = await res.json();
        const versions = json?.versions as
          | Record<string, ServerSyncMetaItem>
          | undefined;
        if (!versions || typeof versions !== "object") return [];

        const changedKeys: SharedStorageKey[] = [];
        for (const key of ALL_SHARED_STORAGE_KEYS) {
          const serverMeta = versions[key];
          if (!serverMeta || typeof serverMeta.version !== "number") continue;

          const prevKnown = this.knownVersions.get(key);
          this.knownVersions.set(key, serverMeta.version);

          if (prevKnown === undefined) {
            // Only treat as change if caller is actively polling updates (not initial warm) AND server > 0
            if (!opts.suppressEmitOnInitialFill && serverMeta.version > 0) {
              changedKeys.push(key);
            }
          } else if (serverMeta.version !== prevKnown) {
            changedKeys.push(key);
          }
        }

        if (changedKeys.length > 0) {
          this.emitListeners(changedKeys, "remote");
        }
        return changedKeys;
      } catch {
        clearTimeout(timeoutId);
        this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
        return [];
      } finally {
        this.pollInflight = null;
      }
    };

    this.pollInflight = run();
    return this.pollInflight;
  }

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not supported in this browser."));
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
          reject(
            (event.target as IDBOpenDBRequest).error ||
              new Error("Failed to open IndexedDB")
          );
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  async getLocalItem<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const val = await new Promise<T | null>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(key);

          request.onsuccess = () => {
            resolve(request.result !== undefined ? (request.result as T) : null);
          };
          request.onerror = () => {
            reject(request.error);
          };
        } catch (err) {
          reject(err);
        }
      });

      if (val !== null) return val;
    } catch {
      // Fallback to localStorage below
    }

    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {
      // ignore parse failure
    }
    return null;
  }

  async setLocalItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(value, key);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch {
      // fallback below
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore quota exceeded for large base64 images in localStorage
    }
  }

  async removeLocalItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(key);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch {
      // ignore
    }

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }

  private async fetchServerEntry<T>(
    key: SharedStorageKey
  ): Promise<{ ok: true; entry: ServerStorageEntry<T> } | { ok: false; status: number; error: string }> {
    if (!isLocalBrowser() || typeof fetch === "undefined") {
      return { ok: false, status: 0, error: "Client environment only" };
    }
    if (Date.now() < this.serverBackoffUntil) {
      return { ok: false, status: 503, error: "Temporary backoff" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status >= 500) {
          this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
        }
        const errJson = await res.json().catch(() => ({}));
        return {
          ok: false,
          status: res.status,
          error: errJson?.error || `HTTP ${res.status}`,
        };
      }

      const json = (await res.json()) as ServerStorageEntry<T>;
      if (typeof json?.version === "number") {
        this.knownVersions.set(key, json.version);
      }
      return { ok: true, entry: json };
    } catch (err) {
      clearTimeout(timeoutId);
      this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  private async postServerMutation<T>(
    key: SharedStorageKey,
    payload: Record<string, unknown>
  ): Promise<{ ok: true; entry: ServerStorageEntry<T> } | { ok: false; status: number; error: string }> {
    if (!isLocalBrowser() || typeof fetch === "undefined") {
      return { ok: false, status: 0, error: "Client environment only" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status >= 500) {
          this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
        }
        return {
          ok: false,
          status: res.status,
          error: json?.error || `HTTP ${res.status}`,
        };
      }

      const entry = json as ServerStorageEntry<T>;
      if (typeof entry?.version === "number") {
        this.knownVersions.set(key, entry.version);
      }
      return { ok: true, entry };
    } catch (err) {
      clearTimeout(timeoutId);
      this.serverBackoffUntil = Date.now() + SERVER_BACKOFF_MS;
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  /**
   * Synchronizes a shared document array (`jdp_*_documents_v1`) with PostgreSQL,
   * safely merging any unmigrated local IndexedDB user-created documents without
   * allowing default `[SAMPLE_*]` records to resurrect deleted docs or clobber server data.
   */
  async ensureSharedDocuments<T extends DocRecord>(
    key: SharedDocumentKey,
    defaultSamples: T[]
  ): Promise<T[]> {
    const existingInflight = this.inflightSyncs.get(key) as
      | Promise<T[]>
      | undefined;
    if (existingInflight) return existingInflight;

    const run = async (): Promise<T[]> => {
      const localDocs = await this.getLocalItem<T[]>(key);
      const serverResp = await this.fetchServerEntry<T[]>(key);

      if (!serverResp.ok) {
        if (localDocs && Array.isArray(localDocs) && localDocs.length > 0) {
          return localDocs;
        }
        return defaultSamples;
      }

      const server = serverResp.entry;

      // Case 1: Server does not have any record yet for this key
      if (!server.exists) {
        const localHasReal =
          localDocs &&
          Array.isArray(localDocs) &&
          hasNonSampleDocuments(key, localDocs);

        const seedPayload =
          localDocs && Array.isArray(localDocs) && localDocs.length > 0
            ? localDocs
            : defaultSamples;

        const mergedResp = await this.postServerMutation<T[]>(key, {
          action: "merge",
          items: seedPayload,
          isDefaultSeed: !localHasReal,
        });

        if (mergedResp.ok && Array.isArray(mergedResp.entry.value)) {
          await this.setLocalItem(key, mergedResp.entry.value);
          if (localHasReal) {
            markMigratedLocally(key);
            this.broadcastMutation([key], "local");
          }
          return mergedResp.entry.value;
        }

        return seedPayload;
      }

      const serverDocs = Array.isArray(server.value) ? server.value : [];
      const deletedSet = new Set(server.deletedIds || []);
      const migrated = hasMigratedLocally(key);

      // Case 2: Browser has not migrated local IndexedDB yet -> merge ONLY non-sample, non-deleted local docs
      if (!migrated && localDocs && Array.isArray(localDocs) && localDocs.length > 0) {
        const sampleIds = getSampleIdsForKey(key);
        const serverById = new Map(serverDocs.map((d) => [d.id, d]));

        const unmigratedRealDocs = localDocs.filter((doc) => {
          if (!doc?.id || deletedSet.has(doc.id)) return false;
          if (sampleIds.has(doc.id)) return false;
          const existingServer = serverById.get(doc.id);
          if (!existingServer) return true;
          return (
            parseTimestampMs(doc.updatedAt || doc.createdAt) >
            parseTimestampMs(existingServer.updatedAt || existingServer.createdAt)
          );
        });

        if (unmigratedRealDocs.length > 0) {
          const mergeResp = await this.postServerMutation<T[]>(key, {
            action: "merge",
            items: unmigratedRealDocs,
            isDefaultSeed: false,
          });
          if (mergeResp.ok && Array.isArray(mergeResp.entry.value)) {
            await this.setLocalItem(key, mergeResp.entry.value);
            markMigratedLocally(key);
            this.broadcastMutation([key], "local");
            return mergeResp.entry.value;
          }
        }
      }

      markMigratedLocally(key);
      await this.setLocalItem(key, serverDocs);
      return serverDocs;
    };

    const promise = run().finally(() => {
      this.inflightSyncs.delete(key);
    });
    this.inflightSyncs.set(key, promise);
    return promise;
  }

  /**
   * Synchronizes a shared template (`jdp_*_template_v1`) with PostgreSQL.
   * Never lets an unmodified default template overwrite customized server templates,
   * and uploads an admin's unmigrated customized IndexedDB template once if server is still unset/seed.
   */
  async ensureSharedTemplate<T extends object>(
    key: SharedTemplateKey,
    defaultTemplate: T
  ): Promise<T> {
    const existingInflight = this.inflightSyncs.get(key) as
      | Promise<T>
      | undefined;
    if (existingInflight) return existingInflight;

    const run = async (): Promise<T> => {
      const localTemplate = await this.getLocalItem<T>(key);
      const serverResp = await this.fetchServerEntry<T>(key);

      if (!serverResp.ok) {
        return localTemplate
          ? { ...defaultTemplate, ...localTemplate }
          : { ...defaultTemplate };
      }

      const server = serverResp.entry;

      if (!server.exists || server.isDefaultSeed) {
        const localCustomized =
          localTemplate !== null &&
          isTemplateCustomized(localTemplate, defaultTemplate);

        if (localCustomized && !hasMigratedLocally(key)) {
          const uploadResp = await this.postServerMutation<T>(key, {
            action: "set_template",
            value: { ...defaultTemplate, ...localTemplate },
            isDefaultSeed: false,
            onlyIfUnsetOrSeed: true,
          });

          if (uploadResp.ok && uploadResp.entry.value) {
            const finalTemplate = {
              ...defaultTemplate,
              ...uploadResp.entry.value,
            };
            await this.setLocalItem(key, finalTemplate);
            markMigratedLocally(key);
            if ((uploadResp.entry as { overwritten?: boolean }).overwritten !== false) {
              this.broadcastMutation([key], "local");
            }
            return finalTemplate;
          }
          // Non-admin (403) stays unmigrated so an admin session can later promote the template
        }

        const mergedFallback = server.value
          ? { ...defaultTemplate, ...server.value }
          : { ...defaultTemplate };
        return mergedFallback;
      }

      // Server has authoritative non-seed template
      const authoritative = { ...defaultTemplate, ...(server.value || {}) };
      await this.setLocalItem(key, authoritative);
      markMigratedLocally(key);
      return authoritative;
    };

    const promise = run().finally(() => {
      this.inflightSyncs.delete(key);
    });
    this.inflightSyncs.set(key, promise);
    return promise;
  }

  /**
   * Atomically creates or updates a single shared document in PostgreSQL.
   */
  async upsertSharedDocument<T extends DocRecord>(
    key: SharedDocumentKey,
    item: T
  ): Promise<T[]> {
    const resp = await this.postServerMutation<T[]>(key, {
      action: "upsert_item",
      item,
    });

    if (!resp.ok) {
      throw new Error(resp.error || "Gagal menyimpan dokumen ke server.");
    }

    const updated = Array.isArray(resp.entry.value) ? resp.entry.value : [];
    await this.setLocalItem(key, updated);
    markMigratedLocally(key);
    this.broadcastMutation([key], "local");
    return updated;
  }

  /**
   * Atomically deletes a shared document by ID from PostgreSQL and records tombstone.
   */
  async deleteSharedDocument<T extends DocRecord>(
    key: SharedDocumentKey,
    id: string
  ): Promise<{ deleted: boolean; data: T[] }> {
    const resp = await this.postServerMutation<T[]>(key, {
      action: "delete_item",
      id,
    });

    if (!resp.ok) {
      throw new Error(resp.error || "Gagal menghapus dokumen dari server.");
    }

    const updated = Array.isArray(resp.entry.value) ? resp.entry.value : [];
    await this.setLocalItem(key, updated);
    markMigratedLocally(key);
    this.broadcastMutation([key], "local");
    return {
      deleted: Boolean((resp.entry as { deleted?: boolean }).deleted ?? true),
      data: updated,
    };
  }

  /**
   * Saves or resets a shared template on PostgreSQL (Administrator only).
   */
  async saveSharedTemplate<T extends object>(
    key: SharedTemplateKey,
    template: T,
    defaultTemplate: T
  ): Promise<T> {
    const resp = await this.postServerMutation<T>(key, {
      action: "set_template",
      value: template,
      isDefaultSeed: false,
      onlyIfUnsetOrSeed: false,
    });

    if (!resp.ok) {
      throw new Error(resp.error || "Gagal menyimpan template ke server.");
    }

    const saved = { ...defaultTemplate, ...(resp.entry.value || template) };
    await this.setLocalItem(key, saved);
    markMigratedLocally(key);
    this.broadcastMutation([key], "local");
    return saved;
  }

  // Generic getItem / setItem / removeItem preserved for backwards compatibility
  async getItem<T>(key: string): Promise<T | null> {
    if (isSharedStorageKey(key) && isLocalBrowser()) {
      const serverResp = await this.fetchServerEntry<T>(key);
      if (serverResp.ok && serverResp.entry.exists && serverResp.entry.value !== null) {
        await this.setLocalItem(key, serverResp.entry.value);
        return serverResp.entry.value;
      }
    }
    return this.getLocalItem<T>(key);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    if (isSharedDocumentKey(key) && Array.isArray(value) && isLocalBrowser()) {
      const resp = await this.postServerMutation<T>(key, { value });
      if (!resp.ok) {
        throw new Error(resp.error || "Gagal menyimpan data dokumen ke server.");
      }
      await this.setLocalItem(key, resp.entry.value ?? value);
      markMigratedLocally(key);
      this.broadcastMutation([key], "local");
      return;
    }

    if (
      isSharedTemplateKey(key) &&
      value &&
      typeof value === "object" &&
      isLocalBrowser()
    ) {
      const resp = await this.postServerMutation<T>(key, {
        action: "set_template",
        value,
        isDefaultSeed: false,
      });
      if (!resp.ok) {
        throw new Error(resp.error || "Gagal menyimpan template ke server.");
      }
      await this.setLocalItem(key, resp.entry.value ?? value);
      markMigratedLocally(key);
      this.broadcastMutation([key], "local");
      return;
    }

    await this.setLocalItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (isSharedStorageKey(key) && isLocalBrowser()) {
      try {
        await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          method: "DELETE",
          cache: "no-store",
        });
        this.broadcastMutation([key], "local");
      } catch {
        // ignore network failure on remove
      }
    }
    await this.removeLocalItem(key);
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
