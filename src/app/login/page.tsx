"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/context/UserContext";
import {
  Server,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  UserX,
  ArrowRight,
} from "lucide-react";

interface RememberedAccount {
  id: string;
  nama: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  noc_engineer: "NOC Engineer",
  field_engineer: "Field Engineer",
  sales_corporate: "Sales Corporate",
  warehouse_admin: "Admin Gudang",
};

function getInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithRememberMe } = useCurrentUser();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [rememberedUser, setRememberedUser] = useState<RememberedAccount | null>(null);
  const [checkingRemember, setCheckingRemember] = useState(true);
  const [quickLoading, setQuickLoading] = useState(false);
  const [forgettingAccount, setForgettingAccount] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedReason = sessionStorage.getItem("actis_logout_reason");
    const urlParams = new URLSearchParams(window.location.search);
    if (storedReason === "timeout" || urlParams.get("reason") === "timeout") {
      setIsTimeout(true);
      sessionStorage.removeItem("actis_logout_reason");
    }

    try {
      const savedEmail = localStorage.getItem("actis_remembered_email") || "";
      const savedRememberFlag = localStorage.getItem("actis_remember_me") === "true";
      if (savedEmail) {
        setEmail(savedEmail);
      }
      if (savedRememberFlag) {
        setRememberMe(true);
      }
    } catch {}

    let active = true;
    fetch("/api/auth/remember", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.success && json?.remembered && json?.user) {
          setRememberedUser(json.user);
          setRememberMe(true);
          if (json.user.email) {
            setEmail(json.user.email);
            try {
              localStorage.setItem("actis_remembered_email", json.user.email);
              localStorage.setItem("actis_remember_me", "true");
            } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingRemember(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleQuickLogin = async () => {
    if (quickLoading || loading || success) return;
    setError(null);
    setStatusNote(null);
    setQuickLoading(true);

    const result = await loginWithRememberMe();
    setQuickLoading(false);

    if (!result.success) {
      setRememberedUser(null);
      setError(result.error || "Sesi Ingat Saya tidak berlaku lagi. Silakan masuk manual.");
      emailInputRef.current?.focus();
    } else {
      setStatusNote("Berhasil masuk kembali melalui Ingat Saya.");
      setSuccess(true);
      setTimeout(() => {
        router.push("/queue");
      }, 450);
    }
  };

  const handleForgetAccount = async () => {
    if (forgettingAccount || quickLoading || loading || success) return;
    setForgettingAccount(true);
    setError(null);
    setStatusNote(null);

    try {
      await fetch("/api/auth/remember", { method: "DELETE" });
    } catch {}

    try {
      localStorage.removeItem("actis_remembered_email");
      localStorage.removeItem("actis_remember_me");
    } catch {}

    setRememberedUser(null);
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setForgettingAccount(false);
    setStatusNote("Akun tersimpan di perangkat ini dihapus. Silakan masukkan akun baru.");
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusNote(null);

    if (!email.trim() || !password) {
      setError("Silakan masukkan email dan password akun Anda.");
      if (!email.trim()) {
        emailInputRef.current?.focus();
      }
      return;
    }

    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Login gagal. Periksa email atau password Anda.");
      errorBannerRef.current?.focus();
    } else {
      setStatusNote("Login berhasil! Mengalihkan ke dashboard antrean.");
      setSuccess(true);
      setTimeout(() => {
        router.push("/queue");
      }, 500);
    }
  };

  const isBusy = loading || quickLoading || forgettingAccount || success;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 dark:from-[#10151f] dark:via-[#152033] dark:to-[#111722] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 dark:shadow-slate-950/60 mb-4 ring-4 ring-white/10">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white dark:text-slate-100 tracking-tight">
            ACTIS TOOLS
          </h1>
          <p className="text-sm font-semibold text-blue-400 dark:text-blue-300 mt-1">
            ISP PROVISIONING &amp; NOC SYSTEM
          </p>
          <div className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full bg-blue-900/60 dark:bg-blue-950/60 border border-blue-700/50 dark:border-blue-800/50 text-[11px] font-bold text-blue-300">
            Dual-DB Enterprise Core
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
          <div className="mb-5">
            <h2 id="login-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Masuk ke Sistem
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Masukkan kredensial akun ISP untuk mengakses antrean dan operasional.
            </p>
          </div>

          {isTimeout && !error && !success && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Sesi Anda Telah Berakhir</p>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                  {rememberedUser
                    ? "Demi keamanan akun ISP, sesi ditutup karena tidak ada aktivitas. Gunakan tombol Masuk Cepat di bawah atau isi password untuk masuk kembali."
                    : "Anda telah lama meninggalkan web atau tidak ada aktivitas yang terdeteksi. Demi keamanan akun ISP, silakan masuk kembali."}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              ref={errorBannerRef}
              tabIndex={-1}
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-200 text-xs flex items-start space-x-2.5 animate-fadeIn focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              aria-live="polite"
              className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-200 text-xs flex items-center space-x-2.5 animate-fadeIn"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Login berhasil! Mengalihkan ke dashboard antrean...</span>
            </div>
          )}

          <div className="sr-only" role="status" aria-live="polite">
            {statusNote || ""}
          </div>

          {/* 1-Click Quick Login Card (Active when valid Remember Me cookie verified on server) */}
          {!checkingRemember && rememberedUser && !success && (
            <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/75 dark:bg-blue-950/30 p-4 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {getInitials(rememberedUser.nama)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {rememberedUser.nama}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        Ingat Saya
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {rememberedUser.email}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {ROLE_LABELS[rememberedUser.role] || rememberedUser.role}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickLogin}
                  disabled={isBusy}
                  className="flex-1 min-h-[44px] py-2.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-sm shadow-blue-500/20 dark:shadow-slate-950/60 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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

          {!checkingRemember && rememberedUser && !success && (
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 dark:border-slate-700/80 w-full" />
              <span className="px-3 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                atau masuk dengan kredensial
              </span>
            </div>
          )}

          <form
            onSubmit={handleLogin}
            method="post"
            aria-labelledby="login-heading"
            className="space-y-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Email Pengguna
                </label>
                {!rememberedUser && email && (
                  <button
                    type="button"
                    onClick={handleForgetAccount}
                    disabled={isBusy}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Ganti Email
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  ref={emailInputRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama.pengguna@isp-enterprise.net"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full min-h-[46px] pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus-visible:text-blue-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox Row (Placed immediately before inline label per form semantics) */}
            <div className="relative flex items-start gap-3 rounded-xl px-3 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70">
              <input
                type="checkbox"
                id="remember-me"
                name="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                aria-describedby="remember-me-hint"
                className="actis-brand-checkbox mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 accent-blue-600 dark:accent-blue-400 cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="actis-remember-label flex-1 cursor-pointer select-none py-0.5"
              >
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                  Ingat Saya di perangkat ini (30 hari)
                </span>
                <span
                  id="remember-me-hint"
                  className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed"
                >
                  Simpan email dan aktifkan Masuk Cepat 1-klik saat sesi idle berakhir.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 dark:shadow-slate-950/60 transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Akun</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Sistem Terlindungi Hak Akses Terpusat &bull; &copy; 2026 ACTIS ISP
        </p>
      </div>
    </div>
  );
}
