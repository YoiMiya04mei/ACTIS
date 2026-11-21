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
} from "lucide-react";

interface RememberedAccount {
  id: string;
  nama: string;
  email: string;
  role: string;
}

const SAVED_PASSWORD_SENTINEL = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithRememberMe } = useCurrentUser();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);
  const userEditedPasswordRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usingSavedCredential, setUsingSavedCredential] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [rememberedUser, setRememberedUser] = useState<RememberedAccount | null>(null);
  const [checkingRemember, setCheckingRemember] = useState(true);
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
          if (!userEditedPasswordRef.current) {
            setUsingSavedCredential(true);
            setShowPassword(false);
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

  const handleForgetAccount = async () => {
    if (forgettingAccount || loading || success) return;
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

    userEditedPasswordRef.current = false;
    setUsingSavedCredential(false);
    setRememberedUser(null);
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRememberMe(false);
    setForgettingAccount(false);
    setStatusNote("Akun & kredensial tersimpan di perangkat ini dihapus. Silakan masukkan akun baru.");
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusNote(null);

    const trimmedEmail = email.trim();
    const matchesRememberedEmail = Boolean(
      rememberedUser && trimmedEmail.toLowerCase() === rememberedUser.email.toLowerCase()
    );

    if (usingSavedCredential && matchesRememberedEmail) {
      setLoading(true);
      const result = await loginWithRememberMe({ rememberMe });
      setLoading(false);

      if (!result.success) {
        setRememberedUser(null);
        setUsingSavedCredential(false);
        setError(result.error || "Sesi Ingat Saya tidak berlaku lagi. Silakan masukkan password kembali.");
        errorBannerRef.current?.focus();
        return;
      }

      if (!rememberMe) {
        setRememberedUser(null);
        setUsingSavedCredential(false);
      }

      const targetPath =
        (result.user?.role || rememberedUser?.role) === "request_barang"
          ? "/request-barang"
          : result.landingPath || "/dashboard";
      setStatusNote(
        targetPath === "/request-barang"
          ? "Login berhasil! Mengalihkan ke portal Request Barang."
          : targetPath === "/dashboard"
          ? "Login berhasil! Mengalihkan ke Dashboard utama."
          : "Login berhasil! Mengalihkan ke menu utama yang diizinkan."
      );
      setSuccess(true);
      setTimeout(() => {
        router.push(targetPath);
      }, 450);
      return;
    }

    if (!trimmedEmail || !password) {
      setError("Silakan masukkan email dan password akun Anda.");
      if (!trimmedEmail) {
        emailInputRef.current?.focus();
      }
      return;
    }

    setLoading(true);
    const result = await login(trimmedEmail, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Login gagal. Periksa email atau password Anda.");
      errorBannerRef.current?.focus();
    } else {
      if (
        rememberMe &&
        typeof window !== "undefined" &&
        "PasswordCredential" in window &&
        navigator.credentials?.store
      ) {
        try {
          const CredCtor = (
            window as unknown as {
              PasswordCredential: new (data: {
                id: string;
                password: string;
                name?: string;
              }) => Credential;
            }
          ).PasswordCredential;
          const cred = new CredCtor({
            id: result.user?.email || trimmedEmail.toLowerCase(),
            password,
            name: result.user?.nama || trimmedEmail,
          });
          await navigator.credentials.store(cred);
        } catch {
          // Ignore browser password manager storage rejections
        }
      }

      const targetPath =
        result.user?.role === "request_barang"
          ? "/request-barang"
          : result.landingPath || "/dashboard";
      setStatusNote(
        targetPath === "/request-barang"
          ? "Login berhasil! Mengalihkan ke portal Request Barang."
          : targetPath === "/dashboard"
          ? "Login berhasil! Mengalihkan ke Dashboard utama."
          : "Login berhasil! Mengalihkan ke menu utama yang diizinkan."
      );
      setSuccess(true);
      setTimeout(() => {
        router.push(targetPath);
      }, 500);
    }
  };

  const isBusy = loading || forgettingAccount || success;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 dark:from-[#0c1426] dark:via-[#132042] dark:to-[#0d162c] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 dark:bg-blue-500/14 rounded-full blur-3xl pointer-events-none" />

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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-700/80">
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
                    ? "Demi keamanan akun ISP, sesi ditutup karena tidak ada aktivitas. Klik Masuk ke Akun tanpa mengetik ulang kredensial."
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
                {(rememberedUser || email) && (
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
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setEmail(nextEmail);
                    if (
                      usingSavedCredential &&
                      rememberedUser &&
                      nextEmail.trim().toLowerCase() !== rememberedUser.email.toLowerCase()
                    ) {
                      userEditedPasswordRef.current = true;
                      setUsingSavedCredential(false);
                      setPassword("");
                    }
                  }}
                  placeholder="nama.pengguna@isp-enterprise.net"
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
                {usingSavedCredential && (
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
                  id="login-password"
                  name="password"
                  type={usingSavedCredential ? "password" : showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  value={usingSavedCredential ? SAVED_PASSWORD_SENTINEL : password}
                  onChange={(e) => {
                    const raw = e.target.value;
                    userEditedPasswordRef.current = true;
                    if (usingSavedCredential) {
                      setUsingSavedCredential(false);
                      const cleaned = raw.includes("\u2022") ? raw.replace(/\u2022+/g, "") : raw;
                      setPassword(cleaned);
                    } else {
                      setPassword(raw);
                    }
                  }}
                  aria-describedby={usingSavedCredential || (!rememberedUser && email && rememberMe) ? "password-saved-hint" : undefined}
                  placeholder="Masukkan password"
                  className="w-full min-h-[46px] pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!usingSavedCredential) setShowPassword(!showPassword);
                  }}
                  disabled={usingSavedCredential}
                  aria-pressed={showPassword}
                  aria-label={
                    usingSavedCredential
                      ? "Password tersimpan terenkripsi di server"
                      : showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  title={
                    usingSavedCredential
                      ? "Password tersimpan terenkripsi oleh server untuk keamanan. Ketik ulang jika ingin mengganti."
                      : undefined
                  }
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus-visible:text-blue-600 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {showPassword && !usingSavedCredential ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {usingSavedCredential && (
                <p id="password-saved-hint" className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1.5 leading-relaxed">
                  Kredensial password tersimpan terenkripsi. Langsung klik{" "}
                  <span className="font-semibold">Masuk ke Akun</span> atau ketik password baru untuk mengganti.
                </p>
              )}
              {!usingSavedCredential && !rememberedUser && !checkingRemember && email && rememberMe && (
                <p id="password-saved-hint" className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Masukkan password satu kali agar kredensial akun &amp; password Anda disimpan oleh fitur Ingat Saya di perangkat ini.
                </p>
              )}
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
                  Simpan email &amp; kredensial password terenkripsi untuk masuk kembali tanpa mengetik ulang.
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
