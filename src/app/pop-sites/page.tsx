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
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
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

interface PopSiteItem {
  id: string;
  site_id: string;
  initial_ticket: string;
  kategori_layanan?: string;
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

export default function PopSitesListPage() {
  const { currentUser } = useCurrentUser();

  const [sites, setSites] = useState<PopSiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Classification Filters (Top Control Panel)
  const [selectedTipe, setSelectedTipe] = useState("Semua");
  const [selectedStatus, setSelectedStatus] = useState("Semua");
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

  // Action Modal State
  const [selectedSite, setSelectedSite] = useState<PopSiteItem | null>(null);
  const [actionType, setActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | null>(null);
  const [newLayanan, setNewLayanan] = useState("");
  const [newVlan, setNewVlan] = useState("");
  const [actionAlasan, setActionAlasan] = useState("");
  const [actionCatatan, setActionCatatan] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  // Full History Detail Modal
  const [historyModalSite, setHistoryModalSite] = useState<PopSiteItem | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxTitle, setLightboxTitle] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSites = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("kategori", "POP Site");
      if (selectedStatus !== "Semua") params.append("status", selectedStatus);
      if (selectedTipe !== "Semua") params.append("tipe", selectedTipe);
      if (searchQuery.trim().length > 0) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/pop-sites?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat list POP Site.");
      }

      setSites(data.data || []);
      if (data.history_counts) {
        setHistoryCounts(data.history_counts);
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedTipe, searchQuery]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedTipe, searchQuery, pageSize]);

  const totalPages = Math.ceil(sites.length / pageSize) || 1;
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sites.slice(start, start + pageSize);
  }, [sites, currentPage, pageSize]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  const openActionModal = (site: PopSiteItem, type: "Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate") => {
    setSelectedSite(site);
    setActionType(type);
    const currentLayanan = site.layanan_dedicated || site.kapasitas_layanan || "";
    if (type === "Upgrade") {
      const upOptions = getUpgradeOptions(currentLayanan);
      setNewLayanan(upOptions[0] || "");
    } else if (type === "Downgrade") {
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
        alert("Silakan pilih layanan & bandwidth baru.");
        return;
      }
      const currentMbps = parseBandwidthToMbps(selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan);
      const targetMbps = parseBandwidthToMbps(newLayanan);

      if (actionType === "Upgrade" && currentMbps > 0 && targetMbps <= currentMbps) {
        alert(`Untuk Upgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih tinggi dari layanan saat ini (${selectedSite.layanan_dedicated || "-"}).`);
        return;
      }
      if (actionType === "Downgrade" && currentMbps > 0 && targetMbps >= currentMbps) {
        alert(`Untuk Downgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih rendah dari layanan saat ini (${selectedSite.layanan_dedicated || "-"}).`);
        return;
      }
    }

    setIsSubmittingAction(true);
    setActionSuccessMessage(null);

    try {
      const payload = {
        action_type: actionType,
        layanan_dedicated: newLayanan,
        vlan: parseInt(newVlan, 10),
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
      alert(err.message || "Terjadi kesalahan");
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

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
              Asset & History Master
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Database POP Site Aktif & Riwayat Lifecycle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Building2 className="w-7 h-7 mr-3 text-emerald-600 dark:text-emerald-400" />
            List POP Site & Full History
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Pusat penyimpanan riwayat lengkap seluruh POP Site yang telah selesai diaktivasi. Menampung history Aktivasi, Upgrade, Downgrade, Isolir, dan Terminate secara menyeluruh.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchSites(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <Link
            href="/orders/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            + Aktivasi POP Baru
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PANEL FILTER & KONTROL ATAS (KLASIFIKASI RIWAYAT & SEARCH) */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Baris 1: Filter Klasifikasi Riwayat (Pill Tabs Horizontal) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
              <ListFilter className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              Klasifikasi Riwayat Tiket POP Site:
            </span>
            {(selectedTipe !== "Semua" || selectedStatus !== "Semua" || searchQuery.trim().length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTipe("Semua");
                  setSelectedStatus("Semua");
                  setSearchQuery("");
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline"
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
                      ? "bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-400/40"
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

        {/* Baris 2: Page Length & Status Filter (Kiri) + Search Bar (Paling Kanan) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Sisi Kiri: Page Length Selector & Filter Status Sirkuit */}
          <div className="flex flex-wrap items-center gap-2.5">
            <PageSizeSelector
              value={pageSize}
              onChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              options={[10, 30, 50, 100]}
            />

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 px-2">Status:</span>
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    selectedStatus === s.value
                      ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sisi Kanan: Search Bar (Paling Kanan) */}
          <div className="relative w-full md:w-80 lg:w-96 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Site ID, Nama Pelanggan, Alamat, VLAN, Infrastruktur..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/60 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
            />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DAFTAR LIST POP SITE (LEBAR PENUH & RAPI) */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {/* Info Counter Header */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
          <span className="font-medium">
            Menampilkan <span className="font-bold text-slate-900 dark:text-slate-100">{sites.length}</span> Master POP Site
            {selectedTipe !== "Semua" && (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold ml-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-md">
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
            Klik pada Site ID atau nama pelanggan untuk membuka detail split-view & history
          </span>
        </div>

          {/* Table View */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat data inventaris POP Site & history...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-600 dark:text-rose-400" />
              <p className="font-bold">Gagal Memuat POP Site</p>
              <p className="text-xs">{error}</p>
            </div>
          ) : sites.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
              <Building2 className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Tidak ada data sesuai filter</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Silakan ganti klasifikasi riwayat atau kata kunci pencarian di panel atas untuk melihat riwayat aktivitas lainnya.
              </p>
            </div>
          ) : (
            /* Table View (Exclusive View) */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 dark:bg-slate-950 text-white font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Site ID</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Pelanggan / PIC</th>
                      <th className="py-3.5 px-4">Layanan</th>
                      <th className="py-3.5 px-4">VLAN</th>
                      <th className="py-3.5 px-4">Infrastruktur</th>
                      <th className="py-3.5 px-4">History Tiket</th>
                      <th className="py-3.5 px-4 text-center">Trigger Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                    {paginatedSites.map((site) => (
                      <tr key={site.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <Link
                            href={`/pop-sites/${site.id}`}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition group/sid"
                          >
                            <span>{site.site_id}</span>
                            <ExternalLink className="w-3 h-3 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover/sid:opacity-100" />
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
                            href={`/pop-sites/${site.id}`}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 block transition text-sm leading-snug"
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
                          <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs">
                            {site.layanan_dedicated || site.kapasitas_layanan || site.tipe_layanan_collo || site.sub_layanan || "-"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold">
                          <span className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800">
                            {site.vlan !== undefined && site.vlan !== null ? site.vlan : "-"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs">
                            <span
                              className={`font-medium ${
                                site.infrastruktur?.toLowerCase().includes("metronexia")
                                  ? "text-indigo-700 dark:text-indigo-400 font-bold"
                                  : "text-slate-800 dark:text-slate-200 font-semibold"
                              }`}
                            >
                              {site.infrastruktur || site.media_koneksi || "-"}
                            </span>
                            {site.sid && (
                              <span
                                className={`block text-[10px] font-mono font-bold ${
                                  site.infrastruktur?.toLowerCase().includes("metronexia")
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                SID: {site.sid}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Link
                            href={`/pop-sites/${site.id}`}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800 transition group/hist"
                          >
                            <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{site.orders.length} History</span>
                            <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400 transition group-hover/hist:translate-x-0.5" />
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
                                title="Trigger Upgrade Bandwidth"
                              >
                                Upgrade
                              </button>
                              <button
                                onClick={() => openActionModal(site, "Downgrade")}
                                disabled={site.status_layanan === "Terminated"}
                                className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                                title="Trigger Downgrade Layanan"
                              >
                                Down
                              </button>
                              <button
                                onClick={() => openActionModal(site, "Isolir")}
                                disabled={site.status_layanan === "Terminated"}
                                className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold disabled:opacity-30 transition"
                                title="Trigger Isolir (Suspend)"
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

      {/* FULL CHRONOLOGICAL HISTORY MODAL */}
      {historyModalSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <History className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold">
                    Riwayat Komprehensif: {historyModalSite.site_id}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pelanggan: {historyModalSite.nama_pic} &bull; Go-Live: {new Date(historyModalSite.waktu_go_live).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>
              <button onClick={() => setHistoryModalSite(null)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            {/* Modal Timeline Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {historyModalSite.orders.map((ord) => {
                  let badgeColor = "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300";
                  if (ord.tipe_order === "Upgrade") badgeColor = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300";
                  if (ord.tipe_order === "Downgrade") badgeColor = "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300";
                  if (ord.tipe_order === "Isolir") badgeColor = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300";
                  if (ord.tipe_order === "Terminate") badgeColor = "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300";

                  return (
                    <div key={ord.id} className="relative group">
                      <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white dark:border-slate-900 shadow-sm ring-2 ring-emerald-100 dark:ring-emerald-950" />
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                              {ord.ticket_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeColor}`}>
                              {ord.tipe_order || "Aktivasi"}
                            </span>
                            <StatusBadge status={ord.status} size="sm" />
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {new Date(ord.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Layanan: <span className="font-bold text-slate-900 dark:text-slate-100">{ord.layanan_dedicated}</span> &bull; VLAN: <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{ord.vlan}</span>
                        </p>

                        {ord.catatan_tambahan && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 italic">
                            &ldquo;{ord.catatan_tambahan}&rdquo;
                          </p>
                        )}

                        {ord.test_results && ord.test_results.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Bukti Uji Terlampir:</span>
                            <div className="flex flex-wrap gap-2">
                              {ord.test_results.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => {
                                    setLightboxImage(t.file_url);
                                    setLightboxTitle(t.file_name);
                                    setLightboxOpen(true);
                                  }}
                                  className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center"
                                >
                                  <FileCheck2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                                  {t.file_name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-1 flex justify-end">
                          <Link
                            href={`/orders/${ord.id}/progress`}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                          >
                            Buka Detail NOC Desk Tiket Ini &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryModalSite(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION TRIGGER MODAL */}
      {selectedSite && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-visible animate-scaleUp">
            <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-2.5">
                {actionType === "Upgrade" && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                {actionType === "Downgrade" && <TrendingDown className="w-5 h-5 text-blue-400" />}
                {actionType === "Isolir" && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                {actionType === "Unisolir" && <ShieldCheck className="w-5 h-5 text-teal-400" />}
                {actionType === "Terminate" && <PowerOff className="w-5 h-5 text-rose-400" />}
                <div>
                  <h3 className="text-base font-bold">
                    Ajukan Tiket {actionType}: {selectedSite.site_id}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pelanggan: {selectedSite.nama_pic}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSite(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
                  <p className="font-bold text-sm">{actionSuccessMessage}</p>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Tiket baru telah dibuat dan masuk ke antrean Board Antrean / NOC Desk untuk dieksekusi engineer.
                  </p>
                  <div className="pt-2 flex items-center space-x-2">
                    {createdTicketId && (
                      <Link
                        href={`/orders/${createdTicketId}/progress`}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center"
                      >
                        Buka NOC Desk Tiket Ini &rarr;
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setSelectedSite(null);
                        setActionType(null);
                      }}
                      className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExecuteAction} className="space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Spesifikasi Aktif Saat Ini:</p>
                    <p className="text-slate-600 dark:text-slate-300">
                      Layanan: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedSite.layanan_dedicated}</span> &bull; VLAN: <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{selectedSite.vlan}</span> &bull; Infrastruktur: <span className="font-semibold">{selectedSite.infrastruktur || selectedSite.media_koneksi || "-"}</span>
                    </p>
                  </div>

                  {(actionType === "Upgrade" || actionType === "Downgrade") && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Layanan & Bandwidth Baru <span className="text-rose-500">*</span>
                          </label>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionType === "Upgrade" ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"}`}>
                            {actionType === "Upgrade" ? "Hanya nilai > " : "Hanya nilai < "}
                            {selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan || "-"}
                          </span>
                        </div>

                        {availableLayananOptions.length === 0 ? (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start space-x-2">
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
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                          VLAN ID Target
                        </label>
                        <input
                          type="number"
                          value={newVlan}
                          onChange={(e) => setNewVlan(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Alasan {actionType} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={actionAlasan}
                      onChange={(e) => setActionAlasan(e.target.value)}
                      placeholder={
                        actionType === "Upgrade"
                          ? "Permintaan penambahan bandwidth cabang corporate"
                          : actionType === "Downgrade"
                          ? "Penyesuaian kebutuhan kuartal"
                          : actionType === "Isolir"
                          ? "Tunggakan invoice tagihan 2 bulan / isolir sementara"
                          : actionType === "Unisolir"
                          ? "Pelanggan telah melunasi tagihan tertunggak / konfirmasi finance"
                          : "Kontrak layanan berakhir / relokasi kantor"
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Catatan Teknis untuk NOC Engineer
                    </label>
                    <textarea
                      rows={2}
                      value={actionCatatan}
                      onChange={(e) => setActionCatatan(e.target.value)}
                      placeholder="Instruksi khusus shaper, blocking port, routing policy..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSite(null);
                        setActionType(null);
                      }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingAction || ((actionType === "Upgrade" || actionType === "Downgrade") && (!newLayanan || availableLayananOptions.length === 0))}
                      className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        actionType === "Upgrade"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : actionType === "Downgrade"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : actionType === "Isolir"
                          ? "bg-amber-600 hover:bg-amber-700"
                          : actionType === "Unisolir"
                          ? "bg-teal-600 hover:bg-teal-700"
                          : "bg-rose-600 hover:bg-rose-700"
                      }`}
                    >
                      {isSubmittingAction ? "Mengajukan Tiket..." : `Ajukan Tiket ${actionType} ke Antrean`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
