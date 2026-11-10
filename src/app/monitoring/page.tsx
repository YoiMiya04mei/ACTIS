"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Radio,
  Building2,
  TrendingUp,
  Percent,
  Calendar,
  BarChart2,
  Send,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { UptimeKumaResponseChart } from "@/components/UptimeKumaResponseChart";
import {
  IcmpMonitor,
  IcmpHeartbeat,
  TimeframePreset,
  UptimeBarSlot,
} from "@/lib/icmpMonitorService";

const TIMEFRAME_OPTIONS: { label: string; value: TimeframePreset; desc: string }[] = [
  { label: "3 Jam", value: "3h", desc: "3 jam terakhir" },
  { label: "6 Jam", value: "6h", desc: "6 jam terakhir" },
  { label: "1 Hari", value: "24h", desc: "24 jam terakhir" },
  { label: "1 Minggu", value: "7d", desc: "7 hari terakhir" },
  { label: "1 Bulan", value: "30d", desc: "30 hari terakhir" },
  { label: "1 Tahun", value: "365d", desc: "1 tahun penuh" },
  { label: "Custom", value: "custom", desc: "Rentang tanggal kustom" },
];

export default function MonitoringDashboardPage() {
  const [monitors, setMonitors] = useState<IcmpMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [pingingMonitorId, setPingingMonitorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedKategori, setSelectedKategori] = useState<
    "Semua" | "POP Site" | "Enterprise Dedicated"
  >("Semua");
  const [selectedStatus, setSelectedStatus] = useState<"Semua" | "UP" | "DOWN" | "PENDING">("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpandRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDatetimeLocal = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Timeframe state (retention up to 1 year)
  const [timeframe, setTimeframe] = useState<TimeframePreset>("24h");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return formatDatetimeLocal(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return formatDatetimeLocal(new Date());
  });

  const fetchMonitors = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedKategori !== "Semua") params.append("kategori", selectedKategori);
        if (selectedStatus !== "Semua") params.append("status", selectedStatus);
        if (searchQuery.trim().length > 0) params.append("search", searchQuery.trim());
        params.append("timeframe", timeframe);
        if (timeframe === "custom") {
          if (customStart) params.append("startDate", customStart);
          if (customEnd) params.append("endDate", customEnd);
        }

        const res = await fetch(`/api/monitoring?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Gagal memuat data monitoring.");
        }

        setMonitors(data.data || []);
      } catch (err: any) {
        setError(err.message || "Gagal menghubungi server");
      } finally {
        setLoading(false);
      }
    },
    [selectedKategori, selectedStatus, searchQuery, timeframe, customStart, customEnd]
  );

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMonitors(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMonitors]);

  const handlePingAll = async () => {
    setIsPingingAll(true);
    try {
      const res = await fetch("/api/monitoring/ping-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan ping massal.");
      }
      await fetchMonitors(true);
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat ping massal.");
    } finally {
      setIsPingingAll(false);
    }
  };

  const handlePingSingle = async (monitorId: string) => {
    setPingingMonitorId(monitorId);
    try {
      const params = new URLSearchParams();
      params.append("timeframe", timeframe);
      if (timeframe === "custom") {
        if (customStart) params.append("startDate", customStart);
        if (customEnd) params.append("endDate", customEnd);
      }

      const res = await fetch(`/api/monitoring/${monitorId}/ping?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan ping.");
      }
      setMonitors((prev) => prev.map((m) => (m.id === monitorId ? data.data : m)));
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat ping.");
    } finally {
      setPingingMonitorId(null);
    }
  };

  // Metrics summary based on selected timeframe
  const totalMonitors = monitors.length;
  const upCount = monitors.filter((m) => m.status === "UP").length;
  const downCount = monitors.filter((m) => m.status === "DOWN").length;
  const pendingCount = monitors.filter((m) => m.status === "PENDING").length;

  const validLatencies = monitors
    .map((m) => m.stats?.avg_latency ?? m.latency_ms)
    .filter((l): l is number => typeof l === "number" && l > 0);
  const avgLatency =
    validLatencies.length > 0
      ? (validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length).toFixed(1)
      : "-";

  const validUptimes = monitors.map((m) => m.stats?.uptime_pct ?? m.uptime_pct);
  const avgUptime =
    validUptimes.length > 0
      ? (validUptimes.reduce((a, b) => a + b, 0) / validUptimes.length).toFixed(1)
      : "100.0";

  // Priority sorting: status DOWN appears at the top across all categories
  const sortedMonitors = useMemo(() => {
    return [...monitors].sort((a, b) => {
      const aIsDown = a.status === "DOWN" ? 1 : 0;
      const bIsDown = b.status === "DOWN" ? 1 : 0;
      if (aIsDown !== bIsDown) {
        return bIsDown - aIsDown;
      }
      const aTime = a.last_checked_at ? new Date(a.last_checked_at).getTime() : new Date(a.created_at).getTime();
      const bTime = b.last_checked_at ? new Date(b.last_checked_at).getTime() : new Date(b.created_at).getTime();
      return bTime - aTime;
    });
  }, [monitors]);

  const formatPeriodDate = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
              Network Monitoring
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Uptime Kuma ICMP Ping Engine (Retensi 1 Tahun)
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-emerald-600 dark:text-emerald-400" />
            ICMP Ping Monitoring
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitoring otomatis real-time status online & latency ICMP ping untuk POP Site dan
            Enterprise Dedicated dengan riwayat hingga 1 tahun.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Bot Telegram Settings Button */}
          <button
            type="button"
            onClick={() => setIsTelegramModalOpen(true)}
            className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold flex items-center shadow-xs transition cursor-pointer"
            title="Pengaturan Integrasi Bot Telegram & Alert ICMP Ping"
          >
            <Send className="w-3.5 h-3.5 mr-1.5 text-sky-600 dark:text-sky-400" />
            Bot Telegram
          </button>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center shadow-xs cursor-pointer ${
              autoRefresh
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
            title="Auto-refresh setiap 30 detik"
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 ${
                autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {autoRefresh ? "Auto-Refresh: ON" : "Auto-Refresh: OFF"}
          </button>

          {/* Ping All Button */}
          <button
            type="button"
            onClick={handlePingAll}
            disabled={isPingingAll || totalMonitors === 0}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPingingAll ? "animate-spin" : ""}`} />
            {isPingingAll ? "Pinging Semua Host..." : "Ping Semua Host"}
          </button>
        </div>
      </div>

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Hosts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Total Host</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {totalMonitors}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Sirkuit terpantau</p>
        </div>

        {/* Online UP */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>Host Online (UP)</span>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{upCount}</p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            Ping respon normal
          </p>
        </div>

        {/* Offline DOWN */}
        <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
            <span>Host Offline (DOWN)</span>
            <WifiOff className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{downCount}</p>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5">
            RTO / unreachable
          </p>
        </div>

        {/* Average Latency */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Latency</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            {avgLatency} <span className="text-xs font-normal">ms</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Periode {timeframe === "custom" ? "Kustom" : timeframe.toUpperCase()}
          </p>
        </div>

        {/* Average Uptime */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Uptime</span>
            <Percent className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1 font-mono">
            {avgUptime}
            <span className="text-xs font-normal">%</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Periode {timeframe === "custom" ? "Kustom" : timeframe.toUpperCase()}
          </p>
        </div>
      </div>

      {/* FILTER, SEARCH, & TIMEFRAME BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Row 1: Search and Category/Status Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Tabs: Kategori & Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Kategori */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { label: "Semua Kategori", val: "Semua" },
                { label: "POP Site", val: "POP Site" },
                { label: "Enterprise Dedicated", val: "Enterprise Dedicated" },
              ].map((tab) => (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => setSelectedKategori(tab.val as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedKategori === tab.val
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter Status */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { label: "Semua Status", val: "Semua" },
                { label: "UP", val: "UP", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "DOWN", val: "DOWN", color: "text-rose-600 dark:text-rose-400" },
                { label: "Pending", val: "PENDING", color: "text-amber-600 dark:text-amber-400" },
              ].map((tab) => (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => setSelectedStatus(tab.val as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedStatus === tab.val
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className={tab.color}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Controls: View Switcher & Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* View Mode Switcher: Tabel vs Kartu */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Tampilan Tabel List (Klik baris untuk grafik latency & log)"
              >
                <List className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Tabel List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center cursor-pointer ${
                  viewMode === "card"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Tampilan Kartu Lengkap"
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1 text-blue-600" />
                Kartu & Grid
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 lg:w-72 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Site ID, Nama, IP..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Timeframe Presets (6h, 24h, 7d, 30d, 365d, Custom) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Periode Monitoring:
            </span>
            {TIMEFRAME_OPTIONS.map((opt) => {
              const isSelected = timeframe === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTimeframe(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Tersedia histori grafik & log insiden hingga <span className="font-bold text-slate-600 dark:text-slate-300">1 Tahun</span>
          </div>
        </div>

        {/* Row 3: Custom Date & Time Range Form (ketika 'Custom' dipilih) */}
        {timeframe === "custom" && (
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex flex-wrap items-center gap-3.5 animate-fadeIn">
            {/* Input Dari Tanggal & Jam */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-950 dark:text-blue-300 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                Dari (Tanggal & Jam):
              </span>
              <input
                type="datetime-local"
                step="60"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
              />
            </div>

            {/* Input Sampai Tanggal & Jam */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-950 dark:text-blue-300 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                Sampai (Tanggal & Jam):
              </span>
              <input
                type="datetime-local"
                step="60"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
              />
            </div>

            {/* Quick Presets: Jam Sekarang & Hari Ini 00:00 */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCustomEnd(formatDatetimeLocal(now));
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-100 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition cursor-pointer"
                title="Set jam selesai ke waktu saat ini"
              >
                Jam Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  const startToday = new Date();
                  startToday.setHours(0, 0, 0, 0);
                  setCustomStart(formatDatetimeLocal(startToday));
                  setCustomEnd(formatDatetimeLocal(new Date()));
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-100 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition cursor-pointer"
                title="Set mulai dari jam 00:00 hari ini sampai sekarang"
              >
                Hari Ini (00:00 - Sekarang)
              </button>
            </div>

            {/* Terapkan Button */}
            <button
              type="button"
              onClick={() => fetchMonitors()}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Terapkan Rentang Kustom
            </button>
          </div>
        )}
      </div>

      {/* Down Priority Alert Banner */}
      {!loading && !error && downCount > 0 && selectedStatus !== "UP" && (
        <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold flex items-center gap-1.5">
                <span>{downCount} Host Mengalami Gangguan (Status DOWN)</span>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider">
                  Diprioritaskan di Atas
                </span>
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Host yang statusnya DOWN secara otomatis ditempatkan di posisi paling atas pada semua kategori untuk respon cepat tim NOC.
              </p>
            </div>
          </div>
          {selectedStatus === "Semua" && (
            <button
              type="button"
              onClick={() => setSelectedStatus("DOWN")}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              Filter Khusus DOWN
            </button>
          )}
        </div>
      )}

      {/* MONITORS LIST (KARTU ATAU TABEL MASTER MONITORING) */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 font-medium">Memuat status ICMP monitoring...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
          <p className="font-bold mt-2">Gagal Memuat Monitoring</p>
          <p className="text-xs">{error}</p>
        </div>
      ) : monitors.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
          <Activity className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Tidak ada host yang sesuai filter
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Monitoring ICMP otomatis dibuat untuk seluruh sirkuit berstatus <strong>POP Site</strong>{" "}
            dan <strong>Enterprise Dedicated</strong> yang telah menyelesaikan aktivasi.
          </p>
        </div>
      ) : viewMode === "table" ? (
        /* TABEL MASTER MONITORING SEPERTI UPTIME-KUMA DENGAN RUNTUTAN MS */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-4">Site ID & Pelanggan</th>
                  <th className="py-3 px-4">Kategori & IP Public</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Latency Terkini</th>
                  <th className="py-3 px-3 text-right">Uptime %</th>
                  <th className="py-3 px-4">Riwayat Insiden (Log UP & DOWN)</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedMonitors.map((m, idx) => {
                  const isUp = m.status === "UP";
                  const isDown = m.status === "DOWN";
                  const isCurrentlyPinging = pingingMonitorId === m.id;
                  const isExpanded = Boolean(expandedRows[m.id]);

                  const slots: UptimeBarSlot[] =
                    m.stats?.slots ||
                    Array.from({ length: 30 }, (_, sIdx) => ({
                      index: sIdx,
                      start_at: "",
                      end_at: "",
                      status: "EMPTY" as const,
                      uptime_pct: null,
                      avg_latency: null,
                      ping_count: 0,
                      up_count: 0,
                      down_count: 0,
                      tooltip: "Belum ada rekaman",
                    }));

                  const mUptimePct = m.stats?.uptime_pct ?? m.uptime_pct;
                  const mAvgLat = m.stats?.avg_latency ?? m.latency_ms;
                  const recentHbs = m.heartbeats || [];

                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        className={`transition cursor-pointer ${
                          isDown
                            ? "bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-900/40"
                            : isExpanded
                            ? "bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/60"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        }`}
                        onClick={() => toggleExpandRow(m.id)}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          <div className="flex items-center justify-center space-x-1">
                            <span
                              className={`p-0.5 rounded transition ${
                                isExpanded
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "text-slate-400"
                              }`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <span>{idx + 1}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                              {m.site_id || "SITE"}
                            </span>
                            {isDown && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider animate-pulse">
                                DOWN
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {m.name.replace(/^\[.*?\]\s*/, "")}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            {m.last_checked_at && (
                              <span className="text-[10px] text-slate-400">
                                Cek: {new Date(m.last_checked_at).toLocaleTimeString("id-ID")} WIB
                              </span>
                            )}
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              &bull; Klik baris untuk grafik & log
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-700 dark:text-slate-300 font-semibold text-xs">
                            {m.ip_address || "-"}
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${
                              m.kategori === "Enterprise Dedicated"
                                ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            }`}
                          >
                            {m.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center ${
                              isUp
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : isDown
                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                isUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                              }`}
                            />
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-mono font-black text-xs ${
                              isUp
                                ? (mAvgLat ?? 0) > 100
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {mAvgLat !== null ? `${mAvgLat} ms` : "-"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                          {mUptimePct}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            {isUp ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                                Normal
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />
                                Gangguan (DOWN)
                              </span>
                            )}
                            <span
                              className={`text-[11px] font-semibold flex items-center transition ${
                                isExpanded
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-blue-600 dark:text-blue-400 hover:underline"
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-3 h-3 mr-0.5" />
                                  Tutup Grafik
                                </>
                              ) : (
                                <>
                                  <BarChart2 className="w-3 h-3 mr-1 text-emerald-600" />
                                  Lihat Grafik & Log
                                </>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => toggleExpandRow(m.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center cursor-pointer ${
                                isExpanded
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 border-slate-200 dark:border-slate-700"
                              }`}
                              title="Buka / Tutup Grafik Latency & Log Lengkap"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  Tutup
                                </>
                              ) : (
                                <>
                                  <BarChart2 className="w-3 h-3 mr-1 text-emerald-600" />
                                  Grafik & Log
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePingSingle(m.id)}
                              disabled={isCurrentlyPinging || !m.ip_address}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 border border-slate-200 dark:border-slate-700 transition disabled:opacity-50 cursor-pointer"
                              title="Ping Host Sekarang"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  isCurrentlyPinging ? "animate-spin text-emerald-600" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDABLE ROW DENGAN GRAFIK & TABEL LOG UP & DOWN LENGKAP */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-y-2 border-emerald-500/20">
                          <td colSpan={8} className="p-4 sm:p-6">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      {m.site_id || "SITE"}
                                    </span>
                                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                      {m.name.replace(/^\[.*?\]\s*/, "")}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        m.kategori === "Enterprise Dedicated"
                                          ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                          : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                      }`}
                                    >
                                      {m.kategori}
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                      IP: {m.ip_address || "-"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                    Grafik waktu respons ping (ms), rekapitulasi uptime periode {timeframe.toUpperCase()}, serta riwayat log insiden UP & DOWN lengkap.
                                  </p>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handlePingSingle(m.id)}
                                    disabled={isCurrentlyPinging || !m.ip_address}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center shadow-xs cursor-pointer"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCurrentlyPinging ? "animate-spin" : ""}`} />
                                    Ping Host Ini
                                  </button>
                                  <Link
                                    href={
                                      m.kategori === "Enterprise Dedicated"
                                        ? `/enterprise/${m.pop_site_id}`
                                        : `/pop-sites/${m.pop_site_id}`
                                    }
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center"
                                  >
                                    Detail Inventaris &rarr;
                                  </Link>
                                </div>
                              </div>

                              <UptimeKumaResponseChart
                                heartbeats={m.heartbeats}
                                slots={slots}
                                timeframePreset={timeframe}
                                startAt={m.stats?.start_at || (timeframe === "custom" ? customStart : null)}
                                endAt={m.stats?.end_at || (timeframe === "custom" ? customEnd : null)}
                                defaultAvgLatency={mAvgLat}
                                siteName={m.site_id || m.name}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAMPILAN KARTU LENGKAP */
        <div className="space-y-4">
          {sortedMonitors.map((m) => {
            const isUp = m.status === "UP";
            const isDown = m.status === "DOWN";
            const isCurrentlyPinging = pingingMonitorId === m.id;

            // Use 30 aggregated slots from stats if present, otherwise fallback
            const slots: UptimeBarSlot[] =
              m.stats?.slots ||
              Array.from({ length: 30 }, (_, idx) => ({
                index: idx,
                start_at: "",
                end_at: "",
                status: "EMPTY" as const,
                uptime_pct: null,
                avg_latency: null,
                ping_count: 0,
                up_count: 0,
                down_count: 0,
                tooltip: "Belum ada rekaman",
              }));

            const mUptimePct = m.stats?.uptime_pct ?? m.uptime_pct;
            const mAvgLat = m.stats?.avg_latency ?? m.latency_ms;
            const mTotalPings = m.stats?.total_pings ?? (m.heartbeats ? m.heartbeats.length : 0);

            return (
              <div
                key={m.id}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4 transition ${
                  isDown
                    ? "border-2 border-rose-400 dark:border-rose-700/80 ring-2 ring-rose-500/20 bg-rose-50/15 dark:bg-rose-950/20 hover:border-rose-500"
                    : "border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Top Row: Name, Site ID, Target IP, Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                        isUp
                          ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                          : isDown
                          ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800"
                          : "bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {isUp ? (
                        <Wifi className="w-5 h-5 animate-pulse" />
                      ) : isDown ? (
                        <WifiOff className="w-5 h-5" />
                      ) : (
                        <Activity className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={
                            m.kategori === "Enterprise Dedicated"
                              ? `/enterprise/${m.pop_site_id}`
                              : `/pop-sites/${m.pop_site_id}`
                          }
                          className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                        >
                          <span>{m.site_id || "SITE"}</span>
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                        {isDown && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-xs uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <WifiOff className="w-2.5 h-2.5" />
                            DOWN PRIORITY
                          </span>
                        )}
                        <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {m.name.replace(/^\[.*?\]\s*/, "")}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            m.kategori === "Enterprise Dedicated"
                              ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                              : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {m.kategori}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono font-bold">
                          IP Public:{" "}
                          <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {m.ip_address || "Belum diset"}
                          </span>
                        </span>
                        {m.last_checked_at && (
                          <span className="text-[11px] text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(m.last_checked_at).toLocaleTimeString("id-ID")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Metrics */}
                  <div className="flex items-center space-x-2.5 self-end sm:self-auto">
                    {/* Timeframe Uptime % */}
                    <div className="text-right px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
                        Uptime ({timeframe.toUpperCase()})
                      </span>
                      <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                        {mUptimePct}%
                      </span>
                    </div>

                    {/* Timeframe Latency */}
                    <div className="text-right px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
                        Avg Latency
                      </span>
                      <span className="font-mono font-black text-xs text-blue-600 dark:text-blue-400">
                        {mAvgLat !== null ? `${mAvgLat} ms` : "-"}
                      </span>
                    </div>

                    {/* Current Status Pill */}
                    <span
                      className={`px-3 py-1.5 rounded-xl font-black text-xs inline-flex items-center border shadow-xs ${
                        isUp
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20"
                          : isDown
                          ? "bg-rose-600 text-white border-rose-700 shadow-rose-500/20"
                          : "bg-amber-500 text-white border-amber-600"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mr-1.5 ${
                          isUp ? "bg-white animate-ping" : "bg-white"
                        }`}
                      />
                      {m.status}
                    </span>

                    {/* Manual Ping Button */}
                    <button
                      type="button"
                      onClick={() => handlePingSingle(m.id)}
                      disabled={isCurrentlyPinging || !m.ip_address}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 transition disabled:opacity-50 cursor-pointer"
                      title="Ping Host Ini Sekarang"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          isCurrentlyPinging ? "animate-spin text-emerald-600" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* GRAFIK WAKTU RESPONS (MS) PERSIS UPTIME-KUMA & LOG UP/DOWN */}
                <UptimeKumaResponseChart
                  heartbeats={m.heartbeats}
                  slots={slots}
                  timeframePreset={timeframe}
                  startAt={m.stats?.start_at || (timeframe === "custom" ? customStart : null)}
                  endAt={m.stats?.end_at || (timeframe === "custom" ? customEnd : null)}
                  defaultAvgLatency={mAvgLat}
                  siteName={m.site_id || m.name}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Telegram Bot Notification Modal */}
      <TelegramConfigModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
}
