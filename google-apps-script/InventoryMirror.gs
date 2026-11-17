/**
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
}
