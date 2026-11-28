"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

/**
 * Syncs an active list-item selection (e.g. ?prefix=... or ?server=...) with Next.js App Router
 * searchParams so clicking an item enters a dedicated specification view inside the same menu while
 * supporting browser Back/Forward, F5 reload persistence, Sidebar <Link> reset, and auto scroll-to-top.
 * Note: Callers must be wrapped inside a React <Suspense> boundary.
 */
export function useUrlQuerySelection(paramKey: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedValue = searchParams.get(paramKey) || "";

  const setSelectedValue = useCallback(
    (nextValue: string, options?: { replace?: boolean; scrollTop?: boolean }) => {
      const cleanNext = nextValue || "";
      const params = new URLSearchParams(searchParams.toString());
      if (cleanNext) {
        params.set(paramKey, cleanNext);
      } else {
        params.delete(paramKey);
      }

      const qs = params.toString();
      const nextHref = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) {
        router.replace(nextHref, { scroll: false });
      } else {
        router.push(nextHref, { scroll: false });
      }

      if (typeof window !== "undefined" && options?.scrollTop !== false) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [paramKey, pathname, router, searchParams]
  );

  return [selectedValue, setSelectedValue] as const;
}

export interface DrilldownSwitchOption {
  value: string;
  label: string;
}

interface SpecificationDrilldownBarProps {
  listLabel: string;
  selectedLabel: string;
  specLabel: string;
  accentColor?: "blue" | "teal" | "indigo" | "rose";
  onBack: () => void;
  switchOptions?: DrilldownSwitchOption[];
  currentSwitchValue?: string;
  onSwitchValue?: (value: string) => void;
  switchPlaceholder?: string;
  actions?: React.ReactNode;
}

const ACCENT_MAP: Record<
  NonNullable<SpecificationDrilldownBarProps["accentColor"]>,
  string
> = {
  blue: "text-blue-600 dark:text-blue-400",
  teal: "text-teal-600 dark:text-teal-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  rose: "text-rose-600 dark:text-rose-400",
};

export function SpecificationDrilldownBar({
  listLabel,
  selectedLabel,
  specLabel,
  accentColor = "blue",
  onBack,
  switchOptions,
  currentSwitchValue,
  onSwitchValue,
  switchPlaceholder = "Pindah cepat...",
  actions,
}: SpecificationDrilldownBarProps) {
  return (
    <div className="space-y-2.5 animate-fadeIn">
      {/* Breadcrumb bar matching Board Antrean > Ticket > NOC Desk Workspace */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition cursor-pointer"
        >
          {listLabel}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">
          {selectedLabel}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className={`font-bold ${ACCENT_MAP[accentColor]}`}>{specLabel}</span>
      </nav>

      {/* Top Navigation & Quick Switcher Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Kembali ke Daftar
          </button>

          {switchOptions && switchOptions.length > 1 && onSwitchValue && (
            <select
              value={currentSwitchValue || ""}
              onChange={(e) => {
                if (e.target.value) onSwitchValue(e.target.value);
              }}
              aria-label={switchPlaceholder}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
            >
              {switchOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
