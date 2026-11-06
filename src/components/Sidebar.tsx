"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import {
  Layers,
  Building2,
  FileSpreadsheet,
  Server,
  Network,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ChevronDown,
  ShieldCheck,
  Radio,
  FileText,
  Sliders,
  Users,
  Activity,
  PlusCircle,
  X,
  LogOut,
  KeyRound,
} from "lucide-react";

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, setCurrentUser, users, logout } = useCurrentUser();
  const [isRoleOpen, setIsRoleOpen] = useState(false);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin / Head of NOC";
      case "noc_engineer":
        return "NOC Engineer";
      case "field_engineer":
        return "Field Engineer";
      case "sales_corporate":
        return "Sales Corporate";
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "noc_engineer":
        return "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "field_engineer":
        return "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "sales_corporate":
        return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
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
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-sm ${
          isCollapsed ? "w-20" : "w-64 lg:w-72"
        } ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Top Header in Sidebar (Style exactly like Photo 2) */}
        <div>
          <div className="h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              {/* Blue Icon Squircle like Photo 2 */}
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                <Server className="w-5 h-5 text-white" />
              </div>

              {!isCollapsed && (
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
              )}
            </div>

            {/* Collapse toggle button (< or >) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isCollapsed ? "Perluas Sidebar" : "Persempit Sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

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
          <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-none">
            {/* Main Item: Dashboard Antrean */}
            <div>
              <Link
                href="/queue"
                onClick={onCloseMobile}
                className={`group flex items-center px-3.5 py-3 rounded-2xl text-sm font-bold transition ${
                  pathname === "/queue" || pathname === "/"
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
                title="Dashboard Antrean"
              >
                <div className="flex items-center space-x-3">
                  <Layers
                    className={`w-5 h-5 shrink-0 ${
                      pathname === "/queue" || pathname === "/"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                    }`}
                  />
                  {!isCollapsed && <span>Dashboard Antrean</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                    Queue
                  </span>
                )}
              </Link>
            </div>

            {/* SECTION 1: LAYANAN & INVENTARIS POP SITE */}
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-1 pb-1">
                  LAYANAN & INVENTARIS
                </p>
              )}

              <Link
                href="/pop-sites"
                onClick={onCloseMobile}
                className={`group flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname.startsWith("/pop-sites")
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
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
                  {!isCollapsed && <span>List POP Site</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Aset Aktif
                  </span>
                )}
              </Link>

              <Link
                href="/enterprise"
                onClick={onCloseMobile}
                className={`group flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname.startsWith("/enterprise")
                    ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
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
                  {!isCollapsed && <span>List Enterprise</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Enterprise
                  </span>
                )}
              </Link>
            </div>

            {/* SECTION 2: INTEGRASI SISTEM & DATABASE */}
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-1 pb-1">
                  INTEGRASI & SISTEM
                </p>
              )}

              <Link
                href="/admin/sync"
                onClick={onCloseMobile}
                className={`group flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname === "/admin/sync"
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
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
                  {!isCollapsed && <span>Sheets Sync & Admin</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Sync
                  </span>
                )}
              </Link>

              <Link
                href="/settings/users"
                onClick={onCloseMobile}
                className={`group flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  pathname === "/settings/users"
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                } ${isCollapsed ? "justify-center px-2" : "justify-between"}`}
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
                  {!isCollapsed && <span>Pengaturan User Akses</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Akses
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: KELOLA AKUN / SIMULASI ROLE (Like Photo 2 "Kelola Akun") */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRoleOpen(!isRoleOpen)}
              className={`w-full flex items-center p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 transition text-left focus:outline-none ${
                isCollapsed ? "justify-center" : "justify-between"
              }`}
              title={`Login: ${currentUser.nama} (${currentUser.role})`}
            >
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {currentUser.nama.charAt(0)}
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.nama}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {getRoleLabel(currentUser.role)}
                    </span>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Role
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              )}
            </button>

            {/* Role Dropdown Popup */}
            {isRoleOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsRoleOpen(false)}
                />
                <div className="absolute bottom-12 left-0 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-40 p-2 animate-scaleUp">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      Simulasi Role Pengguna
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ganti role untuk menguji hak akses & NOC desk.
                    </p>
                  </div>
                  <div className="py-1 space-y-0.5">
                    {users.map((u) => {
                      const isSelected = u.id === currentUser.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setCurrentUser(u);
                            setIsRoleOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition text-xs ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/80 dark:border-blue-800/80"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[11px] text-slate-700 dark:text-slate-200">
                              {u.nama.charAt(0)}
                            </div>
                            <div>
                              <p className="truncate font-semibold">{u.nama}</p>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${getRoleBadgeColor(
                                  u.role
                                )}`}
                              >
                                {u.role}
                              </span>
                            </div>
                          </div>
                          {isSelected && <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions Section: Settings & Logout */}
                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <Link
                      href="/settings/users"
                      onClick={() => setIsRoleOpen(false)}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Pengaturan User Akses</span>
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        setIsRoleOpen(false);
                        await logout();
                        router.push("/login");
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

