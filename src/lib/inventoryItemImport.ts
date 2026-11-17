export interface NormalizedInventoryImportRow {
  code?: string;
  name: string;
  category: string;
  type: "REUSABLE" | "CONSUMABLE";
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  unit: string;
  initial_stock: number;
  has_initial_stock: boolean;
  min_stock: number;
  storage_location: string | null;
  description: string | null;
  is_active: boolean;
  _rowNumber: number;
  _isValid: boolean;
  _errors: string[];
  _warnings: string[];
}

export type CsvDelimiter = "," | ";" | "\t";

type CanonicalImportKey =
  | "code"
  | "name"
  | "category"
  | "type"
  | "brand"
  | "model"
  | "serial_number"
  | "unit"
  | "initial_stock"
  | "min_stock"
  | "storage_location"
  | "description"
  | "status";

const CANONICAL_LOCATIONS = new Map<string, string>([
  ["gudang pusat", "Gudang Pusat"],
  ["gudang bandung", "Gudang Bandung"],
  ["gudang gekbrong", "Gudang Gekbrong"],
]);

const HEADER_KEY_MAP: Record<string, CanonicalImportKey> = {
  // Kode Barang
  code: "code",
  kode: "code",
  kodebarang: "code",
  sku: "code",
  // Nama Barang
  name: "name",
  nama: "name",
  namabarang: "name",
  namaitem: "name",
  itemname: "name",
  barang: "name",
  // Kategori
  category: "category",
  kategori: "category",
  kategoribarang: "category",
  // Jenis
  type: "type",
  jenis: "type",
  jenisbarang: "type",
  tipebarang: "type",
  // Merek
  brand: "brand",
  merek: "brand",
  merk: "brand",
  pabrikan: "brand",
  merekpabrikan: "brand",
  // Model
  model: "model",
  tipe: "model",
  modeltipe: "model",
  // Serial Number
  serialnumber: "serial_number",
  sn: "serial_number",
  noseri: "serial_number",
  // Satuan
  unit: "unit",
  satuan: "unit",
  uom: "unit",
  // Stok Awal
  initialstock: "initial_stock",
  stokawal: "initial_stock",
  stoktersedia: "initial_stock",
  stok: "initial_stock",
  stock: "initial_stock",
  qty: "initial_stock",
  kuantitas: "initial_stock",
  // Stok Minimum
  minstock: "min_stock",
  stokminimum: "min_stock",
  stokmin: "min_stock",
  batasmin: "min_stock",
  batasminimum: "min_stock",
  // Lokasi Penyimpanan
  storagelocation: "storage_location",
  lokasipenyimpanan: "storage_location",
  lokasirak: "storage_location",
  lokasi: "storage_location",
  rak: "storage_location",
  gudang: "storage_location",
  // Deskripsi / Catatan
  description: "description",
  deskripsi: "description",
  keterangan: "description",
  catatan: "description",
  notes: "description",
  // Status
  status: "status",
  isactive: "status",
  aktif: "status",
};

function normalizeHeaderToken(rawHeader: string): string {
  return rawHeader
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function detectCsvDelimiter(firstLine: string): CsvDelimiter {
  let inQuotes = false;
  let commaCount = 0;
  let semicolonCount = 0;
  let tabCount = 0;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes) {
      if (ch === ",") commaCount++;
      else if (ch === ";") semicolonCount++;
      else if (ch === "\t") tabCount++;
    }
  }

  if (tabCount > semicolonCount && tabCount > commaCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

/**
 * Quote-aware CSV parser handling UTF-8 BOM, Excel `sep=` directive,
 * `,` / `;` / `\t` delimiters, quoted fields, escaped quotes `""`, and multiline values.
 */
export function parseInventoryCsvGrid(csvText: string): {
  rows: string[][];
  delimiter: CsvDelimiter;
} {
  let cleanText = String(csvText || "").replace(/^\uFEFF/, "");

  // Handle Excel explicit separator line at start of file (e.g. "sep=;" or "sep=,")
  let explicitDelimiter: CsvDelimiter | null = null;
  const sepMatch = cleanText.match(/^sep=([,;\t])\r?\n/i);
  if (sepMatch) {
    explicitDelimiter = sepMatch[1] as CsvDelimiter;
    cleanText = cleanText.slice(sepMatch[0].length);
  }

  const firstNewlineIdx = cleanText.search(/\r?\n/);
  const firstLine = firstNewlineIdx >= 0 ? cleanText.slice(0, firstNewlineIdx) : cleanText;
  const delimiter = explicitDelimiter || detectCsvDelimiter(firstLine);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows, delimiter };
}

export function parseCsvDecimal(
  raw: unknown
): { ok: true; value: number; provided: boolean } | { ok: false; raw: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: 0, provided: false };
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return { ok: false, raw: String(raw) };
    }
    return { ok: true, value: raw, provided: true };
  }

  const str = String(raw).trim();
  if (!str || str === "-") {
    return { ok: true, value: 0, provided: false };
  }

  // Normalize Indonesian formatted numbers e.g. "1.000,5" or "10,5" vs "10.5"
  let normalized = str.replace(/\s+/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, raw: str };
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return { ok: false, raw: str };
  }

  return { ok: true, value: Number(num.toFixed(2)), provided: true };
}

function getFieldByAliases(
  record: Record<string, unknown>,
  targetKey: CanonicalImportKey
): unknown {
  // Fast direct check if already normalized
  if (record[targetKey] !== undefined) return record[targetKey];

  for (const [rawKey, value] of Object.entries(record)) {
    const token = normalizeHeaderToken(rawKey);
    if (HEADER_KEY_MAP[token] === targetKey && value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function toCleanString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export function normalizeInventoryImportRecord(
  rawRecord: Record<string, unknown>,
  rowNumber: number
): NormalizedInventoryImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawCode = toCleanString(getFieldByAliases(rawRecord, "code"));
  const code = rawCode ? rawCode.toUpperCase() : undefined;

  const rawName = toCleanString(getFieldByAliases(rawRecord, "name"));
  const name = rawName.toUpperCase();
  if (!name) {
    errors.push("Nama Barang wajib diisi.");
  }

  // Default all newly imported items silently to REUSABLE
  const type: "REUSABLE" | "CONSUMABLE" = "REUSABLE";

  const rawCategory = toCleanString(getFieldByAliases(rawRecord, "category"));
  let category = rawCategory;
  if (!category) {
    category = "Aktif";
  } else if (/^aktif$/i.test(category)) {
    category = "Aktif";
  } else if (/^pasif$/i.test(category)) {
    category = "Pasif";
  }

  const brand = toCleanString(getFieldByAliases(rawRecord, "brand")) || null;
  const model = toCleanString(getFieldByAliases(rawRecord, "model")) || null;
  const serialNumber = toCleanString(getFieldByAliases(rawRecord, "serial_number")) || null;
  const unit = toCleanString(getFieldByAliases(rawRecord, "unit")) || "Unit";

  const rawInitial = getFieldByAliases(rawRecord, "initial_stock");
  const parsedInitial = parseCsvDecimal(rawInitial);
  if (!parsedInitial.ok) {
    errors.push(`Stok Awal '${parsedInitial.raw}' harus berupa angka >= 0.`);
  }

  const rawMinStock = getFieldByAliases(rawRecord, "min_stock");
  const parsedMinStock = parseCsvDecimal(rawMinStock);
  if (!parsedMinStock.ok) {
    errors.push(`Stok Minimum '${parsedMinStock.raw}' harus berupa angka >= 0.`);
  }

  const rawLoc = toCleanString(getFieldByAliases(rawRecord, "storage_location"));
  const canonicalLoc = rawLoc
    ? CANONICAL_LOCATIONS.get(rawLoc.replace(/\s+/g, " ").toLowerCase()) || rawLoc
    : null;

  const description = toCleanString(getFieldByAliases(rawRecord, "description")) || null;

  const rawStatus = toCleanString(getFieldByAliases(rawRecord, "status")).toLowerCase();
  const isActive =
    rawStatus === "nonaktif" || rawStatus === "inactive" || rawStatus === "false" || rawStatus === "0"
      ? false
      : true;

  if (!code) {
    warnings.push("Kode otomatis akan dibuat oleh sistem");
  }

  return {
    code,
    name,
    category,
    type,
    brand,
    model,
    serial_number: serialNumber,
    unit,
    initial_stock: parsedInitial.ok ? parsedInitial.value : 0,
    has_initial_stock: parsedInitial.ok ? parsedInitial.provided : false,
    min_stock: parsedMinStock.ok ? parsedMinStock.value : 0,
    storage_location: canonicalLoc,
    description,
    is_active: isActive,
    _rowNumber: rowNumber,
    _isValid: errors.length === 0,
    _errors: errors,
    _warnings: warnings,
  };
}

export function parseAndValidateInventoryItemsCsv(csvText: string): {
  rows: NormalizedInventoryImportRow[];
  validRows: number;
  invalidRows: number;
  totalRows: number;
  headers: string[];
  delimiter: CsvDelimiter;
  headerError?: string;
} {
  const { rows: grid, delimiter } = parseInventoryCsvGrid(csvText);
  if (grid.length === 0) {
    return {
      rows: [],
      validRows: 0,
      invalidRows: 0,
      totalRows: 0,
      headers: [],
      delimiter,
      headerError: "File CSV kosong.",
    };
  }

  const rawHeaders = grid[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  const mappedKeys = rawHeaders.map((h) => HEADER_KEY_MAP[normalizeHeaderToken(h)] || null);

  if (!mappedKeys.includes("name")) {
    return {
      rows: [],
      validRows: 0,
      invalidRows: 0,
      totalRows: 0,
      headers: rawHeaders,
      delimiter,
      headerError:
        "Header wajib 'Nama Barang' tidak ditemukan pada baris pertama CSV. Gunakan template resmi atau cek pemisah kolom (',' / ';').",
    };
  }

  if (grid.length < 2) {
    return {
      rows: [],
      validRows: 0,
      invalidRows: 0,
      totalRows: 0,
      headers: rawHeaders,
      delimiter,
      headerError: "File CSV hanya berisi header dan belum memiliki baris data.",
    };
  }

  const parsedRows: NormalizedInventoryImportRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (!cells.some((c) => c.length > 0)) continue;

    const record: Record<string, string> = {};
    mappedKeys.forEach((key, colIdx) => {
      if (key) {
        record[key] = cells[colIdx] ?? "";
      }
    });

    parsedRows.push(normalizeInventoryImportRecord(record, r + 1));
  }

  const validRows = parsedRows.filter((row) => row._isValid).length;

  return {
    rows: parsedRows,
    validRows,
    invalidRows: parsedRows.length - validRows,
    totalRows: parsedRows.length,
    headers: rawHeaders,
    delimiter,
  };
}

export function generateInventoryItemCsvTemplate(): string {
  const headers = [
    "Nama Barang",
    "Kategori",
    "Merek",
    "Model",
    "Satuan",
    "Stok Awal",
    "Stok Minimum",
    "Lokasi Penyimpanan",
  ];
  const sampleRows = [
    ["MODEM ONT DUAL BAND", "Aktif", "Huawei", "HG8245H5", "Unit", "10", "3", "Gudang Pusat"],
    ["PATCHCORD SC-UPC 3M", "Pasif", "Netlink", "Simplex", "Pcs", "50", "10", "Gudang Bandung"],
  ];

  return (
    "\uFEFF" +
    [headers.join(","), ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join(
      "\r\n"
    )
  );
}
