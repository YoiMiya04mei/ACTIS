"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  BarChart2,
  Table as TableIcon,
  Zap,
} from "lucide-react";
import { IcmpHeartbeat, UptimeBarSlot } from "@/lib/icmpMonitorService";

interface UptimeKumaResponseChartProps {
  heartbeats?: IcmpHeartbeat[];
  slots?: UptimeBarSlot[];
  timeframePreset?: string;
  startAt?: string | null;
  endAt?: string | null;
  defaultAvgLatency?: number | null;
  siteName?: string;
}

export function UptimeKumaResponseChart({
  heartbeats = [],
  slots = [],
  timeframePreset = "24h",
  startAt = null,
  endAt = null,
  defaultAvgLatency = null,
  siteName,
}: UptimeKumaResponseChartProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "table" | "raw_logs">("chart");
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    latency: number | null;
    time: string;
    status: string;
    msg?: string | null;
  } | null>(null);

  // Normalisasi batas waktu monitoring: startTime, endTime, duration
  const timeBounds = useMemo(() => {
    const now = new Date();
    let startTime: number;
    let endTime: number;

    if (startAt && !isNaN(new Date(startAt).getTime())) {
      startTime = new Date(startAt).getTime();
    } else {
      const norm = (timeframePreset || "24h").toLowerCase();
      if (norm === "3h" || norm === "3 jam" || norm === "3jam") {
        startTime = now.getTime() - 3 * 3600 * 1000;
      } else if (norm === "6h" || norm === "6 jam" || norm === "6jam") {
        startTime = now.getTime() - 6 * 3600 * 1000;
      } else if (norm === "7d" || norm === "1w" || norm === "1 minggu" || norm === "1minggu") {
        startTime = now.getTime() - 7 * 24 * 3600 * 1000;
      } else if (norm === "30d" || norm === "1m" || norm === "1 bulan" || norm === "1bulan") {
        startTime = now.getTime() - 30 * 24 * 3600 * 1000;
      } else if (norm === "365d" || norm === "1y" || norm === "1 tahun" || norm === "1tahun") {
        startTime = now.getTime() - 365 * 24 * 3600 * 1000;
      } else {
        startTime = now.getTime() - 24 * 3600 * 1000;
      }
    }

    if (endAt && !isNaN(new Date(endAt).getTime())) {
      endTime = new Date(endAt).getTime();
    } else {
      endTime = now.getTime();
    }

    if (startTime >= endTime) {
      startTime = endTime - 24 * 3600 * 1000;
    }

    const duration = Math.max(endTime - startTime, 1000);
    return { startTime, endTime, duration };
  }, [startAt, endAt, timeframePreset]);

  // Label periode aktif untuk badge header
  const periodLabel = useMemo(() => {
    const padZ = (n: number) => n.toString().padStart(2, "0");
    if (timeframePreset === "custom") {
      if (startAt && endAt) {
        const sD = new Date(startAt);
        const eD = new Date(endAt);
        const sStr = `${padZ(sD.getDate())} ${sD.toLocaleDateString("id-ID", { month: "short" })} ${padZ(sD.getHours())}:${padZ(sD.getMinutes())}`;
        const eStr = `${padZ(eD.getDate())} ${eD.toLocaleDateString("id-ID", { month: "short" })} ${padZ(eD.getHours())}:${padZ(eD.getMinutes())}`;
        return `Kustom: ${sStr} - ${eStr}`;
      }
      return "Rentang Kustom";
    }
    const mapPreset: Record<string, string> = {
      "3h": "3 Jam Terakhir",
      "6h": "6 Jam Terakhir",
      "24h": "24 Jam Terakhir",
      "7d": "7 Hari Terakhir",
      "30d": "30 Hari Terakhir",
      "365d": "1 Tahun Terakhir",
    };
    return mapPreset[timeframePreset] || `${timeframePreset.toUpperCase()}`;
  }, [timeframePreset, startAt, endAt]);

  // Normalisasi data points untuk grafik:
  // Untuk rentang panjang (> 48 jam) ekstrak dari slots agregasi agar terdistribusi merata
  // Untuk rentang pendek (<= 48 jam) prioritaskan data real heartbeats
  const chartPoints = useMemo(() => {
    const isLongTimeframe = timeBounds.duration > 48 * 3600 * 1000;

    if (isLongTimeframe && slots && slots.length > 0) {
      const validSlots = slots.filter((s) => s.status !== "EMPTY");
      if (validSlots.length > 0) {
        return validSlots.map((s) => ({
          time: new Date((new Date(s.start_at).getTime() + new Date(s.end_at).getTime()) / 2),
          latency: s.avg_latency !== null && s.avg_latency !== undefined ? Number(s.avg_latency) : null,
          status: s.status,
          msg: s.tooltip,
        }));
      }
    }

    if (heartbeats && heartbeats.length > 0) {
      return heartbeats.map((hb) => ({
        time: new Date(hb.created_at),
        latency: hb.latency_ms !== null && hb.latency_ms !== undefined ? Number(hb.latency_ms) : null,
        status: hb.status,
        msg: hb.msg,
      }));
    }

    // Fallback: ekstrak dari slots
    if (slots && slots.length > 0) {
      return slots
        .filter((s) => s.status !== "EMPTY")
        .map((s) => ({
          time: new Date((new Date(s.start_at).getTime() + new Date(s.end_at).getTime()) / 2),
          latency: s.avg_latency !== null && s.avg_latency !== undefined ? Number(s.avg_latency) : null,
          status: s.status,
          msg: s.tooltip,
        }));
    }

    return [];
  }, [heartbeats, slots, timeBounds.duration]);

  // Hitung metrik min, max, avg
  const stats = useMemo(() => {
    const validLatencies = chartPoints
      .map((p) => p.latency)
      .filter((l): l is number => typeof l === "number" && !isNaN(l) && l >= 0);

    if (validLatencies.length === 0) {
      const fallbackVal = defaultAvgLatency ?? 2.0;
      return {
        min: fallbackVal,
        max: fallbackVal,
        avg: fallbackVal,
        count: chartPoints.length,
      };
    }

    const min = Math.min(...validLatencies);
    const max = Math.max(...validLatencies);
    const avg =
      validLatencies.reduce((acc, curr) => acc + curr, 0) / validLatencies.length;

    return {
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      avg: parseFloat(avg.toFixed(2)),
      count: chartPoints.length,
    };
  }, [chartPoints, defaultAvgLatency]);

  // Hitung Riwayat Insiden Status (Hanya Log UP & DOWN / Hidup & Mati seperti di Uptime-Kuma)
  const incidentLogs = useMemo(() => {
    // Utamakan data heartbeats langsung agar timestamp presisi detik dan pesan error asli ICMP terbaca
    const source =
      heartbeats && heartbeats.length > 0
        ? heartbeats.map((hb) => ({
            time: new Date(hb.created_at),
            latency: hb.latency_ms !== null && hb.latency_ms !== undefined ? Number(hb.latency_ms) : null,
            status: hb.status,
            msg: hb.msg,
          }))
        : chartPoints;

    const sorted = [...source].sort((a, b) => a.time.getTime() - b.time.getTime());
    if (sorted.length === 0) return [];

    const padZ = (n: number) => n.toString().padStart(2, "0");
    const formatKumaDate = (d: Date) =>
      `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())} ${padZ(d.getHours())}:${padZ(d.getMinutes())}:${padZ(d.getSeconds())}`;

    const incidents: Array<{
      id: string;
      status: "UP" | "DOWN";
      statusLabel: "Hidup" | "Mati";
      time: Date;
      formattedTime: string;
      msg: string;
      duration?: string | null;
    }> = [];

    let prevStatus: string | null = null;
    let downStartTime: Date | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      const isDown = pt.status === "DOWN";
      const currentStatus = isDown ? "DOWN" : "UP";

      // Deteksi perubahan status (transisi UP -> DOWN atau DOWN -> UP)
      if (currentStatus !== prevStatus) {
        if (isDown) {
          downStartTime = pt.time;
          incidents.push({
            id: `inc-${pt.time.getTime()}-${i}`,
            status: "DOWN",
            statusLabel: "Mati",
            time: pt.time,
            formattedTime: formatKumaDate(pt.time),
            msg:
              pt.msg ||
              `PING target host (100% packet loss, request timed out / host unreachable)`,
          });
        } else {
          let durationStr: string | null = null;
          if (downStartTime) {
            const diffSec = Math.round((pt.time.getTime() - downStartTime.getTime()) / 1000);
            const mins = Math.floor(diffSec / 60);
            const secs = diffSec % 60;
            durationStr = mins > 0 ? `${mins} mnt ${secs} dtk` : `${secs} dtk`;
            downStartTime = null;
          }

          incidents.push({
            id: `inc-${pt.time.getTime()}-${i}`,
            status: "UP",
            statusLabel: "Hidup",
            time: pt.time,
            formattedTime: formatKumaDate(pt.time),
            msg: durationStr
              ? `Koneksi pulih normal setelah terputus selama ${durationStr}`
              : "",
            duration: durationStr,
          });
        }
        prevStatus = currentStatus;
      }
    }

    // Jika tidak ada transisi sama sekali (sirkuit dari awal selalu UP / Hidup atau selalu DOWN)
    if (incidents.length === 0 && sorted.length > 0) {
      const firstPt = sorted[0];
      const isDown = firstPt.status === "DOWN";
      incidents.push({
        id: "inc-initial",
        status: isDown ? "DOWN" : "UP",
        statusLabel: isDown ? "Mati" : "Hidup",
        time: firstPt.time,
        formattedTime: formatKumaDate(firstPt.time),
        msg: isDown ? (firstPt.msg || "Request timed out / 100% packet loss") : "",
      });
    }

    // Tampilkan log paling baru di atas (Newest first persis gambar Uptime-Kuma)
    return [...incidents].reverse();
  }, [heartbeats, chartPoints]);

  // Dimensi SVG Canvas
  const width = 800;
  const height = 200;
  const padLeft = 65;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Skala Y (Waktu Respons ms) mirip Uptime-Kuma
  // Jika nilai konstan (seperti 2.00 ms di screenshot user), buat rentang tick 1.85 s/d 2.10
  const yBounds = useMemo(() => {
    let yMin = stats.min;
    let yMax = stats.max;

    if (yMin === yMax || yMax - yMin < 0.2) {
      yMin = Math.max(0, yMin - 0.15);
      yMax = yMax + 0.1;
    } else {
      const padding = (yMax - yMin) * 0.15;
      yMin = Math.max(0, yMin - padding);
      yMax = yMax + padding;
    }

    // Buat 5 tick marks
    const step = (yMax - yMin) / 5;
    const ticks: number[] = [];
    for (let i = 0; i <= 5; i++) {
      ticks.push(parseFloat((yMin + step * i).toFixed(2)));
    }

    return { yMin, yMax, ticks };
  }, [stats]);

  // Skala X & Koordinat Plot SVG terikat ke periode monitoring (timeBounds)
  const plotData = useMemo(() => {
    const padZ = (n: number) => n.toString().padStart(2, "0");

    // Ticks X (Waktu) yang selalu terdistribusi merata dari timeBounds.startTime ke timeBounds.endTime
    const tickCount = 7;
    const xTicks: Array<{ x: number; label: string }> = [];

    for (let i = 0; i < tickCount; i++) {
      const fraction = i / (tickCount - 1);
      const tickTimeMs = timeBounds.startTime + fraction * timeBounds.duration;
      const tickDate = new Date(tickTimeMs);
      const x = padLeft + fraction * plotW;

      let label = "";
      if (timeBounds.duration <= 24 * 3600 * 1000) {
        // <= 24 Jam: format jam:menit (HH:mm)
        label = `${padZ(tickDate.getHours())}:${padZ(tickDate.getMinutes())}`;
      } else if (timeBounds.duration <= 48 * 3600 * 1000) {
        // 24 - 48 Jam: format DD/MM HH:mm
        label = `${padZ(tickDate.getDate())}/${padZ(tickDate.getMonth() + 1)} ${padZ(tickDate.getHours())}:${padZ(tickDate.getMinutes())}`;
      } else if (timeBounds.duration <= 45 * 24 * 3600 * 1000) {
        // 7 Hari s/d 30 Hari: format DD MMM (contoh: 02 Nov, 09 Nov)
        const monthShort = tickDate.toLocaleDateString("id-ID", { month: "short" });
        label = `${padZ(tickDate.getDate())} ${monthShort}`;
      } else {
        // > 45 Hari s/d 1 Tahun: format MMM 'YY (contoh: Nov '25, Jan '26)
        const monthShort = tickDate.toLocaleDateString("id-ID", { month: "short" });
        label = `${monthShort} '${tickDate.getFullYear().toString().slice(-2)}`;
      }

      xTicks.push({ x, label });
    }

    if (chartPoints.length === 0) {
      return { pathLine: "", pathArea: "", points: [], xTicks };
    }

    // Urutkan points secara kronologis
    const sorted = [...chartPoints].sort((a, b) => a.time.getTime() - b.time.getTime());

    // Ambil points dalam rentang monitoring aktif
    const validInTimeRange = sorted.filter((pt) => {
      const t = pt.time.getTime();
      return t >= timeBounds.startTime && t <= timeBounds.endTime;
    });

    const rawPoints = validInTimeRange.length > 0 ? validInTimeRange : sorted;

    const points = rawPoints.map((pt) => {
      const t = pt.time.getTime();
      const xRatio = (t - timeBounds.startTime) / timeBounds.duration;
      const clampedRatio = Math.max(0, Math.min(1, xRatio));
      const x = padLeft + clampedRatio * plotW;

      let y = padTop + plotH; // default baseline jika DOWN / null
      if (pt.latency !== null) {
        const yNorm = (pt.latency - yBounds.yMin) / (yBounds.yMax - yBounds.yMin || 1);
        const clampedYNorm = Math.max(0, Math.min(1, yNorm));
        y = padTop + plotH - clampedYNorm * plotH;
      }

      return {
        x,
        y,
        latency: pt.latency,
        time: pt.time,
        status: pt.status,
        msg: pt.msg,
      };
    });

    // Buat Path Line & Area SVG
    let pathLine = "";
    let pathArea = "";

    if (points.length === 1) {
      // Jika hanya 1 data point, gambar garis horizontal sepanjang periode
      const p = points[0];
      pathLine = `M ${padLeft},${p.y} L ${width - padRight},${p.y}`;
      pathArea = `M ${padLeft},${padTop + plotH} L ${padLeft},${p.y} L ${width - padRight},${p.y} L ${width - padRight},${padTop + plotH} Z`;
    } else if (points.length > 1) {
      pathLine = `M ${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathLine += ` L ${points[i].x},${points[i].y}`;
      }

      pathArea = `${pathLine} L ${points[points.length - 1].x},${padTop + plotH} L ${points[0].x},${padTop + plotH} Z`;
    }

    return { pathLine, pathArea, points, xTicks };
  }, [chartPoints, timeBounds, plotW, plotH, padLeft, padRight, padTop, yBounds, width]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4.5 space-y-3.5 shadow-xs">
      {/* HEADER GRAFIK PERSIS UPTIME-KUMA */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-3">
          {/* Legend "Ping Rerata" Kotak Hijau seperti di Uptime-Kuma */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span className="w-3.5 h-3.5 rounded-xs border-2 border-emerald-500 bg-emerald-500/20 inline-block" />
            <span>Ping Rerata</span>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span>
              Terkini:{" "}
              <b className="text-slate-800 dark:text-slate-200 font-black">
                {stats.avg} ms
              </b>
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span>Min: {stats.min} ms</span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span>Maks: {stats.max} ms</span>
          </div>

          {/* Active Period Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>{periodLabel}</span>
          </div>
        </div>

        {/* View Switcher: Grafik Area vs Log UP & DOWN vs Riwayat Ping */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("chart")}
            className={`px-3 py-1 rounded-lg transition flex items-center cursor-pointer ${
              activeTab === "chart"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Activity className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Grafik Respons (ms)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1 rounded-lg transition flex items-center cursor-pointer ${
              activeTab === "table"
                ? "bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Log UP & DOWN ({incidentLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw_logs")}
            className={`px-3 py-1 rounded-lg transition flex items-center cursor-pointer ${
              activeTab === "raw_logs"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 mr-1 text-blue-600" />
            Riwayat Ping ({heartbeats.length})
          </button>
        </div>
      </div>

      {/* CONTENT: TABEL RUNTUTAN LOG PING ATAU GRAFIK SVG UPTIME-KUMA */}
      {activeTab === "chart" ? (
        <div className="relative w-full overflow-hidden select-none">
          {chartPoints.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Activity className="w-6 h-6 mx-auto mb-2 text-slate-300 animate-pulse" />
              Belum ada rekaman ping response time untuk periode ini.
            </div>
          ) : (
            <>
              {/* Tooltip Hover Mengambang */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl bg-slate-900/90 text-white text-xs shadow-xl border border-slate-700 backdrop-blur-xs transition-all duration-75"
                  style={{
                    left: `${Math.min(Math.max(hoveredPoint.x, 80), width - 180)}px`,
                    top: `${Math.max(10, hoveredPoint.y - 65)}px`,
                  }}
                >
                  <p className="font-bold flex items-center gap-1.5 text-slate-200">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {hoveredPoint.time}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`font-mono font-black ${
                        hoveredPoint.status === "UP" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {hoveredPoint.latency !== null
                        ? `${hoveredPoint.latency.toFixed(2)} ms`
                        : "Timeout / RTO"}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        hoveredPoint.status === "UP"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}
                    >
                      {hoveredPoint.status}
                    </span>
                  </div>
                  {hoveredPoint.msg && (
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] truncate">
                      {hoveredPoint.msg}
                    </p>
                  )}
                </div>
              )}

              {/* Responsive SVG Chart */}
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-48 sm:h-56 block overflow-visible"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <defs>
                    {/* Linear Gradient Hijau Kuma */}
                    <linearGradient id={`kumaAreaGrad-${siteName || "m"}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                      <stop offset="60%" stopColor="#10b981" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Y-AXIS LABEL (Waktu Respons (ms)) */}
                  <text
                    x={-height / 2 + 5}
                    y={16}
                    transform="rotate(-90)"
                    textAnchor="middle"
                    className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-500"
                  >
                    Waktu Respons (ms)
                  </text>

                  {/* HORIZONTAL GRID LINES & Y TICKS */}
                  {yBounds.ticks.map((tickVal, idx) => {
                    const yPos =
                      padTop +
                      plotH -
                      ((tickVal - yBounds.yMin) / (yBounds.yMax - yBounds.yMin || 1)) * plotH;

                    return (
                      <g key={`y-grid-${idx}`}>
                        <line
                          x1={padLeft}
                          y1={yPos}
                          x2={width - padRight}
                          y2={yPos}
                          stroke="#e2e8f0"
                          className="dark:stroke-slate-800"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 8}
                          y={yPos + 3.5}
                          textAnchor="end"
                          className="text-[10px] font-mono fill-slate-400 dark:fill-slate-500"
                        >
                          {tickVal.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* VERTICAL GRID LINES & X TICKS */}
                  {plotData.xTicks.map((xt, idx) => (
                    <g key={`x-grid-${idx}`}>
                      <line
                        x1={xt.x}
                        y1={padTop}
                        x2={xt.x}
                        y2={padTop + plotH}
                        stroke="#f1f5f9"
                        className="dark:stroke-slate-800/60"
                        strokeWidth="1"
                      />
                      <text
                        x={xt.x}
                        y={padTop + plotH + 18}
                        textAnchor="middle"
                        className="text-[10px] font-mono fill-slate-400 dark:fill-slate-500"
                      >
                        {xt.label}
                      </text>
                    </g>
                  ))}

                  {/* AREA GRADIENT */}
                  {plotData.pathArea && (
                    <path
                      d={plotData.pathArea}
                      fill={`url(#kumaAreaGrad-${siteName || "m"})`}
                    />
                  )}

                  {/* STROKE LINE (Garis Hijau Uptime-Kuma) */}
                  {plotData.pathLine && (
                    <path
                      d={plotData.pathLine}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* HOVER CROSSHAIR VERTICAL LINE */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.x}
                      y1={padTop}
                      x2={hoveredPoint.x}
                      y2={padTop + plotH}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* DATA POINTS & INTERACTIVE HOVER CIRCLES */}
                  {plotData.points.map((pt, idx) => {
                    const isHovered =
                      hoveredPoint &&
                      Math.abs(hoveredPoint.x - pt.x) < 5 &&
                      Math.abs(hoveredPoint.y - pt.y) < 5;

                    return (
                      <g key={`pt-${idx}`}>
                        {/* Interactive Invisible Target */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={10}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              x: pt.x,
                              y: pt.y,
                              latency: pt.latency,
                              time:
                                (timeBounds.duration > 24 * 3600 * 1000
                                  ? `${pt.time.toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                    })} `
                                  : "") +
                                pt.time.toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }) +
                                " WIB",
                              status: pt.status,
                              msg: pt.msg,
                            })
                          }
                        />

                        {/* Visible Dot */}
                        {pt.status === "DOWN" ? (
                          <circle
                            cx={pt.x}
                            cy={padTop + plotH}
                            r={3.5}
                            fill="#f43f5e"
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                        ) : isHovered ? (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={5.5}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            className="animate-pulse"
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}
        </div>
      ) : activeTab === "table" ? (
        /* TABEL LOG UP DAN DOWN PERSIS SCREENSHOT UPTIME-KUMA */
        <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-fadeIn">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-4 w-28">Status</th>
                <th className="py-2.5 px-4 w-48">Tanggal/Waktu</th>
                <th className="py-2.5 px-4">Pesan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidentLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    Belum ada insiden gangguan (DOWN) yang tercatat. Sirkuit beroperasi normal.
                  </td>
                </tr>
              ) : (
                incidentLogs.map((log) => {
                  const isMati = log.status === "DOWN";

                  return (
                    <tr
                      key={log.id}
                      className={
                        isMati
                          ? "bg-slate-100/95 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition"
                          : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      }
                    >
                      {/* Kolom 1: Status Pill (Hidup hijau / Mati merah) */}
                      <td className="py-2.5 px-4 align-top">
                        <span
                          className={`inline-block px-3.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs ${
                            isMati ? "bg-[#ef4444]" : "bg-[#22c55e]"
                          }`}
                        >
                          {log.statusLabel}
                        </span>
                      </td>

                      {/* Kolom 2: Tanggal/Waktu */}
                      <td className="py-2.5 px-4 align-top font-mono text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                        {log.formattedTime}
                      </td>

                      {/* Kolom 3: Pesan */}
                      <td className="py-2.5 px-4 align-top font-mono text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed break-all">
                        {log.msg || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* TABEL LOG PING LENGKAP (HEARTBEATS PER-PING) */
        <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-fadeIn">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-4 w-28">Status</th>
                <th className="py-2.5 px-4 w-48">Waktu Ping</th>
                <th className="py-2.5 px-4 w-32 text-right">Latency</th>
                <th className="py-2.5 px-4">Pesan Respons ICMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {heartbeats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                    <Activity className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                    Belum ada riwayat ping individual yang tersimpan untuk periode ini.
                  </td>
                </tr>
              ) : (
                [...heartbeats].reverse().map((hb, i) => {
                  const isUp = hb.status === "UP";
                  const d = new Date(hb.created_at);
                  const pad = (n: number) => n.toString().padStart(2, "0");
                  const timeFormatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

                  return (
                    <tr
                      key={hb.id || i}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                        !isUp ? "bg-rose-50/50 dark:bg-rose-950/25" : ""
                      }`}
                    >
                      <td className="py-2 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs ${
                            isUp ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        >
                          {hb.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                        {timeFormatted}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-xs">
                        <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {hb.latency_ms !== null ? `${hb.latency_ms} ms` : "RTO / Timeout"}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-[11px] text-slate-600 dark:text-slate-400">
                        {hb.msg || (isUp ? "Reply from host (ICMP Ping OK)" : "Request timed out / Unreachable")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

