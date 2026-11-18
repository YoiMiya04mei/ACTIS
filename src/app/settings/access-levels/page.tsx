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
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  ACTIS_ACCESS_CATEGORIES,
  ACTIS_ROLE_LEVELS,
  ALL_ACTIS_MENU_ITEMS,
  DEFAULT_ROLE_MENU_PERMISSIONS,
  isMenuLockedForRole,
  normalizeAllRolesPermissions,
  normalizeRoleMenuPermissions,
  type ActisRoleKey,
  type MenuAccessKey,
} from "@/lib/accessLevels";

type RolesMap = Record<ActisRoleKey, MenuAccessKey[]>;

export default function AccessLevelsPage() {
  const { currentUser, users, refreshAccessLevels } = useCurrentUser();
  const { confirm: confirmDialog } = useDialog();

  const isAdmin = currentUser?.role === "admin";

  const [selectedRole, setSelectedRole] = useState<ActisRoleKey>("noc_engineer");
  const [savedRoles, setSavedRoles] = useState<RolesMap>(() =>
    normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS)
  );
  const [draftRoles, setDraftRoles] = useState<RolesMap>(() =>
    normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS)
  );
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

  const loadAccessLevels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/access-levels", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.success && json.permissionsByRole) {
        const normalized = normalizeAllRolesPermissions(json.permissionsByRole);
        setSavedRoles(normalized);
        setDraftRoles(normalized);
        setUpdatedBy(json.updatedBy || null);
        setUpdatedAt(json.updatedAt || null);
      }
    } catch {
      setNotice({
        type: "error",
        message: "Gagal memuat data Level Akses dari server.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAccessLevels();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAccessLevels]);

  const totalMenus = ALL_ACTIS_MENU_ITEMS.length;
  const currentMenuList = draftRoles[selectedRole] || [];
  const activeMenuSet = useMemo(
    () => new Set<MenuAccessKey>(currentMenuList),
    [currentMenuList]
  );

  const activeCount = currentMenuList.length;
  const activePercent = totalMenus > 0 ? Math.round((activeCount / totalMenus) * 100) : 0;

  const isDirty = useMemo(() => {
    return JSON.stringify(draftRoles) !== JSON.stringify(savedRoles);
  }, [draftRoles, savedRoles]);

  const userCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of ACTIS_ROLE_LEVELS) counts[r.key] = 0;
    for (const u of users || []) {
      if (u?.role && counts[u.role] !== undefined) {
        counts[u.role] += 1;
      }
    }
    return counts;
  }, [users]);

  const selectedRoleMeta =
    ACTIS_ROLE_LEVELS.find((r) => r.key === selectedRole) || ACTIS_ROLE_LEVELS[0];

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

      const nextSaved = normalizeAllRolesPermissions(json.permissionsByRole);
      setSavedRoles(nextSaved);
      setDraftRoles(nextSaved);
      setUpdatedBy(json.updatedBy || currentUser?.nama || null);
      setUpdatedAt(json.updatedAt || new Date().toISOString());

      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "success",
        message: `Konfigurasi Level Akses (${selectedRoleMeta.label}) berhasil disimpan dan langsung aktif di sidebar & rute halaman.`,
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
      `Kembalikan daftar menu aktif untuk level user "${selectedRoleMeta.label}" ke pengaturan default standar ACTIS?`
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

      const nextSaved = normalizeAllRolesPermissions(json.permissionsByRole);
      setSavedRoles(nextSaved);
      setDraftRoles(nextSaved);
      setUpdatedBy(json.updatedBy || currentUser?.nama || null);
      setUpdatedAt(json.updatedAt || new Date().toISOString());

      await refreshAccessLevels({ broadcast: true });
      setNotice({
        type: "info",
        message: `Level Akses "${selectedRoleMeta.label}" telah dikembalikan ke pengaturan default.`,
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
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Kembali ke Dashboard
          </Link>
        </div>
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
              Atur menu ACTIS yang dapat diakses oleh masing-masing level pengguna secara terpusat.
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Default</span>
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
            <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
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

      {/* Main White Panel Card (Matches Screenshot Layout) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 space-y-5">
        {/* Control Row: Level User + Quick Buttons + Menu Aktif Progress Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            {/* Level user dropdown */}
            <div className="min-w-[230px] relative">
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
                  Pilih role akun ACTIS yang ingin dikonfigurasi. Perubahan berlaku langsung untuk semua user pada role tersebut setelah menekan <strong>Simpan Perubahan</strong>.
                </div>
              )}
              <select
                id="access-level-role-select"
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value as ActisRoleKey);
                  setNotice(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {ACTIS_ROLE_LEVELS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} ({userCountByRole[r.key] ?? 0} akun)
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
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Menu aktif
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedRoleMeta.badgeClass}`}
                >
                  {selectedRoleMeta.label}
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Belum Disimpan
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium tabular-nums">
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

        {/* Category Cards Grid (Matches Screenshot 5-col desktop flow) */}
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
                  Perbandingan matriks menu aktif antar role ACTIS. Klik nama role pada kolom header untuk mengedit.
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
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 bg-slate-50/70 dark:bg-slate-950/40">
              {ACTIS_ROLE_LEVELS.map((r) => {
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
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {r.label}
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
                    {ACTIS_ROLE_LEVELS.map((r) => (
                      <th key={r.key} className="py-2.5 px-3 text-center">
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
                          colSpan={ACTIS_ROLE_LEVELS.length + 1}
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
                          {ACTIS_ROLE_LEVELS.map((r) => {
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
