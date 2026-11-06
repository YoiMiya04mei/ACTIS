/**
 * ACTIS (Activation, Configuration, & Termination ISP System)
 * Google Apps Script Webhook Engine for Dual-Database Mirroring
 * 
 * Instructions:
 * 1. Open Google Sheets (create a new blank spreadsheet or use an existing one).
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete existing code and paste this entire file.
 * 4. Run `setupSheets()` once to automatically create and format the two sheets:
 *    - Sheet 1: "Aktivasi_POP_Site" (Primary row per ticket, dynamic status updates)
 *    - Sheet 2: "NOC_Progress_Audit" (Immutable append-only progress log)
 * 5. Click "Deploy" > "New deployment" > Select type "Web app".
 *    - Description: "ACTIS Mirroring Endpoint"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (allows ACTIS server to post without OAuth prompt)
 * 6. Copy the Web App URL and paste it into ACTIS Admin Panel (.env or System Settings).
 */

const SHEET_NAMES = {
  AKTIVASI: "Aktivasi_POP_Site",
  AUDIT: "NOC_Progress_Audit"
};

/**
 * One-click initialization: Creates and formats header rows with ISP theme styling
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Setup Sheet 1: Aktivasi_POP_Site
  let sheet1 = ss.getSheetByName(SHEET_NAMES.AKTIVASI);
  if (!sheet1) {
    sheet1 = ss.insertSheet(SHEET_NAMES.AKTIVASI);
  }

  const headers1 = [
    "Ticket Number",
    "Status",
    "Nama PIC",
    "Kontak PIC",
    "Alamat Instalasi",
    "IP Public",
    "IP Private",
    "VLAN",
    "Layanan Dedicated",
    "Server / BRAS",
    "Infrastruktur",
    "Media Koneksi",
    "SN ONT",
    "SID Telkom",
    "AO Telkom",
    "Nomor Order Telkom",
    "Waktu Aktivasi",
    "Created At",
    "Completed At",
    "Test Result Links",
    "Last Progress Note",
    "Last Updated By",
    "Last Synced At"
  ];

  sheet1.getRange(1, 1, 1, headers1.length).setValues([headers1]);
  sheet1.getRange(1, 1, 1, headers1.length)
    .setBackground("#1e3a8a") // Deep Navy Blue
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet1.setFrozenRows(1);

  // 2. Setup Sheet 2: NOC_Progress_Audit (Append-only)
  let sheet2 = ss.getSheetByName(SHEET_NAMES.AUDIT);
  if (!sheet2) {
    sheet2 = ss.insertSheet(SHEET_NAMES.AUDIT);
  }

  const headers2 = [
    "Timestamp",
    "Event",
    "Ticket Number",
    "Status Sebelum",
    "Status Sesudah / Current",
    "Updated By",
    "Catatan Progress",
    "VLAN",
    "Media Koneksi",
    "SID",
    "Test Result Links"
  ];

  sheet2.getRange(1, 1, 1, headers2.length).setValues([headers2]);
  sheet2.getRange(1, 1, 1, headers2.length)
    .setBackground("#065f46") // Emerald Green NOC Theme
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet2.setFrozenRows(1);

  SpreadsheetApp.flush();
  Logger.log("ACTIS Google Sheets successfully initialized!");
}

/**
 * Webhook handler receiving JSON payloads from ACTIS backend
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Wait up to 30 seconds for concurrent requests
  const lockAcquired = lock.tryLock(30000);
  if (!lockAcquired) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Server busy, could not acquire spreadsheet lock."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No POST body received."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure sheets exist
    let sheet1 = ss.getSheetByName(SHEET_NAMES.AKTIVASI);
    let sheet2 = ss.getSheetByName(SHEET_NAMES.AUDIT);
    if (!sheet1 || !sheet2) {
      setupSheets();
      sheet1 = ss.getSheetByName(SHEET_NAMES.AKTIVASI);
      sheet2 = ss.getSheetByName(SHEET_NAMES.AUDIT);
    }

    const ticketNumber = payload.ticket_number || "";
    const testLinks = Array.isArray(payload.test_result_links) 
      ? payload.test_result_links.join(", ") 
      : (payload.test_result_links || "");

    const kontak = Array.isArray(payload.kontak_pic) 
      ? payload.kontak_pic.join(", ") 
      : (payload.kontak_pic || "");

    const nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    // ==========================================
    // 1. UPDATE SHEET 1: Aktivasi_POP_Site (Row per ticket)
    // ==========================================
    if (ticketNumber) {
      const data1 = sheet1.getDataRange().getValues();
      let rowIndex = -1;

      // Search for ticket number in column 1 (index 0)
      for (let i = 1; i < data1.length; i++) {
        if (String(data1[i][0]).trim() === String(ticketNumber).trim()) {
          rowIndex = i + 1; // 1-based index
          break;
        }
      }

      const rowValues = [
        ticketNumber,
        payload.status || "",
        payload.nama_pic || "",
        kontak,
        payload.alamat_instalasi || "",
        payload.ip_public || "",
        payload.ip_private || "",
        payload.vlan || "",
        payload.layanan_dedicated || "",
        payload.server || "",
        payload.infrastruktur || "",
        payload.media_koneksi || "",
        payload.sn_ont || "",
        payload.sid || "",
        payload.ao || "",
        payload.nomor_order || "",
        payload.waktu_aktivasi || "",
        payload.created_at || nowStr,
        payload.completed_at || "",
        testLinks,
        payload.progress_note || payload.catatan_progress || "",
        payload.updated_by || "",
        nowStr
      ];

      if (rowIndex > 0) {
        // Update existing row
        sheet1.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        // Append new ticket row
        sheet1.appendRow(rowValues);
      }
    }

    // ==========================================
    // 2. APPEND TO SHEET 2: NOC_Progress_Audit (Immutable audit log)
    // ==========================================
    const auditRow = [
      payload.timestamp || nowStr,
      payload.event || "PROGRESS_UPDATE",
      ticketNumber,
      payload.status_sebelum || "-",
      payload.status_sesudah || payload.status || "-",
      payload.updated_by || "System",
      payload.progress_note || payload.catatan_progress || "Updated",
      payload.vlan || "",
      payload.media_koneksi || "",
      payload.sid || "",
      testLinks
    ];

    sheet2.appendRow(auditRow);

    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Sync completed successfully.",
      ticket_number: ticketNumber,
      event: payload.event,
      timestamp: nowStr
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Test ping function for GET request
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "ACTIS Google Apps Script Webhook Engine",
    time: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")
  })).setMimeType(ContentService.MimeType.JSON);
}

