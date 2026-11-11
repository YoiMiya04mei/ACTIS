"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Server,
  Shield,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wifi,
  Cloud,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { NetworkVendor, VENDOR_PROFILES } from "@/lib/backupVendorProfiles";

interface PopSiteOption {
  id: string;
  site_id: string;
  nama_perusahaan?: string | null;
  nama_pic: string;
  ip_public?: string | null;
}

interface DeviceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingDevice?: any | null;
  popSites: PopSiteOption[];
}

export function DeviceFormModal({
  isOpen,
  onClose,
  onSaved,
  editingDevice,
  popSites,
}: DeviceFormModalProps) {
  const isEditing = Boolean(editingDevice?.id);

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [vendor, setVendor] = useState<NetworkVendor>("mikrotik");
  const [platform, setPlatform] = useState("");
  const [protocol, setProtocol] = useState<"ssh" | "manual">("ssh");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState("");
  const [sshPrivateKey, setSshPrivateKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);

  const [preCommand, setPreCommand] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [popSiteId, setPopSiteId] = useState("");

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [scheduleMode, setScheduleMode] = useState("global");
  const [scheduleDays, setScheduleDays] = useState("1");
  const [scheduleTime, setScheduleTime] = useState("");
  const [retentionCount, setRetentionCount] = useState("30");
  const [gdriveSyncEnabled, setGdriveSyncEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFeedback(null);
    setShowPassword(false);

    if (editingDevice) {
      const v = ((editingDevice.vendor || "mikrotik").toLowerCase() as NetworkVendor) || "mikrotik";
      setName(editingDevice.name || "");
      setHost(editingDevice.host || "");
      setPort(String(editingDevice.port || 22));
      setVendor(VENDOR_PROFILES[v] ? v : "custom");
      setPlatform(editingDevice.platform || "");
      setProtocol(editingDevice.protocol === "manual" ? "manual" : "ssh");
      setUsername(editingDevice.username || "");
      setPassword("");
      setEnablePassword("");
      setSshPrivateKey("");
      setShowAdvancedAuth(
        Boolean(editingDevice.has_enable_password || editingDevice.has_ssh_private_key || editingDevice.custom_command || editingDevice.pre_command)
      );
      setPreCommand(editingDevice.pre_command || "");
      setCustomCommand(editingDevice.custom_command || "");
      setPopSiteId(editingDevice.pop_site_id || "");
      setAutoBackupEnabled(Boolean(editingDevice.auto_backup_enabled));
      setScheduleMode(editingDevice.schedule_mode || "global");
      setScheduleDays(String(editingDevice.schedule_days || 1));
      setScheduleTime(editingDevice.schedule_time || "");
      setRetentionCount(String(editingDevice.retention_count ?? 30));
      setGdriveSyncEnabled(editingDevice.gdrive_sync_enabled !== false);
    } else {
      const def = VENDOR_PROFILES.mikrotik;
      setName("");
      setHost("");
      setPort(String(def.defaultPort));
      setVendor("mikrotik");
      setPlatform(def.platforms[0]?.label || "");
      setProtocol("ssh");
      setUsername("");
      setPassword("");
      setEnablePassword("");
      setSshPrivateKey("");
      setShowAdvancedAuth(false);
      setPreCommand("");
      setCustomCommand("");
      setPopSiteId("");
      setAutoBackupEnabled(true);
      setScheduleMode("global");
      setScheduleDays("1");
      setScheduleTime("");
      setRetentionCount("30");
      setGdriveSyncEnabled(true);
    }
  }, [isOpen, editingDevice]);

  if (!isOpen) return null;

  const activeProfile = VENDOR_PROFILES[vendor] || VENDOR_PROFILES.custom;

  const handleVendorChange = (nextVendor: NetworkVendor) => {
    setVendor(nextVendor);
    const prof = VENDOR_PROFILES[nextVendor];
    if (!isEditing) {
      setPort(String(prof.defaultPort));
      setPlatform(prof.platforms[0]?.label || "");
      setPreCommand("");
      setCustomCommand("");
    }
  };

  const handlePopSiteSelect = (siteId: string) => {
    setPopSiteId(siteId);
    const site = popSites.find((s) => s.id === siteId);
    if (site && !host.trim() && site.ip_public) {
      setHost(site.ip_public);
    }
    if (site && !name.trim()) {
      setName(`${site.site_id}${site.nama_perusahaan ? `-${site.nama_perusahaan.slice(0, 18)}` : ""}`);
    }
  };

  const handleTestSsh = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      let res: Response;
      if (isEditing && !password.trim() && !sshPrivateKey.trim()) {
        // Test saved credentials directly on server
        res = await fetch(`/api/backups/devices/${editingDevice.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test_ssh" }),
        });
      } else {
        res = await fetch("/api/backups/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_unsaved",
            name: name || host,
            host,
            port: parseInt(port, 10) || 22,
            vendor,
            platform,
            username,
            password,
            enable_password: enablePassword,
            ssh_private_key: sshPrivateKey,
            pre_command: preCommand,
            custom_command: customCommand,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Tes koneksi SSH gagal.");
      }
      setFeedback({
        type: "success",
        text: `${json.message}${json.data?.preview ? ` — ${json.data.preview}` : ""}`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Tes koneksi SSH gagal." });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const payload: Record<string, any> = {
        name,
        host,
        port: parseInt(port, 10) || 22,
        vendor,
        platform,
        protocol,
        username,
        pre_command: preCommand,
        custom_command: customCommand,
        pop_site_id: popSiteId || null,
        auto_backup_enabled: protocol === "ssh" ? autoBackupEnabled : false,
        schedule_mode: scheduleMode,
        schedule_days: scheduleMode === "custom_days" ? parseInt(scheduleDays, 10) || 1 : undefined,
        schedule_time: scheduleTime.trim() || null,
        retention_count: parseInt(retentionCount, 10) || 30,
        gdrive_sync_enabled: gdriveSyncEnabled,
      };

      if (password.trim()) payload.password = password;
      if (enablePassword.trim()) payload.enable_password = enablePassword;
      if (sshPrivateKey.trim()) payload.ssh_private_key = sshPrivateKey;

      const url = isEditing ? `/api/backups/devices/${editingDevice.id}` : "/api/backups/devices";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan perangkat.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Gagal menyimpan perangkat." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {isEditing ? `Edit Perangkat: ${editingDevice.name}` : "Tambah Perangkat Network Backup"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Juniper, Huawei, MikroTik, Cisco & vendor network lainnya (credential dienkripsi AES-256).
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-start space-x-2.5 ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <span className="break-words">{feedback.text}</span>
            </div>
          )}

          {/* Vendor Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Vendor / OS Perangkat
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(VENDOR_PROFILES) as NetworkVendor[]).map((key) => {
                const prof = VENDOR_PROFILES[key];
                const active = vendor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleVendorChange(key)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition text-center ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                    }`}
                  >
                    {prof.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Perangkat / Hostname *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Core-CCR2116-JKT"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                IP Management / Host *
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 103.155.196.10"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Port SSH
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Preset Platform / Format Backup
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {activeProfile.platforms.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tautkan ke POP Site / Enterprise (Opsional)
              </label>
              <select
                value={popSiteId}
                onChange={(e) => handlePopSiteSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Tidak Ditautkan / Standalone --</option>
                {popSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site_id} — {s.nama_perusahaan || s.nama_pic} {s.ip_public ? `(${s.ip_public})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Protocol & SSH Auth */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Metode Penarikan & Kredensial
                </span>
              </div>
              <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setProtocol("ssh")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    protocol === "ssh"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  SSH Otomatis (VPS)
                </button>
                <button
                  type="button"
                  onClick={() => setProtocol("manual")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    protocol === "manual"
                      ? "bg-amber-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Upload Manual Saja
                </button>
              </div>
            </div>

            {protocol === "ssh" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Username SSH *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. actis-backup"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Password SSH {isEditing && editingDevice?.has_password ? "(Tersimpan — isi untuk ganti)" : ""}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          isEditing && editingDevice?.has_password
                            ? "•••••••••••• (biarkan kosong jika tetap)"
                            : "Password login SSH"
                        }
                        className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      {showAdvancedAuth
                        ? "Sembunyikan Opsi Lanjutan (Enable / SSH Key / Custom Command)"
                        : "Opsi Lanjutan (Enable Password, SSH Private Key, Custom Command)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestSsh}
                    disabled={testing}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs disabled:opacity-60"
                  >
                    {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    <span>{testing ? "Menguji SSH..." : "Tes Koneksi SSH"}</span>
                  </button>
                </div>

                {showAdvancedAuth && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Enable Password (Opsional — Cisco / Huawei OLT)
                        </label>
                        <input
                          type="password"
                          value={enablePassword}
                          onChange={(e) => setEnablePassword(e.target.value)}
                          placeholder={
                            isEditing && editingDevice?.has_enable_password
                              ? "•••••••• (tersimpan)"
                              : "Kosongkan jika akun sudah privilege 15"
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Custom Command Backup (Opsional Override)
                        </label>
                        <input
                          type="text"
                          value={customCommand}
                          onChange={(e) => setCustomCommand(e.target.value)}
                          placeholder={`Default: ${activeProfile.defaultCommand}`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Pre-Command Pager Disable (Opsional Override, pisahkan newline)
                      </label>
                      <input
                        type="text"
                        value={preCommand}
                        onChange={(e) => setPreCommand(e.target.value)}
                        placeholder={`Default: ${activeProfile.defaultPreCommand || "(Tidak ada)"}`}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        SSH Private Key (PEM/OpenSSH, Opsional)
                      </label>
                      <textarea
                        rows={3}
                        value={sshPrivateKey}
                        onChange={(e) => setSshPrivateKey(e.target.value)}
                        placeholder={
                          isEditing && editingDevice?.has_ssh_private_key
                            ? "SSH Private Key sudah tersimpan terenkripsi. Tempel key baru jika ingin mengganti."
                            : "-----BEGIN OPENSSH PRIVATE KEY-----"
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                Mode <strong>Upload Manual</strong> cocok untuk perangkat di jaringan tertutup yang belum dapat diakses SSH langsung dari server VPS. Snapshot dapat diunggah lewat tombol <em>Upload Manual</em> dan tetap ikut tersinkron ke Google Drive.
              </p>
            )}
          </div>

          {/* Schedule & Retention Settings */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Jadwal Backup & Sinkronisasi Google Drive
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Interval Jadwal
                </label>
                <select
                  value={scheduleMode}
                  onChange={(e) => setScheduleMode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none"
                >
                  <option value="global">Ikut Jadwal Global</option>
                  <option value="1d">Setiap 1 Hari (Harian)</option>
                  <option value="3d">Setiap 3 Hari</option>
                  <option value="7d">Setiap 1 Minggu (7 Hari)</option>
                  <option value="30d">Setiap 1 Bulan (30 Hari)</option>
                  <option value="custom_days">Custom Jumlah Hari</option>
                </select>
              </div>

              {scheduleMode === "custom_days" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Setiap Berapa Hari?
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={scheduleDays}
                    onChange={(e) => setScheduleDays(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Jam Khusus WIB (Opsional)
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Retensi di DB VPS (Snapshot)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              {protocol === "ssh" && (
                <label className="inline-flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupEnabled}
                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Aktifkan Auto Backup Terjadwal
                  </span>
                </label>
              )}

              <label className="inline-flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gdriveSyncEnabled}
                  onChange={(e) => setGdriveSyncEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="inline-flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Otomatis Sinkron ke Google Drive</span>
                </span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-60"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              <span>{saving ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Perangkat"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

