"use client";

import React, { useEffect, useState } from "react";
import { X, Server, KeyRound, Eye, EyeOff, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { TACACS_VENDORS } from "@/lib/tacacs/policy";

interface TacacsClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingClient?: any | null;
}

export function TacacsClientModal({
  isOpen,
  onClose,
  onSaved,
  editingClient,
}: TacacsClientModalProps) {
  const isEditing = Boolean(editingClient?.id);

  const [name, setName] = useState("");
  const [ipOrCidr, setIpOrCidr] = useState("");
  const [vendor, setVendor] = useState("cisco");
  const [sharedSecret, setSharedSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowSecret(false);

    if (editingClient) {
      setName(editingClient.name || "");
      setIpOrCidr(editingClient.ip_or_cidr || "");
      setVendor(editingClient.vendor || "cisco");
      setSharedSecret("");
      setIsActive(editingClient.is_active !== false);
      setDescription(editingClient.description || "");
    } else {
      setName("");
      setIpOrCidr("");
      setVendor("cisco");
      setSharedSecret("");
      setIsActive(true);
      setDescription("");
    }
  }, [isOpen, editingClient]);

  if (!isOpen) return null;

  const generateSecret = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let out = "TACACS-";
    for (let i = 0; i < 16; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    setSharedSecret(out);
    setShowSecret(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: any = {
        name: name.trim(),
        ip_or_cidr: ipOrCidr.trim(),
        vendor,
        is_active: isActive,
        description: description.trim() || null,
      };
      if (sharedSecret.trim().length > 0) {
        payload.shared_secret = sharedSecret.trim();
      }

      const url = isEditing ? `/api/tacacs/clients/${editingClient.id}` : "/api/tacacs/clients";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan NAS Client.");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat menyimpan NAS Client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? `Edit NAS Client: ${editingClient.name}` : "Tambah NAS / Network Client"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Router, switch, OLT, atau subnet jaringan yang diizinkan mengirim paket TACACS+
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Perangkat / Subnet <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CORE-JKT-01 atau Subnet Management NOC"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                IP Address / CIDR <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ipOrCidr}
                onChange={(e) => setIpOrCidr(e.target.value)}
                placeholder="10.10.1.1 atau 10.10.0.0/24"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vendor Perangkat
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {TACACS_VENDORS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  Shared Secret Key{" "}
                  {isEditing ? "(Kosongkan jika tidak diubah)" : <span className="text-rose-500">*</span>}
                </span>
              </label>
              <button
                type="button"
                onClick={generateSecret}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate Key</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                required={!isEditing}
                value={sharedSecret}
                onChange={(e) => setSharedSecret(e.target.value)}
                placeholder={isEditing ? "••••••••••••" : "Minimal 4 karakter (harus sama dengan di router)"}
                className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi / Lokasi POP
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Core Router Jakarta Cyber 1"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <label className="inline-flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Client Aktif (Terima permintaan AAA dari IP/CIDR ini)
            </span>
          </label>

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
              <span>{isEditing ? "Simpan Client" : "Tambah Client"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

