"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrafficQoSPage } from "@/components/tools/pages/TrafficQoSPage";
import { ToastContainer, ToastMessage } from "@/components/tools/Toast";

export default function TrafficQoSRoute() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage["type"], title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Link
            href="/tools"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-emerald-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Kembali ke Hub Tools
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Traffic QoS Bandwidth Shaper
          </span>
        </div>
      </div>

      <TrafficQoSPage addToast={addToast} />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
