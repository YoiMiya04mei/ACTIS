"use client";

import React, { useState, useEffect } from "react";
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
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedReason = sessionStorage.getItem("actis_logout_reason");
      const urlParams = new URLSearchParams(window.location.search);
      if (storedReason === "timeout" || urlParams.get("reason") === "timeout") {
        setIsTimeout(true);
        sessionStorage.removeItem("actis_logout_reason");
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Silakan masukkan email dan password akun Anda.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Login gagal. Periksa email atau password Anda.");
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/queue");
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 mb-4 ring-4 ring-white/10">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ACTIS TOOLS
          </h1>
          <p className="text-sm font-semibold text-blue-400 mt-1">
            ISP PROVISIONING & NOC SYSTEM
          </p>
          <div className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full bg-blue-900/60 border border-blue-700/50 text-[11px] font-bold text-blue-300">
            Dual-DB Enterprise Core
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Masuk ke Sistem</h2>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan kredensial akun ISP untuk mengakses antrean dan operasional.
            </p>
          </div>

          {isTimeout && !error && !success && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">Sesi Anda Telah Berakhir</p>
                <p className="mt-0.5 text-[11px] text-amber-700 leading-relaxed">
                  Anda telah lama meninggalkan web atau tidak ada aktivitas yang terdeteksi. Demi keamanan akun ISP, silakan masuk kembali.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Login berhasil! Mengalihkan ke dashboard antrean...</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama.pengguna@isp-enterprise.net"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 transition disabled:opacity-50 flex items-center justify-center space-x-2"
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

