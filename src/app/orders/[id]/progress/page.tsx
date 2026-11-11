"use client";

import { Rack3DPickerModal } from "@/components/dcim/Rack3DPickerModal";
import { Otb3DPickerModal } from "@/components/dcim/Otb3DPickerModal";
import {
  formatRackPositionLabel,
  parseCoreNumbersJson,
  getTiaColorForCore,
} from "@/lib/dcimUtils";
import {
  Box as DcimOrderBoxIcon,
  Cable as DcimOrderCableIcon,
} from "lucide-react";

import React, { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import { StatusBadge } from "@/components/StatusBadge";
import { LightboxModal } from "@/components/LightboxModal";
import {
  Server,
  ChevronRight,
  Copy,
  Check,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileCheck2,
  Clock,
  Send,
  Building,
  Phone,
  MapPin,
  Network,
  Cpu,
  Radio,
  Share2,
  Calendar,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Eye,
  FileText,
  Ban,
  X,
  AlertCircle,
} from "lucide-react";

interface OrderDetail {
  id: string;
  ticket_number: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_pic: string;
  kontak_pic: string;
  nama_perusahaan?: string | null;
  email_pic?: string | null;
  alamat_instalasi?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | null;
  layanan_dedicated?: string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sn_ont?: string | null;
  kapasitas_layanan?: string | null;
  interkoneksi?: string | null;
  port_media?: string | null;
  tipe_layanan_collo?: string | null;
  nama_perangkat?: string | null;
  sn_perangkat?: string | null;
  rack_id?: string | null;
  rack_code?: string | null;
  rack_unit_start?: number | null;
  rack_unit_end?: number | null;
  otb_id?: string | null;
  otb_code?: string | null;
  otb_core_numbers?: string | null;
  prefix_advertise?: string | null;
  as_number?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  waktu_aktivasi?: string | null;
  catatan_tambahan?: string | null;
  status: string;
  tipe_order?: string;
  pop_site_id?: string | null;
  created_at: string;
  completed_at?: string | null;
  creator?: {
    id: string;
    nama: string;
    email: string;
    role: string;
  };
  test_results: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    uploaded_at: string;
    uploader?: {
      id: string;
      nama: string;
      role: string;
    };
  }>;
  progress_logs: Array<{
    id: string;
    action_type: string;
    status_sebelum?: string | null;
    status_sesudah?: string | null;
    catatan_progress: string;
    created_at: string;
    user?: {
      id: string;
      nama: string;
      role: string;
    };
  }>;
}

export default function NocWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { currentUser } = useCurrentUser();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [configDispatchText, setConfigDispatchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copy feedback state
  const [copied, setCopied] = useState(false);

  // New progress log input
  const [progressInput, setProgressInput] = useState("");
  const [actionType, setActionType] = useState("Progress Note");
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Status transition state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [barrierError, setBarrierError] = useState<string | null>(null);

  // Lightbox Modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxTitle, setLightboxTitle] = useState("");
  const [lightboxSubtitle, setLightboxSubtitle] = useState("");

  // Cancel Ticket Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelAlasan, setCancelAlasan] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchOrderDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat detail tiket.");
      }
      setOrder(data.data);
      setConfigDispatchText(data.config_dispatch_text || "");
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  // DCIM 3D Inspect Modals
  const [inspectRackOpen, setInspectRackOpen] = useState(false);
  const [inspectOtbOpen, setInspectOtbOpen] = useState(false);

  // Quick Copy Config Handler
  const handleCopyConfig = () => {
    if (!configDispatchText) return;
    navigator.clipboard.writeText(configDispatchText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Quick Template Tags for NOC
  const handleApplyTemplate = (text: string) => {
    setProgressInput((prev) => (prev ? `${prev} - ${text}` : text));
  };

  // Submit Progress Log
  const handleSendProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressInput.trim() || !order) return;

    setIsSubmittingLog(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catatan_progress: progressInput.trim(),
          action_type: actionType,
          user_id: currentUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan log.");
      }

      setProgressInput("");
      fetchOrderDetail();
    } catch (err: any) {
      alert(err.message || "Gagal mengirim log");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Quick Action: "Ambil Tiket / Start Processing"
  const handleStartProcessing = async () => {
    if (!order) return;
    setIsUpdatingStatus(true);
    setBarrierError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "In Progress",
          user_id: currentUser.id,
          note: `Tiket diambil oleh ${currentUser.nama}. Status otomatis berubah ke 'In Progress'. Memulai konfigurasi provisioning.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengambil tiket.");
      }

      fetchOrderDetail();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Quick Action: "Selesaikan Aktivasi (Complete)"
  const handleCompleteOrder = async () => {
    if (!order) return;
    setBarrierError(null);

    // Frontend validation barrier
    if (order.test_results.length === 0) {
      setBarrierError(
        "Aturan Penyelesaian Aktivasi (Completion Barrier): Status HANYA bisa diubah menjadi 'Completed' jika minimal 1 (satu) file hasil test valid telah diunggah."
      );
      return;
    }

    if (!confirm(`Konfirmasi Go-Live untuk tiket ${order.ticket_number}?`)) return;

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          user_id: currentUser.id,
          note: `Aktivasi layanan selesai dan diverifikasi oleh ${currentUser.nama}. Layanan berstatus Completed (Go-Live).`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyelesaikan aktivasi.");
      }

      fetchOrderDetail();
    } catch (err: any) {
      setBarrierError(err.message || "Gagal mengubah status ke Completed");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // File Upload Handler (Dropzone & Input)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !order) return;

    setIsUploading(true);
    setBarrierError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("uploader_id", currentUser.id);

        const res = await fetch(`/api/orders/${order.id}/test-results`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Gagal mengunggah file ${file.name}`);
        }
      }

      fetchOrderDetail();
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah file hasil test");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!cancelAlasan.trim()) {
      setCancelError("Alasan pembatalan tiket wajib diisi.");
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
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

      setCancelModalOpen(false);
      fetchOrderDetail();
    } catch (err: any) {
      setCancelError(err.message || "Terjadi kesalahan saat membatalkan tiket.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 font-medium">Memuat NOC Desk Workspace...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 max-w-xl mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-600" />
        <h2 className="text-lg font-bold">Tiket Tidak Ditemukan</h2>
        <p className="text-xs">{error || "Data order tidak tersedia di database."}</p>
        <Link
          href="/queue"
          className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
        >
          Kembali ke Board Antrean
        </Link>
      </div>
    );
  }

  const isTelkom = order.media_koneksi?.toLowerCase().includes("telkom");
  const isMetronexia = order.infrastruktur?.toLowerCase().includes("metronexia") || order.media_koneksi?.toLowerCase().includes("metronexia");
  const hasTestResults = order.test_results.length > 0;
  const isAlreadyCompleted = order.status === "Completed";
  const isCancelled = order.status === "Cancelled";
  const canStartTicket = !isCancelled && !isAlreadyCompleted && (order.status === "Antrian Aktivasi" || order.status === "Pending Issue");

  let kontakArr: string[] = [];
  try {
    kontakArr = JSON.parse(order.kontak_pic);
  } catch {
    kontakArr = [order.kontak_pic];
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxImage}
        title={lightboxTitle}
        subtitle={lightboxSubtitle}
      />

      {/* Breadcrumb & Workspace Header */}
      <div>
        <nav className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <Link href="/queue" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">
            Board Antrean
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-slate-700 dark:text-slate-200 font-semibold">{order.ticket_number}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-blue-600 dark:text-blue-400 font-bold">NOC Desk Workspace</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                {order.ticket_number}
              </span>
              <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border ${
                order.kategori_layanan === "Enterprise"
                  ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              }`}>
                {order.kategori_layanan || "POP Site"}{order.sub_layanan ? ` • ${order.sub_layanan}` : ""}
              </span>
              {order.tipe_order && (
                <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {order.tipe_order}
                </span>
              )}
              <StatusBadge status={order.status} size="md" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
              {order.nama_perusahaan ? `${order.nama_perusahaan} (PIC: ${order.nama_pic})` : order.nama_pic}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Layanan: <span className="font-semibold text-slate-700 dark:text-slate-200">{order.layanan_dedicated || "-"}</span>
              {order.media_koneksi && (
                <> &bull; Media: <span className="font-semibold text-slate-700 dark:text-slate-200">{order.media_koneksi}</span></>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAlreadyCompleted && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  setCancelAlasan("");
                  setCancelError(null);
                  setCancelModalOpen(true);
                }}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 cursor-pointer"
                title="Batalkan tiket kerja ini"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
                Batalkan Tiket
              </button>
            )}

            <button
              onClick={handleCopyConfig}
              className={`inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${
                copied
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title="Copy format WhatsApp/Telegram"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-white" />
                  Format Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Config Format
                </>
              )}
            </button>

            <button
              onClick={() => fetchOrderDetail()}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start space-x-3">
          <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-950 dark:text-rose-100 text-base">TIKET TELAH DIBATALKAN (CANCELLED)</p>
            <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
              Tiket ini telah dibatalkan dari antrean kerja. Seluruh aktivitas konfigurasi dan provisioning dihentikan. Riwayat pembatalan tercatat pada chronological timeline log.
            </p>
          </div>
        </div>
      )}

      {/* Completion Barrier Warning Banner */}
      {barrierError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start space-x-3 animate-shake">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-rose-950 dark:text-rose-100">PERINGATAN COMPLETION BARRIER:</p>
            <p className="text-xs text-rose-800 dark:text-rose-200 mt-0.5">{barrierError}</p>
          </div>
        </div>
      )}

      {/* SPLIT-VIEW WORKSPACE: Left Technical Specs Sticky + Right NOC Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* PANEL KIRI (Spesifikasi Teknis POP Site / Enterprise - Sticky) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center">
                <Server className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                Spesifikasi Teknis {order.kategori_layanan === "Enterprise" ? `Enterprise (${order.sub_layanan})` : "POP Site"}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                Read-Only Specs
              </span>
            </div>

            {/* Customer & Location */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Pelanggan & Lokasi
              </span>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                {order.nama_perusahaan && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Perusahaan:</span>
                    <span className="font-bold text-slate-900">{order.nama_perusahaan}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 text-[11px] block">Nama PIC:</span>
                  <span className="font-semibold text-slate-800">{order.nama_pic}</span>
                </div>
                {order.email_pic && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Email PIC:</span>
                    <span className="font-medium text-slate-700">{order.email_pic}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 text-[11px] block">Kontak PIC / WhatsApp:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {kontakArr.map((k, idx) => (
                      <a
                        key={idx}
                        href={`https://wa.me/${k.replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md font-mono text-xs font-semibold"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        {k}
                      </a>
                    ))}
                  </div>
                </div>
                {order.alamat_instalasi && (
                  <div>
                    <span className="text-slate-400 text-[11px] block">Alamat / Lokasi:</span>
                    <span className="text-slate-700 font-medium leading-relaxed">{order.alamat_instalasi}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Technical Specs based on Service Category */}
            {order.kategori_layanan === "Enterprise" ? (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Parameter Teknis Layanan ({order.sub_layanan})
                </span>

                {order.sub_layanan === "LocalLoop" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Layanan LocalLoop</span>
                      <span className="font-bold text-slate-800">{order.layanan_dedicated}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Kapasitas Layanan</span>
                      <span className="font-bold text-emerald-700">{order.kapasitas_layanan || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Interkoneksi</span>
                      <span className="font-medium text-slate-800">{order.interkoneksi || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Infrastruktur</span>
                      <span className="font-semibold text-slate-800">{order.infrastruktur || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Media Koneksi</span>
                      <span className="font-semibold text-slate-800">{order.media_koneksi || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Port Interkoneksi</span>
                      <span className="font-mono text-slate-800">{order.port_media || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">SN ONT</span>
                      <span className="font-mono text-slate-800">{order.sn_ont || "-"}</span>
                    </div>
                  </div>
                )}

                {order.sub_layanan === "Collocation Rack" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Tipe Layanan Collocation</span>
                      <span className="font-bold text-blue-700">{order.tipe_layanan_collo || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Nama Perangkat</span>
                      <span className="font-semibold text-slate-800">{order.nama_perangkat || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Serial Number (SN)</span>
                      <span className="font-mono font-bold text-slate-900">{order.sn_perangkat || "-"}</span>
                    </div>
                    {order.rack_id && (
                      <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 col-span-2 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-blue-600 font-bold block">
                            Alokasi Rack 3D
                          </span>
                          <span className="font-mono font-extrabold text-blue-900">
                            {formatRackPositionLabel(
                              order.rack_code,
                              order.rack_unit_start,
                              order.rack_unit_end
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectRackOpen(true)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                        >
                          <DcimOrderBoxIcon className="w-3.5 h-3.5" /> Lihat di Rack 3D
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {order.sub_layanan === "Dark Fiber" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Layanan Dark Fiber</span>
                      <span className="font-bold text-purple-700">{order.layanan_dedicated || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Server / Point of Presence Hub</span>
                      <span className="font-semibold text-slate-800">{order.server || "-"}</span>
                    </div>
                    {order.otb_id && (
                      <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 col-span-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-purple-600 font-bold block">
                              Alokasi Core OTB 3D
                            </span>
                            <span className="font-mono font-extrabold text-purple-900">
                              {order.otb_code || "OTB"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInspectOtbOpen(true)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                          >
                            <DcimOrderCableIcon className="w-3.5 h-3.5" /> Lihat di OTB 3D
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {parseCoreNumbersJson(order.otb_core_numbers).map((cNum) => {
                            const tia = getTiaColorForCore(cNum);
                            return (
                              <span
                                key={cNum}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-purple-200 text-[10px] font-mono font-bold text-slate-800"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: tia.hex }}
                                />
                                #{cNum} ({tia.labelId})
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {order.sub_layanan === "Content" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">VLAN ID</span>
                      <span className="font-mono font-black text-amber-700">{order.vlan ?? "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">IP Private P2P</span>
                      <span className="font-mono font-semibold text-slate-800">{order.ip_private || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">AS Number</span>
                      <span className="font-mono font-bold text-slate-900">{order.as_number || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Prefix Advertise</span>
                      <div className="font-mono text-[11px] text-slate-800 break-all">
                        {(() => {
                          try {
                            const p = JSON.parse(order.prefix_advertise || "[]");
                            return Array.isArray(p) ? p.join(", ") : order.prefix_advertise;
                          } catch {
                            return order.prefix_advertise || "-";
                          }
                        })()}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Layanan Content & Peering</span>
                      <span className="font-semibold text-slate-800">{order.layanan_dedicated || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Interkoneksi</span>
                      <span className="font-medium text-slate-800">{order.interkoneksi || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Media Koneksi</span>
                      <span className="font-medium text-slate-800">{order.media_koneksi || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Core Peering Router</span>
                      <span className="font-medium text-slate-800">{order.server || "-"}</span>
                    </div>
                  </div>
                )}

                {order.sub_layanan === "Enterprise Dedicated" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">Layanan Dedicated</span>
                      <span className="font-bold text-slate-800 text-sm">{order.layanan_dedicated || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">VLAN ID</span>
                      <span className="font-mono font-black text-blue-700 text-sm">{order.vlan ?? "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Infrastruktur</span>
                      <span className="font-semibold text-slate-800">{order.infrastruktur || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Media Koneksi</span>
                      <span className="font-semibold text-slate-800">{order.media_koneksi || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">Server / BRAS Aggregator</span>
                      <span className="font-medium text-slate-800">{order.server || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">IP Public</span>
                      <span className="font-mono text-slate-800 font-semibold">{order.ip_public || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block">IP Private</span>
                      <span className="font-mono text-slate-800 font-semibold">{order.ip_private || "-"}</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold block">SN ONT / Modem CPE</span>
                      <span className="font-mono text-slate-800 font-semibold">{order.sn_ont || "-"}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Standard POP Site Specs */
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Parameter Routing & Transmisi POP Site
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">VLAN ID</span>
                    <span className="font-mono font-black text-blue-700 text-sm">{order.vlan}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Infrastruktur</span>
                    <span className="font-semibold text-slate-800">{order.infrastruktur}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold block">Media Koneksi</span>
                    <span className="font-semibold text-slate-800">{order.media_koneksi}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">IP Public</span>
                    <span className="font-mono text-slate-800 font-semibold">{order.ip_public || "-"}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">IP Private</span>
                    <span className="font-mono text-slate-800 font-semibold">{order.ip_private || "-"}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold block">Server / BRAS Aggregator</span>
                    <span className="font-medium text-slate-800">{order.server}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold block">SN ONT / Modem</span>
                    <span className="font-mono text-slate-800 font-semibold">{order.sn_ont || "-"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Conditional Metronexia Specs */}
            {isMetronexia && order.sid && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/90 space-y-2 text-xs">
                <div className="flex items-center space-x-1.5 text-indigo-900 font-bold">
                  <Network className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Metronexia Circuit Data</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-indigo-950 font-mono">
                  <p><span className="text-indigo-800 font-sans">SID:</span> <span className="font-bold">{order.sid || "-"}</span></p>
                  <p><span className="text-indigo-800 font-sans">AO:</span> <span className="font-bold">{order.ao || "-"}</span></p>
                  <p><span className="text-indigo-800 font-sans">No. Order:</span> <span className="font-bold">{order.nomor_order || "-"}</span></p>
                </div>
              </div>
            )}

            {/* Conditional Metro Telkom Specs */}
            {!isMetronexia && isTelkom && order.sid && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2 text-xs">
                <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                  <Radio className="w-3.5 h-3.5 text-amber-700" />
                  <span>Metro Telkom Circuit Data</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-amber-950 font-mono">
                  <p><span className="text-amber-800 font-sans">SID:</span> <span className="font-bold">{order.sid || "-"}</span></p>
                  <p><span className="text-amber-800 font-sans">AO:</span> <span className="font-bold">{order.ao || "-"}</span></p>
                  <p><span className="text-amber-800 font-sans">No. Order:</span> <span className="font-bold">{order.nomor_order || "-"}</span></p>
                </div>
              </div>
            )}

            {/* Waktu Aktivasi & Catatan */}
            <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Waktu Aktivasi (Report Uji Selesai)
              </span>
              {order.waktu_aktivasi ? (
                <p className="text-emerald-700 font-semibold flex items-center bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                  Aktif: {new Date(order.waktu_aktivasi).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })} WIB
                </p>
              ) : (
                <p className="text-amber-700 font-medium flex items-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 shrink-0" />
                  Menunggu upload hasil uji selesai
                </p>
              )}
              {order.catatan_tambahan && (
                <p className="text-slate-600 text-[11px] pt-1 italic">
                  &ldquo;{order.catatan_tambahan}&rdquo;
                </p>
              )}
            </div>

            {/* Copy Config Quick Action Button */}
            <button
              type="button"
              onClick={handleCopyConfig}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center justify-center transition shadow-sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Format WhatsApp Tersalin!" : "Copy Format Grup Koordinasi"}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL KANAN (NOC Progress Feed, Test Uploads & Completion) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Status Trigger: "Ambil Tiket / Start Processing" */}
          {canStartTicket && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-[10px] font-bold uppercase tracking-wider">
                  NOC Assignment
                </span>
                <h3 className="text-base font-bold mt-1">Tiket Tersedia untuk Dikerjakan</h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Klik tombol untuk mengambil tiket dan otomatis memulai provisioning atas nama Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={isUpdatingStatus}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 font-black text-xs shadow-md transition disabled:opacity-50 shrink-0 hover:scale-105"
              >
                {isUpdatingStatus ? "Mengambil Tiket..." : "Ambil Tiket / Start Processing"}
              </button>
            </div>
          )}

          {/* Chronological Timeline Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                  Chronological Timeline Log
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Riwayat aktivitas berkala immutable (append-only) dari tim NOC dan sistem.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                {order.progress_logs.length} Entri Audit
              </span>
            </div>

            {/* Timeline Stream */}
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {order.progress_logs.map((log) => {
                let badgeColor = "bg-blue-100 text-blue-800";
                if (log.action_type === "Config Pushed") badgeColor = "bg-purple-100 text-purple-800";
                if (log.action_type === "Test Uploaded") badgeColor = "bg-emerald-100 text-emerald-800";
                if (log.action_type === "Status Change") badgeColor = "bg-amber-100 text-amber-800";
                if (log.action_type === "Cancel Ticket") badgeColor = "bg-rose-100 text-rose-800";

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm ring-2 ring-blue-100" />

                    <div className="bg-slate-50 group-hover:bg-blue-50/40 p-4 rounded-xl border border-slate-200/80 transition">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">
                            {log.user?.nama || "NOC Engineer"}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-medium">
                            ({log.user?.role || "noc"})
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {log.action_type}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(log.created_at).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })} WIB
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-normal">
                        {log.catatan_progress}
                      </p>

                      {log.status_sesudah && log.status_sebelum !== log.status_sesudah && (
                        <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center space-x-1.5">
                          <span>Status:</span>
                          <span className="line-through text-slate-400">{log.status_sebelum || "Baru"}</span>
                          <span>&rarr;</span>
                          <span className="text-blue-700">{log.status_sesudah}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New Update Input Area */}
            {isCancelled ? (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400">
                Pembaruan log progres dinonaktifkan karena tiket ini telah dibatalkan (Cancelled).
              </div>
            ) : (
              <form onSubmit={handleSendProgress} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center">
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                    Kirim Log Progres NOC
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Tipe:</span>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                    >
                      <option value="Progress Note">Progress Note</option>
                      <option value="Config Pushed">Config Pushed</option>
                      <option value="Status Change">Status Change</option>
                    </select>
                  </div>
                </div>

                {/* Quick Template Tag Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "VLAN Binding Port OK",
                    "OPM Redaman Normal (-18dBm)",
                    "BGP Peer Established",
                    "Ping & Latency Stabil < 5ms",
                    "Testing with Customer OK",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleApplyTemplate(chip)}
                      className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg transition"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    required
                    rows={3}
                    value={progressInput}
                    onChange={(e) => setProgressInput(e.target.value)}
                    placeholder="Masukkan catatan teknis aktivitas (contoh: VLAN 1420 di-binding ke port GE0/0/2, ONT redaman -18 dBm, stabil)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingLog || !progressInput.trim()}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {isSubmittingLog ? "Mengirim..." : "Kirim Update Log"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Section Hasil Test (Dropzone & Lightbox Modal) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                  <FileCheck2 className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                  Section Hasil Test (Dokumentasi / Speedtest)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wajib ada minimal 1 file (Speedtest, foto OPM, latency ping, rack) untuk membuka tombol Selesai.
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  hasTestResults
                    ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                }`}
              >
                {hasTestResults ? "Syarat Completion Terpenuhi" : "Belum Ada File (Barrier Aktif)"}
              </span>
            </div>

            {/* Drag & Drop Dropzone */}
            {isCancelled ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-500 dark:text-slate-400">
                Upload hasil test dinonaktifkan karena tiket telah dibatalkan (Cancelled).
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition ${
                  dragOver
                    ? "border-blue-500 bg-blue-50/60"
                    : "border-slate-300 hover:border-blue-400 bg-slate-50/50"
                }`}
              >
                <UploadCloud className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  Drag and drop file hasil uji di sini, atau klik untuk memilih file
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format didukung: PNG, JPG, JPEG, PDF (Speedtest, OPM Power Meter, Ping Latency, ONT)
                </p>

                <label className="mt-3 inline-block">
                  <span className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-sm cursor-pointer transition">
                    {isUploading ? "Mengunggah..." : "Pilih File dari Perangkat"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Test Results Thumbnails Grid */}
            {order.test_results.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-700">
                  File Terlampir ({order.test_results.length}):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {order.test_results.map((test) => {
                    const isPdf = test.file_type.includes("pdf") || test.file_url.endsWith(".pdf");
                    return (
                      <div
                        key={test.id}
                        onClick={() => {
                          setLightboxImage(test.file_url);
                          setLightboxTitle(test.file_name);
                          setLightboxSubtitle(`Diupload oleh: ${test.uploader?.nama || "NOC"}`);
                          setLightboxOpen(true);
                        }}
                        className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition aspect-video flex items-center justify-center"
                      >
                        {isPdf ? (
                          <div className="p-3 text-center text-white">
                            <FileText className="w-8 h-8 mx-auto text-rose-400 mb-1" />
                            <span className="text-[10px] font-mono line-clamp-1">{test.file_name}</span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={test.file_url}
                            alt={test.file_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        )}

                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2 text-white">
                          <p className="text-[10px] font-bold line-clamp-1">{test.file_name}</p>
                          <span className="text-[9px] text-blue-300 flex items-center">
                            <Eye className="w-3 h-3 mr-1" /> Klik untuk perbesar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FINAL ACTION BUTTON: Selesaikan Aktivasi (Complete) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                  <ShieldCheck className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Finalisasi & Go-Live Layanan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Menyatakan aktivasi selesai dan link siap digunakan pelanggan.
                </p>
              </div>

              {isAlreadyCompleted ? (
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Layanan Sudah Go-Live
                  </span>
                  <Link
                    href={order.kategori_layanan === "Enterprise" ? "/enterprise" : "/pop-sites"}
                    className={`px-3 py-1 rounded-full text-white text-xs font-bold transition flex items-center shadow-xs ${
                      order.kategori_layanan === "Enterprise"
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    Buka {order.kategori_layanan === "Enterprise" ? "List Enterprise" : "List POP Site"} &rarr;
                  </Link>
                </div>
              ) : isCancelled ? (
                <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 text-xs font-bold border border-rose-300 dark:border-rose-800 flex items-center">
                  <Ban className="w-3.5 h-3.5 mr-1" />
                  Tiket Dibatalkan
                </span>
              ) : null}
            </div>

            {!hasTestResults && !isAlreadyCompleted && !isCancelled && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Tombol &apos;Selesaikan Aktivasi&apos; dinonaktifkan sementara sampai tim NOC mengunggah minimal 1 dokumen hasil test.
                </span>
              </div>
            )}

            {!isAlreadyCompleted && !isCancelled && (
              <button
                type="button"
                onClick={handleCompleteOrder}
                disabled={!hasTestResults || isUpdatingStatus}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-sm flex items-center justify-center transition shadow-lg ${
                  hasTestResults && !isUpdatingStatus
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 cursor-pointer hover:scale-[1.01]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {isUpdatingStatus ? "Menyelesaikan Aktivasi..." : "Selesaikan Aktivasi (Complete & Go-Live)"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CANCEL TICKET MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Batalkan Tiket Ini</h3>
                  <p className="text-xs text-rose-100 font-mono">
                    {order.ticket_number} &bull; {order.tipe_order || "Aktivasi Baru"}
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

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-amber-600 dark:text-amber-400" />
                  Peringatan Pembatalan Tiket
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Setelah dibatalkan, tiket ini tidak dapat diproses lagi oleh tim NOC. Alasan pembatalan akan dicatat ke dalam audit trail log secara permanen.
                </p>
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
                  placeholder="Contoh: Permintaan pembatalan dari pelanggan, duplikasi order, salah input paket..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Alasan pembatalan akan dicatat atas nama akun <strong>{currentUser?.nama || "Staff"}</strong>.
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

      {/* Inspect Rack 3D & OTB 3D Modals */}
      <Rack3DPickerModal
        isOpen={inspectRackOpen}
        onClose={() => setInspectRackOpen(false)}
        mode="inspect"
        initialRackId={order.rack_id || null}
        initialStartU={order.rack_unit_start || null}
        initialEndU={order.rack_unit_end || null}
      />

      <Otb3DPickerModal
        isOpen={inspectOtbOpen}
        onClose={() => setInspectOtbOpen(false)}
        mode="inspect"
        initialOtbId={order.otb_id || null}
        initialSelectedCores={parseCoreNumbersJson(order.otb_core_numbers)}
      />
    </div>
  );
}

