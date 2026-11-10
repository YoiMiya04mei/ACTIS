"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import {
  Boxes,
  Wrench,
  Layers,
  Building2,
  Network,
  Activity,
  Globe,
  Server,
  FileText,
  Sliders,
  FolderClock,
  Radio,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
  PowerOff,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface RecentOrder {
  id: string;
  ticket_number: string;
  tipe_order: string;
  status: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_pic: string;
  nama_perusahaan?: string | null;
  layanan_dedicated?: string | null;
  vlan?: number | null;
  created_at: string;
  creator?: {
    nama: string;
    role: string;
  } | null;
}

interface DashboardStats {
  queue: {
    total: number;
    aktivasi: number;
    upgrade: number;
    downgrade: number;
    isolir: number;
    unisolir: number;
    terminate: number;
  };
  popSites: {
    total: number;
    active: number;
    isolir: number;
    terminated: number;
  };
  enterprise: {
    total: number;
    active: number;
    isolir: number;
    terminated: number;
  };
  monitoring: {
    total: number;
    up: number;
    down: number;
    pending: number;
    avg_uptime: number;
  };
  ipam: {
    totalPrefixes?: number;
    totalIps?: number;
    totalUsableHosts?: number;
    totalUsedIps?: number;
    totalFreeIps?: number;
    overallUsagePct?: number;
  };
  recentOrders: RecentOrder[];
}

function IpamModernUsageGraph({
  usedIps = 0,
  freeIps = 0,
  totalPrefixes = 0,
}: {
  usedIps: number;
  freeIps: number;
  totalPrefixes: number;
}) {
  const total = usedIps + freeIps;
  const usedPct = total > 0 ? parseFloat(((usedIps / total) * 100).toFixed(1)) : 0;
  const freePct = total > 0 ? parseFloat((100 - usedPct).toFixed(1)) : 100;

  // Donut geometry
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2; // 81
  const circumference = 2 * Math.PI * radius; // ~508.94

  // Ensure minimum visible arc for small values > 0
  const arcLength =
    usedIps === 0
      ? 0
      : Math.max((usedPct / 100) * circumference, 10);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:shadow-md transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Alokasi Prefix IP Public • phpIPAM Usage Graph
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {totalPrefixes} Subnet Prefix
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualisasi kapasitas host, ketersediaan IP bebas, dan utilisasi sirkuit aktif
            </p>
          </div>
        </div>

        <Link
          href="/ipam"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold transition shadow-2xs group self-start sm:self-center"
        >
          <span>Buka phpIPAM</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Main Content: Donut Chart + Integrated Metrics */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Donut Chart with Cutout Center */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90 select-none transform"
              viewBox={`0 0 ${size} ${size}`}
            >
              <defs>
                <linearGradient id="usedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Ring (Free Host) */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth={strokeWidth}
                fill="transparent"
              />

              {/* Foreground Ring (Used Host) */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="url(#usedGrad)"
                strokeWidth={strokeWidth}
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                fill="transparent"
                filter={usedIps > 0 ? "url(#softGlow)" : undefined}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                {usedPct}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Utilisasi
              </span>
              <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {usedIps} / {total.toLocaleString("id-ID")} Host
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
              <span className="text-slate-700 dark:text-slate-300">Terpakai ({usedPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="text-slate-500 dark:text-slate-400">Bebas ({freePct}%)</span>
            </div>
          </div>
        </div>

        {/* Right: 4 Micro KPI Metric Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: IP Terpakai */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                IP Terpakai (Used)
              </span>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
                {usedIps}
              </p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400">
                Sirkuit aktif & reservasi
              </p>
            </div>
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: IP Tersedia */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                IP Tersedia (Free)
              </span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {freeIps.toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400">
                Host siap digunakan
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Total Usable Host */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                Total Usable Host
              </span>
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                {total.toLocaleString("id-ID")}
              </p>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400">
                Kapasitas subnet terdaftar
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Server className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Subnet Prefix */}
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300">
                Subnet Terkelola
              </span>
              <p className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">
                {totalPrefixes} <span className="text-xs font-sans font-bold">Prefix</span>
              </p>
              <p className="text-[10px] text-purple-600/80 dark:text-purple-400">
                Alokasi IP Public ACTIS
              </p>
            </div>
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Network className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Linear Utilization Bar */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Distribusi Alokasi Pool IP Public
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
            {usedIps.toLocaleString("id-ID")} Terpakai ({usedPct}%) • {freeIps.toLocaleString("id-ID")} Bebas ({freePct}%)
          </span>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 flex">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700 shadow-2xs"
            style={{ width: `${Math.max(usedPct, usedIps > 0 ? 1.5 : 0)}%` }}
            title={`IP Terpakai: ${usedIps} (${usedPct}%)`}
          />
          <div
            className="bg-slate-200 dark:bg-slate-700/60 h-full rounded-full transition-all duration-700 flex-1 ml-0.5"
            title={`IP Tersedia: ${freeIps} (${freePct}%)`}
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setStats(json.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(json.error || "Gagal memuat data statistik dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Koneksi ke server terputus");
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Welcome & Summary Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 md:p-8 shadow-lg border border-slate-800">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-semibold text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
              <span>NOC Unified Control Center • ACTIS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Selamat Datang,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-100 to-white">
                {currentUser?.nama || "Tim NOC ACTIS"}
              </span>
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Pusat komando operasional terpadu: monitor inventaris tiket & status site secara real-time, 
              serta akses cepat generator konfigurasi dan pembuatan dokumen resmi NOC.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
              title="Perbarui data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Memperbarui..." : "Refresh Data"}</span>
            </button>

            <Link
              href="/queue"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buka List Antrean</span>
            </Link>
          </div>
        </div>

        {/* Live Status Indicators Banner */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-emerald-300">Sistem Dual-DB & Layanan Aktif</span>
            </div>

            <span className="text-slate-500">•</span>

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Pembaruan: {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} WIB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white border border-white/10">
              Role: {currentUser?.role?.toUpperCase() || "ENGINEER"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PILAR 1: LAYANAN & INVENTARIS */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Layanan & Inventaris
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Pilar 1
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ringkasan operasional tiket antrean, master aset site, alokasi IP, dan status ICMP ping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href="/queue"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              List Antrean →
            </Link>
            <Link
              href="/pop-sites"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              Master POP →
            </Link>
            <Link
              href="/monitoring"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition"
            >
              Ping Monitor →
            </Link>
          </div>
        </div>

        {/* 4 KPI Cards for Layanan & Inventaris */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Antrean Tiket Aktif */}
          <Link
            href="/queue"
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Antrean Tiket NOC
              </span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? "..." : stats?.queue.total ?? 0}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tiket Berjalan
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-900/60">
                Akt: {stats?.queue.aktivasi ?? 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-900/60">
                Upg: {stats?.queue.upgrade ?? 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-900/60">
                Down: {stats?.queue.downgrade ?? 0}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200/60 dark:border-amber-900/60">
                Iso: {(stats?.queue.isolir ?? 0) + (stats?.queue.unisolir ?? 0)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200/60 dark:border-rose-900/60">
                Term: {stats?.queue.terminate ?? 0}
              </span>
            </div>

            <div className="mt-3 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
              <span>Buka List Antrean</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 2: Master POP Site */}
          <Link
            href="/pop-sites"
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Master POP Site
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? "..." : stats?.popSites.total ?? 0}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Site Terdaftar
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats?.popSites.active ?? 0} Active
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {stats?.popSites.isolir ?? 0} Isolir
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {stats?.popSites.terminated ?? 0} Term
              </span>
            </div>

            <div className="mt-3 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              <span>Kelola Master POP Site</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 3: List Enterprise */}
          <Link
            href="/enterprise"
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                List Enterprise
              </span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition">
                <Network className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? "..." : stats?.enterprise.total ?? 0}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Dedicated Pelanggan
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {stats?.enterprise.active ?? 0} Active
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {stats?.enterprise.isolir ?? 0} Isolir
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {stats?.enterprise.terminated ?? 0} Term
              </span>
            </div>

            <div className="mt-3 flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
              <span>Buka List Enterprise</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 4: ICMP Ping Monitor */}
          <Link
            href="/monitoring"
            className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                ICMP Ping Monitor
              </span>
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white transition">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? "..." : `${stats?.monitoring.avg_uptime ?? 100}%`}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Uptime Rata-Rata
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats?.monitoring.up ?? 0} UP
              </span>

              {(stats?.monitoring.down ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  {stats?.monitoring.down} DOWN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                  0 DOWN
                </span>
              )}

              <span className="text-slate-400">
                ({stats?.monitoring.total ?? 0} Host)
              </span>
            </div>

            <div className="mt-3 flex items-center text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform">
              <span>Buka Ping Monitor</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>

        {/* phpIPAM IP Public Usage Graph (Hanya Graph Modern UI/UX) */}
        <IpamModernUsageGraph
          usedIps={stats?.ipam?.totalUsedIps ?? 0}
          freeIps={stats?.ipam?.totalFreeIps ?? 0}
          totalPrefixes={stats?.ipam?.totalPrefixes ?? 0}
        />
      </section>

      {/* ========================================================================= */}
      {/* PILAR 2: TOOLS & GENERATOR */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Tools & Generator
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Pilar 2
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pusat generator konfigurasi MikroTik, shaper QoS, aktivasi OLT, dan dokumen resmi NOC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              6 Toolkit Tersedia
            </span>
          </div>
        </div>

        {/* 1 Kotak Simple Menuju ke Menu Tools & Generator */}
        <Link
          href="/tools"
          className="group relative block overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/60 group-hover:bg-indigo-600 group-hover:text-white transition">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    Pusat Tools & Generator NOC
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    6 Toolkit Terintegrasi
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                  Akses langsung ke seluruh toolkit otomatisasi MikroTik (16 Tools), Traffic QoS Bandwidth Shaper, Aktivasi Huawei GPON, Dokumen Resmi NOC, Template Surat, dan Arsip Dokumen.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white dark:bg-indigo-950/60 dark:group-hover:bg-indigo-600 dark:text-indigo-300 dark:group-hover:text-white text-xs font-bold transition shadow-xs">
                <span>Buka Menu Tools & Generator</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}

