"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import {
  Layers,
  PlusCircle,
  FileSpreadsheet,
  Activity,
  Menu,
  X,
  ChevronDown,
  UserCheck,
  Server,
  Building2,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, setCurrentUser, users } = useCurrentUser();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const leftNavLinks = [
    {
      name: "Board Antrean",
      href: "/queue",
      icon: <Layers className="w-4 h-4 mr-1.5" />,
    },
    {
      name: "List POP Site",
      href: "/pop-sites",
      icon: <Building2 className="w-4 h-4 mr-1.5 text-emerald-400" />,
    },
    {
      name: "Sheets Sync & Admin",
      href: "/admin/sync",
      icon: <FileSpreadsheet className="w-4 h-4 mr-1.5 text-indigo-400" />,
    },
  ];

  const allNavLinks = [
    ...leftNavLinks,
    {
      name: "+ Registrasi POP Site",
      href: "/orders/new",
      icon: <PlusCircle className="w-4 h-4 mr-1.5 text-blue-400" />,
    },
  ];

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
        return "bg-purple-900/60 text-purple-300 border-purple-700";
      case "noc_engineer":
        return "bg-blue-900/60 text-blue-300 border-blue-700";
      case "field_engineer":
        return "bg-amber-900/60 text-amber-300 border-amber-700";
      case "sales_corporate":
        return "bg-emerald-900/60 text-emerald-300 border-emerald-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* POJOK KIRI: Brand Logo + Menu-Menu Navigasi */}
          <div className="flex items-center space-x-4 lg:space-x-6">
            <Link href="/queue" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition">
                <Server className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black tracking-wider text-white">
                    ACT<span className="text-blue-400">IS</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Dual-DB
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden xl:inline-block leading-tight font-medium">
                  ISP Service Provisioning & NOC Desk
                </span>
              </div>
            </Link>

            {/* Separator Garis Vertikal */}
            <div className="hidden md:block h-6 w-px bg-slate-800" />

            {/* Desktop Navigation di Pojok Kiri */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {leftNavLinks.map((link) => {
                const isActive = pathname === link.href || (link.href === "/queue" && pathname === "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-bold"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* SISI KANAN: Tombol Aksi + Registrasi POP Site & User Role Switcher */}
          <div className="hidden sm:flex items-center space-x-3">
            <Link
              href="/orders/new"
              className={`inline-flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition hover:scale-[1.02] ${
                pathname === "/orders/new"
                  ? "bg-blue-500 text-white ring-2 ring-blue-300 shadow-blue-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
              }`}
            >
              <PlusCircle className="w-4 h-4 mr-2 text-blue-200" />
              + Registrasi POP Site
            </Link>

            <div className="h-6 w-px bg-slate-800 mx-1" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:bg-slate-800 transition text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {currentUser?.nama ? currentUser.nama.charAt(0) : "U"}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-[130px]">
                    {currentUser?.nama || "-"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {getRoleLabel(currentUser?.role || "")}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Menu */}
              {isRoleDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsRoleDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-20 py-2 animate-fadeIn">
                    <div className="px-3 py-2 border-b border-slate-700/80">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                        Simulasi Role Pengguna
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Pilih user untuk menguji hak akses dan log aktivitas NOC.
                      </p>
                    </div>
                    <div className="py-1">
                      {users.map((u) => {
                        const isSelected = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setCurrentUser(u);
                              setIsRoleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-750 transition ${
                              isSelected ? "bg-blue-600/15" : ""
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                                {u.nama.charAt(0)}
                              </div>
                              <div>
                                <p
                                  className={`text-xs font-semibold ${
                                    isSelected ? "text-blue-400" : "text-slate-200"
                                  }`}
                                >
                                  {u.nama}
                                </p>
                                <span
                                  className={`inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded border ${getRoleBadgeColor(
                                    u.role
                                  )}`}
                                >
                                  {getRoleLabel(u.role)}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <UserCheck className="w-4 h-4 text-blue-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-5 space-y-3">
          <div className="space-y-1">
            {allNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  pathname === link.href
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </div>

          {/* Mobile Role Switcher */}
          <div className="pt-3 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-400 mb-2">Login sebagai:</p>
            <div className="grid grid-cols-1 gap-1.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg text-left text-xs ${
                    u.id === currentUser.id
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span className="font-medium">{u.nama}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

