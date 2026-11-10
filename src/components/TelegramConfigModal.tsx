"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Bell,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelegramConfigModal({ isOpen, onClose }: TelegramConfigModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [botToken, setBotToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [notifDown, setNotifDown] = useState(true);
  const [notifUp, setNotifUp] = useState(true);

  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchConfig = async () => {
      setLoading(true);
      setAlertMessage(null);
      try {
        const res = await fetch("/api/monitoring/telegram");
        const json = await res.json();
        if (json.success && json.data) {
          setBotToken(json.data.bot_token || "");
          setHasToken(Boolean(json.data.has_token));
          setChatId(json.data.chat_id || "");
          setEnabled(Boolean(json.data.enabled));
          setNotifDown(json.data.notif_down !== false);
          setNotifUp(json.data.notif_up !== false);
        }
      } catch (err: any) {
        setAlertMessage({
          type: "error",
          text: err.message || "Gagal memuat pengaturan Telegram.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setAlertMessage(null);

    try {
      const res = await fetch("/api/monitoring/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          bot_token: botToken,
          chat_id: chatId,
          enabled,
          notif_down: notifDown,
          notif_up: notifUp,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan pengaturan.");
      }

      setAlertMessage({
        type: "success",
        text: "Pengaturan Bot Telegram berhasil disimpan!",
      });
      setHasToken(Boolean(json.data?.has_token));
    } catch (err: any) {
      setAlertMessage({
        type: "error",
        text: err.message || "Terjadi kesalahan saat menyimpan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setAlertMessage(null);

    try {
      const res = await fetch("/api/monitoring/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          bot_token: botToken,
          chat_id: chatId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
            "Pesan tes gagal terkirim. Pastikan Bot Token dan Chat ID valid, serta Bot sudah dimasukkan ke dalam grup/chat Anda."
        );
      }

      setAlertMessage({
        type: "success",
        text: "Pesan tes berhasil dikirim ke Telegram! Periksa chat atau grup Telegram Anda sekarang.",
      });
    } catch (err: any) {
      setAlertMessage({
        type: "error",
        text: err.message || "Gagal mengirim pesan tes.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Integrasi Bot Telegram
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 uppercase">
                  Alert Ping
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notifikasi otomatis saat status ICMP ping Timeout / DOWN dan Pulih (UP).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 dark:text-slate-300 text-sm">
          {alertMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start space-x-2.5 animate-fadeIn ${
                alertMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              }`}
            >
              {alertMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{alertMessage.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
              <p>Memuat konfigurasi Telegram...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Toggle Aktifkan */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm block">
                    Status Notifikasi Telegram
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kirim pesan ke Telegram saat terjadi perubahan status ping host
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Bot Token Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Telegram Bot Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder={hasToken ? "Biarkan kosong jika tidak ingin mengubah token" : "Contoh: 7123456789:AAH..."}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-sky-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Diperoleh saat membuat bot di Telegram melalui <b>@BotFather</b>.
                </p>
              </div>

              {/* Chat ID / Group ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chat ID / Group ID Target <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Contoh: -1001234567890 (Grup) atau 987654321 (Personal)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ID grup NOC atau akun Anda (gunakan bot seperti <b>@getidsbot</b> atau <b>@userinfobot</b> untuk melihat ID).
                </p>
              </div>

              {/* Pilihan Event Notifikasi */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Kirim Notifikasi Ketika:
                </span>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={notifDown}
                      onChange={(e) => setNotifDown(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 accent-rose-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      🔴 <b>Host Timeout / DOWN</b> (Kirim alert darurat saat ping terputus)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={notifUp}
                      onChange={(e) => setNotifUp(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      🟢 <b>Host Pulih / UP (Recovery)</b> (Kirim notifikasi saat sirkuit kembali online)
                    </span>
                  </label>
                </div>
              </div>

              {/* Panduan Singkat Dropdown */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="flex items-center justify-between w-full text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    Panduan Membuat Bot & Mengambil Chat ID
                  </span>
                  <span>{showGuide ? "▲ Sembunyikan" : "▼ Lihat Cara"}</span>
                </button>

                {showGuide && (
                  <div className="mt-2.5 p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 text-[11px] text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed animate-fadeIn">
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>
                        Buka Telegram, cari akun resmi <b>@BotFather</b> lalu ketik perintah <code>/newbot</code>.
                      </li>
                      <li>
                        Beri nama bot dan username (misal: <code>MyActisNocBot</code>), lalu salin <b>API Token</b> yang diberikan.
                      </li>
                      <li>
                        Buat grup Telegram untuk tim NOC (atau chat personal), lalu <b>masukkan Bot tersebut ke dalam grup</b>.
                      </li>
                      <li>
                        Untuk mendapatkan <b>Chat ID</b> grup, undang bot <b>@getidsbot</b> atau kirim pesan sembarang ke grup, lalu cek ID grup (biasanya bernilai negatif seperti <code>-100xxxxxxxxx</code>).
                      </li>
                      <li>
                        Pastikan Bot dijadikan <b>Admin</b> di grup jika grup tersebut memiliki pembatasan pesan.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || (!botToken && !hasToken) || !chatId}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-sky-600" />
                Menguji Koneksi...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                Kirim Pesan Tes
              </>
            )}
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition hover:scale-[1.02] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Simpan Pengaturan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

