"use client";

import React, { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import { StatusBadge } from "@/components/StatusBadge";
import { LightboxModal } from "@/components/LightboxModal";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  generateNocCoordinationText,
  DEDICATED_SERVICE_OPTIONS,
  getUpgradeOptions,
  getDowngradeOptions,
  parseBandwidthToMbps,
} from "@/lib/ticketUtils";
import {
  Building2,
  ChevronRight,
  Server,
  Network,
  Phone,
  MapPin,
  Calendar,
  Clock,
  History,
  FileCheck2,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  PowerOff,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Radio,
  CheckCircle2,
  UserCheck,
  Eye,
  FileText,
  ArrowRight,
  Sparkles,
  Layers,
  Globe,
  HardDrive,
  Cpu,
} from "lucide-react";

interface TestItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

interface ProgressLogItem {
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
  server?: string | null;
  media_koneksi?: string | null;
  catatan_tambahan?: string | null;
  waktu_aktivasi?: string | null;
  completed_at?: string | null;
  created_at: string;
  test_results: TestItem[];
  progress_logs: ProgressLogItem[];
  creator?: {
    nama: string;
    role: string;
  };
}

interface PopSiteDetail {
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
  orders: OrderHistoryItem[];
}

export default function PopSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { currentUser } = useCurrentUser();

  const [site, setSite] = useState<PopSiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History classification tab on the right
  const [historyTab, setHistoryTab] = useState("Semua");

  // Copy feedback
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedSiteId, setCopiedSiteId] = useState(false);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxTitle, setLightboxTitle] = useState("");

  // Action Modal State
  const [actionType, setActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | null>(null);
  const [newLayanan, setNewLayanan] = useState("");
  const [newVlan, setNewVlan] = useState("");
  const [actionAlasan, setActionAlasan] = useState("");
  const [actionCatatan, setActionCatatan] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const fetchSiteDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/pop-sites/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat detail POP Site.");
      }

      setSite(data.data);
      if (data.data) {
        setNewLayanan(data.data.layanan_dedicated || data.data.kapasitas_layanan || "");
        setNewVlan(data.data.vlan !== undefined && data.data.vlan !== null ? String(data.data.vlan) : "");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSiteDetail();
  }, [fetchSiteDetail]);

  const handleCopyCoordination = () => {
    if (!site) return;
    const text = generateNocCoordinationText({
      ticket_number: site.site_id,
      kategori_layanan: site.kategori_layanan || "POP Site",
      sub_layanan: site.sub_layanan,
      nama_perusahaan: site.nama_perusahaan,
      email_pic: site.email_pic,
      nama_pic: site.nama_pic,
      kontak_pic: site.kontak_pic,
      alamat_instalasi: site.alamat_instalasi,
      ip_public: site.ip_public,
      ip_private: site.ip_private,
      vlan: site.vlan,
      layanan_dedicated: site.layanan_dedicated,
      kapasitas_layanan: site.kapasitas_layanan,
      interkoneksi: site.interkoneksi,
      port_media: site.port_media,
      tipe_layanan_collo: site.tipe_layanan_collo,
      nama_perangkat: site.nama_perangkat,
      sn_perangkat: site.sn_perangkat,
      prefix_advertise: site.prefix_advertise,
      as_number: site.as_number,
      server: site.server,
      infrastruktur: site.infrastruktur,
      media_koneksi: site.media_koneksi,
      sn_ont: site.sn_ont,
      sid: site.sid,
      ao: site.ao,
      nomor_order: site.nomor_order,
      waktu_aktivasi: site.waktu_go_live,
      status: `Active (${site.status_layanan})`,
    });

    navigator.clipboard.writeText(text);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const availableLayananOptions = useMemo(() => {
    if (!site) return [];
    const currentLayanan = site.layanan_dedicated || site.kapasitas_layanan || "";
    if (actionType === "Upgrade") {
      return getUpgradeOptions(currentLayanan);
    }
    if (actionType === "Downgrade") {
      return getDowngradeOptions(currentLayanan);
    }
    return DEDICATED_SERVICE_OPTIONS;
  }, [site, actionType]);

  const openActionModal = (type: "Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate") => {
    if (!site) return;
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
    if (!site || !actionType) return;

    if (actionType === "Upgrade" || actionType === "Downgrade") {
      if (!newLayanan) {
        alert("Silakan pilih layanan & bandwidth baru.");
        return;
      }
      const currentMbps = parseBandwidthToMbps(site.layanan_dedicated || site.kapasitas_layanan);
      const targetMbps = parseBandwidthToMbps(newLayanan);

      if (actionType === "Upgrade" && currentMbps > 0 && targetMbps <= currentMbps) {
        alert(`Untuk Upgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih tinggi dari layanan saat ini (${site.layanan_dedicated || "-"}).`);
        return;
      }
      if (actionType === "Downgrade" && currentMbps > 0 && targetMbps >= currentMbps) {
        alert(`Untuk Downgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih rendah dari layanan saat ini (${site.layanan_dedicated || "-"}).`);
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

      const res = await fetch(`/api/pop-sites/${site.id}/actions`, {
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
      fetchSiteDetail();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
        <p className="mt-3 text-sm text-slate-500 font-medium">Memuat data administrasi & riwayat POP Site...</p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="p-8 max-w-xl mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-600" />
        <h2 className="text-lg font-bold">POP Site Tidak Ditemukan</h2>
        <p className="text-xs">{error || "Data POP Site tidak tersedia di database."}</p>
        <Link
          href="/pop-sites"
          className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          &larr; Kembali ke List POP Site
        </Link>
      </div>
    );
  }

  const isMetronexia = Boolean(
    site.infrastruktur?.toLowerCase().includes("metronexia") ||
    site.media_koneksi?.toLowerCase().includes("metronexia")
  );
  const isTelkom = Boolean(
    site.infrastruktur?.toLowerCase().includes("telkom") ||
    site.media_koneksi?.toLowerCase().includes("telkom")
  );
  const hasCircuitParams = Boolean(
    site.sid || site.ao || site.nomor_order || isMetronexia || isTelkom
  );

  const initialOrder = site.orders.find(
    (ord) =>
      ord.ticket_number === site.initial_ticket ||
      ord.tipe_order === "Aktivasi Baru"
  ) || site.orders[site.orders.length - 1];

  let kontakArr: string[] = [];
  try {
    kontakArr = JSON.parse(site.kontak_pic);
  } catch {
    kontakArr = [site.kontak_pic];
  }

  // Filter history items by tab
  const filteredHistory = site.orders.filter((ord) => {
    if (historyTab === "Semua") return true;
    if (historyTab === "Aktivasi") return ord.tipe_order === "Aktivasi Baru";
    return ord.tipe_order === historyTab;
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxImage}
        title={lightboxTitle}
      />

      {/* Breadcrumb & Navigation */}
      <div>
        <nav className="flex items-center space-x-2 text-xs text-slate-500 mb-2">
          <Link href="/queue" className="hover:text-blue-600 font-medium">
            Board Antrean
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/pop-sites" className="hover:text-emerald-600 font-medium">
            List POP Site
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-bold font-mono">{site.site_id}</span>
        </nav>

        {/* Master Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <span className="font-mono text-xl font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                {site.site_id}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  site.status_layanan === "Active"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : site.status_layanan === "Isolir"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}
              >
                ● Layanan {site.status_layanan}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                  site.kategori_layanan === "Enterprise"
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {site.kategori_layanan === "Enterprise"
                  ? `Enterprise • ${site.sub_layanan || "Umum"}`
                  : "POP Site"}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Ref Tiket Aktivasi: <strong>{site.initial_ticket}</strong>
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {site.nama_perusahaan ? site.nama_perusahaan : site.nama_pic}
            </h1>
            {site.nama_perusahaan ? (
              <p className="text-xs text-slate-600 font-medium">
                Nama PIC: <strong className="text-slate-900">{site.nama_pic}</strong>
                {site.email_pic && <span className="text-slate-400 ml-1">({site.email_pic})</span>}
              </p>
            ) : null}
            <p className="text-xs text-slate-500 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Go-Live Sejak: {new Date(site.waktu_go_live).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          </div>

          {/* Trigger Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyCoordination}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition shadow-xs"
            >
              {copiedConfig ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Data Sirkuit
                </>
              )}
            </button>

            {site.status_layanan === "Isolir" && (
              <button
                onClick={() => openActionModal("Unisolir")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition shadow-xs flex items-center animate-pulse"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Unisolir (Buka Isolir)
              </button>
            )}

            <button
              onClick={() => openActionModal("Upgrade")}
              disabled={site.status_layanan === "Terminated" || site.status_layanan === "Isolir"}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition shadow-xs flex items-center"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Upgrade
            </button>

            <button
              onClick={() => openActionModal("Downgrade")}
              disabled={site.status_layanan === "Terminated" || site.status_layanan === "Isolir"}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition shadow-xs flex items-center"
            >
              <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
              Downgrade
            </button>

            <button
              onClick={() => openActionModal("Isolir")}
              disabled={site.status_layanan === "Terminated" || site.status_layanan === "Isolir"}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white transition shadow-xs flex items-center"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
              Isolir
            </button>

            <button
              onClick={() => openActionModal("Terminate")}
              disabled={site.status_layanan === "Terminated"}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white transition shadow-xs flex items-center"
            >
              <PowerOff className="w-3.5 h-3.5 mr-1.5" />
              Terminate
            </button>
          </div>
        </div>
      </div>

      {/* SPLIT-VIEW: DATA ADMINISTRASI DI KIRI, SEMUA HISTORY DI KANAN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* SISI KIRI: DATA-DATA ADMINISTRASI SEPERTI KETIKA DI AKTIVASI */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center">
                <Building2 className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                Data Administrasi & Sirkuit
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                Active Master Asset
              </span>
            </div>

            {/* Section 1: Data PIC & Lokasi */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                1. Data Pelanggan & Kontak PIC
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Perusahaan / Entitas:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {site.nama_perusahaan ? site.nama_perusahaan : <span className="text-slate-400 dark:text-slate-400 font-normal italic">- (Perorangan)</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Nama PIC:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{site.nama_pic || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Email PIC:</span>
                  {site.email_pic ? (
                    <a
                      href={`mailto:${site.email_pic}`}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                    >
                      {site.email_pic}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-400 italic">-</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Kontak PIC / WhatsApp:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {kontakArr.length > 0 ? (
                      kontakArr.map((k, idx) => (
                        <a
                          key={idx}
                          href={`https://wa.me/${k.replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-md font-mono text-xs font-semibold transition"
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          {k}
                        </a>
                      ))
                    ) : (
                      <span className="text-slate-400 dark:text-slate-400 italic">-</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Alamat Fisik Instalasi:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed block mt-0.5">
                    {site.alamat_instalasi || <span className="text-slate-400 dark:text-slate-400 italic">-</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Technical Specifications */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                2. Spesifikasi Teknis Layanan
              </span>

              {site.kategori_layanan === "Enterprise" && site.sub_layanan === "LocalLoop" ? (
                /* Enterprise LocalLoop */
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Layanan LocalLoop</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.layanan_dedicated || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Kapasitas Layanan</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.kapasitas_layanan || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Interkoneksi</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.interkoneksi || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Port Interkoneksi</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.port_media || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">SN ONT</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{site.sn_ont || "-"}</span>
                  </div>
                </div>
              ) : site.kategori_layanan === "Enterprise" && site.sub_layanan === "Collocation Rack" ? (
                /* Enterprise Collocation Rack */
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Tipe Layanan Collocation</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.tipe_layanan_collo || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Nama Perangkat</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.nama_perangkat || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Serial Number (SN)</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{site.sn_perangkat || "-"}</span>
                  </div>
                </div>
              ) : site.kategori_layanan === "Enterprise" && site.sub_layanan === "Dark Fiber" ? (
                /* Enterprise Dark Fiber */
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Layanan Dark Fiber</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.layanan_dedicated || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Server / Rute Core</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{site.server || "-"}</span>
                  </div>
                </div>
              ) : site.kategori_layanan === "Enterprise" && site.sub_layanan === "Content" ? (
                /* Enterprise Content */
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Layanan Content</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.layanan_dedicated || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">VLAN</span>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-base">{site.vlan || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">AS Number</span>
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{site.as_number || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">IP Private</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{site.ip_private || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Interkoneksi</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.interkoneksi || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Server</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{site.server || "-"}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Media Koneksi</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.media_koneksi || "-"}</span>
                  </div>
                  {site.prefix_advertise && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Prefix Advertise</span>
                      <div className="flex flex-wrap gap-1 mt-1 font-mono text-[11px]">
                        {(() => {
                          try {
                            const p = JSON.parse(site.prefix_advertise);
                            return Array.isArray(p) ? p.map((pref, idx) => (
                              <span key={idx} className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded">
                                {pref}
                              </span>
                            )) : site.prefix_advertise;
                          } catch {
                            return <span className="text-slate-700 dark:text-slate-300">{site.prefix_advertise}</span>;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Default Standard POP Site / Dedicated */
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Layanan & Bandwidth Aktif</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{site.layanan_dedicated || site.kapasitas_layanan || "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">VLAN ID</span>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-base">{site.vlan ?? "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Infrastruktur</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{site.infrastruktur || "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Media Koneksi Transmisi</span>
                    <span className={`font-semibold ${isTelkom ? "text-amber-800 dark:text-amber-400" : isMetronexia ? "text-indigo-800 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"}`}>
                      {site.media_koneksi || "-"}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">IP Public</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{site.ip_public || "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">IP Private</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{site.ip_private || "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">Server / BRAS Aggregator</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{site.server || "-"}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block">SN ONT / Modem</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{site.sn_ont || "-"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Integrasi Carrier & Parameter Sirkuit */}
            {hasCircuitParams && (
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 text-xs ${
                  isMetronexia
                    ? "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200/90 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200"
                    : isTelkom
                    ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-800/60 text-amber-950 dark:text-amber-200"
                    : "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/90 dark:border-blue-800/60 text-blue-950 dark:text-blue-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <Radio
                      className={`w-3.5 h-3.5 ${
                        isMetronexia
                          ? "text-indigo-600 dark:text-indigo-400"
                          : isTelkom
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    />
                    <span>
                      3. {isMetronexia
                        ? "Parameter Sirkuit METRONEXIA"
                        : isTelkom
                        ? "Parameter Metro Telkom"
                        : "Parameter Identifikasi Sirkuit"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                      isMetronexia
                        ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                        : isTelkom
                        ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                    }`}
                  >
                    {isMetronexia ? "METRONEXIA" : isTelkom ? "TELKOM METRO" : site.infrastruktur || "PROVIDER"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 font-mono">
                  <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/70 dark:border-slate-800">
                    <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400 font-medium">Circuit ID (SID):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{site.sid || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/70 dark:border-slate-800">
                    <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400 font-medium">Account Order (AO):</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{site.ao || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200/70 dark:border-slate-800">
                    <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400 font-medium">No. Order Provider:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{site.nomor_order || "-"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Audit & Catatan Aktivasi Awal */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                4. Audit & Catatan Aktivasi Awal
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-400 text-[11px]">No. Ref Tiket:</span>
                  <Link
                    href={`/orders/${site.initial_ticket}`}
                    className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                  >
                    {site.initial_ticket}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-400 text-[11px]">Waktu Go-Live:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {new Date(site.waktu_go_live).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })} WIB
                  </span>
                </div>
                {initialOrder?.creator && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px]">Pendaftar Aktivasi:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {initialOrder.creator.nama}
                      <span className="text-slate-400 text-[10px] ml-1 uppercase">({initialOrder.creator.role})</span>
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Catatan Tambahan Saat Aktivasi:</span>
                  <div className="mt-1 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic text-[11px] leading-relaxed">
                    {initialOrder?.catatan_tambahan ? `"${initialOrder.catatan_tambahan}"` : <span className="text-slate-400 not-italic">- Tidak ada catatan tambahan -</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Lifecycle Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Aksi Antrean Lifecycle:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {site.status_layanan === "Isolir" ? (
                  <button
                    type="button"
                    onClick={() => openActionModal("Unisolir")}
                    className="col-span-2 px-3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center transition shadow-sm animate-pulse"
                  >
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Ajukan Unisolir (Buka Isolir Sirkuit)
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={site.status_layanan === "Terminated"}
                    onClick={() => openActionModal("Isolir")}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center justify-center transition"
                  >
                    <ShieldAlert className="w-4 h-4 mr-1 text-amber-600" />
                    Ajukan Isolir
                  </button>
                )}

                <button
                  type="button"
                  disabled={site.status_layanan === "Terminated" || site.status_layanan === "Isolir"}
                  onClick={() => openActionModal("Upgrade")}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center transition disabled:opacity-40"
                >
                  <TrendingUp className="w-4 h-4 mr-1 text-emerald-600" />
                  Ajukan Upgrade
                </button>

                <button
                  type="button"
                  disabled={site.status_layanan === "Terminated" || site.status_layanan === "Isolir"}
                  onClick={() => openActionModal("Downgrade")}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center justify-center transition disabled:opacity-40"
                >
                  <TrendingDown className="w-4 h-4 mr-1 text-blue-600" />
                  Ajukan Downgrade
                </button>

                <button
                  type="button"
                  disabled={site.status_layanan === "Terminated"}
                  onClick={() => openActionModal("Terminate")}
                  className={`px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center justify-center transition ${site.status_layanan === "Isolir" ? "col-span-2" : ""}`}
                >
                  <PowerOff className="w-4 h-4 mr-1 text-rose-600" />
                  Ajukan Terminate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SISI KANAN: SEMUA HISTORY (AKTIVASI, UPGRADE, DOWNGRADE, ISOLIR, TERMINATE) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center">
                  <History className="w-5 h-5 mr-2 text-emerald-600" />
                  Semua Riwayat Lifecycle Sirkuit
                </h2>
                <p className="text-xs text-slate-500">
                  Daftar seluruh aktivitas mulai dari Aktivasi Awal, Upgrade, Downgrade, Isolir, hingga Terminasi.
                </p>
              </div>

              {/* Classification filter for history */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl overflow-x-auto text-xs">
                {["Semua", "Aktivasi", "Upgrade", "Downgrade", "Isolir", "Unisolir", "Terminate"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setHistoryTab(tab)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      historyTab === tab
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Chronological Timeline History */}
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <History className="w-8 h-8 mx-auto text-slate-300" />
                <p>Tidak ada riwayat untuk kategori &ldquo;{historyTab}&rdquo;.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {filteredHistory.map((item) => {
                  let badgeTipeStyle = "bg-blue-100 text-blue-800 border-blue-200";
                  if (item.tipe_order === "Upgrade") badgeTipeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";
                  if (item.tipe_order === "Downgrade") badgeTipeStyle = "bg-sky-100 text-sky-800 border-sky-200";
                  if (item.tipe_order === "Isolir") badgeTipeStyle = "bg-amber-100 text-amber-800 border-amber-200";
                  if (item.tipe_order === "Unisolir") badgeTipeStyle = "bg-teal-100 text-teal-800 border-teal-200";
                  if (item.tipe_order === "Terminate") badgeTipeStyle = "bg-rose-100 text-rose-800 border-rose-200";

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline Node Marker */}
                      <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-sm ring-2 ring-emerald-100" />

                      <div className="bg-slate-50 group-hover:bg-slate-100/70 p-4 rounded-2xl border border-slate-200 transition space-y-3">
                        {/* Event Card Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/80">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {item.ticket_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${badgeTipeStyle}`}>
                              {item.tipe_order}
                            </span>
                            <StatusBadge status={item.status} size="sm" />
                          </div>

                          <span className="text-[11px] text-slate-500 font-medium">
                            {new Date(item.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })} WIB
                          </span>
                        </div>

                        {/* Event Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Layanan Terkait:</span>
                            <span className="font-bold text-slate-800">{item.layanan_dedicated || item.sub_layanan || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">VLAN ID:</span>
                            <span className="font-mono font-bold text-blue-700">{item.vlan !== undefined && item.vlan !== null ? item.vlan : "-"}</span>
                          </div>
                        </div>

                        {/* Event Note / Alasan */}
                        {item.catatan_tambahan && (
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Catatan / Alasan:</span>
                            <p className="italic leading-relaxed">&ldquo;{item.catatan_tambahan}&rdquo;</p>
                          </div>
                        )}

                        {/* NOC Progress Logs Audit Stream */}
                        {item.progress_logs && item.progress_logs.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Log Eksekusi Engineer ({item.progress_logs.length}):
                            </span>
                            <div className="space-y-1">
                              {item.progress_logs.map((log) => (
                                <div key={log.id} className="p-2 rounded-lg bg-slate-900 text-slate-200 text-xs">
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                                    <span className="font-semibold text-emerald-400">{log.user?.nama || "NOC"}</span>
                                    <span>{new Date(log.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                                  </div>
                                  <p className="text-slate-300 font-normal leading-relaxed">{log.catatan_progress}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Test Results Files (Speedtest, OPM) */}
                        {item.test_results && item.test_results.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Dokumentasi & Bukti Uji Jaringan ({item.test_results.length}):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {item.test_results.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setLightboxImage(t.file_url);
                                    setLightboxTitle(t.file_name);
                                    setLightboxOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-blue-700 flex items-center shadow-xs"
                                >
                                  <FileCheck2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                  <span className="max-w-[140px] truncate">{t.file_name}</span>
                                  <Eye className="w-3 h-3 ml-1 text-slate-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer Link */}
                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-400">
                            Operator: {item.creator?.nama || "Sales / NOC"}
                          </span>
                          <Link
                            href={`/orders/${item.id}/progress`}
                            className="font-bold text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            Buka NOC Desk Tiket Ini &rarr;
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTION MODAL (Upgrade / Downgrade / Isolir / Terminate) */}
      {actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-visible animate-scaleUp">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-2.5">
                {actionType === "Upgrade" && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                {actionType === "Downgrade" && <TrendingDown className="w-5 h-5 text-blue-400" />}
                {actionType === "Isolir" && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                {actionType === "Unisolir" && <ShieldCheck className="w-5 h-5 text-teal-400" />}
                {actionType === "Terminate" && <PowerOff className="w-5 h-5 text-rose-400" />}
                <div>
                  <h3 className="text-base font-bold">
                    Ajukan Tiket {actionType}: {site.site_id}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pelanggan: {site.nama_pic}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionSuccessMessage ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                  <p className="font-bold text-sm">{actionSuccessMessage}</p>
                  <p className="text-emerald-700">
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
                      onClick={() => setActionType(null)}
                      className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExecuteAction} className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-slate-800">Spesifikasi Aktif Saat Ini:</p>
                    <p className="text-slate-600">
                      Layanan: <span className="font-semibold text-slate-900">{site.layanan_dedicated}</span> &bull; VLAN: <span className="font-mono font-bold text-blue-700">{site.vlan}</span> &bull; Media: <span className="font-semibold">{site.media_koneksi}</span>
                    </p>
                  </div>

                  {(actionType === "Upgrade" || actionType === "Downgrade") && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Layanan & Bandwidth Baru <span className="text-rose-500">*</span>
                          </label>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionType === "Upgrade" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                            {actionType === "Upgrade" ? "Hanya nilai > " : "Hanya nilai < "}
                            {site.layanan_dedicated || site.kapasitas_layanan || "-"}
                          </span>
                        </div>

                        {availableLayananOptions.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              {actionType === "Upgrade"
                                ? `Layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan}) sudah merupakan paket tertinggi. Tidak ada pilihan upgrade yang lebih tinggi.`
                                : `Layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan}) sudah merupakan paket terendah. Tidak ada pilihan downgrade yang lebih rendah.`}
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
                            <p className="text-[10px] text-slate-500 mt-1">
                              Menampilkan {availableLayananOptions.length} pilihan layanan lebih {actionType === "Upgrade" ? "tinggi" : "rendah"} dari {site.layanan_dedicated || site.kapasitas_layanan}. Ketik angka kecepatan untuk mencari cepat.
                            </p>
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          VLAN ID Target
                        </label>
                        <input
                          type="number"
                          value={newVlan}
                          onChange={(e) => setNewVlan(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-blue-700 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Alasan {actionType} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={actionAlasan}
                      onChange={(e) => setActionAlasan(e.target.value)}
                      placeholder={
                        actionType === "Upgrade"
                          ? "Permintaan corporate penambahan bandwidth cabang"
                          : actionType === "Downgrade"
                          ? "Penyesuaian kebutuhan kuartal"
                          : actionType === "Isolir"
                          ? "Tunggakan invoice tagihan 2 bulan / isolir sementara"
                          : actionType === "Unisolir"
                          ? "Pelanggan telah melunasi tagihan tertunggak / konfirmasi finance"
                          : "Kontrak layanan berakhir / relokasi kantor"
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Catatan Teknis untuk NOC Engineer
                    </label>
                    <textarea
                      rows={2}
                      value={actionCatatan}
                      onChange={(e) => setActionCatatan(e.target.value)}
                      placeholder="Instruksi khusus shaper, blocking port, routing policy..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActionType(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
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

