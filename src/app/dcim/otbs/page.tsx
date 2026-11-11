"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Otb3DViewer } from "@/components/dcim/Otb3DViewer";
import { Otb3DPickerModal } from "@/components/dcim/Otb3DPickerModal";
import { NativeDialog } from "@/components/dcim/NativeDialog";
import {
  OpticalOtbItem,
  OtbCoreItem,
  getTiaColorForCore,
  getTiaTubeColorForTray,
} from "@/lib/dcimUtils";
import {
  Cable,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Edit3,
  Trash2,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  X,
  Activity,
  Sparkles,
} from "lucide-react";

export default function DatabaseOtb3DPage() {
  const [otbs, setOtbs] = useState<OpticalOtbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOtbId, setActiveOtbId] = useState<string>("");
  const [selectedCores, setSelectedCores] = useState<number[]>([]);
  const [activePort, setActivePort] = useState<OtbCoreItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fullscreen popup 3D
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  // Create / Edit OTB modal
  const [otbFormOpen, setOtbFormOpen] = useState(false);
  const [editingOtb, setEditingOtb] = useState<OpticalOtbItem | null>(null);
  const [otbForm, setOtbForm] = useState({
    code: "",
    name: "",
    location: "POP Menara Cyber 2 Lt. 12, Jakarta Selatan",
    pop_node: "POP-CYBER2",
    total_cores: 48,
    cores_per_tray: 12,
    connector_type: "SC/UPC",
    fiber_mode: "Single-Mode G.652D",
    status: "Active",
    notes: "",
  });
  const [savingOtb, setSavingOtb] = useState(false);

  // Update Port/Core modal
  const [portFormOpen, setPortFormOpen] = useState(false);
  const [portForm, setPortForm] = useState({
    status: "Used",
    route_pair: "",
    destination_otb: "",
    customer_name: "",
    attenuation_db: "",
    distance_km: "",
    notes: "",
  });
  const [savingPorts, setSavingPorts] = useState(false);

  // Delete OTB confirm modal
  const [deleteOtbTarget, setDeleteOtbTarget] = useState<OpticalOtbItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchOtbs = async (preserveOtbId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/dcim/otbs", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data OTB 3D.");
      }
      const list: OpticalOtbItem[] = json.data || [];
      setOtbs(list);
      if (list.length > 0) {
        const targetId = preserveOtbId || activeOtbId;
        const found = targetId ? list.find((o) => o.id === targetId) : null;
        setActiveOtbId(found ? found.id : list[0].id);
      } else {
        setActiveOtbId("");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal memuat OTB.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOtbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOtbs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otbs;
    return otbs.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q) ||
        (o.pop_node || "").toLowerCase().includes(q)
    );
  }, [otbs, search]);

  const activeOtb = useMemo(
    () => otbs.find((o) => o.id === activeOtbId) || otbs[0] || null,
    [otbs, activeOtbId]
  );

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

  const filteredPorts = useMemo(() => {
    if (!activeOtb) return [];
    return activeOtb.ports
      .filter((p) => (statusFilter === "ALL" ? true : p.status === statusFilter))
      .sort((a, b) => a.core_number - b.core_number);
  }, [activeOtb, statusFilter]);

  const globalKpis = useMemo(() => {
    let totalCores = 0;
    let available = 0;
    let used = 0;
    let reserved = 0;
    for (const o of otbs) {
      totalCores += o.total_cores;
      available += o.stats.available_cores;
      used += o.stats.used_cores;
      reserved += o.stats.reserved_cores;
    }
    const utilization =
      totalCores > 0 ? Math.round(((totalCores - available) / totalCores) * 100) : 0;
    return {
      totalOtbs: otbs.length,
      totalCores,
      available,
      activeAllocated: used + reserved,
      utilization,
    };
  }, [otbs]);

  const handleCoreToggle = (port: OtbCoreItem) => {
    setActivePort(port);
    setSelectedCores((prev) =>
      prev.includes(port.core_number)
        ? prev.filter((c) => c !== port.core_number)
        : [...prev, port.core_number].sort((a, b) => a - b)
    );
  };

  const openPortEditModal = (coresOverride?: number[]) => {
    if (!activeOtb) return;
    const targets = coresOverride && coresOverride.length > 0 ? coresOverride : selectedCores;
    if (targets.length === 0) return;

    const firstPort = activeOtb.ports.find((p) => p.core_number === targets[0]) || null;
    setSelectedCores(targets);
    setPortForm({
      status: firstPort?.status === "Available" ? "Used" : firstPort?.status || "Used",
      route_pair: firstPort?.route_pair || "",
      destination_otb: firstPort?.destination_otb || "",
      customer_name: firstPort?.customer_name || "",
      attenuation_db:
        firstPort?.attenuation_db !== null && firstPort?.attenuation_db !== undefined
          ? String(firstPort.attenuation_db)
          : "",
      distance_km:
        firstPort?.distance_km !== null && firstPort?.distance_km !== undefined
          ? String(firstPort.distance_km)
          : "",
      notes: firstPort?.notes || "",
    });
    setPortFormOpen(true);
  };

  const openCreateOtbModal = () => {
    setEditingOtb(null);
    setOtbForm({
      code: "",
      name: "",
      location: "POP Menara Cyber 2 Lt. 12, Jakarta Selatan",
      pop_node: "POP-CYBER2",
      total_cores: 48,
      cores_per_tray: 12,
      connector_type: "SC/UPC",
      fiber_mode: "Single-Mode G.652D",
      status: "Active",
      notes: "",
    });
    setOtbFormOpen(true);
  };

  const openEditOtbModal = (otb: OpticalOtbItem) => {
    setEditingOtb(otb);
    setOtbForm({
      code: otb.code,
      name: otb.name,
      location: otb.location,
      pop_node: otb.pop_node || "",
      total_cores: otb.total_cores,
      cores_per_tray: otb.cores_per_tray,
      connector_type: otb.connector_type,
      fiber_mode: otb.fiber_mode,
      status: otb.status,
      notes: otb.notes || "",
    });
    setOtbFormOpen(true);
  };

  const handleSaveOtb = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOtb(true);
    try {
      const url = editingOtb ? `/api/dcim/otbs/${editingOtb.id}` : "/api/dcim/otbs";
      const method = editingOtb ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otbForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal menyimpan data OTB.");
      setOtbFormOpen(false);
      await fetchOtbs(json.data?.id || editingOtb?.id);
      showToast(
        "success",
        json.message || (editingOtb ? "Data OTB diperbarui." : "OTB 3D baru berhasil ditambahkan.")
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan OTB.");
    } finally {
      setSavingOtb(false);
    }
  };

  const handleSavePorts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOtb || selectedCores.length === 0) return;
    setSavingPorts(true);
    try {
      const res = await fetch(`/api/dcim/otbs/${activeOtb.id}/ports`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core_numbers: selectedCores,
          status: portForm.status,
          route_pair: portForm.route_pair,
          destination_otb: portForm.destination_otb,
          customer_name: portForm.customer_name,
          attenuation_db: portForm.attenuation_db === "" ? null : Number(portForm.attenuation_db),
          distance_km: portForm.distance_km === "" ? null : Number(portForm.distance_km),
          notes: portForm.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal memperbarui core OTB.");
      setPortFormOpen(false);
      await fetchOtbs(activeOtb.id);
      showToast(
        "success",
        json.message || `${selectedCores.length} core pada ${activeOtb.code} berhasil diperbarui.`
      );
      setSelectedCores([]);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal update core.");
    } finally {
      setSavingPorts(false);
    }
  };

  const handleConfirmDeleteOtb = async () => {
    if (!deleteOtbTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dcim/otbs/${deleteOtbTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal menghapus OTB.");
      showToast("success", `OTB ${deleteOtbTarget.code} berhasil dihapus.`);
      setDeleteOtbTarget(null);
      setSelectedCores([]);
      setActivePort(null);
      await fetchOtbs();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus OTB.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                <Cable className="w-5 h-5" />
              </span>
              Database OTB 3D & Terminasi Core
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
              TIA-598 Fiber 3D
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manajemen Optical Termination Box 3D interaktif per tray & kode warna TIA-598 untuk
            aktivasi layanan Dark Fiber.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchOtbs(activeOtb?.id)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {activeOtb && (
            <button
              type="button"
              onClick={() => setIsInspectModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/50 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 flex items-center gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Popup OTB 3D
            </button>
          )}
          <button
            type="button"
            onClick={openCreateOtbModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah OTB 3D
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button type="button" onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total Panel OTB
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {globalKpis.totalOtbs}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Total {globalKpis.totalCores} Core Terminasi
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Core Tersedia (Free)
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {globalKpis.available}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Siap untuk aktivasi Dark Fiber</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Core Aktif & Reserved
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {globalKpis.activeAllocated}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Used + Reserved ticket</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Utilisasi Core Optik
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {globalKpis.utilization}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rata-rata seluruh POP</div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left OTB Selector */}
        <div className="xl:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode OTB, POP node, atau lokasi..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {loading && otbs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-400">
                Memuat daftar OTB 3D...
              </div>
            ) : filteredOtbs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                Tidak ada OTB ditemukan.
              </div>
            ) : (
              filteredOtbs.map((otb) => {
                const isActive = activeOtb?.id === otb.id;
                return (
                  <button
                    key={otb.id}
                    type="button"
                    onClick={() => {
                      setActiveOtbId(otb.id);
                      setSelectedCores([]);
                      setActivePort(null);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isActive
                        ? "border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                          {otb.code} · {otb.connector_type}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {otb.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                        {otb.stats.available_cores} Free
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{otb.location}</span>
                    </p>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>
                          Used {otb.stats.used_cores} · Reserved {otb.stats.reserved_cores} /{" "}
                          {otb.total_cores} Core
                        </span>
                        <span>{otb.stats.utilization_pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                        <div
                          className="bg-blue-500 h-full"
                          style={{
                            width: `${(otb.stats.used_cores / otb.total_cores) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-amber-400 h-full"
                          style={{
                            width: `${(otb.stats.reserved_cores / otb.total_cores) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-red-500 h-full"
                          style={{
                            width: `${(otb.stats.damaged_cores / otb.total_cores) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right 3D OTB Viewport & Core Matrix */}
        <div className="xl:col-span-8 space-y-5">
          {!activeOtb ? (
            <div className="h-[520px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
              <Cable className="w-10 h-10 mb-2" />
              <p className="text-sm font-semibold">Pilih atau tambah OTB 3D terlebih dahulu.</p>
            </div>
          ) : (
            <>
              {/* Active OTB Header */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-xs font-mono font-bold">
                      {activeOtb.code}
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {activeOtb.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeOtb.location}
                    {activeOtb.pop_node ? ` · ${activeOtb.pop_node}` : ""} ·{" "}
                    {activeOtb.total_cores} Core ({activeOtb.cores_per_tray} Core/Tray) ·{" "}
                    {activeOtb.connector_type} · {activeOtb.fiber_mode}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditOtbModal(activeOtb)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit OTB
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOtbTarget(activeOtb)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>

              {/* 3D OTB Viewer */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Klik satu atau beberapa port adapter di model 3D / matriks untuk{" "}
                    <strong>splicing & alokasi core</strong>.
                  </span>
                  {selectedCores.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        Dipilih: {selectedCores.map((c) => `#${c}`).join(", ")}
                      </span>
                      <button
                        type="button"
                        onClick={() => openPortEditModal()}
                        className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Update {selectedCores.length} Core
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCores([])}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                <Otb3DViewer
                  otb={activeOtb}
                  mode="select"
                  selectedCores={selectedCores}
                  activeCoreNumber={activePort?.core_number || null}
                  onClickCore={handleCoreToggle}
                  heightClass="h-[480px]"
                />
              </div>

              {/* Tray Matrix */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-purple-600" />
                    Matriks Kaset & Kode Warna TIA-598 ({activeOtb.total_cores} Core)
                  </h3>
                  {selectedCores.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openPortEditModal()}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                    >
                      Alokasi / Edit Core ({selectedCores.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedTrays.map((tray) => (
                    <div
                      key={tray.trayNumber}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm border border-slate-400/40"
                            style={{ backgroundColor: tray.tubeColor.hex }}
                          />
                          Tray {tray.trayNumber} · Tube {tray.tubeColor.labelId}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {tray.ports.filter((p) => p.status === "Available").length}/
                          {tray.ports.length} Available
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-1.5">
                        {tray.ports.map((port) => {
                          const tia = getTiaColorForCore(
                            port.core_number,
                            activeOtb.cores_per_tray
                          );
                          const isSelected = selectedCores.includes(port.core_number);
                          return (
                            <button
                              key={port.id}
                              type="button"
                              onClick={() => handleCoreToggle(port)}
                              title={`Core #${port.core_number} (${tia.labelId}) - ${port.status}`}
                              className={`p-1.5 rounded-lg border text-[10px] font-mono font-bold flex flex-col items-center transition-all ${
                                isSelected
                                  ? "bg-cyan-500/20 border-cyan-500 ring-2 ring-cyan-400 text-cyan-800 dark:text-cyan-200"
                                  : port.status === "Used"
                                  ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                  : port.status === "Reserved"
                                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                                  : port.status === "Damaged" || port.status === "Maintenance"
                                  ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-600"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-purple-400"
                              }`}
                            >
                              <span
                                className="w-full h-1 rounded-full mb-1"
                                style={{ backgroundColor: tia.hex }}
                              />
                              <span>C{port.core_number}</span>
                              <span className="text-[8px] font-sans opacity-75">
                                {port.status === "Available" ? "Free" : port.status.slice(0, 4)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Port Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Detail Alokasi Core ({filteredPorts.length})
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {["ALL", "Available", "Used", "Reserved", "Damaged"].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                          statusFilter === st
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {st === "ALL" ? "Semua" : st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] uppercase text-slate-500 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">Core</th>
                        <th className="px-4 py-2.5 font-bold">Warna TIA-598</th>
                        <th className="px-4 py-2.5 font-bold">Rute / Tujuan</th>
                        <th className="px-4 py-2.5 font-bold">Customer / Tiket</th>
                        <th className="px-4 py-2.5 font-bold">Redaman</th>
                        <th className="px-4 py-2.5 font-bold">Status</th>
                        <th className="px-4 py-2.5 font-bold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPorts.map((port) => {
                        const tia = getTiaColorForCore(port.core_number, activeOtb.cores_per_tray);
                        return (
                          <tr
                            key={port.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-mono font-bold text-purple-600 dark:text-purple-400">
                              #{port.core_number} (T{port.tray_number})
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 font-semibold">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-400/40"
                                  style={{ backgroundColor: tia.hex }}
                                />
                                {tia.labelId}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {port.route_pair || "-"}
                              </div>
                              {port.destination_otb && (
                                <div className="text-[11px] text-slate-400 font-mono">
                                  → {port.destination_otb}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold">{port.customer_name || "-"}</div>
                              {port.ticket_number && (
                                <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                                  {port.ticket_number}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono">
                              {port.attenuation_db != null ? `${port.attenuation_db} dB` : "-"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  port.status === "Available"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : port.status === "Reserved"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : port.status === "Used"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {port.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => openPortEditModal([port.core_number])}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/40"
                              >
                                Edit Core
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Tambah / Edit OTB */}
      <NativeDialog
        isOpen={otbFormOpen}
        onClose={() => setOtbFormOpen(false)}
        ariaLabelledBy="otb-form-title"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveOtb} className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 id="otb-form-title" className="text-base font-extrabold">
              {editingOtb ? `Edit OTB ${editingOtb.code}` : "Tambah Panel OTB 3D Baru"}
            </h2>
            <button
              type="button"
              onClick={() => setOtbFormOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Kode OTB *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingOtb)}
                value={otbForm.code}
                onChange={(e) => setOtbForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="OTB-CYB2-03"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold uppercase disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Kapasitas Core *</label>
              <select
                disabled={Boolean(editingOtb)}
                value={otbForm.total_cores}
                onChange={(e) => setOtbForm((p) => ({ ...p, total_cores: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold disabled:opacity-60"
              >
                {[12, 24, 48, 72, 96, 144].map((c) => (
                  <option key={c} value={c}>
                    {c} Core ({c / 12} Tray × 12C)
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Nama Panel OTB *</label>
              <input
                type="text"
                required
                value={otbForm.name}
                onChange={(e) => setOtbForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="OTB Backbone Cyber 2 -> Sudirman"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Lokasi POP / Site *</label>
              <input
                type="text"
                required
                value={otbForm.location}
                onChange={(e) => setOtbForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">POP Node</label>
              <input
                type="text"
                value={otbForm.pop_node}
                onChange={(e) => setOtbForm((p) => ({ ...p, pop_node: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Tipe Konektor</label>
              <select
                value={otbForm.connector_type}
                onChange={(e) => setOtbForm((p) => ({ ...p, connector_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="SC/UPC">SC/UPC (Biru)</option>
                <option value="SC/APC">SC/APC (Hijau)</option>
                <option value="LC/UPC">LC/UPC</option>
                <option value="FC/UPC">FC/UPC</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Mode Fiber</label>
              <select
                value={otbForm.fiber_mode}
                onChange={(e) => setOtbForm((p) => ({ ...p, fiber_mode: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="Single-Mode G.652D">Single-Mode G.652D</option>
                <option value="Single-Mode G.655">Single-Mode G.655</option>
                <option value="Multi-Mode OM3/OM4">Multi-Mode OM3/OM4</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={otbForm.status}
                onChange={(e) => setOtbForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOtbFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingOtb}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {savingOtb ? "Menyimpan..." : editingOtb ? "Simpan Perubahan" : "Buat OTB 3D"}
            </button>
          </div>
        </form>
      </NativeDialog>

      {/* Modal Update Core Port */}
      <NativeDialog
        isOpen={portFormOpen}
        onClose={() => setPortFormOpen(false)}
        ariaLabelledBy="port-form-title"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSavePorts} className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 id="port-form-title" className="text-base font-extrabold">
              Update Terminasi Core {selectedCores.map((c) => `#${c}`).join(", ")}
            </h2>
            <button
              type="button"
              onClick={() => setPortFormOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Status Core *</label>
              <select
                value={portForm.status}
                onChange={(e) => setPortForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              >
                <option value="Available">Available (Kosongkan / Lepas Relasi)</option>
                <option value="Reserved">Reserved (Booking Aktivasi)</option>
                <option value="Used">Used (Aktif Spliced)</option>
                <option value="Damaged">Damaged (Putus / Loss Tinggi)</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Rute / Jalur Dark Fiber</label>
              <input
                type="text"
                disabled={portForm.status === "Available"}
                value={portForm.route_pair}
                onChange={(e) => setPortForm((p) => ({ ...p, route_pair: e.target.value }))}
                placeholder="POP Cyber 2 -> POP Tifa Core 1-2"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">OTB Tujuan</label>
              <input
                type="text"
                disabled={portForm.status === "Available"}
                value={portForm.destination_otb}
                onChange={(e) => setPortForm((p) => ({ ...p, destination_otb: e.target.value }))}
                placeholder="OTB-TIFA-01"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Customer</label>
              <input
                type="text"
                disabled={portForm.status === "Available"}
                value={portForm.customer_name}
                onChange={(e) => setPortForm((p) => ({ ...p, customer_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Redaman OTDR (dB)</label>
              <input
                type="number"
                step="0.01"
                value={portForm.attenuation_db}
                onChange={(e) => setPortForm((p) => ({ ...p, attenuation_db: e.target.value }))}
                placeholder="-14.2"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Jarak Optik (Km)</label>
              <input
                type="number"
                step="0.01"
                value={portForm.distance_km}
                onChange={(e) => setPortForm((p) => ({ ...p, distance_km: e.target.value }))}
                placeholder="3.8"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPortFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingPorts}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {savingPorts ? "Menyimpan..." : "Simpan Status Core"}
            </button>
          </div>
        </form>
      </NativeDialog>

      {/* Confirm Delete OTB */}
      <NativeDialog
        isOpen={Boolean(deleteOtbTarget)}
        onClose={() => setDeleteOtbTarget(null)}
        ariaLabelledBy="otb-delete-confirm-title"
        maxWidthClass="max-w-md"
      >
        <div className="p-5 space-y-4">
          <h2 id="otb-delete-confirm-title" className="text-base font-extrabold text-red-600">
            Hapus Panel OTB 3D?
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Panel {deleteOtbTarget?.code} ({deleteOtbTarget?.name}) beserta seluruh catatan{" "}
            {deleteOtbTarget?.total_cores} core akan dihapus permanen.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOtbTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDeleteOtb}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {deleting ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </div>
        </div>
      </NativeDialog>

      {/* Fullscreen 3D Inspect Modal */}
      <Otb3DPickerModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        mode="inspect"
        initialOtbId={activeOtb?.id || null}
        initialSelectedCores={selectedCores}
        preloadedOtbs={otbs}
      />
    </div>
  );
}

