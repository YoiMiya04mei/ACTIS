"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import { useDialog } from "@/context/DialogContext";
import {
  FileSpreadsheet,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Server,
  Layers,
  Clock,
  ShieldCheck,
  Code,
} from "lucide-react";

interface SyncLog {
  id: string;
  order_id?: string | null;
  event: string;
  payload: string;
  status: string;
  response_message?: string | null;
  created_at: string;
}

export default function AdminSyncPage() {
  const { currentUser } = useCurrentUser();
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [totalSuccess, setTotalSuccess] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Trigger states
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [forceSyncResult, setForceSyncResult] = useState<any>(null);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Copy sample payload state
  const [copiedPayload, setCopiedPayload] = useState(false);

  const samplePayloadJson = JSON.stringify(
    {
      event: "PROGRESS_UPDATE",
      ticket_number: "ACT-20261102-0012",
      nama_pic: "PT Sinar Logistik (PIC: Pak Danu)",
      vlan: 1420,
      media_koneksi: "Metro Telkom",
      sid: "TELKOM-METRO-9812",
      status: "In Progress",
      updated_by: "Budi Santoso (NOC)",
      progress_note: "Konfigurasi BGP Peer & Routing table verifikasi done.",
      timestamp: "2026-11-02 14:15:00",
      test_result_links: [
        "https://storage.isp.com/actis/tests/test_001.png",
      ],
    },
    null,
    2
  );

  const fetchSyncStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sync/sheets");
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookUrl(data.webhook_url || "");
        setIsConfigured(data.is_configured);
        setTotalSuccess(data.total_success || 0);
        setTotalFailed(data.total_failed || 0);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Error fetching sync status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  // Handle Save Webhook URL
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUrl(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "GOOGLE_APPS_SCRIPT_WEBHOOK_URL",
          value: webhookUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan URL webhook.");
      }

      setSaveMessage("URL Webhook Google Apps Script berhasil disimpan!");
      fetchSyncStatus();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      void alertDialog(err.message || "Gagal menyimpan URL");
    } finally {
      setIsSavingUrl(false);
    }
  };

  // Handle Manual Force Sync to Sheets
  const handleForceSync = async () => {
    if (!(await confirmDialog("Jalankan Force Sync seluruh antrean tiket ke Google Spreadsheet?"))) return;

    setIsForceSyncing(true);
    setForceSyncResult(null);

    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggered_by: currentUser.nama,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Force sync gagal.");
      }

      setForceSyncResult(data);
      fetchSyncStatus();
    } catch (err: any) {
      void alertDialog(err.message || "Gagal memproses sync");
    } finally {
      setIsForceSyncing(false);
    }
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(samplePayloadJson);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Secondary Mirror Engine
            </span>
            <span className="text-xs text-slate-500 font-medium">Asynchronous Non-blocking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 flex items-center">
            <FileSpreadsheet className="w-7 h-7 mr-3 text-emerald-600" />
            Google Spreadsheet Dual-Backend Mirroring
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Konfigurasi webhook, monitor sinkronisasi Sheet 1 (`Aktivasi_POP_Site`) & Sheet 2 (`NOC_Progress_Audit`), dan manual Force Sync.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchSyncStatus()}
            className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-300 shadow-sm transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            onClick={handleForceSync}
            disabled={isForceSyncing}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition hover:scale-[1.02] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isForceSyncing ? "animate-spin" : ""}`} />
            {isForceSyncing ? "Syncing..." : "Force Sync to Sheets"}
          </button>
        </div>
      </div>

      {/* Force Sync Banner Result */}
      {forceSyncResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start space-x-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{forceSyncResult.message}</p>
            <p className="text-xs text-emerald-700 mt-1">
              Total tiket: {forceSyncResult.summary?.total} &bull; Berhasil: {forceSyncResult.summary?.synced}
            </p>
          </div>
        </div>
      )}

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Status Endpoint Webhook
          </span>
          <div className="flex items-center space-x-2 mt-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <p className="text-base font-bold text-slate-900">
              {isConfigured ? "Live Webhook Terkoneksi" : "Simulasi / Default Test Mode"}
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isConfigured
              ? "Payload dikirim langsung ke Google Apps Script."
              : "Mode demo lokal: Disimpan di audit log ACTIS tanpa melempar network exception."}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Sinkronisasi Berhasil
          </span>
          <p className="text-2xl font-black text-emerald-600 mt-2">{totalSuccess}</p>
          <p className="text-xs text-slate-500 mt-1">Total event mutasi berhasil dikirim</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Kendala Jaringan / Gagal
          </span>
          <p className="text-2xl font-black text-rose-600 mt-2">{totalFailed}</p>
          <p className="text-xs text-slate-500 mt-1">Gunakan Force Sync untuk retry</p>
        </div>
      </div>

      {/* Webhook Configuration Form */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
              Konfigurasi URL Google Apps Script Webhook
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              URL Web App yang diperoleh dari menu Deploy &gt; New Deployment di Google Sheets Apps Script.
            </p>
          </div>
        </div>

        {saveMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
            {saveMessage}
          </div>
        )}

        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div>
            <label htmlFor="webhook_url" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Google Apps Script Webhook URL (doPost)
            </label>
            <input
              type="url"
              id="webhook_url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-sm outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-500">
              File skrip backend lengkap tersedia di direktori: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">google-apps-script/Code.gs</code>
            </p>
            <button
              type="submit"
              disabled={isSavingUrl}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
            >
              {isSavingUrl ? "Menyimpan..." : "Simpan URL"}
            </button>
          </div>
        </form>
      </div>

      {/* Dual Sheet Architecture Info & Sample Payload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sheet Structure Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center">
            <Layers className="w-5 h-5 mr-2 text-indigo-600" />
            Struktur Dual-Sheet Spreadsheet
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <span className="font-bold text-blue-900 block text-sm">
                1. Sheet `Aktivasi_POP_Site` (Primary Row per Ticket)
              </span>
              <p className="text-blue-800 mt-1 leading-relaxed">
                Menyimpan 1 baris untuk setiap tiket aktivasi. Ketika status, parameter, atau log order diperbarui di ACTIS, baris terkait dicari berdasarkan <code className="font-bold">ticket_number</code> dan di-update secara dinamis (in-place).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="font-bold text-emerald-900 block text-sm">
                2. Sheet `NOC_Progress_Audit` (Append-Only Log)
              </span>
              <p className="text-emerald-800 mt-1 leading-relaxed">
                Menyimpan seluruh riwayat update berkala dan status perubahan tim NOC secara berurutan waktu (append-only) untuk integritas audit trail compliance ISP.
              </p>
            </div>
          </div>
        </div>

        {/* JSON Payload Compatibility Example */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6 space-y-3 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center text-slate-200">
              <Code className="w-4 h-4 mr-2 text-emerald-400" />
              Format Payload JSON Webhook
            </h3>
            <button
              onClick={copyPayload}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center transition"
            >
              {copiedPayload ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy JSON
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[220px]">
            {samplePayloadJson}
          </pre>
        </div>
      </div>

      {/* Sync Dispatch Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-blue-600" />
              Riwayat Pengiriman Webhook Sinkronisasi (Log Terkini)
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan log mutasi event ke Google Spreadsheet secara realtime.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{logs.length} Log</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Belum ada log sinkronisasi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Respon / Pesan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {new Date(log.created_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                      {log.event}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-md">
                      {log.response_message || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

