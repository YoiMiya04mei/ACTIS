export type ActivityType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_CLOSED"
  | "CREATE_TICKET"
  | "UPDATE_ORDER"
  | "UPDATE_SITE"
  | "DELETE_SITE"
  | "IMPORT_DATA"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "PASSWORD_CHANGE"
  | "SETTING_UPDATE"
  | "MONITORING_ALERT"
  | "SHEETS_SYNC"
  | "DOCUMENT"
  | "DOCUMENT_GENERATE"
  | "SETTINGS"
  | "BACKUP_AUTO"
  | "BACKUP_MANUAL"
  | "BACKUP_FAILED"
  | "CREATE_DEVICE"
  | "UPDATE_DATA"
  | "DELETE_DATA"
  | "SYSTEM";

export interface AppActivityLogItem {
  id: string;
  nama_lengkap: string;
  email?: string | null;
  ip_address: string;
  tipe: ActivityType;
  aktifitas: string;
  detail?: string | null;
  user_agent?: string | null;
  created_at: string; // ISO string
}

export function formatLogDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

