"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { AppActivityLogItem, ActivityType, formatLogDate } from "@/types/activityLog";
import {
  NotificationListItem,
  useSystemNotifications,
} from "@/components/notifications/NotificationShared";
import {
  BellRing,
  CheckCheck,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  History,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Server,
  Archive,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Activity,
  Globe,
} from "lucide-react";

interface LogTypeMeta {
  label: string;
  badgeClass: string;
  iconWrapperClass: string;
  isWarning?: boolean;
  iconKey:
    | "login_ok"
    | "alert"
    | "ticket"
    | "site"
    | "backup"
    | "sync"
    | "doc"
    | "activity";
}

const LOG_TYPE_META: Partial<Record<ActivityType, LogTypeMeta>> = {
  LOGIN_SUCCESS: {
    label: "Login",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    iconWrapperClass:
      "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
    iconKey: "login_ok",
  },
  LOGIN_FAILED: {
    label: "Login Gagal",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    iconWrapperClass:
      "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    isWarning: true,
    iconKey: "alert",
  },
  SESSION_CLOSED: {
    label: "Sesi Ditutup",
    badgeClass:
      "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    iconWrapperClass:
      "bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400",
    isWarning: true,
    iconKey: "alert",
  },
  LOGOUT: {
    label: "Logout",
    badgeClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    iconWrapperClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    iconKey: "activity",
  },
  CREATE_TICKET: {
    label: "Tiket Baru",
    badgeClass:
      "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    iconWrapperClass:
      "bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400",
    iconKey: "ticket",
  },
  UPDATE_ORDER: {
    label: "Update Order",
    badgeClass:
      "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    iconWrapperClass:
      "bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400",
    iconKey: "ticket",
  },
  UPDATE_SITE: {
    label: "Data Site",
    badgeClass:
      "bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    iconWrapperClass:
      "bg-teal-100/80 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400",
    iconKey: "site",
  },
  DELETE_SITE: {
    label: "Hapus Site",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    iconWrapperClass:
      "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    isWarning: true,
    iconKey: "alert",
  },
  IMPORT_DATA: {
    label: "Import Data",
    badgeClass:
      "bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    iconWrapperClass:
      "bg-teal-100/80 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400",
    iconKey: "site",
  },
  BACKUP_AUTO: {
    label: "Backup Auto",
    badgeClass:
      "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    iconWrapperClass:
      "bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
    iconKey: "backup",
  },
  BACKUP_MANUAL: {
    label: "Backup Manual",
    badgeClass:
      "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    iconWrapperClass:
      "bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
    iconKey: "backup",
  },
  BACKUP_FAILED: {
    label: "Backup Gagal",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    iconWrapperClass:
      "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    isWarning: true,
    iconKey: "alert",
  },
  CREATE_DEVICE: {
    label: "Perangkat Backup",
    badgeClass:
      "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    iconWrapperClass:
      "bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
    iconKey: "backup",
  },
  SHEETS_SYNC: {
    label: "Sheets Sync",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    iconWrapperClass:
      "bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
    iconKey: "sync",
  },
  DOCUMENT: {
    label: "Dokumen",
    badgeClass:
      "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    iconWrapperClass:
      "bg-purple-100/80 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
    iconKey: "doc",
  },
  DOCUMENT_GENERATE: {
    label: "Generate Surat",
    badgeClass:
      "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    iconWrapperClass:
      "bg-purple-100/80 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
    iconKey: "doc",
  },
  MONITORING_ALERT: {
    label: "Alert ICMP",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    iconWrapperClass:
      "bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    isWarning: true,
    iconKey: "alert",
  },
};

const DEFAULT_LOG_META: LogTypeMeta = {
  label: "Sistem",
  badgeClass:
    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  iconWrapperClass:
    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  iconKey: "activity",
};

function renderLogIcon(meta: LogTypeMeta) {
  let icon = <Activity className="w-5 h-5" />;
  if (meta.iconKey === "login_ok") icon = <ShieldCheck className="w-5 h-5" />;
  else if (meta.iconKey === "alert") icon = <ShieldAlert className="w-5 h-5" />;
  else if (meta.iconKey === "ticket") icon = <Layers className="w-5 h-5" />;
  else if (meta.iconKey === "site") icon = <Server className="w-5 h-5" />;
  else if (meta.iconKey === "backup") icon = <Archive className="w-5 h-5" />;
  else if (meta.iconKey === "sync") icon = <FileSpreadsheet className="w-5 h-5" />;
  else if (meta.iconKey === "doc") icon = <FileText className="w-5 h-5" />;

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.iconWrapperClass}`}
    >
      {icon}
    </div>
  );
}

const LOG_FILTER_TABS = [
  { id: "ALL", label: "Semua" },
  { id: "LOGIN", label: "Login" },
  { id: "TICKET", label: "Tiket" },
  { id: "DATA", label: "Sistem" },
] as const;

interface DashboardNotifAndLogRowProps {
  refreshTrigger?: number;
}

export function DashboardNotifAndLogRow({
  refreshTrigger = 0,
}: DashboardNotifAndLogRowProps) {
  const { currentUser } = useCurrentUser();

  // Left Column: System Notifications (shared state hook synced with header Bell)
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    submitting: notifSubmitting,
    fetchNotifications,
    markAllRead,
    handleItemClick,
  } = useSystemNotifications(currentUser?.id, refreshTrigger);

  const displayedNotifications =
    notifFilter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  // Right Column: Activity Logs
  const [logFilter, setLogFilter] = useState<string>("ALL");
  const [logs, setLogs] = useState<AppActivityLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLogsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "15",
          page: "1",
          sortBy: "created_at",
          sortOrder: "desc",
        });
        if (logFilter !== "ALL") {
          params.set("tipe", logFilter);
        }

        const res = await fetch(`/api/logs?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setLogs(Array.isArray(json.logs) ? json.logs : []);
          setTotalLogs(typeof json.total === "number" ? json.total : 0);
          setLogsError(null);
        } else {
          setLogsError(json.error || "Gagal memuat log aplikasi");
        }
      } catch {
        setLogsError("Gagal terhubung ke server log");
      } finally {
        setLogsLoading(false);
      }
    },
    [logFilter]
  );

  useEffect(() => {
    fetchLogs(false);
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        fetchLogs(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs, refreshTrigger]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* =============================================================== */}
        {/* KOLOM 1 (KIRI): NOTIFIKASI SISTEM                               */}
        {/* =============================================================== */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col overflow-hidden">
          {/* Card Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/20 shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Notifikasi Sistem
                  </h3>
                  {unreadCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                      {unreadCount} baru
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Semua terbaca
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Alert ICMP, progres antrean tiket, isolir site, &amp; backup config
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchNotifications(true)}
              disabled={notifLoading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shrink-0"
              title="Muat ulang notifikasi"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${notifLoading ? "animate-spin text-blue-600" : ""}`}
              />
            </button>
          </div>

          {/* Filter Tabs & Mark All Read Bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNotifFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  notifFilter === "all"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter("unread")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  notifFilter === "unread"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>

            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0 || notifSubmitting}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-40 disabled:pointer-events-none transition"
              title="Tandai semua notifikasi sudah dibaca"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tandai dibaca</span>
            </button>
          </div>

          {/* Scrollable Clickable Notification Feed */}
          <div className="h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {notifLoading && notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 text-xs text-slate-500 dark:text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                <span>Memuat notifikasi sistem...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 text-center space-y-1.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {notifFilter === "unread"
                    ? "Tidak ada notifikasi yang belum dibaca"
                    : "Belum ada notifikasi aktivitas terbaru"}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs">
                  Alert ICMP Down, antrean tiket, isolir site, dan status backup akan tampil secara otomatis.
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => (
                <NotificationListItem
                  key={item.id}
                  item={item}
                  onClick={(e, clicked) => handleItemClick(e, clicked)}
                />
              ))
            )}
          </div>

          {/* Footer Quick Links */}
          <div className="mt-auto px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between text-xs font-semibold">
            <Link
              href="/monitoring"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Cek ICMP Monitor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/queue"
              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Lihat List Antrean</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* =============================================================== */}
        {/* KOLOM 2 (KANAN): LOG APLIKASI & AKTIFITAS                       */}
        {/* =============================================================== */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col overflow-hidden">
          {/* Card Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/20 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Log Aplikasi &amp; Aktifitas
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {totalLogs.toLocaleString("id-ID")} Log
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  Audit trail login pengguna, perubahan layanan, tiket, &amp; sistem
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={logsLoading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shrink-0"
              title="Muat ulang log aktifitas"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin text-amber-600" : ""}`}
              />
            </button>
          </div>

          {/* Filter Tabs Bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 flex-wrap">
              {LOG_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    logFilter === tab.id
                      ? "bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline shrink-0">
              15 Terbaru
            </span>
          </div>

          {/* Scrollable Activity Log Feed */}
          <div className="h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {logsLoading && logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 text-xs text-slate-500 dark:text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
                <span>Memuat log aktifitas...</span>
              </div>
            ) : logsError && logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 text-center space-y-1.5">
                <AlertTriangle className="w-8 h-8 text-rose-500 opacity-80" />
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {logsError}
                </p>
              </div>
            ) : logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 text-center space-y-1.5">
                <History className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Belum ada log aktifitas pada kategori ini
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Semua event login, pembuatan tiket, dan perubahan data tercatat di sini.
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const meta = LOG_TYPE_META[log.tipe] ?? DEFAULT_LOG_META;
                const isWarning =
                  Boolean(meta.isWarning) ||
                  log.aktifitas.toLowerCase().includes("gagal") ||
                  log.aktifitas.toLowerCase().includes("sesi ditutup");

                return (
                  <div
                    key={log.id}
                    className="px-4 py-3 flex items-start space-x-3 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {renderLogIcon(meta)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[175px]">
                            {log.nama_lengkap}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          <Globe className="w-3 h-3 opacity-75" />
                          {log.ip_address}
                        </span>
                      </div>

                      <p
                        className={`text-xs mt-0.5 leading-snug line-clamp-2 ${
                          isWarning
                            ? "text-amber-700 dark:text-amber-400 font-medium"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {log.aktifitas}
                      </p>

                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                        {formatLogDate(log.created_at)} WIB
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Quick Links */}
          <div className="mt-auto px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              Menampilkan {logs.length} dari {totalLogs.toLocaleString("id-ID")} entri
            </span>
            <Link
              href="/logs"
              className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Buka Log Aplikasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
