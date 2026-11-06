# ACTIS (Activation, Configuration, & Termination ISP System)

Enterprise ISP Service Provisioning & NOC Lifecycle Management Platform with Decoupled Dual-Database Architecture (Primary SQL + Async Google Spreadsheet Mirroring).

---

## 🌟 Key Features

1. **Decoupled Dual-Backend Storage Architecture**:
   - **Primary Database (SQL with Prisma ORM)**: High-speed relational storage (SQLite local / PostgreSQL / MySQL) handling transactional integrity, FK constraints, lifecycle locking, and audit feeds.
   - **Secondary Mirror (Google Spreadsheet Engine)**:
     - **Sheet 1 (`Aktivasi_POP_Site`)**: Synchronizes master order details (1 row per ticket, dynamic in-place status updates).
     - **Sheet 2 (`NOC_Progress_Audit`)**: Captures append-only periodic logs from NOC engineers with precise timestamps.
     - **Manual `Force Sync to Sheets`**: Panel in Admin for on-demand bulk resynchronization and connectivity audits.

2. **Core Business Rules & Barriers Enforced**:
   - **Completion Barrier**: The order status is strictly forbidden from changing to `Completed` unless at least one valid test result file (Speedtest, OPM optical power meter, or ping latency) has been uploaded. This barrier is enforced on both the backend API (HTTP 422) and frontend UI (auto-enabling action button).
   - **Conditional Metro Telkom Media**: When `media_koneksi == "Metro Telkom"`, `SID`, `AO`, and `Nomor Order` fields appear dynamically and are validated. For any other connection medium, these fields remain hidden and evaluate to `NULL`.
   - **Audit Trail Immutability**: `order_progress_logs` records are strictly append-only. There are no delete or update endpoints, preserving NOC team accountability.
   - **Automatic Ticket Formatting**: Tickets strictly follow sequential formatting: `ACT-YYYYMMDD-XXXX`.

3. **User Experience & NOC Workspaces**:
   - **Screen 1 (`/orders/new`)**: POP Site Registration form with dynamic PIC/WhatsApp contact tag inputs, 2-column network routing grid, Metro Telkom conditional card, and schedule picker.
   - **Screen 2 (`/queue`)**: Real-time antrean board with status pills (Antrian, In Progress, Completed, Pending), live search, media filter, stats overview, and card/table toggle views.
   - **Screen 3 (`/orders/:id/progress`)**: NOC Split-View Workspace with sticky left technical specs, 1-click `Copy Config Format` (formatted for WhatsApp/Telegram coordination groups), quick status trigger (`Ambil Tiket / Start Processing`), chronological timeline feed, multi-file dropzone, image lightbox, and `Selesaikan Aktivasi (Complete)`.
   - **Admin & Sync Panel (`/admin/sync`)**: Manage Webhook URL, view real-time sync dispatch logs, test connectivity, and trigger manual Force Sync.

4. **Multi-Platform Ready**:
   - Web App responsive for Desktop, Tablet, and Mobile.
   - PWA configured with `/manifest.json` and standalone capability.
   - APK-ready via Capacitor (`capacitor.config.json`).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm or pnpm

### 2. Installation & Database Setup
```bash
# Install dependencies
npm install

# Push database schema (Prisma + SQLite/PostgreSQL)
npm run db:push

# Seed demo users, sample orders, and settings
npm run db:seed
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated E2E Verification Tests
To test all 15 business rules (Completion Barrier, Metro Telkom conditionals, ticket formatting, immutability, etc.):
```bash
npm test
```

---

## 📊 Google Sheets Mirroring Integration

1. Open Google Sheets and create a new spreadsheet.
2. Go to **Extensions** > **Apps Script**.
3. Copy and paste the entire code from [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
4. Run the function `setupSheets()` once to auto-create and style the two required sheets:
   - `Aktivasi_POP_Site` (Navy Header)
   - `NOC_Progress_Audit` (Emerald Green Header)
5. Click **Deploy** > **New deployment** > Type: **Web app** > Access: **Anyone**.
6. Copy the Web App URL and paste it into the ACTIS Admin Panel at [http://localhost:3000/admin/sync](http://localhost:3000/admin/sync) or in `.env` as `GOOGLE_APPS_SCRIPT_WEBHOOK_URL`.
7. Click **Force Sync to Sheets** to synchronize all orders immediately!

---

## 📱 Mobile APK Build (via Capacitor)

```bash
# 1. Build the production web assets
npm run build

# 2. Add Android platform (if using Capacitor CLI)
npx cap add android

# 3. Sync web assets
npx cap sync

# 4. Open Android Studio to build APK
npx cap open android
```

---

## 👥 Demo Users & Roles Switcher
The system includes an active role switcher in the top navigation bar:
- **Ahmad Fauzi** (`admin`): Head of NOC
- **Budi Santoso** (`noc_engineer`): NOC Engineer
- **Reza Pratama** (`noc_engineer`): Senior NOC
- **Dimas Kurniawan** (`field_engineer`): Field Engineer
- **Sarah Novita** (`sales_corporate`): Sales Corporate

