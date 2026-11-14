"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Tags,
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
  Copy,
  Check,
  Download,
  ArrowUpRight,
  Database,
  Activity,
  SlidersHorizontal,
  Grid,
  List,
  RotateCcw,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  MIN_VLAN_ID,
  MAX_VLAN_ID,
  ELIGIBLE_VLAN_SERVICES,
  EligibleVlanService,
  ServerVlanSummary,
  UsedVlanDetail,
  UnassignedVlanCircuit,
  VlanGlobalSummary,
  normalizeServerKey,
} from "@/lib/vlanUtils";

type ViewTab = "UNAVAILABLE" | "AVAILABLE_GRID" | "UNASSIGNED";
type GridStatusFilter = "ALL" | "AVAILABLE" | "UNAVAILABLE";

const BLOCK_SIZE = 200;

export default function VlanManagementPage() {
  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const isAdmin = currentUser?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<VlanGlobalSummary | null>(null);
  const [servers, setServers] = useState<ServerVlanSummary[]>([]);
  const [usedVlans, setUsedVlans] = useState<UsedVlanDetail[]>([]);
  const [unassignedCircuits, setUnassignedCircuits] = useState<UnassignedVlanCircuit[]>([]);

  // Active workspace controls
  const [activeTab, setActiveTab] = useState<ViewTab>("UNAVAILABLE");
  const [selectedServer, setSelectedServer] = useState<string>("ALL");
  const [selectedService, setSelectedService] = useState<string>("ALL");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Checker state
  const [checkerServer, setCheckerServer] = useState<string>("");
  const [checkerVlan, setCheckerVlan] = useState<string>("");

  // Available & Grid Pool controls
  const [gridServer, setGridServer] = useState<string>("");
  const [gridStatusFilter, setGridStatusFilter] = useState<GridStatusFilter>("ALL");
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(4094);
  const [blockPage, setBlockPage] = useState<number>(0);
  const [inspectedVlan, setInspectedVlan] = useState<number | null>(null);

  // Admin Range Modal state
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [modalServerName, setModalServerName] = useState("");
  const [modalStartVlan, setModalStartVlan] = useState("1");
  const [modalEndVlan, setModalEndVlan] = useState("4094");
  const [modalDesc, setModalDesc] = useState("");
  const [savingRange, setSavingRange] = useState(false);
  const [rangeModalError, setRangeModalError] = useState<string | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchVlanData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vlan");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data VLAN Management.");
      }
      const data = json.data;
      setSummary(data.summary);
      setServers(data.servers || []);
      setUsedVlans(data.usedVlans || []);
      setUnassignedCircuits(data.unassignedCircuits || []);

      if (data.servers?.length > 0) {
        setCheckerServer((prev) =>
          prev && data.servers.some((s: ServerVlanSummary) => s.serverName === prev)
            ? prev
            : data.servers[0].serverName
        );
        setGridServer((prev) =>
          prev && data.servers.some((s: ServerVlanSummary) => s.serverName === prev)
            ? prev
            : data.servers[0].serverName
        );
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVlanData();
  }, [fetchVlanData]);

  const handleCopy = (text: string, key = text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  // Sync gridServer & range defaults when user selects a server card
  const handleSelectServerCard = (serverSummary: ServerVlanSummary) => {
    const isDeselecting = selectedServer === serverSummary.serverName;
    if (isDeselecting) {
      setSelectedServer("ALL");
    } else {
      setSelectedServer(serverSummary.serverName);
      setGridServer(serverSummary.serverName);
      setCheckerServer(serverSummary.serverName);
      setRangeStart(serverSummary.startVlan);
      setRangeEnd(serverSummary.endVlan);
      setBlockPage(0);
      setInspectedVlan(null);
    }
  };

  // Switch to Grid/Available tab ensuring a concrete server is selected
  const handleSwitchTab = (tab: ViewTab) => {
    setActiveTab(tab);
    if (tab === "AVAILABLE_GRID") {
      const targetName =
        selectedServer !== "ALL"
          ? selectedServer
          : gridServer || servers[0]?.serverName || "";
      if (targetName) {
        setGridServer(targetName);
        const srv = servers.find((s) => s.serverName === targetName);
        if (srv) {
          setRangeStart(srv.startVlan);
          setRangeEnd(srv.endVlan);
          setBlockPage(0);
        }
      }
    }
  };

  // Quick Checker evaluation
  const checkerResult = useMemo(() => {
    const targetKey = normalizeServerKey(checkerServer);
    const parsedVlan = parseInt(checkerVlan.trim(), 10);
    if (!targetKey || isNaN(parsedVlan) || parsedVlan < MIN_VLAN_ID || parsedVlan > MAX_VLAN_ID) {
      return null;
    }
    const matches = usedVlans.filter(
      (u) => normalizeServerKey(u.server) === targetKey && u.vlan === parsedVlan
    );
    return {
      server: checkerServer,
      vlan: parsedVlan,
      available: matches.length === 0,
      matches,
    };
  }, [checkerServer, checkerVlan, usedVlans]);

  // Filtered Unavailable rows
  const filteredUsedVlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const targetKey = selectedServer === "ALL" ? null : normalizeServerKey(selectedServer);

    return usedVlans.filter((item) => {
      if (targetKey && normalizeServerKey(item.server) !== targetKey) return false;
      if (selectedService !== "ALL" && item.serviceLabel !== selectedService) return false;
      if (onlyDuplicates && !item.isDuplicate) return false;

      if (q) {
        const hit =
          String(item.vlan).includes(q) ||
          item.server.toLowerCase().includes(q) ||
          item.siteId.toLowerCase().includes(q) ||
          item.namaPic.toLowerCase().includes(q) ||
          (item.namaPerusahaan && item.namaPerusahaan.toLowerCase().includes(q)) ||
          item.serviceLabel.toLowerCase().includes(q) ||
          (item.ipPublic && item.ipPublic.toLowerCase().includes(q)) ||
          (item.ipPrivate && item.ipPrivate.toLowerCase().includes(q)) ||
          (item.infrastruktur && item.infrastruktur.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [usedVlans, selectedServer, selectedService, onlyDuplicates, searchQuery]);

  // Filtered Unassigned VLAN circuits
  const filteredUnassigned = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const targetKey = selectedServer === "ALL" ? null : normalizeServerKey(selectedServer);

    return unassignedCircuits.filter((item) => {
      if (targetKey && normalizeServerKey(item.server) !== targetKey) return false;
      if (selectedService !== "ALL" && item.serviceLabel !== selectedService) return false;
      if (q) {
        const hit =
          item.siteId.toLowerCase().includes(q) ||
          item.namaPic.toLowerCase().includes(q) ||
          (item.namaPerusahaan && item.namaPerusahaan.toLowerCase().includes(q)) ||
          (item.server && item.server.toLowerCase().includes(q)) ||
          item.serviceLabel.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [unassignedCircuits, selectedServer, selectedService, searchQuery]);

  // Active Server summary & map for Grid / Available view
  const activeGridServerSummary = useMemo(() => {
    const key = normalizeServerKey(gridServer);
    return servers.find((s) => normalizeServerKey(s.serverName) === key) || servers[0] || null;
  }, [servers, gridServer]);

  const gridUsedByVlanMap = useMemo(() => {
    const map = new Map<number, UsedVlanDetail[]>();
    if (!activeGridServerSummary) return map;
    const targetKey = normalizeServerKey(activeGridServerSummary.serverName);
    for (const row of usedVlans) {
      if (normalizeServerKey(row.server) !== targetKey) continue;
      if (selectedService !== "ALL" && row.serviceLabel !== selectedService) continue;
      const list = map.get(row.vlan) || [];
      list.push(row);
      map.set(row.vlan, list);
    }
    return map;
  }, [usedVlans, activeGridServerSummary, selectedService]);

  const gridAllUsedSet = useMemo(() => {
    return new Set<number>(activeGridServerSummary?.usedVlanNumbers || []);
  }, [activeGridServerSummary]);

  // Filtered VLAN integer list for Grid / Available tab
  const gridMatchingVlans = useMemo(() => {
    const start = Math.max(MIN_VLAN_ID, Math.min(MAX_VLAN_ID, rangeStart || MIN_VLAN_ID));
    const end = Math.max(start, Math.min(MAX_VLAN_ID, rangeEnd || MAX_VLAN_ID));
    const searchNum = /^\d+$/.test(searchQuery.trim()) ? searchQuery.trim() : null;
    const searchLower = searchQuery.trim().toLowerCase();

    const list: number[] = [];
    for (let v = start; v <= end; v++) {
      const isUsedAnywhereOnServer = gridAllUsedSet.has(v);
      const matchingRows = gridUsedByVlanMap.get(v) || [];

      if (gridStatusFilter === "AVAILABLE" && isUsedAnywhereOnServer) continue;
      if (gridStatusFilter === "UNAVAILABLE") {
        if (selectedService === "ALL" && !isUsedAnywhereOnServer) continue;
        if (selectedService !== "ALL" && matchingRows.length === 0) continue;
      }

      if (searchLower) {
        if (searchNum) {
          if (!String(v).includes(searchNum)) continue;
        } else {
          // Non-numeric text search matches only occupied VLAN rows' metadata
          if (
            matchingRows.length === 0 ||
            !matchingRows.some(
              (r) =>
                r.siteId.toLowerCase().includes(searchLower) ||
                r.namaPic.toLowerCase().includes(searchLower) ||
                (r.namaPerusahaan && r.namaPerusahaan.toLowerCase().includes(searchLower))
            )
          ) {
            continue;
          }
        }
      }

      list.push(v);
    }
    return list;
  }, [
    rangeStart,
    rangeEnd,
    gridAllUsedSet,
    gridUsedByVlanMap,
    gridStatusFilter,
    selectedService,
    searchQuery,
  ]);

  const totalBlockPages = Math.max(1, Math.ceil(gridMatchingVlans.length / BLOCK_SIZE));
  const safeBlockPage = Math.min(blockPage, totalBlockPages - 1);
  const currentGridSlice = useMemo(() => {
    const offset = safeBlockPage * BLOCK_SIZE;
    return gridMatchingVlans.slice(offset, offset + BLOCK_SIZE);
  }, [gridMatchingVlans, safeBlockPage]);

  // Open Range/Server modal
  const openRangeModal = (srv?: ServerVlanSummary) => {
    setRangeModalError(null);
    if (srv) {
      setModalServerName(srv.serverName);
      setModalStartVlan(String(srv.startVlan));
      setModalEndVlan(String(srv.endVlan));
      setModalDesc(srv.hasCustomRange ? srv.description : "");
    } else {
      setModalServerName("");
      setModalStartVlan("1");
      setModalEndVlan("4094");
      setModalDesc("");
    }
    setShowRangeModal(true);
  };

  const handleSaveServerRange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRange(true);
    setRangeModalError(null);

    try {
      const res = await fetch("/api/vlan/ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverName: modalServerName.trim(),
          startVlan: parseInt(modalStartVlan, 10),
          endVlan: parseInt(modalEndVlan, 10),
          description: modalDesc.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan range VLAN server.");
      }
      setShowRangeModal(false);
      await fetchVlanData();
    } catch (err: any) {
      setRangeModalError(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSavingRange(false);
    }
  };

  const handleResetServerRange = async (serverName: string) => {
    if (
      !(await confirmDialog(
        `Kembalikan range VLAN server '${serverName}' ke standar IEEE 802.1Q (1 - 4094)?`
      ))
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/vlan/ranges?serverName=${encodeURIComponent(serverName)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mereset range server.");
      }
      await fetchVlanData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal mereset range VLAN server.");
    }
  };

  const handleResetAllRanges = async () => {
    if (
      !(await confirmDialog(
        "Kembalikan seluruh custom range VLAN server ke standar IEEE 802.1Q (1 - 4094)?"
      ))
    ) {
      return;
    }
    try {
      const res = await fetch("/api/vlan/ranges", { method: "PUT" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mereset seluruh range.");
      }
      await fetchVlanData();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal mereset range VLAN.");
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const escapeCsv = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    if (activeTab === "AVAILABLE_GRID" && activeGridServerSummary) {
      const headers = ["VLAN ID", "Server", "Status", "Site ID", "Pelanggan & PIC", "Kategori Layanan"];
      const rows = gridMatchingVlans.map((v) => {
        const occ = gridUsedByVlanMap.get(v) || [];
        const isUsed = gridAllUsedSet.has(v);
        if (!isUsed) {
          return [
            escapeCsv(v),
            escapeCsv(activeGridServerSummary.serverName),
            escapeCsv("Available"),
            escapeCsv("-"),
            escapeCsv("-"),
            escapeCsv("-"),
          ].join(",");
        }
        return [
          escapeCsv(v),
          escapeCsv(activeGridServerSummary.serverName),
          escapeCsv("Unavailable"),
          escapeCsv(occ.map((o) => o.siteId).join(" | ") || "-"),
          escapeCsv(occ.map((o) => o.namaPerusahaan || o.namaPic).join(" | ") || "-"),
          escapeCsv(occ.map((o) => o.serviceLabel).join(" | ") || "-"),
        ].join(",");
      });

      const csv = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `VLAN_Pool_${activeGridServerSummary.serverName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const headers = [
      "VLAN ID",
      "Status",
      "Server / BRAS",
      "Site ID",
      "Perusahaan",
      "PIC",
      "Kategori Layanan",
      "IP Public",
      "IP Private",
      "Infrastruktur",
      "Media Koneksi",
      "Status Layanan",
      "Duplikat",
    ];
    const rows = filteredUsedVlans.map((u) =>
      [
        escapeCsv(u.vlan),
        escapeCsv("Unavailable"),
        escapeCsv(u.server),
        escapeCsv(u.siteId),
        escapeCsv(u.namaPerusahaan || "-"),
        escapeCsv(u.namaPic),
        escapeCsv(u.serviceLabel),
        escapeCsv(u.ipPublic || "-"),
        escapeCsv(u.ipPrivate || "-"),
        escapeCsv(u.infrastruktur || "-"),
        escapeCsv(u.mediaKoneksi || "-"),
        escapeCsv(u.statusLayanan),
        escapeCsv(u.isDuplicate ? `Ya (${u.duplicateTotal}x)` : "Tidak"),
      ].join(",")
    );

    const csv = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VLAN_Management_Unavailable_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getUsageBarColor = (pct: number) => {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 75) return "bg-amber-500";
    if (pct >= 50) return "bg-indigo-500";
    return "bg-emerald-500";
  };

  const getUsageBadgeColor = (pct: number) => {
    if (pct >= 90)
      return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    if (pct >= 75)
      return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    if (pct >= 50)
      return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  };

  const getServiceBadgeColor = (service: EligibleVlanService) => {
    switch (service) {
      case "POP Site":
        return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "LocalLoop":
        return "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      case "Content":
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Enterprise Dedicated":
        return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    }
  };

  const getCircuitHref = (kategoriLayanan: string, siteDbId: string) =>
    kategoriLayanan.trim().toLowerCase() === "enterprise"
      ? `/enterprise/${siteDbId}`
      : `/pop-sites/${siteDbId}`;

  const hasCustomRangeConfigured = useMemo(
    () => servers.some((s) => s.hasCustomRange),
    [servers]
  );

  const inspectedVlanOccurrences = useMemo(() => {
    if (inspectedVlan === null) return [];
    if (!activeGridServerSummary) return [];
    const key = normalizeServerKey(activeGridServerSummary.serverName);
    return usedVlans.filter(
      (u) => normalizeServerKey(u.server) === key && u.vlan === inspectedVlan
    );
  }, [inspectedVlan, activeGridServerSummary, usedVlans]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
              VLAN Management • IEEE 802.1Q
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Per-Server Provisioning Inventory
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Tags className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" />
            VLAN Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pantau status VLAN <strong>Available</strong> dan <strong>Unavailable</strong> per Server
            berdasarkan sirkuit yang sudah teraktivasi (<strong>POP Site</strong>,{" "}
            <strong>LocalLoop</strong>, <strong>Content</strong>, dan{" "}
            <strong>Enterprise Dedicated</strong>).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchVlanData}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition shadow-xs cursor-pointer"
            title="Refresh Data VLAN"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || servers.length === 0}
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
                onClick={() => openRangeModal()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center shadow-md shadow-indigo-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Atur / Tambah Server
              </button>

              {hasCustomRangeConfigured && (
                <button
                  type="button"
                  onClick={handleResetAllRanges}
                  className="px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                  title="Reset semua custom range server ke standar 1 - 4094"
                >
                  Reset Range
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
            <span>Server / BRAS</span>
            <Server className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {summary?.totalServers || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {summary?.totalActiveCircuits || 0} sirkuit aktif ber-VLAN
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Total Kapasitas Pool</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {summary?.totalCapacity?.toLocaleString("id-ID") || 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Akumulasi slot VLAN seluruh server</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>VLAN Unavailable</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
            {summary?.totalUnavailable?.toLocaleString("id-ID") || 0}
          </p>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5 truncate">
            POP {summary?.serviceBreakdown.popSite || 0} &bull; LL{" "}
            {summary?.serviceBreakdown.localLoop || 0} &bull; CNT{" "}
            {summary?.serviceBreakdown.content || 0} &bull; ENT{" "}
            {summary?.serviceBreakdown.enterpriseDedicated || 0}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>VLAN Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
            {summary?.totalAvailable?.toLocaleString("id-ID") || 0}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            Siap digunakan untuk aktivasi
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Utilisasi VLAN</span>
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
              <span>
                {(summary?.totalDuplicateVlans || 0) > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    {summary?.totalDuplicateVlans} VLAN bentrok
                  </span>
                ) : (
                  "0 bentrok"
                )}
              </span>
              {(summary?.totalUnassignedCircuits || 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => handleSwitchTab("UNASSIGNED")}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  {summary?.totalUnassignedCircuits} tanpa VLAN
                </button>
              ) : (
                <span>Semua terpetakan</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK VLAN AVAILABILITY CHECKER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Cek Ketersediaan VLAN Cepat
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih Server dan ketik nomor VLAN (1 - 4094) sebelum provisioning atau edit data.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <select
              value={checkerServer}
              onChange={(e) => setCheckerServer(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none sm:w-64"
            >
              {servers.length === 0 && <option value="">Memuat server...</option>}
              {servers.map((srv) => (
                <option key={srv.serverName} value={srv.serverName}>
                  {srv.serverName} ({srv.unavailableCount} terpakai)
                </option>
              ))}
            </select>

            <input
              type="number"
              min={MIN_VLAN_ID}
              max={MAX_VLAN_ID}
              value={checkerVlan}
              onChange={(e) => setCheckerVlan(e.target.value)}
              placeholder="Cek VLAN ID (misal: 1420)..."
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none sm:w-52"
            />

            {checkerResult ? (
              checkerResult.available ? (
                <div className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      VLAN <span className="font-mono">{checkerResult.vlan}</span> AVAILABLE di{" "}
                      {checkerResult.server}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(String(checkerResult.vlan), `chk-${checkerResult.vlan}`)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center shrink-0 cursor-pointer"
                  >
                    {copiedKey === `chk-${checkerResult.vlan}` ? (
                      <>
                        <Check className="w-3 h-3 mr-1" /> Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" /> Salin
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex-1 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      VLAN <span className="font-mono">{checkerResult.vlan}</span> UNAVAILABLE —
                      Dipakai{" "}
                      {checkerResult.matches.map((m, idx) => (
                        <React.Fragment key={m.siteDbId}>
                          {idx > 0 && ", "}
                          <Link
                            href={getCircuitHref(m.kategoriLayanan, m.siteDbId)}
                            className="underline font-mono hover:text-rose-950 dark:hover:text-white"
                          >
                            {m.siteId}
                          </Link>{" "}
                          ({m.namaPerusahaan || m.namaPic})
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-400 flex items-center">
                Masukkan angka 1 - 4094 untuk mengecek status secara instan.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SERVER CARDS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center">
            <Server className="w-4 h-4 mr-2 text-indigo-600" />
            Daftar Pool VLAN per Server ({servers.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Klik kartu server untuk memfilter detail VLAN & melihat peta slot tersedia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {servers.map((srv) => {
            const isSelected = selectedServer === srv.serverName;
            const barColor = getUsageBarColor(srv.usagePct);
            const badgeColor = getUsageBadgeColor(srv.usagePct);

            return (
              <div
                key={srv.serverName}
                onClick={() => handleSelectServerCard(srv)}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                  isSelected
                    ? "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20"
                    : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">
                        {srv.serverName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
                      >
                        {srv.usagePct}% Terpakai
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {srv.description}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRangeModal(srv);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                        title="Atur Range VLAN Server"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {srv.hasCustomRange && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetServerRange(srv.serverName);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                          title="Reset ke Range 1 - 4094"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Usage Bar */}
                <div className="space-y-1 mt-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>
                      <strong className="text-amber-700 dark:text-amber-400">
                        {srv.unavailableCount}
                      </strong>{" "}
                      / {srv.totalCapacity.toLocaleString("id-ID")} Unavailable
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                      Available: {srv.availableCount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, srv.usagePct)}%` }}
                    />
                  </div>
                </div>

                {/* Service Breakdown Pills */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                    POP: {srv.serviceBreakdown.popSite}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-bold">
                    LocalLoop: {srv.serviceBreakdown.localLoop}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold">
                    Content: {srv.serviceBreakdown.content}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold">
                    Ent. Dedicated: {srv.serviceBreakdown.enterpriseDedicated}
                  </span>
                  {srv.duplicateVlanCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold">
                      Bentrok: {srv.duplicateVlanCount}
                    </span>
                  )}
                  {srv.outOfRangeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      Luar Range: {srv.outOfRangeCount}
                    </span>
                  )}
                </div>

                {/* Next Available VLAN Box */}
                <div className="mt-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 overflow-hidden">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                      Next Available:
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {srv.nextAvailableVlan !== null ? `VLAN ${srv.nextAvailableVlan}` : "Penuh"}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {srv.nextAvailableVlan !== null && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(
                            String(srv.nextAvailableVlan),
                            `srv-${srv.serverName}-${srv.nextAvailableVlan}`
                          );
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition flex items-center cursor-pointer"
                      >
                        {copiedKey === `srv-${srv.serverName}-${srv.nextAvailableVlan}` ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-emerald-600" /> Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" /> Salin
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedServer(srv.serverName);
                        setGridServer(srv.serverName);
                        setRangeStart(srv.startVlan);
                        setRangeEnd(srv.endVlan);
                        setBlockPage(0);
                        setActiveTab("AVAILABLE_GRID");
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                    >
                      Peta VLAN
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & TAB CONTROL PANEL */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        {/* View Mode Tabs & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchTab("UNAVAILABLE")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "UNAVAILABLE"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              VLAN Unavailable ({filteredUsedVlans.length})
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab("AVAILABLE_GRID")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "AVAILABLE_GRID"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Peta & VLAN Available
            </button>

            {unassignedCircuits.length > 0 && (
              <button
                type="button"
                onClick={() => handleSwitchTab("UNASSIGNED")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "UNASSIGNED"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Sirkuit Tanpa VLAN ({unassignedCircuits.length})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setBlockPage(0);
              }}
              placeholder={
                activeTab === "AVAILABLE_GRID"
                  ? "Cari nomor VLAN, Site ID, Pelanggan..."
                  : "Cari VLAN, Server, PIC, Site ID, IP..."
              }
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Filter Row: Server & Eligible Service Categories */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> Server:
            </span>

            {activeTab === "AVAILABLE_GRID" ? (
              <select
                value={activeGridServerSummary?.serverName || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setGridServer(val);
                  setSelectedServer(val);
                  const found = servers.find((s) => s.serverName === val);
                  if (found) {
                    setRangeStart(found.startVlan);
                    setRangeEnd(found.endVlan);
                  }
                  setBlockPage(0);
                  setInspectedVlan(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {servers.map((s) => (
                  <option key={s.serverName} value={s.serverName}>
                    {s.serverName} (Available: {s.availableCount.toLocaleString("id-ID")} |
                    Unavailable: {s.unavailableCount})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Semua Server ({servers.length})</option>
                {servers.map((s) => (
                  <option key={s.serverName} value={s.serverName}>
                    {s.serverName} ({s.unavailableCount} VLAN)
                  </option>
                ))}
              </select>
            )}

            <span className="text-[11px] font-bold text-slate-400 ml-1">Layanan:</span>
            <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {[{ label: "Semua", val: "ALL" }, ...ELIGIBLE_VLAN_SERVICES.map((s) => ({ label: s, val: s }))].map(
                (opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setSelectedService(opt.val);
                      setBlockPage(0);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      selectedService === opt.val
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              )}
            </div>

            {activeTab === "UNAVAILABLE" && (summary?.totalDuplicateVlans || 0) > 0 && (
              <button
                type="button"
                onClick={() => setOnlyDuplicates((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                  onlyDuplicates
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                }`}
              >
                Bentrok Saja ({summary?.totalDuplicateVlans})
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {activeTab === "UNAVAILABLE" ? (
              <>
                Menampilkan{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {filteredUsedVlans.length} sirkuit
                </span>{" "}
                terpakai
              </>
            ) : activeTab === "AVAILABLE_GRID" ? (
              <>
                Menampilkan{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {gridMatchingVlans.length.toLocaleString("id-ID")} VLAN
                </span>{" "}
                di server{" "}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {activeGridServerSummary?.serverName || "-"}
                </span>
              </>
            ) : (
              <>
                Menampilkan{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {filteredUnassigned.length} sirkuit
                </span>{" "}
                belum ber-VLAN
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT BODY */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500 font-medium">
            Memetakan alokasi VLAN dari data sirkuit teraktivasi...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-800 p-8 text-center text-rose-600">
          <AlertTriangle className="w-8 h-8 mx-auto" />
          <p className="font-bold mt-2">Gagal Memuat Data VLAN Management</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      ) : activeTab === "UNAVAILABLE" ? (
        /* TAB 1: TABLE OF UNAVAILABLE / ACTIVE VLANS */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredUsedVlans.length === 0 ? (
            <div className="py-16 text-center px-4 space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Tidak Ada VLAN Unavailable pada Filter Ini
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {selectedServer !== "ALL"
                  ? `Server '${selectedServer}' masih 100% tersedia (Available) untuk filter yang dipilih.`
                  : "Belum ada sirkuit teraktivasi (POP Site, LocalLoop, Content, atau Enterprise Dedicated) yang cocok dengan filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">VLAN ID</th>
                    <th className="py-3 px-4">Server / BRAS</th>
                    <th className="py-3 px-4">Status VLAN</th>
                    <th className="py-3 px-4">Site ID</th>
                    <th className="py-3 px-4">Pelanggan & PIC</th>
                    <th className="py-3 px-4">Kategori Layanan</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Status Sirkuit</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
                  {filteredUsedVlans.map((item) => (
                    <tr
                      key={`${item.siteDbId}-${item.vlan}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* VLAN ID */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-black text-sm text-indigo-700 dark:text-indigo-400">
                            {item.vlan}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(String(item.vlan), `tbl-${item.siteDbId}`)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            title="Salin VLAN ID"
                          >
                            {copiedKey === `tbl-${item.siteDbId}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {item.isDuplicate && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              title={`Digunakan oleh ${item.duplicateTotal} sirkuit aktif di server ini`}
                            >
                              Bentrok {item.duplicateTotal}x
                            </span>
                          )}
                          {item.isOutOfRange && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Luar Range
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Server */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedServer(item.server)}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-left cursor-pointer"
                        >
                          {item.server}
                        </button>
                      </td>

                      {/* Status VLAN */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 inline-flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-500" />
                          Unavailable
                        </span>
                      </td>

                      {/* Site ID */}
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <Link
                          href={getCircuitHref(item.kategoriLayanan, item.siteDbId)}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                        >
                          {item.siteId}
                          <ArrowUpRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      </td>

                      {/* Pelanggan & PIC */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {item.namaPerusahaan || item.namaPic}
                        </span>
                        {item.namaPerusahaan && (
                          <span className="text-[10px] text-slate-400 block">
                            PIC: {item.namaPic}
                          </span>
                        )}
                      </td>

                      {/* Kategori Layanan */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getServiceBadgeColor(
                            item.serviceLabel
                          )}`}
                        >
                          {item.serviceLabel}
                        </span>
                      </td>

                      {/* IP */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {item.ipPublic && (
                          <span className="block text-slate-800 dark:text-slate-200">
                            Pub: {item.ipPublic}
                          </span>
                        )}
                        {item.ipPrivate && (
                          <span className="block text-slate-400 text-[10px]">
                            Priv: {item.ipPrivate}
                          </span>
                        )}
                        {!item.ipPublic && !item.ipPrivate && "-"}
                      </td>

                      {/* Status Layanan */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.statusLayanan === "Active"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {item.statusLayanan}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Link
                          href={getCircuitHref(item.kategoriLayanan, item.siteDbId)}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition inline-flex items-center"
                        >
                          Buka / Edit <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "AVAILABLE_GRID" ? (
        /* TAB 2: INTERACTIVE VLAN MAP & AVAILABLE POOL */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 space-y-5">
          {/* Pool Filter & Range Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Status Tampilan:</span>
              {[
                { label: "Semua Slot", val: "ALL" as GridStatusFilter },
                { label: "Available Saja", val: "AVAILABLE" as GridStatusFilter },
                { label: "Unavailable Saja", val: "UNAVAILABLE" as GridStatusFilter },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    setGridStatusFilter(opt.val);
                    setBlockPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    gridStatusFilter === opt.val
                      ? opt.val === "AVAILABLE"
                        ? "bg-emerald-600 text-white"
                        : opt.val === "UNAVAILABLE"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400">Rentang Tampil:</span>
              <input
                type="number"
                min={MIN_VLAN_ID}
                max={MAX_VLAN_ID}
                value={rangeStart}
                onChange={(e) => {
                  setRangeStart(parseInt(e.target.value, 10) || MIN_VLAN_ID);
                  setBlockPage(0);
                }}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs outline-none"
              />
              <span className="text-slate-400 font-bold">s/d</span>
              <input
                type="number"
                min={MIN_VLAN_ID}
                max={MAX_VLAN_ID}
                value={rangeEnd}
                onChange={(e) => {
                  setRangeEnd(parseInt(e.target.value, 10) || MAX_VLAN_ID);
                  setBlockPage(0);
                }}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs outline-none"
              />

              {activeGridServerSummary?.nextAvailableVlan !== null &&
                activeGridServerSummary?.nextAvailableVlan !== undefined && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        String(activeGridServerSummary.nextAvailableVlan),
                        "grid-next"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    {copiedKey === "grid-next"
                      ? `VLAN ${activeGridServerSummary.nextAvailableVlan} Disalin`
                      : `Salin Next VLAN (${activeGridServerSummary.nextAvailableVlan})`}
                  </button>
                )}
            </div>
          </div>

          {/* Inspected VLAN Banner */}
          {inspectedVlan !== null && (
            <div
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                inspectedVlanOccurrences.length > 0
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <span className="font-mono text-sm">VLAN {inspectedVlan}</span>
                  <span className="text-slate-400">di Server</span>
                  <span>{activeGridServerSummary?.serverName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inspectedVlanOccurrences.length > 0
                        ? "bg-amber-200/80 text-amber-900"
                        : "bg-emerald-200/80 text-emerald-900"
                    }`}
                  >
                    {inspectedVlanOccurrences.length > 0 ? "Unavailable" : "Available"}
                  </span>
                </div>
                {inspectedVlanOccurrences.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {inspectedVlanOccurrences.map((occ) => (
                      <Link
                        key={occ.siteDbId}
                        href={getCircuitHref(occ.kategoriLayanan, occ.siteDbId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 hover:border-indigo-400 font-semibold transition"
                      >
                        <span className="font-mono font-bold text-blue-600">{occ.siteId}</span>
                        <span>{occ.namaPerusahaan || occ.namaPic}</span>
                        <span className="text-[10px] text-slate-400">({occ.serviceLabel})</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    VLAN ini bebas digunakan di server {activeGridServerSummary?.serverName} dan
                    sudah disalin ke clipboard saat Anda mengklik tile.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInspectedVlan(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500 inline-block" />
                Available (Klik untuk salin)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/25 border border-amber-500 inline-block" />
                Unavailable (Klik untuk lihat sirkuit)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500 inline-block" />
                Bentrok (&ge;2 sirkuit)
              </span>
            </div>

            {totalBlockPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={safeBlockPage === 0}
                  onClick={() => setBlockPage((p) => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  &larr; Sebelumnya
                </button>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  Blok {safeBlockPage + 1} / {totalBlockPages}
                </span>
                <button
                  type="button"
                  disabled={safeBlockPage >= totalBlockPages - 1}
                  onClick={() => setBlockPage((p) => Math.min(totalBlockPages - 1, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Berikutnya &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Interactive Grid */}
          {currentGridSlice.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada VLAN yang cocok dengan filter rentang atau pencarian saat ini.
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
              {currentGridSlice.map((v) => {
                const occ = gridUsedByVlanMap.get(v) || [];
                const isUsedOnServer = gridAllUsedSet.has(v);
                const isDup = occ.some((o) => o.isDuplicate);
                const isSelectedTile = inspectedVlan === v;

                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setInspectedVlan(v);
                      if (!isUsedOnServer) {
                        handleCopy(String(v), `tile-${v}`);
                      }
                    }}
                    title={
                      occ.length > 0
                        ? `VLAN ${v} UNAVAILABLE: ${occ
                            .map((o) => `${o.siteId} (${o.namaPerusahaan || o.namaPic})`)
                            .join(", ")}`
                        : isUsedOnServer
                        ? `VLAN ${v} UNAVAILABLE di ${activeGridServerSummary?.serverName}`
                        : `VLAN ${v} AVAILABLE — klik untuk salin`
                    }
                    className={`px-1.5 py-2 rounded-lg border text-center font-mono text-[11px] font-bold transition cursor-pointer relative ${
                      isSelectedTile ? "ring-2 ring-indigo-500 scale-[1.03] z-10" : ""
                    } ${
                      isDup
                        ? "bg-rose-100 dark:bg-rose-950/70 border-rose-400 text-rose-800 dark:text-rose-200 hover:bg-rose-200"
                        : isUsedOnServer
                        ? "bg-amber-100/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-200/80"
                        : "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                    }`}
                  >
                    <span className="block leading-none">{v}</span>
                    {occ.length > 0 && (
                      <span className="block text-[8px] font-sans font-semibold truncate mt-1 opacity-85">
                        {occ[0].serviceLabel === "Enterprise Dedicated"
                          ? "ENT"
                          : occ[0].serviceLabel === "LocalLoop"
                          ? "LL"
                          : occ[0].serviceLabel === "Content"
                          ? "CNT"
                          : "POP"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 3: UNASSIGNED CIRCUITS (E.G. LEGACY LOCALLOOP WITHOUT VLAN YET) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredUnassigned.length === 0 ? (
            <div className="py-16 text-center px-4 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Seluruh Sirkuit Terfilter Sudah Memiliki VLAN
              </h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Site ID</th>
                    <th className="py-3 px-4">Pelanggan & PIC</th>
                    <th className="py-3 px-4">Kategori Layanan</th>
                    <th className="py-3 px-4">Server / Interkoneksi</th>
                    <th className="py-3 px-4">Status Sirkuit</th>
                    <th className="py-3 px-4 text-center">Lengkapi VLAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUnassigned.map((c) => (
                    <tr key={c.siteDbId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold">
                        <Link
                          href={getCircuitHref(c.kategoriLayanan, c.siteDbId)}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                        >
                          {c.siteId} <ArrowUpRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {c.namaPerusahaan || c.namaPic}
                        </span>
                        {c.namaPerusahaan && (
                          <span className="text-[10px] text-slate-400">PIC: {c.namaPic}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getServiceBadgeColor(
                            c.serviceLabel
                          )}`}
                        >
                          {c.serviceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold">{c.server || "-"}</td>
                      <td className="py-3 px-4">{c.statusLayanan}</td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={getCircuitHref(c.kategoriLayanan, c.siteDbId)}
                          className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] hover:bg-indigo-100 inline-flex items-center"
                        >
                          Edit & Isi VLAN <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADMIN MODAL: ATUR / TAMBAH SERVER & RANGE VLAN */}
      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Atur Server & Range VLAN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRangeModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {rangeModalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{rangeModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveServerRange} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Server / BRAS Aggregator *
                </label>
                <input
                  type="text"
                  required
                  list="vlan-server-datalist"
                  placeholder="Contoh: JAKARTA P1 atau Server Baru..."
                  value={modalServerName}
                  onChange={(e) => setModalServerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <datalist id="vlan-server-datalist">
                  {servers.map((s) => (
                    <option key={s.serverName} value={s.serverName} />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-400 mt-1">
                  Server baru otomatis ikut tersedia di formulir Aktivasi Tiket & Edit Data Sirkuit.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    VLAN Awal (Min 1) *
                  </label>
                  <input
                    type="number"
                    required
                    min={MIN_VLAN_ID}
                    max={MAX_VLAN_ID}
                    value={modalStartVlan}
                    onChange={(e) => setModalStartVlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    VLAN Akhir (Max 4094) *
                  </label>
                  <input
                    type="number"
                    required
                    min={MIN_VLAN_ID}
                    max={MAX_VLAN_ID}
                    value={modalEndVlan}
                    onChange={(e) => setModalEndVlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Keterangan / Deskripsi Pool
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pool VLAN Pelanggan POP Jakarta P1"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRange}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer flex items-center"
                >
                  {savingRange ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Konfigurasi"
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
