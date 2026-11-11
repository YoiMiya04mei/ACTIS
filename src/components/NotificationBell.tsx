"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import {
  NotificationListItem,
  useSystemNotifications,
} from "@/components/notifications/NotificationShared";
import {
  Bell,
  BellRing,
  CheckCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

export function NotificationBell() {
  const { currentUser } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    submitting,
    fetchNotifications,
    markAllRead,
    handleItemClick,
  } = useSystemNotifications(currentUser?.id);

  // Close popover on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      fetchNotifications(notifications.length === 0);
    }
  };

  const displayedItems =
    filterTab === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative p-2 rounded-xl border transition focus:outline-none shadow-2xs ${
          isOpen
            ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
            : "bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        }`}
        title="Notifikasi Sistem ACTIS"
        aria-label="Notifikasi Sistem"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div className="fixed right-3 left-3 top-[4.25rem] sm:left-auto sm:top-full sm:absolute sm:right-0 sm:mt-2 sm:w-[390px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/80">
            <div className="flex items-center space-x-2">
              <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Notifikasi Sistem
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                  {unreadCount} baru
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Semua terbaca
                </span>
              )}
            </div>
          </div>

          {/* Filter & Actions Bar */}
          <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterTab === "all"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("unread")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterTab === "unread"
                    ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0 || submitting}
                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-40 disabled:pointer-events-none transition"
                title="Tandai semua sudah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai dibaca</span>
              </button>

              <button
                type="button"
                onClick={() => fetchNotifications(true)}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Muat ulang notifikasi"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {loading && notifications.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Memuat notifikasi sistem...
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-1.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {filterTab === "unread"
                    ? "Tidak ada notifikasi yang belum dibaca"
                    : "Belum ada notifikasi aktivitas terbaru"}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Alert ICMP Down, antrean tiket, isolir site, dan status backup akan muncul di sini.
                </p>
              </div>
            ) : (
              displayedItems.map((item) => (
                <NotificationListItem
                  key={item.id}
                  item={item}
                  onClick={(e, clicked) =>
                    handleItemClick(e, clicked, () => setIsOpen(false))
                  }
                />
              ))
            )}
          </div>

          {/* Footer Quick Links */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between text-[11px] font-semibold">
            <Link
              href="/monitoring"
              onClick={() => setIsOpen(false)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Cek ICMP Monitor
            </Link>
            <Link
              href="/queue"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              Lihat List Antrean
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
