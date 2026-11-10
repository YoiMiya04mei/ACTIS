"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import {
  Server,
  Plus,
  Trash2,
  ChevronRight,
  Send,
  Building2,
  Network,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  Phone,
  Radio,
  Zap,
  Globe,
  Layers,
  ArrowRight,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  DEDICATED_SERVICE_OPTIONS,
  DEFAULT_SERVER_OPTIONS,
  DEFAULT_INFRASTRUCTURE_OPTIONS,
  DEFAULT_MEDIA_OPTIONS,
} from "@/lib/ticketUtils";

export default function NewOrderPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  // Step 1: Main Category (1. POP Site, 2. Enterprise)
  const [kategoriLayanan, setKategoriLayanan] = useState<"POP Site" | "Enterprise">("POP Site");

  // Step 2: Sub-category for Enterprise (1. LocalLoop, 2. Collocation Rack, 3. Dark Fiber, 4. Content, 5. Enterprise Dedicated)
  const [subLayanan, setSubLayanan] = useState<"LocalLoop" | "Collocation Rack" | "Dark Fiber" | "Content" | "Enterprise Dedicated">("LocalLoop");

  // Common Customer & PIC State
  const [namaPic, setNamaPic] = useState("");
  const [kontakList, setKontakList] = useState<string[]>(["081298765432"]);
  const [namaPerusahaan, setNamaPerusahaan] = useState("");
  const [emailPic, setEmailPic] = useState("");
  const [alamatInstalasi, setAlamatInstalasi] = useState("");

  // Common Notes
  const [catatanTambahan, setCatatanTambahan] = useState("");

  // Server Options State (Persisted across sessions & SQLite system_settings)
  const [serverOptions, setServerOptions] = useState<string[]>(DEFAULT_SERVER_OPTIONS);

  useEffect(() => {
    const loadServers = async () => {
      try {
        const saved = localStorage.getItem("actis_server_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setServerOptions(Array.from(new Set([...DEFAULT_SERVER_OPTIONS, ...parsed])));
          }
        }

        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.server_options) {
          const remoteList = JSON.parse(json.data.server_options);
          if (Array.isArray(remoteList)) {
            setServerOptions((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Error loading server options:", e);
      }
    };
    loadServers();
  }, []);

  const handleAddNewServer = async (newServer: string) => {
    if (!isAdmin) return;
    const trimmed = newServer.trim();
    if (!trimmed) return;
    const updated = Array.from(new Set([...serverOptions, trimmed]));
    setServerOptions(updated);
    try {
      localStorage.setItem("actis_server_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "server_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to save server option:", err);
    }
  };

  const handleDeleteServer = async (serverToDelete: string) => {
    if (!isAdmin) return;
    const updated = serverOptions.filter((s) => s !== serverToDelete);
    setServerOptions(updated);
    if (server === serverToDelete) {
      setServer(updated[0] || "");
    }
    if (serverEntDedicated === serverToDelete) {
      setServerEntDedicated(updated[0] || "");
    }
    if (interkoneksiLocalLoop === serverToDelete) {
      setInterkoneksiLocalLoop(updated[0] || "");
    }
    try {
      localStorage.setItem("actis_server_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "server_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to delete server option:", err);
    }
  };

  // Infrastructure Options State (Persisted across sessions & SQLite system_settings)
  const [infrastructureOptions, setInfrastructureOptions] = useState<string[]>(DEFAULT_INFRASTRUCTURE_OPTIONS);

  useEffect(() => {
    const loadInfrastructure = async () => {
      try {
        const saved = localStorage.getItem("actis_infrastructure_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInfrastructureOptions(Array.from(new Set([...DEFAULT_INFRASTRUCTURE_OPTIONS, ...parsed])));
          }
        }

        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.infrastructure_options) {
          const remoteList = JSON.parse(json.data.infrastructure_options);
          if (Array.isArray(remoteList)) {
            setInfrastructureOptions((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Error loading infrastructure options:", e);
      }
    };
    loadInfrastructure();
  }, []);

  const handleAddNewInfrastructure = async (newInfra: string) => {
    if (!isAdmin) return;
    const trimmed = newInfra.trim();
    if (!trimmed) return;
    const updated = Array.from(new Set([...infrastructureOptions, trimmed]));
    setInfrastructureOptions(updated);
    try {
      localStorage.setItem("actis_infrastructure_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "infrastructure_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to save infrastructure option:", err);
    }
  };

  const handleDeleteInfrastructure = async (infraToDelete: string) => {
    if (!isAdmin) return;
    const updated = infrastructureOptions.filter((i) => i !== infraToDelete);
    setInfrastructureOptions(updated);
    if (infrastruktur === infraToDelete) {
      setInfrastruktur(updated[0] || "");
    }
    if (infrastrukturEntDedicated === infraToDelete) {
      setInfrastrukturEntDedicated(updated[0] || "");
    }
    if (infrastrukturLocalLoop === infraToDelete) {
      setInfrastrukturLocalLoop(updated[0] || "");
    }
    try {
      localStorage.setItem("actis_infrastructure_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "infrastructure_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to delete infrastructure option:", err);
    }
  };

  // Media Koneksi Options State (Persisted across sessions & SQLite system_settings)
  const [mediaOptions, setMediaOptions] = useState<string[]>(DEFAULT_MEDIA_OPTIONS);

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const saved = localStorage.getItem("actis_media_options");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMediaOptions(Array.from(new Set([...DEFAULT_MEDIA_OPTIONS, ...parsed])));
          }
        }

        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data?.media_options) {
          const remoteList = JSON.parse(json.data.media_options);
          if (Array.isArray(remoteList)) {
            setMediaOptions((prev) => Array.from(new Set([...prev, ...remoteList])));
          }
        }
      } catch (e) {
        console.error("Error loading media options:", e);
      }
    };
    loadMedia();
  }, []);

  const handleAddNewMedia = async (newMedia: string) => {
    if (!isAdmin) return;
    const trimmed = newMedia.trim();
    if (!trimmed) return;
    const updated = Array.from(new Set([...mediaOptions, trimmed]));
    setMediaOptions(updated);
    try {
      localStorage.setItem("actis_media_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "media_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to save media option:", err);
    }
  };

  const handleDeleteMedia = async (mediaToDelete: string) => {
    if (!isAdmin) return;
    const updated = mediaOptions.filter((m) => m !== mediaToDelete);
    setMediaOptions(updated);
    if (mediaKoneksi === mediaToDelete) {
      setMediaKoneksi(updated[0] || "");
    }
    if (mediaKoneksiLocalLoop === mediaToDelete) {
      setMediaKoneksiLocalLoop(updated[0] || "");
    }
    if (mediaKoneksiEntDedicated === mediaToDelete) {
      setMediaKoneksiEntDedicated(updated[0] || "");
    }
    try {
      localStorage.setItem("actis_media_options", JSON.stringify(updated));
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "media_options",
          value: JSON.stringify(updated),
          actorRole: currentUser?.role,
        }),
      });
    } catch (err) {
      console.error("Failed to delete media option:", err);
    }
  };

  // 1. POP Site Specific State
  const [ipPublic, setIpPublic] = useState("");
  const [ipPrivate, setIpPrivate] = useState("");
  const [vlan, setVlan] = useState<string>("1420");
  const [layananDedicated, setLayananDedicated] = useState("100Mbps");
  const [server, setServer] = useState("JAKARTA P1");
  const [infrastruktur, setInfrastruktur] = useState("JDP");
  const [mediaKoneksi, setMediaKoneksi] = useState("SFP");
  const [snOnt, setSnOnt] = useState("");

  // Metro Telkom Conditional State (for POP Site & LocalLoop)
  const [sid, setSid] = useState("TELKOM-METRO-9812");
  const [ao, setAo] = useState("AO-2026-JKT-8821");
  const [nomorOrder, setNomorOrder] = useState("ORD-TLK-771290");

  // 2. Enterprise - LocalLoop Specific State
  const [alamatInstalasiLocalLoop, setAlamatInstalasiLocalLoop] = useState("");
  const [layananLocalLoop, setLayananLocalLoop] = useState("Metro-E Local Loop");
  const [kapasitasLayanan, setKapasitasLayanan] = useState("100Mbps");
  const [interkoneksiLocalLoop, setInterkoneksiLocalLoop] = useState("JAKARTA P1");
  const [infrastrukturLocalLoop, setInfrastrukturLocalLoop] = useState<string>("JDP");
  const [portMediaLocalLoop, setPortMediaLocalLoop] = useState("Port GE0/0/1 SFP+");
  const [snOntLocalLoop, setSnOntLocalLoop] = useState("");
  const [mediaKoneksiLocalLoop, setMediaKoneksiLocalLoop] = useState("SFP");

  // 3. Enterprise - Collocation Rack Specific State
  const [alamatCollo, setAlamatCollo] = useState("Gedung Cyber 1 Lt. 3, Jl. Kuningan Barat No. 8, Jakarta Selatan");
  const [tipeLayananCollo, setTipeLayananCollo] = useState("Full Rack 42U");
  const [namaPerangkat, setNamaPerangkat] = useState("Server Dell PowerEdge R740 (2U)");
  const [snPerangkat, setSnPerangkat] = useState("SN-DELL-8829104A");

  // 4. Enterprise - Dark Fiber Specific State
  const [layananDarkFiber, setLayananDarkFiber] = useState("2 Core (1 Pair) Single-Mode G.652D");
  const [serverDarkFiber, setServerDarkFiber] = useState("POP Menara Cyber 2 -> POP Gedung Tifa");

  // 5. Enterprise - Content Specific State
  const [alamatContent, setAlamatContent] = useState("IDC Duren Tiga, Lt. 2 Ruang Peering OpenIXP");
  const [vlanContent, setVlanContent] = useState("2100");
  const [ipPrivateContent, setIpPrivateContent] = useState("10.254.10.2/30");
  const [prefixList, setPrefixList] = useState<string[]>(["103.189.20.0/24"]);
  const [asNumber, setAsNumber] = useState("AS13335 (Cloudflare Peering)");
  const [interkoneksiContent, setInterkoneksiContent] = useState("OpenIXP (IDC Duren Tiga)");
  const [layananContent, setLayananContent] = useState("Cloudflare CDN Direct Peering");
  const [serverContent, setServerContent] = useState("CORE-BGP-JKT-01 (Huawei NE40E)");
  const [mediaKoneksiContent, setMediaKoneksiContent] = useState("10G Direct Fiber LC-Duplex");

  // 6. Enterprise - Enterprise Dedicated Specific State
  const [alamatInstalasiEntDedicated, setAlamatInstalasiEntDedicated] = useState("");
  const [ipPublicEntDedicated, setIpPublicEntDedicated] = useState("");
  const [ipPrivateEntDedicated, setIpPrivateEntDedicated] = useState("");
  const [vlanEntDedicated, setVlanEntDedicated] = useState<string>("1420");
  const [layananDedicatedEnt, setLayananDedicatedEnt] = useState("100Mbps");
  const [serverEntDedicated, setServerEntDedicated] = useState("JAKARTA P1");
  const [infrastrukturEntDedicated, setInfrastrukturEntDedicated] = useState<string>("JDP");
  const [mediaKoneksiEntDedicated, setMediaKoneksiEntDedicated] = useState("SFP");
  const [snOntEntDedicated, setSnOntEntDedicated] = useState("");
  const [sidEntDedicated, setSidEntDedicated] = useState("TELKOM-METRO-9812");
  const [aoEntDedicated, setAoEntDedicated] = useState("AO-2026-JKT-8821");
  const [nomorOrderEntDedicated, setNomorOrderEntDedicated] = useState("ORD-TLK-771290");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Contact list helpers
  const handleAddKontak = () => {
    setKontakList([...kontakList, ""]);
  };

  const handleUpdateKontak = (index: number, val: string) => {
    const updated = [...kontakList];
    updated[index] = val;
    setKontakList(updated);
  };

  const handleRemoveKontak = (index: number) => {
    if (kontakList.length <= 1) {
      setKontakList([""]);
      return;
    }
    const updated = kontakList.filter((_, i) => i !== index);
    setKontakList(updated);
  };

  // Prefix Advertise helpers (Content)
  const handleAddPrefix = () => {
    setPrefixList([...prefixList, ""]);
  };

  const handleUpdatePrefix = (index: number, val: string) => {
    const updated = [...prefixList];
    updated[index] = val;
    setPrefixList(updated);
  };

  const handleRemovePrefix = (index: number) => {
    if (prefixList.length <= 1) {
      setPrefixList([""]);
      return;
    }
    const updated = prefixList.filter((_, i) => i !== index);
    setPrefixList(updated);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Filter valid phone numbers
    const validKontak = kontakList.map((k) => k.trim()).filter((k) => k.length > 0);
    if (validKontak.length === 0) {
      setErrorMessage("Wajib mengisi minimal satu nomor kontak PIC / WhatsApp.");
      return;
    }

    if (!namaPic.trim()) {
      setErrorMessage("Nama PIC wajib diisi.");
      return;
    }

    let payload: any = {
      kategori_layanan: kategoriLayanan,
      nama_pic: namaPic.trim(),
      kontak_pic: validKontak,
      catatan_tambahan: catatanTambahan.trim() || null,
      created_by: currentUser.id,
      waktu_aktivasi: null,
    };

    if (kategoriLayanan === "POP Site") {
      const isTelkom = mediaKoneksi.trim().toLowerCase().includes("telkom");
      const isMetronexia = infrastruktur.trim().toLowerCase().includes("metronexia");

      if (isTelkom) {
        if (!sid.trim() || !ao.trim() || !nomorOrder.trim()) {
          setErrorMessage("Untuk media 'Metro Telkom', field SID, AO, dan Nomor Order wajib diisi lengkap.");
          return;
        }
      }

      if (isMetronexia) {
        if (!sid.trim() || !ao.trim() || !nomorOrder.trim()) {
          setErrorMessage("Untuk infrastruktur 'METRONEXIA', field SID, AO, dan No. Order wajib diisi lengkap.");
          return;
        }
      }

      if (!alamatInstalasi.trim()) {
        setErrorMessage("Alamat fisik instalasi POP Site wajib diisi.");
        return;
      }

      const hasCarrierDetails = isTelkom || isMetronexia;

      payload = {
        ...payload,
        alamat_instalasi: alamatInstalasi.trim(),
        ip_public: ipPublic.trim() || null,
        ip_private: ipPrivate.trim() || null,
        vlan: parseInt(vlan, 10),
        layanan_dedicated: layananDedicated,
        server: server,
        infrastruktur: infrastruktur,
        media_koneksi: mediaKoneksi,
        sn_ont: snOnt.trim() || null,
        sid: hasCarrierDetails ? sid.trim() : null,
        ao: hasCarrierDetails ? ao.trim() : null,
        nomor_order: hasCarrierDetails ? nomorOrder.trim() : null,
      };
    } else {
      // ENTERPRISE
      payload.sub_layanan = subLayanan;
      payload.nama_perusahaan = namaPerusahaan.trim();

      if (!namaPerusahaan.trim()) {
        setErrorMessage("Nama Perusahaan wajib diisi untuk layanan Enterprise.");
        return;
      }

      if (subLayanan === "LocalLoop") {
        if (!emailPic.trim()) {
          setErrorMessage("Email PIC/Perusahaan wajib diisi untuk LocalLoop.");
          return;
        }
        if (!alamatInstalasiLocalLoop.trim()) {
          setErrorMessage("Alamat fisik instalasi wajib diisi untuk LocalLoop.");
          return;
        }
        if (!kapasitasLayanan.trim()) {
          setErrorMessage("Kapasitas Layanan wajib diisi untuk LocalLoop.");
          return;
        }
        if (!interkoneksiLocalLoop.trim()) {
          setErrorMessage("Interkoneksi wajib diisi untuk LocalLoop.");
          return;
        }
        if (!infrastrukturLocalLoop.trim()) {
          setErrorMessage("Infrastruktur wajib diisi untuk LocalLoop.");
          return;
        }
        if (!portMediaLocalLoop.trim()) {
          setErrorMessage("Port Interkoneksi wajib diisi untuk LocalLoop.");
          return;
        }
        if (!mediaKoneksiLocalLoop.trim()) {
          setErrorMessage("Media Koneksi wajib diisi untuk LocalLoop.");
          return;
        }

        const isTelkom = mediaKoneksiLocalLoop.trim().toLowerCase().includes("telkom");
        const isMetronexia = infrastrukturLocalLoop.trim().toLowerCase().includes("metronexia");

        if (isTelkom && (!sid.trim() || !ao.trim() || !nomorOrder.trim())) {
          setErrorMessage("Untuk media 'Metro Telkom', field SID, AO, dan Nomor Order wajib diisi lengkap.");
          return;
        }

        if (isMetronexia && (!sid.trim() || !ao.trim() || !nomorOrder.trim())) {
          setErrorMessage("Untuk infrastruktur 'METRONEXIA', field SID, AO, dan No. Order wajib diisi lengkap.");
          return;
        }

        const hasCarrierDetails = isTelkom || isMetronexia;

        payload = {
          ...payload,
          alamat_instalasi: alamatInstalasiLocalLoop.trim(),
          email_pic: emailPic.trim(),
          layanan_dedicated: layananLocalLoop.trim(),
          kapasitas_layanan: kapasitasLayanan.trim(),
          interkoneksi: interkoneksiLocalLoop.trim(),
          server: interkoneksiLocalLoop.trim(),
          infrastruktur: infrastrukturLocalLoop.trim(),
          port_media: portMediaLocalLoop.trim(),
          sn_ont: snOntLocalLoop.trim() || null,
          media_koneksi: mediaKoneksiLocalLoop.trim(),
          sid: hasCarrierDetails ? sid.trim() : null,
          ao: hasCarrierDetails ? ao.trim() : null,
          nomor_order: hasCarrierDetails ? nomorOrder.trim() : null,
        };
      } else if (subLayanan === "Collocation Rack") {
        if (!emailPic.trim()) {
          setErrorMessage("Email PIC/Perusahaan wajib diisi untuk Collocation.");
          return;
        }
        if (!alamatCollo.trim()) {
          setErrorMessage("Alamat Instalasi Data Center wajib diisi.");
          return;
        }
        if (!namaPerangkat.trim() || !snPerangkat.trim()) {
          setErrorMessage("Nama Perangkat dan Serial Number (SN) wajib diisi lengkap.");
          return;
        }

        payload = {
          ...payload,
          email_pic: emailPic.trim(),
          alamat_instalasi: alamatCollo.trim(),
          tipe_layanan_collo: tipeLayananCollo.trim(),
          nama_perangkat: namaPerangkat.trim(),
          sn_perangkat: snPerangkat.trim(),
        };
      } else if (subLayanan === "Dark Fiber") {
        if (!layananDarkFiber.trim() || !serverDarkFiber.trim()) {
          setErrorMessage("Layanan Dark Fiber dan Server / Hub Datacenter wajib diisi.");
          return;
        }

        payload = {
          ...payload,
          layanan_dedicated: layananDarkFiber.trim(),
          server: serverDarkFiber.trim(),
        };
      } else if (subLayanan === "Content") {
        const validPrefix = prefixList.map((p) => p.trim()).filter((p) => p.length > 0);
        if (validPrefix.length === 0) {
          setErrorMessage("Minimal cantumkan 1 Prefix Advertise untuk layanan Content BGP.");
          return;
        }
        if (!alamatContent.trim()) {
          setErrorMessage("Alamat lokasi interkoneksi Content wajib diisi.");
          return;
        }

        payload = {
          ...payload,
          alamat_instalasi: alamatContent.trim(),
          vlan: parseInt(vlanContent, 10),
          ip_private: ipPrivateContent.trim(),
          prefix_advertise: validPrefix,
          as_number: asNumber.trim(),
          interkoneksi: interkoneksiContent.trim(),
          layanan_dedicated: layananContent.trim(),
          server: serverContent.trim(),
          media_koneksi: mediaKoneksiContent.trim(),
        };
      } else if (subLayanan === "Enterprise Dedicated") {
        if (!alamatInstalasiEntDedicated.trim()) {
          setErrorMessage("Alamat fisik instalasi Enterprise Dedicated wajib diisi.");
          return;
        }
        if (!vlanEntDedicated || isNaN(parseInt(vlanEntDedicated, 10))) {
          setErrorMessage("VLAN ID wajib diisi dengan angka (1 - 4094).");
          return;
        }
        if (!layananDedicatedEnt.trim()) {
          setErrorMessage("Layanan Dedicated wajib diisi.");
          return;
        }
        if (!serverEntDedicated.trim()) {
          setErrorMessage("Server / BRAS Aggregator wajib diisi.");
          return;
        }
        if (!infrastrukturEntDedicated.trim()) {
          setErrorMessage("Infrastruktur wajib diisi.");
          return;
        }
        if (!mediaKoneksiEntDedicated.trim()) {
          setErrorMessage("Media Koneksi wajib diisi.");
          return;
        }

        const isTelkom = mediaKoneksiEntDedicated.trim().toLowerCase().includes("telkom");
        const isMetronexia = infrastrukturEntDedicated.trim().toLowerCase().includes("metronexia");

        if (isTelkom && (!sidEntDedicated.trim() || !aoEntDedicated.trim() || !nomorOrderEntDedicated.trim())) {
          setErrorMessage("Untuk media 'Metro Telkom', field SID, AO, dan Nomor Order wajib diisi lengkap.");
          return;
        }

        if (isMetronexia && (!sidEntDedicated.trim() || !aoEntDedicated.trim() || !nomorOrderEntDedicated.trim())) {
          setErrorMessage("Untuk infrastruktur 'METRONEXIA', field SID, AO, dan No. Order wajib diisi lengkap.");
          return;
        }

        const hasCarrierDetails = isTelkom || isMetronexia;

        payload = {
          ...payload,
          alamat_instalasi: alamatInstalasiEntDedicated.trim(),
          ip_public: ipPublicEntDedicated.trim() || null,
          ip_private: ipPrivateEntDedicated.trim() || null,
          vlan: parseInt(vlanEntDedicated, 10),
          layanan_dedicated: layananDedicatedEnt.trim(),
          server: serverEntDedicated.trim(),
          infrastruktur: infrastrukturEntDedicated.trim(),
          media_koneksi: mediaKoneksiEntDedicated.trim(),
          sn_ont: snOntEntDedicated.trim() || null,
          sid: hasCarrierDetails ? sidEntDedicated.trim() : null,
          ao: hasCarrierDetails ? aoEntDedicated.trim() : null,
          nomor_order: hasCarrierDetails ? nomorOrderEntDedicated.trim() : null,
        };
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mendaftarkan tiket aktivasi.");
      }

      setSuccessMessage(data.message);

      setTimeout(() => {
        router.push(`/orders/${data.data.id}/progress`);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-fadeIn">
      {/* Header & Breadcrumb */}
      <div>
        <nav className="flex items-center space-x-2 text-xs text-slate-500 mb-2">
          <Link href="/queue" className="hover:text-blue-600 font-medium">
            List Antrean
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-700 font-semibold">Registrasi Layanan Baru</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
              <Server className="w-6 h-6 mr-2.5 text-blue-600" />
              Pembuatan Surat / Registrasi Antrean Layanan
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Input data pelanggan, parameter teknis jaringan, dan dokumen aktivasi provisioning ISP.
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-1.5 rounded-lg">
            <span className="font-semibold">Operator:</span>
            <span>{currentUser.nama}</span>
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-3 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Gagal Menyimpan Order:</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start space-x-3 text-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Berhasil!</p>
            <p className="mt-0.5">{successMessage}</p>
            <p className="text-xs text-emerald-700 mt-1">Mengalihkan ke NOC Desk Workspace...</p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAHAP 1: PILIHAN KATEGORI UTAMA (1. POP Site / 2. Enterprise) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block">
            Langkah 1 &bull; Kategori Layanan
          </span>
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center mt-0.5">
            <Layers className="w-5 h-5 mr-2 text-blue-600" />
            Pilih Kategori Pembuatan Tiket Layanan:
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilih antara aktivasi infrastruktur POP Site atau portfolio solusi korporat Enterprise.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: POP Site */}
          <button
            type="button"
            onClick={() => setKategoriLayanan("POP Site")}
            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start space-x-3.5 group ${
              kategoriLayanan === "POP Site"
                ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20"
                : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60"
            }`}
          >
            <div
              className={`p-3 rounded-xl transition ${
                kategoriLayanan === "POP Site"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
              }`}
            >
              <Radio className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-base text-slate-900">1. POP Site</span>
                {kategoriLayanan === "POP Site" && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Aktivasi Point of Presence (POP) Site, Media Transmisi, VLAN, Alamat Fisik & BRAS Aggregator.
              </p>
            </div>
          </button>

          {/* Card 2: Enterprise */}
          <button
            type="button"
            onClick={() => setKategoriLayanan("Enterprise")}
            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start space-x-3.5 group ${
              kategoriLayanan === "Enterprise"
                ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20"
                : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60"
            }`}
          >
            <div
              className={`p-3 rounded-xl transition ${
                kategoriLayanan === "Enterprise"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
              }`}
            >
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-base text-slate-900">2. Enterprise</span>
                {kategoriLayanan === "Enterprise" && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Solusi Korporasi & Data Center: LocalLoop, Collocation Rack, Dark Fiber, dan Content BGP.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAHAP 2: SUB-PILIHAN ENTERPRISE (JIKA MEMILIH NO.2) */}
      {/* ======================================================== */}
      {kategoriLayanan === "Enterprise" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4 animate-fadeIn">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block">
              Langkah 2 &bull; Klasifikasi Enterprise
            </span>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center mt-0.5">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
              Pilih Jenis Layanan Enterprise:
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Format formulir akan otomatis beralih menampilkan parameter khusus layanan terpilih.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              {
                id: "LocalLoop",
                number: "1",
                label: "LocalLoop",
                desc: "Last-mile leased line dedicated end-to-end",
                icon: <Network className="w-4 h-4" />,
                activeColor: "bg-emerald-600 border-emerald-600 text-white",
              },
              {
                id: "Collocation Rack",
                number: "2",
                label: "Collocation Rack",
                desc: "Penempatan server & rack data center",
                icon: <Server className="w-4 h-4" />,
                activeColor: "bg-blue-600 border-blue-600 text-white",
              },
              {
                id: "Dark Fiber",
                number: "3",
                label: "Dark Fiber",
                desc: "Penyewaan core serat optik unlit fisik",
                icon: <Radio className="w-4 h-4" />,
                activeColor: "bg-purple-600 border-purple-600 text-white",
              },
              {
                id: "Content",
                number: "4",
                label: "Content",
                desc: "BGP Peering, CDN & Interkoneksi IP",
                icon: <Globe className="w-4 h-4" />,
                activeColor: "bg-amber-600 border-amber-600 text-white",
              },
              {
                id: "Enterprise Dedicated",
                number: "5",
                label: "Enterprise Dedicated",
                desc: "Akses dedicated internet 1:1, IP & BRAS",
                icon: <Zap className="w-4 h-4" />,
                activeColor: "bg-blue-600 border-blue-600 text-white",
              },
            ].map((item) => {
              const isSelected = subLayanan === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubLayanan(item.id as any)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-emerald-400/40"
                      : "bg-slate-50 hover:bg-slate-100/80 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={isSelected ? "text-emerald-400" : "text-slate-600"}>
                      {item.icon}
                    </span>
                    <span className="font-bold text-xs">
                      {item.number}. {item.label}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1.5 leading-snug ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM DINAMIS SESUAI PILIHAN LAYANAN */}
      {/* ======================================================== */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ===================================================== */}
        {/* FORMAT A: POP SITE */}
        {/* ===================================================== */}
        {kategoriLayanan === "POP Site" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Section 1: Data PIC & Lokasi POP Site */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                    Data Pelanggan & Lokasi Instalasi POP Site
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi identitas PIC dan alamat fisik lokasi POP Site pelanggan.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Nama PIC */}
                <div>
                  <label htmlFor="nama_pic" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Pelanggan / PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nama_pic"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: PT Sinar Logistik (PIC: Pak Danu)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Dynamic Tag/Input List Kontak PIC */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Daftar Kontak PIC / WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder={`Nomor Kontak ${idx + 1} (contoh: 081298765432)`}
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alamat Instalasi */}
                <div>
                  <label htmlFor="alamat_instalasi" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Alamat Fisik Instalasi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="alamat_instalasi"
                    required
                    rows={3}
                    value={alamatInstalasi}
                    onChange={(e) => setAlamatInstalasi(e.target.value)}
                    placeholder="Alamat lengkap lokasi POP/Gedung/Ruang Server, Lantai, No. Rack..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Parameter Jaringan POP Site */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Network className="w-4 h-4 mr-2 text-indigo-600" />
                    Parameter Jaringan & Perangkat BRAS POP Site
                  </h2>
                  <p className="text-xs text-slate-500">
                    Routing, alokasi VLAN, IP subnetting, dan media transmisi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    IP Public (CIDR IPv4 / IPv6)
                  </label>
                  <input
                    type="text"
                    value={ipPublic}
                    onChange={(e) => setIpPublic(e.target.value)}
                    placeholder="Contoh: 103.148.72.130/30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    IP Private (Interkoneksi / Loopback)
                  </label>
                  <input
                    type="text"
                    value={ipPrivate}
                    onChange={(e) => setIpPrivate(e.target.value)}
                    placeholder="Contoh: 10.240.15.22/30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    VLAN ID (1 - 4094) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={4094}
                    value={vlan}
                    onChange={(e) => setVlan(e.target.value)}
                    placeholder="1420"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Layanan Dedicated <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={layananDedicated}
                    onChange={setLayananDedicated}
                    options={DEDICATED_SERVICE_OPTIONS}
                    placeholder="Pilih atau cari kecepatan (50Mbps - 10G)..."
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pilihan 50Mbps - 1G, dan 1,1G - 10G. Klik dan ketik untuk mencari cepat.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Server / BRAS Aggregator <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={server}
                    onChange={setServer}
                    options={serverOptions}
                    placeholder="Pilih atau cari server..."
                    required
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewServer : undefined}
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteServer : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) server.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari server. (Penambahan & penghapusan server khusus Administrator).
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Infrastruktur <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {infrastructureOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={infrastruktur}
                    onChange={setInfrastruktur}
                    options={infrastructureOptions}
                    placeholder="Pilih atau cari infrastruktur..."
                    required
                    icon={<Network className="w-4 h-4 text-emerald-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewInfrastructure : undefined}
                    createLabel="Tambah pilihan infrastruktur baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteInfrastructure : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) infrastruktur.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari infrastruktur. (Penambahan & penghapusan infrastruktur khusus Administrator).
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Media Koneksi <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {mediaOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={mediaKoneksi}
                    onChange={setMediaKoneksi}
                    options={mediaOptions}
                    placeholder="Pilih atau cari media koneksi..."
                    required
                    icon={<Radio className="w-4 h-4 text-indigo-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewMedia : undefined}
                    createLabel="Tambah pilihan media koneksi baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteMedia : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) media koneksi.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari media koneksi. (Penambahan & penghapusan media koneksi khusus Administrator).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Serial Number ONT / Modem
                  </label>
                  <input
                    type="text"
                    value={snOnt}
                    onChange={(e) => setSnOnt(e.target.value)}
                    placeholder="Contoh: ZTEGC1234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Conditional METRONEXIA */}
            {infrastruktur.trim().toLowerCase().includes("metronexia") && (
              <div className="bg-indigo-50/70 border border-indigo-300/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
                <div className="flex items-center space-x-2 text-indigo-950 font-bold">
                  <Network className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm">Konfigurasi Khusus Infrastruktur METRONEXIA</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                      SID (khusus Metronexia) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={sid}
                      onChange={(e) => setSid(e.target.value)}
                      placeholder="Contoh: SID-MTX-9821"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                      AO (khusus Metronexia) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={ao}
                      onChange={(e) => setAo(e.target.value)}
                      placeholder="Contoh: AO-MTX-2026-01"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                      No. Order ( Khusus Metronexia) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nomorOrder}
                      onChange={(e) => setNomorOrder(e.target.value)}
                      placeholder="Contoh: ORD-MTX-7712"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-indigo-700">
                  Data SID, AO, dan No. Order khusus Metronexia wajib diisi untuk koordinasi aktivasi link & cross-connect antar NOC.
                </p>
              </div>
            )}

            {/* Section 4: Conditional Metro Telkom */}
            {!infrastruktur.trim().toLowerCase().includes("metronexia") && mediaKoneksi.trim().toLowerCase().includes("telkom") && (
              <div className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
                <div className="flex items-center space-x-2 text-amber-900 font-bold">
                  <Radio className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm">Konfigurasi Khusus Media Metro Telkom</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                      SID (Service ID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={sid}
                      onChange={(e) => setSid(e.target.value)}
                      placeholder="TELKOM-METRO-XXXX"
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                      AO (Account Order) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={ao}
                      onChange={(e) => setAo(e.target.value)}
                      placeholder="AO-XXXX-XXXX"
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                      Nomor Order <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nomorOrder}
                      onChange={(e) => setNomorOrder(e.target.value)}
                      placeholder="ORD-TLK-XXXX"
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================== */}
        {/* FORMAT B.1: ENTERPRISE -> LOCALLOOP */}
        {/* ===================================================== */}
        {kategoriLayanan === "Enterprise" && subLayanan === "LocalLoop" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-emerald-600" />
                    Data PIC, Perusahaan & Lokasi (LocalLoop)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi identitas PIC penanggung jawab, perusahaan, dan alamat instalasi pelanggan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: Pak Danu Wibowo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="Contoh: PT Bank Artha Mandiri Tbk"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Email PIC / Korporat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={emailPic}
                    onChange={(e) => setEmailPic(e.target.value)}
                    placeholder="it-noc@perusahaan.co.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Dynamic Kontak PIC */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nomor Kontak PIC (Bisa Lebih Dari Satu) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder={`Nomor Kontak ${idx + 1}`}
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alamat Instalasi */}
                <div className="md:col-span-2">
                  <label htmlFor="alamat_instalasi_localloop" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Alamat Fisik Instalasi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="alamat_instalasi_localloop"
                    rows={2}
                    required
                    value={alamatInstalasiLocalLoop}
                    onChange={(e) => setAlamatInstalasiLocalLoop(e.target.value)}
                    placeholder="Contoh: Gedung Menara Cyber 2 Lt. 12, Jl. HR Rasuna Said Blok X-5 No. 13, Kuningan, Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Parameter Layanan LocalLoop */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Network className="w-4 h-4 mr-2 text-emerald-600" />
                    Parameter Teknis Layanan LocalLoop
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kapasitas bandwidth, interkoneksi, port interkoneksi, dan konfigurasi terminal ONT.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Layanan LocalLoop <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={layananLocalLoop}
                    onChange={(e) => setLayananLocalLoop(e.target.value)}
                    placeholder="Contoh: Metro-E Local Loop P2P"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kapasitas Layanan <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={kapasitasLayanan}
                    onChange={setKapasitasLayanan}
                    options={DEDICATED_SERVICE_OPTIONS}
                    placeholder="Pilih atau cari kecepatan (50Mbps - 10G)..."
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pilihan 50Mbps - 1G, dan 1,1G - 10G. Klik dan ketik untuk mencari cepat.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Interkoneksi <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {serverOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={interkoneksiLocalLoop}
                    onChange={setInterkoneksiLocalLoop}
                    options={serverOptions}
                    placeholder="Pilih atau cari server / POP interkoneksi..."
                    required
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewServer : undefined}
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteServer : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) server.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari server. (Penambahan & penghapusan server khusus Administrator).
                    </p>
                  )}
                </div>

                {/* Infrastruktur */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Infrastruktur <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {infrastructureOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={infrastrukturLocalLoop}
                    onChange={setInfrastrukturLocalLoop}
                    options={infrastructureOptions}
                    placeholder="Pilih atau cari infrastruktur..."
                    required
                    icon={<Network className="w-4 h-4 text-emerald-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewInfrastructure : undefined}
                    createLabel="Tambah pilihan infrastruktur baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteInfrastructure : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) infrastruktur.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari infrastruktur. (Penambahan & penghapusan infrastruktur khusus Administrator).
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Media Koneksi <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {mediaOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={mediaKoneksiLocalLoop}
                    onChange={setMediaKoneksiLocalLoop}
                    options={mediaOptions}
                    placeholder="Pilih atau cari media koneksi..."
                    required
                    icon={<Radio className="w-4 h-4 text-emerald-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewMedia : undefined}
                    createLabel="Tambah pilihan media koneksi baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteMedia : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus media koneksi.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari media koneksi. (Penambahan & penghapusan media koneksi khusus Administrator).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Port Interkoneksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={portMediaLocalLoop}
                    onChange={(e) => setPortMediaLocalLoop(e.target.value)}
                    placeholder="Contoh: Port GE0/0/1 SFP+"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    SN ONT (Serial Number)
                  </label>
                  <input
                    type="text"
                    value={snOntLocalLoop}
                    onChange={(e) => setSnOntLocalLoop(e.target.value)}
                    placeholder="Contoh: ZTEGC1234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Conditional METRONEXIA for LocalLoop */}
              {infrastrukturLocalLoop.trim().toLowerCase().includes("metronexia") && (
                <div className="bg-emerald-50/70 border border-emerald-300/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-emerald-950 font-bold">
                    <Network className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm">Konfigurasi Khusus Infrastruktur METRONEXIA</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-emerald-950 mb-1">
                        SID (khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={sid}
                        onChange={(e) => setSid(e.target.value)}
                        placeholder="Contoh: SID-MTX-9821"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-emerald-950 mb-1">
                        AO (khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={ao}
                        onChange={(e) => setAo(e.target.value)}
                        placeholder="Contoh: AO-MTX-2026-01"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-emerald-950 mb-1">
                        No. Order ( Khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nomorOrder}
                        onChange={(e) => setNomorOrder(e.target.value)}
                        placeholder="Contoh: ORD-MTX-7712"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Data SID, AO, dan No. Order khusus Metronexia wajib diisi untuk koordinasi aktivasi link & cross-connect antar NOC.
                  </p>
                </div>
              )}

              {/* Conditional Metro Telkom for LocalLoop */}
              {!infrastrukturLocalLoop.trim().toLowerCase().includes("metronexia") && mediaKoneksiLocalLoop.trim().toLowerCase().includes("telkom") && (
                <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-5 space-y-3 mt-4 animate-fadeIn">
                  <span className="text-xs font-bold uppercase text-amber-900 block">
                    Khusus Metro Telkom (Wajib Diisi):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">SID *</label>
                      <input
                        type="text"
                        required
                        value={sid}
                        onChange={(e) => setSid(e.target.value)}
                        placeholder="TELKOM-METRO-XXXX"
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">AO *</label>
                      <input
                        type="text"
                        required
                        value={ao}
                        onChange={(e) => setAo(e.target.value)}
                        placeholder="AO-XXXX-XXXX"
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Nomor Order *</label>
                      <input
                        type="text"
                        required
                        value={nomorOrder}
                        onChange={(e) => setNomorOrder(e.target.value)}
                        placeholder="ORD-TLK-XXXX"
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* FORMAT B.2: ENTERPRISE -> COLLOCATION RACK */}
        {/* ===================================================== */}
        {kategoriLayanan === "Enterprise" && subLayanan === "Collocation Rack" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                    Data PIC & Perusahaan (Collocation)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi identitas PIC dan instansi penyewa ruang rak data center.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: Ibu Rina Suryani"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="Contoh: PT Fintek Digital Indonesia"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Email PIC / Instansi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={emailPic}
                    onChange={(e) => setEmailPic(e.target.value)}
                    placeholder="it-infrastructure@perusahaan.co.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Dynamic Kontak PIC */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nomor Kontak PIC (Bisa Lebih Dari Satu) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder={`Nomor Kontak ${idx + 1}`}
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Alamat Instalasi Data Center <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={alamatCollo}
                    onChange={(e) => setAlamatCollo(e.target.value)}
                    placeholder="Contoh: Gedung Cyber 1 Lt. 3, Ruang Server DC-02, Rack 14B..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Spesifikasi Rak & Perangkat */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Server className="w-4 h-4 mr-2 text-blue-600" />
                    Spesifikasi Layanan Collocation & Perangkat
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tipe ukuran rak, nama perangkat keras server/switch, dan Serial Number (SN).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tipe Layanan Collocation <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={tipeLayananCollo}
                    onChange={(e) => setTipeLayananCollo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold text-slate-800"
                  >
                    <option value="Full Rack 42U">Full Rack 42U</option>
                    <option value="Half Rack 21U">Half Rack 21U</option>
                    <option value="Quarter Rack 10U">Quarter Rack 10U</option>
                    <option value="1U Rackmount Server">1U Rackmount Server</option>
                    <option value="2U Rackmount Server">2U Rackmount Server</option>
                    <option value="4U Blade Chassis">4U Blade Chassis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perangkat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerangkat}
                    onChange={(e) => setNamaPerangkat(e.target.value)}
                    placeholder="Contoh: Server Dell PowerEdge R740"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Serial Number (SN) Perangkat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={snPerangkat}
                    onChange={(e) => setSnPerangkat(e.target.value)}
                    placeholder="Contoh: SN-DELL-8829104A"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-blue-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* FORMAT B.3: ENTERPRISE -> DARK FIBER */}
        {/* ===================================================== */}
        {kategoriLayanan === "Enterprise" && subLayanan === "Dark Fiber" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-purple-600" />
                    Data PIC & Perusahaan (Dark Fiber)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi PIC penanggung jawab dan instansi penyewa core optik.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="Contoh: PT Telekomunikasi Global"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                {/* Dynamic Kontak PIC */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nomor Kontak PIC <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder={`Nomor Kontak ${idx + 1}`}
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Spesifikasi Core Dark Fiber */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Radio className="w-4 h-4 mr-2 text-purple-600" />
                    Spesifikasi Layanan Core Dark Fiber & Hub
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tipe core serat optik unlit dan titik asal-tujuan (Server/Hub Hubungan).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Layanan Dark Fiber <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={layananDarkFiber}
                    onChange={(e) => setLayananDarkFiber(e.target.value)}
                    placeholder="Contoh: 2 Core (1 Pair) Single-Mode G.652D"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Server / Point of Presence Hub <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={serverDarkFiber}
                    onChange={(e) => setServerDarkFiber(e.target.value)}
                    placeholder="Contoh: POP Menara Cyber 2 -> POP Gedung Tifa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* FORMAT B.4: ENTERPRISE -> CONTENT */}
        {/* ===================================================== */}
        {kategoriLayanan === "Enterprise" && subLayanan === "Content" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Section 1: Data PIC & Perusahaan */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-amber-600" />
                    Data PIC, Perusahaan & Lokasi Peering (Content)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi identitas PIC dan lokasi interkoneksi Content Peering / CDN.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama PIC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: Irfan Maulana"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="Contoh: Cloudflare Edge Network / Google CDN"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Dynamic Kontak PIC */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      No PIC (Bisa Lebih Dari Satu) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder={`Nomor Kontak ${idx + 1}`}
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Alamat Fisik / Lokasi Peering <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={alamatContent}
                    onChange={(e) => setAlamatContent(e.target.value)}
                    placeholder="Alamat lokasi peering exchange / data center..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Parameter BGP Routing & Prefix */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-amber-600" />
                    Parameter BGP Routing & Prefix Advertise
                  </h2>
                  <p className="text-xs text-slate-500">
                    VLAN peering, IP point-to-point, AS Number, dan alokasi prefix network.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    VLAN ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={4094}
                    value={vlanContent}
                    onChange={(e) => setVlanContent(e.target.value)}
                    placeholder="2100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    IP Private P2P <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ipPrivateContent}
                    onChange={(e) => setIpPrivateContent(e.target.value)}
                    placeholder="Contoh: 10.254.10.2/30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    AS Number (ASN) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={asNumber}
                    onChange={(e) => setAsNumber(e.target.value)}
                    placeholder="Contoh: AS13335"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                {/* Dynamic Prefix Advertise (Bisa Lebih Dari Satu) */}
                <div className="md:col-span-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Prefix Advertise (Bisa Lebih Dari Satu) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPrefix}
                      className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Prefix
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {prefixList.map((prefix, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          required
                          value={prefix}
                          onChange={(e) => handleUpdatePrefix(idx, e.target.value)}
                          placeholder={`Prefix ${idx + 1} (contoh: 103.189.20.0/24)`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                        {prefixList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePrefix(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Interkoneksi & Server Core */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Network className="w-4 h-4 mr-2 text-amber-600" />
                    Interkoneksi, Layanan, Server & Media
                  </h2>
                  <p className="text-xs text-slate-500">
                    Titik temu peering, jenis paket CDN/Transit, dan router aggregator.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Interkoneksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={interkoneksiContent}
                    onChange={(e) => setInterkoneksiContent(e.target.value)}
                    placeholder="Contoh: OpenIXP / IIX APJII / Direct PNI"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Layanan Content <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={layananContent}
                    onChange={(e) => setLayananContent(e.target.value)}
                    placeholder="Contoh: Cloudflare CDN Peering"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Server / Core Peering Router <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={serverContent}
                    onChange={(e) => setServerContent(e.target.value)}
                    placeholder="Contoh: CORE-BGP-JKT-01 (Huawei NE40E)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Media Koneksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaKoneksiContent}
                    onChange={(e) => setMediaKoneksiContent(e.target.value)}
                    placeholder="Contoh: 10G Direct Fiber LC-Duplex"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* FORMAT F: ENTERPRISE - ENTERPRISE DEDICATED */}
        {/* ===================================================== */}
        {kategoriLayanan === "Enterprise" && subLayanan === "Enterprise Dedicated" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Section 1: Data PIC & Perusahaan */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                    Data Pelanggan & Lokasi Instalasi
                  </h2>
                  <p className="text-xs text-slate-500">
                    Informasi identitas PIC, perusahaan, dan alamat instalasi Enterprise Dedicated.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Nama Perusahaan */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama Perusahaan / Korporasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPerusahaan}
                    onChange={(e) => setNamaPerusahaan(e.target.value)}
                    placeholder="Contoh: PT Finansial Global Mandiri"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-900"
                  />
                </div>

                {/* Nama PIC */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nama PIC Pelanggan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPic}
                    onChange={(e) => setNamaPic(e.target.value)}
                    placeholder="Contoh: Bpk. Bambang Wijaya (IT Infrastructure Manager)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Dynamic List Kontak PIC */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Nomor Kontak PIC / WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddKontak}
                      className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      + Tambah Kontak
                    </button>
                  </div>
                  <div className="space-y-2">
                    {kontakList.map((kontak, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required={idx === 0}
                            value={kontak}
                            onChange={(e) => handleUpdateKontak(idx, e.target.value)}
                            placeholder="Contoh: 081298765432"
                            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                          />
                        </div>
                        {kontakList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKontak(idx)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alamat Instalasi */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Alamat Instalasi <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={alamatInstalasiEntDedicated}
                    onChange={(e) => setAlamatInstalasiEntDedicated(e.target.value)}
                    placeholder="Contoh: Gedung Bursa Efek Indonesia Tower 2 Lt. 18, Jl. Jend. Sudirman Kav 52-53, Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Parameter Jaringan Enterprise Dedicated */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Network className="w-4 h-4 mr-2 text-indigo-600" />
                    Parameter Layanan Enterprise Dedicated
                  </h2>
                  <p className="text-xs text-slate-500">
                    Routing, alokasi VLAN, IP subnetting, dan media transmisi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. IP Public */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    IP Public (CIDR IPv4 / IPv6)
                  </label>
                  <input
                    type="text"
                    value={ipPublicEntDedicated}
                    onChange={(e) => setIpPublicEntDedicated(e.target.value)}
                    placeholder="Contoh: 103.148.72.130/30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                {/* 2. IP Private */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    IP Private (Interkoneksi / Loopback)
                  </label>
                  <input
                    type="text"
                    value={ipPrivateEntDedicated}
                    onChange={(e) => setIpPrivateEntDedicated(e.target.value)}
                    placeholder="Contoh: 10.240.15.22/30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                {/* 3. VLAN ID */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    VLAN ID (1 - 4094) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={4094}
                    value={vlanEntDedicated}
                    onChange={(e) => setVlanEntDedicated(e.target.value)}
                    placeholder="1420"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-blue-700"
                  />
                </div>

                {/* 4. Layanan Dedicated */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Layanan Dedicated <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={layananDedicatedEnt}
                    onChange={setLayananDedicatedEnt}
                    options={DEDICATED_SERVICE_OPTIONS}
                    placeholder="Pilih atau cari kecepatan (50Mbps - 10G)..."
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pilihan 50Mbps - 1G, dan 1,1G - 10G. Klik dan ketik untuk mencari cepat.
                  </p>
                </div>

                {/* 5. Server / BRAS Aggregator */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Server / BRAS Aggregator <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={serverEntDedicated}
                    onChange={setServerEntDedicated}
                    options={serverOptions}
                    placeholder="Pilih atau cari server..."
                    required
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewServer : undefined}
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteServer : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) server.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari server. (Penambahan & penghapusan server khusus Administrator).
                    </p>
                  )}
                </div>

                {/* 6. Infrastruktur */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Infrastruktur <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {infrastructureOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={infrastrukturEntDedicated}
                    onChange={setInfrastrukturEntDedicated}
                    options={infrastructureOptions}
                    placeholder="Pilih atau cari infrastruktur..."
                    required
                    icon={<Network className="w-4 h-4 text-emerald-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewInfrastructure : undefined}
                    createLabel="Tambah pilihan infrastruktur baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteInfrastructure : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) infrastruktur.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari infrastruktur. (Penambahan & penghapusan infrastruktur khusus Administrator).
                    </p>
                  )}
                </div>

                {/* 7. Media Koneksi */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Media Koneksi <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {mediaOptions.length} Pilihan Tersedia
                    </span>
                  </div>
                  <SearchableSelect
                    value={mediaKoneksiEntDedicated}
                    onChange={setMediaKoneksiEntDedicated}
                    options={mediaOptions}
                    placeholder="Pilih atau cari media koneksi..."
                    required
                    icon={<Radio className="w-4 h-4 text-indigo-600 shrink-0" />}
                    allowCreate={isAdmin}
                    onCreateOption={isAdmin ? handleAddNewMedia : undefined}
                    createLabel="Tambah pilihan media koneksi baru"
                    allowDelete={isAdmin}
                    onDeleteOption={isAdmin ? handleDeleteMedia : undefined}
                  />
                  {isAdmin ? (
                    <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                      Mode Administrator: Ketik untuk mencari, menambah (+), atau menghapus (ikon tempat sampah) media koneksi.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik untuk mencari media koneksi. (Penambahan & penghapusan media koneksi khusus Administrator).
                    </p>
                  )}
                </div>

                {/* 8. Serial Number ONT / Modem */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Serial Number ONT / Modem
                  </label>
                  <input
                    type="text"
                    value={snOntEntDedicated}
                    onChange={(e) => setSnOntEntDedicated(e.target.value)}
                    placeholder="Contoh: ZTEGC1234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Conditional METRONEXIA */}
              {infrastrukturEntDedicated.trim().toLowerCase().includes("metronexia") && (
                <div className="bg-indigo-50/70 border border-indigo-300/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-indigo-950 font-bold">
                    <Network className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm">Konfigurasi Khusus Infrastruktur METRONEXIA</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                        SID (khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={sidEntDedicated}
                        onChange={(e) => setSidEntDedicated(e.target.value)}
                        placeholder="Contoh: SID-MTX-9821"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                        AO (khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={aoEntDedicated}
                        onChange={(e) => setAoEntDedicated(e.target.value)}
                        placeholder="Contoh: AO-MTX-2026-01"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-indigo-950 mb-1">
                        No. Order ( Khusus Metronexia) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nomorOrderEntDedicated}
                        onChange={(e) => setNomorOrderEntDedicated(e.target.value)}
                        placeholder="Contoh: ORD-MTX-7712"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    Data SID, AO, dan No. Order khusus Metronexia wajib diisi untuk koordinasi aktivasi link & cross-connect antar NOC.
                  </p>
                </div>
              )}

              {/* Conditional Metro Telkom */}
              {!infrastrukturEntDedicated.trim().toLowerCase().includes("metronexia") && mediaKoneksiEntDedicated.trim().toLowerCase().includes("telkom") && (
                <div className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-6 space-y-4 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold">
                    <Radio className="w-5 h-5 text-amber-600" />
                    <h3 className="text-sm">Konfigurasi Khusus Media Metro Telkom</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                        SID (Service ID) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={sidEntDedicated}
                        onChange={(e) => setSidEntDedicated(e.target.value)}
                        placeholder="Contoh: TELKOM-METRO-9812"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                        AO (Access Order) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={aoEntDedicated}
                        onChange={(e) => setAoEntDedicated(e.target.value)}
                        placeholder="Contoh: AO-2026-JKT-8821"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                        Nomor Order Telkom <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={nomorOrderEntDedicated}
                        onChange={(e) => setNomorOrderEntDedicated(e.target.value)}
                        placeholder="Contoh: ORD-TLK-771290"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Data SID, AO, dan Nomor Order Metro Telkom wajib diisi untuk koordinasi aktivasi link antar operator.
                  </p>
                </div>
              )}
            </div>

            {/* Note on Hasil Test */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start space-x-3 text-xs text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Hasil Test Uji Jaringan & Berita Acara:</span>
                <p className="mt-0.5 text-blue-800">
                  Hasil test (speedtest, ping test, bit error rate) akan di-upload langsung oleh tim teknisi NOC Desk pada lembar kerja Workspace Tiket sebelum status dinyatakan Go-Live (Active).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* SECTION AKHIR: Catatan Tambahan (Semua Kategori) */}
        {/* ===================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
              <FileText className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Catatan Tambahan & Instruksi Khusus
              </h2>
              <p className="text-xs text-slate-500">
                Instruksi khusus untuk tim lapangan, NOC desk, atau SLA aktivasi.
              </p>
            </div>
          </div>

          <div>
            <textarea
              rows={3}
              value={catatanTambahan}
              onChange={(e) => setCatatanTambahan(e.target.value)}
              placeholder="Contoh: Harap koordinasi dengan PIC sebelum penarikan kabel drop core..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Footer / Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/queue"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm transition"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition disabled:opacity-50 hover:scale-[1.01]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Mendaftarkan Antrean...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Simpan ke Antrean Aktivasi ({kategoriLayanan === "Enterprise" ? `Enterprise - ${subLayanan}` : "POP Site"})
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
