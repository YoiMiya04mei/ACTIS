"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import {
  Layers,
  Building2,
  FileSpreadsheet,
  Server,
  Network,
  ChevronDown,
  ShieldCheck,
  Radio,
  FileText,
  Sliders,
  FolderClock,
  History,
  Activity,
  X,
  Globe,
  Terminal,
  Boxes,
  Wrench,
  Database,
  LayoutDashboard,
  Archive,
  Cable,
  KeyRound,
  Package,
  RotateCcw,
  BarChart3,
  Settings,
  Tags,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Share2,
  RefreshCw,
} from "lucide-react";

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";
  const isBackupAllowed =
    currentUser?.role === "admin" || currentUser?.role === "noc_engineer";

  const isLayananActive =
    pathname === "/queue" ||
    pathname.startsWith("/pop-sites") ||
    pathname.startsWith("/enterprise") ||
    pathname.startsWith("/ipam") ||
    pathname.startsWith("/vlan") ||
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/dcim");

  const isInventoryActive = pathname.startsWith("/inventory");

  const isToolsActive = pathname.startsWith("/tools");

  const isBackupActive = pathname.startsWith("/backups");

  const isIntegrasiActive =
    pathname === "/admin/sync" ||
    pathname.startsWith("/admin/updates") ||
    pathname.startsWith("/tacacs") ||
    pathname.startsWith("/settings") ||
    pathname === "/logs" ||
    pathname === "/admin/logs";

  // Accordion Menu: Hanya 1 menu sidebar yang terbuka dalam satu waktu
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    if (isInventoryActive) return "inventory";
    if (isToolsActive) return "tools";
    if (isBackupActive) return "backup";
    if (isIntegrasiActive) return "integrasi";
    return "layanan";
  });

  // Sinkronisasi otomatis section yang terbuka jika user berpindah halaman
  useEffect(() => {
    if (isLayananActive) setActiveSection("layanan");
    else if (isInventoryActive) setActiveSection("inventory");
    else if (isToolsActive) setActiveSection("tools");
    else if (isBackupActive) setActiveSection("backup");
    else if (isIntegrasiActive) setActiveSection("integrasi");
  }, [pathname, isLayananActive, isInventoryActive, isToolsActive, isBackupActive, isIntegrasiActive]);

  const toggleSection = (key: string) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out shadow-sm ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Top Header in Sidebar (Style exactly like Photo 2) */}
        <div className="flex flex-col h-full">
          <div className="h-16 shrink-0 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              {/* Blue Icon Squircle like Photo 2 */}
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                <Server className="w-5 h-5 text-white" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate">
                    ACTIS TOOLS
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                    Dual-DB
                  </span>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate">
                  ISP PROVISIONING & NOC
                </span>
              </div>
            </div>

            {/* Close button on mobile */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links Grouped by Section (Styled like Photo 2) */}
          <div className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-none">
            {/* TOP NAVIGATION: DASHBOARD UTAMA */}
            <div className="space-y-1">
              <Link
                href="/dashboard"
                onClick={onCloseMobile}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname === "/dashboard"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-sm shadow-blue-500/20"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Dashboard Utama"
              >
                <div className="flex items-center space-x-3">
                  <LayoutDashboard
                    className={`w-5 h-5 shrink-0 ${
                      pathname === "/dashboard"
                        ? "text-white"
                        : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                    }`}
                  />
                  <span>Dashboard</span>
                </div>
              </Link>
            </div>

            {/* SECTION 1: LAYANAN & INVENTARIS */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("layanan")}
                className={`w-full group flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition select-none ${
                  isLayananActive
                    ? "text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
                title="Layanan & Inventaris (Klik untuk Buka/Tutup Submenu)"
              >
                <div className="flex items-center space-x-2.5">
                  <Boxes
                    className={`w-4 h-4 shrink-0 ${
                      isLayananActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  />
                  <span>LAYANAN & INVENTARIS</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === "layanan" ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Layanan & Inventaris */}
              {activeSection === "layanan" && (
                <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
                  <Link
                    href="/queue"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname === "/queue"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="List Antrean"
                  >
                    <div className="flex items-center space-x-3">
                      <Layers
                        className={`w-5 h-5 shrink-0 ${
                          pathname === "/queue"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>List Antrean</span>
                    </div>
                  </Link>

                  <Link
                    href="/pop-sites"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/pop-sites")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="List POP Site"
                  >
                    <div className="flex items-center space-x-3">
                      <Building2
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/pop-sites")
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span>List POP Site</span>
                    </div>
                  </Link>

                  <Link
                    href="/enterprise"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/enterprise")
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="List Enterprise"
                  >
                    <div className="flex items-center space-x-3">
                      <Network
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/enterprise")
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                        }`}
                      />
                      <span>List Enterprise</span>
                    </div>
                  </Link>

                  <Link
                    href="/ipam"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/ipam")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Prefix IP Public (phpIPAM)"
                  >
                    <div className="flex items-center space-x-3">
                      <Globe
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/ipam")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>Prefix IP Public</span>
                    </div>
                  </Link>

                  <Link
                    href="/vlan"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/vlan")
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="VLAN Management (Available & Unavailable per Server)"
                  >
                    <div className="flex items-center space-x-3">
                      <Tags
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/vlan")
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        }`}
                      />
                      <span>VLAN Management</span>
                    </div>
                  </Link>

                  <Link
                    href="/monitoring"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/monitoring")
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="ICMP Ping Monitor"
                  >
                    <div className="flex items-center space-x-3">
                      <Activity
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/monitoring")
                            ? "text-emerald-600 dark:text-emerald-400 animate-pulse"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span>ICMP Ping Monitor</span>
                    </div>
                  </Link>

                  <Link
                    href="/dcim/racks"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/dcim/racks")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Database Rack 3D (Collocation)"
                  >
                    <div className="flex items-center space-x-3">
                      <Server
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/dcim/racks")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>Database Rack 3D</span>
                    </div>
                  </Link>

                  <Link
                    href="/dcim/otbs"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/dcim/otbs")
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Database OTB 3D (Dark Fiber)"
                  >
                    <div className="flex items-center space-x-3">
                      <Cable
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/dcim/otbs")
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                        }`}
                      />
                      <span>Database OTB 3D</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* SECTION: INVENTORY MANAGEMENT */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("inventory")}
                className={`w-full group flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition select-none ${
                  isInventoryActive
                    ? "text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
                title="Inventory Management (Klik untuk Buka/Tutup Submenu)"
              >
                <div className="flex items-center space-x-2.5">
                  <Package
                    className={`w-4 h-4 shrink-0 ${
                      isInventoryActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  />
                  <span>INVENTORY MANAGEMENT</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === "inventory" ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Inventory Management */}
              {activeSection === "inventory" && (
                <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
                  {/* 1. Dashboard Inventory */}
                  <Link
                    href="/inventory/dashboard"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/dashboard" || pathname === "/inventory"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Dashboard Ringkasan & Statistik Inventory"
                  >
                    <div className="flex items-center space-x-3">
                      <LayoutDashboard
                        className={`w-4 h-4 shrink-0 ${
                          pathname.startsWith("/inventory/dashboard")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span className="truncate">Dashboard Inventory</span>
                    </div>
                  </Link>

                  {/* 2. Master Barang */}
                  <Link
                    href="/inventory/items"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/items" || pathname.startsWith("/inventory/items/")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Master Data Barang Reusable & Consumable"
                  >
                    <div className="flex items-center space-x-3">
                      <Boxes
                        className={`w-4 h-4 shrink-0 ${
                          pathname.startsWith("/inventory/items")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span className="truncate">Master Barang</span>
                    </div>
                  </Link>

                  {/* 3. Stok Inventory */}
                  <Link
                    href="/inventory/stock"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/stock"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Monitoring Saldo Stok, Opname & Penyesuaian"
                  >
                    <div className="flex items-center space-x-3">
                      <Layers
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/stock"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span className="truncate">Stok Inventory</span>
                    </div>
                  </Link>

                  {/* 5. Barang Masuk */}
                  <Link
                    href="/inventory/transactions/in"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/transactions/in"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Penerimaan Barang Masuk (Stock In)"
                  >
                    <div className="flex items-center space-x-3">
                      <ArrowDownLeft
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/transactions/in"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span className="truncate">Barang Masuk</span>
                    </div>
                  </Link>

                  {/* 6. Barang Keluar */}
                  <Link
                    href="/inventory/transactions/out"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/transactions/out"
                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Pengeluaran Barang Keluar (Stock Out)"
                  >
                    <div className="flex items-center space-x-3">
                      <ArrowUpRight
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/transactions/out"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400"
                        }`}
                      />
                      <span className="truncate">Barang Keluar</span>
                    </div>
                  </Link>

                  {/* 7. Barang Sedang Digunakan */}
                  <Link
                    href="/inventory/in-use"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/in-use"
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Monitoring Perangkat Reusable di Luar Gudang & PIC"
                  >
                    <div className="flex items-center space-x-3">
                      <Clock
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/in-use"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                        }`}
                      />
                      <span className="truncate">Barang Sedang Digunakan</span>
                    </div>
                  </Link>

                  {/* 8. Barang Dipinjamkan */}
                  <Link
                    href="/inventory/loaned"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/loaned"
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Monitoring Perangkat Dipinjamkan / Terpasang di Pelanggan"
                  >
                    <div className="flex items-center space-x-3">
                      <Share2
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/loaned"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        }`}
                      />
                      <span className="truncate">Barang Dipinjamkan</span>
                    </div>
                  </Link>

                  {/* 8. Pengembalian Barang */}
                  <Link
                    href="/inventory/returns"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/returns" || pathname.startsWith("/inventory/returns/")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Proses Pengembalian Barang Reusable Sebagian & Penuh"
                  >
                    <div className="flex items-center space-x-3">
                      <RotateCcw
                        className={`w-4 h-4 shrink-0 ${
                          pathname.startsWith("/inventory/returns")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span className="truncate">Pengembalian Barang</span>
                    </div>
                  </Link>

                  {/* 9. Barang Habis Pakai */}
                  <Link
                    href="/inventory/consumables"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/consumables"
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Pengelolaan & Riwayat Konsumsi Material Habis Pakai"
                  >
                    <div className="flex items-center space-x-3">
                      <Cable
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/consumables"
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                        }`}
                      />
                      <span className="truncate">Barang Habis Pakai</span>
                    </div>
                  </Link>

                  {/* 10. Riwayat Transaksi */}
                  <Link
                    href="/inventory/history"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/history"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Audit Trail Pergerakan Stok & Perubahan PIC/Lokasi"
                  >
                    <div className="flex items-center space-x-3">
                      <History
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/history"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span className="truncate">Riwayat Transaksi</span>
                    </div>
                  </Link>

                  {/* 11. Laporan Inventory */}
                  <Link
                    href="/inventory/reports"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      pathname === "/inventory/reports"
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Rekapitulasi Laporan Stok, Mutasi & Penggunaan"
                  >
                    <div className="flex items-center space-x-3">
                      <BarChart3
                        className={`w-4 h-4 shrink-0 ${
                          pathname === "/inventory/reports"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        }`}
                      />
                      <span className="truncate">Laporan Inventory</span>
                    </div>
                  </Link>

                  {/* 12. Pengaturan Inventory */}
                  {isSuperAdmin && (
                    <Link
                      href="/inventory/settings"
                      onClick={onCloseMobile}
                      className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                        pathname === "/inventory/settings"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 font-bold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Konfigurasi Parameter & Default Inventory (Admin)"
                    >
                      <div className="flex items-center space-x-3">
                        <Settings
                          className={`w-4 h-4 shrink-0 ${
                            pathname === "/inventory/settings"
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                          }`}
                        />
                        <span className="truncate">Pengaturan Inventory</span>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: TOOLS & GENERATOR */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("tools")}
                className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition select-none ${
                  isToolsActive
                    ? "text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
                title="Tools & Generator (Klik untuk Buka/Tutup Submenu)"
              >
                <div className="flex items-center space-x-2.5">
                  <Wrench
                    className={`w-4 h-4 shrink-0 ${
                      isToolsActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  />
                  <span>TOOLS & GENERATOR</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === "tools" ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Tools & Generator */}
              {activeSection === "tools" && (
                <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
                  <Link
                    href="/tools/mikrotik"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/tools/mikrotik")
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="MikroTik Tools (16 Generator)"
                  >
                    <div className="flex items-center space-x-3">
                      <Server
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/tools/mikrotik")
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>MikroTik Tools</span>
                    </div>
                  </Link>

                  <Link
                    href="/tools/traffic-qos"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/tools/traffic-qos")
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Traffic QoS Bandwidth Shaper"
                  >
                    <div className="flex items-center space-x-3">
                      <Network
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/tools/traffic-qos")
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span>Traffic QoS</span>
                    </div>
                  </Link>

                  {isSuperAdmin && (
                    <Link
                      href="/tools/huawei"
                      onClick={onCloseMobile}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                        pathname.startsWith("/tools/huawei")
                          ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 font-bold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Aktivasi Huawei OLT / ONT (Super Admin Only)"
                    >
                      <div className="flex items-center space-x-3">
                        <Terminal
                          className={`w-5 h-5 shrink-0 ${
                            pathname.startsWith("/tools/huawei")
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400"
                          }`}
                        />
                        <span>Aktivasi Huawei</span>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/tools/documents"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname === "/tools/documents"
                        ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Dokumen & Surat NOC (BA, ST, Permit, RFO, BPV)"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText
                        className={`w-5 h-5 shrink-0 ${
                          pathname === "/tools/documents"
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                        }`}
                      />
                      <span>Dokumen & Surat</span>
                    </div>
                  </Link>

                  {isSuperAdmin && (
                    <Link
                      href="/tools/templates"
                      onClick={onCloseMobile}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                        pathname.startsWith("/tools/templates") || pathname.startsWith("/tools/documents/templates")
                          ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 font-bold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Pengaturan Template Surat, Kop & Tanda Tangan (Super Admin Only)"
                    >
                      <div className="flex items-center space-x-3">
                        <Sliders
                          className={`w-5 h-5 shrink-0 ${
                            pathname.startsWith("/tools/templates") || pathname.startsWith("/tools/documents/templates")
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                          }`}
                        />
                        <span>Template Surat</span>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/tools/documents/history"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/tools/documents/history") || pathname === "/tools/history"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Arsip & Riwayat Dokumen NOC"
                  >
                    <div className="flex items-center space-x-3">
                      <FolderClock
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/tools/documents/history") || pathname === "/tools/history"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>Arsip Dokumen</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* SECTION 3: BACKUP CONFIG (MENU TERSENDIRI) */}
            {isBackupAllowed && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection("backup")}
                  className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition select-none ${
                    isBackupActive
                      ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 shadow-2xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                  title="Backup Config Network (Klik untuk Buka/Tutup Submenu)"
                >
                  <div className="flex items-center space-x-2.5">
                    <Archive
                      className={`w-4 h-4 shrink-0 ${
                        isBackupActive
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      }`}
                    />
                    <span>BACKUP CONFIG</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      activeSection === "backup" ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {activeSection === "backup" && (
                  <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
                    <Link
                      href="/backups"
                      onClick={onCloseMobile}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                        pathname.startsWith("/backups")
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-bold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Backup Config Network & Google Drive Sync"
                    >
                      <div className="flex items-center space-x-3">
                        <Archive
                          className={`w-5 h-5 shrink-0 ${
                            pathname.startsWith("/backups")
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                          }`}
                        />
                        <span>Backup Config</span>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: INTEGRASI & SISTEM */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection("integrasi")}
                className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition select-none ${
                  isIntegrasiActive
                    ? "text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 shadow-2xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
                title="Integrasi & Sistem (Klik untuk Buka/Tutup Submenu)"
              >
                <div className="flex items-center space-x-2.5">
                  <Database
                    className={`w-4 h-4 shrink-0 ${
                      isIntegrasiActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  />
                  <span>INTEGRASI & SISTEM</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    activeSection === "integrasi" ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Integrasi & Sistem */}
              {activeSection === "integrasi" && (
                <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
                  {isBackupAllowed && (
                    <Link
                      href="/tacacs"
                      onClick={onCloseMobile}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                        pathname.startsWith("/tacacs")
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-bold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="TACACS+ AAA Server (RFC 8907)"
                    >
                      <div className="flex items-center space-x-3">
                        <KeyRound
                          className={`w-5 h-5 shrink-0 ${
                            pathname.startsWith("/tacacs")
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                          }`}
                        />
                        <span>TACACS+ Server</span>
                      </div>
                    </Link>
                  )}

                  <Link
                    href="/admin/sync"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname === "/admin/sync"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Google Sheets Sync & Admin"
                  >
                    <div className="flex items-center space-x-3">
                      <FileSpreadsheet
                        className={`w-5 h-5 shrink-0 ${
                          pathname === "/admin/sync"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        }`}
                      />
                      <span>Sheets Sync & Admin</span>
                    </div>
                  </Link>

                  <Link
                    href="/settings/users"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname === "/settings/users"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Pengaturan User Akses & Profil"
                  >
                    <div className="flex items-center space-x-3">
                      <ShieldCheck
                        className={`w-5 h-5 shrink-0 ${
                          pathname === "/settings/users"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        }`}
                      />
                      <span>Pengaturan User Akses</span>
                    </div>
                  </Link>

                  <Link
                    href="/logs"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname === "/logs" || pathname === "/admin/logs"
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Log Aplikasi & Riwayat Aktivitas Login/Perubahan"
                  >
                    <div className="flex items-center space-x-3">
                      <History
                        className={`w-5 h-5 shrink-0 ${
                          pathname === "/logs" || pathname === "/admin/logs"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                        }`}
                      />
                      <span>Log Aplikasi</span>
                    </div>
                  </Link>

                  <Link
                    href="/admin/updates"
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      pathname.startsWith("/admin/updates")
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Update Sistem (Git / Docker / File ZIP) & History Perubahan Fitur"
                  >
                    <div className="flex items-center space-x-3">
                      <RefreshCw
                        className={`w-5 h-5 shrink-0 ${
                          pathname.startsWith("/admin/updates")
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span>Update & Changelog</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

