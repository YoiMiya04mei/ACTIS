"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSizeSelector, PaginationNavigator } from "@/components/Pagination";
import {
  Layers,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  Clock,
  Calendar,
  Network,
  RefreshCw,
  Server,
  FileCheck2,
  Building,
  Building2,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  PowerOff,
  RotateCcw,
  Radio,
  Ban,
  X,
  AlertCircle,
  CheckSquare,
  Square,
  Copy,
} from "lucide-react";
import { DEFAULT_SERVER_OPTIONS } from "@/lib/ticketUtils";

interface OrderItem {
  id: string;
  ticket_number: string;
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
  waktu_aktivasi?: string | null;
  catatan_tambahan?: string | null;
  status: string;
  tipe_order?: string;
  created_at: string;
  completed_at?: string | null;
  creator?: {
    id: string;
    nama: string;
    email: string;
    role: string;
  };
  _count?: {
    test_results: number;
    progress_logs: number;
  };
  progress_logs?: Array<{
    id: string;
    action_type: string;
    catatan_progress: string;
    created_at: string;
    user?: {
      id: string;
      nama: string;
      role: string;
    };
  }>;
}

export default function QueueBoardPage() {
  const { currentUser } = useCurrentUser();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTipe, setSelectedTipe] = useState("Semua");
  const [selectedKategori, setSelectedKategori] = useState<"Semua" | "POP Site" | "Enterprise">("Semua");
  const [selectedSubLayanan, setSelectedSubLayanan] = useState("Semua");
  const [selectedServer, setSelectedServer] = useState("Semua");
  const [availableServers, setAvailableServers] = useState<string[]>(DEFAULT_SERVER_OPTIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState("Semua");
  const [selectedStatus, setSelectedStatus] = useState("Semua");

  // Cancel Ticket Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderItem | null>(null);
  const [cancelAlasan, setCancelAlasan] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);

  // Multi-Select State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [copiedTickets, setCopiedTickets] = useState(false);
  const [bulkCancelModalOpen, setBulkCancelModalOpen] = useState(false);
  const [bulkCancelAlasan, setBulkCancelAlasan] = useState("");
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);
  const [bulkCancelError, setBulkCancelError] = useState<string | null>(null);
  const [bulkCancelSuccessMessage, setBulkCancelSuccessMessage] = useState<string | null>(null);

  const [queueCounts, setQueueCounts] = useState({
    total: 0,
    aktivasi: 0,
    upgrade: 0,
    downgrade: 0,
    isolir: 0,
    unisolir: 0,
    terminate: 0,
    unterminated: 0,
  });

  const [classificationCounts, setClassificationCounts] = useState({
    all: 0,
    pop_site: 0,
    enterprise: 0,
    sub_layanan: {
      localloop: 0,
      collocation: 0,
      darkfiber: 0,
      content: 0,
      dedicated: 0,
    },
  });

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("is_queue", "true"); // strictly exclude Completed orders

      if (selectedKategori !== "Semua") params.append("kategori", selectedKategori);
      if (selectedSubLayanan !== "Semua") params.append("sub_layanan", selectedSubLayanan);
      if (selectedServer !== "Semua") params.append("server", selectedServer);
      if (selectedTipe !== "Semua") params.append("tipe_order", selectedTipe);
      if (selectedMedia !== "Semua") params.append("media_koneksi", selectedMedia);
      if (selectedStatus !== "Semua") params.append("status", selectedStatus);
      if (searchQuery.trim().length > 0) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengambil data antrian.");
      }

      setOrders(data.data || []);
      if (data.queue_counts) {
        setQueueCounts(data.queue_counts);
      }
      if (data.classification_counts) {
        setClassificationCounts(data.classification_counts);
      }
      if (Array.isArray(data.unique_servers) && data.unique_servers.length > 0) {
        setAvailableServers((prev) => Array.from(new Set([...prev, ...data.unique_servers])));
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTipe, selectedKategori, selectedSubLayanan, selectedServer, selectedMedia, selectedStatus, searchQuery]);

  // Handlers for Cancel Ticket
  const handleOpenCancelModal = (order: OrderItem) => {
    setOrderToCancel(order);
    setCancelAlasan("");
    setCancelError(null);
    setCancelSuccessMessage(null);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToCancel) return;

    if (!cancelAlasan.trim()) {
      setCancelError("Alasan pembatalan tiket wajib diisi.");
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${orderToCancel.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser?.id,
          alasan: cancelAlasan.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membatalkan tiket.");
      }

      setCancelSuccessMessage(data.message || `Tiket ${orderToCancel.ticket_number} berhasil dibatalkan.`);
      fetchOrders(true);
      setTimeout(() => {
        setCancelModalOpen(false);
        setOrderToCancel(null);
        setCancelSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setCancelError(err.message || "Terjadi kesalahan saat membatalkan tiket.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTipe, selectedKategori, selectedSubLayanan, selectedServer, selectedMedia, selectedStatus, searchQuery, pageSize]);

  const totalPages = Math.ceil(orders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orders.slice(start, start + pageSize);
  }, [orders, currentPage, pageSize]);

  // Multi-Select Helpers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedOrders.length === 0) return false;
    return paginatedOrders.every((o) => selectedOrderIds.includes(o.id));
  }, [paginatedOrders, selectedOrderIds]);

  const isSomeCurrentPageSelected = useMemo(() => {
    return paginatedOrders.some((o) => selectedOrderIds.includes(o.id));
  }, [paginatedOrders, selectedOrderIds]);

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = new Set(paginatedOrders.map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedOrders.map((o) => o.id);
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedOrderIds(orders.map((o) => o.id));
  };

  const handleCopySelectedTicketNumbers = () => {
    const selectedTickets = orders
      .filter((o) => selectedOrderIds.includes(o.id))
      .map((o) => o.ticket_number);
    if (selectedTickets.length === 0) return;
    navigator.clipboard.writeText(selectedTickets.join(", "));
    setCopiedTickets(true);
    setTimeout(() => setCopiedTickets(false), 2000);
  };

  const cancellableSelectedOrders = useMemo(() => {
    return orders.filter(
      (o) => selectedOrderIds.includes(o.id) && o.status !== "Cancelled" && o.status !== "Completed"
    );
  }, [orders, selectedOrderIds]);

  const handleOpenBulkCancelModal = () => {
    setBulkCancelAlasan("");
    setBulkCancelError(null);
    setBulkCancelSuccessMessage(null);
    setBulkCancelModalOpen(true);
  };

  const handleConfirmBulkCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cancellableSelectedOrders.length === 0) return;
    if (!bulkCancelAlasan.trim()) {
      setBulkCancelError("Alasan pembatalan tiket wajib diisi.");
      return;
    }

    setIsBulkCancelling(true);
    setBulkCancelError(null);

    try {
      const results = await Promise.all(
        cancellableSelectedOrders.map((order) =>
          fetch(`/api/orders/${order.id}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: currentUser?.id,
              alasan: bulkCancelAlasan.trim(),
            }),
          }).then((res) => res.json())
        )
      );

      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        throw new Error(`Sebagian tiket gagal dibatalkan (${failures.length} tiket gagal).`);
      }

      setBulkCancelSuccessMessage(`${cancellableSelectedOrders.length} tiket berhasil dibatalkan.`);
      fetchOrders(true);
      setTimeout(() => {
        setBulkCancelModalOpen(false);
        setSelectedOrderIds([]);
        setBulkCancelSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setBulkCancelError(err.message || "Gagal membatalkan tiket terpilih.");
    } finally {
      setIsBulkCancelling(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              NOC Task Queue
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monitoring Antrean Berjalan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Layers className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Dashboard Antrean Layanan ISP
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Daftar tugas aktif antrean Aktivasi, Upgrade, Downgrade, Isolir, dan Terminate yang sedang diproses. (Tiket yang selesai otomatis tersimpan di List POP Site).
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <Link
            href="/orders/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            + Aktivasi Baru
          </Link>
        </div>
      </div>

      {/* 8 requested Antrean Stat Cards (Excluding Complete, which goes to List POP Site) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 2xl:gap-3.5">
        {/* Total Antrean */}
        <div
          onClick={() => setSelectedTipe("Semua")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Semua"
              ? "bg-slate-900 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-500 shadow-md ring-2 ring-slate-700 dark:ring-blue-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Total Antrean</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.total}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Semua" ? "text-slate-300 dark:text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
            Seluruh tugas aktif
          </p>
        </div>

        {/* Antrian Aktivasi */}
        <div
          onClick={() => setSelectedTipe("Aktivasi Baru")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Aktivasi Baru"
              ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Aktivasi</span>
            <PlusCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.aktivasi}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Aktivasi Baru" ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
            Aktivasi POP baru
          </p>
        </div>

        {/* Antrian Upgrade */}
        <div
          onClick={() => setSelectedTipe("Upgrade")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Upgrade"
              ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Upgrade</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.upgrade}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Upgrade" ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
            Kenaikan bandwidth
          </p>
        </div>

        {/* Antrian Downgrade */}
        <div
          onClick={() => setSelectedTipe("Downgrade")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Downgrade"
              ? "bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Down</span>
            <TrendingDown className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.downgrade}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Downgrade" ? "text-sky-100" : "text-slate-500 dark:text-slate-400"}`}>
            Penurunan paket
          </p>
        </div>

        {/* Antrian Isolir */}
        <div
          onClick={() => setSelectedTipe("Isolir")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Isolir"
              ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Isolir</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.isolir}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Isolir" ? "text-amber-100" : "text-slate-500 dark:text-slate-400"}`}>
            Suspend sirkuit
          </p>
        </div>

        {/* Antrian Unisolir */}
        <div
          onClick={() => setSelectedTipe("Unisolir")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Unisolir"
              ? "bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Unisolir</span>
            <ShieldCheck className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.unisolir}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Unisolir" ? "text-teal-100" : "text-slate-500 dark:text-slate-400"}`}>
            Buka blokir layanan
          </p>
        </div>

        {/* Antrian Terminate */}
        <div
          onClick={() => setSelectedTipe("Terminate")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Terminate"
              ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Term</span>
            <PowerOff className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.terminate}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Terminate" ? "text-rose-100" : "text-slate-500 dark:text-slate-400"}`}>
            Penutupan layanan
          </p>
        </div>

        {/* Antrian Unterminated */}
        <div
          onClick={() => setSelectedTipe("Unterminated")}
          className={`p-3.5 rounded-2xl border transition-card cursor-pointer ${
            selectedTipe === "Unterminated"
              ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Antrian Unterminated</span>
            <RotateCcw className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black mt-1.5">{queueCounts.unterminated || 0}</p>
          <p className={`text-[10px] mt-0.5 ${selectedTipe === "Unterminated" ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
            Buka terminasi
          </p>
        </div>
      </div>

      {/* Search & Filter Bar with Tiket Klasifikasi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Baris 1: Filter Tiket Klasifikasi (1. POP Site, 2. Enterprise) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
              Klasifikasi Tiket Layanan:
            </span>
            {(selectedKategori !== "Semua" || selectedSubLayanan !== "Semua" || selectedTipe !== "Semua" || selectedServer !== "Semua" || selectedMedia !== "Semua" || searchQuery.trim().length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedKategori("Semua");
                  setSelectedSubLayanan("Semua");
                  setSelectedTipe("Semua");
                  setSelectedServer("Semua");
                  setSelectedMedia("Semua");
                  setSearchQuery("");
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Tab Klasifikasi Utama: Semua | POP Site | Enterprise */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                label: "Semua Klasifikasi",
                value: "Semua",
                count: classificationCounts.all,
                icon: <Layers className="w-4 h-4" />,
                activeClass: "bg-slate-900 dark:bg-blue-600 text-white shadow-md ring-2 ring-slate-800 dark:ring-blue-500",
              },
              {
                label: "POP Site",
                value: "POP Site",
                count: classificationCounts.pop_site,
                icon: <Radio className="w-4 h-4" />,
                activeClass: "bg-blue-600 text-white shadow-md ring-2 ring-blue-500",
              },
              {
                label: "Enterprise",
                value: "Enterprise",
                count: classificationCounts.enterprise,
                icon: <Building2 className="w-4 h-4" />,
                activeClass: "bg-purple-600 text-white shadow-md ring-2 ring-purple-500",
              },
            ].map((cat) => {
              const isActive = selectedKategori === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setSelectedKategori(cat.value as any);
                    if (cat.value !== "Enterprise") {
                      setSelectedSubLayanan("Semua");
                    }
                  }}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? cat.activeClass
                      : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-Layanan Enterprise (Muncul jika Kategori Enterprise atau Semua) */}
          {(selectedKategori === "Enterprise" || selectedKategori === "Semua") && (
            <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/90 dark:border-purple-800/60 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-bold text-purple-900 dark:text-purple-200">
                <span className="flex items-center uppercase tracking-wider">
                  <Network className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                  Sub-Layanan Enterprise:
                </span>
                {selectedSubLayanan !== "Semua" && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubLayanan("Semua")}
                    className="text-[10px] text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 underline font-semibold"
                  >
                    Tampilkan Semua Sub-Layanan
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    label: "Semua Sub-Layanan",
                    value: "Semua",
                    count: classificationCounts.enterprise,
                  },
                  {
                    label: "LocalLoop",
                    value: "LocalLoop",
                    count: classificationCounts.sub_layanan.localloop,
                  },
                  {
                    label: "Collocation Rack",
                    value: "Collocation Rack",
                    count: classificationCounts.sub_layanan.collocation,
                  },
                  {
                    label: "Dark Fiber",
                    value: "Dark Fiber",
                    count: classificationCounts.sub_layanan.darkfiber,
                  },
                  {
                    label: "Content",
                    value: "Content",
                    count: classificationCounts.sub_layanan.content,
                  },
                  {
                    label: "Enterprise Dedicated",
                    value: "Enterprise Dedicated",
                    count: classificationCounts.sub_layanan.dedicated,
                  },
                ].map((sub) => {
                  const isSubActive = selectedSubLayanan === sub.value;
                  return (
                    <button
                      key={sub.value}
                      type="button"
                      onClick={() => {
                        setSelectedSubLayanan(sub.value);
                        if (selectedKategori !== "Enterprise") {
                          setSelectedKategori("Enterprise");
                        }
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        isSubActive
                          ? "bg-purple-600 text-white font-bold shadow-sm shadow-purple-600/30 ring-1 ring-purple-400"
                          : "bg-white dark:bg-slate-900 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      <span>{sub.label}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSubActive ? "bg-white/25 text-white" : "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200"
                        }`}
                      >
                        {sub.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Baris 2: Page Length, Server & Media (Kiri) + Search Input (Paling Kanan) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Sisi Kiri: Page Length, Filter Server Dropdown & Media Koneksi Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            <PageSizeSelector
              value={pageSize}
              onChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              options={[10, 30, 50, 100]}
            />

            {/* Filter Server Dropdown */}
            <div className="relative min-w-[190px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Server className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="Semua">Semua Server / BRAS</option>
                {availableServers.map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </select>
            </div>

            {/* Media Koneksi Filter */}
            <div className="relative min-w-[180px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="Semua">Semua Media Koneksi</option>
                <option value="Metro Telkom">Metro Telkom</option>
                <option value="Direct Fiber ISP">Direct Fiber ISP</option>
                <option value="Radio Ubiquiti">Radio Ubiquiti</option>
                <option value="Radio Mimosa">Radio Mimosa</option>
                <option value="VSAT K-Band">VSAT K-Band</option>
              </select>
            </div>

            {/* Filter Status Dropdown */}
            <div className="relative min-w-[170px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="Semua">Semua Antrean Aktif</option>
                <option value="Antrian Aktivasi">Antrian Aktivasi</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Issue">Pending Issue</option>
                <option value="Cancelled">Dibatalkan (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* Sisi Kanan: Search Input (Paling Kanan) */}
          <div className="relative w-full lg:w-80 xl:w-96 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Tiket, Nama PIC, VLAN, Media..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs outline-none bg-slate-50/60 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Active Filter Badges */}
        {(selectedKategori !== "Semua" || selectedSubLayanan !== "Semua" || selectedTipe !== "Semua" || selectedServer !== "Semua" || selectedMedia !== "Semua" || selectedStatus !== "Semua") && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">Filter Aktif:</span>
            {selectedKategori !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold text-[11px]">
                Kategori: {selectedKategori}
              </span>
            )}
            {selectedSubLayanan !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold text-[11px]">
                Sub: {selectedSubLayanan}
              </span>
            )}
            {selectedServer !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-[11px]">
                Server: {selectedServer}
              </span>
            )}
            {selectedTipe !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]">
                Antrean: {selectedTipe}
              </span>
            )}
            {selectedMedia !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-[11px]">
                Media: {selectedMedia}
              </span>
            )}
            {selectedStatus !== "Semua" && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-[11px]">
                Status: {selectedStatus}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Order Content */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat antrean aktif...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-600 dark:text-rose-400" />
          <p className="font-bold">Gagal Memuat Antrean</p>
          <p className="text-xs">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 space-y-3">
          <Layers className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Tidak ada antrean tiket aktif</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Semua tiket layanan yang telah selesai diproses otomatis tersimpan secara rapi pada menu <strong>List POP Site</strong> atau <strong>List Enterprise</strong>.
          </p>
          <div className="pt-2 flex justify-center space-x-3">
            <Link
              href="/pop-sites"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              List POP Site &rarr;
            </Link>
            <Link
              href="/enterprise"
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl"
            >
              List Enterprise &rarr;
            </Link>
            <Link
              href="/orders/new"
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
            >
              + Registrasi Tiket Baru
            </Link>
          </div>
        </div>
      ) : (
        /* Table View (Exclusive View) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Multi-Select Action Toolbar */}
          {selectedOrderIds.length > 0 && (
            <div className="bg-blue-50/90 dark:bg-blue-950/80 border-b border-blue-200 dark:border-blue-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950 dark:text-blue-100 animate-fadeIn">
              <div className="flex items-center space-x-3">
                <span className="font-bold flex items-center text-blue-900 dark:text-blue-200">
                  <CheckSquare className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400" />
                  {selectedOrderIds.length} tiket dipilih
                </span>
                <span className="text-blue-300 dark:text-blue-700">&bull;</span>
                <button
                  type="button"
                  onClick={handleToggleSelectAllCurrentPage}
                  className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-semibold underline underline-offset-2 transition cursor-pointer"
                >
                  {isAllCurrentPageSelected ? "Batal Pilih Halaman Ini" : `Pilih Semua di Halaman (${paginatedOrders.length})`}
                </button>
                {orders.length > paginatedOrders.length && (
                  <>
                    <span className="text-blue-300 dark:text-blue-700">&bull;</span>
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-semibold underline underline-offset-2 transition cursor-pointer"
                    >
                      Pilih Semua Hasil Filter ({orders.length})
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Salin Nomor Tiket */}
                <button
                  type="button"
                  onClick={handleCopySelectedTicketNumbers}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                  {copiedTickets ? "Tersalin!" : "Salin No. Tiket"}
                </button>

                {/* Batalkan Tiket Terpilih (Bulk Cancel) */}
                {cancellableSelectedOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenBulkCancelModal}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-2xs cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Batalkan Tiket ({cancellableSelectedOrders.length})
                  </button>
                )}

                {/* Reset / Deselect All */}
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="inline-flex items-center px-2 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition cursor-pointer"
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
                        className="w-4 h-4 rounded border-slate-400 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2 cursor-pointer transition-colors accent-blue-600"
                      />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">No. Tiket</th>
                  <th className="py-3.5 px-4">Tipe Antrean</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Pelanggan / PIC</th>
                  <th className="py-3.5 px-4">VLAN</th>
                  <th className="py-3.5 px-4">Infrastruktur</th>
                  <th className="py-3.5 px-4">Tanggal Masuk</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                {paginatedOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  let badgeColor = "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                  if (order.tipe_order === "Upgrade") badgeColor = "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                  if (order.tipe_order === "Downgrade") badgeColor = "bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800";
                  if (order.tipe_order === "Isolir") badgeColor = "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                  if (order.tipe_order === "Unisolir") badgeColor = "bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800";
                  if (order.tipe_order === "Terminate") badgeColor = "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                  if (order.tipe_order === "Unterminated" || order.tipe_order === "Unterminate") badgeColor = "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50"
                          : "hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOrder(order.id)}
                            title={`Pilih ${order.ticket_number}`}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2 cursor-pointer transition-colors accent-blue-600"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <Link
                          href={`/orders/${order.id}/progress`}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 transition group/link"
                        >
                          <span>{order.ticket_number}</span>
                          <ExternalLink className="w-3 h-3 text-blue-500 opacity-60 group-hover/link:opacity-100" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-block ${badgeColor}`}>
                            {order.tipe_order || "Aktivasi Baru"}
                          </span>
                          <div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block border ${
                                order.kategori_layanan === "Enterprise"
                                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              }`}
                            >
                              {order.kategori_layanan === "Enterprise"
                                ? `Enterprise • ${order.sub_layanan || "Umum"}`
                                : "POP Site"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <Link
                          href={`/orders/${order.id}/progress`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-700 dark:hover:text-blue-400 block transition text-sm leading-snug"
                        >
                          {order.nama_perusahaan ? order.nama_perusahaan : order.nama_pic}
                        </Link>
                        {order.nama_perusahaan ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                            PIC: <span className="font-semibold text-slate-800 dark:text-slate-200">{order.nama_pic}</span>
                            {order.email_pic && <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal">({order.email_pic})</span>}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5" title={order.alamat_instalasi || ""}>
                          {order.alamat_instalasi || "Alamat: Sesuai Kontrak / Virtual"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold">
                        <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          {order.vlan !== undefined && order.vlan !== null ? order.vlan : "-"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs">
                          <span
                            className={`font-medium ${
                              order.infrastruktur?.toLowerCase().includes("metronexia")
                                ? "text-indigo-700 dark:text-indigo-400 font-bold"
                                : "text-slate-800 dark:text-slate-200 font-semibold"
                            }`}
                          >
                            {order.infrastruktur || order.media_koneksi || order.interkoneksi || order.tipe_layanan_collo || order.sub_layanan || "-"}
                          </span>
                          {order.sid && (
                            <span
                              className={`block text-[10px] font-mono font-bold ${
                                order.infrastruktur?.toLowerCase().includes("metronexia")
                                  ? "text-indigo-600 dark:text-indigo-400"
                                  : "text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              SID: {order.sid}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>
                            {new Date(order.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5 justify-end">
                          <Link
                            href={`/orders/${order.id}/progress`}
                            className="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/80 dark:border-blue-800 px-3 py-1.5 rounded-lg transition"
                          >
                            Buka Desk
                            <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          </Link>

                          {order.status !== "Cancelled" && order.status !== "Completed" && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(order)}
                              className="inline-flex items-center text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-800 px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                              title="Batalkan Tiket Ini"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" />
                              Batal
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
              totalItems={orders.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>
      )}

      {/* CANCEL TICKET MODAL */}
      {cancelModalOpen && orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Batalkan Tiket Antrean</h3>
                  <p className="text-xs text-rose-100 font-mono">
                    {orderToCancel.ticket_number} &bull; {orderToCancel.tipe_order || "Aktivasi Baru"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmCancel} className="p-6 space-y-4 text-xs">
              {cancelError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{cancelError}</span>
                </div>
              )}

              {cancelSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{cancelSuccessMessage}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-amber-600 dark:text-amber-400" />
                  Perhatian: Tindakan Ini Akan Membatalkan Tiket
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Tiket yang dibatalkan akan dihentikan dari antrean pengerjaan teknisi. Riwayat pembatalan akan dicatat ke dalam audit log sistem.
                </p>
              </div>

              {/* Ticket Info Card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Pelanggan / PIC:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {orderToCancel.nama_perusahaan ? `${orderToCancel.nama_perusahaan} (${orderToCancel.nama_pic})` : orderToCancel.nama_pic}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Layanan & Bandwidth:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {orderToCancel.layanan_dedicated || orderToCancel.kapasitas_layanan || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">VLAN ID:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {orderToCancel.vlan ?? "-"}
                  </span>
                </div>
              </div>

              {/* Input Alasan */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 dark:text-slate-200 font-bold">
                  Alasan Pembatalan Tiket <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelAlasan}
                  onChange={(e) => setCancelAlasan(e.target.value)}
                  placeholder="Contoh: Permintaan pembatalan dari pelanggan, duplikasi nomor tiket, salah pilih paket layanan..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Alasan ini akan disimpan atas nama akun <strong>{currentUser?.nama || "Staff"}</strong>.
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Kembali
                </button>

                <button
                  type="submit"
                  disabled={isCancelling || !cancelAlasan.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Ban className="w-4 h-4 mr-1.5" />
                  {isCancelling ? "Membatalkan Tiket..." : "Konfirmasi Batalkan Tiket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CANCEL TICKET MODAL */}
      {bulkCancelModalOpen && cancellableSelectedOrders.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Batalkan {cancellableSelectedOrders.length} Tiket Terpilih</h3>
                  <p className="text-xs text-rose-100">
                    Pembatalan massal tiket antrean
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBulkCancelModalOpen(false)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmBulkCancel} className="p-6 space-y-4 text-xs">
              {bulkCancelError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{bulkCancelError}</span>
                </div>
              )}

              {bulkCancelSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{bulkCancelSuccessMessage}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-amber-600 dark:text-amber-400" />
                  Perhatian: Tindakan Ini Akan Membatalkan {cancellableSelectedOrders.length} Tiket Sekaligus
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Semua tiket yang dipilih akan dihentikan dari antrean pengerjaan teknisi. Riwayat pembatalan akan dicatat ke dalam audit log sistem.
                </p>
              </div>

              {/* Daftar Tiket yang Akan Dibatalkan */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 dark:text-slate-200 font-bold">
                  Daftar Tiket ({cancellableSelectedOrders.length}):
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 max-h-32 overflow-y-auto flex flex-wrap gap-1.5">
                  {cancellableSelectedOrders.map((o) => (
                    <span
                      key={o.id}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {o.ticket_number}
                    </span>
                  ))}
                </div>
              </div>

              {/* Input Alasan */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 dark:text-slate-200 font-bold">
                  Alasan Pembatalan Bersama <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={bulkCancelAlasan}
                  onChange={(e) => setBulkCancelAlasan(e.target.value)}
                  placeholder="Masukkan alasan pembatalan untuk semua tiket terpilih..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Alasan ini akan disimpan atas nama akun <strong>{currentUser?.nama || "Staff"}</strong>.
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setBulkCancelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Kembali
                </button>

                <button
                  type="submit"
                  disabled={isBulkCancelling || !bulkCancelAlasan.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Ban className="w-4 h-4 mr-1.5" />
                  {isBulkCancelling ? "Membatalkan..." : `Batalkan ${cancellableSelectedOrders.length} Tiket`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
