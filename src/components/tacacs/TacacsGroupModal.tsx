"use client";

import React, { useEffect, useState } from "react";
import { X, Shield, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import type { TacacsCommandRule, TacacsServiceAttr } from "@/lib/tacacs/policy";

interface TacacsGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingGroup?: any | null;
}

export function TacacsGroupModal({
  isOpen,
  onClose,
  onSaved,
  editingGroup,
}: TacacsGroupModalProps) {
  const isEditing = Boolean(editingGroup?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privilegeLevel, setPrivilegeLevel] = useState("15");
  const [defaultPolicy, setDefaultPolicy] = useState<"permit" | "deny">("deny");
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<TacacsCommandRule[]>([]);
  const [attrs, setAttrs] = useState<TacacsServiceAttr[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (editingGroup) {
      setName(editingGroup.name || "");
      setDescription(editingGroup.description || "");
      setPrivilegeLevel(String(editingGroup.privilege_level ?? 15));
      setDefaultPolicy(editingGroup.default_policy === "permit" ? "permit" : "deny");
      setIsActive(editingGroup.is_active !== false);
      setRules(
        Array.isArray(editingGroup.command_rules) ? editingGroup.command_rules : []
      );
      setAttrs(
        Array.isArray(editingGroup.service_attrs) ? editingGroup.service_attrs : []
      );
    } else {
      setName("");
      setDescription("");
      setPrivilegeLevel("7");
      setDefaultPolicy("deny");
      setIsActive(true);
      setRules([
        {
          id: `r-${Date.now()}`,
          action: "permit",
          pattern: "^(show|display|ping|traceroute)",
          description: "Izinkan perintah monitoring dasar",
        },
      ]);
      setAttrs([]);
    }
  }, [isOpen, editingGroup]);

  if (!isOpen) return null;

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: `r-${Date.now()}-${prev.length}`, action: "permit", pattern: "", description: "" },
    ]);
  };

  const updateRule = (idx: number, patch: Partial<TacacsCommandRule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const addAttr = () => {
    setAttrs((prev) => [...prev, { key: "", value: "" }]);
  };

  const updateAttr = (idx: number, patch: Partial<TacacsServiceAttr>) => {
    setAttrs((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const removeAttr = (idx: number) => {
    setAttrs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const cleanRules = rules.filter((r) => r.pattern.trim().length > 0);
      const cleanAttrs = attrs.filter((a) => a.key.trim().length > 0);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        privilege_level: Number(privilegeLevel),
        default_policy: defaultPolicy,
        is_active: isActive,
        command_rules: cleanRules,
        service_attrs: cleanAttrs,
      };

      const url = isEditing ? `/api/tacacs/groups/${editingGroup.id}` : "/api/tacacs/groups";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan grup TACACS+.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat menyimpan grup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? `Edit Grup: ${editingGroup.name}` : "Buat Grup Privilege & Command Policy"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atur level privilege (0-15), aturan permit/deny per perintah CLI, dan atribut vendor
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

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Grup <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="noc-operator"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Privilege Level (0-15)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                required
                value={privilegeLevel}
                onChange={(e) => setPrivilegeLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Command Policy
              </label>
              <select
                value={defaultPolicy}
                onChange={(e) => setDefaultPolicy(e.target.value === "permit" ? "permit" : "deny")}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="deny">Deny (Whitelist / Ketat)</option>
                <option value="permit">Permit (Blacklist / Fleksibel)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Hak akses tim NOC untuk monitoring & troubleshooting"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="pt-4">
              <label className="inline-flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Grup Aktif
                </span>
              </label>
            </div>
          </div>

          {/* Command Authorization Rules */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Command Authorization Rules (Dievaluasi Berurutan)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mendukung Regex (contoh: <code className="text-indigo-600 dark:text-indigo-400">^(show|ping|traceroute)</code> atau <code className="text-rose-600 dark:text-rose-400">^reload</code>).
                </p>
              </div>
              <button
                type="button"
                onClick={addRule}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 inline-flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rule</span>
              </button>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Belum ada rule spesifik. Semua perintah mengikuti Default Policy ({defaultPolicy}).
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <select
                        value={rule.action}
                        onChange={(e) =>
                          updateRule(idx, {
                            action: e.target.value === "deny" ? "deny" : "permit",
                          })
                        }
                        className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border outline-none ${
                          rule.action === "permit"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        <option value="permit">PERMIT</option>
                        <option value="deny">DENY</option>
                      </select>
                    </div>
                    <div className="col-span-8 sm:col-span-5">
                      <input
                        type="text"
                        value={rule.pattern}
                        onChange={(e) => updateRule(idx, { pattern: e.target.value })}
                        placeholder="^show running-config"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none"
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-4">
                      <input
                        type="text"
                        value={rule.description || ""}
                        onChange={(e) => updateRule(idx, { description: e.target.value })}
                        placeholder="Keterangan (opsional)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 outline-none"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRule(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendor Service Attributes */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Vendor AV-Pairs (Opsional)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Contoh: <code className="text-indigo-600 dark:text-indigo-400">Mikrotik-Group = full</code> atau <code className="text-indigo-600 dark:text-indigo-400">Juniper-Local-User-Name = super-user</code>
                </p>
              </div>
              <button
                type="button"
                onClick={addAttr}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 inline-flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Atribut</span>
              </button>
            </div>

            {attrs.length > 0 && (
              <div className="space-y-2">
                {attrs.map((attr, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => updateAttr(idx, { key: e.target.value })}
                        placeholder="Mikrotik-Group"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => updateAttr(idx, { value: e.target.value })}
                        placeholder="full"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeAttr(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <span>{isEditing ? "Simpan Grup" : "Buat Grup"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

