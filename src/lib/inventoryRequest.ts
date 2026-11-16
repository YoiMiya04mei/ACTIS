export const WORK_TYPE_OPTIONS = [
  "Pemasangan",
  "Perbaikan",
  "Backbone",
  "Lainnya",
] as const;

export type WorkTypeOption = (typeof WORK_TYPE_OPTIONS)[number];

export const PICKUP_LOCATION_OPTIONS = [
  "Gudang Pusat",
  "Gudang Bandung",
  "Gudang Gekbrong",
] as const;

export type PickupLocationOption = (typeof PICKUP_LOCATION_OPTIONS)[number];

export const INVENTORY_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type InventoryRequestStatus = (typeof INVENTORY_REQUEST_STATUSES)[number];

export interface PublicInventoryRequestItemInput {
  item_id: string;
  quantity: number | string;
  notes?: string | null;
}

export interface PublicInventoryRequestPayload {
  pic_name: string;
  pic_phone?: string | null;
  request_date: string;
  work_types: string[] | string;
  work_type_other?: string | null;
  pickup_location: string;
  notes?: string | null;
  items: PublicInventoryRequestItemInput[];
  /** Anti-spam honeypot field — must stay empty for legitimate requests. */
  company_website?: string | null;
}

export interface ValidatedPublicInventoryRequestItem {
  item_id: string;
  quantity: number;
  notes: string | null;
}

export interface ValidatedPublicInventoryRequest {
  pic_name: string;
  pic_phone: string | null;
  request_date: Date;
  request_date_iso: string;
  work_types: WorkTypeOption[];
  work_type_other: string | null;
  pickup_location: PickupLocationOption;
  notes: string | null;
  items: ValidatedPublicInventoryRequestItem[];
}

const WORK_TYPE_LOOKUP = new Map<string, WorkTypeOption>(
  WORK_TYPE_OPTIONS.map((opt) => [opt.toLowerCase(), opt])
);

const PICKUP_LOCATION_LOOKUP = new Map<string, PickupLocationOption>(
  PICKUP_LOCATION_OPTIONS.map((opt) => [opt.toLowerCase(), opt])
);

export function parseWorkTypes(raw: unknown): WorkTypeOption[] {
  let candidates: unknown[] = [];

  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          candidates = parsed;
        }
      } catch {
        candidates = trimmed.split(",");
      }
    } else {
      candidates = trimmed.split(",");
    }
  }

  const unique = new Set<WorkTypeOption>();
  for (const entry of candidates) {
    if (typeof entry !== "string") continue;
    const matched = WORK_TYPE_LOOKUP.get(entry.trim().toLowerCase());
    if (matched) unique.add(matched);
  }

  return WORK_TYPE_OPTIONS.filter((opt) => unique.has(opt));
}

export function normalizePickupLocation(raw: unknown): PickupLocationOption | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return PICKUP_LOCATION_LOOKUP.get(trimmed.toLowerCase()) || null;
}

export function formatWorkTypeLabel(
  workTypesRaw: unknown,
  workTypeOther?: string | null
): string {
  const list = parseWorkTypes(workTypesRaw);
  const customDetail = typeof workTypeOther === "string" ? workTypeOther.trim() : "";

  if (list.length === 0) {
    return customDetail || "-";
  }

  return list
    .map((wt) => {
      if (wt === "Lainnya" && customDetail) {
        return `Lainnya (${customDetail})`;
      }
      return wt;
    })
    .join(", ");
}

export function buildStockOutNotesFromRequest(req: {
  request_number: string;
  pic_name: string;
  request_date: string | Date;
  work_types: unknown;
  work_type_other?: string | null;
  pickup_location: string;
  notes?: string | null;
}): string {
  const workLabel = formatWorkTypeLabel(req.work_types, req.work_type_other);
  const parts = [
    `[Request ${req.request_number}]`,
    `Jenis Pekerjaan: ${workLabel}`,
    `Lokasi Ambil: ${req.pickup_location}`,
  ];
  const extra = typeof req.notes === "string" ? req.notes.trim() : "";
  if (extra) {
    parts.push(`Catatan Request: ${extra}`);
  }
  return parts.join(" | ");
}

export type ValidationResult =
  | { ok: true; data: ValidatedPublicInventoryRequest }
  | { ok: false; error: string; field?: string; isSpam?: boolean };

export function validatePublicInventoryRequestInput(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Payload request tidak valid." };
  }

  const input = payload as Record<string, unknown>;

  if (typeof input.company_website === "string" && input.company_website.trim().length > 0) {
    return {
      ok: false,
      error: "Permintaan tidak dapat diproses.",
      isSpam: true,
    };
  }

  const picName = typeof input.pic_name === "string" ? input.pic_name.trim() : "";
  if (picName.length < 2) {
    return {
      ok: false,
      field: "pic_name",
      error: "Nama PIC Penerima wajib diisi (minimal 2 karakter).",
    };
  }
  if (picName.length > 120) {
    return {
      ok: false,
      field: "pic_name",
      error: "Nama PIC Penerima maksimal 120 karakter.",
    };
  }

  const picPhoneRaw = typeof input.pic_phone === "string" ? input.pic_phone.trim() : "";
  if (picPhoneRaw.length > 40) {
    return {
      ok: false,
      field: "pic_phone",
      error: "Nomor kontak PIC maksimal 40 karakter.",
    };
  }

  const requestDateRaw = typeof input.request_date === "string" ? input.request_date.trim() : "";
  if (!requestDateRaw) {
    return {
      ok: false,
      field: "request_date",
      error: "Tanggal Request wajib diisi.",
    };
  }
  const parsedDate = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(requestDateRaw)
      ? `${requestDateRaw}T00:00:00.000+07:00`
      : requestDateRaw
  );
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      ok: false,
      field: "request_date",
      error: "Format Tanggal Request tidak valid.",
    };
  }

  const workTypes = parseWorkTypes(input.work_types ?? input.work_type);
  if (workTypes.length === 0) {
    return {
      ok: false,
      field: "work_types",
      error: "Pilih 1 Jenis Pekerjaan (Pemasangan, Perbaikan, Backbone, atau Lainnya).",
    };
  }
  if (workTypes.length > 1) {
    return {
      ok: false,
      field: "work_types",
      error: "Jenis Pekerjaan tidak boleh lebih dari satu. Pilih tepat 1 jenis pekerjaan.",
    };
  }

  const workTypeOtherRaw =
    typeof input.work_type_other === "string" ? input.work_type_other.trim() : "";
  if (workTypeOtherRaw.length > 150) {
    return {
      ok: false,
      field: "work_type_other",
      error: "Keterangan Jenis Pekerjaan Lainnya maksimal 150 karakter.",
    };
  }
  const workTypeOther = workTypes.includes("Lainnya") && workTypeOtherRaw ? workTypeOtherRaw : null;

  const pickupLocation = normalizePickupLocation(input.pickup_location);
  if (!pickupLocation) {
    return {
      ok: false,
      field: "pickup_location",
      error: "Lokasi Pengambilan wajib dipilih (Gudang Pusat, Gudang Bandung, atau Gudang Gekbrong).",
    };
  }

  const notesRaw = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notesRaw.length > 1000) {
    return {
      ok: false,
      field: "notes",
      error: "Catatan tambahan maksimal 1000 karakter.",
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      field: "items",
      error: "Tambahkan minimal 1 barang yang direquest.",
    };
  }

  const mergedByItemId = new Map<string, ValidatedPublicInventoryRequestItem>();

  for (let i = 0; i < input.items.length; i++) {
    const rawRow = input.items[i];
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
      return {
        ok: false,
        field: "items",
        error: `Baris barang ke-${i + 1} tidak valid.`,
      };
    }

    const row = rawRow as Record<string, unknown>;
    const itemId = typeof row.item_id === "string" ? row.item_id.trim() : "";
    if (!itemId) {
      return {
        ok: false,
        field: "items",
        error: `Pilih barang pada baris ke-${i + 1}.`,
      };
    }

    const qtyNum = Number(row.quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return {
        ok: false,
        field: "items",
        error: `Kuantitas barang pada baris ke-${i + 1} harus lebih besar dari 0.`,
      };
    }
    if (qtyNum > 100000) {
      return {
        ok: false,
        field: "items",
        error: `Kuantitas barang pada baris ke-${i + 1} melebihi batas maksimum.`,
      };
    }

    const itemNotesRaw = typeof row.notes === "string" ? row.notes.trim() : "";
    if (itemNotesRaw.length > 300) {
      return {
        ok: false,
        field: "items",
        error: `Catatan barang baris ke-${i + 1} maksimal 300 karakter.`,
      };
    }

    const existing = mergedByItemId.get(itemId);
    if (existing) {
      existing.quantity = Number((existing.quantity + qtyNum).toFixed(2));
      if (itemNotesRaw) {
        existing.notes = existing.notes ? `${existing.notes}; ${itemNotesRaw}` : itemNotesRaw;
      }
    } else {
      mergedByItemId.set(itemId, {
        item_id: itemId,
        quantity: Number(qtyNum.toFixed(2)),
        notes: itemNotesRaw || null,
      });
    }
  }

  return {
    ok: true,
    data: {
      pic_name: picName,
      pic_phone: picPhoneRaw || null,
      request_date: parsedDate,
      request_date_iso: parsedDate.toISOString(),
      work_types: workTypes,
      work_type_other: workTypeOther,
      pickup_location: pickupLocation,
      notes: notesRaw || null,
      items: Array.from(mergedByItemId.values()),
    },
  };
}
