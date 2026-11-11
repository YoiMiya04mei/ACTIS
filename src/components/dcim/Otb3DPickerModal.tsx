"use client";

import React, { useEffect, useMemo, useState } from "react";
import { NativeDialog } from "./NativeDialog";
import { Otb3DViewer } from "./Otb3DViewer";
import {
  OpticalOtbItem,
  OtbCoreItem,
  formatOtbCoreLabel,
  getTiaColorForCore,
  getTiaTubeColorForTray,
} from "@/lib/dcimUtils";
import {
  Cable,
  X,
  CheckCircle2,
  MapPin,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Activity,
} from "lucide-react";
import Link from "next/link";

export interface OtbSelectionResult {
  otb: OpticalOtbItem;
  coreNumbers: number[];
}

interface Otb3DPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "select" | "inspect";
  requiredCores?: number;
  initialOtbId?: string | null;
  initialSelectedCores?: number[];
  preloadedOtbs?: OpticalOtbItem[];
  onConfirmSelection?: (selection: OtbSelectionResult) => void;
}

export function Otb3DPickerModal({
  isOpen,
  onClose,
  mode = "select",
  requiredCores = 2,
  initialOtbId = null,
  initialSelectedCores = [],
  preloadedOtbs,
  onConfirmSelection,
}: Otb3DPickerModalProps) {
  const [otbs, setOtbs] = useState<OpticalOtbItem[]>(preloadedOtbs || []);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeOtbId, setActiveOtbId] = useState<string>(initialOtbId || "");
  const [targetCoreCount, setTargetCoreCount] = useState<number>(Math.max(1, requiredCores));
  const [selectedCores, setSelectedCores] = useState<number[]>(initialSelectedCores);
  const [inspectedPort, setInspectedPort] = useState<OtbCoreItem | null>(null);

  const fetchOtbs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dcim/otbs", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat daftar OTB 3D.");
      }
      const list: OpticalOtbItem[] = json.data || [];
      setOtbs(list);
      if (list.length > 0) {
        const preferred =
          (initialOtbId && list.find((o) => o.id === initialOtbId)) || list[0];
        setActiveOtbId((prev) => {
          if (prev && list.some((o) => o.id === prev)) return prev;
          return preferred.id;
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan memuat OTB.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTargetCoreCount(Math.max(1, requiredCores));
    setSelectedCores(initialSelectedCores || []);
    setInspectedPort(null);
    if (initialOtbId) {
      setActiveOtbId(initialOtbId);
    }
    if (preloadedOtbs && preloadedOtbs.length > 0) {
      setOtbs(preloadedOtbs);
      const preferred =
        (initialOtbId && preloadedOtbs.find((o) => o.id === initialOtbId)) ||
        preloadedOtbs[0];
      setActiveOtbId(preferred.id);
    } else {
      fetchOtbs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialOtbId, requiredCores]);

  const activeOtb = useMemo(
    () => otbs.find((o) => o.id === activeOtbId) || otbs[0] || null,
    [otbs, activeOtbId]
  );

  // Sinkronisasi awal inspected port bila ada core terpilih saat inspect mode
  useEffect(() => {
    if (!activeOtb) return;
    if (selectedCores.length > 0 && !inspectedPort) {
      const found =
        activeOtb.ports.find((p) => p.core_number === selectedCores[0]) || null;
      if (found) setInspectedPort(found);
    }
  }, [activeOtb, selectedCores, inspectedPort]);

  const groupedTrays = useMemo(() => {
    if (!activeOtb) return [];
    const map = new Map<number, OtbCoreItem[]>();
    for (const p of activeOtb.ports) {
      const list = map.get(p.tray_number) || [];
      list.push(p);
      map.set(p.tray_number, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([trayNumber, ports]) => ({
        trayNumber,
        tubeColor: getTiaTubeColorForTray(trayNumber),
        ports: [...ports].sort((a, b) => a.core_number - b.core_number),
      }));
  }, [activeOtb]);

  const handleOtbChange = (newOtbId: string) => {
    setActiveOtbId(newOtbId);
    setSelectedCores([]);
    setInspectedPort(null);
  };

  const handlePortClick = (port: OtbCoreItem) => {
    setInspectedPort(port);
    if (mode !== "select") return;

    if (port.status !== "Available") {
      // Tetap tampilkan detail core terpakai tanpa menambah ke seleksi
      return;
    }

    setSelectedCores((prev) => {
      if (prev.includes(port.core_number)) {
        return prev.filter((c) => c !== port.core_number).sort((a, b) => a - b);
      }
      // Tambahkan hingga targetCoreCount (atau ganti yang terlama bila user memilih lebih)
      if (prev.length >= targetCoreCount) {
        const sliced = prev.slice(1);
        return [...sliced, port.core_number].sort((a, b) => a - b);
      }
      return [...prev, port.core_number].sort((a, b) => a - b);
    });
  };

  const handleAutoPickConsecutive = () => {
    if (!activeOtb) return;
    const sorted = [...activeOtb.ports].sort((a, b) => a.core_number - b.core_number);

    // Cari N core Available berurutan di tray yang sama lebih dulu
    for (let i = 0; i <= sorted.length - targetCoreCount; i++) {
      const slice = sorted.slice(i, i + targetCoreCount);
      const allAvailable = slice.every((p) => p.status === "Available");
      const consecutive =
        slice[slice.length - 1].core_number - slice[0].core_number ===
        targetCoreCount - 1;
      const sameTray = slice.every((p) => p.tray_number === slice[0].tray_number);
      if (allAvailable && consecutive && sameTray) {
        setSelectedCores(slice.map((p) => p.core_number));
        setInspectedPort(slice[0]);
        return;
      }
    }

    // Fallback: ambil N core Available terurut pertama
    const anyAvailable = sorted.filter((p) => p.status === "Available").slice(0, targetCoreCount);
    if (anyAvailable.length > 0) {
      setSelectedCores(anyAvailable.map((p) => p.core_number));
      setInspectedPort(anyAvailable[0]);
    }
  };

  const sortedSelected = useMemo(
    () => [...selectedCores].sort((a, b) => a - b),
    [selectedCores]
  );

  const handleConfirm = () => {
    if (!activeOtb || sortedSelected.length === 0) return;
    onConfirmSelection?.({
      otb: activeOtb,
      coreNumbers: sortedSelected,
    });
    onClose();
  };

  return (
    <NativeDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="otb-3d-modal-title"
      maxWidthClass="max-w-7xl"
    >
      <div className="flex flex-col max-h-[92vh] bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Cable className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="otb-3d-modal-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate"
                >
                  {mode === "select"
                    ? "Pilih Core OTB 3D untuk Aktivasi Dark Fiber"
                    : "Inspeksi Terminasi Core — OTB 3D"}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  TIA-598 WebGL 3D
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "select"
                  ? "Klik adapter core atau tarik tray kaset pada model 3D, lalu pilih jumlah core sesuai kebutuhan."
                  : "Klik adapter atau port pada model OTB 3D untuk memeriksa rute pair, redaman (dB), dan customer."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dcim/otbs"
              onClick={onClose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Kelola Database OTB
            </Link>
            <button
              type="button"
              onClick={fetchOtbs}
              disabled={loading}
              title="Muat ulang data OTB"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup popup OTB 3D"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && otbs.length === 0 ? (
            <div className="h-[460px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-purple-400" />
              <p className="text-sm font-semibold">Memuat Panel OTB Fiber Optik 3D...</p>
            </div>
          ) : !activeOtb ? (
            <div className="h-[420px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center p-6">
              <Cable className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Belum ada Data OTB 3D tersedia.
              </p>
              <Link
                href="/dcim/otbs"
                onClick={onClose}
                className="mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
              >
                Buka Halaman Database OTB 3D
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 3D Viewport */}
              <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex-1 min-w-[230px]">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Optical Termination Box (OTB)
                    </label>
                    <select
                      value={activeOtb.id}
                      onChange={(e) => handleOtbChange(e.target.value)}
                      disabled={mode === "inspect" && Boolean(initialOtbId)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {otbs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} — {o.name} ({o.stats.available_cores}/{o.total_cores} Free)
                        </option>
                      ))}
                    </select>
                  </div>

                  {mode === "select" && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Kebutuhan Core
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 4, 6, 12].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setTargetCoreCount(preset);
                              setSelectedCores((prev) => prev.slice(0, preset));
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                              targetCoreCount === preset
                                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {preset}C
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Otb3DViewer
                  otb={activeOtb}
                  mode={mode === "select" ? "select" : "view"}
                  selectedCores={sortedSelected}
                  activeCoreNumber={inspectedPort?.core_number || null}
                  onClickCore={handlePortClick}
                  heightClass="h-[460px] sm:h-[510px]"
                />
              </div>

              {/* Right Panel: Tray Matrix & Core Inspector */}
              <div className="lg:col-span-5 xl:col-span-5 space-y-4">
                {/* OTB Summary Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                        {activeOtb.code} · {activeOtb.connector_type} · {activeOtb.fiber_mode}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {activeOtb.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>
                          {activeOtb.location}
                          {activeOtb.pop_node ? ` • ${activeOtb.pop_node}` : ""}
                        </span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                      {activeOtb.stats.available_cores} Free
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center pt-1">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Available</div>
                      <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {activeOtb.stats.available_cores}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Used</div>
                      <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        {activeOtb.stats.used_cores}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Reserved</div>
                      <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                        {activeOtb.stats.reserved_cores}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400">Damaged</div>
                      <div className="text-xs font-extrabold text-red-600 dark:text-red-400">
                        {activeOtb.stats.damaged_cores}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selection Status + Auto-Pair */}
                {mode === "select" && (
                  <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/70 bg-purple-50/70 dark:bg-purple-950/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-purple-900 dark:text-purple-200">
                        Core Terpilih ({sortedSelected.length}/{targetCoreCount})
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoPickConsecutive}
                        disabled={activeOtb.stats.available_cores === 0}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" /> Auto-Pilih Pair
                      </button>
                    </div>

                    {sortedSelected.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sortedSelected.map((cNum) => {
                          const tia = getTiaColorForCore(cNum, activeOtb.cores_per_tray);
                          return (
                            <span
                              key={cNum}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-400/50"
                                style={{ backgroundColor: tia.hex }}
                              />
                              Core #{cNum} ({tia.labelId})
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCores((prev) => prev.filter((x) => x !== cNum))
                                }
                                className="text-slate-400 hover:text-red-500 ml-0.5"
                                title="Hapus core"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-purple-800 dark:text-purple-300">
                        Klik adapter kosong di kanvas 3D atau kotak core berwarna hijau/tersedia di
                        bawah.
                      </p>
                    )}
                  </div>
                )}

                {/* Per-Tray Port Matrix */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 max-h-[260px] overflow-y-auto">
                  {groupedTrays.map((tray) => (
                    <div key={tray.trayNumber} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm border border-slate-400/40"
                            style={{ backgroundColor: tray.tubeColor.hex }}
                          />
                          Tray {tray.trayNumber} (Tube {tray.tubeColor.labelId})
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {tray.ports.filter((p) => p.status === "Available").length}/
                          {tray.ports.length} Free
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-1.5">
                        {tray.ports.map((port) => {
                          const tia = getTiaColorForCore(
                            port.core_number,
                            activeOtb.cores_per_tray
                          );
                          const isSelected = sortedSelected.includes(port.core_number);
                          const isAvail = port.status === "Available";
                          const isInspected = inspectedPort?.id === port.id;

                          return (
                            <button
                              key={port.id}
                              type="button"
                              onClick={() => handlePortClick(port)}
                              title={`Core #${port.core_number} (${tia.labelId}) — ${port.status}${
                                port.route_pair ? ` • ${port.route_pair}` : ""
                              }`}
                              className={`relative px-1.5 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all flex flex-col items-center justify-center ${
                                isSelected
                                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-800 dark:text-cyan-200 ring-2 ring-cyan-400"
                                  : port.status === "Used"
                                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                  : port.status === "Reserved"
                                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                                  : port.status === "Damaged" || port.status === "Maintenance"
                                  ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
                                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-purple-400"
                              } ${isInspected ? "ring-1 ring-purple-500" : ""}`}
                            >
                              <span
                                className="w-full h-1 rounded-full mb-1"
                                style={{ backgroundColor: tia.hex }}
                              />
                              <span>C{port.core_number}</span>
                              <span className="text-[8px] font-sans opacity-75">
                                {isSelected ? "PILIH" : isAvail ? "Free" : port.status.slice(0, 4)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Clicked Core Detail */}
                {inspectedPort && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Core #{inspectedPort.core_number} (Tray {inspectedPort.tray_number} ·{" "}
                        {getTiaColorForCore(inspectedPort.core_number, activeOtb.cores_per_tray).labelId})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                        {inspectedPort.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="text-slate-400">Rute Pair:</span>{" "}
                        <strong>{inspectedPort.route_pair || "-"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Redaman:</span>{" "}
                        <strong className="font-mono">
                          {inspectedPort.attenuation_db != null
                            ? `${inspectedPort.attenuation_db} dB`
                            : "-"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Customer:</span>{" "}
                        <strong>{inspectedPort.customer_name || "-"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Tiket:</span>{" "}
                        <strong className="font-mono">{inspectedPort.ticket_number || "-"}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {mode === "select" && activeOtb && sortedSelected.length > 0 ? (
              <span>
                Core dipilih:{" "}
                <strong className="text-slate-900 dark:text-slate-100 font-mono">
                  {formatOtbCoreLabel(activeOtb.code, sortedSelected)}
                </strong>
              </span>
            ) : mode === "select" ? (
              <span>Pilih minimal 1 core fiber optik yang berstatus Available.</span>
            ) : (
              <span>Mode inspeksi terminasi core OTB 3D aktif.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {mode === "select" ? "Batal" : "Tutup"}
            </button>
            {mode === "select" && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!activeOtb || sortedSelected.length === 0}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Gunakan {sortedSelected.length || targetCoreCount} Core Ini
              </button>
            )}
          </div>
        </div>
      </div>
    </NativeDialog>
  );
}
