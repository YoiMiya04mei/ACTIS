"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type {
  AppNotificationItem,
  NotificationCategory,
  NotificationSeverity,
} from "@/lib/notificationService";
import {
  WifiOff,
  AlertOctagon,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Layers,
  Server,
  FileSpreadsheet,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

export const NOTIF_SYNC_EVENT = "actis:notifications-updated";

export function formatNotificationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} WIB`;
}

export function getBadgeStyle(severity: NotificationSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    case "warning":
      return "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "success":
      return "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "backup":
      return "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    default:
      return "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  }
}

export function renderNotificationIcon(
  category: NotificationCategory,
  severity: NotificationSeverity
) {
  let wrapperClass =
    "bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400";
  let icon = <Layers className="w-5 h-5" />;

  if (category === "icmp") {
    wrapperClass =
      "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400";
    icon = <WifiOff className="w-5 h-5" />;
  } else if (category === "backup") {
    if (severity === "critical") {
      wrapperClass =
        "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400";
      icon = <AlertOctagon className="w-5 h-5" />;
    } else if (severity === "warning") {
      wrapperClass =
        "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
      icon = <AlertTriangle className="w-5 h-5" />;
    } else {
      wrapperClass =
        "bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400";
      icon = <Archive className="w-5 h-5" />;
    }
  } else if (category === "site") {
    wrapperClass =
      "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
    icon = <Server className="w-5 h-5" />;
  } else if (category === "sync") {
    wrapperClass =
      "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
    icon = <FileSpreadsheet className="w-5 h-5" />;
  } else if (category === "security") {
    wrapperClass =
      "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
    icon = <ShieldAlert className="w-5 h-5" />;
  } else if (category === "ticket") {
    if (severity === "success") {
      wrapperClass =
        "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400";
      icon = <CheckCircle2 className="w-5 h-5" />;
    } else if (severity === "warning") {
      wrapperClass =
        "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400";
      icon = <AlertTriangle className="w-5 h-5" />;
    }
  }

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${wrapperClass}`}
    >
      {icon}
    </div>
  );
}

export function useSystemNotifications(userId?: string, externalRefreshTrigger = 0) {
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchNotifications = useCallback(
    async (showSpinner = false) => {
      if (!userId) return;
      if (showSpinner) setLoading(true);
      try {
        const params = new URLSearchParams({ userId });
        const res = await fetch(`/api/notifications?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success) {
          setNotifications(Array.isArray(json.notifications) ? json.notifications : []);
          setUnreadCount(typeof json.unreadCount === "number" ? json.unreadCount : 0);
        }
      } catch {
        // Silent fallback on transient network issue
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [userId]
  );

  // Initial fetch, route change refresh, external trigger, sync listener & 30s polling
  useEffect(() => {
    fetchNotifications(false);
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        fetchNotifications(false);
      }
    }, 30000);

    const handleSync = () => {
      fetchNotifications(false);
    };
    window.addEventListener(NOTIF_SYNC_EVENT, handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIF_SYNC_EVENT, handleSync);
    };
  }, [fetchNotifications, pathname, externalRefreshTrigger]);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0 || submitting || !userId) return;
    setSubmitting(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read", userId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setNotifications(Array.isArray(json.notifications) ? json.notifications : []);
          setUnreadCount(typeof json.unreadCount === "number" ? json.unreadCount : 0);
        }
      }
      window.dispatchEvent(new CustomEvent(NOTIF_SYNC_EVENT));
    } catch {
      // Keep optimistic state; next poll syncs cleanly
    } finally {
      setSubmitting(false);
    }
  }, [unreadCount, submitting, userId]);

  const handleItemClick = useCallback(
    (
      e: React.MouseEvent<HTMLAnchorElement>,
      item: AppNotificationItem,
      onBeforeNavigate?: () => void
    ) => {
      if (!item.read && userId) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            action: "mark_read",
            notificationId: item.id,
            userId,
          }),
        })
          .then(() => {
            window.dispatchEvent(new CustomEvent(NOTIF_SYNC_EVENT));
          })
          .catch(() => {});
      }

      // Preserve browser behavior for Ctrl/Cmd/Shift/Alt + click (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      onBeforeNavigate?.();
      if (pathname === item.href) {
        e.preventDefault();
        router.refresh();
      }
    },
    [userId, pathname, router]
  );

  return {
    notifications,
    unreadCount,
    loading,
    submitting,
    fetchNotifications,
    markAllRead,
    handleItemClick,
  };
}

interface NotificationListItemProps {
  item: AppNotificationItem;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>, item: AppNotificationItem) => void;
}

export function NotificationListItem({ item, onClick }: NotificationListItemProps) {
  const targetHref = item.href || "/dashboard";

  return (
    <Link
      href={targetHref}
      onClick={(e) => onClick(e, item)}
      title={`Buka detail (${targetHref})`}
      className={`group w-full px-4 py-3 flex items-start space-x-3 text-left cursor-pointer transition-colors hover:bg-blue-50/75 dark:hover:bg-slate-800/85 focus:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-slate-800 ${
        !item.read
          ? "bg-blue-50/40 dark:bg-blue-950/20"
          : "bg-white dark:bg-slate-900"
      }`}
    >
      {renderNotificationIcon(item.category, item.severity)}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[205px] group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
              {item.title}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getBadgeStyle(
                item.severity
              )}`}
            >
              {item.badge}
            </span>
          </div>
          {!item.read && (
            <span
              className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
              title="Belum dibaca"
            />
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {item.subtitle}
        </p>

        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            {formatNotificationTimestamp(item.timestamp)}
          </p>
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            Lihat detail
          </span>
        </div>
      </div>

      <div className="shrink-0 self-center text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
        <ChevronRight className="w-4 h-4" />
      </div>
    </Link>
  );
}

