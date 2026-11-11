import { prisma } from "@/lib/prisma";

export type NotificationCategory =
  | "icmp"
  | "ticket"
  | "site"
  | "backup"
  | "sync"
  | "security";

export type NotificationSeverity =
  | "critical"
  | "warning"
  | "info"
  | "success"
  | "backup";

export interface AppNotificationItem {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  badge: string;
  subtitle: string;
  timestamp: string;
  href: string;
  read: boolean;
}

interface NotificationReadState {
  readIds: string[];
  readAllBefore: string | null;
}

const NOTIF_SETTING_PREFIX = "notif_state:";
const MAX_READ_IDS = 200;

function getSettingKey(userKey: string): string {
  const safeKey = userKey.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "default";
  return `${NOTIF_SETTING_PREFIX}${safeKey}`;
}

async function getNotificationReadState(userKey: string): Promise<NotificationReadState> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: getSettingKey(userKey) },
    });
    if (!row?.value) {
      return { readIds: [], readAllBefore: null };
    }
    const parsed = JSON.parse(row.value);
    return {
      readIds: Array.isArray(parsed?.readIds) ? parsed.readIds.filter((x: unknown) => typeof x === "string") : [],
      readAllBefore: typeof parsed?.readAllBefore === "string" ? parsed.readAllBefore : null,
    };
  } catch {
    return { readIds: [], readAllBefore: null };
  }
}

async function saveNotificationReadState(userKey: string, state: NotificationReadState): Promise<void> {
  const payload: NotificationReadState = {
    readIds: state.readIds.slice(0, MAX_READ_IDS),
    readAllBefore: state.readAllBefore,
  };
  await prisma.systemSetting.upsert({
    where: { key: getSettingKey(userKey) },
    update: { value: JSON.stringify(payload) },
    create: {
      key: getSettingKey(userKey),
      value: JSON.stringify(payload),
    },
  });
}

async function fetchIcmpDownNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const downMonitors = await prisma.icmpMonitor.findMany({
      where: { is_active: true, status: "DOWN" },
      include: {
        pop_site: {
          select: { site_id: true, kategori_layanan: true },
        },
      },
      orderBy: { updated_at: "desc" },
      take: 12,
    });

    const items = await Promise.all(
      downMonitors.map(async (m) => {
        let outageStart: Date = m.last_checked_at || m.updated_at;
        try {
          const lastUp = await prisma.icmpHeartbeat.findFirst({
            where: { monitor_id: m.id, status: "UP" },
            orderBy: { created_at: "desc" },
            select: { created_at: true },
          });
          const firstDownAfterUp = await prisma.icmpHeartbeat.findFirst({
            where: {
              monitor_id: m.id,
              status: "DOWN",
              ...(lastUp ? { created_at: { gt: lastUp.created_at } } : {}),
            },
            orderBy: { created_at: "asc" },
            select: { created_at: true },
          });
          if (firstDownAfterUp?.created_at) {
            outageStart = firstDownAfterUp.created_at;
          }
        } catch {
          // Fallback to monitor timestamp
        }

        const ts = outageStart.toISOString();
        const siteCode = m.pop_site?.site_id ? ` • ${m.pop_site.site_id}` : "";
        return {
          id: `icmp-down:${m.id}:${ts}`,
          category: "icmp" as const,
          severity: "critical" as const,
          title: m.name,
          badge: "ICMP Down",
          subtitle: `${m.ip_address} • ${m.kategori}${siteCode}`,
          timestamp: ts,
          href: "/monitoring",
        };
      })
    );

    return items;
  } catch {
    return [];
  }
}

async function fetchOrderNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const orders = await prisma.popSiteOrder.findMany({
      where: {
        status: { not: "Cancelled" },
        OR: [
          { status: { in: ["Antrian Aktivasi", "Pending Issue", "In Progress"] } },
          { created_at: { gte: fourteenDaysAgo } },
        ],
      },
      include: {
        progress_logs: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: { created_at: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 15,
    });

    return orders.map((o) => {
      let severity: NotificationSeverity = "info";
      let badge = o.tipe_order || "Antrean";

      if (o.status === "Pending Issue") {
        severity = "warning";
        badge = "Pending Issue";
      } else if (o.status === "Completed") {
        severity = "success";
        badge = "Aktivasi Selesai";
      } else if (o.status === "In Progress") {
        severity = "info";
        badge = "In Progress";
      } else if (o.status === "Terminated" || o.tipe_order === "Isolir" || o.tipe_order === "Terminate") {
        severity = "warning";
        badge = o.status === "Terminated" ? "Terminated" : o.tipe_order;
      }

      const eventDate = o.progress_logs[0]?.created_at || o.completed_at || o.created_at;
      const serviceMeta = [
        o.ticket_number,
        o.kategori_layanan + (o.sub_layanan ? ` (${o.sub_layanan})` : ""),
        o.layanan_dedicated || o.kapasitas_layanan,
      ]
        .filter(Boolean)
        .join(" • ");

      return {
        id: `order:${o.id}:${o.status}:${o.tipe_order}`,
        category: "ticket" as const,
        severity,
        title: o.nama_perusahaan || o.nama_pic || o.ticket_number,
        badge,
        subtitle: serviceMeta,
        timestamp: eventDate.toISOString(),
        href: `/orders/${o.id}/progress`,
      };
    });
  } catch {
    return [];
  }
}

async function fetchIsolirSiteNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const sites = await prisma.popSite.findMany({
      where: { status_layanan: "Isolir" },
      orderBy: { updated_at: "desc" },
      take: 6,
      select: {
        id: true,
        site_id: true,
        kategori_layanan: true,
        nama_pic: true,
        nama_perusahaan: true,
        ip_public: true,
        updated_at: true,
      },
    });

    return sites.map((s) => {
      const ts = s.updated_at.toISOString();
      const targetHref =
        s.kategori_layanan === "Enterprise" ? `/enterprise/${s.id}` : `/pop-sites/${s.id}`;
      return {
        id: `site-isolir:${s.id}:${ts}`,
        category: "site" as const,
        severity: "warning" as const,
        title: s.nama_perusahaan || s.nama_pic || s.site_id,
        badge: "Site Isolir",
        subtitle: `${s.site_id} • ${s.kategori_layanan}${s.ip_public ? ` • ${s.ip_public}` : ""}`,
        timestamp: ts,
        href: targetHref,
      };
    });
  } catch {
    return [];
  }
}

async function fetchBackupNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const backups = await prisma.networkConfigBackup.findMany({
      where: {
        created_at: { gte: fourteenDaysAgo },
        OR: [
          { status: "FAILED" },
          { gdrive_status: "FAILED" },
          { status: "SUCCESS", changed_from_prev: true },
        ],
      },
      include: {
        device: {
          select: { name: true, vendor: true, host: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    return backups.map((b) => {
      const vendorLabel = (b.device?.vendor || "device").toUpperCase();
      const hostLabel = b.device?.host ? ` (${b.device.host})` : "";

      if (b.status === "FAILED") {
        return {
          id: `backup-fail:${b.id}`,
          category: "backup" as const,
          severity: "critical" as const,
          title: b.device?.name || "Perangkat Jaringan",
          badge: "Backup Gagal",
          subtitle: `${vendorLabel}${hostLabel} • ${b.error_message || "Gagal mengambil konfigurasi"}`,
          timestamp: b.created_at.toISOString(),
          href: "/backups",
        };
      }

      if (b.gdrive_status === "FAILED") {
        return {
          id: `backup-gdrive:${b.id}`,
          category: "backup" as const,
          severity: "warning" as const,
          title: b.device?.name || "Perangkat Jaringan",
          badge: "GDrive Gagal",
          subtitle: `${vendorLabel}${hostLabel} • ${b.gdrive_error || "Gagal sinkronisasi Google Drive"}`,
          timestamp: b.created_at.toISOString(),
          href: "/backups",
        };
      }

      return {
        id: `backup-chg:${b.id}`,
        category: "backup" as const,
        severity: "backup" as const,
        title: b.device?.name || "Perangkat Jaringan",
        badge: "Config Berubah",
        subtitle: `${vendorLabel}${hostLabel} • +${b.diff_added} / -${b.diff_removed} baris (${b.backup_type})`,
        timestamp: b.created_at.toISOString(),
        href: "/backups",
      };
    });
  } catch {
    // Gracefully return empty if backup tables are not yet pushed locally
    return [];
  }
}

async function fetchSheetsSyncNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await prisma.sheetsSyncLog.findMany({
      where: {
        status: "FAILED",
        created_at: { gte: sevenDaysAgo },
      },
      orderBy: { created_at: "desc" },
      take: 5,
    });

    return logs.map((l) => ({
      id: `sheets-fail:${l.id}`,
      category: "sync" as const,
      severity: "warning" as const,
      title: "Google Sheets Sync",
      badge: "Sync Gagal",
      subtitle: `${l.event}${l.response_message ? ` • ${l.response_message}` : ""}`,
      timestamp: l.created_at.toISOString(),
      href: "/admin/sync",
    }));
  } catch {
    return [];
  }
}

async function fetchSecurityNotifications(): Promise<Omit<AppNotificationItem, "read">[]> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await prisma.appActivityLog.findMany({
      where: {
        tipe: "LOGIN_FAILED",
        created_at: { gte: oneDayAgo },
        id: { not: { startsWith: "log-seed-" } },
      },
      orderBy: { created_at: "desc" },
      take: 3,
    });

    return logs.map((l) => ({
      id: `sec:${l.id}`,
      category: "security" as const,
      severity: "warning" as const,
      title: l.nama_lengkap,
      badge: "Login Gagal",
      subtitle: `${l.aktifitas} • IP ${l.ip_address}`,
      timestamp: l.created_at.toISOString(),
      href: "/logs",
    }));
  } catch {
    return [];
  }
}

export async function getUserNotifications(userKey: string, role: string): Promise<{
  notifications: AppNotificationItem[];
  unreadCount: number;
  totalCount: number;
}> {
  const isNocOrAdmin = role === "admin" || role === "noc_engineer";
  const isAdmin = role === "admin";

  const [readState, icmpItems, orderItems, siteItems, backupItems, syncItems, secItems] =
    await Promise.all([
      getNotificationReadState(userKey),
      fetchIcmpDownNotifications(),
      fetchOrderNotifications(),
      fetchIsolirSiteNotifications(),
      isNocOrAdmin ? fetchBackupNotifications() : Promise.resolve([]),
      isNocOrAdmin ? fetchSheetsSyncNotifications() : Promise.resolve([]),
      isAdmin ? fetchSecurityNotifications() : Promise.resolve([]),
    ]);

  const readSet = new Set(readState.readIds);
  const readAllBeforeMs = readState.readAllBefore
    ? new Date(readState.readAllBefore).getTime()
    : null;

  const combined = [
    ...icmpItems,
    ...orderItems,
    ...siteItems,
    ...backupItems,
    ...syncItems,
    ...secItems,
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30)
    .map((item) => {
      const tsMs = new Date(item.timestamp).getTime();
      const isRead =
        readSet.has(item.id) || (readAllBeforeMs !== null && tsMs <= readAllBeforeMs);
      return {
        ...item,
        read: isRead,
      };
    });

  const unreadCount = combined.filter((item) => !item.read).length;

  return {
    notifications: combined,
    unreadCount,
    totalCount: combined.length,
  };
}

export async function markNotificationRead(userKey: string, notificationId: string): Promise<void> {
  const state = await getNotificationReadState(userKey);
  if (!state.readIds.includes(notificationId)) {
    state.readIds = [notificationId, ...state.readIds].slice(0, MAX_READ_IDS);
    await saveNotificationReadState(userKey, state);
  }
}

export async function markAllNotificationsRead(userKey: string, visibleIds: string[]): Promise<void> {
  const state = await getNotificationReadState(userKey);
  const merged = Array.from(new Set([...visibleIds, ...state.readIds])).slice(0, MAX_READ_IDS);
  await saveNotificationReadState(userKey, {
    readIds: merged,
    readAllBefore: new Date().toISOString(),
  });
}

