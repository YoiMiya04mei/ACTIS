"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { PageSizeSelector, PaginationNavigator } from "@/components/Pagination";
import { formatLogDate, AppActivityLogItem } from "@/types/activityLog";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Download,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Monitor,
  Smartphone,
  Laptop,
  User,
  Sliders,
  X,
  FileSpreadsheet,
} from "lucide-react";

export default function AppActivityLogsPage() {
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";

  const [logs, setLogs] = useState<AppActivityLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters & Pagination state
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortBy, setSortBy] = useState<"created_at" | "nama_lengkap" | "ip_address" | "aktifitas">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Fetch logs from API
  const fetchLogs = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (activeTab !== "ALL") params.set("tipe", activeTab);
        params.set("page", page.toString());
        params.set("limit", pageSize.toString());
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
        if (startDate) params.set("startDate", new Date(startDate).toISOString());
        if (endDate) {
          const endD = new Date(endDate);
          endD.setHours(23, 59, 59, 999);
          params.set("endDate", endD.toISOString());
        }

        const res = await fetch(`/api/logs?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.logs || []);
          setTotalItems(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        console.error("Failed to load activity logs:", err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [search, activeTab, page, pageSize, sortBy, sortOrder, startDate, endDate]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (every 12 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Handle Sort column click
  const handleSort = (column: "created_at" | "nama_lengkap" | "ip_address" | "aktifitas") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Clear logs handler (Super admin only)
  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setShowClearConfirm(false);
      fetchLogs();
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
  };

  // Export CSV handler
  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ["#", "NAMA LENGKAP", "IP ADDRESS", "INFO AKTIFITAS", "TANGGAL KEJADIAN"];
    const rows = logs.map((l, idx) => [
      idx + 1 + (page - 1) * pageSize,
      `"${(l.nama_lengkap || "").replace(/"/g, '""')}"`,
      `"${l.ip_address || ""}"`,
      `"${(l.aktifitas || "").replace(/"/g, '""')}"`,
      `"${formatLogDate(l.created_at)}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `app_activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to determine text color for activity row
  const isWarningActivity = (log: AppActivityLogItem) => {
    return (
      log.tipe === "LOGIN_FAILED" ||
      log.tipe === "SESSION_CLOSED" ||
      log.aktifitas.toLowerCase().includes("gagal") ||
      log.aktifitas.toLowerCase().includes("sesi ditutup")
    );
  };

  return (
    <div className="space-y-5 pb-12 animate-fadeIn">
      {/* Top Breadcrumb & Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
              System Audit
            </span>
            <span className="text-xs text-slate-400 font-medium">&bull;</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Audit Trail & Riwayat Akses
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <History className="w-6 h-6 mr-2 text-amber-600 dark:text-amber-400" />
            Log Aplikasi & Aktifitas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mencakup seluruh pencatatan autentikasi login pengguna, penutupan sesi, pembuatan tiket, perubahan data layanan, dan operasional web app.
          </p>
        </div>

        {/* Action Buttons: Auto-refresh, Export, Clear */}
        <div className="flex items-center space-x-2">
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center transition border ${
              autoRefresh
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
            title="Toggle Auto Refresh setiap 12 detik"
          >
            <span className={`w-2 h-2 rounded-full mr-1.5 ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            Live Auto-Refresh
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-2xs"
            title="Segarkan Log Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center transition border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Download CSV Log"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Ekspor CSV
          </button>

          {/* Clear Logs Button (Super Admin only) */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center transition border border-rose-200 dark:border-rose-800 shadow-2xs"
              title="Bersihkan Semua Data Log"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              Bersihkan Data
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          {[
            { id: "ALL", label: "Semua Aktifitas" },
            { id: "LOGIN", label: "Login & Autentikasi" },
            { id: "TICKET", label: "Tiket & Antrean" },
            { id: "DATA", label: "Perubahan Layanan & Sistem" },
            { id: "DOCS", label: "Dokumen & Surat" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Date Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama lengkap, IP address, atau aktifitas..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Start */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Date Range End */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                title="Reset Tanggal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table: Matches User Screenshot Authentically */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-3 px-3.5 w-12 text-center">#</th>

                {/* Column: NAMA LENGKAP */}
                <th
                  onClick={() => handleSort("nama_lengkap")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>NAMA LENGKAP</span>
                    {sortBy === "nama_lengkap" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Column: IP ADDRESS */}
                <th
                  onClick={() => handleSort("ip_address")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>IP ADDRESS</span>
                    {sortBy === "ip_address" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Column: INFO AKTIFITAS */}
                <th
                  onClick={() => handleSort("aktifitas")}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>INFO AKTIFITAS</span>
                    {sortBy === "aktifitas" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Column: TANGGAL KEJADIAN */}
                <th
                  onClick={() => handleSort("created_at")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <div className="flex items-center justify-end space-x-1.5">
                    <span>TANGGAL KEJADIAN</span>
                    {sortBy === "created_at" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    Tidak ada log aktivitas yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const rowNumber = (page - 1) * pageSize + index + 1;
                  const isWarning = isWarningActivity(log);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Row # */}
                      <td className="py-3 px-3.5 text-center text-slate-400 font-medium">
                        {rowNumber}
                      </td>

                      {/* Nama Lengkap */}
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {log.nama_lengkap}
                      </td>

                      {/* IP Address (Orange/Amber colored style as requested in photo) */}
                      <td className="py-3 px-4 font-mono font-medium text-amber-600 dark:text-amber-500 whitespace-nowrap">
                        {log.ip_address}
                      </td>

                      {/* Info Aktifitas (Orange/Amber text for warning/failed/session closed, normal text otherwise) */}
                      <td
                        className={`py-3 px-4 ${
                          isWarning
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {log.aktifitas}
                      </td>

                      {/* Tanggal Kejadian */}
                      <td className="py-3 px-4 text-right font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatLogDate(log.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination & Page Size Navigator */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Tampilkan per halaman:</span>
            <PageSizeSelector
              value={pageSize}
              onChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              options={[10, 25, 50, 100]}
            />
          </div>

          <PaginationNavigator
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            entryLabel="log"
          />
        </div>
      </div>

      {/* Confirmation Modal: Clear Logs */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bersihkan Seluruh Log Aplikasi?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tindakan ini akan menghapus seluruh data riwayat login dan perubahan aplikasi. Data yang sudah dihapus tidak dapat dipulihkan.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs"
              >
                Ya, Bersihkan Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

