"use client";

import React, { useState } from "react";
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

  // Collapsible Menu & Submenu states for:
  // 1. Layanan & Inventaris
  // 2. Tools & Generator
  // 3. Backup Config
  // 4. Integrasi & Sistem
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    layanan: true,
    tools: true,
    backup: true,
    integrasi: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isLayananActive =
    pathname === "/queue" ||
    pathname.startsWith("/pop-sites") ||
    pathname.startsWith("/enterprise") ||
    pathname.startsWith("/ipam") ||
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/dcim");

  const isToolsActive = pathname.startsWith("/tools");

  const isBackupActive = pathname.startsWith("/backups");

  const isIntegrasiActive =
    pathname === "/admin/sync" ||
    pathname.startsWith("/settings") ||
    pathname === "/logs" ||
    pathname === "/admin/logs";

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
                    openSections.layanan ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Layanan & Inventaris */}
              {openSections.layanan && (
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
                    openSections.tools ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Tools & Generator */}
              {openSections.tools && (
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
                      openSections.backup ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {openSections.backup && (
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
                    openSections.integrasi ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Submenu: Integrasi & Sistem */}
              {openSections.integrasi && (
                <div className="pl-2 ml-2 border-l border-slate-200/80 dark:border-slate-800/80 space-y-1 mt-0.5 transition-all duration-200">
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
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

