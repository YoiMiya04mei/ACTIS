export const SHARED_DOCUMENT_KEYS = [
  "jdp_rfo_documents_v1",
  "jdp_surat_tugas_documents_v1",
  "jdp_berita_acara_documents_v1",
  "jdp_permit_barang_documents_v1",
  "jdp_bank_payment_voucher_documents_v1",
] as const;

export const SHARED_TEMPLATE_KEYS = [
  "jdp_rfo_template_v1",
  "jdp_surat_tugas_template_v1",
  "jdp_berita_acara_template_v1",
  "jdp_permit_barang_template_v1",
] as const;

export type SharedDocumentKey = (typeof SHARED_DOCUMENT_KEYS)[number];
export type SharedTemplateKey = (typeof SHARED_TEMPLATE_KEYS)[number];
export type SharedStorageKey = SharedDocumentKey | SharedTemplateKey;

export const ALL_SHARED_STORAGE_KEYS: readonly SharedStorageKey[] = [
  ...SHARED_DOCUMENT_KEYS,
  ...SHARED_TEMPLATE_KEYS,
];

export const SAMPLE_DOC_IDS_BY_KEY: Record<SharedDocumentKey, readonly string[]> = {
  jdp_rfo_documents_v1: ["RFO-20261011-001"],
  jdp_surat_tugas_documents_v1: ["ST-20260923-120"],
  jdp_berita_acara_documents_v1: ["BA-20261005-121"],
  jdp_permit_barang_documents_v1: ["PM-20251209-001"],
  jdp_bank_payment_voucher_documents_v1: ["BPV-20260917-001"],
};

const SHARED_DOC_KEY_SET = new Set<string>(SHARED_DOCUMENT_KEYS);
const SHARED_TEMPLATE_KEY_SET = new Set<string>(SHARED_TEMPLATE_KEYS);
const ALL_SHARED_KEY_SET = new Set<string>(ALL_SHARED_STORAGE_KEYS);

export function isSharedDocumentKey(key: string): key is SharedDocumentKey {
  return SHARED_DOC_KEY_SET.has(key);
}

export function isSharedTemplateKey(key: string): key is SharedTemplateKey {
  return SHARED_TEMPLATE_KEY_SET.has(key);
}

export function isSharedStorageKey(key: string): key is SharedStorageKey {
  return ALL_SHARED_KEY_SET.has(key);
}

export function getSampleIdsForKey(key: string): Set<string> {
  if (!isSharedDocumentKey(key)) return new Set();
  return new Set(SAMPLE_DOC_IDS_BY_KEY[key]);
}

export function hasNonSampleDocuments<T extends { id?: string }>(
  key: string,
  docs: T[] | null | undefined
): boolean {
  if (!Array.isArray(docs) || docs.length === 0) return false;
  const sampleIds = getSampleIdsForKey(key);
  return docs.some((doc) => Boolean(doc?.id) && !sampleIds.has(String(doc.id)));
}

export interface DeletedTombstone {
  id: string;
  deletedAt: string;
}

export function parseTimestampMs(iso?: string | null): number {
  if (!iso || typeof iso !== "string") return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function mergeDocumentCollections<
  T extends { id: string; createdAt?: string; updatedAt?: string }
>(
  serverDocs: T[],
  incomingDocs: T[],
  deletedIds: Iterable<string> = []
): T[] {
  const deletedSet = new Set<string>(deletedIds);
  const byId = new Map<string, T>();

  for (const item of serverDocs) {
    if (!item || typeof item.id !== "string" || !item.id) continue;
    if (deletedSet.has(item.id)) continue;
    byId.set(item.id, item);
  }

  for (const item of incomingDocs) {
    if (!item || typeof item.id !== "string" || !item.id) continue;
    if (deletedSet.has(item.id)) continue;

    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }

    const incomingTime = parseTimestampMs(item.updatedAt || item.createdAt);
    const existingTime = parseTimestampMs(existing.updatedAt || existing.createdAt);
    if (incomingTime > existingTime) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const bTime = parseTimestampMs(b.createdAt || b.updatedAt);
    const aTime = parseTimestampMs(a.createdAt || a.updatedAt);
    return bTime - aTime;
  });
}

function normalizeValueForCompare(val: unknown): unknown {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return val;
  if (Array.isArray(val)) return val.map(normalizeValueForCompare);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      if (k === "updatedAt" || k === "createdAt") continue;
      sorted[k] = normalizeValueForCompare(obj[k]);
    }
    return sorted;
  }
  return val;
}

export function isTemplateCustomized<T extends object>(
  current: T | null | undefined,
  defaultTemplate: T
): boolean {
  if (!current || typeof current !== "object") return false;
  const mergedCurrent = { ...defaultTemplate, ...current };
  return (
    JSON.stringify(normalizeValueForCompare(mergedCurrent)) !==
    JSON.stringify(normalizeValueForCompare(defaultTemplate))
  );
}
