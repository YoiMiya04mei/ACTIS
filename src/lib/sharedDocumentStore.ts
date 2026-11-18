import { prisma } from "@/lib/prisma";
import {
  ALL_SHARED_STORAGE_KEYS,
  isSharedDocumentKey,
  mergeDocumentCollections,
  hasNonSampleDocuments,
  getSampleIdsForKey,
  parseTimestampMs,
  type DeletedTombstone,
} from "@/lib/sharedDocumentKeys";

export interface SharedActor {
  id?: string | null;
  nama?: string | null;
}

export interface SharedStorageEntryResult<T = unknown> {
  key: string;
  exists: boolean;
  value: T | null;
  version: number;
  isDefaultSeed: boolean;
  deletedIds: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface SharedSyncMetaItem {
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

const MAX_TOMBSTONES = 500;

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseTombstones(raw: string | null | undefined): DeletedTombstone[] {
  const parsed = parseJsonSafe<unknown>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const clean: DeletedTombstone[] = [];
  for (const item of parsed) {
    if (typeof item === "string" && item.trim()) {
      clean.push({ id: item.trim(), deletedAt: new Date(0).toISOString() });
    } else if (
      item &&
      typeof item === "object" &&
      typeof (item as { id?: unknown }).id === "string"
    ) {
      clean.push({
        id: (item as { id: string }).id,
        deletedAt:
          typeof (item as { deletedAt?: unknown }).deletedAt === "string"
            ? (item as { deletedAt: string }).deletedAt
            : new Date().toISOString(),
      });
    }
  }
  return clean.slice(-MAX_TOMBSTONES);
}

function extractTombstoneIdSet(tombstones: DeletedTombstone[]): Set<string> {
  return new Set(tombstones.map((t) => t.id));
}

export async function getSharedStorageEntry<T = unknown>(
  key: string
): Promise<SharedStorageEntryResult<T>> {
  const row = await prisma.sharedDocumentEntry.findUnique({
    where: { key },
  });

  if (!row) {
    return {
      key,
      exists: false,
      value: null,
      version: 0,
      isDefaultSeed: false,
      deletedIds: [],
      updatedBy: null,
      updatedAt: null,
    };
  }

  const parsedValue = parseJsonSafe<T | null>(row.value, null);
  const tombstones = parseTombstones(row.deleted_ids);

  return {
    key: row.key,
    exists: true,
    value: parsedValue,
    version: row.version,
    isDefaultSeed: row.is_default_seed,
    deletedIds: tombstones.map((t) => t.id),
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getAllSharedSyncMeta(): Promise<
  Record<string, SharedSyncMetaItem>
> {
  const rows = await prisma.sharedDocumentEntry.findMany({
    select: {
      key: true,
      version: true,
      is_default_seed: true,
      updated_by: true,
      updated_at: true,
    },
  });

  const meta: Record<string, SharedSyncMetaItem> = {};
  for (const key of ALL_SHARED_STORAGE_KEYS) {
    meta[key] = {
      version: 0,
      isDefaultSeed: false,
      updatedBy: null,
      updatedAt: null,
    };
  }

  for (const row of rows) {
    meta[row.key] = {
      version: row.version,
      isDefaultSeed: row.is_default_seed,
      updatedBy: row.updated_by || null,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  return meta;
}

export async function upsertDocumentItem(
  key: string,
  item: DocRecord,
  actor?: SharedActor
): Promise<SharedStorageEntryResult<DocRecord[]>> {
  if (!isSharedDocumentKey(key)) {
    throw new Error(`Invalid shared document key: ${key}`);
  }
  if (!item || typeof item.id !== "string" || !item.id.trim()) {
    throw new Error("Document item must have a valid id");
  }

  const nowIso = new Date().toISOString();

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.sharedDocumentEntry.findUnique({ where: { key } });
    const currentDocs = existing
      ? parseJsonSafe<DocRecord[]>(existing.value, [])
      : [];
    const safeDocs = Array.isArray(currentDocs) ? currentDocs : [];

    // If explicitly saved/recreated, clear any tombstone for this id
    const tombstones = parseTombstones(existing?.deleted_ids).filter(
      (t) => t.id !== item.id
    );

    const existingDoc = safeDocs.find((d) => d.id === item.id);
    const normalizedItem: DocRecord = {
      ...item,
      createdAt: item.createdAt || existingDoc?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextDocs = [
      normalizedItem,
      ...safeDocs.filter((d) => d && d.id !== item.id),
    ].sort((a, b) => {
      const bTime = parseTimestampMs(b.createdAt || b.updatedAt);
      const aTime = parseTimestampMs(a.createdAt || a.updatedAt);
      return bTime - aTime;
    });

    const serialized = JSON.stringify(nextDocs);
    const serializedTombstones = JSON.stringify(tombstones);

    const saved = existing
      ? await tx.sharedDocumentEntry.update({
          where: { key },
          data: {
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: false,
            version: { increment: 1 },
            updated_by: actor?.nama || null,
            updated_by_id: actor?.id || null,
          },
        })
      : await tx.sharedDocumentEntry.create({
          data: {
            key,
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: false,
            version: 1,
            updated_by: actor?.nama || null,
            updated_by_id: actor?.id || null,
          },
        });

    return {
      key: saved.key,
      exists: true,
      value: nextDocs,
      version: saved.version,
      isDefaultSeed: saved.is_default_seed,
      deletedIds: tombstones.map((t) => t.id),
      updatedBy: saved.updated_by || null,
      updatedAt: saved.updated_at.toISOString(),
    };
  });
}

export async function deleteDocumentItem(
  key: string,
  id: string,
  actor?: SharedActor
): Promise<SharedStorageEntryResult<DocRecord[]> & { deleted: boolean }> {
  if (!isSharedDocumentKey(key)) {
    throw new Error(`Invalid shared document key: ${key}`);
  }
  if (!id || typeof id !== "string") {
    throw new Error("Document id is required");
  }

  const nowIso = new Date().toISOString();

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.sharedDocumentEntry.findUnique({ where: { key } });
    const currentDocs = existing
      ? parseJsonSafe<DocRecord[]>(existing.value, [])
      : [];
    const safeDocs = Array.isArray(currentDocs) ? currentDocs : [];

    const existed = safeDocs.some((d) => d && d.id === id);
    const nextDocs = safeDocs.filter((d) => d && d.id !== id);

    const tombstones = parseTombstones(existing?.deleted_ids).filter(
      (t) => t.id !== id
    );
    tombstones.push({ id, deletedAt: nowIso });
    const trimmedTombstones = tombstones.slice(-MAX_TOMBSTONES);

    const serialized = JSON.stringify(nextDocs);
    const serializedTombstones = JSON.stringify(trimmedTombstones);

    const saved = existing
      ? await tx.sharedDocumentEntry.update({
          where: { key },
          data: {
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: false,
            version: existed ? { increment: 1 } : existing.version,
            updated_by: actor?.nama || existing.updated_by || null,
            updated_by_id: actor?.id || existing.updated_by_id || null,
          },
        })
      : await tx.sharedDocumentEntry.create({
          data: {
            key,
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: false,
            version: 1,
            updated_by: actor?.nama || null,
            updated_by_id: actor?.id || null,
          },
        });

    return {
      key: saved.key,
      exists: true,
      value: nextDocs,
      version: saved.version,
      isDefaultSeed: saved.is_default_seed,
      deletedIds: trimmedTombstones.map((t) => t.id),
      updatedBy: saved.updated_by || null,
      updatedAt: saved.updated_at.toISOString(),
      deleted: existed,
    };
  });
}

export async function mergeDocumentItems(
  key: string,
  incomingItems: DocRecord[],
  opts: { isDefaultSeed?: boolean } = {},
  actor?: SharedActor
): Promise<SharedStorageEntryResult<DocRecord[]>> {
  if (!isSharedDocumentKey(key)) {
    throw new Error(`Invalid shared document key: ${key}`);
  }

  const incomingSafe = Array.isArray(incomingItems)
    ? incomingItems.filter((item) => item && typeof item.id === "string" && item.id)
    : [];

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.sharedDocumentEntry.findUnique({ where: { key } });
    const tombstones = parseTombstones(existing?.deleted_ids);
    const deletedSet = extractTombstoneIdSet(tombstones);

    if (!existing) {
      const cleaned = mergeDocumentCollections<DocRecord>([], incomingSafe, deletedSet);
      const isSeed =
        opts.isDefaultSeed !== undefined
          ? opts.isDefaultSeed
          : !hasNonSampleDocuments(key, cleaned);

      const saved = await tx.sharedDocumentEntry.create({
        data: {
          key,
          value: JSON.stringify(cleaned),
          deleted_ids: "[]",
          is_default_seed: isSeed,
          version: 1,
          updated_by: isSeed ? "System Seed" : actor?.nama || null,
          updated_by_id: isSeed ? null : actor?.id || null,
        },
      });

      return {
        key: saved.key,
        exists: true,
        value: cleaned,
        version: saved.version,
        isDefaultSeed: saved.is_default_seed,
        deletedIds: [],
        updatedBy: saved.updated_by || null,
        updatedAt: saved.updated_at.toISOString(),
      };
    }

    const currentDocs = parseJsonSafe<DocRecord[]>(existing.value, []);
    const safeCurrentDocs = Array.isArray(currentDocs) ? currentDocs : [];

    // Guard: never let a sample-only browser overwrite or clutter an already initialized server store
    const incomingHasRealDocs = hasNonSampleDocuments(key, incomingSafe);
    if (!existing.is_default_seed && !incomingHasRealDocs) {
      return {
        key: existing.key,
        exists: true,
        value: safeCurrentDocs,
        version: existing.version,
        isDefaultSeed: existing.is_default_seed,
        deletedIds: Array.from(deletedSet),
        updatedBy: existing.updated_by || null,
        updatedAt: existing.updated_at.toISOString(),
      };
    }

    const sampleIds = getSampleIdsForKey(key);
    const filteredIncoming = incomingSafe.filter((item) => {
      if (deletedSet.has(item.id)) return false;
      // Only pull sample IDs if not already intentionally seeded/modified without them
      if (sampleIds.has(item.id) && !existing.is_default_seed) {
        return safeCurrentDocs.some((c) => c.id === item.id);
      }
      return true;
    });

    const merged = mergeDocumentCollections<DocRecord>(
      safeCurrentDocs,
      filteredIncoming,
      deletedSet
    );

    const prevSerialized = existing.value;
    const nextSerialized = JSON.stringify(merged);
    const nextIsSeed =
      existing.is_default_seed && opts.isDefaultSeed === true && !incomingHasRealDocs;

    if (prevSerialized === nextSerialized && existing.is_default_seed === nextIsSeed) {
      return {
        key: existing.key,
        exists: true,
        value: safeCurrentDocs,
        version: existing.version,
        isDefaultSeed: existing.is_default_seed,
        deletedIds: Array.from(deletedSet),
        updatedBy: existing.updated_by || null,
        updatedAt: existing.updated_at.toISOString(),
      };
    }

    const saved = await tx.sharedDocumentEntry.update({
      where: { key },
      data: {
        value: nextSerialized,
        is_default_seed: nextIsSeed,
        version: { increment: 1 },
        updated_by: actor?.nama || existing.updated_by || null,
        updated_by_id: actor?.id || existing.updated_by_id || null,
      },
    });

    return {
      key: saved.key,
      exists: true,
      value: merged,
      version: saved.version,
      isDefaultSeed: saved.is_default_seed,
      deletedIds: Array.from(deletedSet),
      updatedBy: saved.updated_by || null,
      updatedAt: saved.updated_at.toISOString(),
    };
  });
}

export async function replaceDocumentCollection(
  key: string,
  docs: DocRecord[],
  opts: { isDefaultSeed?: boolean } = {},
  actor?: SharedActor
): Promise<SharedStorageEntryResult<DocRecord[]>> {
  if (!isSharedDocumentKey(key)) {
    throw new Error(`Invalid shared document key: ${key}`);
  }

  const incomingSafe = Array.isArray(docs)
    ? docs.filter((item) => item && typeof item.id === "string" && item.id)
    : [];

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.sharedDocumentEntry.findUnique({ where: { key } });
    const tombstones = parseTombstones(existing?.deleted_ids);

    if (
      existing &&
      !existing.is_default_seed &&
      opts.isDefaultSeed === true
    ) {
      const currentDocs = parseJsonSafe<DocRecord[]>(existing.value, []);
      return {
        key: existing.key,
        exists: true,
        value: Array.isArray(currentDocs) ? currentDocs : [],
        version: existing.version,
        isDefaultSeed: existing.is_default_seed,
        deletedIds: tombstones.map((t) => t.id),
        updatedBy: existing.updated_by || null,
        updatedAt: existing.updated_at.toISOString(),
      };
    }

    const sortedDocs = [...incomingSafe].sort((a, b) => {
      const bTime = parseTimestampMs(b.createdAt || b.updatedAt);
      const aTime = parseTimestampMs(a.createdAt || a.updatedAt);
      return bTime - aTime;
    });

    const nextIds = new Set(sortedDocs.map((d) => d.id));
    if (existing) {
      const prevDocs = parseJsonSafe<DocRecord[]>(existing.value, []);
      const nowIso = new Date().toISOString();
      if (Array.isArray(prevDocs)) {
        for (const old of prevDocs) {
          if (old?.id && !nextIds.has(old.id)) {
            if (!tombstones.some((t) => t.id === old.id)) {
              tombstones.push({ id: old.id, deletedAt: nowIso });
            }
          }
        }
      }
    }
    const cleanTombstones = tombstones
      .filter((t) => !nextIds.has(t.id))
      .slice(-MAX_TOMBSTONES);

    const serialized = JSON.stringify(sortedDocs);
    const serializedTombstones = JSON.stringify(cleanTombstones);
    const isSeed = Boolean(opts.isDefaultSeed);

    const saved = existing
      ? await tx.sharedDocumentEntry.update({
          where: { key },
          data: {
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: isSeed,
            version: { increment: 1 },
            updated_by: isSeed ? "System Seed" : actor?.nama || null,
            updated_by_id: isSeed ? null : actor?.id || null,
          },
        })
      : await tx.sharedDocumentEntry.create({
          data: {
            key,
            value: serialized,
            deleted_ids: serializedTombstones,
            is_default_seed: isSeed,
            version: 1,
            updated_by: isSeed ? "System Seed" : actor?.nama || null,
            updated_by_id: isSeed ? null : actor?.id || null,
          },
        });

    return {
      key: saved.key,
      exists: true,
      value: sortedDocs,
      version: saved.version,
      isDefaultSeed: saved.is_default_seed,
      deletedIds: cleanTombstones.map((t) => t.id),
      updatedBy: saved.updated_by || null,
      updatedAt: saved.updated_at.toISOString(),
    };
  });
}

export async function saveTemplateValue<T extends Record<string, unknown>>(
  key: string,
  template: T,
  opts: { isDefaultSeed?: boolean; onlyIfUnsetOrSeed?: boolean } = {},
  actor?: SharedActor
): Promise<SharedStorageEntryResult<T> & { overwritten: boolean }> {
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    throw new Error("Template value must be an object");
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.sharedDocumentEntry.findUnique({ where: { key } });

    if (
      existing &&
      opts.onlyIfUnsetOrSeed &&
      !existing.is_default_seed
    ) {
      const currentVal = parseJsonSafe<T | null>(existing.value, null);
      return {
        key: existing.key,
        exists: true,
        value: currentVal,
        version: existing.version,
        isDefaultSeed: existing.is_default_seed,
        deletedIds: [],
        updatedBy: existing.updated_by || null,
        updatedAt: existing.updated_at.toISOString(),
        overwritten: false,
      };
    }

    const nowIso = new Date().toISOString();
    const isSeed = Boolean(opts.isDefaultSeed);
    const normalizedTemplate = {
      ...template,
      updatedAt: isSeed ? (template.updatedAt as string | undefined) : nowIso,
    } as T;

    const serialized = JSON.stringify(normalizedTemplate);

    const saved = existing
      ? await tx.sharedDocumentEntry.update({
          where: { key },
          data: {
            value: serialized,
            is_default_seed: isSeed,
            version: { increment: 1 },
            updated_by: isSeed ? "System Seed" : actor?.nama || null,
            updated_by_id: isSeed ? null : actor?.id || null,
          },
        })
      : await tx.sharedDocumentEntry.create({
          data: {
            key,
            value: serialized,
            deleted_ids: "[]",
            is_default_seed: isSeed,
            version: 1,
            updated_by: isSeed ? "System Seed" : actor?.nama || null,
            updated_by_id: isSeed ? null : actor?.id || null,
          },
        });

    return {
      key: saved.key,
      exists: true,
      value: normalizedTemplate,
      version: saved.version,
      isDefaultSeed: saved.is_default_seed,
      deletedIds: [],
      updatedBy: saved.updated_by || null,
      updatedAt: saved.updated_at.toISOString(),
      overwritten: true,
    };
  });
}
