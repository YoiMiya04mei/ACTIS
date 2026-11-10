"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { HuaweiActivationPage } from "@/components/tools/pages/HuaweiActivationPage";
import { ToastContainer, ToastMessage } from "@/components/tools/Toast";
import { useCurrentUser } from "@/context/UserContext";

export default function HuaweiActivationRoute() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { currentUser } = useCurrentUser();

  const addToast = (type: ToastMessage["type"], title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Role Guard: Only Super Admin (admin)
  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4 animate-fadeIn">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase tracking-wider">
            Super Admin Only
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-1">
            Akses Ditolak / Terbatas
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Modul <strong>Aktivasi Huawei OLT / ONT</strong> hanya dapat diakses oleh akun dengan peran <strong>Super Admin (Head of NOC / Admin)</strong>. Akun Anda saat ini ({currentUser.nama}) tidak memiliki izin akses untuk fitur ini.
        </p>
        <div className="pt-2 flex justify-center">
          <Link
            href="/tools"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition shadow-xs flex items-center"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Kembali ke Tools Hub
          </Link>
        </div>
      </div>
    );
  }

  // Map ACTIS user to tools UserAccount shape
  const toolUser = currentUser
    ? {
        id: currentUser.id,
        username: currentUser.email.split("@")[0],
        name: currentUser.nama,
        role: "admin" as const,
        position: currentUser.role,
        avatarColor: "from-blue-600 to-indigo-600",
        createdAt: new Date().toISOString(),
      }
    : null;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Link
            href="/tools"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-rose-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Kembali ke Hub Tools
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Aktivasi Huawei OLT / ONT
          </span>
        </div>
      </div>

      <HuaweiActivationPage
        addToast={addToast}
        currentUser={toolUser}
        onNavigateDashboard={() => {}}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
