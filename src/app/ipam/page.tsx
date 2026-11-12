"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Globe,
  Server,
  Layers,
  Network,
  Search,
  Filter,
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
  Building2,
  Hash,
  Activity,
  SlidersHorizontal,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  SubnetSummary,
  IpamGlobalSummary,
  UsedIpDetail,
  parseCidr,
} from "@/lib/ipamUtils";

export default function IpamPage() {
  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const isAdmin = currentUser?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IpamGlobalSummary | null>(null);
  const [subnets, setSubnets] = useState<SubnetSummary[]>([]);
  const [unmanagedIps, setUnmanagedIps] = useState<UsedIpDetail[]>([]);

  // Filtering & Search
  const [selectedPrefixCidr, setSelectedPrefixCidr] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "ACTIVE" | "RESERVED">("ALL");

  // Add Prefix Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrefixCidr, setNewPrefixCidr] = useState("");
  const [newPrefixDesc, setNewPrefixDesc] = useState("");
  const [addPrefixLoading, setAddPrefixLoading] = useState(false);
  const [addPrefixError, setAddPrefixError] = useState<string | null>(null);

  // Copy notification state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchIpamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ipam");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memuat data IPAM.");
      }
      setSummary(data.data.summary);
      setSubnets(data.data.subnets || []);
      setUnmanagedIps(data.data.unmanagedIps || []);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleAddPrefix = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddPrefixLoading(true);
    setAddPrefixError(null);

    try {
      const res = await fetch("/api/ipam/prefixes", {
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
    if (!(await confirmDialog(`Hapus prefix '${cidr}' dari manajemen IPAM?`))) return;

    try {
      const res = await fetch(`/api/ipam/prefixes?cidr=${encodeURIComponent(cidr)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus prefix");
      }
      if (selectedPrefixCidr === cidr) {
        setSelectedPrefixCidr("ALL");
      }
      await fetchIpamData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal menghapus prefix");
    }
  };

  const handleResetDefaults = async () => {
    if (
      !(await confirmDialog(
        "Kembalikan seluruh konfigurasi prefix IP Public ke 5 blok prefix default sistem?"
      ))
    )
      return;

    try {
      const res = await fetch("/api/ipam/prefixes", { method: "PUT" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mereset prefix");
      }
      setSelectedPrefixCidr("ALL");
      await fetchIpamData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal mereset prefix");
    }
  };

  // Preview new prefix CIDR in modal
  const newPrefixPreview = useMemo(() => {
    if (!newPrefixCidr.trim()) return null;
    return parseCidr(newPrefixCidr.trim());
  }, [newPrefixCidr]);

  // Aggregate used IPs based on active tab selection
  const displayedUsedIps = useMemo(() => {
    let list: (UsedIpDetail & { parentSubnet?: string })[] = [];

    if (selectedPrefixCidr === "ALL") {
      subnets.forEach((s) => {
        s.usedIps.forEach((u) => list.push({ ...u, parentSubnet: s.cidr }));
      });
    } else if (selectedPrefixCidr === "UNMANAGED") {
      unmanagedIps.forEach((u) => list.push({ ...u, parentSubnet: "Luar Prefix" }));
    } else {
      const targetSubnet = subnets.find((s) => s.cidr === selectedPrefixCidr);
      if (targetSubnet) {
        targetSubnet.usedIps.forEach((u) =>
          list.push({ ...u, parentSubnet: targetSubnet.cidr })
        );
      }
    }

    // Apply status filter
    if (selectedStatusFilter === "ACTIVE") {
      list = list.filter((item) => item.source === "POP_SITE");
    } else if (selectedStatusFilter === "RESERVED") {
      list = list.filter((item) => item.source === "ORDER_QUEUE");
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.ip.toLowerCase().includes(q) ||
          item.siteId.toLowerCase().includes(q) ||
          item.namaPic.toLowerCase().includes(q) ||
          (item.namaPerusahaan && item.namaPerusahaan.toLowerCase().includes(q)) ||
          (item.vlan && item.vlan.toString().includes(q)) ||
          (item.server && item.server.toLowerCase().includes(q)) ||
          (item.infrastruktur && item.infrastruktur.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [subnets, unmanagedIps, selectedPrefixCidr, selectedStatusFilter, searchQuery]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (displayedUsedIps.length === 0) {
      void alertDialog("Tidak ada data IP untuk diexport.");
      return;
    }

    const headers = [
      "Alamat IP",
      "Status",
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

    const rows = displayedUsedIps.map((u) => [
      `"${u.ip}"`,
      `"${u.source === "POP_SITE" ? "Aktif" : "Reservasi Antrean"}"`,
      `"${u.parentSubnet || "-"}"`,
      `"${u.siteId}"`,
      `"${u.namaPic.replace(/"/g, '""')}"`,
      `"${(u.namaPerusahaan || "-").replace(/"/g, '""')}"`,
      `"${u.kategoriLayanan}"`,
      `"${u.subLayanan || "-"}"`,
      `"${u.vlan || "-"}"`,
      `"${u.server || "-"}"`,
      `"${u.infrastruktur || "-"}"`,
      `"${u.mediaKoneksi || "-"}"`,
      `"${u.statusLayanan}"`,
      `"${u.updatedAt ? new Date(u.updatedAt).toLocaleString("id-ID") : "-"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `IPAM_Prefix_Public_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUsageBarColor = (pct: number) => {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 75) return "bg-amber-500";
    if (pct >= 50) return "bg-blue-500";
    return "bg-emerald-500";
  };

  const getUsageBadgeColor = (pct: number) => {
    if (pct >= 90)
      return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    if (pct >= 75)
      return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    if (pct >= 50)
      return "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              IP Address Management (IPAM)
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              phpIPAM Architecture Engine
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Globe className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
            Prefix IP Public
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manajemen inventarisasi alokasi subnet, kalkulasi otomatis IP terpakai & bebas, serta
            rekomendasi host berikutnya dari data sirkuit POP Site & Enterprise.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchIpamData}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition shadow-xs cursor-pointer"
            title="Refresh Data IPAM"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={displayedUsedIps.length === 0}
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
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Prefix
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                title="Reset ke 5 Prefix Default"
              >
                Reset Default
              </button>
            </>
          )}
        </div>
      </div>

      {/* METRIC KPI CARDS (phpIPAM Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Prefix */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Blok Prefix</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {summary?.totalPrefixes || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Subnet terdaftar</p>
        </div>

        {/* Total Usable Host Capacity */}
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

        {/* IP Terpakai (Used) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>IP Terpakai (Used)</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
            {summary?.totalUsedIps || 0}
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5">
            Sirkuit aktif & reservasi
          </p>
        </div>

        {/* IP Tersedia (Free) */}
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

        {/* Utilisasi (%) */}
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

      {/* SUBNET CARDS GRID (phpIPAM Subnet Overviews) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center">
            <Network className="w-4 h-4 mr-2 text-blue-600" />
            Daftar Subnet Prefix IP Public ({subnets.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Klik subnet untuk melihat rincian alokasi & rekomendasi IP
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {subnets.map((subnet) => {
            const isSelected = selectedPrefixCidr === subnet.cidr;
            const barColor = getUsageBarColor(subnet.usagePct);
            const badgeColor = getUsageBadgeColor(subnet.usagePct);

            return (
              <div
                key={subnet.cidr}
                onClick={() => setSelectedPrefixCidr(isSelected ? "ALL" : subnet.cidr)}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                  isSelected
                    ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20"
                    : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Header Subnet & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-black text-base text-slate-900 dark:text-slate-100">
                        {subnet.cidr}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
                      >
                        {subnet.usagePct}% Terpakai
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {subnet.description}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePrefix(subnet.cidr);
                      }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                      title="Hapus Prefix Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* phpIPAM Usage Progress Bar */}
                <div className="space-y-1 mt-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>
                      {subnet.usedIpsCount} / {subnet.usableHosts} Host
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      Sisa: {subnet.freeIpsCount} IP
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, subnet.usagePct)}%` }}
                    />
                  </div>
                </div>

                {/* Technical Subnet Specs */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Rentang Host:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-[10px] truncate block">
                      {subnet.firstUsable} - {subnet.lastUsable}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Netmask:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-[10px]">
                      {subnet.netmask}
                    </span>
                  </div>
                </div>

                {/* Next Available IP Box */}
                {subnet.nextAvailableIp && (
                  <div className="mt-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        Next IP:
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                        {subnet.nextAvailableIp}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(subnet.nextAvailableIp!);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition flex items-center shrink-0 cursor-pointer"
                    >
                      {copiedText === subnet.nextAvailableIp ? (
                        <>
                          <Check className="w-3 h-3 mr-1 text-emerald-600" /> Disalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" /> Salin
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & TAB BAR FOR IP DETAILS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Row 1: Subnet Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> Filter Prefix:
            </span>

            <button
              type="button"
              onClick={() => setSelectedPrefixCidr("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPrefixCidr === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Semua Prefix ({subnets.reduce((acc, s) => acc + s.usedIpsCount, 0)})
            </button>

            {subnets.map((s) => (
              <button
                key={s.cidr}
                type="button"
                onClick={() => setSelectedPrefixCidr(s.cidr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition font-mono cursor-pointer ${
                  selectedPrefixCidr === s.cidr
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {s.cidr} ({s.usedIpsCount})
              </button>
            ))}

            {unmanagedIps.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPrefixCidr("UNMANAGED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedPrefixCidr === "UNMANAGED"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                Luar Prefix ({unmanagedIps.length})
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari IP, PIC, Site ID, VLAN..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Row 2: Status Toggle (All / Active POP Site / Order Queue) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-400">Tipe Alokasi:</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {[
                { label: "Semua", val: "ALL" },
                { label: "Aktif (POP & Enterprise)", val: "ACTIVE" },
                { label: "Reservasi (Antrean)", val: "RESERVED" },
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
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Menampilkan{" "}
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {displayedUsedIps.length} IP
            </span>{" "}
            tercatat
          </div>
        </div>
      </div>

      {/* TABLE OF ASSIGNED / USED IPs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-500 font-medium">Menghitung alokasi IP public...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold mt-2">Gagal Memuat Data IPAM</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : displayedUsedIps.length === 0 ? (
          <div className="py-16 text-center px-4 space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Tidak Ada IP Terpakai pada Filter Ini
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {selectedPrefixCidr !== "ALL"
                ? `Subnet prefix ${selectedPrefixCidr} masih memiliki 100% host bebas untuk dialokasikan.`
                : "Belum ada alokasi IP public yang sesuai dengan pencarian atau filter Anda."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Alamat IP Public</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Subnet Prefix</th>
                  <th className="py-3 px-4">Pelanggan & PIC</th>
                  <th className="py-3 px-4">Site ID / Ref Tiket</th>
                  <th className="py-3 px-4">Kategori Layanan</th>
                  <th className="py-3 px-4">VLAN</th>
                  <th className="py-3 px-4">Server / BRAS</th>
                  <th className="py-3 px-4">Infrastruktur</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                {displayedUsedIps.map((item, idx) => {
                  const isPopSite = item.source === "POP_SITE";

                  return (
                    <tr
                      key={`${item.ip}-${item.siteId}-${idx}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* IP Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                            {item.ip}
                          </span>
                          {item.isSubnetBlock && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              title={`Bagian dari blok alokasi ${item.rawCidr}`}
                            >
                              Blok
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

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center ${
                            isPopSite
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isPopSite ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                          />
                          {isPopSite ? "Terpakai (Aktif)" : "Reservasi Antrean"}
                        </span>
                      </td>

                      {/* Parent Subnet */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.parentSubnet || "-"}
                      </td>

                      {/* Pelanggan & PIC */}
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

                      {/* Site ID / Ticket Number */}
                      <td className="py-3 px-4 font-mono font-bold text-xs">
                        <Link
                          href={
                            isPopSite
                              ? item.kategoriLayanan === "Enterprise"
                                ? `/enterprise/${item.siteDbId}`
                                : `/pop-sites/${item.siteDbId}`
                              : `/orders/${item.siteDbId}/progress`
                          }
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                        >
                          {item.siteId}
                          <ArrowUpRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      </td>

                      {/* Kategori Layanan */}
                      <td className="py-3 px-4">
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

                      {/* VLAN */}
                      <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {item.vlan ? `VLAN ${item.vlan}` : "-"}
                      </td>

                      {/* Server / BRAS */}
                      <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {item.server || "-"}
                      </td>

                      {/* Infrastruktur */}
                      <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {item.infrastruktur || "-"}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={
                            isPopSite
                              ? item.kategoriLayanan === "Enterprise"
                                ? `/enterprise/${item.siteDbId}`
                                : `/pop-sites/${item.siteDbId}`
                              : `/orders/${item.siteDbId}/progress`
                          }
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

      {/* MODAL TAMBAH PREFIX BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Tambah Prefix IP Public
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
                  CIDR Prefix IP Public *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 103.155.196.0/23"
                  value={newPrefixCidr}
                  onChange={(e) => setNewPrefixCidr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Format harus berupa IPv4 yang valid diikuti netmask (misal /23 atau /24).
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Deskripsi / Nama Blok
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Blok IP Public APNIC / Pelanggan Dedicated"
                  value={newPrefixDesc}
                  onChange={(e) => setNewPrefixDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Preview calculation */}
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
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center"
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

