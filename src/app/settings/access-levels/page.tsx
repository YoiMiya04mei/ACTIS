"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Check,
  X,
  HelpCircle,
  BarChart3,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  ACTIS_ACCESS_CATEGORIES,
  ALL_ACTIS_MENU_ITEMS,
  DEFAULT_ACTIS_ROLE_LEVELS,
  DEFAULT_ROLE_MENU_PERMISSIONS,
  isDefaultRoleKey,
  isMenuLockedForRole,
  normalizeAllRolesPermissions,
  normalizeRoleMenuPermissions,
  resolveDefaultLandingHref,
  type ActisRoleDefinition,
  type ActisRoleKey,
  type MenuAccessKey,
} from "@/lib/accessLevels";

type RolesMap = Record<string, MenuAccessKey[]>;

export default function AccessLevelsPage() {
  const { currentUser, users, allowedMenus, refreshAccessLevels } = useCurrentUser();
  const { confirm: confirmDialog } = useDialog();

  const isAdmin = currentUser?.role === "admin";

  const [rolesList, setRolesList] = useState<ActisRoleDefinition[]>([
    ...DEFAULT_ACTIS_ROLE_LEVELS,
  ]);
  const [selectedRole, setSelectedRole] = useState<ActisRoleKey>("noc_engineer");
  const [savedRoles, setSavedRoles] = useState<RolesMap>(() =>
    normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS, [])
  );
  const [draftRoles, setDraftRoles] = useState<RolesMap>(() =>
    normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS, [])
  );

  // Create custom role form state
  const [newLevelName, setNewLevelName] = useState("");
  const [copyFromRole, setCopyFromRole] = useState<string>("empty");
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showLevelTooltip, setShowLevelTooltip] = useState(false);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const applyServerPayload = useCallback(
    (json: any, preserveDraft = false) => {
      const nextList: ActisRoleDefinition[] = Array.isArray(json?.rolesList)
        ? json.rolesList
        : [...DEFAULT_ACTIS_ROLE_LEVELS];
      const customOnly = nextList.filter((r) => !r.isDefault);
      const normalized = normalizeAllRolesPermissions(
        json?.permissionsByRole,
        customOnly
      );

      setRolesList(nextList);
      setSavedRoles(normalized);
      if (!preserveDraft) {
        setDraftRoles(normalized);
      } else {
        setDraftRoles((prev) => {
          const merged: RolesMap = { ...normalized };
          for (const r of nextList) {
            if (prev[r.key]) {
              merged[r.key] = normalizeRoleMenuPermissions(r.key, prev[r.key]);
            }
          }
          return merged;
        });
      }
      setUpdatedBy(json?.updatedBy || null);
      setUpdatedAt(json?.updatedAt || null);
    },
    []
  );

  const loadAccessLevels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/access-levels", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.success && json.permissionsByRole) {
        applyServerPayload(json);
      }
    } catch {
      setNotice({
        type: "error",
        message: "Gagal memuat data Level Akses dari server.",
      });
    } finally {
      setLoading(false);
    }
  }, [applyServerPayload]);

  useEffect(() => {
    if (isAdmin) {
      loadAccessLevels();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAccessLevels]);

  const totalMenus = ALL_ACTIS_MENU_ITEMS.length;
  const currentMenuList = draftRoles[selectedRole] || ["dashboard"];
  const activeMenuSet = useMemo(
    () => new Set<MenuAccessKey>(currentMenuList),
    [currentMenuList]
  );

  const activeCount = currentMenuList.length;
  const activePercent =
    totalMenus > 0 ? Math.round((activeCount / totalMenus) * 100) : 0;

  const isDirty = useMemo(() => {
    return JSON.stringify(draftRoles) !== JSON.stringify(savedRoles);
  }, [draftRoles, savedRoles]);

  const userCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rolesList) counts[r.key] = 0;
    for (const u of users || []) {
      if (u?.role) {
        counts[u.role] = (counts[u.role] || 0) + 1;
      }
    }
    return counts;
  }, [users, rolesList]);

  const selectedRoleMeta =
    rolesList.find((r) => r.key === selectedRole) || rolesList[0];
  const selectedIsDefault = isDefaultRoleKey(selectedRoleMeta?.key || "");
  const selectedUserCount = userCountByRole[selectedRole] ?? 0;

  const handleToggleMenu = (menuKey: MenuAccessKey) => {
    if (isMenuLockedForRole(selectedRole, menuKey)) return;

    setDraftRoles((prev) => {
      const existing = new Set<MenuAccessKey>(prev[selectedRole] || []);
      if (existing.has(menuKey)) {
        existing.delete(menuKey);
      } else {
        existing.add(menuKey);
      }
      return {
        ...prev,
        [selectedRole]: normalizeRoleMenuPermissions(
          selectedRole,
          Array.from(existing)
        ),
      };
    });
    setNotice(null);
  };

  const handleToggleCategory = (categoryKeys: MenuAccessKey[]) => {
    setDraftRoles((prev) => {
      const existing = new Set<MenuAccessKey>(prev[selectedRole] || []);
      const unlockedKeys = categoryKeys.filter(
        (k) => !isMenuLockedForRole(selectedRole, k)
      );
      if (unlockedKeys.length === 0) return prev;

      const allUnlockedChecked = unlockedKeys.every((k) => existing.has(k));
      if (allUnlockedChecked) {
        for (const k of unlockedKeys) existing.delete(k);
      } else {
        for (const k of unlockedKeys) existing.add(k);
      }
      return {
        ...prev,
        [selectedRole]: normalizeRoleMenuPermissions(
          selectedRole,
          Array.from(existing)
        ),
      };
    });
    setNotice(null);
  };

  const handleCheckAll = () => {
    setDraftRoles((prev) => ({
      ...prev,
      [selectedRole]: normalizeRoleMenuPermissions(
        selectedRole,
        ALL_ACTIS_MENU_ITEMS.map((m) => m.key)
      ),
    }));
    setNotice(null);
  };

  const handleClearAll = () => {
    setDraftRoles((prev) => ({
      ...prev,
      [selectedRole]: normalizeRoleMenuPermissions(selectedRole, []),
    }));
    setNotice(null);
  };

  const handleSave = async () => {
    if (!isAdmin || saving) return;
    setSaving(true);
    setNotice(null);

    try {
      const res = await fetch("/api/access-levels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ roles: draftRoles }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal menyimpan Level Akses.");
      }

      applyServerPayload(json);
      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "success",
        message: `Hak akses untuk "${selectedRoleMeta.label}" berhasil disimpan dan langsung aktif di sidebar & halaman.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSelectedRole = async () => {
    if (!isAdmin || resetting) return;
    const confirmed = await confirmDialog(
      selectedIsDefault
        ? `Kembalikan daftar menu aktif untuk level user "${selectedRoleMeta.label}" ke pengaturan bawaan standar ACTIS?`
        : `Kosongkan semua centang menu pada level kustom "${selectedRoleMeta.label}"?`
    );
    if (!confirmed) return;

    setResetting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/access-levels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "reset", role: selectedRole }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal mereset Level Akses.");
      }

      applyServerPayload(json);
      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "info",
        message: `Level Akses "${selectedRoleMeta.label}" telah dikembalikan ke pengaturan bawaan.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal mereset konfigurasi.",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || creatingRole) return;

    const cleanName = newLevelName.trim();
    if (cleanName.length < 2) {
      setNotice({
        type: "error",
        message: "Nama level baru minimal 2 karakter.",
      });
      return;
    }

    setCreatingRole(true);
    setNotice(null);
    try {
      const res = await fetch("/api/access-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "create_role",
          name: cleanName,
          copyFromRole,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal menambahkan level user baru.");
      }

      applyServerPayload(json, isDirty);
      if (json.createdRole?.key) {
        setSelectedRole(json.createdRole.key);
      }
      setNewLevelName("");
      setCopyFromRole("empty");
      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "success",
        message: `Level user "${json.createdRole?.label || cleanName}" berhasil dibuat dan otomatis tersedia di dropdown Pengaturan User Akses.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal membuat level user baru.",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteCustomRole = async () => {
    if (!isAdmin || deletingRole || selectedIsDefault || selectedUserCount > 0) {
      return;
    }

    const confirmed = await confirmDialog(
      `Hapus level user buatan sendiri "${selectedRoleMeta.label}" secara permanen?`
    );
    if (!confirmed) return;

    setDeletingRole(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/access-levels?role=${encodeURIComponent(selectedRole)}`,
        {
          method: "DELETE",
          cache: "no-store",
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Gagal menghapus level user.");
      }

      applyServerPayload(json);
      setSelectedRole("noc_engineer");
      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "info",
        message: `Level user "${selectedRoleMeta.label}" telah dihapus.`,
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Gagal menghapus level user.",
      });
    } finally {
      setDeletingRole(false);
    }
  };

  const fallbackHref = resolveDefaultLandingHref(allowedMenus);

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
          Halaman konfigurasi <strong>Level Akses</strong> hanya dapat dikelola oleh Administrator.
        </p>
        {fallbackHref && (
          <div className="pt-2">
            <Link
              href={fallbackHref}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              {fallbackHref === "/dashboard" ? "Kembali ke Dashboard" : "Buka Menu Tersedia"}
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-7 rounded-full bg-blue-600" />
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Level Akses
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atur menu ACTIS untuk level default maupun level user kustom tambahan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Lihat Ringkasan</span>
          </button>

          <button
            type="button"
            onClick={handleResetSelectedRole}
            disabled={resetting || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembalikan ke bawaan</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !isDirty}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              isDirty
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/25"
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Menyimpan..." : "Simpan hak akses"}</span>
          </button>
        </div>
      </div>

      {/* Alert / Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            notice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : notice.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main White Panel Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-5">
        {/* Control Row: Level User + Quick Buttons + Menu Aktif Progress Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            {/* Level user dropdown */}
            <div className="min-w-[240px] relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  htmlFor="access-level-role-select"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Level user
                </label>
                <button
                  type="button"
                  onClick={() => setShowLevelTooltip((v) => !v)}
                  className="text-blue-500 hover:text-blue-600 cursor-pointer"
                  title="Penjelasan Level User"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              {showLevelTooltip && (
                <div className="absolute left-0 top-6 z-20 w-72 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-lg leading-relaxed">
                  Pilih role bawaan atau level kustom yang ingin diatur. Perubahan berlaku langsung untuk semua user pada role tersebut setelah menekan <strong>Simpan hak akses</strong>.
                </div>
              )}
              <select
                id="access-level-role-select"
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setNotice(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {rolesList.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} ({userCountByRole[r.key] ?? 0} akun)
                    {!r.isDefault ? " • Kustom" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Centang semua & Kosongkan buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckAll}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>Centang semua</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>Kosongkan</span>
              </button>
            </div>
          </div>

          {/* Menu aktif progress bar */}
          <div className="flex-1 lg:max-w-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Menu aktif
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedRoleMeta.badgeClass}`}
                >
                  {selectedRoleMeta.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {selectedIsDefault ? "Level Default (Dilindungi)" : "Level Buatan Sendiri"}
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Belum Disimpan
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium tabular-nums shrink-0">
                <strong className="font-extrabold text-slate-900 dark:text-white">
                  {activeCount}
                </strong>{" "}
                dari {totalMenus}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${activePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Role description & metadata strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{selectedRoleMeta.description}</span>
          {updatedAt && (
            <span>
              Terakhir diperbarui oleh{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {updatedBy || "Administrator"}
              </strong>{" "}
              pada {new Date(updatedAt).toLocaleString("id-ID")}
            </span>
          )}
        </div>

        {/* Category Cards Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Memuat matriks hak akses menu...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {ACTIS_ACCESS_CATEGORIES.map((category) => {
              const catKeys = category.items.map((i) => i.key);
              const catCheckedCount = catKeys.filter((k) =>
                activeMenuSet.has(k)
              ).length;
              const catTotal = category.items.length;
              const allCatChecked = catCheckedCount === catTotal;

              return (
                <div
                  key={category.key}
                  className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/60 overflow-hidden flex flex-col shadow-2xs"
                >
                  {/* Card Header */}
                  <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {category.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(catKeys)}
                      title="Klik untuk centang / kosongkan seluruh menu di kategori ini"
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition cursor-pointer ${
                        allCatChecked
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {catCheckedCount}/{catTotal}
                    </button>
                  </div>

                  {/* Menu Rows */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1">
                    {category.items.map((item) => {
                      const locked = isMenuLockedForRole(selectedRole, item.key);
                      const checked = activeMenuSet.has(item.key) || locked;

                      return (
                        <label
                          key={item.key}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs transition select-none ${
                            locked
                              ? "cursor-default bg-slate-50/40 dark:bg-slate-900/30"
                              : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() => handleToggleMenu(item.key)}
                              className={`w-4 h-4 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 shrink-0 ${
                                locked
                                  ? "text-blue-400 opacity-75 cursor-not-allowed"
                                  : "text-blue-600 cursor-pointer"
                              }`}
                            />
                            <span
                              className={`truncate ${
                                checked
                                  ? "font-semibold text-slate-800 dark:text-slate-100"
                                  : "font-medium text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          {locked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                              <Lock className="w-3 h-3" />
                              <span>Selalu aktif</span>
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Management Cards: Buat level baru & Hapus level */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Card Kiri: Buat level baru */}
        <form
          onSubmit={handleCreateCustomRole}
          className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Buat level baru</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label
                htmlFor="new-custom-role-name"
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <span>Nama level</span>
                <span className="text-rose-500">*</span>
                <span title="Masukkan nama role baru, misalnya: Kasir, Supervisor NOC, atau Teknisi Magang.">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                </span>
              </label>
              <input
                id="new-custom-role-name"
                type="text"
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
                placeholder="Contoh: Supervisor NOC, Admin Keuangan"
                maxLength={50}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="sm:col-span-5">
              <label
                htmlFor="copy-role-template-select"
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <span>Salin hak akses dari (opsional)</span>
                <span title="Mulai dengan daftar menu kosong atau duplikasi dari level yang sudah ada.">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                </span>
              </label>
              <select
                id="copy-role-template-select"
                value={copyFromRole}
                onChange={(e) => setCopyFromRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="empty">Kosong (tanpa menu aktif)</option>
                {rolesList.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} ({(draftRoles[r.key] || []).length} menu)
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creatingRole || !newLevelName.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingRole ? "..." : "Buat"}</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Level baru langsung muncul di pilihan Level saat menambah atau mengubah user di{" "}
            <Link href="/settings/users" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
              Pengaturan User Akses
            </Link>
            . Atur centang menu di atas setelah level dibuat.
          </p>
        </form>

        {/* Card Kanan: Hapus level */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Hapus level</span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-200">
              Level terpilih:{" "}
              <strong className="font-bold text-slate-900 dark:text-white">
                {selectedRoleMeta.label}
              </strong>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                (
                {selectedUserCount === 0
                  ? "belum dipakai user"
                  : `dipakai ${selectedUserCount} akun`}
                )
              </span>
            </div>

            <div>
              <button
                type="button"
                onClick={handleDeleteCustomRole}
                disabled={deletingRole || selectedIsDefault || selectedUserCount > 0}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                  selectedIsDefault || selectedUserCount > 0
                    ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : "border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 cursor-pointer"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingRole ? "Menghapus..." : "Hapus level ini"}</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {selectedIsDefault
              ? "Hanya level buatan sendiri yang bisa dihapus. Level default (Administrator, NOC Engineer, Field Engineer, Sales Corporate, Admin Gudang) dilindungi."
              : selectedUserCount > 0
                ? `Masih digunakan oleh ${selectedUserCount} akun. Pindahkan role akun tersebut di Pengaturan User Akses sebelum menghapus.`
                : "Level buatan sendiri ini belum dipakai oleh akun mana pun dan dapat dihapus."}
          </p>
        </div>
      </div>

      {/* Ringkasan Modal (Lihat Ringkasan) */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Ringkasan Hak Akses Menu Semua Level User</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbandingan matriks menu aktif antar role ACTIS (default &amp; kustom). Klik nama role pada header untuk mengedit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Summary Cards Row */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 bg-slate-50/70 dark:bg-slate-950/40 max-h-44 overflow-y-auto">
              {rolesList.map((r) => {
                const count = (draftRoles[r.key] || []).length;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setSelectedRole(r.key);
                      setShowSummaryModal(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      selectedRole === r.key
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {r.label}
                      </div>
                      {!r.isDefault && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 shrink-0">
                          Kustom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px]">
                      <span className="text-slate-500 inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {userCountByRole[r.key] ?? 0} akun
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {count}/{totalMenus}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 rounded-tl-lg">Kategori / Menu ACTIS</th>
                    {rolesList.map((r) => (
                      <th key={r.key} className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole(r.key);
                            setShowSummaryModal(false);
                          }}
                          className="hover:text-blue-600 underline-offset-2 hover:underline cursor-pointer"
                        >
                          {r.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ACTIS_ACCESS_CATEGORIES.map((cat) => (
                    <React.Fragment key={cat.key}>
                      <tr className="bg-slate-50/90 dark:bg-slate-900/80">
                        <td
                          colSpan={rolesList.length + 1}
                          className="py-2 px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                        >
                          {cat.label}
                        </td>
                      </tr>
                      {cat.items.map((item) => (
                        <tr
                          key={item.key}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                            {item.label}
                          </td>
                          {rolesList.map((r) => {
                            const allowed = (draftRoles[r.key] || []).includes(item.key);
                            const locked = isMenuLockedForRole(r.key, item.key);
                            return (
                              <td key={r.key} className="py-2 px-3 text-center">
                                {allowed ? (
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                      locked
                                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    }`}
                                    title={locked ? "Selalu aktif" : "Diizinkan"}
                                  >
                                    {locked ? (
                                      <Lock className="w-3 h-3" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold cursor-pointer transition"
              >
                Tutup Ringkasan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
