export type InventoryMirrorEventType =
  | "ITEM_CREATE"
  | "ITEM_UPDATE"
  | "ITEM_DELETE"
  | "ITEM_IMPORT"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "TRANSACTION_DELETE"
  | "RETURN"
  | "IN_USE_UPDATE"
  | "FINISH_IN_USE"
  | "STOCK_ADJUST"
  | "STOCK_OPNAME"
  | "REQUEST_CREATE"
  | "REQUEST_REJECT"
  | "FORCE_SYNC"
  | "SYNC_TEST";

export interface InventoryMirrorItemRow {
  id: string;
  code: string;
  name: string;
  category_name: string;
  brand: string;
  model: string;
  unit: string;
  storage_location: string;
  initial_stock: number;
  total_in: number;
  total_out: number;
  total_in_use: number;
  total_consumed: number;
  total_returned: number;
  total_damaged: number;
  total_lost: number;
  available_stock: number;
  min_stock: number;
  is_active: boolean;
  updated_at: string;
}

export interface InventoryMirrorUnitRow {
  id: string;
  item_code: string;
  item_name: string;
  serial_number: string;
  mac_address: string;
  status: string;
  condition: string;
  current_pic: string;
  current_location: string;
  updated_at: string;
}

export interface InventoryMirrorTransactionRow {
  id: string;
  transaction_number: string;
  type: string;
  transaction_date: string;
  warehouse_officer: string;
  pic_name: string;
  pic_phone: string;
  department: string;
  location: string;
  status: string;
  items_summary: string;
  serial_numbers: string;
  notes: string;
}

export interface InventoryMirrorReturnRow {
  id: string;
  return_number: string;
  out_transaction_number: string;
  return_date: string;
  pic_name: string;
  recipient_officer: string;
  details_summary: string;
  notes: string;
}

export interface InventoryMirrorRequestRow {
  id: string;
  request_number: string;
  request_date: string;
  pic_name: string;
  pic_phone: string;
  work_type_label: string;
  pickup_location: string;
  status: string;
  out_transaction_number: string;
  processed_by: string;
  items_summary: string;
  notes: string;
}

export interface InventoryMirrorSnapshot {
  generated_at_iso: string;
  generated_at_wib: string;
  summary: {
    total_items: number;
    active_items: number;
    total_available_stock: number;
    total_units: number;
    total_transactions: number;
    total_returns: number;
    total_requests: number;
  };
  items: InventoryMirrorItemRow[];
  units: InventoryMirrorUnitRow[];
  transactions: InventoryMirrorTransactionRow[];
  returns: InventoryMirrorReturnRow[];
  requests: InventoryMirrorRequestRow[];
}

export interface SheetTabMatrix {
  tabName: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export const INVENTORY_SHEET_TAB_NAMES = {
  ITEMS: "Stok_&_Master_Barang",
  UNITS: "Serial_Number_Unit",
  TRANSACTIONS: "Riwayat_Transaksi",
  RETURNS: "Pengembalian_Barang",
  REQUESTS: "Request_Barang",
} as const;

/**
 * Extracts a clean Google Spreadsheet ID or Drive Folder ID from a pasted Google URL or raw ID.
 */
export function extractGoogleResourceId(
  rawInput: string | null | undefined,
  kind: "spreadsheet" | "folder"
): string {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) return "";

  if (kind === "spreadsheet") {
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (match?.[1]) return match[1];
  } else {
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/i);
    if (folderMatch?.[1]) return folderMatch[1];
    const queryIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
    if (queryIdMatch?.[1]) return queryIdMatch[1];
  }

  return trimmed;
}

/**
 * Formats a Date or ISO string into readable WIB timestamp (YYYY-MM-DD HH:mm:ss WIB).
 */
export function formatWibTimestamp(value?: Date | string | null): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const formatted = d.toLocaleString("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${formatted} WIB`;
}

/**
 * Prevents Spreadsheet formula injection on untrusted user strings when syncing to Sheets.
 */
export function sanitizeSheetCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str) return "";
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Converts an InventoryMirrorSnapshot into 5 structured tab matrices ready for Google Sheets.
 */
export function buildInventorySheetsMatrices(
  snapshot: InventoryMirrorSnapshot
): SheetTabMatrix[] {
  const s = (v: unknown) => sanitizeSheetCellText(v);

  return [
    {
      tabName: INVENTORY_SHEET_TAB_NAMES.ITEMS,
      headers: [
        "ID Item",
        "Kode Barang",
        "Nama Barang",
        "Kategori",
        "Merek",
        "Model",
        "Satuan",
        "Lokasi Rak",
        "Stok Awal",
        "Total Masuk",
        "Total Keluar",
        "Sedang Digunakan",
        "Terpakai Client",
        "Total Kembali",
        "Rusak",
        "Hilang",
        "Stok Siap Pakai",
        "Stok Minimum",
        "Status",
        "Diperbarui (WIB)",
      ],
      rows: snapshot.items.map((it) => [
        s(it.id),
        s(it.code),
        s(it.name),
        s(it.category_name),
        s(it.brand),
        s(it.model),
        s(it.unit),
        s(it.storage_location),
        it.initial_stock,
        it.total_in,
        it.total_out,
        it.total_in_use,
        it.total_consumed,
        it.total_returned,
        it.total_damaged,
        it.total_lost,
        it.available_stock,
        it.min_stock,
        it.is_active ? "Aktif" : "Nonaktif",
        s(it.updated_at),
      ]),
    },
    {
      tabName: INVENTORY_SHEET_TAB_NAMES.UNITS,
      headers: [
        "ID Unit",
        "Kode Barang",
        "Nama Barang",
        "Serial Number",
        "MAC Address",
        "Status",
        "Kondisi",
        "PIC Pemegang",
        "Lokasi Terkini",
        "Diperbarui (WIB)",
      ],
      rows: snapshot.units.map((u) => [
        s(u.id),
        s(u.item_code),
        s(u.item_name),
        s(u.serial_number),
        s(u.mac_address),
        s(u.status),
        s(u.condition),
        s(u.current_pic),
        s(u.current_location),
        s(u.updated_at),
      ]),
    },
    {
      tabName: INVENTORY_SHEET_TAB_NAMES.TRANSACTIONS,
      headers: [
        "ID Transaksi",
        "No. Transaksi",
        "Tipe",
        "Tanggal (WIB)",
        "Petugas Gudang",
        "Nama PIC",
        "No. HP PIC",
        "Departemen",
        "Lokasi",
        "Status",
        "Daftar Barang & Kuantitas",
        "Daftar Serial Number",
        "Catatan",
      ],
      rows: snapshot.transactions.map((t) => [
        s(t.id),
        s(t.transaction_number),
        s(t.type),
        s(t.transaction_date),
        s(t.warehouse_officer),
        s(t.pic_name),
        s(t.pic_phone),
        s(t.department),
        s(t.location),
        s(t.status),
        s(t.items_summary),
        s(t.serial_numbers),
        s(t.notes),
      ]),
    },
    {
      tabName: INVENTORY_SHEET_TAB_NAMES.RETURNS,
      headers: [
        "ID Return",
        "No. Return",
        "Ref. Transaksi Keluar",
        "Tanggal Kembali (WIB)",
        "PIC Pengembali",
        "Penerima Gudang",
        "Detail Barang & Kondisi",
        "Catatan",
      ],
      rows: snapshot.returns.map((r) => [
        s(r.id),
        s(r.return_number),
        s(r.out_transaction_number),
        s(r.return_date),
        s(r.pic_name),
        s(r.recipient_officer),
        s(r.details_summary),
        s(r.notes),
      ]),
    },
    {
      tabName: INVENTORY_SHEET_TAB_NAMES.REQUESTS,
      headers: [
        "ID Request",
        "No. Request",
        "Tanggal Request (WIB)",
        "Nama PIC",
        "No. HP",
        "Jenis Pekerjaan",
        "Lokasi Pengambilan",
        "Status",
        "Ref. Transaksi Keluar",
        "Diproses Oleh",
        "Daftar Barang Diminta",
        "Catatan",
      ],
      rows: snapshot.requests.map((req) => [
        s(req.id),
        s(req.request_number),
        s(req.request_date),
        s(req.pic_name),
        s(req.pic_phone),
        s(req.work_type_label),
        s(req.pickup_location),
        s(req.status),
        s(req.out_transaction_number),
        s(req.processed_by),
        s(req.items_summary),
        s(req.notes),
      ]),
    },
  ];
}

export const INVENTORY_MIRROR_APPS_SCRIPT_TEMPLATE = `/**
 * ACTIS Inventory Management -> Google Sheets & Google Drive Mirroring (Apps Script)
 *
 * Cara Pasang (2 Menit):
 * 1. Buat Google Spreadsheet baru (misal: "ACTIS Inventory Mirror"), lalu klik Extensions > Apps Script.
 * 2. Hapus isi editor dan tempel seluruh skrip ini.
 * 3. Opsional: Isi SHARED_SECRET sesuai token rahasia di ACTIS.
 * 4. Klik Deploy > New deployment > Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Salin Web App URL (/exec) ke menu Inventory Management > Mirror Google Drive / Sheets di ACTIS.
 */
const SHARED_SECRET = ""; // Opsional: samakan dengan Secret Token di ACTIS
const DEFAULT_DRIVE_BACKUP_FILE = "ACTIS_Inventory_Database_Mirror.json";

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return jsonOut({ success: false, error: "Server sibuk (lock timeout). Silakan coba sesaat lagi." });
  }

  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (SHARED_SECRET && payload.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: "Secret token tidak cocok." });
    }

    const ss = payload.spreadsheetId
      ? SpreadsheetApp.openById(payload.spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      return jsonOut({ success: false, error: "Spreadsheet target tidak ditemukan. Pasang script di dalam Google Sheets atau isi Spreadsheet ID." });
    }

    const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
    sheets.forEach(function (tab) {
      if (!tab || !tab.tabName) return;
      let sheet = ss.getSheetByName(tab.tabName);
      if (!sheet) {
        sheet = ss.insertSheet(tab.tabName);
      } else {
        sheet.clearContents();
      }

      const headers = Array.isArray(tab.headers) ? tab.headers : [];
      const rows = Array.isArray(tab.rows) ? tab.rows : [];
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground("#0f172a")
          .setFontColor("#ffffff")
          .setFontWeight("bold");
        sheet.setFrozenRows(1);
      }

      if (rows.length > 0 && headers.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
    });

    // Update tab Meta_Mirror_Sync untuk waktu sinkronisasi terakhir
    let metaSheet = ss.getSheetByName("Meta_Mirror_Sync");
    if (!metaSheet) metaSheet = ss.insertSheet("Meta_Mirror_Sync");
    metaSheet.clearContents();
    const summary = payload.summary || {};
    metaSheet.getRange(1, 1, 8, 2).setValues([
      ["Parameter", "Nilai"],
      ["Last Synced (WIB)", payload.generatedAtWib || ""],
      ["Event Trigger", payload.event || "MANUAL"],
      ["Triggered By", payload.triggeredBy || "System"],
      ["Total Master SKU", Number(summary.total_items || 0)],
      ["Total Stok Tersedia", Number(summary.total_available_stock || 0)],
      ["Total Serial Number", Number(summary.total_units || 0)],
      ["Total Riwayat Transaksi", Number(summary.total_transactions || 0)],
    ]);
    metaSheet.getRange(1, 1, 1, 2).setBackground("#065f46").setFontColor("#ffffff").setFontWeight("bold");

    // Hapus Sheet1 bawaan bila masih kosong dan sheet mirror sudah terbuat
    const defaultSheet1 = ss.getSheetByName("Sheet1");
    if (defaultSheet1 && ss.getSheets().length > 1 && defaultSheet1.getLastRow() === 0) {
      try { ss.deleteSheet(defaultSheet1); } catch (ignore) {}
    }

    SpreadsheetApp.flush();

    let driveFileId = "";
    let driveFileUrl = "";
    if (payload.saveDriveBackupJson && payload.snapshot) {
      const targetFolder = payload.folderId
        ? DriveApp.getFolderById(payload.folderId)
        : DriveApp.getRootFolder();
      const fileName = payload.driveBackupFileName || DEFAULT_DRIVE_BACKUP_FILE;
      const jsonContent = JSON.stringify(payload.snapshot, null, 2);
      const existingFiles = targetFolder.getFilesByName(fileName);
      let file;
      if (existingFiles.hasNext()) {
        file = existingFiles.next();
        file.setContent(jsonContent);
      } else {
        file = targetFolder.createFile(fileName, jsonContent, MimeType.PLAIN_TEXT);
      }
      driveFileId = file.getId();
      driveFileUrl = file.getUrl();
    }

    return jsonOut({
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      driveFileId: driveFileId || undefined,
      driveFileUrl: driveFileUrl || undefined,
      message: "Inventory database berhasil di-mirror ke Google Sheets" + (driveFileId ? " & Google Drive JSON" : "") + ".",
    });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonOut({
    success: true,
    service: "ACTIS Inventory Mirror Webhook Ready",
    timestamp: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"),
  });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;
