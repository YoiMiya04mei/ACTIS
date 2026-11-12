"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Calendar,
  ExternalLink,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import {
  TimeframePreset,
  UptimeBarSlot,
  MonitorTimeframeStats,
} from "@/lib/icmpMonitorService";
import { useDialog } from "@/context/DialogContext";

export interface Heartbeat {
  id: string;
  status: "UP" | "DOWN";
  latency_ms: number | null;
  msg: string | null;
  created_at: string;
}

export interface MonitorData {
  id: string;
  pop_site_id: string;
  site_id?: string;
  name: string;
  ip_address: string;
  kategori: string;
  status: "UP" | "DOWN" | "PENDING";
  latency_ms: number | null;
  uptime_pct: number;
  last_checked_at: string | null;
  heartbeats?: Heartbeat[];
  stats?: MonitorTimeframeStats;
}

interface IcmpMonitorWidgetProps {
  popSiteId: string;
  currentIpPublic?: string | null;
  title?: string;
  compact?: boolean;
}

const TIMEFRAME_OPTIONS: { label: string; value: TimeframePreset; desc: string }[] = [
  { label: "6 Jam", value: "6h", desc: "6 jam terakhir" },
  { label: "1 Hari", value: "24h", desc: "24 jam terakhir" },
  { label: "1 Minggu", value: "7d", desc: "7 hari terakhir" },
  { label: "1 Bulan", value: "30d", desc: "30 hari terakhir" },
  { label: "1 Tahun", value: "365d", desc: "1 tahun penuh" },
  { label: "Custom", value: "custom", desc: "Rentang tanggal kustom" },
];

export function IcmpMonitorWidget({
  popSiteId,
  currentIpPublic,
  title = "ICMP Ping Monitoring (Uptime Kuma Engine)",
  compact = false,
}: IcmpMonitorWidgetProps) {
  const { alert: alertDialog } = useDialog();
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timeframe state
  const [timeframe, setTimeframe] = useState<TimeframePreset>("24h");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchMonitor = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("timeframe", timeframe);
        if (timeframe === "custom") {
          if (customStart) params.append("startDate", customStart);
          if (customEnd) params.append("endDate", customEnd);
        }

        const res = await fetch(`/api/pop-sites/${popSiteId}/monitoring?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Gagal memuat status monitoring.");
        }
        setMonitor(data.data);
      } catch (err: any) {
        setError(err.message || "Gagal menghubungi server");
      } finally {
        setLoading(false);
      }
    },
    [popSiteId, timeframe, customStart, customEnd]
  );

  useEffect(() => {
    fetchMonitor();
  }, [fetchMonitor]);

  const handlePingNow = async () => {
    setIsPinging(true);
    try {
      const params = new URLSearchParams();
      params.append("timeframe", timeframe);
      if (timeframe === "custom") {
        if (customStart) params.append("startDate", customStart);
        if (customEnd) params.append("endDate", customEnd);
      }

      const res = await fetch(`/api/pop-sites/${popSiteId}/monitoring?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan ping.");
      }
      setMonitor(data.data);
    } catch (err: any) {
      void alertDialog(err.message || "Terjadi kesalahan saat ping");
    } finally {
      setIsPinging(false);
    }
  };

  if (loading && !monitor) {
    return (
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse flex items-center space-x-3">
        <Activity className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Memuat status ICMP Ping...</span>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-500">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>ICMP Ping belum aktif untuk sirkuit ini atau IP Public kosong.</span>
        </div>
        <button
          type="button"
          onClick={() => fetchMonitor()}
          className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:underline flex items-center cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Coba Lagi
        </button>
      </div>
    );
  }

  const isUp = monitor.status === "UP";
  const isDown = monitor.status === "DOWN";

  // Use stats slots if available, otherwise fallback to recent heartbeats
  const slots: UptimeBarSlot[] =
    monitor.stats?.slots ||
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

  const timeframeUptimePct = monitor.stats?.uptime_pct ?? monitor.uptime_pct;
  const timeframeAvgLat = monitor.stats?.avg_latency ?? monitor.latency_ms;
  const totalPings = monitor.stats?.total_pings ?? (monitor.heartbeats ? monitor.heartbeats.length : 0);

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
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 transition-all">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
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
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                {title}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Retensi 1 Tahun
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
              <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                Host IP:{" "}
                <span className="text-blue-600 dark:text-blue-400 underline decoration-blue-200">
                  {monitor.ip_address || currentIpPublic || "-"}
                </span>
              </span>
              {monitor.last_checked_at && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center">
                  <Clock className="w-3 h-3 mr-0.5" />
                  Terakhir:{" "}
                  {new Date(monitor.last_checked_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Status Badge */}
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
            {monitor.status}
          </span>

          {/* Manual Ping Button */}
          <button
            type="button"
            onClick={handlePingNow}
            disabled={isPinging || !monitor.ip_address}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-slate-200 dark:border-slate-700 transition disabled:opacity-50 cursor-pointer"
            title="Ping Host Sekarang"
          >
            <RefreshCw className={`w-4 h-4 ${isPinging ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* Link to Full Monitoring Dashboard */}
          <Link
            href="/monitoring"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 border border-slate-200 dark:border-slate-700 transition"
            title="Buka Pusat Monitoring ICMP"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Timeframe Selector & Quick Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        {/* Timeframe Pill Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Periode:
          </span>
          {TIMEFRAME_OPTIONS.map((opt) => {
            const isSelected = timeframe === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeframe(opt.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
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

        {/* Aggregated Metrics for selected timeframe */}
        <div className="flex items-center gap-2">
          {/* Uptime % */}
          <div className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
              Uptime ({timeframe.toUpperCase()})
            </span>
            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
              {timeframeUptimePct}%
            </span>
          </div>

          {/* Average Latency */}
          <div className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
              Avg Latency
            </span>
            <span className="font-mono font-black text-blue-600 dark:text-blue-400">
              {timeframeAvgLat !== null ? `${timeframeAvgLat} ms` : "-"}
            </span>
          </div>

          {/* Min / Max Latency */}
          {monitor.stats?.min_latency !== null && monitor.stats?.min_latency !== undefined && (
            <div className="hidden sm:block px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
                Min / Max
              </span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                {monitor.stats.min_latency} / {monitor.stats.max_latency} ms
              </span>
            </div>
          )}

          {/* Total Checks */}
          <div className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
              Ping Checks
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {totalPings}
            </span>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker (shown when 'Custom' is selected) */}
      {timeframe === "custom" && (
        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex flex-wrap items-center gap-3 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-300">Dari:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-300">Sampai:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchMonitor()}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Terapkan Rentang
          </button>
        </div>
      )}

      {/* Uptime-Kuma Heartbeat Visual Bar (30 Aggregated Pills) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-semibold px-0.5">
          <span className="flex items-center">
            <BarChart2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Visual Ketersediaan Jaringan (30 Bar Teragregasi)
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {timeframeUptimePct >= 99
              ? "🟢 Sangat Prima"
              : timeframeUptimePct >= 90
              ? "🟡 Mengalami Fluktuasi"
              : "🔴 Gangguan / Down"}
          </span>
        </div>

        {/* 30 Visual Bar Pills */}
        <div className="flex items-center gap-1 w-full bg-slate-100/80 dark:bg-slate-800/70 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden">
          {slots.map((slot, idx) => {
            const isSlotEmpty = slot.status === "EMPTY";
            const isSlotUp = slot.status === "UP";
            const isSlotDegraded = slot.status === "DEGRADED";
            const isSlotDown = slot.status === "DOWN";

            let barColor = "bg-slate-200/80 dark:bg-slate-700/50 hover:bg-slate-300";
            if (isSlotUp) {
              barColor =
                "bg-emerald-500 dark:bg-emerald-400 hover:bg-emerald-400 shadow-2xs cursor-pointer";
            } else if (isSlotDegraded) {
              barColor =
                "bg-amber-500 dark:bg-amber-400 hover:bg-amber-400 shadow-2xs cursor-pointer";
            } else if (isSlotDown) {
              barColor =
                "bg-rose-500 dark:bg-rose-400 hover:bg-rose-400 shadow-2xs cursor-pointer";
            }

            return (
              <div
                key={`slot-${idx}`}
                className={`flex-1 h-8 rounded-[4px] transition-all hover:scale-110 relative group ${barColor}`}
                title={slot.tooltip}
              />
            );
          })}
        </div>

        {/* Bar Timeline Bounds */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1 font-medium">
          <span>{monitor.stats?.start_at ? formatPeriodDate(monitor.stats.start_at) : "-"}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">
            Rentang {timeframe === "custom" ? "Kustom" : timeframe.toUpperCase()}
          </span>
          <span>
            {monitor.stats?.end_at
              ? timeframe === "custom"
                ? formatPeriodDate(monitor.stats.end_at)
                : "Sekarang"
              : "Sekarang"}
          </span>
        </div>
      </div>
    </div>
  );
}
