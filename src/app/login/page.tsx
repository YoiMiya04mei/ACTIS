"use client";

import React, { useState } from "react";
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
  Sparkles,
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

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
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

          {/* Demo Account Quick Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Uji Coba Cepat (Akun Demo)</span>
              </span>
              <span className="text-[10px] text-slate-400">Klik untuk isi otomatis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials("admin.noc@isp-enterprise.net", "admin123")}
                className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/80 text-left transition flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">Administrator</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-200 text-purple-800">
                    Full Access
                  </span>
                </div>
                <span className="text-[10px] text-purple-700 truncate mt-0.5">
                  admin.noc@isp-enterprise.net
                </span>
                <span className="text-[9px] text-purple-600 mt-0.5">
                  Bisa Tambah & Hapus User
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials("budi.santoso@isp-enterprise.net", "actis123")}
                className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-left transition flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">NOC Engineer</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-200 text-blue-800">
                    Operasional
                  </span>
                </div>
                <span className="text-[10px] text-blue-700 truncate mt-0.5">
                  budi.santoso@isp-enterprise.net
                </span>
                <span className="text-[9px] text-blue-600 mt-0.5">
                  Hanya Ganti Password
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials("dimas.k@isp-enterprise.net", "actis123")}
                className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-left transition flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">Field Engineer</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-amber-800">
                    Teknisi
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 truncate mt-0.5">
                  dimas.k@isp-enterprise.net
                </span>
                <span className="text-[9px] text-amber-600 mt-0.5">
                  Hanya Ganti Password
                </span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials("sarah.novita@isp-enterprise.net", "actis123")}
                className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-left transition flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Sales Corporate</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800">
                    Bisnis
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 truncate mt-0.5">
                  sarah.novita@isp-enterprise.net
                </span>
                <span className="text-[9px] text-emerald-600 mt-0.5">
                  Hanya Ganti Password
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Sistem Terlindungi Hak Akses Terpusat &bull; &copy; 2026 ACTIS ISP
        </p>
      </div>
    </div>
  );
}

