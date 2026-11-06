# Google Apps Script Webhook Engine for ACTIS

This folder contains the complete Google Apps Script code to power the **Secondary Mirror (Google Spreadsheet Engine)** for ACTIS.

## Features
- **Sheet 1 (`Aktivasi_POP_Site`)**: 1 row per activation ticket. When an order status or note changes in ACTIS, it updates the corresponding row in place using `ticket_number`.
- **Sheet 2 (`NOC_Progress_Audit`)**: Append-only audit log capturing every single activity, NOC note, status change, and test result link with exact timestamps.
- **Lock Management**: Uses `LockService` to prevent race conditions during high-concurrency NOC shifts.
- **One-click Setup**: `setupSheets()` automatically styles header rows with branded ISP colors and freezes the top row.

## Setup Instructions

1. Create a Google Spreadsheet in your Google Drive (e.g. named `ACTIS - Provisioning Database`).
2. Go to **Extensions** > **Apps Script**.
3. Replace the content of `Code.gs` with the content of [`google-apps-script/Code.gs`](./Code.gs).
4. In the Apps Script toolbar, select the function **`setupSheets`** and click **Run**. Grant required permissions.
5. Notice two sheets will appear with formatted headers:
   - `Aktivasi_POP_Site` (Navy blue header)
   - `NOC_Progress_Audit` (Emerald green header)
6. Click **Deploy** > **New deployment**:
   - Select type: **Web app**
   - Description: `ACTIS Production Mirror`
   - Execute as: **Me (your-email@gmail.com)**
   - Who has access: **Anyone** *(Important: Allows ACTIS background worker to send HTTP POST requests without user interaction)*
7. Copy the generated Web App URL:
   `https://script.google.com/macros/s/AKfyc.../exec`
8. In ACTIS:
   - Paste this URL in `.env` as `GOOGLE_APPS_SCRIPT_WEBHOOK_URL` or
   - Enter it in the ACTIS Admin Settings panel under **Google Sheets Integration**!
9. You can also click the **"Force Sync to Sheets"** button in ACTIS Admin anytime to test connectivity and sync all existing orders!

