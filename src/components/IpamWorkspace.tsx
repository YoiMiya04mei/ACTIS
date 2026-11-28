"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Globe,
  Cable,
  Layers,
  Network,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Info,
  ShieldAlert,
  ArrowUpRight,
  Database,
  Activity,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  SubnetSummary,
  IpamGlobalSummary,
  UsedIpDetail,
  IpSubnetSegment,
  parseCidr,
  buildIpSubnetSegments,
  matchesIpSegmentSearch,
  suggestCandidatePrefixes,
} from "@/lib/ipamUtils";
import type { IpamScope } from "@/lib/ipamService";
import {
  SpecificationDrilldownBar,
  useUrlQuerySelection,
} from "@/components/SpecificationDrilldownBar";

type DetailAvailabilityFilter = "ALL" | "USED" | "IDLE";

interface IpamWorkspaceProps {
  scope: IpamScope;
}

export function IpamWorkspace({ scope }: IpamWorkspaceProps) {
  const isPrivate = scope === "private";
  const apiOverviewEndpoint = isPrivate ? "/api/ipam-private" : "/api/ipam";
  const apiPrefixesEndpoint = isPrivate
    ? "/api/ipam-private/prefixes"
    : "/api/ipam/prefixes";

  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const isAdmin = currentUser?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IpamGlobalSummary | null>(null);
  const [subnets, setSubnets] = useState<SubnetSummary[]>([]);
  const [unmanagedIps, setUnmanagedIps] = useState<UsedIpDetail[]>([]);

  // Filtering & Search (default empty: master list; click a prefix row to enter its specification view)
  const [selectedPrefixCidr, setSelectedPrefixCidr] = useUrlQuerySelection("prefix");
  const [prefixSearchQuery, setPrefixSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<DetailAvailabilityFilter>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "ACTIVE" | "RESERVED">("ALL");

  // Add Prefix Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrefixCidr, setNewPrefixCidr] = useState("");
  const [newPrefixDesc, setNewPrefixDesc] = useState("");
  const [addPrefixLoading, setAddPrefixLoading] = useState(false);
  const [addPrefixError, setAddPrefixError] = useState<string | null>(null);

  // Copy notification state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const pageTitle = isPrivate ? "Prefix IP Private" : "Prefix IP Public";
  const HeaderIcon = isPrivate ? Cable : Globe;

  const fetchIpamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiOverviewEndpoint);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Gagal memuat data ${pageTitle}.`);
      }
      setSummary(data.data.summary);
      setSubnets(data.data.subnets || []);
      setUnmanagedIps(data.data.unmanagedIps || []);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }, [apiOverviewEndpoint, pageTitle]);

  useEffect(() => {
    fetchIpamData();
  }, [fetchIpamData]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  const handleSelectPrefix = (cidr: string) => {
    setSelectedPrefixCidr(cidr);
    setAvailabilityFilter("ALL");
    setSelectedStatusFilter("ALL");
    setSearchQuery("");
  };

  const handleBackToPrefixList = () => {
    setSelectedPrefixCidr("");
  };

  const handleAddPrefix = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddPrefixLoading(true);
    setAddPrefixError(null);

    try {
      const res = await fetch(apiPrefixesEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cidr: newPrefixCidr.trim(),
          description: newPrefixDesc.trim(),
          actorRole: currentUser?.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menambahkan prefix");
      }

      setShowAddModal(false);
      setNewPrefixCidr("");
      setNewPrefixDesc("");
      await fetchIpamData();
    } catch (err: any) {
      setAddPrefixError(err.message || "Terjadi kesalahan saat menambah prefix");
    } finally {
      setAddPrefixLoading(false);
    }
  };

  const handleDeletePrefix = async (cidr: string) => {
    if (!(await confirmDialog(`Hapus prefix '${cidr}' dari manajemen ${pageTitle}?`))) return;

    try {
      const res = await fetch(`${apiPrefixesEndpoint}?cidr=${encodeURIComponent(cidr)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus prefix");
      }
      if (selectedPrefixCidr === cidr) {
        setSelectedPrefixCidr("");
      }
      await fetchIpamData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal menghapus prefix");
    }
  };

  const handleResetDefaults = async () => {
    const confirmMsg = isPrivate
      ? "Hapus semua blok Prefix IP Private dan kembalikan ke daftar awal kosong?"
      : "Kembalikan seluruh konfigurasi prefix IP Public ke 5 blok prefix default sistem?";
    if (!(await confirmDialog(confirmMsg))) return;

    try {
      const res = await fetch(apiPrefixesEndpoint, { method: "PUT" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mereset prefix");
      }
      setSelectedPrefixCidr("");
      await fetchIpamData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal mereset prefix");
    }
  };

  const newPrefixPreview = useMemo(() => {
    if (!newPrefixCidr.trim()) return null;
    return parseCidr(newPrefixCidr.trim());
  }, [newPrefixCidr]);

  const candidateSuggestions = useMemo(() => {
    const existing = new Set(subnets.map((s) => s.cidr.toLowerCase()));
    return suggestCandidatePrefixes(unmanagedIps).filter(
      (c) => !existing.has(c.toLowerCase())
    );
  }, [unmanagedIps, subnets]);

  const filteredSubnets = useMemo(() => {
    const q = prefixSearchQuery.trim().toLowerCase();
    if (!q) return subnets;
    return subnets.filter(
      (s) =>
        s.cidr.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.firstUsable.toLowerCase().includes(q) ||
        s.lastUsable.toLowerCase().includes(q) ||
        s.netmask.toLowerCase().includes(q)
    );
  }, [subnets, prefixSearchQuery]);

  const selectedSubnet = useMemo(() => {
    if (!selectedPrefixCidr || selectedPrefixCidr === "UNMANAGED") return null;
    return subnets.find((s) => s.cidr === selectedPrefixCidr) || null;
  }, [subnets, selectedPrefixCidr]);

  const prefixSwitchOptions = useMemo(() => {
    const opts = subnets.map((s) => ({
      value: s.cidr,
      label: `${s.cidr} (${s.usedIpsCount}/${s.usableHosts} terpakai)`,
    }));
    if (unmanagedIps.length > 0) {
      opts.push({
        value: "UNMANAGED",
        label: `IP Luar Prefix (${unmanagedIps.length})`,
      });
    }
    return opts;
  }, [subnets, unmanagedIps.length]);

  const rawSubnetSegments = useMemo(() => {
    if (!selectedSubnet) return [] as IpSubnetSegment[];
    return buildIpSubnetSegments(selectedSubnet);
  }, [selectedSubnet]);

  const idleRangeBlockCount = useMemo(
    () => rawSubnetSegments.filter((seg) => seg.type === "IDLE").length,
    [rawSubnetSegments]
  );

  const displayedSubnetSegments = useMemo(() => {
    return rawSubnetSegments.filter((seg) => {
      if (availabilityFilter === "USED" && seg.type !== "USED") return false;
      if (availabilityFilter === "IDLE" && seg.type !== "IDLE") return false;

      if (seg.type === "USED") {
        if (selectedStatusFilter === "ACTIVE" && seg.detail.source !== "POP_SITE") return false;
        if (selectedStatusFilter === "RESERVED" && seg.detail.source !== "ORDER_QUEUE") return false;
      } else if (availabilityFilter === "ALL" && selectedStatusFilter !== "ALL") {
        return false;
      }

      return matchesIpSegmentSearch(seg, searchQuery);
    });
  }, [rawSubnetSegments, availabilityFilter, selectedStatusFilter, searchQuery]);

  const displayedUnmanagedIps = useMemo(() => {
    if (selectedPrefixCidr !== "UNMANAGED") return [];
    let list = unmanagedIps.map((u) => ({ ...u, parentSubnet: "Luar Prefix" }));
    if (selectedStatusFilter === "ACTIVE") {
      list = list.filter((item) => item.source === "POP_SITE");
    } else if (selectedStatusFilter === "RESERVED") {
      list = list.filter((item) => item.source === "ORDER_QUEUE");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.ip.toLowerCase().includes(q) ||
          (item.rawCidr && item.rawCidr.toLowerCase().includes(q)) ||
          item.siteId.toLowerCase().includes(q) ||
          item.namaPic.toLowerCase().includes(q) ||
          (item.namaPerusahaan && item.namaPerusahaan.toLowerCase().includes(q)) ||
          (item.vlan && item.vlan.toString().includes(q)) ||
          (item.server && item.server.toLowerCase().includes(q)) ||
          (item.infrastruktur && item.infrastruktur.toLowerCase().includes(q))
      );
    }
    return list;
  }, [unmanagedIps, selectedPrefixCidr, selectedStatusFilter, searchQuery]);

  const totalAllUsedIpsCount = useMemo(
    () => subnets.reduce((acc, s) => acc + s.usedIps.length, 0) + unmanagedIps.length,
    [subnets, unmanagedIps]
  );

  const handleExportCsv = () => {
    const escapeCsv = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const headers = [
      isPrivate ? "Alamat IP Private / Range" : "Alamat IP / Range",
      "CIDR Asal",
      "Status",
      "Jumlah IP",
      "Subnet Prefix",
      "Site ID",
      "Nama PIC",
      "Nama Perusahaan",
      "Kategori",
      "Sub Layanan",
      "VLAN",
      "Server BRAS",
      "Infrastruktur",
      "Media Koneksi",
      "Status Layanan",
      "Terakhir Diperbarui",
    ];

    let rows: string[][] = [];

    if (selectedSubnet) {
      rows = displayedSubnetSegments.map((seg) => {
        if (seg.type === "IDLE") {
          const ipLabel =
            seg.startIp === seg.endIp ? seg.startIp : `${seg.startIp} - ${seg.endIp}`;
          return [
            escapeCsv(ipLabel),
            escapeCsv("-"),
            escapeCsv("Idle / Tersedia"),
            escapeCsv(seg.count),
            escapeCsv(selectedSubnet.cidr),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("Available"),
            escapeCsv("-"),
          ];
        }
        const u = seg.detail;
        return [
          escapeCsv(u.ip),
          escapeCsv(u.rawCidr || u.ip),
          escapeCsv(u.source === "POP_SITE" ? "Terpakai (Aktif)" : "Reservasi Antrean"),
          escapeCsv(1),
          escapeCsv(selectedSubnet.cidr),
          escapeCsv(u.siteId),
          escapeCsv(u.namaPic),
          escapeCsv(u.namaPerusahaan || "-"),
          escapeCsv(u.kategoriLayanan),
          escapeCsv(u.subLayanan || "-"),
          escapeCsv(u.vlan || "-"),
          escapeCsv(u.server || "-"),
          escapeCsv(u.infrastruktur || "-"),
          escapeCsv(u.mediaKoneksi || "-"),
          escapeCsv(u.statusLayanan),
          escapeCsv(u.updatedAt ? new Date(u.updatedAt).toLocaleString("id-ID") : "-"),
        ];
      });
    } else if (selectedPrefixCidr === "UNMANAGED") {
      rows = displayedUnmanagedIps.map((u) => [
        escapeCsv(u.ip),
        escapeCsv(u.rawCidr || u.ip),
        escapeCsv(u.source === "POP_SITE" ? "Terpakai (Aktif)" : "Reservasi Antrean"),
        escapeCsv(1),
        escapeCsv("Luar Prefix"),
        escapeCsv(u.siteId),
        escapeCsv(u.namaPic),
        escapeCsv(u.namaPerusahaan || "-"),
        escapeCsv(u.kategoriLayanan),
        escapeCsv(u.subLayanan || "-"),
        escapeCsv(u.vlan || "-"),
        escapeCsv(u.server || "-"),
        escapeCsv(u.infrastruktur || "-"),
        escapeCsv(u.mediaKoneksi || "-"),
        escapeCsv(u.statusLayanan),
        escapeCsv(u.updatedAt ? new Date(u.updatedAt).toLocaleString("id-ID") : "-"),
      ]);
    } else {
      const allRows: (UsedIpDetail & { parentSubnet: string })[] = [];
      subnets.forEach((s) => s.usedIps.forEach((u) => allRows.push({ ...u, parentSubnet: s.cidr })));
      unmanagedIps.forEach((u) => allRows.push({ ...u, parentSubnet: "Luar Prefix" }));
      rows = allRows.map((u) => [
        escapeCsv(u.ip),
        escapeCsv(u.rawCidr || u.ip),
        escapeCsv(u.source === "POP_SITE" ? "Terpakai (Aktif)" : "Reservasi Antrean"),
        escapeCsv(1),
        escapeCsv(u.parentSubnet),
        escapeCsv(u.siteId),
        escapeCsv(u.namaPic),
        escapeCsv(u.namaPerusahaan || "-"),
        escapeCsv(u.kategoriLayanan),
        escapeCsv(u.subLayanan || "-"),
        escapeCsv(u.vlan || "-"),
        escapeCsv(u.server || "-"),
        escapeCsv(u.infrastruktur || "-"),
        escapeCsv(u.mediaKoneksi || "-"),
        escapeCsv(u.statusLayanan),
        escapeCsv(u.updatedAt ? new Date(u.updatedAt).toLocaleString("id-ID") : "-"),
      ]);
    }

    if (rows.length === 0) {
      void alertDialog("Tidak ada data IP untuk diexport.");
      return;
    }

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.map(escapeCsv).join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const suffix = selectedSubnet
      ? `_${selectedSubnet.cidr.replace("/", "_")}`
      : selectedPrefixCidr === "UNMANAGED"
      ? "_Luar_Prefix"
      : "";
    const filePrefix = isPrivate ? "IPAM_Prefix_Private" : "IPAM_Prefix_Public";
    link.setAttribute(
      "download",
      `${filePrefix}${suffix}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUsageBarColor = (pct: number) => {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 75) return "bg-amber-500";
    if (pct >= 50) return isPrivate ? "bg-teal-500" : "bg-blue-500";
    return "bg-emerald-500";
  };

  const getUsageBadgeColor = (pct: number) => {
    if (pct >= 90)
      return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    if (pct >= 75)
      return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    if (pct >= 50)
      return isPrivate
        ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
        : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  };

  const getDetailLink = (item: UsedIpDetail) =>
    item.source === "POP_SITE"
      ? item.kategoriLayanan === "Enterprise"
        ? `/enterprise/${item.siteDbId}`
        : `/pop-sites/${item.siteDbId}`
      : `/orders/${item.siteDbId}/progress`;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {!selectedPrefixCidr && (
        <>
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                isPrivate
                  ? "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                  : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              }`}
            >
              IP Address Management (IPAM)
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isPrivate ? "Trigger Kolom IP Private • phpIPAM Engine" : "phpIPAM Architecture Engine"}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <HeaderIcon
              className={`w-6 h-6 mr-2 ${
                isPrivate
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            />
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isPrivate
              ? "Manajemen inventarisasi alokasi subnet IP Private (Interkoneksi / P2P /31 / Loopback) yang otomatis terisi dan berkurang saat kolom IP Private diisi pada data sirkuit POP Site, Enterprise, & Antrean."
              : "Manajemen inventarisasi alokasi subnet, kalkulasi otomatis IP terpakai & bebas, serta rekomendasi host berikutnya dari data sirkuit POP Site & Enterprise."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchIpamData}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition shadow-xs cursor-pointer"
            title={`Refresh Data ${pageTitle}`}
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading ? (isPrivate ? "animate-spin text-teal-600" : "animate-spin text-blue-600") : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || (totalAllUsedIpsCount === 0 && !selectedSubnet)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition shadow-xs cursor-pointer flex items-center disabled:opacity-50"
            title="Download Rekapitulasi CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export CSV
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center shadow-md transition cursor-pointer ${
                  isPrivate
                    ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/20"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20"
                }`}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Prefix
              </button>

              {(!isPrivate || subnets.length > 0) && (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                  title={isPrivate ? "Kosongkan Prefix IP Private" : "Reset ke 5 Prefix Default"}
                >
                  {isPrivate ? "Reset Kosong" : "Reset Default"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Blok Prefix</span>
            <Layers className={`w-4 h-4 ${isPrivate ? "text-teal-500" : "text-blue-500"}`} />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {summary?.totalPrefixes || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Subnet terdaftar</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Total Host Usable</span>
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {summary?.totalUsableHosts?.toLocaleString("id-ID") || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Dari {summary?.totalIps?.toLocaleString("id-ID") || 0} total IP
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>IP Terpakai (Used)</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
            {summary?.totalUsedIps || 0}
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5">
            {unmanagedIps.length > 0
              ? `+ ${unmanagedIps.length} IP di luar prefix`
              : "Sirkuit aktif & reservasi"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>IP Tersedia (Free)</span>
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
            {summary?.totalFreeIps?.toLocaleString("id-ID") || 0}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            Host siap digunakan
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Utilisasi IP</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${getUsageBadgeColor(
                summary?.overallUsagePct || 0
              )}`}
            >
              {summary?.overallUsagePct || 0}%
            </span>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getUsageBarColor(
                  summary?.overallUsagePct || 0
                )}`}
                style={{ width: `${Math.min(100, summary?.overallUsagePct || 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
              <span>{summary?.totalUsedIps || 0} terpakai</span>
              <span>{summary?.totalFreeIps?.toLocaleString("id-ID") || 0} bebas</span>
            </div>
          </div>
        </div>
      </div>

      {/* MASTER SUBNET PREFIX LIST TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center">
              <Network className={`w-4 h-4 mr-2 ${isPrivate ? "text-teal-600" : "text-blue-600"}`} />
              Daftar Subnet {pageTitle} ({subnets.length})
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Klik baris subnet untuk langsung masuk ke halaman spesifikasi IP terpakai &amp; range IP yang masih Idle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unmanagedIps.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelectPrefix("UNMANAGED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  selectedPrefixCidr === "UNMANAGED"
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Luar Prefix ({unmanagedIps.length})
              </button>
            )}

            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={prefixSearchQuery}
                onChange={(e) => setPrefixSearchQuery(e.target.value)}
                placeholder="Cari CIDR, deskripsi, netmask..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 outline-none bg-slate-50/70 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ${
                  isPrivate ? "focus:ring-teal-500" : "focus:ring-blue-500"
                }`}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div
              className={`inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-transparent ${
                isPrivate ? "border-teal-600" : "border-blue-600"
              }`}
            ></div>
            <p className="mt-3 text-sm text-slate-500 font-medium">
              Menghitung alokasi {isPrivate ? "IP private" : "IP public"}...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold mt-2">Gagal Memuat Data {pageTitle}</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : subnets.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3">
            <HeaderIcon
              className={`w-10 h-10 mx-auto ${
                isPrivate ? "text-teal-500/80" : "text-blue-500/80"
              }`}
            />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                Belum Ada Subnet {pageTitle} Terdaftar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                Tambahkan blok CIDR IP Private (misal <span className="font-mono font-bold">1.1.1.0/24</span> atau{" "}
                <span className="font-mono font-bold">10.254.0.0/24</span>) agar sistem otomatis melacak IP terpakai dan sisa host Idle dari pengisian kolom <strong>IP Private</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold inline-flex items-center shadow-sm cursor-pointer ${
                    isPrivate
                      ? "bg-teal-600 hover:bg-teal-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tambah Prefix IP Private
                </button>
              )}
              {unmanagedIps.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectPrefix("UNMANAGED")}
                  className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                  Lihat {unmanagedIps.length} IP Private Luar Prefix
                </button>
              )}
            </div>
          </div>
        ) : filteredSubnets.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Tidak ada subnet {pageTitle.toLowerCase()} yang cocok dengan pencarian Anda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Subnet Prefix &amp; Deskripsi</th>
                  <th className="py-3 px-4">Rentang Host Usable</th>
                  <th className="py-3 px-4">Netmask</th>
                  <th className="py-3 px-4 text-right">Terpakai</th>
                  <th className="py-3 px-4 text-right">Idle (Free)</th>
                  <th className="py-3 px-4">Utilisasi</th>
                  <th className="py-3 px-4">Next IP</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                {filteredSubnets.map((subnet) => {
                  const isSelected = selectedPrefixCidr === subnet.cidr;
                  const barColor = getUsageBarColor(subnet.usagePct);
                  const badgeColor = getUsageBadgeColor(subnet.usagePct);

                  return (
                    <tr
                      key={subnet.cidr}
                      onClick={() => handleSelectPrefix(subnet.cidr)}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? isPrivate
                            ? "bg-teal-50/90 dark:bg-teal-950/45 ring-1 ring-inset ring-teal-500/40"
                            : "bg-blue-50/90 dark:bg-blue-950/45 ring-1 ring-inset ring-blue-500/40"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`p-1 rounded-lg transition ${
                              isSelected
                                ? isPrivate
                                  ? "bg-teal-600 text-white"
                                  : "bg-blue-600 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {isSelected ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100 block">
                              {subnet.cidr}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-xs">
                              {subnet.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {subnet.firstUsable} - {subnet.lastUsable}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {subnet.netmask}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          {subnet.usedIpsCount.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          / {subnet.usableHosts.toLocaleString("id-ID")}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {subnet.freeIpsCount.toLocaleString("id-ID")} IP
                        </span>
                      </td>

                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${Math.min(100, subnet.usagePct)}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}
                          >
                            {subnet.usagePct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {subnet.nextAvailableIp ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                            <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                              {subnet.nextAvailableIp}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(subnet.nextAvailableIp!);
                              }}
                              className={`${
                                isPrivate
                                  ? "text-teal-600 dark:text-teal-400 hover:text-teal-700"
                                  : "text-blue-600 dark:text-blue-400 hover:text-blue-700"
                              } cursor-pointer`}
                              title={`Salin ${subnet.nextAvailableIp}`}
                            >
                              {copiedText === subnet.nextAvailableIp ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-500">Penuh</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 ${
                              isPrivate
                                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            <span>Spesifikasi</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </span>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePrefix(subnet.cidr);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                              title="Hapus Prefix Ini"
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
        )}
      </div>
        </>
      )}

      {/* DEDICATED SPECIFICATION HEADER & STATE WHEN ENTERING A PREFIX / UNMANAGED LIST ITEM */}
      {selectedPrefixCidr && (
        <>
          <SpecificationDrilldownBar
            listLabel={pageTitle}
            selectedLabel={
              selectedPrefixCidr === "UNMANAGED"
                ? "IP di Luar Prefix"
                : selectedSubnet?.cidr || selectedPrefixCidr
            }
            specLabel={
              selectedPrefixCidr === "UNMANAGED"
                ? "Daftar IP Terpakai Luar Prefix"
                : "Spesifikasi Subnet & Alokasi IP"
            }
            accentColor={
              selectedPrefixCidr === "UNMANAGED"
                ? "rose"
                : isPrivate
                ? "teal"
                : "blue"
            }
            onBack={handleBackToPrefixList}
            switchOptions={prefixSwitchOptions}
            currentSwitchValue={selectedPrefixCidr}
            onSwitchValue={(val) => handleSelectPrefix(val)}
            switchPlaceholder="Pindah Subnet..."
            actions={
              <>
                <button
                  type="button"
                  onClick={fetchIpamData}
                  disabled={loading}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  title={`Refresh Data ${pageTitle}`}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      loading
                        ? isPrivate
                          ? "animate-spin text-teal-600"
                          : "animate-spin text-blue-600"
                        : ""
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={loading || (totalAllUsedIpsCount === 0 && !selectedSubnet)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center disabled:opacity-50"
                  title="Download Rekapitulasi CSV"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Export CSV
                </button>
              </>
            }
          />

          {loading && (
            <div className="py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-center">
              <div
                className={`inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-transparent ${
                  isPrivate ? "border-teal-600" : "border-blue-600"
                }`}
              ></div>
              <p className="mt-3 text-sm text-slate-500 font-medium">
                Memuat spesifikasi subnet {selectedPrefixCidr}...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 text-center text-rose-600">
              <AlertTriangle className="w-8 h-8 mx-auto" />
              <p className="font-bold mt-2">Gagal Memuat Data {pageTitle}</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          )}

          {!loading &&
            !error &&
            selectedPrefixCidr !== "UNMANAGED" &&
            !selectedSubnet && (
              <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Prefix Tidak Ditemukan
                </h3>
                <p className="text-xs text-slate-500">
                  Subnet <span className="font-mono font-bold">{selectedPrefixCidr}</span> tidak terdaftar di {pageTitle}.
                </p>
                <button
                  type="button"
                  onClick={handleBackToPrefixList}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Kembali ke Daftar Subnet
                </button>
              </div>
            )}
        </>
      )}

      {/* DETAIL BREAKDOWN FOR SELECTED SUBNET */}
      {!loading && !error && selectedSubnet && (
        <div
          className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden animate-fadeIn ${
            isPrivate
              ? "border-teal-200/90 dark:border-teal-900/70"
              : "border-blue-200/90 dark:border-blue-900/70"
          }`}
        >
          <div
            className={`p-4 sm:p-5 bg-gradient-to-r border-b border-slate-200/80 dark:border-slate-800 space-y-4 ${
              isPrivate
                ? "from-slate-50 to-teal-50/40 dark:from-slate-900 dark:to-teal-950/20"
                : "from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-blue-950/20"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white ${
                      isPrivate ? "bg-teal-600" : "bg-blue-600"
                    }`}
                  >
                    Subnet Dipilih
                  </span>
                  <h3 className="font-mono font-black text-lg text-slate-900 dark:text-slate-100">
                    {selectedSubnet.cidr}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    &bull; {selectedSubnet.description}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Rentang Host: {selectedSubnet.firstUsable} - {selectedSubnet.lastUsable} &bull; Netmask: {selectedSubnet.netmask}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
                    IP Terpakai
                  </span>
                  <span className="font-mono font-black text-sm text-amber-800 dark:text-amber-200">
                    {selectedSubnet.usedIpsCount.toLocaleString("id-ID")} IP
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                    IP Idle (Tersedia)
                  </span>
                  <span className="font-mono font-black text-sm text-emerald-800 dark:text-emerald-200">
                    {selectedSubnet.freeIpsCount.toLocaleString("id-ID")} IP
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Utilisasi ({selectedSubnet.usableHosts} Host)
                  </span>
                  <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                    {selectedSubnet.usagePct}%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPrefixCidr("")}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  title="Tutup Rincian Subnet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      availabilityFilter === "ALL"
                        ? isPrivate
                          ? "bg-teal-600 text-white shadow-xs"
                          : "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    Semua (Terpakai &amp; Idle)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("USED")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      availabilityFilter === "USED"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    Terpakai ({selectedSubnet.usedIps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("IDLE")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      availabilityFilter === "IDLE"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    }`}
                  >
                    Idle ({idleRangeBlockCount} Blok &bull; {selectedSubnet.freeIpsCount.toLocaleString("id-ID")} IP)
                  </button>
                </div>

                {availabilityFilter !== "IDLE" && (
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    {[
                      { label: "Semua Tipe", val: "ALL" },
                      { label: "Aktif", val: "ACTIVE" },
                      { label: "Reservasi", val: "RESERVED" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setSelectedStatusFilter(opt.val as any)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                          selectedStatusFilter === opt.val
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative w-full lg:w-72 shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari IP, range idle, PIC, Site ID..."
                  className={`w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ${
                    isPrivate ? "focus:ring-teal-500" : "focus:ring-blue-500"
                  }`}
                />
              </div>
            </div>
          </div>

          {displayedSubnetSegments.length === 0 ? (
            <div className="py-14 text-center px-4 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Tidak Ada Baris IP yang Cocok
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Ubah kata kunci pencarian atau filter status untuk melihat data IP terpakai dan blok Idle pada prefix {selectedSubnet.cidr}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">
                      {isPrivate ? "Alamat IP Private / Range Idle" : "Alamat IP / Range Idle"}
                    </th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Pelanggan &amp; PIC / Keterangan</th>
                    <th className="py-3 px-4">Site ID / Ref Tiket</th>
                    <th className="py-3 px-4">Kategori Layanan</th>
                    <th className="py-3 px-4">VLAN</th>
                    <th className="py-3 px-4">Server / BRAS</th>
                    <th className="py-3 px-4">Infrastruktur</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                  {displayedSubnetSegments.map((seg) => {
                    if (seg.type === "IDLE") {
                      const rangeLabel =
                        seg.startIp === seg.endIp
                          ? seg.startIp
                          : `${seg.startIp} - ${seg.endIp}`;
                      return (
                        <tr
                          key={seg.key}
                          className="bg-emerald-50/90 dark:bg-emerald-950/45 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border-l-4 border-l-emerald-500 transition"
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-emerald-800 dark:text-emerald-200">
                                {rangeLabel}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                                ({seg.count.toLocaleString("id-ID")})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 inline-flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500" />
                              Idle / Tersedia
                            </span>
                          </td>
                          <td
                            colSpan={6}
                            className="py-2.5 px-4 text-[11px] font-medium text-emerald-800/90 dark:text-emerald-300"
                          >
                            {seg.count.toLocaleString("id-ID")} IP host bebas tersedia dalam subnet {selectedSubnet.cidr} &bull; Rekomendasi host pertama:{" "}
                            <span className="font-mono font-bold">{seg.startIp}</span>
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCopy(seg.startIp)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              title={`Salin IP ${seg.startIp}`}
                            >
                              {copiedText === seg.startIp ? (
                                <>
                                  <Check className="w-3 h-3" /> Disalin
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Salin {seg.startIp}
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const item = seg.detail;
                    const isPopSite = item.source === "POP_SITE";
                    const cidrSuffix =
                      item.isSubnetBlock && item.rawCidr?.includes("/")
                        ? `Blok /${item.rawCidr.split("/")[1]}`
                        : "Blok";

                    return (
                      <tr
                        key={seg.key}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`font-mono font-bold text-xs ${
                                isPrivate
                                  ? "text-teal-700 dark:text-teal-400"
                                  : "text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {item.ip}
                            </span>
                            {item.isSubnetBlock && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                title={`Bagian dari blok alokasi ${item.rawCidr}`}
                              >
                                {cidrSuffix}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopy(item.ip)}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                              title="Salin IP"
                            >
                              {copiedText === item.ip ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center ${
                              isPopSite
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                isPopSite ? "bg-amber-500" : "bg-blue-500"
                              }`}
                            />
                            {isPopSite ? "Terpakai (Aktif)" : "Reservasi Antrean"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {item.namaPic}
                            </span>
                            {item.namaPerusahaan && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {item.namaPerusahaan}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-xs whitespace-nowrap">
                          <Link
                            href={getDetailLink(item)}
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                          >
                            {item.siteId}
                            <ArrowUpRight className="w-3 h-3 ml-0.5" />
                          </Link>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              item.kategoriLayanan === "Enterprise"
                                ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            }`}
                          >
                            {item.kategoriLayanan}
                            {item.subLayanan ? ` • ${item.subLayanan}` : ""}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {item.vlan ? `VLAN ${item.vlan}` : "-"}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                          {item.server || "-"}
                        </td>

                        <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                          {item.infrastruktur || "-"}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Link
                            href={getDetailLink(item)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition inline-flex items-center"
                          >
                            Buka <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL VIEW FOR UNMANAGED IPs ("Luar Prefix") */}
      {!loading && !error && selectedPrefixCidr === "UNMANAGED" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/90 dark:border-rose-900/70 shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-4 sm:p-5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-200/70 dark:border-rose-900/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {isPrivate
                  ? `IP Private di Luar Prefix Terdaftar (${displayedUnmanagedIps.length})`
                  : `IP Public di Luar Prefix Terdaftar (${displayedUnmanagedIps.length})`}
              </h3>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                IP berikut tercatat terpakai dari kolom{" "}
                <strong className="font-mono">{isPrivate ? "IP Private" : "IP Public"}</strong>{" "}
                sirkuit namun belum masuk ke blok CIDR yang terdaftar di {pageTitle}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {[
                  { label: "Semua", val: "ALL" },
                  { label: "Aktif", val: "ACTIVE" },
                  { label: "Reservasi", val: "RESERVED" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSelectedStatusFilter(opt.val as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      selectedStatusFilter === opt.val
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari IP, PIC, Site ID..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setSelectedPrefixCidr("")}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">
                    {isPrivate ? "Alamat IP Private" : "Alamat IP Public"}
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Pelanggan &amp; PIC</th>
                  <th className="py-3 px-4">Site ID / Ref Tiket</th>
                  <th className="py-3 px-4">Kategori Layanan</th>
                  <th className="py-3 px-4">VLAN</th>
                  <th className="py-3 px-4">Server / BRAS</th>
                  <th className="py-3 px-4">Infrastruktur</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                {displayedUnmanagedIps.map((item, idx) => {
                  const isPopSite = item.source === "POP_SITE";
                  return (
                    <tr
                      key={`${item.ip}-${item.siteId}-${idx}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400">
                        <div className="flex items-center gap-1.5">
                          <span>{item.ip}</span>
                          {item.isSubnetBlock && item.rawCidr && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              title={`CIDR asal: ${item.rawCidr}`}
                            >
                              {item.rawCidr.includes("/") ? `/${item.rawCidr.split("/")[1]}` : "Blok"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                          {isPopSite ? "Terpakai (Aktif)" : "Reservasi Antrean"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {item.namaPic}
                        </span>
                        {item.namaPerusahaan && (
                          <span className="text-[10px] text-slate-400 block">
                            {item.namaPerusahaan}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <Link
                          href={getDetailLink(item)}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                        >
                          {item.siteId}
                          <ArrowUpRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      </td>
                      <td className="py-3 px-4">{item.kategoriLayanan}</td>
                      <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                        {item.vlan ? `VLAN ${item.vlan}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-[11px]">{item.server || "-"}</td>
                      <td className="py-3 px-4 text-[11px]">{item.infrastruktur || "-"}</td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={getDetailLink(item)}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center"
                        >
                          Buka <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PREFIX BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <HeaderIcon className={`w-5 h-5 ${isPrivate ? "text-teal-600" : "text-blue-600"}`} />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Tambah {pageTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {addPrefixError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addPrefixError}</span>
              </div>
            )}

            <form onSubmit={handleAddPrefix} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  CIDR {pageTitle} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isPrivate ? "Contoh: 10.254.0.0/24 atau 1.1.1.0/24" : "Contoh: 103.155.196.0/23"}
                  value={newPrefixCidr}
                  onChange={(e) => setNewPrefixCidr(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 outline-none ${
                    isPrivate ? "focus:ring-teal-500" : "focus:ring-blue-500"
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isPrivate
                    ? "Format harus IPv4 CIDR valid (misal /24, /28, /30, atau /31 point-to-point)."
                    : "Format harus berupa IPv4 yang valid diikuti netmask (misal /23 atau /24)."}
                </p>

                {candidateSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Terdeteksi di data IP:
                    </span>
                    {candidateSuggestions.map((cand) => (
                      <button
                        key={cand}
                        type="button"
                        onClick={() => setNewPrefixCidr(cand)}
                        className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                      >
                        + {cand}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Deskripsi / Nama Blok
                </label>
                <input
                  type="text"
                  placeholder={
                    isPrivate
                      ? "Contoh: Pool IP Private P2P / Loopback POP"
                      : "Contoh: Blok IP Public APNIC / Pelanggan Dedicated"
                  }
                  value={newPrefixDesc}
                  onChange={(e) => setNewPrefixDesc(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 outline-none ${
                    isPrivate ? "focus:ring-teal-500" : "focus:ring-blue-500"
                  }`}
                />
              </div>

              {newPrefixPreview && (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1 text-[11px]">
                  <span className="font-bold text-blue-900 dark:text-blue-300 block">
                    Kalkulasi Subnet Otomatis:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    <div>Netmask: {newPrefixPreview.netmask}</div>
                    <div>Total IP: {newPrefixPreview.totalIps}</div>
                    <div>Network: {newPrefixPreview.network}</div>
                    <div>Broadcast: {newPrefixPreview.broadcast}</div>
                    <div className="col-span-2">
                      Usable: {newPrefixPreview.firstUsable} - {newPrefixPreview.lastUsable} (
                      {newPrefixPreview.usableHosts} host)
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addPrefixLoading || !newPrefixPreview}
                  className={`px-4 py-2 rounded-xl text-white font-bold transition shadow-md disabled:opacity-50 cursor-pointer flex items-center ${
                    isPrivate
                      ? "bg-teal-600 hover:bg-teal-700 shadow-teal-500/20"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                  }`}
                >
                  {addPrefixLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Prefix"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
