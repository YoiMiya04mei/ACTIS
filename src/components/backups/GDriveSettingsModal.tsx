"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Code2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

interface GDriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function GDriveSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: GDriveSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<"apps_script" | "oauth2" | "service_account">("apps_script");
  const [folderId, setFolderId] = useState("");
  const [folderPerDevice, setFolderPerDevice] = useState(true);

  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [appsScriptSecret, setAppsScriptSecret] = useState("");
  const [hasAppsScriptSecret, setHasAppsScriptSecret] = useState(false);

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [hasOauthClientSecret, setHasOauthClientSecret] = useState(false);
  const [oauthRefreshToken, setOauthRefreshToken] = useState("");
  const [hasOauthRefreshToken, setHasOauthRefreshToken] = useState(false);

  const [saClientEmail, setSaClientEmail] = useState("");
  const [saPrivateKey, setSaPrivateKey] = useState("");
  const [hasSaPrivateKey, setHasSaPrivateKey] = useState(false);

  const [appsScriptTemplate, setAppsScriptTemplate] = useState("");
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
    fileUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/backups/gdrive");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal memuat pengaturan Google Drive.");
        }
        const d = json.data;
        setEnabled(Boolean(d.enabled));
        setMethod(d.method || "apps_script");
        setFolderId(d.folder_id || "");
        setFolderPerDevice(d.folder_per_device !== false);
        setAppsScriptUrl(d.apps_script_url || "");
        setAppsScriptSecret("");
        setHasAppsScriptSecret(Boolean(d.has_apps_script_secret));
        setOauthClientId(d.oauth_client_id || "");
        setOauthClientSecret("");
        setHasOauthClientSecret(Boolean(d.has_oauth_client_secret));
        setOauthRefreshToken("");
        setHasOauthRefreshToken(Boolean(d.has_oauth_refresh_token));
        setSaClientEmail(d.sa_client_email || "");
        setSaPrivateKey("");
        setHasSaPrivateKey(Boolean(d.has_sa_private_key));
        setAppsScriptTemplate(json.appsScriptTemplate || "");
      } catch (err: any) {
        setFeedback({ type: "error", text: err.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/backups/gdrive/oauth/callback`
      : "/api/backups/gdrive/oauth/callback";

  const handleCopy = async (text: string, which: "script" | "redirect") => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "script") {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      } else {
        setCopiedRedirectUri(true);
        setTimeout(() => setCopiedRedirectUri(false), 2000);
      }
    } catch {}
  };

  const buildPayload = (action: "save" | "test") => ({
    action,
    enabled,
    method,
    folder_id: folderId,
    folder_per_device: folderPerDevice,
    apps_script_url: appsScriptUrl,
    apps_script_secret: appsScriptSecret || undefined,
    oauth_client_id: oauthClientId,
    oauth_client_secret: oauthClientSecret || undefined,
    oauth_refresh_token: oauthRefreshToken || undefined,
    sa_client_email: saClientEmail,
    sa_private_key: saPrivateKey || undefined,
  });

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/backups/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("save")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan konfigurasi Google Drive.");
      }
      setFeedback({ type: "success", text: json.message });
      onSaved();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestUpload = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/backups/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("test")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Tes upload ke Google Drive gagal.");
      }
      setEnabled(true);
      onSaved();
      setFeedback({
        type: "success",
        text: json.message,
        fileUrl: json.data?.fileUrl,
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleConnectOAuth = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/backups/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("save")),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan Client ID & Secret.");
      }
      window.location.href = "/api/backups/gdrive/oauth/authorize";
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Konfigurasi Sinkronisasi Otomatis Google Drive
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih Apps Script Webhook (tercepat), OAuth2 Akun Google, atau Service Account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memuat konfigurasi Google Drive...</span>
            </div>
          ) : (
            <>
              {feedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium flex items-start justify-between gap-3 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                  {feedback.fileUrl && (
                    <a
                      href={feedback.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 shrink-0 font-bold underline"
                    >
                      <span>Buka File</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Master Toggle & Target Folder */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Aktifkan Auto-Sync ke Google Drive
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Setiap backup (auto terjadwal maupun manual) langsung diunggah ke Google Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      enabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Google Drive Folder ID Tujuan
                    </label>
                    <input
                      type="text"
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      placeholder="Contoh: 1AbCdeFgHijKlMnOpQrStUvWxYz"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Ambil dari URL folder Drive: <code className="font-mono">drive.google.com/drive/folders/<strong>FOLDER_ID</strong></code>
                    </p>
                  </div>

                  <div className="flex items-center pt-3 sm:pt-5">
                    <label className="inline-flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={folderPerDevice}
                        onChange={(e) => setFolderPerDevice(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Buat subfolder otomatis per perangkat (e.g. MIKROTIK - Core-JKT)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Method Tabs */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Metode Autentikasi Google Drive
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("apps_script")}
                    className={`p-3 rounded-xl border text-left transition ${
                      method === "apps_script"
                        ? "border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      1. Apps Script Webhook
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Cepat & support Gmail pribadi
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("oauth2")}
                    className={`p-3 rounded-xl border text-left transition ${
                      method === "oauth2"
                        ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      2. Google OAuth2 API
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Direct API via Login Akun Google
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("service_account")}
                    className={`p-3 rounded-xl border text-left transition ${
                      method === "service_account"
                        ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      3. Service Account JSON
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Google Workspace Shared Drive
                    </div>
                  </button>
                </div>
              </div>

              {/* Method 1: Apps Script */}
              {method === "apps_script" && (
                <div className="space-y-4 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Google Apps Script Web App URL *
                    </label>
                    <input
                      type="url"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Secret Token (Opsional — harus cocok dengan `SHARED_SECRET` di Apps Script)
                    </label>
                    <input
                      type="password"
                      value={appsScriptSecret}
                      onChange={(e) => setAppsScriptSecret(e.target.value)}
                      placeholder={
                        hasAppsScriptSecret ? "•••••••••••• (tersimpan — isi jika ingin ganti)" : "Opsional"
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowScriptCode(!showScriptCode)}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <Code2 className="w-4 h-4" />
                        <span>
                          {showScriptCode
                            ? "Sembunyikan Kode Google Apps Script (Code.gs)"
                            : "Lihat & Salin Kode Google Apps Script (Code.gs)"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(appsScriptTemplate, "script")}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
                      >
                        {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedScript ? "Tersalin!" : "Salin Script Code.gs"}</span>
                      </button>
                    </div>

                    {showScriptCode && (
                      <pre className="mt-3 p-3.5 rounded-xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-64 border border-slate-800">
                        {appsScriptTemplate}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Method 2: OAuth2 */}
              {method === "oauth2" && (
                <div className="space-y-4 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p className="font-bold text-slate-800 dark:text-white">
                      Authorized Redirect URI untuk Google Cloud Console:
                    </p>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] break-all">
                        {redirectUri}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(redirectUri, "redirect")}
                        className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold shrink-0"
                      >
                        {copiedRedirectUri ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        OAuth2 Client ID *
                      </label>
                      <input
                        type="text"
                        value={oauthClientId}
                        onChange={(e) => setOauthClientId(e.target.value)}
                        placeholder="xxxxx.apps.googleusercontent.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        OAuth2 Client Secret *
                      </label>
                      <input
                        type="password"
                        value={oauthClientSecret}
                        onChange={(e) => setOauthClientSecret(e.target.value)}
                        placeholder={hasOauthClientSecret ? "•••••••••••• (tersimpan)" : "GOCSPX-..."}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center space-x-2 text-xs">
                      <ShieldCheck
                        className={`w-4 h-4 ${hasOauthRefreshToken ? "text-emerald-600" : "text-slate-400"}`}
                      />
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Status Token:{" "}
                        {hasOauthRefreshToken ? (
                          <span className="text-emerald-600">Terhubung (Refresh Token Tersimpan)</span>
                        ) : (
                          <span className="text-amber-600">Belum Terhubung</span>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleConnectOAuth}
                      disabled={saving}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Hubungkan Akun Google (OAuth2)</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Atau Tempel Refresh Token Manual (Opsional)
                    </label>
                    <input
                      type="password"
                      value={oauthRefreshToken}
                      onChange={(e) => setOauthRefreshToken(e.target.value)}
                      placeholder={hasOauthRefreshToken ? "•••••••••••• (tersimpan)" : "1//0g..."}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Method 3: Service Account */}
              {method === "service_account" && (
                <div className="space-y-4 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                    Catatan Google: Service Account cocok untuk <strong>Shared Drive (Google Workspace)</strong>. Untuk akun Gmail pribadi (`@gmail.com`), Google sering menolak upload Service Account karena kuota 0 GB — gunakan metode <strong>Apps Script Webhook</strong> atau <strong>OAuth2</strong>.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Service Account Client Email *
                    </label>
                    <input
                      type="email"
                      value={saClientEmail}
                      onChange={(e) => setSaClientEmail(e.target.value)}
                      placeholder="actis-backup@project-id.iam.gserviceaccount.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Service Account Private Key (PEM) *
                    </label>
                    <textarea
                      rows={4}
                      value={saPrivateKey}
                      onChange={(e) => setSaPrivateKey(e.target.value)}
                      placeholder={
                        hasSaPrivateKey
                          ? "Private Key sudah tersimpan terenkripsi. Tempel ulang jika ingin memperbarui."
                          : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleTestUpload}
              disabled={loading || testing || saving}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              <span>{testing ? "Menguji Upload..." : "Tes Upload Google Drive"}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={loading || saving || testing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-60"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

