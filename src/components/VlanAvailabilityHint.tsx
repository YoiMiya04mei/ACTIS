"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Clock } from "lucide-react";

interface VlanConflictItem {
  siteDbId: string;
  siteId: string;
  namaPic: string;
  namaPerusahaan: string | null;
  serviceLabel: string;
  statusLayanan: string;
}

interface QueueConflictItem {
  id: string;
  ticketNumber: string;
  namaPic: string;
  namaPerusahaan: string | null;
  status: string;
}

interface VlanCheckResult {
  server: string;
  vlan: number | null;
  available: boolean;
  nextAvailableVlan: number | null;
  activatedConflicts: VlanConflictItem[];
  queueConflicts: QueueConflictItem[];
}

interface VlanAvailabilityHintProps {
  server: string;
  vlan: string | number;
  excludeSiteId?: string;
  onUseSuggestion?: (suggestedVlan: number) => void;
  className?: string;
}

export function VlanAvailabilityHint({
  server,
  vlan,
  excludeSiteId,
  onUseSuggestion,
  className = "",
}: VlanAvailabilityHintProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VlanCheckResult | null>(null);

  const trimmedServer = server?.trim() || "";
  const rawVlanStr = vlan !== null && vlan !== undefined ? String(vlan).trim() : "";
  const parsedVlan = rawVlanStr ? parseInt(rawVlanStr, 10) : null;
  const isOutOfRange =
    parsedVlan !== null && (!Number.isInteger(parsedVlan) || parsedVlan < 1 || parsedVlan > 4094);

  useEffect(() => {
    if (!trimmedServer || isOutOfRange) {
      setResult(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ server: trimmedServer });
        if (parsedVlan !== null && !isNaN(parsedVlan)) {
          params.set("vlan", String(parsedVlan));
        }
        if (excludeSiteId) {
          params.set("excludeSiteId", excludeSiteId);
        }

        const res = await fetch(`/api/vlan/check?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setResult(json.data);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setResult(null);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmedServer, parsedVlan, excludeSiteId, isOutOfRange]);

  if (!trimmedServer) {
    return (
      <p className={`text-[10px] text-slate-400 mt-1 ${className}`}>
        Pilih server terlebih dahulu untuk memantau ketersediaan VLAN per server.
      </p>
    );
  }

  if (isOutOfRange) {
    return (
      <p className={`text-[10px] font-semibold text-rose-600 mt-1 flex items-center gap-1 ${className}`}>
        <AlertTriangle className="w-3 h-3 shrink-0" />
        VLAN ID harus berupa angka antara 1 - 4094.
      </p>
    );
  }

  if (loading && !result) {
    return (
      <p className={`text-[10px] text-slate-400 mt-1 flex items-center gap-1 ${className}`}>
        <RefreshCw className="w-3 h-3 animate-spin" />
        Mengecek VLAN di server {trimmedServer}...
      </p>
    );
  }

  if (!result) return null;

  const conflict = result.activatedConflicts[0];
  const qConflict = result.queueConflicts[0];

  if (parsedVlan !== null && conflict) {
    return (
      <div
        className={`mt-1.5 p-2 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] flex flex-wrap items-center justify-between gap-2 ${className}`}
      >
        <div className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>VLAN {parsedVlan} Unavailable</strong> di {trimmedServer} (dipakai{" "}
            <strong className="font-mono">{conflict.siteId}</strong> &bull;{" "}
            {conflict.namaPerusahaan || conflict.namaPic} • {conflict.serviceLabel})
            {result.activatedConflicts.length > 1
              ? ` +${result.activatedConflicts.length - 1} lainnya`
              : ""}
          </span>
        </div>

        {result.nextAvailableVlan !== null && onUseSuggestion && (
          <button
            type="button"
            onClick={() => onUseSuggestion(result.nextAvailableVlan!)}
            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            Pakai VLAN {result.nextAvailableVlan}
          </button>
        )}
      </div>
    );
  }

  if (parsedVlan !== null && qConflict) {
    return (
      <div
        className={`mt-1.5 p-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] flex flex-wrap items-center justify-between gap-2 ${className}`}
      >
        <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>VLAN {parsedVlan} Reserved</strong> di antrean ({qConflict.ticketNumber} •{" "}
            {qConflict.namaPerusahaan || qConflict.namaPic})
          </span>
        </div>

        {result.nextAvailableVlan !== null && onUseSuggestion && (
          <button
            type="button"
            onClick={() => onUseSuggestion(result.nextAvailableVlan!)}
            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            Pakai VLAN {result.nextAvailableVlan}
          </button>
        )}
      </div>
    );
  }

  if (parsedVlan !== null) {
    return (
      <div
        className={`mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 ${className}`}
      >
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          VLAN {parsedVlan} <strong>Available</strong> di server {trimmedServer}
        </span>
        {result.nextAvailableVlan !== null &&
          result.nextAvailableVlan !== parsedVlan &&
          onUseSuggestion && (
            <button
              type="button"
              onClick={() => onUseSuggestion(result.nextAvailableVlan!)}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Saran terkecil: {result.nextAvailableVlan}
            </button>
          )}
      </div>
    );
  }

  // Empty VLAN field (e.g. optional LocalLoop)
  if (result.nextAvailableVlan !== null && onUseSuggestion) {
    return (
      <div
        className={`mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 ${className}`}
      >
        <span>Kosongkan jika belum ada VLAN.</span>
        <button
          type="button"
          onClick={() => onUseSuggestion(result.nextAvailableVlan!)}
          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          Gunakan VLAN Available ({result.nextAvailableVlan})
        </button>
      </div>
    );
  }

  return null;
}
