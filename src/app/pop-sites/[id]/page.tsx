"use client";

import React, { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import { StatusBadge } from "@/components/StatusBadge";
import { LightboxModal } from "@/components/LightboxModal";
import { SearchableSelect } from "@/components/SearchableSelect";
import { IcmpMonitorWidget } from "@/components/IcmpMonitorWidget";
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
  RotateCcw,
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
  Edit3,
  Lock,
  Plus,
  Trash2,
  X,
  Save,
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

interface DataChangeDiff {
  field: string;
  label: string;
  old_value: string;
  new_value: string;
}

interface DataChangeLogItem {
  id: string;
  pop_site_id: string;
  user_id: string;
  user?: {
    id: string;
    nama: string;
    role: string;
    email: string;
  } | null;
  changes: string; // JSON string of DataChangeDiff[]
  catatan?: string | null;
  created_at: string;
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
  data_change_logs?: DataChangeLogItem[];
}

const DEFAULT_SERVER_OPTIONS = [
  "JAKARTA P1",
  "JAKARTA P2",
  "BANDUNG (BBU)",
  "CIANJUR (GEKBRONG)",
  "PELABUHAN RATU",
  "SUKABUMI",
  "CIKIDANG",
  "SURABAYA",
  "POP MARGA'ASIH (FERIHANZANI)",
];

const DEFAULT_INFRASTRUCTURE_OPTIONS = [
  "JDP",
  "MITRA (jemput)",
  "METRO E LINTAS ARTHA",
  "METRO E ION (HSP)",
  "METRO E IFORTE",
  "METRONEXIA",
  "FIBERSTAR",
];

const DEFAULT_MEDIA_OPTIONS = ["SFP", "ONT", "RJ45", "Metro Telkom", "Radio Ubiquiti"];

export default function PopSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { currentUser } = useCurrentUser();
  const { alert: alertDialog } = useDialog();

  const [site, setSite] = useState<PopSiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History classification tab on the right
  const [historyTab, setHistoryTab] = useState("Semua");
  const [activeMainTab, setActiveMainTab] = useState<"lifecycle" | "data_changes">("lifecycle");

  // Edit Data Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nama_pic: "",
    nama_perusahaan: "",
    email_pic: "",
    kontak_pic: [""] as string[],
    alamat_instalasi: "",
    vlan: "",
    infrastruktur: "",
    media_koneksi: "",
    ip_public: "",
    ip_private: "",
    server: "",
    sn_ont: "",
    sid: "",
    ao: "",
    nomor_order: "",
    catatan: "",
  });

  // Copy feedback
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedSiteId, setCopiedSiteId] = useState(false);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [lightboxTitle, setLightboxTitle] = useState("");

  // Role check & Delete Site State
  const isSuperAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action Modal State
  const [actionType, setActionType] = useState<"Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | "Unterminated" | null>(null);
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

  const handleDeleteSite = async () => {
    if (!site) return;
    if (!isSuperAdmin) {
      void alertDialog("Akses ditolak: Hanya akun level Super Admin yang dapat menghapus POP Site.");
      return;
    }
    if (site.status_layanan !== "Terminated") {
      void alertDialog(`Hanya POP Site berstatus Terminated yang dapat dihapus. Status saat ini: ${site.status_layanan}`);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/pop-sites/${site.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser?.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus POP Site.");
      }
      await alertDialog(`POP Site [${site.site_id}] berhasil dihapus secara permanen.`);
      router.push("/pop-sites");
    } catch (err: any) {
      void alertDialog(err.message || "Gagal menghapus POP Site");
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

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

  const openActionModal = (type: "Upgrade" | "Downgrade" | "Isolir" | "Unisolir" | "Terminate" | "Unterminated") => {
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
        void alertDialog("Silakan pilih layanan & bandwidth baru.");
        return;
      }
      const currentMbps = parseBandwidthToMbps(site.layanan_dedicated || site.kapasitas_layanan);
      const targetMbps = parseBandwidthToMbps(newLayanan);

      if (actionType === "Upgrade" && currentMbps > 0 && targetMbps <= currentMbps) {
        void alertDialog(`Untuk Upgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih tinggi dari layanan saat ini (${site.layanan_dedicated || "-"}).`);
        return;
      }
      if (actionType === "Downgrade" && currentMbps > 0 && targetMbps >= currentMbps) {
        void alertDialog(`Untuk Downgrade, layanan baru (${newLayanan}) harus memiliki nilai lebih rendah dari layanan saat ini (${site.layanan_dedicated || "-"}).`);
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
      void alertDialog(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openEditModal = () => {
    if (!site) return;
    let parsedContacts: string[] = [];
    try {
      parsedContacts = JSON.parse(site.kontak_pic);
      if (!Array.isArray(parsedContacts)) parsedContacts = [site.kontak_pic];
    } catch {
      parsedContacts = site.kontak_pic ? [site.kontak_pic] : [""];
    }
    if (parsedContacts.length === 0) parsedContacts = [""];

    setEditForm({
      nama_pic: site.nama_pic || "",
      nama_perusahaan: site.nama_perusahaan || "",
      email_pic: site.email_pic || "",
      kontak_pic: parsedContacts,
      alamat_instalasi: site.alamat_instalasi || "",
      vlan: site.vlan !== null && site.vlan !== undefined ? String(site.vlan) : "",
      infrastruktur: site.infrastruktur || "",
      media_koneksi: site.media_koneksi || "",
      ip_public: site.ip_public || "",
      ip_private: site.ip_private || "",
      server: site.server || "",
      sn_ont: site.sn_ont || "",
      sid: site.sid || "",
      ao: site.ao || "",
      nomor_order: site.nomor_order || "",
      catatan: "",
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleAddContact = () => {
    setEditForm((prev) => ({
      ...prev,
      kontak_pic: [...prev.kontak_pic, ""],
    }));
  };

  const handleRemoveContact = (index: number) => {
    setEditForm((prev) => {
      const updated = prev.kontak_pic.filter((_, i) => i !== index);
      return {
        ...prev,
        kontak_pic: updated.length > 0 ? updated : [""],
      };
    });
  };

  const handleContactChange = (index: number, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.kontak_pic];
      updated[index] = value;
      return { ...prev, kontak_pic: updated };
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;

    if (!editForm.nama_pic.trim()) {
      setEditError("Nama PIC wajib diisi.");
      return;
    }

    const validContacts = editForm.kontak_pic.map((k) => k.trim()).filter((k) => k.length > 0);
    if (validContacts.length === 0) {
      setEditError("Minimal cantumkan 1 nomor kontak PIC / WhatsApp.");
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/pop-sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser?.id,
          nama_pic: editForm.nama_pic.trim(),
          nama_perusahaan: editForm.nama_perusahaan.trim() || null,
          email_pic: editForm.email_pic.trim() || null,
          kontak_pic: validContacts,
          alamat_instalasi: editForm.alamat_instalasi.trim() || null,
          vlan: editForm.vlan.trim() ? parseInt(editForm.vlan.trim(), 10) : null,
          infrastruktur: editForm.infrastruktur.trim() || null,
          media_koneksi: editForm.media_koneksi.trim() || null,
          ip_public: editForm.ip_public.trim() || null,
          ip_private: editForm.ip_private.trim() || null,
          server: editForm.server.trim() || null,
          sn_ont: editForm.sn_ont.trim() || null,
          sid: editForm.sid.trim() || null,
          ao: editForm.ao.trim() || null,
          nomor_order: editForm.nomor_order.trim() || null,
          catatan: editForm.catatan.trim() || "Perubahan Data Administrasi & Sirkuit",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan perubahan data.");
      }

      setSite(data.data);
      setEditSuccess(data.message || "Data administrasi berhasil diperbarui!");
      setTimeout(() => {
        setEditModalOpen(false);
        setEditSuccess(null);
        setActiveMainTab("data_changes");
      }, 1000);
    } catch (err: any) {
      setEditError(err.message || "Terjadi kesalahan saat menyimpan perubahan.");
    } finally {
      setIsSubmittingEdit(false);
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
              {site.nama_pic}
            </h1>
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

            {site.status_layanan === "Terminated" && (
              <button
                onClick={() => openActionModal("Unterminated")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs flex items-center animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Unterminated (Buka Terminasi)
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

            {site.status_layanan === "Terminated" && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white transition shadow-xs flex items-center cursor-pointer"
                title="Hapus permanen POP Site ini dari database (Khusus Super Admin & Status Terminated)"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Hapus Site
              </button>
            )}
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
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 transition shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 mr-1 text-emerald-400 dark:text-emerald-600" />
                  Edit Data
                </button>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                  Active Master Asset
                </span>
              </div>
            </div>

            {/* Section 1: Data PIC & Lokasi */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                1. Data Pelanggan & Kontak PIC
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] block">Nama PIC:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{site.nama_pic || "-"}</span>
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

            {/* ICMP Ping Monitoring Widget (Uptime Kuma Engine) */}
            <IcmpMonitorWidget popSiteId={site.id} currentIpPublic={site.ip_public} />

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
                {site.status_layanan === "Terminated" ? (
                  <button
                    type="button"
                    onClick={() => openActionModal("Unterminated")}
                    className="col-span-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center transition shadow-sm animate-pulse"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Ajukan Unterminated (Buka Terminasi Sirkuit)
                  </button>
                ) : site.status_layanan === "Isolir" ? (
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

                {site.status_layanan === "Terminated" && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="col-span-2 px-3 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center justify-center transition shadow-xs cursor-pointer"
                    title="Hapus permanen POP Site ini dari database (Khusus Super Admin & Status Terminated)"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Hapus Permanen POP Site
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SISI KANAN: SEMUA HISTORY (TERPISAH ANTARA LIFECYCLE & PERUBAHAN DATA) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 space-y-5">
            {/* Top-Level Menu Switcher: Lifecycle vs Perubahan Data */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveMainTab("lifecycle")}
                  className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeMainTab === "lifecycle"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <History className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                  Riwayat Lifecycle Sirkuit
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                    {site.orders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("data_changes")}
                  className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeMainTab === "data_changes"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                  Riwayat Perubahan Data
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
                    {site.data_change_logs?.length || 0}
                  </span>
                </button>
              </div>

              {activeMainTab === "lifecycle" && (
                /* Classification filter for lifecycle history */
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl overflow-x-auto text-xs">
                  {["Semua", "Aktivasi", "Upgrade", "Downgrade", "Isolir", "Unisolir", "Terminate"].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setHistoryTab(tab)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                        historyTab === tab
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TAB 1: RIWAYAT LIFECYCLE SIRKUIT */}
            {activeMainTab === "lifecycle" && (
              <div>
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
        )}

        {/* TAB 2: RIWAYAT PERUBAHAN DATA (AUDIT LOG TERPISAH) */}
        {activeMainTab === "data_changes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Audit Log Perubahan Data Administrasi
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Histori penyuntingan data master, dicatat otomatis berdasarkan akun yang melakukan perubahan.
                </p>
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                Ubah Data Sekarang
              </button>
            </div>

            {!site.data_change_logs || site.data_change_logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">Belum Ada Riwayat Perubahan Data</p>
                <p className="text-slate-400">Data administrasi & sirkuit masih sesuai dengan dokumen aktivasi awal.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {site.data_change_logs.map((log) => {
                  let diffList: Array<{ field: string; label: string; old_value: string; new_value: string }> = [];
                  try {
                    diffList = JSON.parse(log.changes);
                  } catch {
                    diffList = [];
                  }

                  return (
                    <div
                      key={log.id}
                      className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3"
                    >
                      {/* Log Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-700/80">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                            {log.user?.nama ? log.user.nama.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {log.user?.nama || "User"}
                              </span>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {log.user?.role || "Staff"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400">
                              {log.user?.email || ""}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {new Date(log.created_at).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })} WIB
                        </span>
                      </div>

                      {/* Catatan Perubahan */}
                      {log.catatan && (
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 italic">
                          &ldquo;{log.catatan}&rdquo;
                        </div>
                      )}

                      {/* Diff Table */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Rincian Data yang Diubah ({diffList.length}):
                        </span>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs overflow-hidden">
                          {diffList.map((d, dIdx) => (
                            <div key={dIdx} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300 sm:w-1/3">
                                {d.label}
                              </span>
                              <div className="flex items-center space-x-2 text-xs font-mono flex-1 sm:justify-end flex-wrap">
                                <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 line-through">
                                  {d.old_value}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-bold">
                                  {d.new_value}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                {actionType === "Unterminated" && <RotateCcw className="w-5 h-5 text-emerald-400" />}
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
                          : actionType === "Unterminated"
                          ? "Pengaktifan kembali layanan yang sebelumnya diterminasi / renewal kontrak baru"
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

      {/* EDIT DATA ADMINISTRASI & SIRKUIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    Edit Data Administrasi & Sirkuit
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                      {site.site_id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Perubahan data akan otomatis dicatat di Audit Log atas nama akun <strong>{currentUser?.nama || "Staff"}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Form */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {editError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Group 1: Data Pelanggan & PIC */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 text-[11px]">
                    1. Data Pelanggan & Kontak PIC
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Nama PIC <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.nama_pic}
                      onChange={(e) => setEditForm({ ...editForm, nama_pic: e.target.value })}
                      placeholder="Nama lengkap PIC"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Multi-Contact PIC */}
                  <div className="sm:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 dark:text-slate-300 font-bold">
                        Nomor Kontak PIC / WhatsApp <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleAddContact}
                        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Tambah Nomor
                      </button>
                    </div>

                    {editForm.kontak_pic.map((contact, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={contact}
                            onChange={(e) => handleContactChange(idx, e.target.value)}
                            placeholder="08123456789 atau 628..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        {editForm.kontak_pic.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Alamat Fisik Instalasi
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.alamat_instalasi}
                      onChange={(e) => setEditForm({ ...editForm, alamat_instalasi: e.target.value })}
                      placeholder="Gedung, lantai, ruang server, nama jalan..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Spesifikasi Teknis Layanan */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <Network className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 text-[11px]">
                    2. Spesifikasi Teknis Layanan
                  </h4>
                </div>

                {/* Locked Layanan & Bandwidth Notice */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        Layanan & Bandwidth Aktif: {site.layanan_dedicated || site.kapasitas_layanan || "-"}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                        Terkunci / Read-Only
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">
                      Sesuai SOP pengoperasian jaringan, perubahan kapasitas layanan atau bandwidth tidak dapat diedit langsung. Gunakan menu <strong>Upgrade</strong> atau <strong>Downgrade</strong> untuk menerbitkan tiket kerja NOC resmi.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      VLAN ID
                    </label>
                    <input
                      type="number"
                      value={editForm.vlan}
                      onChange={(e) => setEditForm({ ...editForm, vlan: e.target.value })}
                      placeholder="Contoh: 3005"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Infrastruktur
                    </label>
                    <input
                      type="text"
                      list="infrastruktur-list"
                      value={editForm.infrastruktur}
                      onChange={(e) => setEditForm({ ...editForm, infrastruktur: e.target.value })}
                      placeholder="Pilih atau ketik infrastruktur..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <datalist id="infrastruktur-list">
                      {DEFAULT_INFRASTRUCTURE_OPTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Media Koneksi Transmisi
                    </label>
                    <input
                      type="text"
                      list="media-list"
                      value={editForm.media_koneksi}
                      onChange={(e) => setEditForm({ ...editForm, media_koneksi: e.target.value })}
                      placeholder="Pilih atau ketik media (SFP, ONT, RJ45)..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <datalist id="media-list">
                      {DEFAULT_MEDIA_OPTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Server / BRAS Aggregator
                    </label>
                    <input
                      type="text"
                      list="server-list"
                      value={editForm.server}
                      onChange={(e) => setEditForm({ ...editForm, server: e.target.value })}
                      placeholder="Pilih atau ketik nama server / BRAS..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <datalist id="server-list">
                      {DEFAULT_SERVER_OPTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      IP Public
                    </label>
                    <input
                      type="text"
                      value={editForm.ip_public}
                      onChange={(e) => setEditForm({ ...editForm, ip_public: e.target.value })}
                      placeholder="Contoh: 103.97.111.1/32"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      IP Private
                    </label>
                    <input
                      type="text"
                      value={editForm.ip_private}
                      onChange={(e) => setEditForm({ ...editForm, ip_private: e.target.value })}
                      placeholder="Contoh: 192.168.1.1/31"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      SN ONT / Modem
                    </label>
                    <input
                      type="text"
                      value={editForm.sn_ont}
                      onChange={(e) => setEditForm({ ...editForm, sn_ont: e.target.value })}
                      placeholder="Contoh: ZTEGC1234567 atau HWTC12345678"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Parameter Sirkuit Provider */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 text-[11px]">
                    3. Parameter Sirkuit Partner / Provider (Opsional)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Circuit ID (SID)
                    </label>
                    <input
                      type="text"
                      value={editForm.sid}
                      onChange={(e) => setEditForm({ ...editForm, sid: e.target.value })}
                      placeholder="TELKOM-METRO-9812"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Account Order (AO)
                    </label>
                    <input
                      type="text"
                      value={editForm.ao}
                      onChange={(e) => setEditForm({ ...editForm, ao: e.target.value })}
                      placeholder="AO-2026-JKT-8821"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Nomor Order Provider
                    </label>
                    <input
                      type="text"
                      value={editForm.nomor_order}
                      onChange={(e) => setEditForm({ ...editForm, nomor_order: e.target.value })}
                      placeholder="ORD-TLK-771290"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Alasan & Catatan Perubahan (Audit Log) */}
              <div className="space-y-2 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <label className="block text-purple-900 dark:text-purple-200 font-bold">
                  Catatan / Alasan Perubahan Data <span className="text-purple-600">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                  placeholder="Contoh: Update nomor telepon PIC baru, penyesuaian IP publik, perbaikan typo alamat..."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <p className="text-[10px] text-purple-700 dark:text-purple-300">
                  Catatan ini akan disimpan ke dalam <strong>Riwayat Perubahan Data</strong> secara permanen bersama tanggal dan nama akun penyunting.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {isSubmittingEdit ? "Menyimpan Perubahan..." : "Simpan Perubahan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Super Admin Only & Terminated Only) */}
      {deleteModalOpen && site && (
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
                Apakah Anda yakin ingin menghapus POP Site <strong>[{site.site_id}]</strong> ({site.nama_pic}) secara permanen?
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300">
              ⚠ Sirkuit ini dan seluruh riwayat antrean tiket terkait ({site.orders?.length || 0} history) akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
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
                onClick={handleDeleteSite}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

