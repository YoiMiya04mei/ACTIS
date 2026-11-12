"use client";

import React, { useEffect, useState } from "react";
import { X, Settings, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";

interface TacacsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  settings: any;
}

export function TacacsSettingsModal({
  isOpen,
  onClose,
  onSaved,
  settings,
}: TacacsSettingsModalProps) {
  const [enabled, setEnabled] = useState(true);
  const [bindHost, setBindHost] = useState("0.0.0.0");
  const [port, setPort] = useState("49");
  const [requireRegisteredClient, setRequireRegisteredClient] = useState(true);
  const [defaultSecret, setDefaultSecret] = useState("");
  const [defaultEnablePassword, setDefaultEnablePassword] = useState("");
  const [allowActisUsersFallback, setAllowActisUsersFallback] = useState(false);
  const [allowUnencrypted, setAllowUnencrypted] = useState(false);
  const [logRetentionDays, setLogRetentionDays] = useState("90");
  const [socketTimeoutMs, setSocketTimeoutMs] = useState("15000");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !settings) return;
    setError(null);
    setEnabled(settings.enabled !== false);
    setBindHost(settings.bind_host || "0.0.0.0");
    setPort(String(settings.port || 49));
    setRequireRegisteredClient(settings.require_registered_client !== false);
    setDefaultSecret("");
    setDefaultEnablePassword("");
    setAllowActisUsersFallback(Boolean(settings.allow_actis_users_fallback));
    setAllowUnencrypted(Boolean(settings.allow_unencrypted));
    setLogRetentionDays(String(settings.log_retention_days || 90));
    setSocketTimeoutMs(String(settings.socket_timeout_ms || 15000));
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: any = {
        enabled,
        bind_host: bindHost.trim() || "0.0.0.0",
        port: Number(port),
        require_registered_client: requireRegisteredClient,
        allow_actis_users_fallback: allowActisUsersFallback,
        allow_unencrypted: allowUnencrypted,
        log_retention_days: Number(logRetentionDays) || 90,
        socket_timeout_ms: Number(socketTimeoutMs) || 15000,
      };
      if (defaultSecret.trim().length > 0) {
        payload.default_secret = defaultSecret.trim();
      }
      if (defaultEnablePassword.trim().length > 0) {
        payload.default_enable_password = defaultEnablePassword.trim();
      }

      const res = await fetch("/api/tacacs/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan pengaturan server.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan pengaturan server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Pengaturan Listener TACACS+ Server
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Konfigurasi TCP port, kebijakan NAS client, dan keamanan protokol
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bind IP Address
              </label>
              <input
                type="text"
                value={bindHost}
                onChange={(e) => setBindHost(e.target.value)}
                placeholder="0.0.0.0"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                TCP Port (Standar RFC: 49)
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Retensi Audit Log (Hari)
              </label>
              <input
                type="number"
                min={1}
                max={3650}
                value={logRetentionDays}
                onChange={(e) => setLogRetentionDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Socket Timeout (ms)
              </label>
              <input
                type="number"
                min={3000}
                max={120000}
                value={socketTimeoutMs}
                onChange={(e) => setSocketTimeoutMs(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fallback Shared Secret (Opsional)
              </label>
              <input
                type="password"
                value={defaultSecret}
                onChange={(e) => setDefaultSecret(e.target.value)}
                placeholder={
                  settings?.has_default_secret
                    ? "Tersimpan (isi untuk ganti)"
                    : "Jika client tidak wajib terdaftar"
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Global Enable Password (Opsional)
              </label>
              <input
                type="password"
                value={defaultEnablePassword}
                onChange={(e) => setDefaultEnablePassword(e.target.value)}
                placeholder={
                  settings?.has_default_enable_password
                    ? "Tersimpan (isi untuk ganti)"
                    : "Untuk Cisco enable secret"
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600"
              />
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Aktifkan Server TACACS+ Otomatis Saat Aplikasi Berjalan
                </span>
                <span className="text-[11px] text-slate-500">
                  Menjalankan TCP listener RFC 8907 di background Node.js server.
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requireRegisteredClient}
                onChange={(e) => setRequireRegisteredClient(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600"
              />
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Strict NAS Client Whitelist (Direkomendasikan)
                </span>
                <span className="text-[11px] text-slate-500">
                  Tolak koneksi dari IP router yang belum didaftarkan di tab NAS Clients.
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowActisUsersFallback}
                onChange={(e) => setAllowActisUsersFallback(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600"
              />
              <div>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Izinkan Fallback Login Menggunakan Akun Web ACTIS (Admin / NOC)
                </span>
                <span className="text-[11px] text-slate-500">
                  Jika username tidak ada di TACACS Users, izinkan login dengan email/nama akun ACTIS.
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowUnencrypted}
                onChange={(e) => setAllowUnencrypted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-amber-600"
              />
              <div>
                <span className="flex items-center space-x-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Izinkan Paket Unencrypted (Khusus Lab / Debug Wireshark)</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Jangan aktifkan di jaringan produksi.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 inline-flex items-center space-x-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Simpan & Terapkan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

