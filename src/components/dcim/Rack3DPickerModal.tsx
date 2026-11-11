"use client";

import React, { useEffect, useMemo, useState } from "react";
import { NativeDialog } from "./NativeDialog";
import { Rack3DViewer } from "./Rack3DViewer";
import {
  DataCenterRackItem,
  RackSlotItem,
  findAvailableStartUs,
  formatRackPositionLabel,
  isRackRangeFree,
} from "@/lib/dcimUtils";
import {
  Server,
  X,
  CheckCircle2,
  MapPin,
  Zap,
  Layers,
  RefreshCw,
  AlertCircle,
  Cpu,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export interface RackSelectionResult {
  rack: DataCenterRackItem;
  startU: number;
  endU: number;
  unitSize: number;
}

interface Rack3DPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "select" | "inspect";
  requiredUnits?: number;
  initialRackId?: string | null;
  initialStartU?: number | null;
  initialEndU?: number | null;
  highlightedSlotId?: string | null;
  preloadedRacks?: DataCenterRackItem[];
  onConfirmSelection?: (selection: RackSelectionResult) => void;
}

export function Rack3DPickerModal({
  isOpen,
  onClose,
  mode = "select",
  requiredUnits = 1,
  initialRackId = null,
  initialStartU = null,
  initialEndU = null,
  highlightedSlotId = null,
  preloadedRacks,
  onConfirmSelection,
}: Rack3DPickerModalProps) {
  const [racks, setRacks] = useState<DataCenterRackItem[]>(preloadedRacks || []);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeRackId, setActiveRackId] = useState<string>(initialRackId || "");
  const [unitSize, setUnitSize] = useState<number>(Math.max(1, requiredUnits));
  const [selectedStartU, setSelectedStartU] = useState<number | null>(initialStartU);
  const [inspectedSlot, setInspectedSlot] = useState<RackSlotItem | null>(null);

  const fetchRacks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dcim/racks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat daftar Rack 3D.");
      }
      const list: DataCenterRackItem[] = json.data || [];
      setRacks(list);
      if (list.length > 0) {
        const preferred =
          (initialRackId && list.find((r) => r.id === initialRackId)) || list[0];
        setActiveRackId((prev) => {
          if (prev && list.some((r) => r.id === prev)) return prev;
          return preferred.id;
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan memuat rack.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setUnitSize(Math.max(1, requiredUnits));
    setSelectedStartU(initialStartU ?? null);
    setInspectedSlot(null);
    if (initialRackId) {
      setActiveRackId(initialRackId);
    }
    if (preloadedRacks && preloadedRacks.length > 0) {
      setRacks(preloadedRacks);
      const preferred =
        (initialRackId && preloadedRacks.find((r) => r.id === initialRackId)) ||
        preloadedRacks[0];
      setActiveRackId(preferred.id);
    } else {
      fetchRacks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialRackId, initialStartU, requiredUnits]);

  const activeRack = useMemo(
    () => racks.find((r) => r.id === activeRackId) || racks[0] || null,
    [racks, activeRackId]
  );

  // Temukan slot yang sedang disorot jika mode inspect
  useEffect(() => {
    if (!activeRack) return;
    if (highlightedSlotId) {
      const found = activeRack.slots.find((s) => s.id === highlightedSlotId) || null;
      if (found) setInspectedSlot(found);
    } else if (initialStartU) {
      const found =
        activeRack.slots.find(
          (s) => initialStartU >= s.start_u && initialStartU <= s.end_u
        ) || null;
      if (found) setInspectedSlot(found);
    }
  }, [activeRack, highlightedSlotId, initialStartU]);

  const availableStartUs = useMemo(() => {
    if (!activeRack || mode !== "select") return [];
    const safeUnit = Math.min(Math.max(1, unitSize), activeRack.total_u);
    return findAvailableStartUs(activeRack.total_u, activeRack.slots, safeUnit);
  }, [activeRack, mode, unitSize]);

  // Validasi apakah pilihan U sekarang valid di rack yang aktif
  const selectionCheck = useMemo(() => {
    if (!activeRack || !selectedStartU) {
      return { valid: false, endU: 0, reason: "Pilih posisi U yang kosong pada Rack 3D." };
    }
    return isRackRangeFree(activeRack.total_u, activeRack.slots, selectedStartU, unitSize);
  }, [activeRack, selectedStartU, unitSize]);

  const handleRackChange = (newRackId: string) => {
    setActiveRackId(newRackId);
    setSelectedStartU(null);
    setInspectedSlot(null);
  };

  const handleAutoPick = () => {
    if (availableStartUs.length > 0) {
      // Pilih dari posisi bawah ke atas agar distribusi beban rack stabil
      setSelectedStartU(availableStartUs[0]);
      setInspectedSlot(null);
    }
  };

  const handleConfirm = () => {
    if (!activeRack || !selectedStartU || !selectionCheck.valid) return;
    onConfirmSelection?.({
      rack: activeRack,
      startU: selectedStartU,
      endU: selectionCheck.endU,
      unitSize,
    });
    onClose();
  };

  return (
    <NativeDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="rack-3d-modal-title"
      maxWidthClass="max-w-7xl"
    >
      <div className="flex flex-col max-h-[92vh] bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="rack-3d-modal-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate"
                >
                  {mode === "select"
                    ? "Pilih Posisi Server pada Rack 3D (Collocation)"
                    : "Inspeksi Penempatan Perangkat — Rack 3D"}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Interactive WebGL 3D
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "select"
                  ? "Putar rack 360°, arahkan kursor ke slot kosong, lalu klik pada rak 3D atau daftar U di kanan."
                  : "Klik perangkat terpasang di model 3D untuk melihat detail SN, pelanggan, daya listrik, dan tiket."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dcim/racks"
              onClick={onClose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Kelola Database Rack
            </Link>
            <button
              type="button"
              onClick={fetchRacks}
              disabled={loading}
              title="Muat ulang data Rack"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup popup Rack 3D"
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

          {loading && racks.length === 0 ? (
            <div className="h-[480px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
              <p className="text-sm font-semibold">Memuat infrastruktur Rack 3D...</p>
            </div>
          ) : !activeRack ? (
            <div className="h-[420px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center p-6">
              <Server className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Belum ada Data Rack 3D tersedia.
              </p>
              <Link
                href="/dcim/racks"
                onClick={onClose}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                Buka Halaman Database Rack 3D
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 3D Viewport */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-3">
                {/* Rack Switcher Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex-1 min-w-[230px]">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Cabinet / Rack Datacenter
                    </label>
                    <select
                      value={activeRack.id}
                      onChange={(e) => handleRackChange(e.target.value)}
                      disabled={mode === "inspect" && Boolean(initialRackId)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {racks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.name} ({r.stats.free_u}U Kosong / {r.total_u}U)
                        </option>
                      ))}
                    </select>
                  </div>

                  {mode === "select" && (
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Tinggi (Unit U)
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 4, 10, 21, 42]
                            .filter((u) => u <= activeRack.total_u)
                            .map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setUnitSize(preset);
                                  setSelectedStartU(null);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                  unitSize === preset
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                {preset}U
                              </button>
                            ))}
                          <input
                            type="number"
                            min={1}
                            max={activeRack.total_u}
                            value={unitSize}
                            onChange={(e) => {
                              const v = Math.max(
                                1,
                                Math.min(activeRack.total_u, Number(e.target.value) || 1)
                              );
                              setUnitSize(v);
                              setSelectedStartU(null);
                            }}
                            className="w-14 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-center"
                            title="Ukuran custom (U)"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3D Canvas */}
                <Rack3DViewer
                  rack={activeRack}
                  mode={mode === "select" ? "select" : "view"}
                  requiredUnits={unitSize}
                  selectedStartU={selectedStartU}
                  highlightedSlotId={highlightedSlotId}
                  selectedSlotId={inspectedSlot?.id || null}
                  onSelectEmptyRange={(startU) => {
                    setSelectedStartU(startU);
                    setInspectedSlot(null);
                  }}
                  onSelectSlot={(slot) => {
                    setInspectedSlot(slot);
                  }}
                  heightClass="h-[460px] sm:h-[520px]"
                />
              </div>

              {/* Right Control / Inspector Panel */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                {/* Rack Info & Utilization */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                        {activeRack.code}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {activeRack.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>
                          {activeRack.location}
                          {activeRack.room_zone ? ` (${activeRack.room_zone})` : ""}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        activeRack.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {activeRack.status}
                    </span>
                  </div>

                  {/* Utilization Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                      <span className="text-slate-600 dark:text-slate-300">
                        Okupansi Ruang ({activeRack.stats.utilization_pct}%)
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {activeRack.stats.free_u}U Kosong / {activeRack.total_u}U
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                      <div
                        className="bg-blue-500 h-full"
                        style={{
                          width: `${(activeRack.stats.occupied_u / activeRack.total_u) * 100}%`,
                        }}
                        title={`Occupied: ${activeRack.stats.occupied_u}U`}
                      />
                      <div
                        className="bg-amber-400 h-full"
                        style={{
                          width: `${(activeRack.stats.reserved_u / activeRack.total_u) * 100}%`,
                        }}
                        title={`Reserved: ${activeRack.stats.reserved_u}U`}
                      />
                      <div
                        className="bg-red-500 h-full"
                        style={{
                          width: `${(activeRack.stats.maintenance_u / activeRack.total_u) * 100}%`,
                        }}
                        title={`Maintenance: ${activeRack.stats.maintenance_u}U`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold">Terisi</div>
                      <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        {activeRack.stats.occupied_u}U
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold">Reserved</div>
                      <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                        {activeRack.stats.reserved_u}U
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> Beban
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                        {activeRack.stats.total_power_watt}W
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mode Select: Picker U */}
                {mode === "select" && (
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/60 dark:bg-blue-950/30 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        Pilih Posisi Start U ({unitSize}U)
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoPick}
                        disabled={availableStartUs.length === 0}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-bold transition-colors"
                      >
                        Auto-Pilih Bawah
                      </button>
                    </div>

                    {selectedStartU && selectionCheck.valid ? (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-2 text-xs font-extrabold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Dipilih:{" "}
                            {formatRackPositionLabel(
                              activeRack.code,
                              selectedStartU,
                              selectionCheck.endU
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                          Posisi bebas konflik dan siap direservasi untuk tiket aktivasi.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-blue-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                        {selectionCheck.reason}
                      </div>
                    )}

                    {/* Available U Grid */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                        Daftar Start U Tersedia ({availableStartUs.length} opsi untuk {unitSize}U):
                      </div>
                      {availableStartUs.length === 0 ? (
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold py-2">
                          Tidak ada rentang {unitSize}U berurutan yang kosong di rack ini. Pilih
                          rack lain atau kurangi tinggi U.
                        </p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto grid grid-cols-4 gap-1.5 pr-1">
                          {availableStartUs.map((u) => {
                            const isSelected = selectedStartU === u;
                            const endU = u + unitSize - 1;
                            return (
                              <button
                                key={u}
                                type="button"
                                onClick={() => {
                                  setSelectedStartU(u);
                                  setInspectedSlot(null);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                                  isSelected
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-400/50"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                                }`}
                              >
                                {unitSize === 1 ? `U${u}` : `U${u}-${endU}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Clicked Device Inspector / Occupied Units List */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      {inspectedSlot ? "Detail Perangkat Dipilih" : `Perangkat Terpasang (${activeRack.slots.length})`}
                    </h4>
                    {inspectedSlot && (
                      <button
                        type="button"
                        onClick={() => setInspectedSlot(null)}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Lihat Semua
                      </button>
                    )}
                  </div>

                  {inspectedSlot ? (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          U{inspectedSlot.start_u}
                          {inspectedSlot.end_u > inspectedSlot.start_u
                            ? `–U${inspectedSlot.end_u}`
                            : ""}{" "}
                          ({inspectedSlot.unit_size}U)
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inspectedSlot.status === "Reserved"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                              : inspectedSlot.status === "Maintenance"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          }`}
                        >
                          {inspectedSlot.status}
                        </span>
                      </div>
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">
                        {inspectedSlot.device_name}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="text-slate-400">Customer:</span>{" "}
                          <strong>{inspectedSlot.customer_name || "-"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Tipe:</span>{" "}
                          <strong>{inspectedSlot.device_type}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">S/N:</span>{" "}
                          <span className="font-mono">{inspectedSlot.serial_number || "-"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Daya:</span>{" "}
                          <strong>{inspectedSlot.power_draw_watt || 0}W</strong>
                        </div>
                        {inspectedSlot.ticket_number && (
                          <div className="col-span-2">
                            <span className="text-slate-400">Tiket:</span>{" "}
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {inspectedSlot.ticket_number}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {activeRack.slots.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">
                          Rack ini masih sepenuhnya kosong.
                        </p>
                      ) : (
                        activeRack.slots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setInspectedSlot(slot)}
                            className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/50 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                U{slot.start_u}
                                {slot.end_u > slot.start_u ? `–U${slot.end_u}` : ""} ({slot.unit_size}
                                U)
                              </div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {slot.device_name}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                slot.status === "Reserved"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {slot.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {mode === "select" && activeRack && selectedStartU && selectionCheck.valid ? (
              <span>
                Posisi siap disimpan:{" "}
                <strong className="text-slate-900 dark:text-slate-100 font-mono">
                  {formatRackPositionLabel(activeRack.code, selectedStartU, selectionCheck.endU)}
                </strong>
              </span>
            ) : mode === "select" ? (
              <span>Silakan klik slot hijau pada model Rack 3D atau pilih Start U di sebelah kanan.</span>
            ) : (
              <span>Mode inspeksi posisi Rack 3D aktif.</span>
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
                disabled={!activeRack || !selectedStartU || !selectionCheck.valid}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Gunakan Posisi Rack Ini
              </button>
            )}
          </div>
        </div>
      </div>
    </NativeDialog>
  );
}
