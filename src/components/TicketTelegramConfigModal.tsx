"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  Ticket,
} from "lucide-react";

interface TicketTelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function TicketTelegramConfigModal({
  isOpen,
  onClose,
  onSaved,
}: TicketTelegramConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [chatId, setChatId] = useState("");
  const [includeSpecs, setIncludeSpecs] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setFeedback(null);
    setShowToken(false);
    setLoading(true);

    fetch("/api/orders/telegram", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json.data) {
          setBotToken(json.data.bot_token || "");
          setHasToken(Boolean(json.data.has_token));
          setChatId(json.data.chat_id || "");
          setEnabled(Boolean(json.data.enabled));
          setIncludeSpecs(json.data.include_specs !== false);
          setIncludeNotes(json.data.include_notes !== false);
        } else {
          setFeedback({
            type: "error",
            text: json?.error || "Gagal memuat konfigurasi Bot Telegram Tiket.",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeedback({
            type: "error",
            text: "Terjadi kesalahan jaringan saat memuat konfigurasi.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setFeedback(null);
    setTesting(true);
    try {
      const res = await fetch("/api/orders/telegram", {
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
        setFeedback({
          type: "error",
          text: json.error || "Gagal mengirim pesan tes ke Bot Telegram Tiket.",
        });
      } else {
        setFeedback({
          type: "success",
          text: json.message || "Pesan tes berhasil dikirim ke Telegram!",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Koneksi gagal saat mengirim pesan tes.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch("/api/orders/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          bot_token: botToken,
          chat_id: chatId,
          enabled,
          include_specs: includeSpecs,
          include_notes: includeNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedback({
          type: "error",
          text: json.error || "Gagal menyimpan pengaturan Bot Telegram Tiket.",
        });
      } else {
        if (json.data) {
          setBotToken(json.data.bot_token || "");
          setHasToken(Boolean(json.data.has_token));
          setChatId(json.data.chat_id || "");
          setEnabled(Boolean(json.data.enabled));
          setIncludeSpecs(json.data.include_specs !== false);
          setIncludeNotes(json.data.include_notes !== false);
        }
        setFeedback({
          type: "success",
          text: json.message || "Pengaturan Bot Telegram Tiket berhasil disimpan.",
        });
        onSaved?.();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Koneksi gagal saat menyimpan pengaturan.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Bot Telegram Notifikasi Tiket
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notifikasi otomatis saat tiket berstatus Completed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-sky-500 mb-2" />
              <span className="text-sm">Memuat konfigurasi Bot Tiket...</span>
            </div>
          ) : (
            <>
              {/* Isolation Banner */}
              <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/70 text-xs text-sky-800 dark:text-sky-200">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                <div>
                  <span className="font-semibold">Bot Terpisah dari ICMP Ping Monitor:</span>{" "}
                  Bot Token dan Chat ID pada menu ini berdiri sendiri dan tidak memakai atau menimpa kredensial bot alert ICMP Down/Up.
                </div>
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Aktifkan Notifikasi Tiket Selesai
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kirim laporan ke Telegram otomatis setiap tiket berubah menjadi Completed
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    enabled ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Bot Token */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Bot API Token (Khusus Tiket)
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showToken ? "Sembunyikan token" : "Tampilkan token"}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {hasToken && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Token tersimpan aman. Biarkan nilai bertanda samaran jika tidak ingin mengganti token.
                  </p>
                )}
              </div>

              {/* Chat ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Chat ID / Group ID Tujuan
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-1001234567890 atau 987654321"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dapat berupa ID Grup (diawali <code className="font-mono">-100...</code>), Channel, atau Chat pribadi.
                </p>
              </div>

              {/* Format Content Checkboxes */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Konten Pesan Tiket Selesai
                </p>
                <label className="flex items-start space-x-2.5 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeSpecs}
                    onChange={(e) => setIncludeSpecs(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    Sertakan detail teknis layanan{" "}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      (Kapasitas, IP Public/Private, VLAN, Server/Infrastruktur, SID)
                    </span>
                  </span>
                </label>

                <label className="flex items-start space-x-2.5 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    Sertakan catatan penyelesaian NOC &amp; jumlah lampiran bukti tes
                  </span>
                </label>
              </div>

              {/* Guide Accordion */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <span className="flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-sky-500" />
                    <span>Panduan Membuat Bot Telegram Khusus Tiket</span>
                  </span>
                  {showGuide ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showGuide && (
                  <ol className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside bg-white dark:bg-slate-900/60">
                    <li>
                      Buka <code className="font-mono font-semibold">@BotFather</code> di Telegram, lalu kirim perintah{" "}
                      <code className="font-mono">/newbot</code> untuk membuat bot baru khusus laporan tiket.
                    </li>
                    <li>
                      Salin <b>HTTP API Token</b> yang diberikan dan tempel pada kolom <b>Bot API Token</b> di atas.
                    </li>
                    <li>
                      Tambahkan bot tersebut ke grup tujuan notifikasi tiket (atau kirim pesan <code className="font-mono">/start</code> ke bot).
                    </li>
                    <li>
                      Masukkan ID grup/chat (bisa dicek via <code className="font-mono">@userinfobot</code> atau{" "}
                      <code className="font-mono">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>) lalu klik <b>Kirim Pesan Tes</b>.
                    </li>
                  </ol>
                )}
              </div>

              {/* Feedback */}
              {feedback && (
                <div
                  className={`flex items-start space-x-2.5 p-3.5 rounded-xl text-xs border ${
                    feedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                      : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || saving || (!botToken.trim() && !hasToken) || !chatId.trim()}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs font-semibold transition disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Kirim Pesan Tes
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={saving || testing}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

