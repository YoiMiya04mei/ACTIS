"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  Play,
  Square,
  RotateCw,
  Settings,
  RefreshCw,
  Users,
  Shield,
  Server,
  ScrollText,
  Terminal,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Search,
  Download,
  FlaskConical,
  Lock,
  Import,
  Activity,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import { TacacsUserModal } from "@/components/tacacs/TacacsUserModal";
import { TacacsGroupModal } from "@/components/tacacs/TacacsGroupModal";
import { TacacsClientModal } from "@/components/tacacs/TacacsClientModal";
import { TacacsSettingsModal } from "@/components/tacacs/TacacsSettingsModal";
import { generateVendorCliSnippet, TACACS_VENDORS } from "@/lib/tacacs/policy";

type TabKey = "overview" | "users" | "groups" | "clients" | "logs";

function formatUptime(sec: number): string {
  if (!sec || sec <= 0) return "0d 0j 0m";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  return `${m}m ${s}d`;
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export default function TacacsServerPage() {
  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog } = useDialog();
  const isAdmin = currentUser?.role === "admin";
  const isAllowed = currentUser?.role === "admin" || currentUser?.role === "noc_engineer";

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<"NONE" | "AUTH_REQUIRED" | "FORBIDDEN">("NONE");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Core data
  const [runtime, setRuntime] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, total_pages: 1 });

  // Action states
  const [serverBusy, setServerBusy] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [searchClient, setSearchClient] = useState("");

  // Logs filters
  const [logEventType, setLogEventType] = useState("ALL");
  const [logStatus, setLogStatus] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSecret, setImportSecret] = useState("");
  const [importingDevices, setImportingDevices] = useState(false);

  // Simulator state
  const [simUsername, setSimUsername] = useState("");
  const [simPassword, setSimPassword] = useState("");
  const [simClientIp, setSimClientIp] = useState("127.0.0.1");
  const [simCommand, setSimCommand] = useState("show running-config");
  const [simAuthMode, setSimAuthMode] = useState<"PAP" | "ASCII" | "CHAP">("PAP");
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Vendor snippet generator state
  const [snippetVendor, setSnippetVendor] = useState("cisco");
  const [snippetServerIp, setSnippetServerIp] = useState("");
  const [snippetSecret, setSnippetSecret] = useState("ACTIS-TACACS-KEY");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !snippetServerIp) {
      setSnippetServerIp(window.location.hostname || "10.10.10.10");
    }
  }, [snippetServerIp]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, usersRes, groupsRes, clientsRes] = await Promise.all([
        fetch("/api/tacacs/status"),
        fetch("/api/tacacs/users"),
        fetch("/api/tacacs/groups"),
        fetch("/api/tacacs/clients"),
      ]);

      if (statusRes.status === 401) {
        setAuthError("AUTH_REQUIRED");
        setLoading(false);
        return;
      }
      if (statusRes.status === 403) {
        setAuthError("FORBIDDEN");
        setLoading(false);
        return;
      }
      setAuthError("NONE");

      const [statusJson, usersJson, groupsJson, clientsJson] = await Promise.all([
        statusRes.json(),
        usersRes.json(),
        groupsRes.json(),
        clientsRes.json(),
      ]);

      if (statusJson.success) {
        setRuntime(statusJson.data.runtime);
        setSettings(statusJson.data.settings);
        setSummary(statusJson.data.summary);
      }
      if (usersJson.success) setUsers(usersJson.data || []);
      if (groupsJson.success) setGroups(groupsJson.data || []);
      if (clientsJson.success) setClients(clientsJson.data || []);
    } catch (err) {
      console.error("Failed to load TACACS+ data:", err);
      showToast("error", "Gagal memuat data TACACS+ server.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        event_type: logEventType,
        status: logStatus,
        search: logSearch,
        page: String(logPage),
        limit: "50",
      });
      const res = await fetch(`/api/tacacs/logs?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
        setLogsPagination(json.pagination || { total: 0, page: 1, total_pages: 1 });
      }
    } catch {
      // ignore
    }
  }, [logEventType, logStatus, logSearch, logPage]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (authError === "NONE") {
      fetchLogs();
    }
  }, [authError, fetchLogs]);

  useEffect(() => {
    if (!autoRefreshLogs || activeTab !== "logs") return;
    const id = setInterval(() => {
      fetchLogs();
      fetch("/api/tacacs/status")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setRuntime(j.data.runtime);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefreshLogs, activeTab, fetchLogs]);

  const handleServerControl = async (action: "start" | "stop" | "restart") => {
    setServerBusy(true);
    try {
      const res = await fetch("/api/tacacs/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengontrol server.");
      }
      setRuntime(json.data.runtime);
      showToast(
        json.data.runtime.state === "ERROR" ? "error" : "success",
        json.message
      );
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal mengontrol TACACS+ server.");
    } finally {
      setServerBusy(false);
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (!(await confirmDialog(`Hapus user TACACS+ '${u.username}'?`))) return;
    try {
      const res = await fetch(`/api/tacacs/users/${u.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus user.");
    }
  };

  const handleToggleUserActive = async (u: any) => {
    try {
      const res = await fetch(`/api/tacacs/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal mengubah status user.");
    }
  };

  const handleDeleteGroup = async (g: any) => {
    if (!(await confirmDialog(`Hapus grup '${g.name}'? User di grup ini akan kehilangan asosiasi grup.`))) return;
    try {
      const res = await fetch(`/api/tacacs/groups/${g.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus grup.");
    }
  };

  const handleDeleteClient = async (c: any) => {
    if (!(await confirmDialog(`Hapus NAS Client '${c.name}' (${c.ip_or_cidr})?`))) return;
    try {
      const res = await fetch(`/api/tacacs/clients/${c.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal menghapus NAS Client.");
    }
  };

  const handleImportDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingDevices(true);
    try {
      const res = await fetch("/api/tacacs/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_from_devices",
          shared_secret: importSecret.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      setShowImportModal(false);
      setImportSecret("");
      fetchAllData();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal mengimpor perangkat.");
    } finally {
      setImportingDevices(false);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/tacacs/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: simUsername.trim(),
          password: simPassword,
          client_ip: simClientIp.trim() || "127.0.0.1",
          command: simCommand.trim(),
          authen_mode: simAuthMode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setSimResult(json.data);
    } catch (err: any) {
      showToast("error", err?.message || "Simulasi AAA gagal.");
    } finally {
      setSimRunning(false);
    }
  };

  const handleClearLogs = async () => {
    if (!(await confirmDialog("Hapus seluruh log audit TACACS+ yang lebih lama dari 30 hari?"))) return;
    try {
      const res = await fetch("/api/tacacs/logs?older_than_days=30", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      fetchLogs();
    } catch (err: any) {
      showToast("error", err?.message || "Gagal membersihkan log.");
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchUser.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.group?.name?.toLowerCase().includes(q)
    );
  }, [users, searchUser]);

  const filteredClients = useMemo(() => {
    const q = searchClient.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.ip_or_cidr?.toLowerCase().includes(q) ||
        c.vendor?.toLowerCase().includes(q)
    );
  }, [clients, searchClient]);

  const vendorSnippet = useMemo(
    () =>
      generateVendorCliSnippet({
        vendor: snippetVendor,
        serverIp: snippetServerIp,
        port: runtime?.port || settings?.port || 49,
        sharedSecret: snippetSecret,
      }),
    [snippetVendor, snippetServerIp, runtime?.port, settings?.port, snippetSecret]
  );

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(vendorSnippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // ignore
    }
  };

  if (authError === "AUTH_REQUIRED") {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <Lock className="w-12 h-12 mx-auto text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sesi Login Diperlukan</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Silakan login ke akun ACTIS Anda untuk mengakses panel TACACS+ AAA Server.
        </p>
        <Link
          href="/login"
          className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          Masuk ke Login
        </Link>
      </div>
    );
  }

  if (authError === "FORBIDDEN" || (!isAllowed && !loading)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Akses Ditolak</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fitur TACACS+ AAA Server hanya tersedia untuk Administrator dan NOC Engineer.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const isRunning = runtime?.state === "RUNNING";
  const isError = runtime?.state === "ERROR";

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold flex items-center space-x-2.5 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-rose-600 text-white border-rose-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header & Server Runtime Control */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  TACACS+ AAA Server
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  RFC 8907 Native
                </span>
                {isRunning && (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>RUNNING &bull; TCP {runtime?.bind_host}:{runtime?.port}</span>
                  </span>
                )}
                {!isRunning && !isError && (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>STOPPED</span>
                  </span>
                )}
                {isError && (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>ERROR</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Pusat Authentication, Authorization (per-command CLI), dan Accounting untuk Router, Switch, & OLT ISP.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                {!isRunning ? (
                  <button
                    type="button"
                    disabled={serverBusy}
                    onClick={() => handleServerControl("start")}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Server</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={serverBusy}
                      onClick={() => handleServerControl("restart")}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold inline-flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 ${serverBusy ? "animate-spin" : ""}`} />
                      <span>Restart</span>
                    </button>
                    <button
                      type="button"
                      disabled={serverBusy}
                      onClick={() => handleServerControl("stop")}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center space-x-1.5"
                >
                  <Settings className="w-4 h-4" />
                  <span>Pengaturan</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={fetchAllData}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {runtime?.last_error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Listener Error: </span>
              <span>{runtime.last_error}</span>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Uptime Listener</p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {isRunning ? formatUptime(runtime?.uptime_sec || 0) : "-"}
            </p>
            <p className="text-[11px] text-slate-400">
              {runtime?.active_connections || 0} koneksi aktif
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">TACACS+ Users</p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {summary?.active_users ?? 0} <span className="text-xs font-medium text-slate-400">/ {summary?.total_users ?? 0}</span>
            </p>
            <p className="text-[11px] text-slate-400">User aktif</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Privilege Groups</p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {summary?.total_groups ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">Policy RBAC CLI</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">NAS Clients</p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {summary?.active_clients ?? 0} <span className="text-xs font-medium text-slate-400">/ {summary?.total_clients ?? 0}</span>
            </p>
            <p className="text-[11px] text-slate-400">Perangkat terdaftar</p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
              Authen / Author Pass
            </p>
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {(runtime?.authen_pass || 0) + (runtime?.author_pass || 0)}
            </p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              {runtime?.acct_count || 0} accounting log
            </p>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60">
            <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase">
              Event 24 Jam
            </p>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {summary?.logs_24h ?? 0}{" "}
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                ({summary?.fails_24h ?? 0} gagal)
              </span>
            </p>
            <p className="text-[11px] text-slate-400">Total paket: {runtime?.total_packets || 0}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {[
          { key: "overview", label: "Simulator & Config Generator", icon: FlaskConical },
          { key: "users", label: `TACACS+ Users (${users.length})`, icon: Users },
          { key: "groups", label: `Privilege & Command Groups (${groups.length})`, icon: Shield },
          { key: "clients", label: `NAS Clients (${clients.length})`, icon: Server },
          { key: "logs", label: "AAA & Command Audit Logs", icon: ScrollText },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center space-x-2 transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW / SIMULATOR / CONFIG GENERATOR */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Interactive AAA & Policy Simulator */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Simulasi AAA & Uji Command Policy
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Uji login user, pencocokan NAS IP, privilege level, dan aturan perintah CLI sebelum diterapkan ke router.
                </p>
              </div>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={simUsername}
                    onChange={(e) => setSimUsername(e.target.value)}
                    placeholder="noc_budi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={simPassword}
                    onChange={(e) => setSimPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NAS Client IP
                  </label>
                  <input
                    type="text"
                    value={simClientIp}
                    onChange={(e) => setSimClientIp(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mode Authen
                  </label>
                  <select
                    value={simAuthMode}
                    onChange={(e) => setSimAuthMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="PAP">PAP</option>
                    <option value="ASCII">ASCII</option>
                    <option value="CHAP">CHAP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Uji Perintah CLI
                  </label>
                  <input
                    type="text"
                    value={simCommand}
                    onChange={(e) => setSimCommand(e.target.value)}
                    placeholder="show running-config"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={simRunning}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center space-x-2 disabled:opacity-50"
              >
                {simRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4" />
                )}
                <span>Jalankan Simulasi AAA</span>
              </button>
            </form>

            {simResult && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Hasil Evaluasi AAA
                  </span>
                  {simResult.wire_tested && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                      RFC 8907 Wire Loopback OK
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">1. NAS Client</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {simResult.nas_client.matched
                        ? `Cocok: ${simResult.nas_client.name} (${simResult.nas_client.vendor})`
                        : "Tidak cocok dengan whitelist"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">2. Authentication</span>
                    <span
                      className={`font-bold ${
                        simResult.authentication.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {simResult.authentication.ok ? "PASS" : "FAIL"} —{" "}
                      {simResult.authentication.reason}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">
                    3. Shell Authorization & Atribut Balasan
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {simResult.shell_authorization.allowed
                      ? simResult.shell_authorization.attrs.join(", ")
                      : "Ditolak"}
                  </span>
                </div>

                {simResult.command_authorization && (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">
                      4. Command Authorization ({simResult.command_authorization.command})
                    </span>
                    <span
                      className={`font-bold ${
                        simResult.command_authorization.allowed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {simResult.command_authorization.allowed ? "PERMIT" : "DENY"} —{" "}
                      {simResult.command_authorization.reason}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendor CLI Config Snippet Generator */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Generator Konfigurasi Router / Switch
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Salin template AAA TACACS+ siap pakai untuk perangkat jaringan Anda.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopySnippet}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center space-x-1.5"
              >
                {copiedSnippet ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSnippet ? "Tersalin" : "Salin CLI"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Perangkat
                </label>
                <select
                  value={snippetVendor}
                  onChange={(e) => setSnippetVendor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                >
                  {TACACS_VENDORS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  IP Server ACTIS
                </label>
                <input
                  type="text"
                  value={snippetServerIp}
                  onChange={(e) => setSnippetServerIp(e.target.value)}
                  placeholder="10.10.10.10"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shared Secret Key
                </label>
                <input
                  type="text"
                  value={snippetSecret}
                  onChange={(e) => setSnippetSecret(e.target.value)}
                  placeholder="SECRET_KEY"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-72">
              {vendorSnippet}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: TACACS+ USERS */}
      {activeTab === "users" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Cari username, nama, atau grup..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setShowUserModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center space-x-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah User TACACS+</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Nama PIC</th>
                  <th className="py-3 px-3">Grup Policy</th>
                  <th className="py-3 px-3">Privilege</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Login Terakhir</th>
                  {isAdmin && <th className="py-3 px-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      Belum ada user TACACS+. Klik &ldquo;Tambah User TACACS+&rdquo; untuk membuat akun engineer.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isExpired = Boolean(
                      u.expires_at && new Date(u.expires_at).getTime() < Date.now()
                    );
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {u.username}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {u.full_name || "-"}
                        </td>
                        <td className="py-3 px-3">
                          {u.group ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {u.group.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Tanpa Grup</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            priv-{u.effective_privilege}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                              Kedaluwarsa
                            </span>
                          ) : u.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">
                          {u.last_login_at ? (
                            <div>
                              <div>{formatDateTime(u.last_login_at)}</div>
                              <div className="font-mono text-[11px]">{u.last_login_ip || "-"}</div>
                            </div>
                          ) : (
                            "Belum pernah"
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              {u.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setShowUserModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                              title="Edit User"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              title="Hapus User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRIVILEGE & COMMAND GROUPS */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Privilege & Command Authorization Groups
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Definisikan level hak akses CLI dan daftar perintah yang diizinkan atau diblokir.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Grup</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div
                key={g.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {g.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                          Priv {g.privilege_level}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {g.description || "Tidak ada deskripsi"}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup(g);
                            setShowGroupModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">
                      Default:{" "}
                      <strong
                        className={
                          g.default_policy === "permit"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {g.default_policy.toUpperCase()}
                      </strong>
                    </span>
                    <span className="text-slate-500 font-semibold">
                      {g.user_count} user terdaftar
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase text-slate-400">
                      Command Rules ({g.command_rules?.length || 0})
                    </p>
                    {(g.command_rules || []).slice(0, 4).map((r: any, idx: number) => (
                      <div
                        key={r.id || idx}
                        className="flex items-center space-x-2 text-xs bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.action === "permit"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {r.action}
                        </span>
                        <code className="font-mono text-slate-700 dark:text-slate-300 truncate">
                          {r.pattern}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: NAS / NETWORK CLIENTS */}
      {activeTab === "clients" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                placeholder="Cari nama perangkat, IP/CIDR, vendor..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center space-x-1.5"
                >
                  <Import className="w-4 h-4" />
                  <span>Impor dari Backup Devices</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setShowClientModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center space-x-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah NAS Client</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-3">Nama Perangkat / Subnet</th>
                  <th className="py-3 px-3">IP / CIDR</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Shared Secret</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Terakhir Terhubung</th>
                  {isAdmin && <th className="py-3 px-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      Belum ada NAS Client terdaftar. Tambahkan IP router/switch atau subnet management Anda.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                        {c.description && (
                          <div className="text-xs text-slate-400">{c.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {c.ip_or_cidr}
                      </td>
                      <td className="py-3 px-3 uppercase text-xs font-bold text-slate-600 dark:text-slate-300">
                        {c.vendor}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-400">
                        {c.shared_secret_masked || "••••••••"}
                      </td>
                      <td className="py-3 px-3">
                        {c.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">
                        {formatDateTime(c.last_seen_at)}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(c);
                              setShowClientModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AAA & COMMAND AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logEventType}
                onChange={(e) => {
                  setLogEventType(e.target.value);
                  setLogPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
              >
                <option value="ALL">Semua Event AAA</option>
                <option value="AUTHEN">AUTHEN (Login)</option>
                <option value="AUTHOR">AUTHOR (Otorisasi / CLI)</option>
                <option value="ACCT">ACCT (Accounting)</option>
              </select>

              <select
                value={logStatus}
                onChange={(e) => {
                  setLogStatus(e.target.value);
                  setLogPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
              >
                <option value="ALL">Semua Status</option>
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
                <option value="ERROR">ERROR</option>
                <option value="START">ACCT START</option>
                <option value="STOP">ACCT STOP</option>
              </select>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="Cari user, IP, atau perintah CLI..."
                  className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs w-60"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefreshLogs}
                  onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <Activity className={`w-3.5 h-3.5 ${autoRefreshLogs ? "text-emerald-500 animate-pulse" : ""}`} />
                <span>Live 5s</span>
              </label>

              <button
                type="button"
                onClick={fetchLogs}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>

              <a
                href={`/api/tacacs/logs?format=csv&event_type=${encodeURIComponent(logEventType)}&status=${encodeURIComponent(logStatus)}&search=${encodeURIComponent(logSearch)}`}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </a>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100"
                >
                  Prune &gt;30h
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-2.5 px-3">Waktu (WIB)</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">NAS Device / IP</th>
                  <th className="py-2.5 px-3">Remote IP</th>
                  <th className="py-2.5 px-3">Command / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      Belum ada catatan log AAA TACACS+.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-200">
                        {log.event_type}
                        {log.authen_type && (
                          <span className="ml-1 text-[10px] text-slate-400">({log.authen_type})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            log.status === "PASS" || log.status === "START" || log.status === "STOP"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : log.status === "UPDATE"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {log.status === "FAIL" || log.status === "ERROR" ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {log.username}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.client_name || "-"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{log.client_ip}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {log.remote_addr || "-"}
                      </td>
                      <td className="py-2.5 px-3 max-w-md">
                        {log.command && (
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 break-all">
                            $ {log.command}
                          </div>
                        )}
                        {log.detail && (
                          <div className="text-slate-500 dark:text-slate-400">{log.detail}</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>
              Total {logsPagination.total} log &bull; Halaman {logsPagination.page} dari{" "}
              {logsPagination.total_pages}
            </span>
            <div className="space-x-2">
              <button
                type="button"
                disabled={logPage <= 1}
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={logPage >= logsPagination.total_pages}
                onClick={() => setLogPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Backup Devices Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleImportDevices}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Impor Perangkat dari Backup Config
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seluruh perangkat di menu Backup Config yang memiliki IP valid dan belum terdaftar akan ditambahkan ke TACACS+ NAS Clients dengan shared secret berikut:
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Shared Secret Default
              </label>
              <input
                type="text"
                required
                minLength={4}
                value={importSecret}
                onChange={(e) => setImportSecret(e.target.value)}
                placeholder="ACTIS-TACACS-SECRET"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={importingDevices}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                {importingDevices ? "Mengimpor..." : "Impor Sekarang"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      <TacacsUserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSaved={() => {
          showToast("success", "Data user TACACS+ disimpan.");
          fetchAllData();
        }}
        editingUser={editingUser}
        groups={groups}
      />

      <TacacsGroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSaved={() => {
          showToast("success", "Data grup TACACS+ disimpan.");
          fetchAllData();
        }}
        editingGroup={editingGroup}
      />

      <TacacsClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSaved={() => {
          showToast("success", "Data NAS Client disimpan.");
          fetchAllData();
        }}
        editingClient={editingClient}
      />

      <TacacsSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSaved={() => {
          showToast("success", "Pengaturan server TACACS+ diperbarui.");
          fetchAllData();
        }}
        settings={settings}
      />
    </div>
  );
}

