"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Archive,
  Plus,
  RefreshCw,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Eye,
  GitCompare,
  Trash2,
  Edit3,
  UploadCloud,
  Wifi,
  ExternalLink,
  Search,
  Lock,
  Save,
  HardDrive,
  FileArchive,
  Play,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { DeviceFormModal } from "@/components/backups/DeviceFormModal";
import { GDriveSettingsModal } from "@/components/backups/GDriveSettingsModal";
import { ConfigViewerDiffModal } from "@/components/backups/ConfigViewerDiffModal";
import { ManualUploadModal } from "@/components/backups/ManualUploadModal";
import {
  formatBackupSize,
  formatJakartaDateTime,
  formatScheduleLabel,
  getVendorProfile,
} from "@/lib/backupVendorProfiles";

interface BackupSummary {
  total_devices: number;
  active_auto_devices: number;
  success_devices: number;
  failed_devices: number;
  total_backups: number;
  synced_gdrive: number;
  failed_gdrive: number;
  pending_gdrive: number;
}

interface GlobalBackupSettings {
  auto_enabled: boolean;
  default_schedule_mode: "1d" | "3d" | "7d" | "30d" | "custom_days";
  default_interval_days: number;
  window_start: string;
  window_end: string;
  timezone: string;
  default_retention_count: number;
  only_save_if_changed: boolean;
  last_scheduler_tick_at?: string | null;
}

const VENDOR_BADGE_MAP: Record<string, string> = {
  mikrotik: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  juniper: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  huawei: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  cisco: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  custom: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

export default function NetworkBackupsPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isAuthorizedRole = currentUser?.role === "admin" || currentUser?.role === "noc_engineer";

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<"NONE" | "AUTH_REQUIRED" | "FORBIDDEN">("NONE");

  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalBackupSettings>({
    auto_enabled: true,
    default_schedule_mode: "1d",
    default_interval_days: 1,
    window_start: "03:00",
    window_end: "05:00",
    timezone: "Asia/Jakarta",
    default_retention_count: 30,
    only_save_if_changed: false,
  });
  const [gdriveSummary, setGdriveSummary] = useState<{
    enabled: boolean;
    method: string;
    is_configured: boolean;
    folder_per_device: boolean;
  } | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [popSites, setPopSites] = useState<any[]>([]);

  // Filters
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("ALL");
  const [selectedVendor, setSelectedVendor] = useState<string>("ALL");
  const [selectedBackupType, setSelectedBackupType] = useState<string>("ALL");
  const [selectedGdriveStatus, setSelectedGdriveStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Action busy states
  const [savingSettings, setSavingSettings] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [syncingPending, setSyncingPending] = useState(false);
  const [runningDeviceId, setRunningDeviceId] = useState<string | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [syncingRecordId, setSyncingRecordId] = useState<string | null>(null);

  // Modals
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [showGDriveModal, setShowGDriveModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [viewerBackupId, setViewerBackupId] = useState<string | null>(null);
  const [viewerTab, setViewerTab] = useState<"view" | "diff">("view");

  // Toast Banner
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("gdrive_oauth") === "connected") {
      showToast("success", "Akun Google Drive (OAuth2) berhasil terhubung dan diaktifkan!");
      window.history.replaceState({}, "", "/backups");
    } else if (sp.get("gdrive_error")) {
      showToast("error", sp.get("gdrive_error") || "OAuth Google Drive gagal.");
      window.history.replaceState({}, "", "/backups");
    }
  }, []);

  const fetchBackupsData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDeviceId !== "ALL") params.set("deviceId", selectedDeviceId);
      if (selectedVendor !== "ALL") params.set("vendor", selectedVendor);
      if (selectedBackupType !== "ALL") params.set("backupType", selectedBackupType);
      if (selectedGdriveStatus !== "ALL") params.set("gdriveStatus", selectedGdriveStatus);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/backups?${params.toString()}`);
      const json = await res.json();

      if (res.status === 401) {
        setAuthError("AUTH_REQUIRED");
        return;
      }
      if (res.status === 403) {
        setAuthError("FORBIDDEN");
        return;
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data backup.");
      }

      setAuthError("NONE");
      setSummary(json.data.summary);
      setGlobalSettings(json.data.globalSettings);
      setGdriveSummary(json.data.gdriveSummary);
      setDevices(json.data.devices || []);
      setBackups(json.data.backups || []);
      setPopSites(json.data.popSites || []);
    } catch (err: any) {
      showToast("error", err.message || "Gagal menghubungi server.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedDeviceId, selectedVendor, selectedBackupType, selectedGdriveStatus, searchQuery]);

  useEffect(() => {
    fetchBackupsData(false);
  }, [fetchBackupsData]);

  const handleSaveGlobalSettings = async (override?: Partial<GlobalBackupSettings>) => {
    if (!isAdmin) return;
    setSavingSettings(true);
    const payload = { ...globalSettings, ...override };
    try {
      const res = await fetch("/api/backups/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan jadwal otomatis.");
      }
      setGlobalSettings(json.data);
      showToast("success", json.message || "Jadwal otomatis berhasil disimpan.");
      fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSchedulePreset = (mode: GlobalBackupSettings["default_schedule_mode"]) => {
    const daysMap: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };
    const nextDays = daysMap[mode] ?? globalSettings.default_interval_days ?? 1;
    setGlobalSettings((prev) => ({
      ...prev,
      default_schedule_mode: mode,
      default_interval_days: nextDays,
    }));
  };

  const handleRunDeviceBackup = async (deviceId: string) => {
    setRunningDeviceId(deviceId);
    try {
      const res = await fetch(`/api/backups/devices/${deviceId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menarik konfigurasi.");
      }
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
      await fetchBackupsData(true);
    } finally {
      setRunningDeviceId(null);
    }
  };

  const handleBackupNowPrimary = async () => {
    if (selectedDeviceId !== "ALL") {
      await handleRunDeviceBackup(selectedDeviceId);
      return;
    }

    setRunningBatch(true);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup_all" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menjalankan batch backup.");
      }
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setRunningBatch(false);
    }
  };

  const handleTestSshDevice = async (deviceId: string) => {
    setTestingDeviceId(deviceId);
    try {
      const res = await fetch(`/api/backups/devices/${deviceId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_ssh" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Tes koneksi SSH gagal.");
      }
      showToast("success", json.message);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleDeleteDevice = async (dev: any) => {
    if (!isAdmin) return;
    if (!confirm(`Hapus perangkat '${dev.name}' (${dev.host}) beserta seluruh riwayat backup-nya di database?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/backups/devices/${dev.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      if (selectedDeviceId === dev.id) setSelectedDeviceId("ALL");
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleDeleteRecord = async (recId: string) => {
    if (!isAdmin) return;
    if (!confirm("Hapus snapshot backup ini dari database VPS?")) return;
    try {
      const res = await fetch(`/api/backups/records/${recId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleSyncRecordGDrive = async (recId: string) => {
    setSyncingRecordId(recId);
    try {
      const res = await fetch(`/api/backups/records/${recId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_gdrive" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
      await fetchBackupsData(true);
    } finally {
      setSyncingRecordId(null);
    }
  };

  const handleSyncPendingGDrive = async () => {
    setSyncingPending(true);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_pending_gdrive" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      showToast("success", json.message);
      await fetchBackupsData(true);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSyncingPending(false);
    }
  };

  if (authError === "AUTH_REQUIRED") {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Sesi Login Terverifikasi Diperlukan
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Karena fitur ini menyimpan konfigurasi router & kredensial SSH sensitif, silakan masuk melalui halaman login resmi ACTIS terlebih dahulu.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-sm"
        >
          Masuk ke Halaman Login
        </Link>
      </div>
    );
  }

  if (authError === "FORBIDDEN" || !isAuthorizedRole) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-center space-y-3 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Akses Ditolak</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Halaman Network Config Backup & Google Drive hanya dapat diakses oleh akun <strong>Administrator</strong> dan <strong>NOC Engineer</strong>.
        </p>
      </div>
    );
  }

  const selectedDeviceObj = devices.find((d) => d.id === selectedDeviceId) || null;

  return (
    <div className="space-y-6">
      {/* Page Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Network Config Backup &amp; Google Drive Sync
            </h1>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                gdriveSummary?.is_configured
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              }`}
            >
              {gdriveSummary?.is_configured
                ? `GDrive Aktif (${gdriveSummary.method === "apps_script" ? "Apps Script" : gdriveSummary.method === "oauth2" ? "OAuth2" : "Service Account"})`
                : "GDrive Belum Dikonfigurasi"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Backup otomatis multi-vendor (Juniper, Huawei, MikroTik, Cisco) tersimpan aman di PostgreSQL VPS &amp; tersinkron otomatis ke Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingDevice(null);
              setShowDeviceModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Perangkat</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold"
          >
            <UploadCloud className="w-4 h-4 text-amber-500" />
            <span>Upload Manual</span>
          </button>

          <a
            href={`/api/backups/export-zip${selectedDeviceId !== "ALL" ? `?deviceId=${selectedDeviceId}` : ""}`}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold"
          >
            <FileArchive className="w-4 h-4 text-indigo-500" />
            <span>Download ZIP</span>
          </a>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowGDriveModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold"
            >
              <Cloud className="w-4 h-4" />
              <span>Konfigurasi Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            banner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="text-xs underline">
            Tutup
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Total Perangkat Network</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_devices ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              ({summary?.active_auto_devices ?? 0} auto terjadwal)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Status Penarikan Terakhir</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-600">
              {summary?.success_devices ?? 0}
            </span>
            <span className="text-xs text-slate-500">sukses</span>
            {(summary?.failed_devices ?? 0) > 0 && (
              <span className="text-xs font-bold text-rose-600">
                • {summary?.failed_devices} gagal
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Snapshot di Database VPS</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_backups ?? 0}
            </span>
            <span className="text-xs text-slate-500">arsip tersimpan</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Sinkron Google Drive</span>
            <Cloud className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-600">
              {summary?.synced_gdrive ?? 0}
            </span>
            <span className="text-xs text-slate-500">tersinkron</span>
            {((summary?.pending_gdrive ?? 0) + (summary?.failed_gdrive ?? 0)) > 0 && (
              <span className="text-xs font-bold text-amber-600">
                • {(summary?.pending_gdrive ?? 0) + (summary?.failed_gdrive ?? 0)} antre
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Automatic Backup Settings Card (Matching Screenshot + Flexible Schedule) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              Automatic Backup Settings
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              disabled={!isAdmin || savingSettings}
              onClick={() => handleSaveGlobalSettings({ auto_enabled: !globalSettings.auto_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                globalSettings.auto_enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              } ${!isAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
              title={isAdmin ? "Aktifkan / Nonaktifkan Auto Backup" : "Hanya Administrator yang dapat mengubah jadwal global"}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  globalSettings.auto_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-xs font-black ${
                globalSettings.auto_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
              }`}
            >
              {globalSettings.auto_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Automatic Backup ({globalSettings.window_start} – {globalSettings.window_end} WIB •{" "}
                {formatScheduleLabel(globalSettings.default_schedule_mode, globalSettings.default_interval_days)})
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When enabled, backups will be automatically created every{" "}
                <strong>{globalSettings.default_interval_days} day(s)</strong> between{" "}
                <strong>{globalSettings.window_start}</strong> and <strong>{globalSettings.window_end} WIB</strong>, stored in PostgreSQL VPS, and synced to Google Drive.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["1d", "3d", "7d", "30d", "custom_days"] as const).map((preset) => {
                const labels: Record<string, string> = {
                  "1d": "1 Hari",
                  "3d": "3 Hari",
                  "7d": "1 Minggu",
                  "30d": "1 Bulan",
                  custom_days: "Custom",
                };
                const active = globalSettings.default_schedule_mode === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => handleSchedulePreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                    } disabled:opacity-60`}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Fine Tuning Row */}
          {isAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 items-end">
              {globalSettings.default_schedule_mode === "custom_days" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Interval (Hari)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={globalSettings.default_interval_days}
                    onChange={(e) =>
                      setGlobalSettings((p) => ({
                        ...p,
                        default_interval_days: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Jam Mulai (WIB)
                </label>
                <input
                  type="time"
                  value={globalSettings.window_start}
                  onChange={(e) =>
                    setGlobalSettings((p) => ({ ...p, window_start: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Jam Selesai (WIB)
                </label>
                <input
                  type="time"
                  value={globalSettings.window_end}
                  onChange={(e) =>
                    setGlobalSettings((p) => ({ ...p, window_end: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Retensi Default (Snapshot)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={globalSettings.default_retention_count}
                  onChange={(e) =>
                    setGlobalSettings((p) => ({
                      ...p,
                      default_retention_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() => handleSaveGlobalSettings()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-60"
                >
                  {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Simpan Jadwal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar: Green "Backup config now" + Sync GDrive */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleBackupNowPrimary}
            disabled={runningBatch || runningDeviceId !== null || devices.length === 0}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-md shadow-emerald-600/20 disabled:opacity-60 transition"
          >
            {runningBatch || runningDeviceId ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            <span>
              {runningBatch
                ? "Menarik Config Semua Perangkat..."
                : selectedDeviceObj
                  ? `Backup Config Now (${selectedDeviceObj.name})`
                  : "Backup Config Now (Semua Perangkat)"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSyncPendingGDrive}
            disabled={syncingPending || ((summary?.pending_gdrive ?? 0) + (summary?.failed_gdrive ?? 0)) === 0}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Cloud className={`w-4 h-4 text-emerald-600 ${syncingPending ? "animate-bounce" : ""}`} />
            <span>
              Sinkron Antrean GDrive ({(summary?.pending_gdrive ?? 0) + (summary?.failed_gdrive ?? 0)})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => fetchBackupsData(false)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Network Devices Inventory Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Daftar Perangkat Network ({devices.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klik nama perangkat untuk memfilter tabel riwayat backup-nya di bawah.
            </p>
          </div>
          {selectedDeviceId !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedDeviceId("ALL")}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Tampilkan Semua Perangkat
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-4">Perangkat</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Jadwal</th>
                <th className="py-3 px-4">Backup Terakhir</th>
                <th className="py-3 px-4">Berikutnya</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Belum ada perangkat terdaftar. Klik <strong>+ Tambah Perangkat</strong> untuk mendaftarkan router MikroTik, Juniper, Huawei, atau Cisco Anda.
                  </td>
                </tr>
              ) : (
                devices.map((dev) => {
                  const isSelected = selectedDeviceId === dev.id;
                  const prof = getVendorProfile(dev.vendor);
                  const badgeCls = VENDOR_BADGE_MAP[prof.id] || VENDOR_BADGE_MAP.custom;
                  return (
                    <tr
                      key={dev.id}
                      className={`transition ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/30"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedDeviceId(isSelected ? "ALL" : dev.id)}
                          className="text-left group"
                        >
                          <div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600">
                            {dev.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {dev.host}:{dev.port} {dev.protocol === "manual" ? "• Manual" : ""}
                          </div>
                          {dev.pop_site && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              Site: {dev.pop_site.site_id}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${badgeCls}`}>
                          {prof.shortLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {dev.schedule_mode === "global"
                            ? `Global (${globalSettings.default_interval_days}d)`
                            : formatScheduleLabel(dev.schedule_mode, dev.schedule_days)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {dev.auto_backup_enabled && dev.protocol === "ssh"
                            ? `${dev.schedule_time || globalSettings.window_start} WIB`
                            : "Auto Nonaktif"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                        {formatJakartaDateTime(dev.last_backup_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                        {dev.next_backup_at ? formatJakartaDateTime(dev.next_backup_at) : "-"}
                      </td>
                      <td className="py-3 px-4">
                        {dev.last_status === "SUCCESS" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>OK</span>
                          </span>
                        )}
                        {dev.last_status === "FAILED" && (
                          <span
                            title={dev.last_error || "Gagal"}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}
                        {(dev.last_status === "IDLE" || dev.last_status === "RUNNING") && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                            <span>{dev.last_status}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          {dev.protocol === "ssh" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRunDeviceBackup(dev.id)}
                                disabled={runningDeviceId === dev.id}
                                title="Tarik Backup Sekarang"
                                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {runningDeviceId === dev.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTestSshDevice(dev.id)}
                                disabled={testingDeviceId === dev.id}
                                title="Tes Koneksi SSH"
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                <Wifi className={`w-3.5 h-3.5 ${testingDeviceId === dev.id ? "animate-pulse text-blue-600" : ""}`} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDevice(dev);
                              setShowDeviceModal(true);
                            }}
                            title="Edit Perangkat"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDevice(dev)}
                              title="Hapus Perangkat"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backup History Table (Matching User Reference Screenshot) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Riwayat Backup Konfigurasi {selectedDeviceObj ? `— ${selectedDeviceObj.name}` : ""}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan tanggal backup (WIB), jumlah baris, ukuran file, tipe (auto/manual/upload), &amp; status sinkron Google Drive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari perangkat / IP..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none"
              />
            </div>

            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="ALL">Semua Perangkat</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.vendor.toUpperCase()})
                </option>
              ))}
            </select>

            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="ALL">Semua Vendor</option>
              <option value="mikrotik">MikroTik</option>
              <option value="juniper">Juniper</option>
              <option value="huawei">Huawei</option>
              <option value="cisco">Cisco</option>
              <option value="custom">Custom</option>
            </select>

            <select
              value={selectedBackupType}
              onChange={(e) => setSelectedBackupType(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="auto">auto</option>
              <option value="manual">manual</option>
              <option value="upload">upload</option>
            </select>

            <select
              value={selectedGdriveStatus}
              onChange={(e) => setSelectedGdriveStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="ALL">Semua Status GDrive</option>
              <option value="SYNCED">Synced</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                {selectedDeviceId === "ALL" && <th className="py-3 px-4">Perangkat</th>}
                <th className="py-3 px-4">Backup date</th>
                <th className="py-3 px-4">Backup lines</th>
                <th className="py-3 px-4">Backup size</th>
                <th className="py-3 px-4">Backup type</th>
                <th className="py-3 px-4">Google Drive</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {backups.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedDeviceId === "ALL" ? 7 : 6}
                    className="py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    Belum ada riwayat backup konfigurasi untuk filter ini.
                  </td>
                </tr>
              ) : (
                backups.map((rec) => {
                  const prof = getVendorProfile(rec.device?.vendor);
                  const isSuccess = rec.status === "SUCCESS";
                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {selectedDeviceId === "ALL" && (
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {rec.device?.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {prof.shortLabel} • {rec.device?.host}
                          </div>
                        </td>
                      )}

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {formatJakartaDateTime(rec.created_at)}
                      </td>

                      <td className="py-3 px-4">
                        {isSuccess ? (
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                              {rec.line_count}
                            </span>
                            {rec.changed_from_prev ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                +{rec.diff_added}/-{rec.diff_removed}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Identik
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            title={rec.error_message || "Backup gagal"}
                            className="inline-flex items-center space-x-1 text-rose-600 font-bold"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {isSuccess ? formatBackupSize(rec.size_bytes) : "-"}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                            rec.backup_type === "auto"
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                              : rec.backup_type === "upload"
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                          }`}
                        >
                          {rec.backup_type}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {rec.gdrive_status === "SYNCED" ? (
                          rec.gdrive_file_url ? (
                            <a
                              href={rec.gdrive_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Synced</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Synced</span>
                            </span>
                          )
                        ) : rec.gdrive_status === "FAILED" ? (
                          <span
                            title={rec.gdrive_error || "Sinkronisasi GDrive gagal"}
                            className="inline-flex items-center space-x-1 text-rose-600 font-bold"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        ) : rec.gdrive_status === "PENDING" ? (
                          <span className="text-amber-600 font-bold">Pending</span>
                        ) : (
                          <span className="text-slate-400">Skipped</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setViewerBackupId(rec.id);
                              setViewerTab("view");
                            }}
                            title="Lihat Konfigurasi"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-100 hover:text-blue-700"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isSuccess && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setViewerBackupId(rec.id);
                                  setViewerTab("diff");
                                }}
                                title="Bandingkan Perubahan (Diff)"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                              >
                                <GitCompare className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={`/api/backups/records/${rec.id}/download`}
                                title="Download File Config"
                                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleSyncRecordGDrive(rec.id)}
                                disabled={syncingRecordId === rec.id}
                                title="Upload / Sync ke Google Drive"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {syncingRecordId === rec.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Cloud className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.id)}
                              title="Hapus Snapshot"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <DeviceFormModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onSaved={() => fetchBackupsData(true)}
        editingDevice={editingDevice}
        popSites={popSites}
      />

      {isAdmin && (
        <GDriveSettingsModal
          isOpen={showGDriveModal}
          onClose={() => setShowGDriveModal(false)}
          onSaved={() => fetchBackupsData(true)}
        />
      )}

      <ManualUploadModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onUploaded={() => fetchBackupsData(true)}
        devices={devices}
        defaultDeviceId={selectedDeviceId}
      />

      <ConfigViewerDiffModal
        backupId={viewerBackupId}
        initialTab={viewerTab}
        onClose={() => setViewerBackupId(null)}
      />
    </div>
  );
}

