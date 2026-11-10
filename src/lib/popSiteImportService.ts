/**
 * Utility & Service untuk Import & Migrasi Data POP Site
 * Mendukung pembacaan CSV (koma / titik koma), validasi baris,
 * mapping header fleksibel, serta template CSV berstandar Excel.
 */

export interface PopSiteImportRow {
  site_id?: string;
  nama_pic: string;
  nama_perusahaan?: string;
  kontak_pic?: string;
  email_pic?: string;
  alamat_instalasi?: string;
  layanan_dedicated?: string;
  vlan?: number;
  infrastruktur?: string;
  media_koneksi?: string;
  server?: string;
  ip_public?: string;
  ip_private?: string;
  sn_ont?: string;
  sid?: string;
  ao?: string;
  nomor_order?: string;
  status_layanan?: string; // "Active" | "Isolir" | "Terminated"
  waktu_go_live?: string; // YYYY-MM-DD
  initial_ticket?: string;
  catatan?: string;
  // Metadata validasi
  _rowNumber: number;
  _isValid: boolean;
  _errors: string[];
  _warnings: string[];
}

/**
 * Mapping nama header CSV (baik bahasa Indonesia maupun Inggris, case-insensitive)
 * ke key properti PopSiteImportRow.
 */
const HEADER_KEY_MAP: Record<string, keyof PopSiteImportRow> = {
  // Site ID
  site_id: "site_id",
  siteid: "site_id",
  "site id": "site_id",
  "id site": "site_id",
  "kode site": "site_id",

  // Nama PIC / Pelanggan (Wajib)
  nama_pic: "nama_pic",
  namapic: "nama_pic",
  "nama pic": "nama_pic",
  pic: "nama_pic",
  "nama pelanggan": "nama_pic",
  pelanggan: "nama_pic",
  customer: "nama_pic",
  "nama site": "nama_pic",
  site_name: "nama_pic",

  // Perusahaan
  nama_perusahaan: "nama_perusahaan",
  namaperusahaan: "nama_perusahaan",
  "nama perusahaan": "nama_perusahaan",
  perusahaan: "nama_perusahaan",
  company: "nama_perusahaan",
  instansi: "nama_perusahaan",

  // Kontak PIC
  kontak_pic: "kontak_pic",
  kontakpic: "kontak_pic",
  "kontak pic": "kontak_pic",
  kontak: "kontak_pic",
  telepon: "kontak_pic",
  "no hp": "kontak_pic",
  "no telp": "kontak_pic",
  phone: "kontak_pic",
  whatsapp: "kontak_pic",
  wa: "kontak_pic",

  // Email PIC
  email_pic: "email_pic",
  emailpic: "email_pic",
  "email pic": "email_pic",
  email: "email_pic",

  // Alamat
  alamat_instalasi: "alamat_instalasi",
  alamatinstalasi: "alamat_instalasi",
  "alamat instalasi": "alamat_instalasi",
  alamat: "alamat_instalasi",
  lokasi: "alamat_instalasi",
  address: "alamat_instalasi",

  // Layanan / Bandwidth
  layanan_dedicated: "layanan_dedicated",
  layanandedicated: "layanan_dedicated",
  "layanan dedicated": "layanan_dedicated",
  layanan: "layanan_dedicated",
  bandwidth: "layanan_dedicated",
  kapasitas: "layanan_dedicated",
  paket: "layanan_dedicated",
  speed: "layanan_dedicated",

  // VLAN
  vlan: "vlan",
  "vlan id": "vlan",
  vlan_id: "vlan",

  // Infrastruktur
  infrastruktur: "infrastruktur",
  transmisi: "infrastruktur",
  infrastructure: "infrastruktur",

  // Media Koneksi
  media_koneksi: "media_koneksi",
  mediakoneksi: "media_koneksi",
  "media koneksi": "media_koneksi",
  "media transmisi": "media_koneksi",
  media: "media_koneksi",

  // Server / BRAS
  server: "server",
  bras: "server",
  "server / bras": "server",
  "server bras": "server",
  aggregator: "server",
  "server / bras aggregator": "server",

  // IP Public
  ip_public: "ip_public",
  ippublic: "ip_public",
  "ip public": "ip_public",
  "ip publik": "ip_public",
  public_ip: "ip_public",

  // IP Private
  ip_private: "ip_private",
  ipprivate: "ip_private",
  "ip private": "ip_private",
  "ip privat": "ip_private",
  private_ip: "ip_private",

  // SN ONT / Modem
  sn_ont: "sn_ont",
  snont: "sn_ont",
  "sn ont": "sn_ont",
  "sn modem": "sn_ont",
  "serial number ont": "sn_ont",
  "sn ont / modem": "sn_ont",

  // Parameter Sirkuit Partner
  sid: "sid",
  "circuit id": "sid",
  "circuit id (sid)": "sid",
  circuit_id: "sid",
  ao: "ao",
  "account order": "ao",
  "account order (ao)": "ao",
  account_order: "ao",
  nomor_order: "nomor_order",
  "nomor order": "nomor_order",
  "no order": "nomor_order",
  "nomor order provider": "nomor_order",
  order_number: "nomor_order",

  // Status Layanan
  status_layanan: "status_layanan",
  statuslayanan: "status_layanan",
  "status layanan": "status_layanan",
  status: "status_layanan",

  // Tanggal Go-Live
  waktu_go_live: "waktu_go_live",
  waktugolive: "waktu_go_live",
  "waktu go live": "waktu_go_live",
  "waktu go-live": "waktu_go_live",
  "tanggal go live": "waktu_go_live",
  "tanggal go-live": "waktu_go_live",
  "tgl go live": "waktu_go_live",
  go_live: "waktu_go_live",

  // Tiket Awal
  initial_ticket: "initial_ticket",
  initialticket: "initial_ticket",
  "initial ticket": "initial_ticket",
  "tiket awal": "initial_ticket",
  "no tiket": "initial_ticket",
  "nomor tiket": "initial_ticket",

  // Catatan
  catatan: "catatan",
  keterangan: "catatan",
  notes: "catatan",
};

/**
 * Parsing konten CSV (mendukung delimiter koma atau titik koma, quotes ganda, multi-line)
 */
export function parseCsvRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, ""); // hapus UTF-8 BOM jika ada
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  // Deteksi delimiter utama baris pertama (koma vs titik koma)
  const firstLine = cleanText.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote ("")
        currentField += '"';
        i++;
      } else {
        // Toggle quote status
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
      // Hanya tambahkan jika baris tidak kosong
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Sisa field di akhir file
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Mengubah string baris CSV menjadi array objek PopSiteImportRow yang telah divalidasi.
 */
export function parseAndValidatePopSiteCsv(csvText: string): {
  rows: PopSiteImportRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headers: string[];
} {
  const rawGrid = parseCsvRows(csvText);

  if (rawGrid.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      headers: [],
    };
  }

  const headerRow = rawGrid[0].map((h) => h.toLowerCase().trim());
  const headerKeys: Array<keyof PopSiteImportRow | null> = headerRow.map((rawHeader) => {
    return HEADER_KEY_MAP[rawHeader] || null;
  });

  const parsedRows: PopSiteImportRow[] = [];

  for (let r = 1; r < rawGrid.length; r++) {
    const rowValues = rawGrid[r];
    const rowObj: Partial<PopSiteImportRow> = {
      _rowNumber: r + 1, // 1-based baris pada file CSV (header = baris 1)
      _isValid: true,
      _errors: [],
      _warnings: [],
    };

    headerKeys.forEach((key, colIdx) => {
      if (!key) return;
      const rawVal = rowValues[colIdx] ? rowValues[colIdx].trim() : "";

      if (key === "vlan") {
        if (rawVal) {
          const parsedVlan = parseInt(rawVal, 10);
          if (!isNaN(parsedVlan) && parsedVlan > 0 && parsedVlan <= 4094) {
            rowObj.vlan = parsedVlan;
          } else {
            rowObj._warnings?.push(`VLAN '${rawVal}' bukan angka valid 1-4094`);
          }
        }
      } else if (key === "status_layanan") {
        const lower = rawVal.toLowerCase();
        if (lower === "isolir" || lower === "suspended") {
          rowObj.status_layanan = "Isolir";
        } else if (lower === "terminated" || lower === "tutup" || lower === "nonaktif") {
          rowObj.status_layanan = "Terminated";
        } else {
          rowObj.status_layanan = "Active";
        }
      } else {
        (rowObj as any)[key] = rawVal || undefined;
      }
    });

    // Validasi Field Wajib
    if (!rowObj.nama_pic || rowObj.nama_pic.trim().length === 0) {
      rowObj._errors?.push("Nama PIC / Pelanggan wajib diisi.");
      rowObj._isValid = false;
    }

    // Validasi format IP Public jika diisi
    if (rowObj.ip_public) {
      const cleanIp = rowObj.ip_public.replace(/\/32$/, "").trim();
      const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp);
      if (!isIpv4) {
        rowObj._warnings?.push(`Format IP Public '${rowObj.ip_public}' mungkin bukan format IPv4 standar.`);
      }
    }

    // Default status jika kosong
    if (!rowObj.status_layanan) {
      rowObj.status_layanan = "Active";
    }

    // Validasi tanggal go live jika diisi
    if (rowObj.waktu_go_live) {
      const parsedDate = new Date(rowObj.waktu_go_live);
      if (isNaN(parsedDate.getTime())) {
        rowObj._warnings?.push(`Format Tanggal Go-Live '${rowObj.waktu_go_live}' tidak valid, akan menggunakan waktu sekarang.`);
        rowObj.waktu_go_live = undefined;
      }
    }

    parsedRows.push(rowObj as PopSiteImportRow);
  }

  const validCount = parsedRows.filter((r) => r._isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    headers: rawGrid[0],
  };
}

/**
 * Menghasilkan isi file template CSV resmi untuk Import POP Site (UTF-8 dengan BOM)
 */
export function generatePopSiteCsvTemplate(): string {
  const headers = [
    "Site ID",
    "Nama PIC",
    "Kontak PIC",
    "Alamat Instalasi",
    "Layanan",
    "VLAN ID",
    "Infrastruktur",
    "Media Koneksi",
    "Server BRAS",
    "IP Public",
    "IP Private",
    "SN ONT",
    "Circuit ID (SID)",
    "Account Order (AO)",
    "Nomor Order Provider",
    "Status Layanan",
    "Tanggal Go Live",
    "Tiket Awal",
    "Catatan",
  ];

  const sampleRows = [
    [
      "", // Kosongkan agar Site ID otomatis dibuat (atau isi misal POP-202611-0010)
      "HANYA",
      "081234567890",
      "Jl. Dr. Muwardi No. 12, Cianjur",
      "100Mbps",
      "3005",
      "METRONEXIA",
      "SFP",
      "CIANJUR (GEKBRONG)",
      "103.97.111.1",
      "192.168.1.1/31",
      "ZTEGC992123",
      "TELKOM-METRO-9812",
      "AO-2026-JKT-8821",
      "ORD-TLK-771290",
      "Active",
      "2026-11-01",
      "", // Kosongkan agar nomor tiket otomatis dibuat unik (MIG-...)
      "Migrasi dari database POP eksisting",
    ],
    [
      "", // Kosongkan agar Site ID otomatis di-generate (contoh: POP-202611-0006)
      "Bpk. Budi Santoso",
      "085712345678",
      "Kawasan Industri Cileungsi Blok A3",
      "Metro-E 100 Mbps",
      "1420",
      "Wireless PTP",
      "Radio Ubiquiti",
      "CIANJUR (GEKBRONG)",
      "103.97.140.45",
      "192.168.1.5/31",
      "HWTC887766",
      "TELKOM-METRO-9815",
      "AO-2026-JKT-8825",
      "ORD-TLK-771295",
      "Active",
      "2026-11-05",
      "", // Kosongkan agar Nomor Tiket dibuat otomatis (MIG-...)
      "Contoh baris baru tanpa Site ID (akan otomatis dibuatkan)",
    ],
  ];

  const escapeCsvCell = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes(";")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...sampleRows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n");

  // Prepend UTF-8 BOM (\uFEFF) agar Microsoft Excel otomatis mengenali encoding dengan tepat
  return "\uFEFF" + csvContent;
}

