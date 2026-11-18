"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { SearchableItemSelect } from "@/components/inventory/SearchableItemSelect";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserX,
} from "lucide-react";
import {
  PICKUP_LOCATION_OPTIONS,
  WORK_TYPE_OPTIONS,
  type PickupLocationOption,
  type WorkTypeOption,
  formatWorkTypeLabel,
} from "@/lib/inventoryRequest";

interface PortalAuthUser {
  id: string;
  nama: string;
  username: string;
  role: string;
  is_active?: boolean;
}

interface RememberedPortalUser {
  id: string;
  nama: string;
  username: string;
  role: string;
}

interface PortalAuthState {
  loading: boolean;
  loginRequired: boolean;
  idleTimeoutMinutes: number;
  authenticated: boolean;
  hasAccess: boolean;
  user: PortalAuthUser | null;
  rememberedUser: RememberedPortalUser | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  noc_engineer: "NOC Engineer",
  field_engineer: "Field Engineer",
  sales_corporate: "Sales Corporate",
  warehouse_admin: "Admin Gudang",
  request_barang: "User Request Barang",
};

const SAVED_PASSWORD_SENTINEL = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

function getInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface PublicCatalogItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: string;
  category_name: string | null;
}

interface RequestRow {
  rowKey: string;
  item_id: string;
  quantity: string;
  notes: string;
}

interface SubmittedReceipt {
  id: string;
  request_number: string;
  pic_name: string;
  pic_phone: string | null;
  request_date: string;
  work_type_label: string;
  pickup_location: string;
  notes: string | null;
  status: string;
  items: Array<{
    id: string;
    quantity: string | number;
    unit: string;
    notes: string | null;
    item: {
      id: string;
      code: string;
      name: string;
      unit: string;
    };
  }>;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PublicRequestBarangPage() {
  const formHeadingId = useId();
  const picNameRef = useRef<HTMLInputElement | null>(null);
  const requestDateRef = useRef<HTMLInputElement | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const userEditedPasswordRef = useRef(false);

  const [portalAuth, setPortalAuth] = useState<PortalAuthState>({
    loading: true,
    loginRequired: true,
    idleTimeoutMinutes: 15,
    authenticated: false,
    hasAccess: false,
    user: null,
    rememberedUser: null,
  });
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [usingSavedCredential, setUsingSavedCredential] = useState(false);
  const [loginRememberMe, setLoginRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [forgettingAccount, setForgettingAccount] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessNote, setLoginSuccessNote] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form fields matching INFORMASI REQUEST specification
  const [picName, setPicName] = useState("");
  const [picPhone, setPicPhone] = useState("");
  const [requestDate, setRequestDate] = useState(getTodayDateString);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkTypeOption | "">("");
  const [workTypeOther, setWorkTypeOther] = useState("");
  const [pickupLocation, setPickupLocation] = useState<PickupLocationOption | "">("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([
    { rowKey: "row-1", item_id: "", quantity: "1", notes: "" },
  ]);
  const [companyWebsite, setCompanyWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/public/inventory-requests", { cache: "no-store" });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        setPortalAuth((prev) => ({
          ...prev,
          loading: false,
          authenticated: res.status === 403,
          hasAccess: false,
        }));
        return;
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat daftar barang.");
      }
      setCatalog(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      setCatalogError(err?.message || "Tidak dapat memuat daftar barang gudang.");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const checkPortalAuth = useCallback(async () => {
    setPortalAuth((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/request-barang/auth", { cache: "no-store" });
      const json = await res.json();
      const remUser: RememberedPortalUser | null = json?.rememberedUser || null;
      const nextState: PortalAuthState = {
        loading: false,
        loginRequired: json?.loginRequired !== false,
        idleTimeoutMinutes:
          typeof json?.idleTimeoutMinutes === "number" ? json.idleTimeoutMinutes : 15,
        authenticated: Boolean(json?.authenticated),
        hasAccess: Boolean(json?.hasAccess),
        user: json?.user || null,
        rememberedUser: remUser,
      };
      setPortalAuth(nextState);

      if (remUser && !nextState.authenticated) {
        setLoginUsername(remUser.username);
        setLoginRememberMe(true);
        if (!userEditedPasswordRef.current) {
          setUsingSavedCredential(true);
          setShowLoginPassword(false);
        }
      }

      if (!nextState.loginRequired || (nextState.authenticated && nextState.hasAccess)) {
        if (nextState.user?.nama) {
          setPicName((prev) => prev || nextState.user?.nama || "");
        }
        loadCatalog();
      } else {
        setLoadingCatalog(false);
      }
    } catch {
      setPortalAuth({
        loading: false,
        loginRequired: true,
        idleTimeoutMinutes: 15,
        authenticated: false,
        hasAccess: false,
        user: null,
        rememberedUser: null,
      });
      setLoadingCatalog(false);
    }
  }, [loadCatalog]);

  useEffect(() => {
    checkPortalAuth();
  }, [checkPortalAuth]);

  const handlePortalLogout = useCallback(
    async (options?: { reason?: "timeout" | "manual"; forgetDevice?: boolean }) => {
      if (loggingOut) return;
      setLoggingOut(true);
      const isTimeoutReason = options?.reason === "timeout";
      const forgetDevice = Boolean(options?.forgetDevice);
      try {
        await fetch("/api/request-barang/auth", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: options?.reason || "manual",
            forgetDevice,
          }),
        });
      } catch {}

      setCatalog([]);
      setReceipt(null);
      setPicName("");
      setLoginPassword("");
      setLoginError(null);
      setLoginSuccessNote(null);
      setIsTimeout(isTimeoutReason);
      userEditedPasswordRef.current = false;
      await checkPortalAuth();
      setLoggingOut(false);
    },
    [checkPortalAuth, loggingOut]
  );

  // Enforce identical inactivity auto-logout policy as main ACTIS web login
  useEffect(() => {
    const isPortalActive =
      portalAuth.authenticated && portalAuth.hasAccess && portalAuth.idleTimeoutMinutes > 0;
    if (!isPortalActive) return;

    let lastActivity = Date.now();
    const markActivity = () => {
      lastActivity = Date.now();
    };
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));

    const maxIdleMs = portalAuth.idleTimeoutMinutes * 60 * 1000;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity >= maxIdleMs) {
        clearInterval(interval);
        handlePortalLogout({ reason: "timeout" });
      }
    }, 15_000);

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
    };
  }, [
    portalAuth.authenticated,
    portalAuth.hasAccess,
    portalAuth.idleTimeoutMinutes,
    handlePortalLogout,
  ]);

  const handleQuickLogin = async () => {
    if (quickLoading || loginSubmitting || forgettingAccount) return;
    setLoginError(null);
    setLoginSuccessNote(null);
    setIsTimeout(false);
    setQuickLoading(true);
    try {
      const res = await fetch("/api/request-barang/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useRememberCookie: true,
          rememberMe: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setUsingSavedCredential(false);
        setLoginError(
          json.error || "Sesi Ingat Saya tidak berlaku lagi. Silakan masuk dengan username dan password."
        );
        await checkPortalAuth();
        return;
      }
      setLoginSuccessNote("Login berhasil! Membuka Form Request Barang...");
      await checkPortalAuth();
    } catch (err: any) {
      setLoginError(err?.message || "Gagal memproses Masuk Cepat.");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleForgetAccount = async () => {
    if (forgettingAccount || quickLoading || loginSubmitting) return;
    setForgettingAccount(true);
    setLoginError(null);
    setLoginSuccessNote(null);
    try {
      await fetch("/api/request-barang/auth?forgetDevice=1", { method: "DELETE" });
    } catch {}
    userEditedPasswordRef.current = false;
    setUsingSavedCredential(false);
    setLoginUsername("");
    setLoginPassword("");
    setShowLoginPassword(false);
    setLoginRememberMe(false);
    setPortalAuth((prev) => ({ ...prev, rememberedUser: null }));
    setForgettingAccount(false);
    setTimeout(() => usernameInputRef.current?.focus(), 50);
  };

  const handlePortalLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loginSubmitting || quickLoading || forgettingAccount) return;
    setLoginError(null);
    setLoginSuccessNote(null);
    setIsTimeout(false);

    const trimmedUsername = loginUsername.trim().toLowerCase();
    const matchesRemembered = Boolean(
      portalAuth.rememberedUser &&
        trimmedUsername === portalAuth.rememberedUser.username.toLowerCase()
    );

    if (usingSavedCredential && matchesRemembered) {
      setLoginSubmitting(true);
      try {
        const res = await fetch("/api/request-barang/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useRememberCookie: true,
            rememberMe: loginRememberMe,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setUsingSavedCredential(false);
          setLoginError(
            json.error || "Sesi Ingat Saya tidak berlaku lagi. Silakan masukkan password kembali."
          );
          await checkPortalAuth();
          return;
        }
        setLoginSuccessNote("Login berhasil! Membuka Form Request Barang...");
        await checkPortalAuth();
      } catch (err: any) {
        setLoginError(err?.message || "Terjadi kesalahan saat memproses login.");
      } finally {
        setLoginSubmitting(false);
      }
      return;
    }

    if (!trimmedUsername || !loginPassword) {
      setLoginError("Silakan masukkan username dan password akun Anda.");
      if (!trimmedUsername) usernameInputRef.current?.focus();
      return;
    }

    if (trimmedUsername.includes("@")) {
      setLoginError("Login menggunakan username, bukan alamat email.");
      usernameInputRef.current?.focus();
      return;
    }

    setLoginSubmitting(true);
    try {
      const res = await fetch("/api/request-barang/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password: loginPassword,
          rememberMe: loginRememberMe,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setLoginError(json.error || "Username atau password salah.");
        return;
      }
      setLoginPassword("");
      setUsingSavedCredential(false);
      setLoginSuccessNote("Login berhasil! Membuka Form Request Barang...");
      await checkPortalAuth();
    } catch (err: any) {
      setLoginError(err?.message || "Terjadi kesalahan saat memproses login.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSelectWorkType = (option: WorkTypeOption) => {
    setFieldErrors((prev) => ({ ...prev, work_types: "" }));
    setSelectedWorkType(option);
    if (option !== "Lainnya") {
      setWorkTypeOther("");
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { rowKey: `row-${Date.now()}-${prev.length + 1}`, item_id: "", quantity: "1", notes: "" },
    ]);
  };

  const handleRemoveRow = (rowKey: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
  };

  const handleRowChange = (
    rowKey: string,
    field: "item_id" | "quantity" | "notes",
    value: string
  ) => {
    setFieldErrors((prev) => ({ ...prev, items: "" }));
    setRows((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row))
    );
  };

  const resetForNewRequest = () => {
    setReceipt(null);
    setPicName(portalAuth.user?.nama || "");
    setPicPhone("");
    setRequestDate(getTodayDateString());
    setSelectedWorkType("");
    setWorkTypeOther("");
    setPickupLocation("");
    setNotes("");
    setRows([{ rowKey: `row-${Date.now()}`, item_id: "", quantity: "1", notes: "" }]);
    setFieldErrors({});
    setSubmitError(null);
    loadCatalog();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: Record<string, string> = {};
    if (picName.trim().length < 2) {
      nextErrors.pic_name = "Nama PIC Penerima wajib diisi (minimal 2 karakter).";
    }
    if (!requestDate) {
      nextErrors.request_date = "Tanggal Request wajib diisi.";
    }
    if (!selectedWorkType) {
      nextErrors.work_types = "Pilih 1 Jenis Pekerjaan.";
    }
    if (!pickupLocation) {
      nextErrors.pickup_location = "Lokasi Pengambilan wajib dipilih.";
    }

    const validRows = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      nextErrors.items = "Pilih minimal 1 barang dan tentukan kuantitas lebih dari 0.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitError("Mohon lengkapi seluruh kolom bertanda wajib sebelum mengirim request.");
      if (nextErrors.pic_name) {
        picNameRef.current?.focus();
      } else if (nextErrors.request_date) {
        requestDateRef.current?.focus();
      } else {
        errorBannerRef.current?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/inventory-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pic_name: picName.trim(),
          pic_phone: picPhone.trim() || null,
          request_date: requestDate,
          work_types: selectedWorkType ? [selectedWorkType] : [],
          work_type_other: selectedWorkType === "Lainnya" ? workTypeOther.trim() : null,
          pickup_location: pickupLocation,
          notes: notes.trim() || null,
          company_website: companyWebsite,
          items: validRows.map((r) => ({
            item_id: r.item_id,
            quantity: Number(r.quantity),
            notes: r.notes.trim() || null,
          })),
        }),
      });

      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        await checkPortalAuth();
        throw new Error(json.error || "Sesi Anda berakhir atau akses dicabut.");
      }
      if (!res.ok || !json.success) {
        if (json.field) {
          setFieldErrors((prev) => ({ ...prev, [json.field]: json.error }));
        }
        throw new Error(json.error || "Gagal mengirim form request barang.");
      }

      setReceipt({
        ...json.data,
        work_type_label:
          json.data.work_type_label ||
          formatWorkTypeLabel(json.data.work_types, json.data.work_type_other),
      });
      setFieldErrors({});
    } catch (err: any) {
      setSubmitError(err?.message || "Terjadi kesalahan saat mengirim request.");
      errorBannerRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const canRenderForm =
    !portalAuth.loading &&
    (!portalAuth.loginRequired || (portalAuth.authenticated && portalAuth.hasAccess));

  const isBusy = loginSubmitting || quickLoading || forgettingAccount;
  const matchesRemembered = Boolean(
    portalAuth.rememberedUser &&
      loginUsername.trim().toLowerCase() === portalAuth.rememberedUser.username.toLowerCase()
  );
  const showSavedState = usingSavedCredential && matchesRemembered;

  // Full-screen Login Page (shown first on every unauthenticated visit to /request-barang)
  if (portalAuth.loading || !canRenderForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 dark:from-[#0c1426] dark:via-[#132042] dark:to-[#0d162c] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 dark:bg-blue-500/14 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Brand Header (Parity with /login) */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 dark:shadow-slate-950/60 mb-4 ring-4 ring-white/10">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white dark:text-slate-100 tracking-tight">
              ACTIS TOOLS
            </h1>
            <p className="text-sm font-semibold text-blue-400 dark:text-blue-300 mt-1">
              PORTAL REQUEST BARANG KELUAR
            </p>
            <div className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full bg-blue-900/60 dark:bg-blue-950/60 border border-blue-700/50 dark:border-blue-800/50 text-[11px] font-bold text-blue-300">
              Username Authenticated Access
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-700/80">
            {portalAuth.loading ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Memeriksa sesi Portal Request Barang...
                </p>
              </div>
            ) : portalAuth.loginRequired && portalAuth.authenticated && !portalAuth.hasAccess ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Akun Portal Dinonaktifkan
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Akun <strong>{portalAuth.user?.nama}</strong> (
                    <span className="font-mono">@{portalAuth.user?.username}</span>) saat ini berstatus nonaktif untuk mengakses Web Form Request Barang.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hubungi Administrator untuk mengaktifkan akses akun ini di menu{" "}
                    <strong>Pengaturan User Akses</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePortalLogout({ forgetDevice: true })}
                  disabled={loggingOut}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loggingOut ? "Memproses..." : "Keluar & Masuk dengan Akun Lain"}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Login Web Request Barang
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Masukkan <strong>username</strong> dan password yang terdaftar di menu Pengaturan User Akses.
                  </p>
                </div>

                {isTimeout && !loginError && !loginSuccessNote && (
                  <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 text-xs flex items-start space-x-2.5">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">Sesi Anda Telah Berakhir</p>
                      <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                        {portalAuth.rememberedUser
                          ? "Demi keamanan akun, sesi ditutup karena tidak ada aktivitas. Klik Masuk Kembali atau isi kredensial."
                          : "Anda telah lama tidak aktif di halaman ini. Silakan login kembali menggunakan username."}
                      </p>
                    </div>
                  </div>
                )}

                {loginError && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-200 text-xs flex items-start space-x-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {loginSuccessNote && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-200 text-xs flex items-center space-x-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{loginSuccessNote}</span>
                  </div>
                )}

                {/* 1-Click Quick Login Card when valid actis_rb_remember exists */}
                {portalAuth.rememberedUser && !loginSuccessNote && (
                  <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/75 dark:bg-blue-950/30 p-4 space-y-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {getInitials(portalAuth.rememberedUser.nama)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {portalAuth.rememberedUser.nama}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            Tersimpan
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                          @{portalAuth.rememberedUser.username}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {ROLE_LABELS[portalAuth.rememberedUser.role] || portalAuth.rememberedUser.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleQuickLogin}
                        disabled={isBusy}
                        className="flex-1 min-h-[44px] py-2.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-sm shadow-blue-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {quickLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Masuk Cepat...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span>Masuk Kembali Tanpa Ketik Ulang</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleForgetAccount}
                        disabled={isBusy}
                        title="Hapus akun tersimpan di perangkat ini"
                        className="min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Ganti</span>
                      </button>
                    </div>
                  </div>
                )}

                {portalAuth.rememberedUser && !loginSuccessNote && (
                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-slate-200 dark:border-slate-700/80 w-full" />
                    <span className="px-3 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      atau masuk dengan username lain
                    </span>
                    <div className="border-t border-slate-200 dark:border-slate-700/80 w-full" />
                  </div>
                )}

                <form onSubmit={handlePortalLogin} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="req-login-username"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                      >
                        Username
                      </label>
                      {!portalAuth.rememberedUser && loginUsername && (
                        <button
                          type="button"
                          onClick={handleForgetAccount}
                          disabled={isBusy}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Reset Username
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        ref={usernameInputRef}
                        id="req-login-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={loginUsername}
                        onChange={(e) => {
                          const nextVal = e.target.value.replace(/\s+/g, "");
                          setLoginUsername(nextVal);
                          if (
                            usingSavedCredential &&
                            portalAuth.rememberedUser &&
                            nextVal.toLowerCase() !==
                              portalAuth.rememberedUser.username.toLowerCase()
                          ) {
                            userEditedPasswordRef.current = true;
                            setUsingSavedCredential(false);
                            setLoginPassword("");
                          }
                        }}
                        placeholder="Masukkan username (cth: rendi)"
                        className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="req-login-password"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                      >
                        Password
                      </label>
                      {showSavedState && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="w-3 h-3" />
                          Tersimpan
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="req-login-password"
                        name="password"
                        type={showSavedState ? "password" : showLoginPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={showSavedState ? SAVED_PASSWORD_SENTINEL : loginPassword}
                        onChange={(e) => {
                          const raw = e.target.value;
                          userEditedPasswordRef.current = true;
                          if (usingSavedCredential) {
                            setUsingSavedCredential(false);
                            const cleaned = raw.includes("\u2022") ? raw.replace(/\u2022+/g, "") : raw;
                            setLoginPassword(cleaned);
                          } else {
                            setLoginPassword(raw);
                          }
                        }}
                        placeholder="Masukkan password"
                        className="w-full min-h-[46px] pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!showSavedState) setShowLoginPassword((s) => !s);
                        }}
                        disabled={showSavedState}
                        className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                        aria-label={showLoginPassword ? "Sembunyikan password" : "Lihat password"}
                      >
                        {showLoginPassword && !showSavedState ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-3 rounded-xl px-3 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70">
                    <input
                      type="checkbox"
                      id="req-remember-me"
                      name="rememberMe"
                      checked={loginRememberMe}
                      onChange={(e) => setLoginRememberMe(e.target.checked)}
                      className="actis-brand-checkbox mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 accent-blue-600 dark:accent-blue-400 cursor-pointer"
                    />
                    <label
                      htmlFor="req-remember-me"
                      className="flex-1 cursor-pointer select-none py-0.5"
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                        Ingat Saya di perangkat ini (30 hari)
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        Simpan username &amp; kredensial terenkripsi untuk masuk kembali tanpa mengetik ulang.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loginSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Masuk ke Portal Request Barang</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Akses login diatur Administrator pada menu <strong>Pengaturan User Akses</strong>.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Title Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold tracking-wider uppercase">
            <ClipboardList className="w-3.5 h-3.5 text-sky-300" />
            {portalAuth.loginRequired
              ? "Portal Terautentikasi • Request Barang"
              : "Formulir Request Barang (Tanpa Login)"}
          </div>
          <h1
            id={formHeadingId}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase"
          >
            Form Request Barang Keluar
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Isi informasi request dan kebutuhan barang di bawah ini. Pengajuan akan masuk ke antrean{" "}
            <strong className="text-slate-800 dark:text-slate-200">Barang Keluar</strong> untuk
            di-ACC oleh petugas gudang.
          </p>
        </header>

        {/* Active Session Bar */}
        {portalAuth.authenticated && portalAuth.user && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                {portalAuth.user.nama.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {portalAuth.user.nama}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Akses Terverifikasi
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  @{portalAuth.user.username}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {portalAuth.user.role !== "request_barang" && (
                <Link
                  href="/queue"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Dashboard ACTIS</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => handlePortalLogout({ reason: "manual" })}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{loggingOut ? "Keluar..." : "Keluar"}</span>
              </button>
            </div>
          </div>
        )}

        {receipt ? (
          <section
            role="status"
            aria-live="polite"
            className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                    Request Barang Berhasil Dikirim
                  </h2>
                  <p className="text-xs text-emerald-100">
                    Menunggu persetujuan (ACC) petugas di menu Barang Keluar.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-white/15 font-mono font-bold text-xs sm:text-sm">
                {receipt.request_number}
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Nama PIC Penerima
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.pic_name}
                    {receipt.pic_phone ? ` (${receipt.pic_phone})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Tanggal Request
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {new Date(receipt.request_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Jenis Pekerjaan
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.work_type_label}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Lokasi Pengambilan
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.pickup_location}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Rincian Barang yang Diminta ({receipt.items.length} item)
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2.5 px-4">Barang</th>
                        <th className="py-2.5 px-4 text-right">Kuantitas</th>
                        <th className="py-2.5 px-4">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {receipt.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {it.item?.name}
                            </p>
                            <span className="font-mono text-xs text-slate-500">
                              {it.item?.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                            {Number(it.quantity)} {it.unit}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {it.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={resetForNewRequest}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Buat Request Barang Baru
                </button>
              </div>
            </div>
          </section>
        ) : (
          <form
            action="/api/public/inventory-requests"
            method="POST"
            aria-labelledby={formHeadingId}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6"
          >
            {/* Anti-spam honeypot field hidden from screen readers and tab order */}
            <div className="absolute -left-[9999px] h-0 w-0 opacity-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="company_website">Company Website</label>
              <input
                type="text"
                id="company_website"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </div>

            {submitError && (
              <div
                ref={errorBannerRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Periksa Kembali Input Anda</p>
                  <p>{submitError}</p>
                </div>
              </div>
            )}

            {/* INFORMASI REQUEST Card matching the institutional form template */}
            <section className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#122659] text-white px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
                  INFORMASI REQUEST
                </h2>
                <span className="text-[11px] text-slate-200 font-medium">
                  Kolom bertanda <span aria-hidden="true">*</span> wajib diisi
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {/* Row 1: Nama PIC Penerima & Tanggal Request */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  <div className="p-5 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                    <label
                      htmlFor="pic_name"
                      className="text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Nama PIC Penerima <span className="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={picNameRef}
                      id="pic_name"
                      name="pic_name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      enterKeyHint="next"
                      value={picName}
                      aria-invalid={Boolean(fieldErrors.pic_name)}
                      aria-describedby={fieldErrors.pic_name ? "err-pic-name" : "hint-pic-name"}
                      onChange={(e) => {
                        setPicName(e.target.value);
                        if (fieldErrors.pic_name) setFieldErrors((p) => ({ ...p, pic_name: "" }));
                      }}
                      placeholder="Masukkan nama lengkap PIC / teknisi penerima"
                      className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    />
                    {fieldErrors.pic_name ? (
                      <p id="err-pic-name" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.pic_name}
                      </p>
                    ) : (
                      <p id="hint-pic-name" className="text-xs text-slate-500 dark:text-slate-400">
                        Nama teknisi/PIC yang akan mengambil barang di gudang.
                      </p>
                    )}

                    <div className="pt-2 flex flex-col gap-1">
                      <label
                        htmlFor="pic_phone"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        No. HP / WhatsApp PIC (Opsional)
                      </label>
                      <input
                        id="pic_phone"
                        name="pic_phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={40}
                        enterKeyHint="next"
                        value={picPhone}
                        onChange={(e) => setPicPhone(e.target.value)}
                        placeholder="Contoh: 0812xxxxxxxx"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                    <label
                      htmlFor="request_date"
                      className="text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Tanggal Request <span className="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={requestDateRef}
                      id="request_date"
                      name="request_date"
                      type="date"
                      required
                      value={requestDate}
                      aria-invalid={Boolean(fieldErrors.request_date)}
                      aria-describedby={fieldErrors.request_date ? "err-request-date" : undefined}
                      onChange={(e) => {
                        setRequestDate(e.target.value);
                        if (fieldErrors.request_date) {
                          setFieldErrors((p) => ({ ...p, request_date: "" }));
                        }
                      }}
                      className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    />
                    {fieldErrors.request_date ? (
                      <p id="err-request-date" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.request_date}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tanggal rencana pengambilan / pengajuan barang.
                      </p>
                    )}

                    <div className="pt-2 flex flex-col gap-1">
                      <label
                        htmlFor="request_notes"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Catatan Tambahan / Referensi Pekerjaan (Opsional)
                      </label>
                      <input
                        id="request_notes"
                        name="notes"
                        type="text"
                        maxLength={500}
                        enterKeyHint="next"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Misal: Nama client, cluster, atau keterangan singkat..."
                        className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Jenis Pekerjaan & Lokasi Pengambilan */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  <fieldset
                    aria-describedby={fieldErrors.work_types ? "err-work-types" : undefined}
                    className="p-5 space-y-3"
                  >
                    <legend className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Jenis Pekerjaan <span className="text-rose-600" aria-hidden="true">*</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {WORK_TYPE_OPTIONS.map((option) => {
                        const checked = selectedWorkType === option;
                        const inputId = `work-type-${option.toLowerCase()}`;
                        return (
                          <div
                            key={option}
                            className={`flex items-center gap-2.5 min-h-[48px] px-3 py-2 rounded-lg border transition ${
                              checked
                                ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            }`}
                          >
                            <input
                              type="radio"
                              id={inputId}
                              name="work_type"
                              value={option}
                              checked={checked}
                              required
                              onChange={() => handleSelectWorkType(option)}
                              className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                            />
                            <label
                              htmlFor={inputId}
                              className="text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer select-none flex-1 py-2 -my-2"
                            >
                              {option}
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {selectedWorkType === "Lainnya" && (
                      <div className="pt-1 flex flex-col gap-1">
                        <label
                          htmlFor="work_type_other"
                          className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Sebutkan Jenis Pekerjaan Lainnya
                        </label>
                        <input
                          id="work_type_other"
                          name="work_type_other"
                          type="text"
                          maxLength={150}
                          value={workTypeOther}
                          onChange={(e) => setWorkTypeOther(e.target.value)}
                          placeholder="Contoh: Relokasi ODP / Dismantle / Audit Lapangan"
                          className="w-full min-h-[44px] px-3 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>
                    )}

                    {fieldErrors.work_types && (
                      <p id="err-work-types" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.work_types}
                      </p>
                    )}
                  </fieldset>

                  <fieldset
                    aria-describedby={fieldErrors.pickup_location ? "err-pickup-location" : undefined}
                    className="p-5 space-y-3"
                  >
                    <legend className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Lokasi Pengambilan <span className="text-rose-600" aria-hidden="true">*</span>
                    </legend>
                    <div className="space-y-2.5">
                      {PICKUP_LOCATION_OPTIONS.map((loc) => {
                        const checked = pickupLocation === loc;
                        const inputId = `pickup-${loc.toLowerCase().replace(/\s+/g, "-")}`;
                        return (
                          <div
                            key={loc}
                            className={`flex items-center gap-3 min-h-[48px] px-3.5 py-2 rounded-lg border transition ${
                              checked
                                ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            }`}
                          >
                            <input
                              type="radio"
                              id={inputId}
                              name="pickup_location"
                              value={loc}
                              checked={checked}
                              required
                              onChange={() => {
                                setPickupLocation(loc);
                                if (fieldErrors.pickup_location) {
                                  setFieldErrors((p) => ({ ...p, pickup_location: "" }));
                                }
                              }}
                              className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                            />
                            <label
                              htmlFor={inputId}
                              className="text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer select-none flex-1 py-2 -my-2"
                            >
                              {loc}
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {fieldErrors.pickup_location && (
                      <p id="err-pickup-location" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.pickup_location}
                      </p>
                    )}
                  </fieldset>
                </div>
              </div>
            </section>

            {/* Daftar Barang yang Diminta */}
            <section className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-sky-300" />
                  <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
                    Daftar Barang yang Diminta <span aria-hidden="true">*</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadCatalog}
                    disabled={loadingCatalog}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCatalog ? "animate-spin" : ""}`} />
                    Muat Ulang Barang
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Tambah Baris Barang
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {catalogError && (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium">
                    {catalogError}
                  </div>
                )}

                {fieldErrors.items && (
                  <p className="text-xs font-bold text-rose-600">{fieldErrors.items}</p>
                )}

                <div className="space-y-3">
                  {rows.map((row, idx) => {
                    const selectedItem = catalog.find((it) => it.id === row.item_id);
                    const selectId = `item-select-${row.rowKey}`;
                    const qtyId = `item-qty-${row.rowKey}`;
                    const noteId = `item-note-${row.rowKey}`;

                    return (
                      <div
                        key={row.rowKey}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                      >
                        <div className="md:col-span-6 flex flex-col gap-1">
                          <label
                            htmlFor={selectId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Barang #{idx + 1} <span className="text-rose-600">*</span>
                          </label>
                          <SearchableItemSelect
                            id={selectId}
                            ariaLabel={`Pilih barang request baris ${idx + 1}`}
                            value={row.item_id}
                            items={catalog}
                            placeholder={
                              loadingCatalog ? "Memuat daftar barang..." : "-- Pilih Barang --"
                            }
                            emptyItemsPlaceholder="-- Tidak ada barang aktif --"
                            searchPlaceholder="Cari nama atau kode barang..."
                            mode="parenthesis"
                            triggerClassName="min-h-[48px] px-3 py-2 text-base border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800"
                            onChange={(newId) => handleRowChange(row.rowKey, "item_id", newId)}
                          />
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-1">
                          <label
                            htmlFor={qtyId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Kuantitas ({selectedItem?.unit || "Unit"})
                          </label>
                          <input
                            id={qtyId}
                            name={`items[${idx}][quantity]`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]+(\.[0-9]+)?"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.rowKey, "quantity", e.target.value)}
                            className="w-full min-h-[48px] px-3 py-2 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          />
                        </div>

                        <div className="md:col-span-3 flex flex-col gap-1">
                          <label
                            htmlFor={noteId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Catatan Item (Opsional)
                          </label>
                          <input
                            id={noteId}
                            name={`items[${idx}][notes]`}
                            type="text"
                            maxLength={250}
                            value={row.notes}
                            onChange={(e) => handleRowChange(row.rowKey, "notes", e.target.value)}
                            placeholder="Opsional..."
                            className="w-full min-h-[48px] px-3 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          />
                        </div>

                        <div className="md:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowKey)}
                            disabled={rows.length === 1}
                            title="Hapus baris"
                            aria-label={`Hapus baris barang ${idx + 1}`}
                            className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Pastikan nama PIC penerima, tanggal request, jenis pekerjaan, lokasi pengambilan,
                serta barang yang diminta sudah sesuai.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Mengirim Request..." : "Kirim Form Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
