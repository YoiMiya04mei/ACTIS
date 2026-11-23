"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Server,
  Shield,
  Send,
  PlugZap,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { resolveDefaultLandingHref } from "@/lib/accessLevels";
import {
  DEFAULT_CATEGORY_EMAIL_TEMPLATES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_EMAIL_CATEGORIES,
  type CategoryEmailTemplateConfig,
  type DocumentEmailCategory,
  type EmailEncryptionMode,
  type EmailGatewayPublicConfig,
} from "@/lib/emailGatewayTypes";
import { formatCreationTimestamp } from "@/utils/dateFormatter";

const SMTP_PRESETS: Array<{
  id: string;
  label: string;
  host: string;
  port: number;
  encryption: EmailEncryptionMode;
  hint: string;
}> = [
  {
    id: "gmail",
    label: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 587,
    encryption: "tls",
    hint: "Gunakan App Password Google (16 karakter) jika 2FA aktif.",
  },
  {
    id: "office365",
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    encryption: "tls",
    hint: "Pastikan Authenticated SMTP diaktifkan di Microsoft 365 Admin.",
  },
  {
    id: "ssl465",
    label: "Corporate SMTP (SSL 465)",
    host: "mail.jembatandata.com",
    port: 465,
    encryption: "ssl",
    hint: "Koneksi SSL langsung pada port 465.",
  },
  {
    id: "relay25",
    label: "SMTP Relay Internal (25)",
    host: "127.0.0.1",
    port: 25,
    encryption: "none",
    hint: "Relay jaringan internal tanpa STARTTLS/Auth.",
  },
];

export default function EmailGatewaySettingsPage() {
  const { currentUser, allowedMenus } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const fallbackHref = resolveDefaultLandingHref(allowedMenus);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingMode, setTestingMode] = useState<"verify" | "send_test" | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Server metadata
  const [hasPasswordSaved, setHasPasswordSaved] = useState(false);
  const [passwordCleared, setPasswordCleared] = useState(false);
  const [showPassInput, setShowPassInput] = useState(false);
  const [sourceType, setSourceType] = useState<"database" | "env" | "unconfigured">(
    "unconfigured"
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  // Editable form state
  const [enabled, setEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [encryption, setEncryption] = useState<EmailEncryptionMode>("tls");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromName, setFromName] = useState("ACTIS Operations");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [defaultCc, setDefaultCc] = useState("");
  const [signatureText, setSignatureText] = useState(
    "PT Jembatan Data Pangrango — ACTIS Operations & NOC\nEmail ini dikirim melalui ACTIS Email Gateway."
  );
  const [rejectUnauthorized, setRejectUnauthorized] = useState(true);
  const [categoryTemplates, setCategoryTemplates] = useState<
    Record<DocumentEmailCategory, CategoryEmailTemplateConfig>
  >(() => ({ ...DEFAULT_CATEGORY_EMAIL_TEMPLATES }));

  const [activeCategoryTab, setActiveCategoryTab] =
    useState<DocumentEmailCategory>("rfo");
  const [testRecipient, setTestRecipient] = useState("");

  useEffect(() => {
    if (currentUser?.email && !testRecipient) {
      setTestRecipient(currentUser.email);
    }
  }, [currentUser?.email, testRecipient]);

  const applyServerConfig = useCallback((cfg: EmailGatewayPublicConfig) => {
    setEnabled(cfg.enabled);
    setSmtpHost(cfg.smtpHost || "");
    setSmtpPort(cfg.smtpPort || 587);
    setEncryption(cfg.encryption || "tls");
    setSmtpUser(cfg.smtpUser || "");
    setSmtpPass("");
    setHasPasswordSaved(Boolean(cfg.hasPassword));
    setPasswordCleared(false);
    setFromName(cfg.fromName || "ACTIS Operations");
    setFromEmail(cfg.fromEmail || "");
    setReplyTo(cfg.replyTo || "");
    setDefaultCc(cfg.defaultCc || "");
    setSignatureText(cfg.signatureText || "");
    setRejectUnauthorized(cfg.rejectUnauthorized !== false);
    setCategoryTemplates(cfg.categoryTemplates || { ...DEFAULT_CATEGORY_EMAIL_TEMPLATES });
    setSourceType(cfg.source);
    setUpdatedAt(cfg.updatedAt);
    setUpdatedBy(cfg.updatedBy);
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-gateway", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.success && json.config) {
        applyServerConfig(json.config as EmailGatewayPublicConfig);
      }
    } catch {
      setNotice({
        type: "error",
        message: "Gagal memuat konfigurasi Email Gateway dari server.",
      });
    } finally {
      setLoading(false);
    }
  }, [applyServerConfig]);

  useEffect(() => {
    if (isAdmin) {
      loadConfig();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadConfig]);

  const draftPayload = useMemo(
    () => ({
      enabled,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort) || 587,
      encryption,
      smtpUser: smtpUser.trim(),
      smtpPass: smtpPass.trim() ? smtpPass : undefined,
      clearPassword: passwordCleared && !smtpPass.trim(),
      fromName: fromName.trim(),
      fromEmail: (fromEmail || smtpUser).trim(),
      replyTo: replyTo.trim(),
      defaultCc: defaultCc.trim(),
      signatureText: signatureText.trim(),
      rejectUnauthorized,
      categoryTemplates,
    }),
    [
      enabled,
      smtpHost,
      smtpPort,
      encryption,
      smtpUser,
      smtpPass,
      passwordCleared,
      fromName,
      fromEmail,
      replyTo,
      defaultCc,
      signatureText,
      rejectUnauthorized,
      categoryTemplates,
    ]
  );

  const handleApplyPreset = (preset: (typeof SMTP_PRESETS)[number]) => {
    setSmtpHost(preset.host);
    setSmtpPort(preset.port);
    setEncryption(preset.encryption);
    setNotice({
      type: "info",
      message: `Preset "${preset.label}" diterapkan (${preset.host}:${preset.port} • ${preset.encryption.toUpperCase()}). ${preset.hint}`,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (enabled && !smtpHost.trim()) {
      setNotice({
        type: "error",
        message: "Host Server SMTP wajib diisi jika Email Gateway diaktifkan.",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/email-gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal menyimpan konfigurasi Email Gateway.");
      }

      if (json.config) {
        applyServerConfig(json.config as EmailGatewayPublicConfig);
      }
      setNotice({
        type: "success",
        message: "Konfigurasi Email Gateway & Template Redaksi berhasil disimpan.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal menyimpan konfigurasi Email Gateway.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async (mode: "verify" | "send_test") => {
    setNotice(null);
    setTestingMode(mode);
    try {
      const res = await fetch("/api/email-gateway/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          testRecipient: testRecipient.trim(),
          draftConfig: draftPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Pengujian SMTP gagal.");
      }
      setNotice({
        type: "success",
        message: json.message || "Pengujian SMTP berhasil.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Pengujian SMTP gagal.",
      });
    } finally {
      setTestingMode(null);
    }
  };

  const handleResetCategoryTemplate = (cat: DocumentEmailCategory) => {
    setCategoryTemplates((prev) => ({
      ...prev,
      [cat]: { ...DEFAULT_CATEGORY_EMAIL_TEMPLATES[cat] },
    }));
    setNotice({
      type: "info",
      message: `Template redaksi kategori "${DOCUMENT_CATEGORY_LABELS[cat]}" dikembalikan ke bawaan (klik Simpan untuk menerapkan).`,
    });
  };

  const updateCategoryField = (
    cat: DocumentEmailCategory,
    field: keyof CategoryEmailTemplateConfig,
    value: string
  ) => {
    setCategoryTemplates((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: value,
      },
    }));
  };

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Akses Khusus Administrator
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Halaman konfigurasi <strong>Email Gateway (SMTP)</strong> hanya dapat dikelola oleh Administrator.
        </p>
        {fallbackHref && (
          <div className="pt-2">
            <Link
              href={fallbackHref}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Kembali ke Menu Utama
            </Link>
          </div>
        )}
      </div>
    );
  }

  const activeTemplate = categoryTemplates[activeCategoryTab];
  const isConfiguredNow = Boolean(smtpHost.trim() && (fromEmail || smtpUser).trim());

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Email Gateway (SMTP) &amp; Redaksi Surat
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  enabled && isConfiguredNow
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                {enabled && isConfiguredNow
                  ? "Aktif & Siap Mengirim"
                  : !isConfiguredNow
                    ? "Belum Dikonfigurasi"
                    : "Nonaktif"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Konfigurasi server SMTP terenkripsi untuk mengirim RFO, Surat Tugas, Berita Acara, Permit Barang, dan Payment Voucher langsung beserta lampiran PDF &amp; kata-kata redaksi otomatis.
            </p>
            {updatedAt && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                Terakhir disimpan oleh <strong className="text-slate-600 dark:text-slate-300">{updatedBy || "Administrator"}</strong> pada {formatCreationTimestamp(updatedAt)} ({sourceType === "env" ? "Env Variable" : "Database Terenkripsi"})
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/tools/documents"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span>Buat Surat</span>
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 text-xs sm:text-sm shadow-xs ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
              : notice.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200"
                : "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200"
          }`}
        >
          {notice.type === "error" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          )}
          <span className="leading-relaxed">{notice.message}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Memuat pengaturan Email Gateway...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Enable & Quick Presets + SMTP Connection */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <Server className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Konfigurasi Server SMTP
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Password SMTP disimpan terenkripsi AES-256-GCM di server.
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Aktifkan Email Gateway
                  </span>
                </label>
              </div>

              {/* Presets */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Preset Cepat Provider SMTP</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SMTP_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Host, Port, Encryption */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com / mail.domain.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Port SMTP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Enkripsi
                  </label>
                  <select
                    value={encryption}
                    onChange={(e) => {
                      const nextMode = e.target.value as EmailEncryptionMode;
                      setEncryption(nextMode);
                      if (nextMode === "ssl" && smtpPort === 587) setSmtpPort(465);
                      if (nextMode === "tls" && smtpPort === 465) setSmtpPort(587);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="tls">TLS / STARTTLS (587)</option>
                    <option value="ssl">SSL / TLS (465)</option>
                    <option value="none">Tanpa Enkripsi</option>
                  </select>
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Username SMTP
                  </label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="noc@jembatandata.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password / App Password SMTP
                    </label>
                    {hasPasswordSaved && !passwordCleared && (
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordCleared(true);
                          setSmtpPass("");
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus Sandi
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassInput ? "text" : "password"}
                      value={smtpPass}
                      onChange={(e) => {
                        setPasswordCleared(false);
                        setSmtpPass(e.target.value);
                      }}
                      placeholder={
                        hasPasswordSaved && !passwordCleared
                          ? "Tersimpan terenkripsi (kosongkan jika tetap)"
                          : "Masukkan password / app password"
                      }
                      className="w-full pl-3.5 pr-10 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassInput((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      {showPassInput ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Identity */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Pengirim (From Name)
                    </label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="PT Jembatan Data Pangrango — NOC"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Pengirim (From Email) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="noc@jembatandata.com"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Reply-To Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="support@jembatandata.com"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Default CC Semua Surat (Opsional)
                    </label>
                    <input
                      type="text"
                      value={defaultCc}
                      onChange={(e) => setDefaultCc(e.target.value)}
                      placeholder="arsip@jembatandata.com, noc@jembatandata.com"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Signature / Footer Standar Email
                  </label>
                  <textarea
                    rows={3}
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white leading-relaxed"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rejectUnauthorized}
                    onChange={(e) => setRejectUnauthorized(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Validasi sertifikat SSL/TLS ketat (matikan hanya jika SMTP internal memakai self-signed certificate)
                  </span>
                </label>
              </div>
            </div>

            {/* Card 2: Uji Koneksi & Test Email */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <PlugZap className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Uji Koneksi &amp; Kirim Test Email
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Uji langsung konfigurasi di form ini sebelum atau sesudah disimpan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRunTest("verify")}
                  disabled={testingMode !== null}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testingMode === "verify" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlugZap className="w-4 h-4" />
                  )}
                  <span>Verifikasi Koneksi SMTP</span>
                </button>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Alamat Email Penerima Uji Coba
                  </label>
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="email-anda@domain.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRunTest("send_test")}
                    disabled={testingMode !== null}
                    className="w-full px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {testingMode === "send_test" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Kirim Test Email Sekarang</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  Cara Penggunaan di Modul Dokumen:
                </p>
                <p>
                  Setelah selesai membuat surat (<strong>RFO, Surat Tugas, Berita Acara, Permit Barang, atau Payment Voucher</strong>) maupun melalui halaman <strong>Arsip Dokumen</strong>, klik tombol <strong>Kirim Email</strong> untuk menampilkan redaksi penjelasan khusus sesuai kategorinya dan melampirkan PDF resmi otomatis.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Template Redaksi per Kategori Surat */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Pengaturan Kata-Kata Redaksi &amp; Penjelasan per Kategori Surat
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Atur kalimat pembuka, penutup, prefix subjek, dan penerima default otomatis untuk masing-masing jenis surat ACTIS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResetCategoryTemplate(activeCategoryTab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default Kategori Ini</span>
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_EMAIL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryTab(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    activeCategoryTab === cat
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {DOCUMENT_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Active Category Editor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prefix Subjek Email ({DOCUMENT_CATEGORY_LABELS[activeCategoryTab]})
                </label>
                <input
                  type="text"
                  value={activeTemplate.subjectPrefix}
                  onChange={(e) =>
                    updateCategoryField(activeCategoryTab, "subjectPrefix", e.target.value)
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Penerima Default (Opsional, pisahkan koma)
                </label>
                <input
                  type="text"
                  value={activeTemplate.defaultRecipients}
                  onChange={(e) =>
                    updateCategoryField(activeCategoryTab, "defaultRecipients", e.target.value)
                  }
                  placeholder="finance@jembatandata.com / noc@klien.co.id"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Paragraf Penjelasan / Kata-Kata Redaksi Pembuka
                </label>
                <textarea
                  rows={4}
                  value={activeTemplate.explanationIntro}
                  onChange={(e) =>
                    updateCategoryField(activeCategoryTab, "explanationIntro", e.target.value)
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Penutup &amp; Tindak Lanjut
                </label>
                <textarea
                  rows={4}
                  value={activeTemplate.closingNote}
                  onChange={(e) =>
                    updateCategoryField(activeCategoryTab, "closingNote", e.target.value)
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white leading-relaxed"
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
