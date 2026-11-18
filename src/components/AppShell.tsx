"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { IdleSessionManager } from "@/components/IdleSessionManager";
import { useCurrentUser } from "@/context/UserContext";
import { getRequiredMenuForPathname } from "@/lib/accessLevels";
import { Lock, ArrowLeft } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    isAuthenticated,
    isLoading,
    accessLevelsLoaded,
    hasMenuAccess,
  } = useCurrentUser();
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [appVersion, setAppVersion] = useState("1.1.0");
  const isRequestBarangOnlyUser = isAuthenticated && currentUser?.role === "request_barang";
  const requiredMenuKey = getRequiredMenuForPathname(pathname);
  const isRouteForbiddenByLevel =
    isAuthenticated &&
    accessLevelsLoaded &&
    !isRequestBarangOnlyUser &&
    Boolean(requiredMenuKey && !hasMenuAccess(requiredMenuKey));

  useEffect(() => {
    if (!isAuthenticated || isRequestBarangOnlyUser) return;
    let active = true;
    fetch("/api/system/updates", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.success && json?.data?.currentVersion) {
          setAppVersion(json.data.currentVersion);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, isRequestBarangOnlyUser]);

  const isPublicPage =
    pathname === "/login" ||
    pathname === "/request-barang" ||
    pathname.startsWith("/request-barang/");

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPage) {
      const reason = typeof window !== "undefined" ? sessionStorage.getItem("actis_logout_reason") : null;
      if (reason === "timeout") {
        router.push("/login?reason=timeout");
      } else {
        router.push("/login");
      }
      return;
    }

    if (!isLoading && isRequestBarangOnlyUser && !isPublicPage) {
      router.replace("/request-barang");
    }
  }, [isLoading, isAuthenticated, isRequestBarangOnlyUser, isPublicPage, pathname, router]);

  // If on login or standalone portal page, render bare without dashboard navigation chrome
  if (pathname === "/login") {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }
  if (isPublicPage) {
    return <main className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</main>;
  }

  // If verifying authentication state or redirecting request_barang-only account, show loading indicator
  if ((isLoading && !isAuthenticated) || isRequestBarangOnlyUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-transparent text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-150">
      {/* Automatic Inactivity / Idle Session Logout Watcher */}
      <IdleSessionManager />

      {/* Vertical Left Sidebar */}
      <Sidebar
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300 ease-in-out md:ml-64 lg:ml-72">
        {/* Top Header */}
        <TopHeader onOpenMobileSidebar={() => setIsOpenMobile(true)} />

        {/* Page Content - Fluid full width to adapt to zoom in/out without empty spaces */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 2xl:px-10 transition-all">
          {isRouteForbiddenByLevel ? (
            <div className="max-w-lg mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                  Level Akses Terbatas
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-1">
                  Akses Menu Tidak Diizinkan
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Akun Anda ({currentUser?.nama || "-"}) saat ini tidak memiliki izin akses untuk membuka halaman ini sesuai konfigurasi <strong>Level Akses</strong> oleh Administrator.
              </p>
              <div className="pt-2 flex justify-center">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs inline-flex items-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Kembali ke Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Global Footer */}
        <footer className="bg-white dark:bg-slate-900/90 dark:backdrop-blur-md border-t border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-xs py-4 px-6 text-center mt-auto transition-colors duration-150">
          <p>
            <Link
              href="/admin/updates"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              title="Lihat Status Update & History Perubahan Fitur"
            >
              ACTIS v{appVersion}
            </Link>{" "}
            &bull; Enterprise ISP Provisioning & NOC Desk &bull; Dual-Backend (Primary SQL + Async Google Sheets Mirror)
          </p>
        </footer>
      </div>
    </div>
  );
}
