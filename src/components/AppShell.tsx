"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { useCurrentUser } from "@/context/UserContext";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCurrentUser();
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // If on login page, render bare without navigation chrome
  if (pathname === "/login") {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  // If verifying authentication state, show loading indicator
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-150">
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
          {children}
        </main>

        {/* Global Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs py-4 px-6 text-center mt-auto transition-colors duration-150">
          <p>
            ACTIS v1.0 &bull; Enterprise ISP Provisioning & NOC Desk &bull; Dual-Backend (Primary SQL + Async Google Sheets Mirror)
          </p>
        </footer>
      </div>
    </div>
  );
}
