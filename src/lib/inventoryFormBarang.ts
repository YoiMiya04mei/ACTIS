import { computeRemainingSerialsForDetail } from "@/lib/inventoryClientFinish";
import {
  parseWorkTypes,
  WORK_TYPE_OPTIONS,
  type WorkTypeOption,
} from "@/lib/inventoryRequest";

export const DEFAULT_FORM_BARANG_COMPANY = {
  name: "PT JEMBATAN DATA PANGRANGO",
  addressLine:
    "Jl. Pabuaran No.51, Kec. Warudoyong, Kota Sukabumi, Jawa Barat 43131 Telp : +62 895-3182-5259",
  email: "customerservice@jembatandata.com",
  website: "Sukabuminetwork.net",
} as const;

export const DEFAULT_FORM_BARANG_NOTES = [
  "Setiap pengeluaran barang wajib menggunakan nomor surat request.",
  "Barang yang dikeluarkan harus dicatat sesuai jumlah aktual.",
  "Barang terpakai wajib dicatat berdasarkan pekerjaan, client, dan lokasi penggunaannya.",
  "Barang yang tidak terpakai wajib dikembalikan ke inventory dan dicatat pada bagian C.",
  "Setiap transaksi harus dapat ditelusuri berdasarkan nomor transaksi dan nomor surat.",
] as const;

export const FORM_BARANG_MIN_TABLE_ROWS = 8;

export interface FormBarangRequestInfo {
  namaTim: string;
  tanggalRequest: string;
  workTypes: WorkTypeOption[];
  workTypeOther: string;
  lokasiPengembalian: string;
}

export interface FormBarangKeluarRow {
  no: number;
  transactionNumber: string;
  itemName: string;
  snBarang: string;
  quantity: string;
}

export interface FormBarangTerpakaiRow {
  no: number;
  transactionNumber: string;
  itemName: string;
  snBarang: string;
  quantityUsed: string;
  clientName: string;
  location: string;
}

export interface FormBarangKembaliRow {
  no: number;
  transactionNumber: string;
  itemName: string;
  snBarang: string;
  quantityReturned: string;
  condition: string;
  notes: string;
  isPendingRemaining?: boolean;
}

export interface FormBarangApprovalInfo {
  pemohonName: string;
  pengelolaName: string;
  penerimaName: string;
}

export interface FormBarangWorkflowSummary {
  sourceType: "transaction" | "request" | "blank";
  sourceId: string | null;
  transactionNumber: string | null;
  transactionStatus: string | null;
  requestNumber: string | null;
  requestStatus: string | null;
  warehouseOfficer: string | null;
  totalOutQty: number;
  totalUsedQty: number;
  totalReturnedQty: number;
  totalRemainingQty: number;
  clientCount: number;
  returnCount: number;
}

export interface FormBarangDocumentData {
  requestInfo: FormBarangRequestInfo;
  barangKeluar: FormBarangKeluarRow[];
  barangTerpakai: FormBarangTerpakaiRow[];
  barangKembali: FormBarangKembaliRow[];
  pendingRemainingRows: FormBarangKembaliRow[];
  approval: FormBarangApprovalInfo;
  summary: FormBarangWorkflowSummary;
}

export interface FormBarangSourceListItem {
  sourceType: "transaction" | "request";
  id: string;
  request_id: string | null;
  out_transaction_id: string | null;
  request_number: string | null;
  request_status: string | null;
  transaction_number: string | null;
  transaction_status: string | null;
  pic_name: string;
  location: string;
  date_iso: string;
  work_type_label: string;
  items_count: number;
  used_count: number;
  returns_count: number;
  total_out_qty: number;
  total_used_qty: number;
  total_returned_qty: number;
  total_remaining_qty: number;
}

export interface FormBarangPageSlice {
  pageNumber: number;
  kind: "FORM_BARANG" | "FORM_PENGEMBALIAN";
  title: string;
  includeRequestInfo: boolean;
  keluarHeaderVisible: boolean;
  keluarContinuation: boolean;
  keluarRows: Array<FormBarangKeluarRow | null>;
  terpakaiHeaderVisible: boolean;
  terpakaiContinuation: boolean;
  terpakaiRows: Array<FormBarangTerpakaiRow | null>;
  kembaliHeaderVisible: boolean;
  kembaliContinuation: boolean;
  kembaliRows: Array<FormBarangKembaliRow | null>;
  includeApprovalAndNotes: boolean;
}

export function formatFormBarangQty(val: unknown): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return "0";
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, "");
}

export function formatFormBarangDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatReturnConditionLabel(condition: string | null | undefined): string {
  const normalized = String(condition || "").trim().toUpperCase();
  switch (normalized) {
    case "BAIK":
      return "Baik";
    case "RUSAK_RINGAN":
      return "Rusak Ringan";
    case "RUSAK_BERAT":
      return "Rusak Berat";
    case "HILANG":
      return "Hilang";
    default:
      return condition?.trim() || "-";
  }
}

export function inferWorkTypesFromText(text: string | null | undefined): {
  workTypes: WorkTypeOption[];
  workTypeOther: string;
} {
  if (!text) return { workTypes: [], workTypeOther: "" };
  const matched: WorkTypeOption[] = [];
  for (const opt of WORK_TYPE_OPTIONS) {
    if (text.toLowerCase().includes(opt.toLowerCase())) {
      matched.push(opt);
    }
  }
  return {
    workTypes: matched,
    workTypeOther: "",
  };
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function createEmptyFormBarangData(): FormBarangDocumentData {
  return {
    requestInfo: {
      namaTim: "",
      tanggalRequest: "",
      workTypes: [],
      workTypeOther: "",
      lokasiPengembalian: "",
    },
    barangKeluar: [],
    barangTerpakai: [],
    barangKembali: [],
    pendingRemainingRows: [],
    approval: {
      pemohonName: "",
      pengelolaName: "",
      penerimaName: "",
    },
    summary: {
      sourceType: "blank",
      sourceId: null,
      transactionNumber: null,
      transactionStatus: null,
      requestNumber: null,
      requestStatus: null,
      warehouseOfficer: null,
      totalOutQty: 0,
      totalUsedQty: 0,
      totalReturnedQty: 0,
      totalRemainingQty: 0,
      clientCount: 0,
      returnCount: 0,
    },
  };
}

export interface BuildFormBarangOptions {
  includePendingRemaining?: boolean;
  prefillPenerimaName?: boolean;
}

function formatSerialsCell(sns: string[]): string {
  return sns.length > 0 ? sns.join(", ") : "-";
}

export function buildFormBarangDataFromOutTransaction(
  tx: any,
  options: BuildFormBarangOptions = {}
): FormBarangDocumentData {
  const approvedRequests: any[] = Array.isArray(tx?.approved_requests)
    ? tx.approved_requests
    : [];
  const primaryReq = approvedRequests[0] || null;
  const details: any[] = Array.isArray(tx?.details) ? tx.details : [];
  const clientUsages: any[] = Array.isArray(tx?.client_usages) ? tx.client_usages : [];
  const returns: any[] = Array.isArray(tx?.returns) ? tx.returns : [];

  const detailMap = new Map<string, any>();
  for (const d of details) {
    if (d?.id) detailMap.set(d.id, d);
  }

  // Resolve uniform storage location fallback from items if no request pickup_location
  const storageLocs = new Set<string>();
  for (const d of details) {
    const loc = d?.item?.storage_location?.trim();
    if (loc) storageLocs.add(loc);
  }
  const uniformStorageLocation =
    storageLocs.size === 1 ? Array.from(storageLocs)[0] : "";

  const parsedWorkFromText = inferWorkTypesFromText(
    [tx?.purpose, tx?.notes].filter(Boolean).join(" ")
  );

  const requestInfo: FormBarangRequestInfo = {
    namaTim: (primaryReq?.pic_name || tx?.pic_name || "").trim(),
    tanggalRequest: formatFormBarangDate(
      primaryReq?.request_date || tx?.transaction_date
    ),
    workTypes: primaryReq
      ? parseWorkTypes(primaryReq.work_types)
      : parsedWorkFromText.workTypes,
    workTypeOther: primaryReq?.work_type_other?.trim() || parsedWorkFromText.workTypeOther,
    lokasiPengembalian: (
      primaryReq?.pickup_location ||
      uniformStorageLocation ||
      tx?.location ||
      ""
    ).trim(),
  };

  // A. BARANG KELUAR
  let totalOutQty = 0;
  let totalRemainingQty = 0;
  const barangKeluar: FormBarangKeluarRow[] = details.map((d, idx) => {
    const qty = Number(d?.quantity || 0);
    const rem = d?.status === "CONSUMED" ? 0 : Number(d?.qty_remaining || 0);
    totalOutQty += qty;
    totalRemainingQty += Math.max(0, rem);

    const unit = (d?.unit || d?.item?.unit || "Unit").trim();
    const sns = parseJsonStringArray(d?.unit_serial_numbers);

    return {
      no: idx + 1,
      transactionNumber: tx?.transaction_number || "-",
      itemName: d?.item?.name || "-",
      snBarang: formatSerialsCell(sns),
      quantity: `${formatFormBarangQty(qty)} ${unit}`.trim(),
    };
  });

  // B. BARANG TERPAKAI
  const coveredUsedByDetail = new Map<string, number>();
  const barangTerpakai: FormBarangTerpakaiRow[] = [];
  let totalUsedQty = 0;

  for (const usage of clientUsages) {
    const usageItems: any[] = Array.isArray(usage?.items) ? usage.items : [];
    for (const ui of usageItems) {
      const qty = Number(ui?.quantity || 0);
      if (qty <= 0) continue;

      const linkedDetail = ui?.transaction_detail_id
        ? detailMap.get(ui.transaction_detail_id)
        : undefined;
      if (ui?.transaction_detail_id) {
        coveredUsedByDetail.set(
          ui.transaction_detail_id,
          (coveredUsedByDetail.get(ui.transaction_detail_id) || 0) + qty
        );
      }

      totalUsedQty += qty;
      const unit = (ui?.unit || ui?.item?.unit || linkedDetail?.unit || "Unit").trim();
      const sns = parseJsonStringArray(ui?.serial_numbers);

      barangTerpakai.push({
        no: barangTerpakai.length + 1,
        transactionNumber: tx?.transaction_number || "-",
        itemName: ui?.item?.name || linkedDetail?.item?.name || "-",
        snBarang: formatSerialsCell(sns),
        quantityUsed: `${formatFormBarangQty(qty)} ${unit}`.trim(),
        clientName: usage?.client_name?.trim() || "-",
        location: usage?.client_address?.trim() || tx?.location?.trim() || "-",
      });
    }
  }

  // Fallback for legacy qty_used / CONSUMED rows without client_usages children
  for (const d of details) {
    const qtyUsedField = Number(d?.qty_used || 0);
    const recordedUsed =
      qtyUsedField > 0
        ? qtyUsedField
        : d?.status === "CONSUMED"
          ? Number(d?.quantity || 0)
          : 0;
    const uncovered = Math.max(0, recordedUsed - (coveredUsedByDetail.get(d?.id) || 0));
    if (uncovered > 0) {
      totalUsedQty += uncovered;
      const unit = (d?.unit || d?.item?.unit || "Unit").trim();
      const sns = parseJsonStringArray(d?.unit_serial_numbers);
      barangTerpakai.push({
        no: barangTerpakai.length + 1,
        transactionNumber: tx?.transaction_number || "-",
        itemName: d?.item?.name || "-",
        snBarang: formatSerialsCell(sns),
        quantityUsed: `${formatFormBarangQty(uncovered)} ${unit}`.trim(),
        clientName: tx?.purpose?.trim() || tx?.pic_name?.trim() || "-",
        location: tx?.location?.trim() || "-",
      });
    }
  }

  // C. BARANG KEMBALI / SISA
  const confirmedReturns: FormBarangKembaliRow[] = [];
  let totalReturnedQty = 0;

  for (const ret of returns) {
    const retDetails: any[] = Array.isArray(ret?.details) ? ret.details : [];
    for (const rd of retDetails) {
      const qty = Number(rd?.quantity || 0);
      if (qty <= 0) continue;

      totalReturnedQty += qty;
      const linkedDetail = rd?.transaction_detail_id
        ? detailMap.get(rd.transaction_detail_id)
        : undefined;
      const unit = (
        rd?.item?.unit ||
        linkedDetail?.unit ||
        linkedDetail?.item?.unit ||
        "Unit"
      ).trim();
      const sns = parseJsonStringArray(rd?.serial_numbers);

      confirmedReturns.push({
        no: confirmedReturns.length + 1,
        transactionNumber: ret?.return_number || tx?.transaction_number || "-",
        itemName: rd?.item?.name || linkedDetail?.item?.name || "-",
        snBarang: formatSerialsCell(sns),
        quantityReturned: `${formatFormBarangQty(qty)} ${unit}`.trim(),
        condition: formatReturnConditionLabel(rd?.condition),
        notes: rd?.notes?.trim() || rd?.action_taken?.trim() || "-",
        isPendingRemaining: false,
      });
    }
  }

  const pendingRemainingRows: FormBarangKembaliRow[] = [];
  for (const d of details) {
    if (d?.status === "CONSUMED") continue;
    const rem = Number(d?.qty_remaining || 0);
    if (rem <= 0) continue;
    const unit = (d?.unit || d?.item?.unit || "Unit").trim();
    const remSns = computeRemainingSerialsForDetail(
      { id: d.id, unit_serial_numbers: d.unit_serial_numbers },
      clientUsages,
      returns
    );
    pendingRemainingRows.push({
      no: confirmedReturns.length + pendingRemainingRows.length + 1,
      transactionNumber: tx?.transaction_number || "-",
      itemName: d?.item?.name || "-",
      snBarang: formatSerialsCell(remSns),
      quantityReturned: `${formatFormBarangQty(rem)} ${unit}`.trim(),
      condition: "Belum Kembali",
      notes:
        tx?.status === "MENUNGGU_PENGEMBALIAN"
          ? "Sisa menunggu konfirmasi pengembalian"
          : "Sisa masih dibawa tim / digunakan",
      isPendingRemaining: true,
    });
  }

  const barangKembali = options.includePendingRemaining
    ? [...confirmedReturns, ...pendingRemainingRows]
    : confirmedReturns;

  return {
    requestInfo,
    barangKeluar,
    barangTerpakai,
    barangKembali,
    pendingRemainingRows,
    approval: {
      pemohonName: "",
      pengelolaName: "",
      penerimaName:
        options.prefillPenerimaName === true
          ? (primaryReq?.pic_name || tx?.pic_name || "").trim()
          : "",
    },
    summary: {
      sourceType: "transaction",
      sourceId: tx?.id || null,
      transactionNumber: tx?.transaction_number || null,
      transactionStatus: tx?.status || null,
      requestNumber: primaryReq?.request_number || null,
      requestStatus: primaryReq?.status || null,
      warehouseOfficer: tx?.warehouse_officer || null,
      totalOutQty,
      totalUsedQty,
      totalReturnedQty,
      totalRemainingQty,
      clientCount: clientUsages.length,
      returnCount: returns.length,
    },
  };
}

export function buildFormBarangDataFromRequest(
  req: any,
  options: BuildFormBarangOptions = {}
): FormBarangDocumentData {
  if (req?.out_transaction?.details) {
    return buildFormBarangDataFromOutTransaction(
      {
        ...req.out_transaction,
        approved_requests: [req],
      },
      options
    );
  }

  return {
    requestInfo: {
      namaTim: (req?.pic_name || "").trim(),
      tanggalRequest: formatFormBarangDate(req?.request_date),
      workTypes: parseWorkTypes(req?.work_types),
      workTypeOther: req?.work_type_other?.trim() || "",
      lokasiPengembalian: (req?.pickup_location || "").trim(),
    },
    barangKeluar: [],
    barangTerpakai: [],
    barangKembali: [],
    pendingRemainingRows: [],
    approval: {
      pemohonName: "",
      pengelolaName: "",
      penerimaName:
        options.prefillPenerimaName === true ? (req?.pic_name || "").trim() : "",
    },
    summary: {
      sourceType: "request",
      sourceId: req?.id || null,
      transactionNumber: null,
      transactionStatus: null,
      requestNumber: req?.request_number || null,
      requestStatus: req?.status || null,
      warehouseOfficer: null,
      totalOutQty: 0,
      totalUsedQty: 0,
      totalReturnedQty: 0,
      totalRemainingQty: 0,
      clientCount: 0,
      returnCount: 0,
    },
  };
}

function estimateKeluarRowUnits(row: FormBarangKeluarRow): number {
  const nameLines = Math.max(1, Math.ceil(row.itemName.length / 26));
  const snLines = Math.max(1, Math.ceil((row.snBarang || "").length / 32));
  const maxLines = Math.max(nameLines, snLines);
  return maxLines > 1 ? 1 + (maxLines - 1) * 0.72 : 1;
}

function estimateTerpakaiRowUnits(row: FormBarangTerpakaiRow): number {
  const nameLines = Math.max(1, Math.ceil(row.itemName.length / 19));
  const snLines = Math.max(1, Math.ceil((row.snBarang || "").length / 21));
  const clientLines = Math.max(1, Math.ceil(row.clientName.length / 15));
  const locLines = Math.max(1, Math.ceil(row.location.length / 13));
  const maxLines = Math.max(nameLines, snLines, clientLines, locLines);
  return maxLines > 1 ? 1 + (maxLines - 1) * 0.72 : 1;
}

function estimateKembaliRowUnits(row: FormBarangKembaliRow): number {
  const nameLines = Math.max(1, Math.ceil(row.itemName.length / 18));
  const snLines = Math.max(1, Math.ceil((row.snBarang || "").length / 20));
  const notesLines = Math.max(1, Math.ceil(row.notes.length / 15));
  const maxLines = Math.max(nameLines, snLines, notesLines);
  return maxLines > 1 ? 1 + (maxLines - 1) * 0.72 : 1;
}

function chunkByRowUnits<T>(
  items: T[],
  estimateUnits: (item: T) => number,
  maxUnitsFirst: number,
  maxUnitsNext: number
): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  let current: T[] = [];
  let used = 0;
  let budget = maxUnitsFirst;

  for (const item of items) {
    const cost = estimateUnits(item);
    if (current.length > 0 && used + cost > budget) {
      chunks.push(current);
      current = [item];
      used = cost;
      budget = maxUnitsNext;
    } else {
      current.push(item);
      used += cost;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function padTableRows<T>(rows: T[], minCount = FORM_BARANG_MIN_TABLE_ROWS): Array<T | null> {
  if (rows.length >= minCount) return rows;
  const padded: Array<T | null> = [...rows];
  while (padded.length < minCount) padded.push(null);
  return padded;
}

export function resolveDynamicTableRows<T>(rows: T[], isBlankTemplate: boolean): Array<T | null> {
  if (isBlankTemplate) {
    return padTableRows(rows, FORM_BARANG_MIN_TABLE_ROWS);
  }
  // When data exists, match exact count (1 filled item => 1 row); if 0 rows yet, show 1 clean row
  return rows.length > 0 ? rows : [null];
}

/**
 * Splits a FormBarangDocumentData into crisp A4 pages where populated tables render
 * strictly the exact count of items (no trailing blank padding rows) while multi-line SNs
 * and large lists spill cleanly onto continuation pages without clipping the footer.
 */
export function paginateFormBarangData(doc: FormBarangDocumentData): FormBarangPageSlice[] {
  const isBlankTemplate = doc.summary.sourceType === "blank";
  const keluar = doc.barangKeluar || [];
  const terpakai = doc.barangTerpakai || [];
  const kembali = doc.barangKembali || [];

  const totalKeluarUnits = keluar.reduce((s, r) => s + estimateKeluarRowUnits(r), 0);
  const totalTerpakaiUnits = terpakai.reduce((s, r) => s + estimateTerpakaiRowUnits(r), 0);
  const totalKembaliUnits = kembali.reduce((s, r) => s + estimateKembaliRowUnits(r), 0);

  const pages: FormBarangPageSlice[] = [];

  // Part 1: FORM BARANG (Informasi Request + A. BARANG KELUAR + B. BARANG TERPAKAI)
  if (
    totalKeluarUnits + totalTerpakaiUnits <= 22 &&
    (!isBlankTemplate || (keluar.length <= 8 && terpakai.length <= 8))
  ) {
    pages.push({
      pageNumber: 1,
      kind: "FORM_BARANG",
      title: "FORM BARANG",
      includeRequestInfo: true,
      keluarHeaderVisible: true,
      keluarContinuation: false,
      keluarRows: resolveDynamicTableRows(keluar, isBlankTemplate),
      terpakaiHeaderVisible: true,
      terpakaiContinuation: false,
      terpakaiRows: resolveDynamicTableRows(terpakai, isBlankTemplate),
      kembaliHeaderVisible: false,
      kembaliContinuation: false,
      kembaliRows: [],
      includeApprovalAndNotes: false,
    });
  } else {
    const keluarChunks =
      keluar.length === 0
        ? [[]]
        : chunkByRowUnits(keluar, estimateKeluarRowUnits, 22, 30);

    keluarChunks.forEach((chunk, idx) => {
      pages.push({
        pageNumber: pages.length + 1,
        kind: "FORM_BARANG",
        title: idx === 0 ? "FORM BARANG" : "FORM BARANG (LANJUTAN)",
        includeRequestInfo: idx === 0,
        keluarHeaderVisible: true,
        keluarContinuation: idx > 0,
        keluarRows: resolveDynamicTableRows(chunk, isBlankTemplate),
        terpakaiHeaderVisible: false,
        terpakaiContinuation: false,
        terpakaiRows: [],
        kembaliHeaderVisible: false,
        kembaliContinuation: false,
        kembaliRows: [],
        includeApprovalAndNotes: false,
      });
    });

    // Place Section B either on last Keluar page if plenty of room, or dedicated clean FORM BARANG page(s)
    const lastPage = pages[pages.length - 1];
    const lastKeluarCost = lastPage.keluarRows.reduce(
      (s, r) => s + (r ? estimateKeluarRowUnits(r) : 1),
      0
    );
    const availableAfterKeluar =
      (lastPage.includeRequestInfo ? 21 : 29) - lastKeluarCost - 4;

    if (
      Math.max(1, totalTerpakaiUnits) <= availableAfterKeluar &&
      (!isBlankTemplate || terpakai.length <= 8)
    ) {
      lastPage.terpakaiHeaderVisible = true;
      lastPage.terpakaiContinuation = false;
      lastPage.terpakaiRows = resolveDynamicTableRows(terpakai, isBlankTemplate);
    } else {
      const terpakaiChunks =
        terpakai.length === 0
          ? [[]]
          : chunkByRowUnits(terpakai, estimateTerpakaiRowUnits, 28, 28);
      terpakaiChunks.forEach((chunk, idx) => {
        pages.push({
          pageNumber: pages.length + 1,
          kind: "FORM_BARANG",
          title: "FORM BARANG (LANJUTAN)",
          includeRequestInfo: false,
          keluarHeaderVisible: false,
          keluarContinuation: false,
          keluarRows: [],
          terpakaiHeaderVisible: true,
          terpakaiContinuation: idx > 0,
          terpakaiRows: resolveDynamicTableRows(chunk, isBlankTemplate),
          kembaliHeaderVisible: false,
          kembaliContinuation: false,
          kembaliRows: [],
          includeApprovalAndNotes: false,
        });
      });
    }
  }

  // Part 2: FORM PENGEMBALIAN BARANG (C. BARANG KEMBALI / SISA + B. PERSETUJUAN DAN SERAH TERIMA + CATATAN)
  if (totalKembaliUnits <= 18) {
    pages.push({
      pageNumber: pages.length + 1,
      kind: "FORM_PENGEMBALIAN",
      title: "FORM PENGEMBALIAN BARANG",
      includeRequestInfo: false,
      keluarHeaderVisible: false,
      keluarContinuation: false,
      keluarRows: [],
      terpakaiHeaderVisible: false,
      terpakaiContinuation: false,
      terpakaiRows: [],
      kembaliHeaderVisible: true,
      kembaliContinuation: false,
      kembaliRows: resolveDynamicTableRows(kembali, isBlankTemplate),
      includeApprovalAndNotes: true,
    });
  } else {
    const kembaliChunks = chunkByRowUnits(kembali, estimateKembaliRowUnits, 26, 26);
    kembaliChunks.forEach((chunk, idx) => {
      const isLast = idx === kembaliChunks.length - 1;
      const chunkCost = chunk.reduce((s, r) => s + estimateKembaliRowUnits(r), 0);
      const fitsApprovalOnSamePage = isLast && chunkCost <= 18;

      pages.push({
        pageNumber: pages.length + 1,
        kind: "FORM_PENGEMBALIAN",
        title:
          idx === 0 ? "FORM PENGEMBALIAN BARANG" : "FORM PENGEMBALIAN BARANG (LANJUTAN)",
        includeRequestInfo: false,
        keluarHeaderVisible: false,
        keluarContinuation: false,
        keluarRows: [],
        terpakaiHeaderVisible: false,
        terpakaiContinuation: false,
        terpakaiRows: [],
        kembaliHeaderVisible: true,
        kembaliContinuation: idx > 0,
        kembaliRows: chunk,
        includeApprovalAndNotes: fitsApprovalOnSamePage,
      });

      if (isLast && !fitsApprovalOnSamePage) {
        pages.push({
          pageNumber: pages.length + 1,
          kind: "FORM_PENGEMBALIAN",
          title: "FORM PENGEMBALIAN BARANG (LANJUTAN)",
          includeRequestInfo: false,
          keluarHeaderVisible: false,
          keluarContinuation: false,
          keluarRows: [],
          terpakaiHeaderVisible: false,
          terpakaiContinuation: false,
          terpakaiRows: [],
          kembaliHeaderVisible: false,
          kembaliContinuation: false,
          kembaliRows: [],
          includeApprovalAndNotes: true,
        });
      }
    });
  }

  return pages;
}

export function generateFormBarangPdfFileName(doc: FormBarangDocumentData): string {
  const ref =
    doc.summary.transactionNumber ||
    doc.summary.requestNumber ||
    doc.requestInfo.namaTim ||
    "Template";
  const safeRef = ref
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const datePart = doc.requestInfo.tanggalRequest
    ? doc.requestInfo.tanggalRequest.replace(/\//g, "-")
    : new Date().toISOString().slice(0, 10);
  return `FORM_BARANG_${safeRef || "JDP"}_${datePart}.pdf`;
}
