"use client";

import React, { useEffect, useState } from "react";
import { X, UserCheck, Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";

interface TacacsGroupOption {
  id: string;
  name: string;
  privilege_level: number;
}

interface TacacsUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingUser?: any | null;
  groups: TacacsGroupOption[];
}

export function TacacsUserModal({
  isOpen,
  onClose,
  onSaved,
  editingUser,
  groups,
}: TacacsUserModalProps) {
  const isEditing = Boolean(editingUser?.id);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState("");
  const [clearEnablePassword, setClearEnablePassword] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [privilegeLevel, setPrivilegeLevel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowPassword(false);
    setClearEnablePassword(false);

    if (editingUser) {
      setUsername(editingUser.username || "");
      setFullName(editingUser.full_name || "");
      setPassword("");
      setEnablePassword("");
      setGroupId(editingUser.group_id || "");
      setPrivilegeLevel(
        editingUser.privilege_level !== null && editingUser.privilege_level !== undefined
          ? String(editingUser.privilege_level)
          : ""
      );
      setExpiresAt(
        editingUser.expires_at ? new Date(editingUser.expires_at).toISOString().slice(0, 16) : ""
      );
      setIsActive(editingUser.is_active !== false);
      setNotes(editingUser.notes || "");
    } else {
      setUsername("");
      setFullName("");
      setPassword("");
      setEnablePassword("");
      setGroupId(groups[0]?.id || "");
      setPrivilegeLevel("");
      setExpiresAt("");
      setIsActive(true);
      setNotes("");
    }
  }, [isOpen, editingUser, groups]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: any = {
        username: username.trim(),
        full_name: fullName.trim() || null,
        group_id: groupId || null,
        privilege_level: privilegeLevel === "" ? null : Number(privilegeLevel),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: isActive,
        notes: notes.trim() || null,
      };

      if (password.length > 0) {
        payload.password = password;
      }
      if (clearEnablePassword) {
        payload.clear_enable_password = true;
      } else if (enablePassword.length > 0) {
        payload.enable_password = enablePassword;
      }

      const url = isEditing ? `/api/tacacs/users/${editingUser.id}` : "/api/tacacs/users";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan user TACACS+.");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat menyimpan user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? `Edit User TACACS+: ${editingUser.username}` : "Tambah User TACACS+"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kredensial login router/switch via protokol RFC 8907
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
                Username CLI <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="noc_budi"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap / PIC
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Budi Santoso (NOC)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password {isEditing ? "(Kosongkan jika tidak diubah)" : <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!isEditing}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditing ? "••••••••" : "Minimal 4 karakter"}
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enable Secret (Opsional - Cisco)
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={enablePassword}
                onChange={(e) => {
                  setEnablePassword(e.target.value);
                  if (e.target.value) setClearEnablePassword(false);
                }}
                placeholder={editingUser?.has_enable_password ? "Tersimpan (isi untuk ganti)" : "Opsional"}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {editingUser?.has_enable_password && (
                <label className="mt-1 inline-flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={clearEnablePassword}
                    onChange={(e) => setClearEnablePassword(e.target.checked)}
                    className="rounded"
                  />
                  <span>Hapus enable secret khusus user</span>
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grup Privilege & Command Policy
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Tanpa Grup (Default Priv 1) --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (Priv {g.privilege_level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Override Priv (0-15)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={privilegeLevel}
                onChange={(e) => setPrivilegeLevel(e.target.value)}
                placeholder="Ikut Grup"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Masa Berlaku Akun (Opsional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="pt-4">
              <label className="inline-flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Akun Aktif (Diizinkan Login)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Akses sementara untuk maintenance core router"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
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
              <span>{isEditing ? "Simpan Perubahan" : "Buat User"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

