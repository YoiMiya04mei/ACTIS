"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { StatusBadge } from "@/components/StatusBadge";
import { LightboxModal } from "@/components/LightboxModal";
import { SearchableSelect } from "@/components/SearchableSelect";
import { PageSizeSelector, PaginationNavigator } from "@/components/Pagination";
import {
  DEDICATED_SERVICE_OPTIONS,
  getUpgradeOptions,
  getDowngradeOptions,
  parseBandwidthToMbps,
} from "@/lib/ticketUtils";
import {
  Network,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  PowerOff,
  Server,
  Layers,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  PlusCircle,
  FileCheck2,
  Info,
  ChevronRight,
  Clock,
  Radio,
  History,
  Eye,
  FileText,
  ListFilter,
  ArrowRight,
  HardDrive,
  Globe,
  Cpu,
} from "lucide-react";

interface TestItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

interface OrderHistoryItem {
  id: string;
  ticket_number: string;
  tipe_order: string;
  status: string;
  kategori_layanan?: string;
  sub_layanan?: string | null;
  nama_perusahaan?: string | null;
  layanan_dedicated?: string | null;
  vlan?: number | null;
  catatan_tambahan?: string | null;
  created_at: string;
  completed_at?: string | null;
  waktu_aktivasi?: string | null;
  test_results: TestItem[];
  creator?: {
    nama: string;
    role: string;
  };
  progress_logs?: Array<{
    id: string;
    action_type: string;
    catatan_progress: string;
    created_at: string;
    user?: {
      nama: string;
      role: string;
    };
  }>;
}

interface EnterpriseSiteItem {
  id: string;
  site_id: string;
  initial_ticket: string;
  kategori_layanan: string;
  sub_layanan?: string | null;
  nama_perusahaan?: string | null;
  email_pic?: string | null;
  nama_pic: string;
  kontak_pic: string;
  alamat_instalasi?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | null;
  layanan_dedicated?: string | null;
  kapasitas_layanan?: string | null;
  interkoneksi?: string | null;
  port_media?: string | null;
  tipe_layanan_collo?: string | null;
  nama_perangkat?: string | null;
  sn_perangkat?: string | null;
  prefix_advertise?: string | null;
  as_number?: string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sn_ont?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  status_layanan: string; // Active, Isolir, Terminated
  waktu_go_live: string;
  created_at: string;
  updated_at: string;
  _count?: {
    orders: number;
  };
  orders: OrderHistoryItem[];
}

export default function EnterpriseListPage() {
  const { currentUser } = useCurrentUser();

  const [sites, setSites] = useState<EnterpriseSiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTipe, setSelectedTipe] = useState("Semua");
  const [selectedStatus, setSelectedStatus] = useState("Semua");
  const [selectedSubLayanan, setSelectedSubLayanan] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [historyCounts, setHistoryCounts] = useState({
    all: 0,
    aktivasi: 0,
    upgrade: 0,
    downgrade: 0,
    isolir: 0,
    unisolir: 0,
    terminate: 0,
  });

  const [subLayananCounts, setSubLayananCounts] = useState<{
    all: number;
    localloop: number;
    collocation: number;
    darkfiber: number;
    content: number;
    dedicated: number;
  }>({
    all: 0,
    localloop: 0,
    collocation: 0,
    darkfiber: 0,
    content: 0,
    dedicated: 0,
  });

  // Action Modal State
  const [selectedSite, setSelectedSite] = useState<EnterpriseSiteItem | null>(null);
  const [actionType, setActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | null>(null);
  const [newLayanan, setNewLayanan] = useState("");
  const [newVlan, setNewVlan] = useState("");
  const [actionAlasan, setActionAlasan] = useState("");
  const [actionCatatan, setActionCatatan] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  // Full History Detail Modal
  const [historyModalSite, setHistoryModalSite] = useState<EnterpriseSiteItem | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxTitle, setLightboxTitle] = useState("");

  const fetchSites = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("kategori", "Enterprise");
      if (selectedStatus !== "Semua") params.append("status", selectedStatus);
      if (selectedTipe !== "Semua") params.append("tipe", selectedTipe);
      if (selectedSubLayanan !== "Semua") params.append("sub_layanan", selectedSubLayanan);
      if (searchQuery.trim().length > 0) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/pop-sites?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat list Enterprise.");
      }

      setSites(data.data || []);
      if (data.history_counts) {
        setHistoryCounts(data.history_counts);
      }
      if (data.sub_layanan_counts) {
        setSubLayananCounts(data.sub_layanan_counts);
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedTipe, selectedSubLayanan, searchQuery]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedTipe, selectedSubLayanan, searchQuery, pageSize]);

  const totalPages = Math.ceil(sites.length / pageSize) || 1;
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sites.slice(start, start + pageSize);
  }, [sites, currentPage, pageSize]);

  const isBandwidthService = useMemo(() => {
    if (!selectedSite) return false;
    const currentVal = selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "";
    return parseBandwidthToMbps(currentVal) > 0 || selectedSite.sub_layanan === "LocalLoop" || selectedSite.sub_layanan === "Enterprise Dedicated";
  }, [selectedSite]);

  const availableLayananOptions = useMemo(() => {
    if (!selectedSite) return [];
    const currentLayanan = selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "";
    if (actionType === "Upgrade") {
      return getUpgradeOptions(currentLayanan);
    }
    if (actionType === "Downgrade") {
      return getDowngradeOptions(currentLayanan);
    }
    return DEDICATED_SERVICE_OPTIONS;
  }, [selectedSite, actionType]);

  const openActionModal = (site: EnterpriseSiteItem, type: "Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate") => {
    setSelectedSite(site);
    setActionType(type);
    const currentLayanan = site.layanan_dedicated || site.kapasitas_layanan || "";
    const isBandwidth = parseBandwidthToMbps(currentLayanan) > 0 || site.sub_layanan === "LocalLoop" || site.sub_layanan === "Enterprise Dedicated";
    if (isBandwidth && type === "Upgrade") {
      const upOptions = getUpgradeOptions(currentLayanan);
      setNewLayanan(upOptions[0] || "");
    } else if (isBandwidth && type === "Downgrade") {
      const downOptions = getDowngradeOptions(currentLayanan);
      setNewLayanan(downOptions[downOptions.length - 1] || downOptions[0] || "");
    } else {
      setNewLayanan(currentLayanan);
    }
    setNewVlan(site.vlan !== undefined && site.vlan !== null ? String(site.vlan) : "");
    setActionAlasan("");
    setActionCatatan("");
    setActionSuccessMessage(null);
    setCreatedTicketId(null);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || !actionType) return;

    if (actionType === "Upgrade" || actionType === "Downgrade") {
      if (!newLayanan) {
        alert("Silakan tentukan paket / kapasitas baru.");
        return;
      }
      const currentMbps = parseBandwidthToMbps(selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan);
      const targetMbps = parseBandwidthToMbps(newLayanan);

      if (actionType === "Upgrade" && currentMbps > 0 && targetMbps <= currentMbps) {
        alert(`Untuk Upgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih tinggi dari layanan saat ini (${selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "-"}).`);
        return;
      }
      if (actionType === "Downgrade" && currentMbps > 0 && targetMbps >= currentMbps) {
        alert(`Untuk Downgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih rendah dari layanan saat ini (${selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "-"}).`);
        return;
      }
    }

    setIsSubmittingAction(true);
    setActionSuccessMessage(null);

    try {
      const payload = {
        action_type: actionType,
        layanan_dedicated: newLayanan,
        vlan: newVlan ? parseInt(newVlan, 10) : selectedSite.vlan,
        alasan: actionAlasan.trim(),
        catatan: actionCatatan.trim(),
        user_id: currentUser.id,
      };

      const res = await fetch(`/api/pop-sites/${selectedSite.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses aksi lifecycle.");
      }

      setActionSuccessMessage(data.message);
      setCreatedTicketId(data.data.id);
      fetchSites(true);
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxImage}
        title={lightboxTitle}
      />

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
              Asset & History Master
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Database Sirkuit Enterprise Aktif & Lifecycle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Network className="w-7 h-7 mr-3 text-purple-600 dark:text-purple-400" />
            List Enterprise & Full History
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pusat inventaris & riwayat lengkap seluruh layanan Enterprise yang telah selesai diaktivasi (LocalLoop, Collocation Rack, Dark Fiber, Content).
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchSites(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
          </button>

          <Link
            href="/orders/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            + Aktivasi Enterprise Baru
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TOP CONTROL PANEL: SEARCH, TIPE LAYANAN & KLASIFIKASI */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 space-y-3.5">
        {/* Baris 1: Filter Klasifikasi Riwayat Lifecycle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <ListFilter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Klasifikasi Riwayat Lifecycle</span>
            </div>
            {(selectedTipe !== "Semua" || selectedStatus !== "Semua" || selectedSubLayanan !== "Semua" || searchQuery.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTipe("Semua");
                  setSelectedStatus("Semua");
                  setSelectedSubLayanan("Semua");
                  setSearchQuery("");
                }}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-bold hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "Semua History", value: "Semua", count: historyCounts.all, icon: <History className="w-3.5 h-3.5" /> },
              { label: "Aktivasi (Go-Live)", value: "Aktivasi Baru", count: historyCounts.aktivasi, icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> },
              { label: "Upgrade Bandwidth", value: "Upgrade", count: historyCounts.upgrade, icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> },
              { label: "Downgrade Layanan", value: "Downgrade", count: historyCounts.downgrade, icon: <TrendingDown className="w-3.5 h-3.5 text-sky-500" /> },
              { label: "Isolir (Suspended)", value: "Isolir", count: historyCounts.isolir, icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> },
              { label: "Unisolir (Buka Isolir)", value: "Unisolir", count: historyCounts.unisolir, icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-500" /> },
              { label: "Terminasi (Tutup)", value: "Terminate", count: historyCounts.terminate, icon: <PowerOff className="w-3.5 h-3.5 text-rose-500" /> },
            ].map((item) => {
              const isActive = selectedTipe === item.value;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSelectedTipe(item.value)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? "bg-purple-600 text-white font-bold shadow-sm shadow-purple-600/30 ring-2 ring-purple-400/40"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive ? "bg-white/25 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Baris 2: Page Length, Tipe Layanan & Status (Kiri) + Search Bar (Paling Kanan) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Sisi Kiri: Page Length, Filter Sub-Layanan Enterprise & Filter Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            <PageSizeSelector
              value={pageSize}
              onChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              options={[10, 30, 50, 100]}
            />

            {/* Filter / Search Tipe Layanan Enterprise */}
            <div className="relative min-w-[210px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedSubLayanan}
                onChange={(e) => setSelectedSubLayanan(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition shadow-xs outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="Semua">Semua Tipe Layanan Enterprise</option>
                <option value="LocalLoop">LocalLoop</option>
                <option value="Collocation Rack">Collocation Rack</option>
                <option value="Dark Fiber">Dark Fiber</option>
                <option value="Content">Content (Peering / CDN)</option>
                <option value="Enterprise Dedicated">Enterprise Dedicated</option>
              </select>
            </div>

            {/* Filter Status Sirkuit Saat Ini */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 px-1">Status:</span>
              {[
                { label: "Semua", value: "Semua" },
                { label: "Active", value: "Active" },
                { label: "Isolir", value: "Isolir" },
                { label: "Terminated", value: "Terminated" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSelectedStatus(s.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    selectedStatus === s.value
                      ? "bg-slate-900 dark:bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sisi Kanan: Search Bar Input (Paling Kanan) */}
          <div className="relative w-full lg:w-80 xl:w-96 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Site ID, Nama Perusahaan, PIC, Alamat, VLAN, AS Number..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-slate-50/60 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DAFTAR LIST ENTERPRISE (TABLE VIEW EKSKLUSIF) */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {/* Info Counter Header */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
          <span className="font-medium">
            Menampilkan <span className="font-bold text-slate-900 dark:text-slate-100">{sites.length}</span> Master Asset Enterprise
            {selectedSubLayanan !== "Semua" && (
              <span className="text-purple-700 dark:text-purple-300 font-bold ml-1.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-md">
                Layanan: {selectedSubLayanan}
              </span>
            )}
            {selectedTipe !== "Semua" && (
              <span className="text-purple-700 dark:text-purple-300 font-bold ml-1.5 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-md">
                Kategori: {selectedTipe}
              </span>
            )}
            {selectedStatus !== "Semua" && (
              <span className="text-slate-600 dark:text-slate-300 font-bold ml-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                Status: {selectedStatus}
              </span>
            )}
          </span>
          <span className="text-slate-400 dark:text-slate-500 text-[11px] hidden sm:inline">
            Klik pada Site ID atau nama perusahaan untuk membuka detail administrasi & history
          </span>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat inventaris Enterprise & history...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-600 dark:text-rose-400" />
            <p className="font-bold">Gagal Memuat Enterprise Sites</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : sites.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
            <Network className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Tidak ada data sesuai filter</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Silakan ganti tipe layanan, klasifikasi riwayat, atau kata kunci pencarian di panel atas untuk melihat data lainnya.
            </p>
            <div className="pt-2 flex justify-center space-x-3">
              <Link
                href="/orders/new"
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl"
              >
                + Registrasi Enterprise Baru
              </Link>
            </div>
          </div>
        ) : (
          /* Table View */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 dark:bg-slate-950 text-white font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Site ID</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Perusahaan / PIC</th>
                    <th className="py-3.5 px-4">Tipe Layanan</th>
                    <th className="py-3.5 px-4">Spesifikasi / Kapasitas</th>
                    <th className="py-3.5 px-4">Media / Interkoneksi</th>
                    <th className="py-3.5 px-4">History Tiket</th>
                    <th className="py-3.5 px-4 text-center">Trigger Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                  {paginatedSites.map((site) => (
                    <tr key={site.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <Link
                          href={`/enterprise/${site.id}`}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition group/sid"
                        >
                          <span>{site.site_id}</span>
                          <ExternalLink className="w-3 h-3 text-purple-600 dark:text-purple-400 opacity-60 group-hover/sid:opacity-100" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            site.status_layanan === "Active"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : site.status_layanan === "Isolir"
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              site.status_layanan === "Active"
                                ? "bg-emerald-500"
                                : site.status_layanan === "Isolir"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                          />
                          {site.status_layanan}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[240px]">
                        <Link
                          href={`/enterprise/${site.id}`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-purple-700 dark:hover:text-purple-400 block transition text-sm leading-snug"
                        >
                          {site.nama_perusahaan ? site.nama_perusahaan : site.nama_pic}
                        </Link>
                        {site.nama_perusahaan ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                            PIC: <span className="font-semibold text-slate-800 dark:text-slate-200">{site.nama_pic}</span>
                            {site.email_pic && <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal">({site.email_pic})</span>}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5" title={site.alamat_instalasi || ""}>
                          {site.alamat_instalasi || "Alamat: Sesuai Kontrak / Virtual"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200/60 dark:border-purple-800 text-xs">
                          {site.sub_layanan || "Enterprise"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {site.kapasitas_layanan || site.layanan_dedicated || site.tipe_layanan_collo || "-"}
                          </span>
                          {site.vlan && (
                            <span className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-bold">
                              VLAN: {site.vlan}
                            </span>
                          )}
                          {site.as_number && (
                            <span className="text-[11px] font-mono text-purple-700 dark:text-purple-400 font-bold ml-1.5">
                              {site.as_number}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {site.media_koneksi || site.interkoneksi || site.port_media || site.server || "-"}
                          </span>
                          {site.sid && (
                            <span className="block text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                              SID: {site.sid}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Link
                          href={`/enterprise/${site.id}`}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-bold border border-purple-200/80 dark:border-purple-800 transition group/hist"
                        >
                          <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>{site.orders.length} History</span>
                          <ArrowRight className="w-3 h-3 text-purple-600 dark:text-purple-400 transition group-hover/hist:translate-x-0.5" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {site.status_layanan === "Isolir" ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => openActionModal(site, "Unisolir")}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center transition shadow-xs"
                              title="Buka Isolir (Unisolir)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              Unisolir
                            </button>
                            <button
                              onClick={() => openActionModal(site, "Terminate")}
                              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition"
                              title="Terminasi Sirkuit"
                            >
                              Term
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1">
                            <button
                              onClick={() => openActionModal(site, "Upgrade")}
                              disabled={site.status_layanan === "Terminated"}
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                              title="Trigger Upgrade"
                            >
                              Upgrade
                            </button>
                            <button
                              onClick={() => openActionModal(site, "Downgrade")}
                              disabled={site.status_layanan === "Terminated"}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                              title="Trigger Downgrade"
                            >
                              Down
                            </button>
                            <button
                              onClick={() => openActionModal(site, "Isolir")}
                              disabled={site.status_layanan === "Terminated"}
                              className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                              title="Trigger Isolir"
                            >
                              Isolir
                            </button>
                            <button
                              onClick={() => openActionModal(site, "Terminate")}
                              disabled={site.status_layanan === "Terminated"}
                              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                              title="Trigger Terminasi"
                            >
                              Term
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Control / Navigator di paling bawah tabel */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-900/80 border-t border-slate-200/90 dark:border-slate-800">
              <PaginationNavigator
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sites.length}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL TRIGGER AKSI LIFECYCLE */}
      {/* ======================================================== */}
      {actionType && selectedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-visible animate-scaleIn">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between rounded-t-2xl">
              <div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                  Trigger Lifecycle Antrean Enterprise
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                  Aksi: {actionType} Layanan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Site: {selectedSite.site_id} &bull; {selectedSite.nama_perusahaan || selectedSite.nama_pic} ({selectedSite.sub_layanan})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            {actionSuccessMessage ? (
              <div className="p-6 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 animate-bounce" />
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Tiket Berhasil Dibuat!</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{actionSuccessMessage}</p>
                <div className="pt-2 flex justify-center space-x-3">
                  <Link
                    href={`/orders/${createdTicketId}/progress`}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Buka NOC Workspace &rarr;
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteAction} className="p-5 space-y-4 text-xs">
                {(actionType === "Upgrade" || actionType === "Downgrade") && (
                  <div className="space-y-3 bg-purple-50/50 dark:bg-purple-950/30 p-3.5 rounded-xl border border-purple-100 dark:border-purple-800/60">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Paket / Kapasitas Baru <span className="text-rose-500">*</span>
                        </label>
                        {isBandwidthService && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionType === "Upgrade" ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"}`}>
                            {actionType === "Upgrade" ? "Hanya nilai > " : "Hanya nilai < "}
                            {selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "-"}
                          </span>
                        )}
                      </div>

                      {isBandwidthService ? (
                        availableLayananOptions.length === 0 ? (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              {actionType === "Upgrade"
                                ? `Layanan saat ini (${selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan}) sudah merupakan paket tertinggi. Tidak ada pilihan upgrade yang lebih tinggi.`
                                : `Layanan saat ini (${selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan}) sudah merupakan paket terendah. Tidak ada pilihan downgrade yang lebih rendah.`}
                            </span>
                          </div>
                        ) : (
                          <>
                            <SearchableSelect
                              value={newLayanan}
                              onChange={setNewLayanan}
                              options={availableLayananOptions}
                              placeholder={`Pilih atau cari kecepatan ${actionType === "Upgrade" ? "upgrade" : "downgrade"} (misal: 250, 500, 1G)...`}
                              required
                            />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              Menampilkan {availableLayananOptions.length} pilihan layanan lebih {actionType === "Upgrade" ? "tinggi" : "rendah"} dari {selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan}. Ketik angka kecepatan untuk mencari cepat.
                            </p>
                          </>
                        )
                      ) : (
                        <input
                          type="text"
                          required
                          value={newLayanan}
                          onChange={(e) => setNewLayanan(e.target.value)}
                          placeholder="Contoh: 1 Gbps, 10G Peering, 2 Rack..."
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                        />
                      )}
                    </div>

                    {selectedSite.vlan && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          VLAN ID Baru (Opsional)
                        </label>
                        <input
                          type="number"
                          value={newVlan}
                          onChange={(e) => setNewVlan(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan Pengajuan {actionType} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={actionAlasan}
                    onChange={(e) => setActionAlasan(e.target.value)}
                    placeholder={`Masukkan alasan pengajuan ${actionType}...`}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Tambahan untuk NOC Engineer
                  </label>
                  <textarea
                    rows={2}
                    value={actionCatatan}
                    onChange={(e) => setActionCatatan(e.target.value)}
                    placeholder="Instruksi khusus, nomor kontak darurat, dll..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction || ((actionType === "Upgrade" || actionType === "Downgrade") && isBandwidthService && (!newLayanan || availableLayananOptions.length === 0))}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmittingAction ? "Memproses..." : `Kirim ke Antrean ${actionType}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
