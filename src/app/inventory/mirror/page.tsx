"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Cloud,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Save,
  Code2,
  Download,
  ShieldCheck,
  KeyRound,
  FolderOpen,
  Clock,
  Layers,
  Lock,
  Play,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

interface MirrorConfigState {
  enabled: boolean;
  auto_sync: boolean;
  save_drive_backup: boolean;
  method: "apps_script" | "oauth2" | "service_account";
  spreadsheet_id: string;
  spreadsheet_url: string;
  folder_id: string;
  apps_script_url: string;
  has_apps_script_secret: boolean;
  oauth_client_id: string;
  has_oauth_client_secret: boolean;
  has_oauth_refresh_token: boolean;
  sa_client_email: string;
  has_sa_private_key: boolean;
  is_configured: boolean;
}

interface MirrorLogEntry {
  id: string;
  event: string;
  triggered_by: string;
  status: "SUCCESS" | "FAILED";
  message: string;
  spreadsheet_url?: string;
  drive_file_url?: string;
  items_count: number;
  transactions_count: number;
  created_at: string;
}

interface MirrorSyncState {
  total_success: number;
  total_failed: number;
  last_synced_at: string | null;
  last_status: "SUCCESS" | "FAILED" | null;
  last_error: string | null;
  last_spreadsheet_url: string | null;
  last_drive_file_url: string | null;
  logs: MirrorLogEntry[];
}

interface LiveCounts {
  items: number;
  active_items: number;
  units: number;
  transactions: number;
  returns: number;
  requests: number;
}

export default function InventoryMirrorPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isOperator =
    currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [copyingCreds, setCopyingCreds] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [saveDriveBackup, setSaveDriveBackup] = useState(true);
  const [method, setMethod] = useState<"apps_script" | "oauth2" | "service_account">("apps_script");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [folderId, setFolderId] = useState("");

  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [appsScriptSecret, setAppsScriptSecret] = useState("");
  const [hasAppsScriptSecret, setHasAppsScriptSecret] = useState(false);

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [hasOauthClientSecret, setHasOauthClientSecret] = useState(false);
  const [hasOauthRefreshToken, setHasOauthRefreshToken] = useState(false);

  const [saClientEmail, setSaClientEmail] = useState("");
  const [saPrivateKey, setSaPrivateKey] = useState("");
  const [hasSaPrivateKey, setHasSaPrivateKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const [syncState, setSyncState] = useState<MirrorSyncState>({
    total_success: 0,
    total_failed: 0,
    last_synced_at: null,
    last_status: null,
    last_error: null,
    last_spreadsheet_url: null,
    last_drive_file_url: null,
    logs: [],
  });
  const [counts, setCounts] = useState<LiveCounts>({
    items: 0,
    active_items: 0,
    units: 0,
    transactions: 0,
    returns: 0,
    requests: 0,
  });

  const [appsScriptTemplate, setAppsScriptTemplate] = useState("");
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    spreadsheetUrl?: string;
    driveFileUrl?: string;
  } | null>(null);

  const applyConfigToForm = useCallback((c: MirrorConfigState) => {
    setEnabled(Boolean(c.enabled));
    setAutoSync(c.auto_sync !== false);
    setSaveDriveBackup(c.save_drive_backup !== false);
    setMethod(c.method || "apps_script");
    setSpreadsheetId(c.spreadsheet_id || "");
    setSpreadsheetUrl(c.spreadsheet_url || "");
    setFolderId(c.folder_id || "");
    setAppsScriptUrl(c.apps_script_url || "");
    setAppsScriptSecret("");
    setHasAppsScriptSecret(Boolean(c.has_apps_script_secret));
    setOauthClientId(c.oauth_client_id || "");
    setOauthClientSecret("");
    setHasOauthClientSecret(Boolean(c.has_oauth_client_secret));
    setHasOauthRefreshToken(Boolean(c.has_oauth_refresh_token));
    setSaClientEmail(c.sa_client_email || "");
    setSaPrivateKey("");
    setHasSaPrivateKey(Boolean(c.has_sa_private_key));
    setIsConfigured(Boolean(c.is_configured));
  }, []);

  const fetchMirrorStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/mirror", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat konfigurasi Inventory Mirror.");
      }
      applyConfigToForm(json.data.config);
      setSyncState(json.data.state);
      setCounts(json.data.counts);
      setAppsScriptTemplate(json.data.appsScriptTemplate || "");
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Gagal memuat status mirror." });
    } finally {
      setLoading(false);
    }
  }, [applyConfigToForm]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("oauth") === "connected") {
        setFeedback({
          type: "success",
          text: "Akun Google Drive & Sheets (OAuth2) berhasil terhubung! Klik 'Tes Koneksi & Buat Mirror' untuk memulai sinkronisasi awal.",
        });
      } else if (sp.get("oauth_error")) {
        setFeedback({
          type: "error",
          text: sp.get("oauth_error") || "Koneksi OAuth2 Google gagal.",
        });
      }
    }
    fetchMirrorStatus();
  }, [fetchMirrorStatus]);

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/inventory/mirror/oauth/callback`
      : "/api/inventory/mirror/oauth/callback";

  const handleCopy = async (text: string, target: "script" | "redirect") => {
    try {
      await navigator.clipboard.writeText(text);
      if (target === "script") {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      } else {
        setCopiedRedirect(true);
        setTimeout(() => setCopiedRedirect(false), 2000);
      }
    } catch {}
  };

  const buildConfigPayload = (action: "save" | "test") => ({
    action,
    enabled,
    auto_sync: autoSync,
    save_drive_backup: saveDriveBackup,
    method,
    spreadsheet_id: spreadsheetId,
    folder_id: folderId,
    apps_script_url: appsScriptUrl,
    apps_script_secret: appsScriptSecret || undefined,
    oauth_client_id: oauthClientId,
    oauth_client_secret: oauthClientSecret || undefined,
    sa_client_email: saClientEmail,
    sa_private_key: saPrivateKey || undefined,
  });

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfigPayload("save")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan pengaturan Mirror.");
      }
      if (json.data?.config) applyConfigToForm(json.data.config);
      setFeedback({ type: "success", text: json.message });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Gagal menyimpan." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestMirror = async () => {
    if (!isAdmin) return;
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfigPayload("test")),
      });
      const json = await res.json();
      if (json.data?.config) applyConfigToForm(json.data.config);
      if (json.data?.state) setSyncState(json.data.state);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Tes koneksi mirror gagal.");
      }
      setFeedback({
        type: "success",
        text: json.message,
        spreadsheetUrl: json.data?.result?.spreadsheetUrl,
        driveFileUrl: json.data?.result?.driveFileUrl,
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Tes koneksi gagal." });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!isOperator) return;
    setSyncingNow(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_now" }),
      });
      const json = await res.json();
      if (json.data?.config) applyConfigToForm(json.data.config);
      if (json.data?.state) setSyncState(json.data.state);
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Force Mirror gagal.");
      }
      setFeedback({
        type: "success",
        text: json.message,
        spreadsheetUrl: json.data?.result?.spreadsheetUrl,
        driveFileUrl: json.data?.result?.driveFileUrl,
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Gagal melakukan Force Mirror." });
    } finally {
      setSyncingNow(false);
    }
  };

  const handleConnectOAuth = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfigPayload("save")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan Client ID / Secret.");
      }
      window.location.href = "/api/inventory/mirror/oauth/authorize";
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message });
      setSaving(false);
    }
  };

  const handleCopyBackupCredentials = async () => {
    if (!isAdmin) return;
    setCopyingCreds(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory/mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy_backup_credentials" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyalin kredensial Backup Config.");
      }
      if (json.data?.config) applyConfigToForm(json.data.config);
      setFeedback({ type: "success", text: json.message });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Gagal menyalin kredensial." });
    } finally {
      setCopyingCreds(false);
    }
  };

  if (currentUser && !isOperator) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <Lock className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Akses Terbatas</p>
            <p className="mt-1">
              Menu Mirror Google Drive / Sheets Inventory hanya dapat diakses oleh akun{" "}
              <strong>Administrator</strong> atau <strong>Warehouse Admin</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeSpreadsheetLink = syncState.last_spreadsheet_url || spreadsheetUrl;
  const activeDriveLink = syncState.last_drive_file_url;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
              Database Mirroring
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Primary SQL + Google Drive &amp; Google Sheets Sync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <FileSpreadsheet className="w-7 h-7 mr-3 text-emerald-600 dark:text-emerald-400" />
            Mirror Google Drive / Sheets Inventory
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Mirror otomatis database Inventory (Master &amp; Stok, Serial Number, Barang Masuk/Keluar, Pengembalian, dan Request) ke Google Spreadsheet &amp; Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchMirrorStatus}
            disabled={loading}
            title="Refresh Status"
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <a
            href="/api/inventory/mirror/snapshot"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 text-blue-600" />
            Unduh JSON
          </a>

          {activeSpreadsheetLink && (
            <a
              href={activeSpreadsheetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold shadow-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka Google Sheets
            </a>
          )}

          {activeDriveLink && (
            <a
              href={activeDriveLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold shadow-xs transition"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              File JSON Drive
            </a>
          )}

          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncingNow || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncingNow ? "animate-spin" : ""}`} />
            {syncingNow ? "Menyinkronkan..." : "Sync / Mirror Sekarang"}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`p-4 rounded-2xl border text-xs font-medium flex flex-wrap items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <div className="flex items-center gap-3">
            {feedback.spreadsheetUrl && (
              <a
                href={feedback.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <span>Buka Spreadsheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {feedback.driveFileUrl && (
              <a
                href={feedback.driveFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <span>Buka File Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Status Mirroring
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConfigured
                  ? "bg-emerald-500 animate-pulse"
                  : enabled
                    ? "bg-amber-500"
                    : "bg-slate-400"
              }`}
            />
            <span className="text-base font-black text-slate-900 dark:text-white">
              {isConfigured ? "Aktif & Terkoneksi" : enabled ? "Konfigurasi Belum Lengkap" : "Nonaktif"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Metode:{" "}
            <strong>
              {method === "apps_script"
                ? "Apps Script Webhook"
                : method === "oauth2"
                  ? "Google OAuth2 API"
                  : "Service Account"}
            </strong>{" "}
            &bull; Auto-Sync: <strong>{autoSync ? "ON" : "OFF"}</strong>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Sinkronisasi Berhasil
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
            {syncState.total_success}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            Terakhir:{" "}
            {syncState.last_synced_at
              ? new Date(syncState.last_synced_at).toLocaleString("id-ID", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "Belum pernah"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Sinkronisasi Gagal
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
            {syncState.total_failed}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate" title={syncState.last_error || ""}>
            {syncState.last_error ? syncState.last_error : "Tidak ada error tercatat"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Data Database Live
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1.5">
            {counts.items} SKU &bull; {counts.units} SN
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {counts.transactions} Transaksi &bull; {counts.returns} Retur &bull; {counts.requests} Req
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Peran Anda (<strong>{currentUser?.role}</strong>) dapat menjalankan{" "}
            <strong>Sync / Mirror Sekarang</strong> &amp; mengunduh JSON. Perubahan kredensial hanya diizinkan untuk <strong>Administrator</strong>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-600" />
                Konfigurasi Koneksi Google Drive &amp; Sheets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih Apps Script Webhook (tercepat untuk akun Google pribadi) atau OAuth2 / Service Account API.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleCopyBackupCredentials}
                disabled={copyingCreds}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                title="Salin Client ID/Secret atau Service Account dari Backup Config"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                {copyingCreds ? "Menyalin..." : "Salin Kredensial dari Backup Config"}
              </button>
            )}
          </div>

          {/* Toggles */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Aktifkan Mirroring Inventory
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Hidupkan sinkronisasi database Inventory Management ke Google Spreadsheet &amp; Drive.
                </span>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <div className="border-t border-slate-200/80 dark:border-slate-700/60 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  <strong className="block">Auto-Sync Real-time</strong>
                  Sinkron otomatis tiap kali ada Barang Masuk, Keluar, Pengembalian, Opname, Master, atau Request.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={saveDriveBackup}
                  onChange={(e) => setSaveDriveBackup(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  <strong className="block">Simpan File Backup JSON di Drive</strong>
                  Tulis file <code className="font-mono">ACTIS_Inventory_Database_Mirror.json</code> di folder Google Drive.
                </span>
              </label>
            </div>
          </div>

          {/* Target IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Google Spreadsheet ID / URL {method === "apps_script" ? "(Opsional)" : ""}
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Kosongkan untuk Spreadsheet aktif / auto-create"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Bisa tempel link lengkap Google Sheets atau ID-nya saja.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Google Drive Folder ID / URL (Opsional)
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Tempel link folder Drive atau Folder ID"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Folder tempat menyimpan file backup JSON &amp; Spreadsheet baru.
              </p>
            </div>
          </div>

          {/* Method Tabs */}
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Metode Koneksi Google
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: "apps_script" as const,
                  title: "1. Apps Script Webhook",
                  desc: "Tercepat & support Gmail pribadi (Direkomendasikan)",
                },
                {
                  id: "oauth2" as const,
                  title: "2. Google OAuth2 API",
                  desc: "Direct Google Sheets + Drive API via login Google",
                },
                {
                  id: "service_account" as const,
                  title: "3. Service Account JSON",
                  desc: "Direct API untuk Google Workspace / Sheet Shared",
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setMethod(m.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    method === m.id
                      ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-black text-slate-900 dark:text-white">{m.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Method 1: Apps Script */}
          {method === "apps_script" && (
            <div className="space-y-4 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Google Apps Script Web App URL (HTTPS) *
                </label>
                <input
                  type="url"
                  disabled={!isAdmin}
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Secret Token (Opsional — harus sama dengan <code>SHARED_SECRET</code> di skrip)
                </label>
                <input
                  type="password"
                  disabled={!isAdmin}
                  value={appsScriptSecret}
                  onChange={(e) => setAppsScriptSecret(e.target.value)}
                  placeholder={
                    hasAppsScriptSecret ? "•••••••••••• (tersimpan — isi untuk ganti)" : "Opsional"
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              <div className="pt-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScriptCode((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Code2 className="w-4 h-4" />
                    {showScriptCode ? "Sembunyikan Kode Apps Script" : "Tampilkan Kode Apps Script (InventoryMirror.gs)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(appsScriptTemplate, "script")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? "Kode Tersalin!" : "Salin Kode Apps Script"}
                  </button>
                </div>

                {showScriptCode && (
                  <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-64 border border-slate-800">
                    {appsScriptTemplate}
                  </pre>
                )}

                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Panduan Singkat:</strong> Buka Google Sheets baru &rarr; <strong>Extensions &rarr; Apps Script</strong> &rarr; tempel kode di atas &rarr; <strong>Deploy &rarr; New deployment &rarr; Web app</strong> (Execute as: <em>Me</em>, Who has access: <em>Anyone</em>) &rarr; tempel URL <code>/exec</code> di kolom atas. File juga tersedia di <code>google-apps-script/InventoryMirror.gs</code>.
                </p>
              </div>
            </div>
          )}

          {/* Method 2: OAuth2 */}
          {method === "oauth2" && (
            <div className="space-y-4 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Status OAuth2 Token:{" "}
                  {hasOauthRefreshToken ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Terhubung (Refresh Token Tersimpan)</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Belum Dihubungkan</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(redirectUri, "redirect")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  {copiedRedirect ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiedRedirect ? "Redirect URI Tersalin" : "Salin Redirect URI"}
                </button>
              </div>
              <p className="text-[11px] font-mono text-slate-500 break-all bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                Redirect URI: {redirectUri}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Google OAuth2 Client ID *
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Google OAuth2 Client Secret *
                  </label>
                  <input
                    type="password"
                    disabled={!isAdmin}
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    placeholder={
                      hasOauthClientSecret ? "•••••••••••• (tersimpan — isi jika ingin ganti)" : "GOCSPX-..."
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleConnectOAuth}
                  disabled={saving || !oauthClientId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {hasOauthRefreshToken
                    ? "Hubungkan Ulang Akun Google (OAuth2)"
                    : "Simpan & Hubungkan Akun Google (OAuth2)"}
                </button>
              )}
            </div>
          )}

          {/* Method 3: Service Account */}
          {method === "service_account" && (
            <div className="space-y-4 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Service Account Client Email *
                </label>
                <input
                  type="email"
                  disabled={!isAdmin}
                  value={saClientEmail}
                  onChange={(e) => setSaClientEmail(e.target.value)}
                  placeholder="actis-mirror@project-id.iam.gserviceaccount.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Service Account Private Key PEM *
                </label>
                <textarea
                  rows={4}
                  disabled={!isAdmin}
                  value={saPrivateKey}
                  onChange={(e) => setSaPrivateKey(e.target.value)}
                  placeholder={
                    hasSaPrivateKey
                      ? "-----BEGIN PRIVATE KEY----- (Tersimpan Terenkripsi — kosongkan jika tidak ingin mengganti)"
                      : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Pastikan Google Spreadsheet ID diisi dan file Spreadsheet / Shared Drive sudah di-<strong>Share (Editor)</strong> ke alamat email Service Account di atas.
              </p>
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestMirror}
                disabled={testing || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                {testing ? "Menguji & Menyinkron..." : "Tes Koneksi & Buat Mirror"}
              </button>

              <button
                type="submit"
                disabled={saving || testing}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Menyimpan..." : "Simpan Pengaturan"}
              </button>
            </div>
          )}
        </form>

        {/* Architecture & Sheet Map Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Struktur Data Yang Di-Mirror
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ACTIS menjaga PostgreSQL tetap sebagai database utama (Primary) dan me-mirror penuh ke 5 tab Spreadsheet berikut secara non-blocking:
          </p>

          <div className="space-y-2.5 text-xs">
            {[
              {
                name: "1. Stok_&_Master_Barang",
                desc: "Kode, nama, kategori, satuan, lokasi rak, stok awal/masuk/keluar/dipakai/siap pakai & status aktif.",
                color: "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200",
              },
              {
                name: "2. Serial_Number_Unit",
                desc: "Seluruh unit SN, MAC, status (AVAILABLE/IN_USE/DAMAGED/LOST), kondisi, PIC & lokasi terkini.",
                color: "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200",
              },
              {
                name: "3. Riwayat_Transaksi",
                desc: "Seluruh transaksi Barang Masuk (IN), Keluar (OUT), Opname (OPN), & Penyesuaian (ADJ).",
                color: "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200",
              },
              {
                name: "4. Pengembalian_Barang",
                desc: "Catatan return barang ke gudang beserta kondisi fisik & petugas penerima.",
                color: "bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200",
              },
              {
                name: "5. Request_Barang",
                desc: "Daftar pengajuan barang dari form publik beserta status PENDING / APPROVED / REJECTED.",
                color: "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200",
              },
            ].map((sheet) => (
              <div key={sheet.name} className={`p-3 rounded-xl border ${sheet.color}`}>
                <p className="font-mono font-bold text-xs">{sheet.name}</p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{sheet.desc}</p>
              </div>
            ))}

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300">
              <strong className="font-mono block text-slate-800 dark:text-slate-100">
                + File Drive: ACTIS_Inventory_Database_Mirror.json
              </strong>
              Snapshot database terstruktur lengkap yang diperbarui otomatis di folder Google Drive pilihan Anda.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <Link
              href="/inventory/settings"
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              &larr; Kembali ke Pengaturan Inventory
            </Link>
          </div>
        </div>
      </div>

      {/* Sync Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Riwayat Mirroring Google Drive / Sheets (Terkini)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan riwayat sinkronisasi otomatis &amp; manual beserta jumlah record yang dikirim.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">{syncState.logs.length} Log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Waktu</th>
                <th className="py-2.5 px-4">Event Trigger</th>
                <th className="py-2.5 px-4">Dipicu Oleh</th>
                <th className="py-2.5 px-4 text-right">Cakupan</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Pesan / Tautan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {syncState.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Belum ada riwayat mirroring. Klik &ldquo;Tes Koneksi &amp; Buat Mirror&rdquo; atau &ldquo;Sync / Mirror Sekarang&rdquo; untuk memulai.
                  </td>
                </tr>
              ) : (
                syncState.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {log.event}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.triggered_by}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {log.items_count} SKU / {log.transactions_count} Tx
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      <span>{log.message}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
