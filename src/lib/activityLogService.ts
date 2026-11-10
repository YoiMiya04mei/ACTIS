import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ActivityType, AppActivityLogItem, formatLogDate } from "@/types/activityLog";

export type { ActivityType, AppActivityLogItem };
export { formatLogDate };

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "activity_logs.json");

// Initial realistic seed logs matching user screenshot
const INITIAL_SEED_LOGS: AppActivityLogItem[] = [
  {
    id: "log-seed-001",
    nama_lengkap: "PERMADI PRATAMA",
    email: "permadi.pratama@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "LOGIN_SUCCESS",
    aktifitas: "Berhasil login ke aplikasi — Chrome 157 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0",
    created_at: new Date(Date.now() - 34000).toISOString(), // ~10:08:06
  },
  {
    id: "log-seed-002",
    nama_lengkap: "customerservice",
    email: "cs@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "LOGIN_FAILED",
    aktifitas: "Login gagal — username customerservice — Chrome 157 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0",
    created_at: new Date(Date.now() - 51000).toISOString(), // ~10:07:49
  },
  {
    id: "log-seed-003",
    nama_lengkap: "KASIR JDP",
    email: "kasir@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "CREATE_TICKET",
    aktifitas: "Membuat tiket dengan nomor T814886",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 268000).toISOString(), // ~10:04:12
  },
  {
    id: "log-seed-004",
    nama_lengkap: "KASIR JDP",
    email: "kasir@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "CREATE_TICKET",
    aktifitas: "Membuat tiket dengan nomor T534423",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 547000).toISOString(), // ~09:59:33
  },
  {
    id: "log-seed-005",
    nama_lengkap: "INTAN R",
    email: "intan.r@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "UPDATE_SITE",
    aktifitas: "Menambah data langganan 26220053301",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 647000).toISOString(), // ~09:57:53
  },
  {
    id: "log-seed-006",
    nama_lengkap: "KASIR JDP",
    email: "kasir@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "SESSION_CLOSED",
    aktifitas: "Sesi ditutup — login baru dari Chrome 156 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 709000).toISOString(), // ~09:56:51
  },
  {
    id: "log-seed-007",
    nama_lengkap: "KASIR JDP",
    email: "kasir@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "LOGIN_SUCCESS",
    aktifitas: "Berhasil login ke aplikasi — Chrome 156 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 714000).toISOString(), // ~09:56:46
  },
  {
    id: "log-seed-008",
    nama_lengkap: "NURUL ANGGRIANA YUSUF",
    email: "nurul.ay@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "LOGIN_SUCCESS",
    aktifitas: "Berhasil login ke aplikasi via Remember Me — Chrome 156 · Android",
    user_agent: "Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 715000).toISOString(), // ~09:56:45
  },
  {
    id: "log-seed-009",
    nama_lengkap: "KASIR JDP",
    email: "kasir@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "SESSION_CLOSED",
    aktifitas: "Sesi ditutup — login baru dari Chrome 156 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
    created_at: new Date(Date.now() - 719000).toISOString(), // ~09:56:41
  },
  {
    id: "log-seed-010",
    nama_lengkap: "Ahmad Fauzi (Head of NOC)",
    email: "admin.noc@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "LOGIN_SUCCESS",
    aktifitas: "Berhasil login ke aplikasi — Chrome 157 · Windows",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0",
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: "log-seed-011",
    nama_lengkap: "Budi Santoso (NOC Engineer)",
    email: "budi.santoso@isp-enterprise.net",
    ip_address: "103.155.196.63",
    tipe: "UPDATE_ORDER",
    aktifitas: "Mengubah status tiket ACT-20261109-0003 menjadi In Progress",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0.0.0",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

// Helper to ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Read logs from local file
function readLogsFromFile(): AppActivityLogItem[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, JSON.stringify(INITIAL_SEED_LOGS, null, 2), "utf8");
      return INITIAL_SEED_LOGS;
    }
    const data = fs.readFileSync(LOG_FILE, "utf8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (err) {
    console.error("Failed to read activity logs:", err);
    return [];
  }
}

// Write logs to local file
function writeLogsToFile(logs: AppActivityLogItem[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write activity logs:", err);
  }
}

export function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Chrome 157 · Windows";

  let browser = "Browser";
  if (ua.includes("Edg/")) {
    const m = ua.match(/Edg\/(\d+)/);
    browser = `Edge ${m ? m[1] : ""}`;
  } else if (ua.includes("Chrome/")) {
    const m = ua.match(/Chrome\/(\d+)/);
    browser = `Chrome ${m ? m[1] : ""}`;
  } else if (ua.includes("Firefox/")) {
    const m = ua.match(/Firefox\/(\d+)/);
    browser = `Firefox ${m ? m[1] : ""}`;
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    const m = ua.match(/Version\/(\d+)/);
    browser = `Safari ${m ? m[1] : ""}`;
  }

  let os = "Windows";
  if (ua.includes("Windows NT 10.0") || ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser.trim()} · ${os}`;
}

export async function recordActivity(data: {
  nama_lengkap: string;
  email?: string | null;
  ip_address?: string;
  tipe?: ActivityType;
  aktifitas: string;
  detail?: string | null;
  user_agent?: string | null;
}): Promise<AppActivityLogItem> {
  const newLog: AppActivityLogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    nama_lengkap: data.nama_lengkap || "SISTEM",
    email: data.email || null,
    ip_address: data.ip_address || "103.155.196.63",
    tipe: data.tipe || "INFO" as any,
    aktifitas: data.aktifitas,
    detail: data.detail || null,
    user_agent: data.user_agent || null,
    created_at: new Date().toISOString(),
  };

  try {
    const logs = readLogsFromFile();
    logs.unshift(newLog); // Prepend to beginning
    // Keep last 5,000 logs
    if (logs.length > 5000) {
      logs.splice(5000);
    }
    writeLogsToFile(logs);
  } catch (e) {
    console.error("Error writing activity log to file:", e);
  }

  // Also try persisting to Postgres table if database is running
  try {
    await (prisma as any).$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS app_activity_logs (
        id VARCHAR(64) PRIMARY KEY,
        nama_lengkap VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        ip_address VARCHAR(64) NOT NULL,
        tipe VARCHAR(64) NOT NULL,
        aktifitas TEXT NOT NULL,
        detail TEXT,
        user_agent VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    );
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO app_activity_logs (id, nama_lengkap, email, ip_address, tipe, aktifitas, detail, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      newLog.id,
      newLog.nama_lengkap,
      newLog.email,
      newLog.ip_address,
      newLog.tipe,
      newLog.aktifitas,
      newLog.detail,
      newLog.user_agent
    );
  } catch {
    // If DB is offline, file log acts as source of truth
  }

  return newLog;
}

export async function getActivityLogs(options?: {
  search?: string;
  tipe?: string;
  page?: number;
  limit?: number;
  sortBy?: "nama_lengkap" | "ip_address" | "created_at" | "aktifitas";
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}): Promise<{
  logs: AppActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  let logs = readLogsFromFile();

  const search = options?.search?.toLowerCase().trim();
  const tipe = options?.tipe;
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);
  const sortBy = options?.sortBy || "created_at";
  const sortOrder = options?.sortOrder || "desc";

  // Filter by search
  if (search) {
    logs = logs.filter(
      (l) =>
        l.nama_lengkap.toLowerCase().includes(search) ||
        l.ip_address.toLowerCase().includes(search) ||
        l.aktifitas.toLowerCase().includes(search) ||
        (l.email && l.email.toLowerCase().includes(search))
    );
  }

  // Filter by tipe
  if (tipe && tipe !== "ALL") {
    if (tipe === "LOGIN") {
      logs = logs.filter(
        (l) =>
          l.tipe === "LOGIN_SUCCESS" ||
          l.tipe === "LOGIN_FAILED" ||
          l.tipe === "LOGOUT" ||
          l.tipe === "SESSION_CLOSED"
      );
    } else if (tipe === "TICKET") {
      logs = logs.filter((l) => l.tipe === "CREATE_TICKET" || l.tipe === "UPDATE_ORDER");
    } else if (tipe === "DATA") {
      logs = logs.filter(
        (l) =>
          l.tipe === "UPDATE_SITE" ||
          l.tipe === "IMPORT_DATA" ||
          l.tipe === "CREATE_USER" ||
          l.tipe === "UPDATE_USER" ||
          l.tipe === "DELETE_USER" ||
          l.tipe === "PASSWORD_CHANGE" ||
          l.tipe === "SETTING_UPDATE" ||
          l.tipe === "SHEETS_SYNC"
      );
    } else if (tipe === "DOCS") {
      logs = logs.filter((l) => l.tipe === "DOCUMENT" || l.tipe === "DOCUMENT_GENERATE");
    } else {
      logs = logs.filter((l) => l.tipe === tipe);
    }
  }

  // Filter by Date
  if (options?.startDate) {
    const start = new Date(options.startDate).getTime();
    if (!isNaN(start)) {
      logs = logs.filter((l) => new Date(l.created_at).getTime() >= start);
    }
  }
  if (options?.endDate) {
    const end = new Date(options.endDate).getTime();
    if (!isNaN(end)) {
      logs = logs.filter((l) => new Date(l.created_at).getTime() <= end);
    }
  }

  // Sort
  logs.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "created_at") {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === "nama_lengkap") {
      cmp = a.nama_lengkap.localeCompare(b.nama_lengkap);
    } else if (sortBy === "ip_address") {
      cmp = a.ip_address.localeCompare(b.ip_address);
    } else if (sortBy === "aktifitas") {
      cmp = a.aktifitas.localeCompare(b.aktifitas);
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const total = logs.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedLogs = logs.slice(startIndex, startIndex + limit);

  return {
    logs: paginatedLogs,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function clearActivityLogs(): Promise<void> {
  writeLogsToFile([]);
  try {
    await (prisma as any).$executeRawUnsafe(`TRUNCATE TABLE app_activity_logs`);
  } catch {}
}

