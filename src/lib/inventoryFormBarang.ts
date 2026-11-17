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
  kind: "FORM_BARANG";
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

// A4 paper dimensions (794x1123px) safe printable vertical budgets in pixels:
// Page 1 starts content below Kop Surat + "FORM BARANG" title (paddingTop: 152px)
// Page >= 2 starts content directly below the identical Kop Surat (paddingTop: 118px)
// Footer divider starts around y = 1045px -> keep safe bottom margin <= 1017px (p1: 865px, p2+: 895px)
const PAGE_1_CONTENT_BUDGET_PX = 865;
const PAGE_N_CONTENT_BUDGET_PX = 895;

const SECTION_A_HEADER_HEIGHT_PX = 84;
const SECTION_B_HEADER_HEIGHT_PX = 96;
const SECTION_C_HEADER_HEIGHT_PX = 98;
const APPROVAL_AND_NOTES_HEIGHT_PX = 280;

const EMPTY_PLACEHOLDER_ROW_HEIGHT_PX = 21;

function countWrappedLines(text: string | null | undefined, charsPerLine: number): number {
  const clean = (text || "").trim();
  if (!clean) return 1;
  return Math.max(1, Math.ceil(clean.length / Math.max(1, charsPerLine)));
}

function estimateWrappedRowHeightPx(lineCount: number): number {
  const safeLines = Math.max(1, lineCount);
  return safeLines === 1 ? 22 : 22 + (safeLines - 1) * 15;
}

function estimateKeluarRowHeightPx(row: FormBarangKeluarRow | null): number {
  if (!row) return EMPTY_PLACEHOLDER_ROW_HEIGHT_PX;
  const maxLines = Math.max(
    countWrappedLines(row.itemName, 23),
    countWrappedLines(row.snBarang, 28),
    countWrappedLines(row.quantity, 12)
  );
  return estimateWrappedRowHeightPx(maxLines);
}

function estimateTerpakaiRowHeightPx(row: FormBarangTerpakaiRow | null): number {
  if (!row) return EMPTY_PLACEHOLDER_ROW_HEIGHT_PX;
  const maxLines = Math.max(
    countWrappedLines(row.itemName, 16),
    countWrappedLines(row.snBarang, 18),
    countWrappedLines(row.quantityUsed, 8),
    countWrappedLines(row.clientName, 12),
    countWrappedLines(row.location, 10)
  );
  return estimateWrappedRowHeightPx(maxLines);
}

function estimateKembaliRowHeightPx(row: FormBarangKembaliRow | null): number {
  if (!row) return EMPTY_PLACEHOLDER_ROW_HEIGHT_PX;
  const maxLines = Math.max(
    countWrappedLines(row.itemName, 15),
    countWrappedLines(row.snBarang, 17),
    countWrappedLines(row.quantityReturned, 8),
    countWrappedLines(row.condition, 10),
    countWrappedLines(row.notes, 12)
  );
  return estimateWrappedRowHeightPx(maxLines);
}

function estimateRequestInfoHeightPx(info: FormBarangRequestInfo): number {
  const extraLines = Math.max(
    0,
    countWrappedLines(info.namaTim, 32) - 1,
    countWrappedLines(info.lokasiPengembalian, 26) - 1
  );
  const hasOther = info.workTypes.includes("Lainnya") && Boolean(info.workTypeOther?.trim());
  return 102 + extraLines * 15 + (hasOther ? 12 : 0);
}

function createEmptyPageSlice(pageNumber: number): FormBarangPageSlice {
  return {
    pageNumber,
    kind: "FORM_BARANG",
    title: pageNumber === 1 ? "FORM BARANG" : "",
    includeRequestInfo: pageNumber === 1,
    keluarHeaderVisible: false,
    keluarContinuation: false,
    keluarRows: [],
    terpakaiHeaderVisible: false,
    terpakaiContinuation: false,
    terpakaiRows: [],
    kembaliHeaderVisible: false,
    kembaliContinuation: false,
    kembaliRows: [],
    includeApprovalAndNotes: false,
  };
}

function appendSectionFlowToPages<TRow>(
  pages: FormBarangPageSlice[],
  remainingPxRef: { current: number },
  rows: Array<TRow | null>,
  headerHeightPx: number,
  estimateRowHeightPx: (row: TRow | null) => number,
  attachChunk: (
    page: FormBarangPageSlice,
    chunk: Array<TRow | null>,
    isContinuation: boolean
  ) => void
): void {
  if (rows.length === 0) return;

  let cursor = 0;
  let isContinuation = false;

  while (cursor < rows.length) {
    let currentPage = pages[pages.length - 1];
    const firstRowHeight = estimateRowHeightPx(rows[cursor]);
    const isFreshContinuationPage =
      currentPage.pageNumber > 1 &&
      !currentPage.keluarHeaderVisible &&
      !currentPage.terpakaiHeaderVisible &&
      !currentPage.kembaliHeaderVisible;

    // Avoid orphan section headers with zero rows at the bottom of a filled page
    if (
      !isFreshContinuationPage &&
      remainingPxRef.current < headerHeightPx + firstRowHeight
    ) {
      currentPage = createEmptyPageSlice(pages.length + 1);
      pages.push(currentPage);
      remainingPxRef.current = PAGE_N_CONTENT_BUDGET_PX;
    }

    remainingPxRef.current = Math.max(0, remainingPxRef.current - headerHeightPx);
    const chunk: Array<TRow | null> = [];

    while (cursor < rows.length) {
      const rowHeight = estimateRowHeightPx(rows[cursor]);
      if (chunk.length > 0 && rowHeight > remainingPxRef.current) {
        break;
      }
      chunk.push(rows[cursor]);
      remainingPxRef.current = Math.max(0, remainingPxRef.current - rowHeight);
      cursor++;
    }

    attachChunk(currentPage, chunk, isContinuation);
    isContinuation = true;

    // Current page ran out of vertical space mid-table; open a new page with Kop Surat
    if (cursor < rows.length) {
      pages.push(createEmptyPageSlice(pages.length + 1));
      remainingPxRef.current = PAGE_N_CONTENT_BUDGET_PX;
    }
  }
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
 * Flow-paginates a FormBarangDocumentData across A4 pages:
 * - Packs sections (A -> B -> C -> Persetujuan & Catatan) seamlessly into remaining
 *   vertical space on earlier pages (no forced blank half-page breaks).
 * - Whenever the current page is full, automatically opens a new page sharing the
 *   identical company Kop Surat without redundant sub-titles.
 */
export function paginateFormBarangData(doc: FormBarangDocumentData): FormBarangPageSlice[] {
  const isBlankTemplate = doc.summary.sourceType === "blank";
  const keluarRows = resolveDynamicTableRows(doc.barangKeluar || [], isBlankTemplate);
  const terpakaiRows = resolveDynamicTableRows(doc.barangTerpakai || [], isBlankTemplate);
  const kembaliRows = resolveDynamicTableRows(doc.barangKembali || [], isBlankTemplate);

  const page1 = createEmptyPageSlice(1);
  const pages: FormBarangPageSlice[] = [page1];
  const remainingPxRef = {
    current: PAGE_1_CONTENT_BUDGET_PX - estimateRequestInfoHeightPx(doc.requestInfo),
  };

  // A. BARANG KELUAR
  appendSectionFlowToPages(
    pages,
    remainingPxRef,
    keluarRows,
    SECTION_A_HEADER_HEIGHT_PX,
    estimateKeluarRowHeightPx,
    (page, chunk, isContinuation) => {
      page.keluarHeaderVisible = true;
      page.keluarContinuation = isContinuation;
      page.keluarRows = chunk;
    }
  );

  // B. BARANG TERPAKAI
  appendSectionFlowToPages(
    pages,
    remainingPxRef,
    terpakaiRows,
    SECTION_B_HEADER_HEIGHT_PX,
    estimateTerpakaiRowHeightPx,
    (page, chunk, isContinuation) => {
      page.terpakaiHeaderVisible = true;
      page.terpakaiContinuation = isContinuation;
      page.terpakaiRows = chunk;
    }
  );

  // C. BARANG KEMBALI / SISA
  appendSectionFlowToPages(
    pages,
    remainingPxRef,
    kembaliRows,
    SECTION_C_HEADER_HEIGHT_PX,
    estimateKembaliRowHeightPx,
    (page, chunk, isContinuation) => {
      page.kembaliHeaderVisible = true;
      page.kembaliContinuation = isContinuation;
      page.kembaliRows = chunk;
    }
  );

  // PERSETUJUAN DAN SERAH TERIMA + CATATAN
  if (remainingPxRef.current >= APPROVAL_AND_NOTES_HEIGHT_PX) {
    pages[pages.length - 1].includeApprovalAndNotes = true;
  } else {
    const approvalPage = createEmptyPageSlice(pages.length + 1);
    approvalPage.includeApprovalAndNotes = true;
    pages.push(approvalPage);
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
