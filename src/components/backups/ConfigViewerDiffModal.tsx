"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileCode2,
  GitCompare,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  AlertTriangle,
  Cloud,
  ExternalLink,
  ArrowRightLeft,
} from "lucide-react";
import { formatBackupSize, formatJakartaDateTime } from "@/lib/backupVendorProfiles";

interface ConfigViewerDiffModalProps {
  backupId: string | null;
  initialTab?: "view" | "diff";
  onClose: () => void;
  onConvertVendor?: (payload: {
    backupId: string;
    rawConfig: string;
    vendor: string;
    deviceName: string;
  }) => void;
}

export function ConfigViewerDiffModal({
  backupId,
  initialTab = "view",
  onClose,
  onConvertVendor,
}: ConfigViewerDiffModalProps) {
  const [tab, setTab] = useState<"view" | "diff">(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<any | null>(null);
  const [siblingBackups, setSiblingBackups] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any | null>(null);
  const [compareWithId, setCompareWithId] = useState<string>("prev");
  const [onlyChanges, setOnlyChanges] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab(initialTab);
    setCompareWithId("prev");
  }, [backupId, initialTab]);

  useEffect(() => {
    if (!backupId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/backups/records/${backupId}?compareWith=${encodeURIComponent(compareWithId)}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal memuat isi konfigurasi backup.");
        }
        setBackup(json.data.backup);
        setComparison(json.data.comparison);
        setSiblingBackups(json.data.siblingBackups || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [backupId, compareWithId]);

  const lines = useMemo(() => {
    if (!backup?.config_content) return [];
    const all = String(backup.config_content).split("\n");
    if (!searchTerm.trim()) {
      return all.map((text, idx) => ({ num: idx + 1, text }));
    }
    const q = searchTerm.toLowerCase();
    return all
      .map((text, idx) => ({ num: idx + 1, text }))
      .filter((item) => item.text.toLowerCase().includes(q));
  }, [backup, searchTerm]);

  if (!backupId) return null;

  const handleCopy = async () => {
    if (!backup?.config_content) return;
    try {
      await navigator.clipboard.writeText(backup.config_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
          <div className="min-w-0">
            <div className="flex items-center space-x-2.5">
              <FileCode2 className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                {backup ? `${backup.device.name} (${backup.device.vendor.toUpperCase()} — ${backup.device.host})` : "Memuat Config..."}
              </h2>
            </div>
            {backup && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Tanggal: <strong className="text-slate-700 dark:text-slate-200">{formatJakartaDateTime(backup.created_at)} WIB</strong></span>
                <span>Baris: <strong className="text-slate-700 dark:text-slate-200">{backup.line_count}</strong></span>
                <span>Ukuran: <strong className="text-slate-700 dark:text-slate-200">{formatBackupSize(backup.size_bytes)}</strong></span>
                <span>Tipe: <strong className="uppercase text-slate-700 dark:text-slate-200">{backup.backup_type}</strong></span>
                {backup.gdrive_status === "SYNCED" && backup.gdrive_file_url && (
                  <a
                    href={backup.gdrive_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Google Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!backup?.config_content}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Tersalin" : "Salin"}</span>
            </button>

            {backup?.status === "SUCCESS" && backup?.config_content && onConvertVendor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConvertVendor({
                    backupId: backup.id,
                    rawConfig: backup.config_content,
                    vendor: backup.device.vendor,
                    deviceName: backup.device.name,
                  });
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-200 text-xs font-bold"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Generate ke Vendor Lain</span>
              </button>
            )}

            {backup?.status === "SUCCESS" && (
              <a
                href={`/api/backups/records/${backup.id}/download`}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher & Filter Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setTab("view")}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                tab === "view"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Isi Konfigurasi</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("diff")}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                tab === "diff"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Bandingkan Perubahan (Diff)</span>
            </button>
          </div>

          {tab === "view" ? (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari baris konfigurasi (IP, VLAN, BGP, interface)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={compareWithId}
                onChange={(e) => setCompareWithId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
              >
                <option value="prev">Bandingkan dengan Backup Sebelumnya</option>
                {siblingBackups
                  .filter((s) => s.id !== backupId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatJakartaDateTime(s.created_at)} ({s.line_count} baris • {s.backup_type})
                    </option>
                  ))}
              </select>

              <label className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyChanges}
                  onChange={(e) => setOnlyChanges(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Hanya baris berubah</span>
              </label>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs">
          {loading ? (
            <div className="h-full flex items-center justify-center space-x-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memuat data konfigurasi...</span>
            </div>
          ) : error ? (
            <div className="p-6 flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : backup?.status === "FAILED" ? (
            <div className="p-6 text-rose-300 space-y-2">
              <div className="font-bold">Snapshot ini berstatus FAILED (gagal ditarik):</div>
              <pre className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 whitespace-pre-wrap">
                {backup.error_message || "Tidak ada detail error."}
              </pre>
            </div>
          ) : tab === "view" ? (
            <table className="w-full border-collapse">
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td className="p-6 text-slate-400 text-center">
                      Tidak ada baris yang cocok dengan pencarian &ldquo;{searchTerm}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.num} className="hover:bg-slate-900/80">
                      <td className="w-14 select-none text-right pr-4 pl-3 py-0.5 text-slate-500 border-r border-slate-800 align-top">
                        {line.num}
                      </td>
                      <td className="pl-4 pr-4 py-0.5 whitespace-pre text-slate-200">{line.text}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : !comparison ? (
            <div className="p-8 text-center text-slate-400">
              Belum ada backup pembanding sebelumnya untuk perangkat ini.
            </div>
          ) : (
            <div>
              <div className="sticky top-0 z-10 px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-300">
                  Pembanding: <strong>{formatJakartaDateTime(comparison.baseBackup.created_at)} WIB</strong> ({comparison.baseBackup.line_count} baris)
                </span>
                {comparison.identical ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                    Identik — Tidak Ada Perubahan
                  </span>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      +{comparison.added} Ditambah
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                      -{comparison.removed} Dihapus
                    </span>
                  </div>
                )}
              </div>

              <div className="p-2">
                {comparison.hunks.map((hunk: any, idx: number) => {
                  if (onlyChanges && !hunk.added && !hunk.removed) {
                    return null;
                  }
                  const hunkLines = String(hunk.value).replace(/\n$/, "").split("\n");
                  const rowCls = hunk.added
                    ? "bg-emerald-950/60 text-emerald-200"
                    : hunk.removed
                      ? "bg-rose-950/60 text-rose-200"
                      : "text-slate-400";
                  const prefix = hunk.added ? "+" : hunk.removed ? "-" : " ";

                  return (
                    <div key={idx}>
                      {hunkLines.map((ln: string, li: number) => (
                        <div key={li} className={`flex px-3 py-0.5 whitespace-pre ${rowCls}`}>
                          <span className="w-5 select-none shrink-0 font-bold">{prefix}</span>
                          <span>{ln}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

