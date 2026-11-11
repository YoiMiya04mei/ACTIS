"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Rack3DViewer } from "@/components/dcim/Rack3DViewer";
import { Rack3DPickerModal } from "@/components/dcim/Rack3DPickerModal";
import { NativeDialog } from "@/components/dcim/NativeDialog";
import {
  DataCenterRackItem,
  RackSlotItem,
  RACK_DEVICE_COLORS,
  findAvailableStartUs,
  formatRackPositionLabel,
} from "@/lib/dcimUtils";
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Zap,
  Layers,
  Edit3,
  Trash2,
  Cpu,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

const DEVICE_TYPES = [
  "Server",
  "Switch",
  "Router",
  "Firewall",
  "Storage / NAS",
  "OTB / Patch Panel",
  "PDU / UPS",
  "Other",
];

export default function DatabaseRack3DPage() {
  const [racks, setRacks] = useState<DataCenterRackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeRackId, setActiveRackId] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<RackSlotItem | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fullscreen popup 3D
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  // Create / Edit Rack modal
  const [rackFormOpen, setRackFormOpen] = useState(false);
  const [editingRack, setEditingRack] = useState<DataCenterRackItem | null>(null);
  const [rackForm, setRackForm] = useState({
    code: "",
    name: "",
    location: "Gedung Cyber 1 Lt. 3, Jakarta Selatan",
    room_zone: "Suite A - Cold Aisle",
    total_u: 42,
    power_capacity_va: 5000,
    status: "Active",
    notes: "",
  });
  const [savingRack, setSavingRack] = useState(false);

  // Add / Edit Slot modal
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<RackSlotItem | null>(null);
  const [slotForm, setSlotForm] = useState({
    start_u: 1,
    unit_size: 2,
    device_name: "",
    serial_number: "",
    customer_name: "",
    pic_name: "",
    device_type: "Server",
    power_draw_watt: 600,
    color_tag: "#3b82f6",
    status: "Occupied",
    notes: "",
  });
  const [savingSlot, setSavingSlot] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "rack"; rack: DataCenterRackItem }
    | { kind: "slot"; rackId: string; rackCode: string; slot: RackSlotItem }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchRacks = async (preserveRackId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/dcim/racks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data Rack 3D.");
      }
      const list: DataCenterRackItem[] = json.data || [];
      setRacks(list);
      if (list.length > 0) {
        const targetId = preserveRackId || activeRackId;
        const found = targetId ? list.find((r) => r.id === targetId) : null;
        setActiveRackId(found ? found.id : list[0].id);
      } else {
        setActiveRackId("");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal memuat rack.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRacks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return racks;
    return racks.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (r.room_zone || "").toLowerCase().includes(q)
    );
  }, [racks, search]);

  const activeRack = useMemo(
    () => racks.find((r) => r.id === activeRackId) || racks[0] || null,
    [racks, activeRackId]
  );

  // Sync selectedSlot with refreshed rack data
  useEffect(() => {
    if (!activeRack || !selectedSlot) return;
    const updated = activeRack.slots.find((s) => s.id === selectedSlot.id) || null;
    setSelectedSlot(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRack]);

  const globalKpis = useMemo(() => {
    let totalU = 0;
    let freeU = 0;
    let totalDevices = 0;
    let totalPower = 0;
    for (const r of racks) {
      totalU += r.total_u;
      freeU += r.stats.free_u;
      totalDevices += r.slots.length;
      totalPower += r.stats.total_power_watt;
    }
    return {
      totalRacks: racks.length,
      totalU,
      freeU,
      usedU: totalU - freeU,
      totalDevices,
      totalPower,
    };
  }, [racks]);

  const availableSlotStarts = useMemo(() => {
    if (!activeRack) return [];
    const filteredSlots = editingSlot
      ? activeRack.slots.filter((s) => s.id !== editingSlot.id)
      : activeRack.slots;
    return findAvailableStartUs(activeRack.total_u, filteredSlots, slotForm.unit_size);
  }, [activeRack, editingSlot, slotForm.unit_size]);

  const openCreateRackModal = () => {
    setEditingRack(null);
    setRackForm({
      code: "",
      name: "",
      location: "Gedung Cyber 1 Lt. 3, Jakarta Selatan",
      room_zone: "Suite A - Cold Aisle",
      total_u: 42,
      power_capacity_va: 5000,
      status: "Active",
      notes: "",
    });
    setRackFormOpen(true);
  };

  const openEditRackModal = (rack: DataCenterRackItem) => {
    setEditingRack(rack);
    setRackForm({
      code: rack.code,
      name: rack.name,
      location: rack.location,
      room_zone: rack.room_zone || "",
      total_u: rack.total_u,
      power_capacity_va: rack.power_capacity_va || 5000,
      status: rack.status,
      notes: rack.notes || "",
    });
    setRackFormOpen(true);
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRack(true);
    try {
      const url = editingRack ? `/api/dcim/racks/${editingRack.id}` : "/api/dcim/racks";
      const method = editingRack ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rackForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan data Rack.");
      }
      setRackFormOpen(false);
      await fetchRacks(json.data?.id || editingRack?.id);
      showToast(
        "success",
        json.message || (editingRack ? "Data Rack diperbarui." : "Rack 3D baru berhasil ditambahkan.")
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan rack.");
    } finally {
      setSavingRack(false);
    }
  };

  const openAddSlotModal = (presetStartU?: number, presetEndU?: number) => {
    if (!activeRack) return;
    const size = presetStartU && presetEndU ? Math.max(1, presetEndU - presetStartU + 1) : 2;
    const freeList = findAvailableStartUs(activeRack.total_u, activeRack.slots, size);
    const startU = presetStartU || freeList[0] || 1;
    setEditingSlot(null);
    setSlotForm({
      start_u: startU,
      unit_size: size,
      device_name: "",
      serial_number: "",
      customer_name: "",
      pic_name: "",
      device_type: "Server",
      power_draw_watt: size * 350,
      color_tag: "#3b82f6",
      status: "Occupied",
      notes: "",
    });
    setSlotFormOpen(true);
  };

  const openEditSlotModal = (slot: RackSlotItem) => {
    setEditingSlot(slot);
    setSlotForm({
      start_u: slot.start_u,
      unit_size: slot.unit_size,
      device_name: slot.device_name,
      serial_number: slot.serial_number || "",
      customer_name: slot.customer_name || "",
      pic_name: slot.pic_name || "",
      device_type: slot.device_type || "Server",
      power_draw_watt: slot.power_draw_watt ?? slot.unit_size * 300,
      color_tag: slot.color_tag || "#3b82f6",
      status: slot.status || "Occupied",
      notes: slot.notes || "",
    });
    setSlotFormOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRack) return;
    setSavingSlot(true);
    try {
      const url = editingSlot
        ? `/api/dcim/racks/${activeRack.id}/slots/${editingSlot.id}`
        : `/api/dcim/racks/${activeRack.id}/slots`;
      const method = editingSlot ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slotForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan posisi unit rack.");
      }
      setSlotFormOpen(false);
      await fetchRacks(activeRack.id);
      showToast(
        "success",
        json.message ||
          (editingSlot ? "Unit rack berhasil diperbarui." : "Unit berhasil dipasang ke Rack 3D.")
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan unit.");
    } finally {
      setSavingSlot(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "rack") {
        const res = await fetch(`/api/dcim/racks/${deleteTarget.rack.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Gagal menghapus rack.");
        showToast("success", `Rack ${deleteTarget.rack.code} berhasil dihapus.`);
        setDeleteTarget(null);
        await fetchRacks();
      } else {
        const res = await fetch(
          `/api/dcim/racks/${deleteTarget.rackId}/slots/${deleteTarget.slot.id}`,
          { method: "DELETE" }
        );
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Gagal melepas unit.");
        showToast("success", `Unit ${deleteTarget.slot.device_name} dilepas dari rack.`);
        setSelectedSlot(null);
        setDeleteTarget(null);
        await fetchRacks(deleteTarget.rackId);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus.");
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
              <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Server className="w-5 h-5" />
              </span>
              Database Rack 3D (Collocation DCIM)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              WebGL Interactive
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visualisasi cabinet server 3D real-time untuk perencanaan posisi U, daya listrik, dan
            aktivasi Collocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchRacks(activeRack?.id)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {activeRack && (
            <>
              <button
                type="button"
                onClick={() => setIsInspectModalOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Popup Rack 3D
              </button>
              <button
                type="button"
                onClick={() => openAddSlotModal()}
                className="px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Cpu className="w-3.5 h-3.5" /> Pasang Unit (U)
              </button>
            </>
          )}
          <button
            type="button"
            onClick={openCreateRackModal}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Rack 3D
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
            Total Cabinet Rack
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {globalKpis.totalRacks}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Kapasitas {globalKpis.totalU}U</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ruang U Kosong
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {globalKpis.freeU}U
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {globalKpis.usedU}U sedang terpakai / reserved
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Perangkat Terpasang
          </div>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {globalKpis.totalDevices}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Server, Switch, Router, OTB</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Total Beban Daya
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {globalKpis.totalPower.toLocaleString("id-ID")} W
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Estimasi beban aktif DC</div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Rack Selector List */}
        <div className="xl:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode rack, nama, atau lokasi DC..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {loading && racks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-400">
                Memuat daftar Rack 3D...
              </div>
            ) : filteredRacks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                Tidak ada Rack ditemukan.
              </div>
            ) : (
              filteredRacks.map((rack) => {
                const isActive = activeRack?.id === rack.id;
                return (
                  <button
                    key={rack.id}
                    type="button"
                    onClick={() => {
                      setActiveRackId(rack.id);
                      setSelectedSlot(null);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isActive
                        ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {rack.code}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {rack.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                        {rack.stats.free_u}U Free
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{rack.location}</span>
                    </p>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>
                          Terisi {rack.stats.occupied_u + rack.stats.reserved_u}U / {rack.total_u}U
                        </span>
                        <span>{rack.stats.utilization_pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                        <div
                          className="bg-blue-500 h-full"
                          style={{
                            width: `${(rack.stats.occupied_u / rack.total_u) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-amber-400 h-full"
                          style={{
                            width: `${(rack.stats.reserved_u / rack.total_u) * 100}%`,
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

        {/* Right 3D Stage & Equipment Table */}
        <div className="xl:col-span-8 space-y-5">
          {!activeRack ? (
            <div className="h-[540px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
              <Server className="w-10 h-10 mb-2" />
              <p className="text-sm font-semibold">Pilih atau tambah Rack 3D terlebih dahulu.</p>
            </div>
          ) : (
            <>
              {/* Active Rack Header */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-xs font-mono font-bold">
                      {activeRack.code}
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {activeRack.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeRack.location}
                    {activeRack.room_zone ? ` · ${activeRack.room_zone}` : ""} ·{" "}
                    {activeRack.total_u}U · Kapasitas Listrik{" "}
                    {(activeRack.power_capacity_va || 5000).toLocaleString("id-ID")} VA
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditRackModal(activeRack)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Rack
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ kind: "rack", rack: activeRack })}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>

              {/* 3D Interactive Rack Viewport */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>
                    Klik <strong>slot U kosong (hijau saat hover)</strong> pada model 3D untuk
                    langsung memasang perangkat di posisi tersebut.
                  </span>
                </div>
                <Rack3DViewer
                  rack={activeRack}
                  mode="select"
                  requiredUnits={1}
                  selectedSlotId={selectedSlot?.id || null}
                  onSelectEmptyRange={(startU, endU) => openAddSlotModal(startU, endU)}
                  onSelectSlot={(slot) => setSelectedSlot(slot)}
                  heightClass="h-[520px]"
                />
              </div>

              {/* Selected Device Quick Card */}
              {selectedSlot && (
                <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-mono font-bold">
                        {formatRackPositionLabel(
                          activeRack.code,
                          selectedSlot.start_u,
                          selectedSlot.end_u
                        )}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                        {selectedSlot.device_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {selectedSlot.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Customer: <strong>{selectedSlot.customer_name || "-"}</strong> · S/N:{" "}
                      <span className="font-mono">{selectedSlot.serial_number || "-"}</span> ·{" "}
                      {selectedSlot.power_draw_watt || 0}W
                      {selectedSlot.ticket_number ? ` · Tiket: ${selectedSlot.ticket_number}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditSlotModal(selectedSlot)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Unit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          kind: "slot",
                          rackId: activeRack.id,
                          rackCode: activeRack.code,
                          slot: selectedSlot,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Lepas Unit
                    </button>
                  </div>
                </div>
              )}

              {/* Equipment Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Daftar Perangkat & Alokasi U ({activeRack.slots.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => openAddSlotModal()}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Pasang Unit Baru
                  </button>
                </div>

                {activeRack.slots.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Belum ada perangkat terpasang di rack ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5 font-bold">Posisi U</th>
                          <th className="px-4 py-2.5 font-bold">Perangkat & S/N</th>
                          <th className="px-4 py-2.5 font-bold">Customer / Tiket</th>
                          <th className="px-4 py-2.5 font-bold">Daya</th>
                          <th className="px-4 py-2.5 font-bold">Status</th>
                          <th className="px-4 py-2.5 font-bold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activeRack.slots.map((slot) => (
                          <tr
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot)}
                            className={`cursor-pointer transition-colors ${
                              selectedSlot?.id === slot.id
                                ? "bg-blue-50/70 dark:bg-blue-950/30"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              <span
                                className="inline-block w-2 h-2 rounded-full mr-1.5"
                                style={{ backgroundColor: slot.color_tag || "#3b82f6" }}
                              />
                              U{slot.start_u}
                              {slot.end_u > slot.start_u ? `–U${slot.end_u}` : ""} ({slot.unit_size}
                              U)
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {slot.device_name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {slot.device_type} · {slot.serial_number || "No S/N"}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-slate-700 dark:text-slate-200">
                                {slot.customer_name || "-"}
                              </div>
                              {slot.ticket_number && (
                                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                                  {slot.ticket_number}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono">
                              {slot.power_draw_watt || 0}W
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  slot.status === "Reserved"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                    : slot.status === "Maintenance"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                }`}
                              >
                                {slot.status}
                              </span>
                            </td>
                            <td
                              className="px-4 py-2.5 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => openEditSlotModal(slot)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                title="Edit Unit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: "slot",
                                    rackId: activeRack.id,
                                    rackCode: activeRack.code,
                                    slot,
                                  })
                                }
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 ml-1"
                                title="Lepas Unit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Tambah/Edit Rack */}
      <NativeDialog
        isOpen={rackFormOpen}
        onClose={() => setRackFormOpen(false)}
        ariaLabelledBy="rack-form-title"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveRack} className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 id="rack-form-title" className="text-base font-extrabold">
              {editingRack ? `Edit Rack ${editingRack.code}` : "Tambah Cabinet Rack 3D Baru"}
            </h2>
            <button
              type="button"
              onClick={() => setRackFormOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Kode Rack *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingRack)}
                value={rackForm.code}
                onChange={(e) => setRackForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="RACK-CYB1-02"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold uppercase disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Total Kapasitas U *</label>
              <select
                value={rackForm.total_u}
                onChange={(e) => setRackForm((p) => ({ ...p, total_u: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              >
                {[24, 36, 42, 45, 48].map((u) => (
                  <option key={u} value={u}>
                    {u}U Standard 19&quot;
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Nama Rack *</label>
              <input
                type="text"
                required
                value={rackForm.name}
                onChange={(e) => setRackForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Collocation Enterprise Rack B"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Lokasi Data Center *</label>
              <input
                type="text"
                required
                value={rackForm.location}
                onChange={(e) => setRackForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Zona / Ruangan</label>
              <input
                type="text"
                value={rackForm.room_zone}
                onChange={(e) => setRackForm((p) => ({ ...p, room_zone: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Kapasitas Daya (VA)</label>
              <input
                type="number"
                min={1000}
                step={500}
                value={rackForm.power_capacity_va}
                onChange={(e) =>
                  setRackForm((p) => ({ ...p, power_capacity_va: Number(e.target.value) || 5000 }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={rackForm.status}
                onChange={(e) => setRackForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Full">Full</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Catatan</label>
              <input
                type="text"
                value={rackForm.notes}
                onChange={(e) => setRackForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRackFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingRack}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {savingRack ? "Menyimpan..." : editingRack ? "Simpan Perubahan" : "Buat Rack 3D"}
            </button>
          </div>
        </form>
      </NativeDialog>

      {/* Modal Pasang / Edit Unit Slot */}
      <NativeDialog
        isOpen={slotFormOpen}
        onClose={() => setSlotFormOpen(false)}
        ariaLabelledBy="slot-form-title"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveSlot} className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 id="slot-form-title" className="text-base font-extrabold">
              {editingSlot
                ? `Edit Unit U${editingSlot.start_u}–U${editingSlot.end_u}`
                : `Pasang Perangkat Baru di ${activeRack?.code || ""}`}
            </h2>
            <button
              type="button"
              onClick={() => setSlotFormOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Tinggi Perangkat (U) *</label>
              <input
                type="number"
                min={1}
                max={activeRack?.total_u || 42}
                value={slotForm.unit_size}
                onChange={(e) => {
                  const nextSize = Math.max(
                    1,
                    Math.min(activeRack?.total_u || 42, Number(e.target.value) || 1)
                  );
                  setSlotForm((p) => ({ ...p, unit_size: nextSize }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Posisi Start U *</label>
              <select
                value={slotForm.start_u}
                onChange={(e) => setSlotForm((p) => ({ ...p, start_u: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
              >
                {availableSlotStarts.map((u) => (
                  <option key={u} value={u}>
                    U{u}
                    {slotForm.unit_size > 1 ? `–U${u + slotForm.unit_size - 1}` : ""} (
                    {slotForm.unit_size}U)
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Nama Perangkat *</label>
              <input
                type="text"
                required
                value={slotForm.device_name}
                onChange={(e) => setSlotForm((p) => ({ ...p, device_name: e.target.value }))}
                placeholder="Dell PowerEdge R740 / MikroTik CCR2216"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Serial Number</label>
              <input
                type="text"
                value={slotForm.serial_number}
                onChange={(e) => setSlotForm((p) => ({ ...p, serial_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Nama Customer / Tenant</label>
              <input
                type="text"
                value={slotForm.customer_name}
                onChange={(e) => setSlotForm((p) => ({ ...p, customer_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Jenis Perangkat</label>
              <select
                value={slotForm.device_type}
                onChange={(e) => setSlotForm((p) => ({ ...p, device_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Konsumsi Daya (Watt)</label>
              <input
                type="number"
                min={0}
                step={50}
                value={slotForm.power_draw_watt}
                onChange={(e) =>
                  setSlotForm((p) => ({ ...p, power_draw_watt: Number(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Warna Tag 3D</label>
              <select
                value={slotForm.color_tag}
                onChange={(e) => setSlotForm((p) => ({ ...p, color_tag: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {RACK_DEVICE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={slotForm.status}
                onChange={(e) => setSlotForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="Occupied">Occupied (Aktif)</option>
                <option value="Reserved">Reserved (Booking)</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSlotFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingSlot || availableSlotStarts.length === 0}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {savingSlot ? "Menyimpan..." : editingSlot ? "Update Unit" : "Pasang di Rack 3D"}
            </button>
          </div>
        </form>
      </NativeDialog>

      {/* Modal Konfirmasi Hapus */}
      <NativeDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        ariaLabelledBy="rack-delete-confirm-title"
        maxWidthClass="max-w-md"
      >
        <div className="p-5 space-y-4">
          <h2 id="rack-delete-confirm-title" className="text-base font-extrabold text-red-600">
            {deleteTarget?.kind === "rack" ? "Hapus Cabinet Rack 3D?" : "Lepas Unit dari Rack?"}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {deleteTarget?.kind === "rack"
              ? `Rack ${deleteTarget.rack.code} (${deleteTarget.rack.name}) akan dihapus dari database.`
              : deleteTarget
              ? `Perangkat ${deleteTarget.slot.device_name} di ${deleteTarget.rackCode} posisi U${deleteTarget.slot.start_u}–U${deleteTarget.slot.end_u} akan dilepas sehingga U tersebut kembali kosong.`
              : ""}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold"
            >
              {deleting ? "Memproses..." : "Ya, Hapus"}
            </button>
          </div>
        </div>
      </NativeDialog>

      {/* Fullscreen 3D Inspect Modal */}
      <Rack3DPickerModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        mode="inspect"
        initialRackId={activeRack?.id || null}
        highlightedSlotId={selectedSlot?.id || null}
        preloadedRacks={racks}
      />
    </div>
  );
}

