"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Menu,
  PlusCircle,
  ShieldCheck,
  LogOut,
  ChevronDown,
  KeyRound,
  User,
} from "lucide-react";

interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
}

export function TopHeader({ onOpenMobileSidebar }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useCurrentUser();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const getPageTitle = () => {
    if (pathname === "/queue" || pathname === "/") return "Board Antrean Layanan ISP";
    if (pathname === "/pop-sites") return "Inventaris & Riwayat Master POP Site";
    if (pathname.startsWith("/pop-sites/")) return "Detail Administrasi & History POP Site";
    if (pathname === "/enterprise") return "Inventaris & Riwayat Master Enterprise";
    if (pathname.startsWith("/enterprise/")) return "Detail Administrasi & History Enterprise";
    if (pathname === "/orders/new") return "Pembuatan Surat / Registrasi Layanan";
    if (pathname.includes("/progress")) return "NOC Desk Workspace";
    if (pathname === "/admin/sync") return "Sinkronisasi Google Sheets & Admin";
    if (pathname === "/settings/users") return "Pengaturan User Akses & Keamanan Akun";
    return "ACTIS - ISP Provisioning System";
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 h-16 px-4 sm:px-6 lg:px-8 2xl:px-10 flex items-center justify-between shadow-xs w-full transition-colors duration-150">
      {/* Left: Mobile Toggle & Page Context */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none"
          title="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right: Theme Toggle, + Registrasi POP Site Button & Interactive Role/User Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Dark Mode Theme Selector */}
        <ThemeToggle />

        <Link
          href="/orders/new"
          className={`inline-flex items-center px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition hover:scale-[1.02] ${
            pathname === "/orders/new"
              ? "bg-slate-900 dark:bg-blue-600 text-white ring-2 ring-blue-500"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
          }`}
        >
          <PlusCircle className="w-4 h-4 mr-1.5 sm:mr-2 text-blue-200" />
          <span className="hidden xs:inline">+ Registrasi POP Site</span>
          <span className="xs:hidden">+ Baru</span>
        </Link>

        {/* Current User Dropdown Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition focus:outline-none"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentUser?.role === "admin" ? "bg-purple-600" : "bg-blue-600"
              }`}
            />
            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
              {currentUser?.nama}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">
              ({currentUser?.role?.replace("_", " ")})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-40 p-2 animate-scaleUp">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser?.nama}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.email}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                      currentUser?.role === "admin"
                        ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    {currentUser?.role === "admin"
                      ? "Administrator (Full Access)"
                      : `${currentUser?.role?.replace("_", " ")} (User)`}
                  </span>
                </div>

                <div className="py-1 space-y-0.5">
                  <Link
                    href="/settings/users"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Pengaturan User Akses</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition text-left"
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
    </header>
  );
}
