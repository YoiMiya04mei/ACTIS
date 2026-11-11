"use client";

import React, { useState, useEffect } from "react";
import { X, UploadCloud, RefreshCw, AlertTriangle, FileText } from "lucide-react";

interface ManualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
  devices: any[];
  defaultDeviceId?: string;
}

export function ManualUploadModal({
  isOpen,
  onClose,
  onUploaded,
  devices,
  defaultDeviceId,
}: ManualUploadModalProps) {
  const [deviceId, setDeviceId] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("Manual Upload Snapshot");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setContent("");
    setNote("Manual Upload Snapshot");
    if (defaultDeviceId && defaultDeviceId !== "ALL") {
      setDeviceId(defaultDeviceId);
    } else if (devices.length > 0) {
      setDeviceId(devices[0].id);
    }
  }, [isOpen, defaultDeviceId, devices]);

  if (!isOpen) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setNote(`Manual File: ${file.name}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId) {
      setError("Pilih perangkat tujuan terlebih dahulu.");
      return;
    }
    if (!content.trim()) {
      setError("Isi konfigurasi atau file backup tidak boleh kosong.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backups/devices/${deviceId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          content,
          command_used: note,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengunggah snapshot konfigurasi.");
      }
      onUploaded();
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengunggah snapshot.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Upload Snapshot Config Manual
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadangan untuk perangkat tanpa akses SSH langsung dari VPS; otomatis masuk DB & Google Drive.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Perangkat Tujuan *
            </label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
            >
              {devices.length === 0 && <option value="">Belum ada perangkat terdaftar</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.vendor.toUpperCase()} — {d.host})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Pilih File Config (.rsc / .cfg / .conf / .txt)
              </label>
              <input
                type="file"
                accept=".rsc,.cfg,.conf,.txt,.log,.bak"
                onChange={handleFilePick}
                className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan / Sumber Backup
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Isi Konfigurasi (Paste / Edit) *
            </label>
            <textarea
              rows={11}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Paste hasil /export, show running-config, show configuration, atau display current-configuration di sini..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 text-emerald-300 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={uploading || devices.length === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{uploading ? "Menyimpan..." : "Simpan Snapshot & Sync GDrive"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

