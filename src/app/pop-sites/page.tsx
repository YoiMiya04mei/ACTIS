"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
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
  RotateCcw,
  ChevronRight,
  Clock,
  Radio,
  History,
  Eye,
  FileText,
  ListFilter,
  ArrowRight,
  CheckSquare,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { ImportPopSiteModal } from "@/components/ImportPopSiteModal";
import { generatePopSiteCsvTemplate } from "@/lib/popSiteImportService";

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
  const { alert: alertDialog } = useDialog();
  const isSuperAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";

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
    unterminate: 0,
  });

  // Action Modal State
  const [selectedSite, setSelectedSite] = useState<PopSiteItem | null>(null);
  const [actionType, setActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | "Unterminated" | null>(null);
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

  // Multi-Select State
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [copiedSiteIds, setCopiedSiteIds] = useState(false);

  // Bulk Action State
  const [bulkActionType, setBulkActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Terminate" | null>(null);
  const [bulkNewLayanan, setBulkNewLayanan] = useState("");
  const [bulkAlasan, setBulkAlasan] = useState("");
  const [bulkCatatan, setBulkCatatan] = useState("");
  const [isSubmittingBulkAction, setIsSubmittingBulkAction] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<{
    message: string;
    created_count: number;
    skipped_count: number;
    tickets: Array<{ id: string; ticket_number: string; site_id: string; nama_pic: string }>;
    skipped: Array<{ site_id: string; reason: string }>;
  } | null>(null);

  // Delete Modal State (Super Admin Only & Terminated Only)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<PopSiteItem | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import POP Site Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Download Template Helper
  const handleDownloadTemplate = () => {
    try {
      const csv = generatePopSiteCsvTemplate();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "template_import_pop_site.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      window.open("/api/pop-sites/import", "_blank");
    }
  };

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

  // Multi-Select Helpers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedSites.length === 0) return false;
    return paginatedSites.every((s) => selectedSiteIds.includes(s.id));
  }, [paginatedSites, selectedSiteIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    return paginatedSites.some((s) => selectedSiteIds.includes(s.id));
  }, [paginatedSites, selectedSiteIds]);

  const handleToggleSelectSite = (id: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = new Set(paginatedSites.map((s) => s.id));
      setSelectedSiteIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedSites.map((s) => s.id);
      setSelectedSiteIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedSiteIds(sites.map((s) => s.id));
  };

  const selectedSites = useMemo(() => {
    return sites.filter((s) => selectedSiteIds.includes(s.id));
  }, [sites, selectedSiteIds]);

  // Validasi otomatis: jika ada pilihan berstatus Isolir atau Terminated, Upgrade dan Downgrade massal dinonaktifkan
  const hasIsolirOrTerminatedSelected = useMemo(() => {
    return selectedSites.some(
      (s) => s.status_layanan === "Isolir" || s.status_layanan === "Terminated"
    );
  }, [selectedSites]);

  // Validasi hapus massal: Hanya boleh jika SELURUH sirkuit yang dipilih berstatus Terminated
  const areAllSelectedTerminated = useMemo(() => {
    if (selectedSites.length === 0) return false;
    return selectedSites.every((s) => s.status_layanan === "Terminated");
  }, [selectedSites]);

  const terminatedSelectedCount = useMemo(() => {
    return selectedSites.filter((s) => s.status_layanan === "Terminated").length;
  }, [selectedSites]);

  const handleOpenDeleteSingle = (site: PopSiteItem) => {
    if (!isSuperAdmin) {
      void alertDialog("Akses ditolak: Hanya akun level Super Admin yang memiliki hak untuk menghapus POP Site.");
      return;
    }
    if (site.status_layanan !== "Terminated") {
      void alertDialog(`Hanya POP Site berstatus Terminated yang dapat dihapus. Sirkuit [${site.site_id}] saat ini masih berstatus ${site.status_layanan}.`);
      return;
    }
    setSiteToDelete(site);
    setIsBulkDelete(false);
    setDeleteModalOpen(true);
  };

  const handleOpenDeleteBulk = () => {
    if (!isSuperAdmin) {
      void alertDialog("Akses ditolak: Hanya akun level Super Admin yang memiliki hak untuk menghapus POP Site.");
      return;
    }
    if (!areAllSelectedTerminated) {
      void alertDialog("Hapus massal hanya dapat dilakukan jika SELURUH sirkuit yang dipilih berstatus Terminated. Harap hilangkan pilihan sirkuit Active / Isolir terlebih dahulu.");
      return;
    }
    setSiteToDelete(null);
    setIsBulkDelete(true);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!isSuperAdmin) {
      void alertDialog("Akses ditolak: Hanya akun level Super Admin yang memiliki hak untuk menghapus POP Site.");
      return;
    }

    setIsDeleting(true);
    try {
      if (isBulkDelete) {
        const res = await fetch("/api/pop-sites/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_ids: selectedSiteIds,
            user_id: currentUser?.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Gagal menghapus POP Site secara massal.");
        }

        await alertDialog(data.message || "POP Site berstatus Terminated berhasil dihapus permanen.");
        setSelectedSiteIds([]);
      } else if (siteToDelete) {
        const res = await fetch(`/api/pop-sites/${siteToDelete.id}?user_id=${currentUser?.id}`, {
          method: "DELETE",
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Gagal menghapus POP Site.");
        }

        await alertDialog(data.message || `POP Site ${siteToDelete.site_id} berhasil dihapus permanen.`);
      }

      setDeleteModalOpen(false);
      setSiteToDelete(null);
      setIsBulkDelete(false);
      fetchSites(true);
    } catch (err: any) {
      void alertDialog(err.message || "Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenBulkAction = (type: "Upgrade" | "Downgrade" | "Isolir" | "Terminate") => {
    if ((type === "Upgrade" || type === "Downgrade") && hasIsolirOrTerminatedSelected) {
      void alertDialog("Upgrade dan Downgrade massal tidak dapat dilakukan karena terdapat sirkuit dengan status Isolir atau Terminated yang dipilih. Pastikan seluruh sirkuit terpilih berstatus Active.");
      return;
    }
    setBulkActionType(type);
    setBulkAlasan("");
    setBulkCatatan("");
    setBulkActionSuccess(null);
    if (type === "Upgrade") {
      setBulkNewLayanan("500Mbps");
    } else if (type === "Downgrade") {
      setBulkNewLayanan("50Mbps");
    } else {
      setBulkNewLayanan("");
    }
  };

  const handleExecuteBulkAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkActionType || selectedSiteIds.length === 0) return;

    if ((bulkActionType === "Upgrade" || bulkActionType === "Downgrade") && !bulkNewLayanan) {
      void alertDialog("Silakan tentukan paket / kapasitas layanan baru.");
      return;
    }
    if (!bulkAlasan.trim()) {
      void alertDialog(`Silakan isi alasan pengajuan ${bulkActionType}.`);
      return;
    }

    setIsSubmittingBulkAction(true);
    try {
      const res = await fetch("/api/pop-sites/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_ids: selectedSiteIds,
          action_type: bulkActionType,
          layanan_dedicated: bulkNewLayanan,
          alasan: bulkAlasan.trim(),
          catatan: bulkCatatan.trim(),
          user_id: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses aksi massal.");
      }

      setBulkActionSuccess({
        message: data.message,
        created_count: data.data.created_count,
        skipped_count: data.data.skipped_count,
        tickets: data.data.created,
        skipped: data.data.skipped,
      });
      fetchSites(true);
    } catch (err: any) {
      void alertDialog(err.message || "Terjadi kesalahan saat memproses aksi massal.");
    } finally {
      setIsSubmittingBulkAction(false);
    }
  };

  const handleCopySelectedSiteIds = () => {
    const selectedSites = sites
      .filter((s) => selectedSiteIds.includes(s.id))
      .map((s) => s.site_id);
    if (selectedSites.length === 0) return;
    navigator.clipboard.writeText(selectedSites.join(", "));
    setCopiedSiteIds(true);
    setTimeout(() => setCopiedSiteIds(false), 2000);
  };

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

  const openActionModal = (site: PopSiteItem, type: "Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | "Unterminated") => {
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
        void alertDialog("Silakan pilih layanan & bandwidth baru.");
        return;
      }
      const currentMbps = parseBandwidthToMbps(selectedSite.layanan_dedicated || selectedSite.kapasitas_layanan);
      const targetMbps = parseBandwidthToMbps(newLayanan);

      if (actionType === "Upgrade" && currentMbps > 0 && targetMbps <= currentMbps) {
        void alertDialog(`Untuk Upgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih tinggi dari layanan saat ini (${selectedSite.layanan_dedicated || "-"}).`);
        return;
      }
      if (actionType === "Downgrade" && currentMbps > 0 && targetMbps >= currentMbps) {
        void alertDialog(`Untuk Downgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih rendah dari layanan saat ini (${selectedSite.layanan_dedicated || "-"}).`);
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
      void alertDialog(err.message || "Terjadi kesalahan");
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchSites(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-bold text-xs shadow-sm transition hover:scale-[1.02]"
            title="Unduh Template CSV untuk Migrasi Data POP Site"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Unduh Template
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition hover:scale-[1.02]"
            title="Import dan Migrasi POP Site dari file CSV"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import POP Site
          </button>

          <Link
            href="/orders/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition hover:scale-[1.02]"
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
              { label: "Unterminated", value: "Unterminated", count: (historyCounts as any).unterminated || (historyCounts as any).unterminate || 0, icon: <RotateCcw className="w-3.5 h-3.5 text-emerald-500" /> },
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
              {/* Multi-Select Action Toolbar */}
              {selectedSiteIds.length > 0 && (
                <div className="bg-emerald-50/90 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 dark:text-emerald-100 animate-fadeIn">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold flex items-center text-emerald-900 dark:text-emerald-200">
                      <CheckSquare className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                      {selectedSiteIds.length} POP Site dipilih
                    </span>
                    <span className="text-emerald-300 dark:text-emerald-700">&bull;</span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAllCurrentPage}
                      className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-semibold underline underline-offset-2 transition cursor-pointer"
                    >
                      {isAllCurrentPageSelected ? "Batal Pilih Halaman Ini" : `Pilih Semua di Halaman (${paginatedSites.length})`}
                    </button>
                    {sites.length > paginatedSites.length && (
                      <>
                        <span className="text-emerald-300 dark:text-emerald-700">&bull;</span>
                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-semibold underline underline-offset-2 transition cursor-pointer"
                        >
                          Pilih Semua Hasil Filter ({sites.length})
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    {/* Indikator Peringatan jika ada Isolir / Terminated */}
                    {hasIsolirOrTerminatedSelected && (
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                        title="Ada sirkuit berstatus Isolir atau Terminated yang dipilih. Upgrade & Downgrade massal dinonaktifkan otomatis."
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400 shrink-0" />
                        Ada Isolir / Terminated
                      </span>
                    )}

                    {/* Aksi Massal / Bulk Actions */}
                    <button
                      type="button"
                      disabled={hasIsolirOrTerminatedSelected}
                      onClick={() => handleOpenBulkAction("Upgrade")}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 text-white shadow-2xs transition"
                      title={
                        hasIsolirOrTerminatedSelected
                          ? "Upgrade massal tidak dapat dilakukan karena ada sirkuit berstatus Isolir atau Terminated yang dipilih"
                          : "Buat tiket Upgrade sekaligus untuk seluruh sirkuit terpilih"
                      }
                    >
                      <TrendingUp className="w-3.5 h-3.5 mr-1" />
                      Upgrade
                    </button>

                    <button
                      type="button"
                      disabled={hasIsolirOrTerminatedSelected}
                      onClick={() => handleOpenBulkAction("Downgrade")}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-blue-600 text-white shadow-2xs transition"
                      title={
                        hasIsolirOrTerminatedSelected
                          ? "Downgrade massal tidak dapat dilakukan karena ada sirkuit berstatus Isolir atau Terminated yang dipilih"
                          : "Buat tiket Downgrade sekaligus untuk seluruh sirkuit terpilih"
                      }
                    >
                      <TrendingDown className="w-3.5 h-3.5 mr-1" />
                      Down
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenBulkAction("Isolir")}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition cursor-pointer"
                      title="Buat tiket Isolir sekaligus untuk seluruh sirkuit terpilih"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                      Isolir
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenBulkAction("Terminate")}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition cursor-pointer"
                      title="Buat tiket Terminate sekaligus untuk seluruh sirkuit terpilih"
                    >
                      <PowerOff className="w-3.5 h-3.5 mr-1" />
                      Terminate
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        disabled={!areAllSelectedTerminated}
                        onClick={handleOpenDeleteBulk}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-700 hover:bg-rose-800 disabled:opacity-35 disabled:cursor-not-allowed text-white shadow-2xs transition cursor-pointer"
                        title={
                          !areAllSelectedTerminated
                            ? "Hapus massal hanya dapat dilakukan jika SELURUH sirkuit yang dipilih berstatus Terminated"
                            : "Hapus seluruh POP Site berstatus Terminated yang dipilih secara permanen (Khusus Super Admin)"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Hapus Terminated ({terminatedSelectedCount})
                      </button>
                    )}

                    <span className="text-emerald-300 dark:text-emerald-700">&bull;</span>

                    {/* Salin Site ID */}
                    <button
                      type="button"
                      onClick={handleCopySelectedSiteIds}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                      {copiedSiteIds ? "Tersalin!" : "Salin Site ID"}
                    </button>

                    {/* Reset / Deselect All */}
                    <button
                      type="button"
                      onClick={() => setSelectedSiteIds([])}
                      className="inline-flex items-center px-2 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition cursor-pointer"
                      title="Batal pilih semua"
                    >
                      <X className="w-4 h-4 mr-0.5" />
                      Batal Pilih
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 dark:bg-slate-950 text-white font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isAllCurrentPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeCurrentPageSelected && !isAllCurrentPageSelected;
                            }}
                            onChange={handleToggleSelectAllCurrentPage}
                            title="Pilih semua di halaman ini"
                            className="w-4 h-4 rounded border-slate-400 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-2 cursor-pointer transition-colors accent-emerald-600"
                          />
                        </div>
                      </th>
                      <th className="py-3.5 px-4">Site ID</th>
                      <th className="py-3.5 px-4">Nama PIC</th>
                      <th className="py-3.5 px-4">Layanan</th>
                      <th className="py-3.5 px-4">VLAN</th>
                      <th className="py-3.5 px-4">Infrastruktur</th>
                      <th className="py-3.5 px-4">History Tiket</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                    {paginatedSites.map((site) => {
                      const isSelected = selectedSiteIds.includes(site.id);
                      return (
                      <tr
                        key={site.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50"
                            : "hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <td className="py-3.5 pl-4 pr-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSite(site.id)}
                              title={`Pilih ${site.site_id}`}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-2 cursor-pointer transition-colors accent-emerald-600"
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <Link
                            href={`/pop-sites/${site.id}`}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition group/sid"
                          >
                            <span>{site.site_id}</span>
                            <ExternalLink className="w-3 h-3 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover/sid:opacity-100" />
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 min-w-[240px]">
                          <Link
                            href={`/pop-sites/${site.id}`}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 block transition text-sm leading-snug"
                          >
                            {site.nama_pic}
                          </Link>
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
                          <div className="inline-flex items-center space-x-1.5 justify-center">
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

                            {site.status_layanan === "Terminated" && isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteSingle(site)}
                                className="p-1 rounded-lg text-rose-500 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-700 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                                title="Hapus POP Site ini secara permanen (Khusus Super Admin & Status Terminated)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                {actionType === "Unterminated" && <RotateCcw className="w-5 h-5 text-emerald-400" />}
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
                          : actionType === "Unterminated"
                          ? "Pengaktifan kembali layanan yang sebelumnya diterminasi / renewal kontrak baru"
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
                        actionType === "Upgrade" || actionType === "Unterminated"
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
      {/* BULK ACTION MODAL (Buat Tiket Sekaligus) */}
      {bulkActionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Modal Header */}
            <div
              className={`px-6 py-4 flex items-center justify-between border-b text-white shrink-0 ${
                bulkActionType === "Upgrade"
                  ? "bg-emerald-600 border-emerald-700"
                  : bulkActionType === "Downgrade"
                  ? "bg-blue-600 border-blue-700"
                  : bulkActionType === "Isolir"
                  ? "bg-amber-600 border-amber-700"
                  : "bg-rose-600 border-rose-700"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  {bulkActionType === "Upgrade" && <TrendingUp className="w-5 h-5 text-white" />}
                  {bulkActionType === "Downgrade" && <TrendingDown className="w-5 h-5 text-white" />}
                  {bulkActionType === "Isolir" && <ShieldAlert className="w-5 h-5 text-white" />}
                  {bulkActionType === "Terminate" && <PowerOff className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Buat Tiket {bulkActionType} Sekaligus
                  </h3>
                  <p className="text-xs text-white/80">
                    Menerbitkan tiket kerja antrean untuk <strong>{selectedSites.length} POP Site</strong> terpilih.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBulkActionType(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkActionSuccess ? (
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 animate-bounce" />
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {bulkActionSuccess.created_count} Tiket Berhasil Dibuat!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {bulkActionSuccess.message}
                  </p>
                </div>

                {/* List created tickets */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2 max-h-48 overflow-y-auto">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Daftar Tiket Antrean Terbit:
                  </span>
                  {bulkActionSuccess.tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{t.ticket_number}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{t.site_id}</span>
                        <span className="text-slate-500 dark:text-slate-400">({t.nama_pic})</span>
                      </div>
                      <Link
                        href={`/orders/${t.id}/progress`}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        Buka Tiket &rarr;
                      </Link>
                    </div>
                  ))}
                </div>

                {/* List skipped (if any) */}
                {bulkActionSuccess.skipped && bulkActionSuccess.skipped.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs space-y-1">
                    <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      {bulkActionSuccess.skipped.length} POP Site Dilewati:
                    </span>
                    {bulkActionSuccess.skipped.map((s, idx) => (
                      <p key={idx} className="text-amber-700 dark:text-amber-400 text-[11px]">
                        <strong>{s.site_id}</strong>: {s.reason}
                      </p>
                    ))}
                  </div>
                )}

                <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkActionType(null);
                      setSelectedSiteIds([]);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Selesai & Bersihkan Pilihan
                  </button>
                  <Link
                    href="/queue"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    Buka Board Antrean &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteBulkAction} className="p-6 space-y-4 overflow-y-auto text-xs">
                {/* Selected Sites Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Sirkuit yang Dipilih ({selectedSites.length})
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Seluruh sirkuit ini akan diajukan ke tiket {bulkActionType}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    {selectedSites.map((site) => (
                      <div
                        key={site.id}
                        className="flex items-center justify-between py-1 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{site.site_id}</span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">({site.nama_pic})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                            {site.layanan_dedicated || site.kapasitas_layanan || "-"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              site.status_layanan === "Active"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : site.status_layanan === "Isolir"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {site.status_layanan}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* If Upgrade / Downgrade: Target Bandwidth */}
                {(bulkActionType === "Upgrade" || bulkActionType === "Downgrade") && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Paket / Kapasitas Baru Bersama <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      value={bulkNewLayanan}
                      onChange={setBulkNewLayanan}
                      options={DEDICATED_SERVICE_OPTIONS}
                      placeholder={`Pilih kapasitas baru untuk ${bulkActionType} (misal: 250Mbps, 500Mbps, 1G)...`}
                      required
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Nilai kapasitas ini akan diterapkan ke seluruh tiket {bulkActionType} yang dibuat.
                    </p>
                  </div>
                )}

                {/* Input Alasan */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Alasan Pengajuan {bulkActionType} Sekaligus <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bulkAlasan}
                    onChange={(e) => setBulkAlasan(e.target.value)}
                    placeholder={
                      bulkActionType === "Upgrade"
                        ? "Penambahan kapasitas bandwidth regional kuartal baru"
                        : bulkActionType === "Downgrade"
                        ? "Penyesuaian kebutuhan paket pelanggan korporat"
                        : bulkActionType === "Isolir"
                        ? "Tunggakan invoice tagihan operasional / suspend sementara"
                        : "Penutupan sirkuit massal / migrasi POP"
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium"
                  />
                </div>

                {/* Input Catatan */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Catatan Teknis untuk NOC Engineer (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={bulkCatatan}
                    onChange={(e) => setBulkCatatan(e.target.value)}
                    placeholder="Instruksi pengerjaan batch NOC, jadwal eksekusi, dsb..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setBulkActionType(null)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmittingBulkAction ||
                      ((bulkActionType === "Upgrade" || bulkActionType === "Downgrade") && !bulkNewLayanan)
                    }
                    className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                      bulkActionType === "Upgrade"
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                        : bulkActionType === "Downgrade"
                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                        : bulkActionType === "Isolir"
                        ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
                        : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                    }`}
                  >
                    {isSubmittingBulkAction
                      ? "Memproses Tiket Massal..."
                      : `Buat ${selectedSites.length} Tiket ${bulkActionType} Sekaligus`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Super Admin Only & Terminated Only) */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-rose-200 dark:border-rose-800 shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                Super Admin Only
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Hapus Permanen POP Site?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {isBulkDelete
                  ? `Apakah Anda yakin ingin menghapus ${selectedSiteIds.length} POP Site terpilih secara permanen? Seluruh sirkuit ini telah berstatus Terminated.`
                  : `Apakah Anda yakin ingin menghapus POP Site [${siteToDelete?.site_id}] (${siteToDelete?.nama_pic}) secara permanen?`}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300">
              ⚠ Data sirkuit dan riwayat antrean tiket terkait akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
            </div>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import POP Site CSV Modal */}
      <ImportPopSiteModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => fetchSites(true)}
      />
    </div>
  );
}
