"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  FolderOpen,
  HardDriveUpload,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { NativeDialog } from "@/components/dcim/NativeDialog";
import {
  SAMPLE_JUNIPER_CONFIG,
  SourceVendorFormat,
  TARGET_VENDOR_META,
  TargetVendorFormat,
  translateNetworkConfig,
} from "@/lib/configTranslator";

export interface TranslatorDeviceOption {
  id: string;
  name: string;
  vendor: string;
  host: string;
  pop_site?: string | null;
}

interface SnapshotSummaryItem {
  id: string;
  device_id: string;
  status: string;
  backup_type: string;
  file_name: string;
  created_at: string;
  device?: {
    id: string;
    name: string;
    vendor: string;
    host: string;
  };
}

interface ConfigTranslatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: TranslatorDeviceOption[];
  initialBackupId?: string | null;
  initialSourceConfig?: string | null;
  initialSourceVendor?: SourceVendorFormat;
  initialSourceDeviceName?: string | null;
  onSavedSnapshot?: () => void;
}

type PreviewTabId = "generated" | "compare" | "ir_mapping";

const PREVIEW_TABS: Array<{ id: PreviewTabId; label: string }> = [
  { id: "generated", label: "Generated Config" },
  { id: "compare", label: "Source vs Target" },
  { id: "ir_mapping", label: "IR & Mapping Interface" },
];

const SOURCE_FORMAT_OPTIONS: Array<{ value: SourceVendorFormat; label: string }> = [
  { value: "auto", label: "Deteksi Otomatis (Rekomendasi)" },
  { value: "juniper_hier", label: "Juniper Junos OS (Hierarchy { ... })" },
  { value: "juniper_set", label: "Juniper Junos OS (Flat 'set ...')" },
  { value: "mikrotik", label: "MikroTik RouterOS (.rsc)" },
  { value: "cisco_ios", label: "Cisco IOS / IOS-XE / Arista EOS" },
  { value: "huawei_vrp", label: "Huawei VRP" },
  { value: "vyos", label: "VyOS / EdgeRouter" },
];

export function ConfigTranslatorModal({
  isOpen,
  onClose,
  devices,
  initialBackupId = null,
  initialSourceConfig = null,
  initialSourceVendor = "auto",
  initialSourceDeviceName = null,
  onSavedSnapshot,
}: ConfigTranslatorModalProps) {
  const [rawConfig, setRawConfig] = useState<string>("");
  const [sourceVendor, setSourceVendor] = useState<SourceVendorFormat>("auto");
  const [targetVendor, setTargetVendor] = useState<TargetVendorFormat>("mikrotik_v7");
  const [customHostname, setCustomHostname] = useState<string>("");
  const [interfaceOverrides, setInterfaceOverrides] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<PreviewTabId>("generated");
  const tabRefs = useRef<Record<PreviewTabId, HTMLButtonElement | null>>({
    generated: null,
    compare: null,
    ir_mapping: null,
  });

  const [snapshots, setSnapshots] = useState<SnapshotSummaryItem[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [sourceFilterDeviceId, setSourceFilterDeviceId] = useState<string>("ALL");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [loadingSourceRecord, setLoadingSourceRecord] = useState(false);
  const [sourceOriginLabel, setSourceOriginLabel] = useState<string>("");

  const [saveToDeviceId, setSaveToDeviceId] = useState<string>("");
  const [saveCommandNote, setSaveCommandNote] = useState<string>("");
  const [savingToDb, setSavingToDb] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSnapshotContentById = async (recordId: string, fallbackDeviceLabel?: string) => {
    if (!recordId) return;
    setLoadingSourceRecord(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/backups/records/${recordId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat isi file backup sumber.");
      }
      const recordObj = json?.data?.backup || json?.data || json?.backup || json;
      const content =
        typeof recordObj?.config_content === "string" ? recordObj.config_content : "";
      if (!content.trim()) {
        throw new Error("Snapshot backup ini tidak memiliki isi konfigurasi teks.");
      }

      setRawConfig(content);
      setInterfaceOverrides({});
      setCustomHostname("");
      const devName =
        recordObj?.device?.name || fallbackDeviceLabel || initialSourceDeviceName || "";
      const fileLabel = recordObj?.file_name || recordId;
      setSourceOriginLabel(devName ? `${devName} (${fileLabel})` : fileLabel);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memuat snapshot backup sumber.",
      });
    } finally {
      setLoadingSourceRecord(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setCopied(false);
    setSourceVendor(initialSourceVendor || "auto");
    setInterfaceOverrides({});
    setCustomHostname("");
    setActiveTab("generated");

    if (initialSourceConfig && initialSourceConfig.trim()) {
      setRawConfig(initialSourceConfig);
      setSelectedSnapshotId(initialBackupId || "");
      setSourceOriginLabel(
        initialSourceDeviceName
          ? `Dari viewer: ${initialSourceDeviceName}`
          : "Dari viewer snapshot backup"
      );
    } else if (initialBackupId) {
      setSelectedSnapshotId(initialBackupId);
      void loadSnapshotContentById(initialBackupId, initialSourceDeviceName || undefined);
    } else {
      setSelectedSnapshotId("");
      setSourceOriginLabel("");
    }

    let cancelled = false;
    const fetchSnapshotsList = async () => {
      setLoadingSnapshots(true);
      try {
        const res = await fetch("/api/backups?limit=150", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json.success && Array.isArray(json.data?.backups)) {
          const successOnly = (json.data.backups as SnapshotSummaryItem[]).filter(
            (b) => b.status === "SUCCESS"
          );
          setSnapshots(successOnly);
        }
      } catch {
        // Daftar snapshot opsional; input file/paste tetap bisa dipakai
      } finally {
        if (!cancelled) setLoadingSnapshots(false);
      }
    };

    void fetchSnapshotsList();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialBackupId, initialSourceConfig, initialSourceVendor, initialSourceDeviceName]);

  const filteredSnapshots = useMemo(() => {
    if (sourceFilterDeviceId === "ALL") return snapshots;
    return snapshots.filter((s) => s.device_id === sourceFilterDeviceId);
  }, [snapshots, sourceFilterDeviceId]);

  const translation = useMemo(() => {
    if (!rawConfig.trim()) return null;
    return translateNetworkConfig(rawConfig, {
      sourceVendor,
      targetVendor,
      customHostname: customHostname.trim() || undefined,
      interfaceMap: interfaceOverrides,
    });
  }, [rawConfig, sourceVendor, targetVendor, customHostname, interfaceOverrides]);

  const handleLoadSampleJuniper = () => {
    setSourceVendor("auto");
    setRawConfig(SAMPLE_JUNIPER_CONFIG);
    setSelectedSnapshotId("");
    setInterfaceOverrides({});
    setCustomHostname("");
    setSourceOriginLabel("Contoh Juniper Junos OS (CORE-JNP-CYBER1)");
    setFeedback({
      type: "success",
      text: "Contoh konfigurasi Juniper berhasil dimuat dan otomatis diterjemahkan.",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawConfig(text);
      setSourceVendor("auto");
      setSelectedSnapshotId("");
      setInterfaceOverrides({});
      setCustomHostname("");
      setSourceOriginLabel(`File lokal: ${file.name}`);
      setFeedback({
        type: "success",
        text: `File '${file.name}' (${text.split(/\r?\n/).length} baris) berhasil dimuat.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Gagal membaca isi file konfigurasi dari komputer.",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleCopyOutput = async () => {
    if (!translation?.generatedConfig) return;
    try {
      await navigator.clipboard.writeText(translation.generatedConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: "error", text: "Gagal menyalin teks ke clipboard browser." });
    }
  };

  const handleDownloadSingleFile = () => {
    if (!translation?.generatedConfig) return;
    const blob = new Blob([translation.generatedConfig], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = translation.suggestedFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZipAll = async () => {
    if (!rawConfig.trim()) return;
    setDownloadingZip(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/backups/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawConfig,
          sourceVendor,
          mode: "zip_all",
          customHostname: customHostname.trim() || undefined,
          interfaceMap: interfaceOverrides,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Gagal men-generate bundle ZIP multi-vendor.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `multi_vendor_configs_${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        text: `Bundle ZIP 9 format vendor berhasil di-generate & diunduh (${filename}).`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal men-generate ZIP.",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleSaveToTargetDevice = async () => {
    if (!translation?.generatedConfig || !saveToDeviceId) return;
    setSavingToDb(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/backups/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawConfig,
          sourceVendor,
          targetVendor,
          mode: "single",
          customHostname: customHostname.trim() || undefined,
          interfaceMap: interfaceOverrides,
          saveToDeviceId,
          saveCommandNote: saveCommandNote.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan hasil generate ke perangkat tujuan.");
      }

      const devObj = devices.find((d) => d.id === saveToDeviceId);
      setFeedback({
        type: "success",
        text: `Konfigurasi ${translation.targetMeta.label} berhasil disimpan sebagai snapshot backup baru ke perangkat '${devObj?.name || saveToDeviceId}'.`,
      });
      onSavedSnapshot?.();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan snapshot.",
      });
    } finally {
      setSavingToDb(false);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % PREVIEW_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + PREVIEW_TABS.length) % PREVIEW_TABS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = PREVIEW_TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = PREVIEW_TABS[nextIdx];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  const targetKeys = Object.keys(TARGET_VENDOR_META) as TargetVendorFormat[];

  return (
    <NativeDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="config-translator-title"
      maxWidthClass="max-w-7xl"
    >
      <div className="flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="config-translator-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate"
              >
                Auto-Generate Backup Config Multi-Vendor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Konversi file backup Juniper, MikroTik, Cisco, Huawei, VyOS ke format perangkat vendor lain secara otomatis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog generator konfigurasi"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {feedback && (
            <div
              role="status"
              className={`rounded-xl px-4 py-2.5 border text-xs font-medium flex items-center justify-between gap-3 ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-[11px] font-bold underline shrink-0"
              >
                Tutup
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT PANEL: Source & Target Controls */}
            <div className="xl:col-span-5 space-y-4">
              {/* Source Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>1. Konfigurasi Backup Sumber</span>
                  </h3>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleLoadSampleJuniper}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/20 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Contoh Juniper</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-500/20 transition-colors"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>Upload File</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".conf,.rsc,.cfg,.txt,.log"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {rawConfig.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setRawConfig("");
                          setSelectedSnapshotId("");
                          setSourceOriginLabel("");
                          setInterfaceOverrides({});
                          setCustomHostname("");
                        }}
                        title="Kosongkan editor sumber"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white text-[11px] font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Pick existing snapshot from ACTIS database */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="translator-source-device-filter"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Filter Perangkat Sumber
                    </label>
                    <select
                      id="translator-source-device-filter"
                      value={sourceFilterDeviceId}
                      onChange={(e) => setSourceFilterDeviceId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="ALL">Semua Perangkat ({snapshots.length})</option>
                      {devices.map((dev) => (
                        <option key={dev.id} value={dev.id}>
                          {dev.name} ({dev.vendor.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="translator-source-snapshot-select"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Ambil Snapshot Database {loadingSnapshots ? "(Memuat...)" : ""}
                    </label>
                    <select
                      id="translator-source-snapshot-select"
                      value={selectedSnapshotId}
                      disabled={loadingSourceRecord}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSnapshotId(val);
                        if (val) {
                          const snap = snapshots.find((s) => s.id === val);
                          void loadSnapshotContentById(val, snap?.device?.name);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 disabled:opacity-60"
                    >
                      <option value="">-- Pilih riwayat backup SUCCESS --</option>
                      {filteredSnapshots.map((snap) => (
                        <option key={snap.id} value={snap.id}>
                          {snap.device?.name ? `${snap.device.name} · ` : ""}
                          {snap.file_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {sourceOriginLabel && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">
                      Sumber aktif: <strong className="text-slate-700 dark:text-slate-200">{sourceOriginLabel}</strong>
                    </span>
                  </p>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="translator-raw-source"
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-400"
                    >
                      Isi File Config Sumber (Paste / Edit langsung)
                    </label>
                    {loadingSourceRecord && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Memuat...
                      </span>
                    )}
                  </div>
                  <textarea
                    id="translator-raw-source"
                    rows={8}
                    value={rawConfig}
                    onChange={(e) => {
                      setRawConfig(e.target.value);
                      if (selectedSnapshotId) setSelectedSnapshotId("");
                    }}
                    placeholder={`Tempel isi backup Juniper (hierarchy / set), MikroTik (.rsc), Cisco (.cfg), Huawei VRP, atau VyOS di sini...\n\nAtau klik "Contoh Juniper" di atas untuk simulasi instan.`}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Source Vendor Override & Detected Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label
                      htmlFor="translator-source-vendor-select"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Format Vendor Sumber
                    </label>
                    <select
                      id="translator-source-vendor-select"
                      value={sourceVendor}
                      onChange={(e) => setSourceVendor(e.target.value as SourceVendorFormat)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                    >
                      {SOURCE_FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="translator-custom-hostname"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Override Hostname Tujuan (Opsional)
                    </label>
                    <input
                      id="translator-custom-hostname"
                      type="text"
                      value={customHostname}
                      onChange={(e) => setCustomHostname(e.target.value)}
                      placeholder={translation?.ir.hostname || "Sesuai config sumber"}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Target Vendor Picker Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    <span>2. Pilih Target Vendor Hasil Generate</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {targetKeys.length} Vendor Tersedia
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {targetKeys.map((tv) => {
                    const meta = TARGET_VENDOR_META[tv];
                    const selected = targetVendor === tv;
                    return (
                      <button
                        key={tv}
                        type="button"
                        onClick={() => setTargetVendor(tv)}
                        aria-pressed={selected}
                        className={`text-left px-3 py-2 rounded-xl border transition-all ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/30"
                            : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{meta.shortLabel}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              selected
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            .{meta.fileExt}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                  <strong className="text-slate-800 dark:text-slate-200">
                    {TARGET_VENDOR_META[targetVendor].label}:
                  </strong>{" "}
                  {TARGET_VENDOR_META[targetVendor].description}
                </p>
              </div>

              {/* Save to target ACTIS device card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <HardDriveUpload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>3. Simpan Hasil ke Perangkat Backup (DB & GDrive)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="translator-save-device"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Perangkat Tujuan
                    </label>
                    <select
                      id="translator-save-device"
                      value={saveToDeviceId}
                      onChange={(e) => setSaveToDeviceId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">-- Pilih perangkat tujuan --</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.vendor.toUpperCase()} · {d.host})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="translator-save-note"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Catatan Snapshot (Opsional)
                    </label>
                    <input
                      id="translator-save-note"
                      type="text"
                      value={saveCommandNote}
                      onChange={(e) => setSaveCommandNote(e.target.value)}
                      placeholder="Mis: Migrasi Juniper -> MikroTik"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!translation || !saveToDeviceId || savingToDb}
                  onClick={handleSaveToTargetDevice}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition-colors"
                >
                  {savingToDb ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {savingToDb
                      ? "Menyimpan Snapshot..."
                      : "Simpan Config Hasil Generate ke Perangkat Tujuan"}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Output Preview, Comparison & IR Mapping */}
            <div className="xl:col-span-7 flex flex-col min-h-[560px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
              {/* Top Detection & Stats Bar */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
                {translation ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                        {translation.sourceLabel}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-bold">
                        {translation.targetMeta.label}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono ml-1">
                        host: {translation.ir.hostname}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {translation.stats.interfaces} IF
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {translation.stats.ipAddresses} IP
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {translation.stats.vlans} VLAN
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                        {translation.stats.staticRoutes} Route
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                        {translation.stats.bgpNeighbors} BGP · {translation.stats.ospfEntries} OSPF
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Menunggu input konfigurasi sumber untuk memulai auto-generate...
                  </p>
                )}
              </div>

              {/* Accessible WAI-ARIA Tablist (shape/underline + color, NO aria-controls, hidden panels) */}
              <div
                role="tablist"
                aria-label="Mode pratinjau hasil konversi konfigurasi"
                className="flex items-center gap-1 px-4 pt-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-x-auto"
              >
                {PREVIEW_TABS.map((tab, idx) => {
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el;
                      }}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(e) => handleTabKeyDown(e, idx)}
                      className={`px-3.5 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-lg ${
                        isSelected
                          ? "border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-black"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold"
                      }`}
                    >
                      {tab.label}
                      {tab.id === "ir_mapping" && translation && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">
                          {translation.interfaceMapping.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* TAB PANEL 1: Generated Output */}
              <div
                role="tabpanel"
                aria-label="Generated Config"
                hidden={activeTab !== "generated"}
                className={
                  activeTab === "generated"
                    ? "flex-1 flex flex-col min-h-0 p-4 space-y-3"
                    : "hidden"
                }
              >
                {translation ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {translation.suggestedFileName} ({translation.stats.outputLines} baris)
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopyOutput}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{copied ? "Tersalin" : "Salin Script"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadSingleFile}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download .{translation.targetMeta.fileExt}</span>
                        </button>
                      </div>
                    </div>

                    {translation.ir.warnings.length > 0 && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Catatan Konversi ({translation.ir.warnings.length})</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-amber-800/90 dark:text-amber-200/90 space-y-0.5">
                          {translation.ir.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <pre className="flex-1 min-h-[360px] max-h-[470px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11.5px] leading-relaxed text-emerald-300 whitespace-pre">
                      {translation.generatedConfig}
                    </pre>
                  </>
                ) : (
                  <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-400 flex items-center justify-center">
                      <FileCode2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Belum Ada Konfigurasi Sumber
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pilih snapshot backup dari database, unggah file konfigurasi, tempel teks backup, atau klik tombol <strong>Contoh Juniper</strong> di sebelah kiri untuk langsung men-generate script multi-vendor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadSampleJuniper}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coba Contoh Backup Juniper Sekarang</span>
                    </button>
                  </div>
                )}
              </div>

              {/* TAB PANEL 2: Side-by-side Compare */}
              <div
                role="tabpanel"
                aria-label="Source vs Target"
                hidden={activeTab !== "compare"}
                className={
                  activeTab === "compare"
                    ? "flex-1 flex flex-col min-h-0 p-4 space-y-3"
                    : "hidden"
                }
              >
                {translation ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[420px]">
                    <div className="flex flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span>SOURCE ({translation.sourceLabel})</span>
                        <span className="font-mono text-slate-500">
                          {translation.ir.rawLineCount} baris
                        </span>
                      </div>
                      <pre className="flex-1 max-h-[440px] overflow-auto bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre">
                        {rawConfig}
                      </pre>
                    </div>

                    <div className="flex flex-col min-h-0 rounded-xl border border-blue-200 dark:border-blue-900 overflow-hidden">
                      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900 text-[11px] font-bold text-blue-800 dark:text-blue-200 flex items-center justify-between">
                        <span>TARGET ({translation.targetMeta.label})</span>
                        <span className="font-mono">{translation.stats.outputLines} baris</span>
                      </div>
                      <pre className="flex-1 max-h-[440px] overflow-auto bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300 whitespace-pre">
                        {translation.generatedConfig}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-16">
                    Masukkan konfigurasi sumber untuk melihat perbandingan side-by-side.
                  </p>
                )}
              </div>

              {/* TAB PANEL 3: IR & Custom Interface Mapping */}
              <div
                role="tabpanel"
                aria-label="IR and Mapping Interface"
                hidden={activeTab !== "ir_mapping"}
                className={
                  activeTab === "ir_mapping"
                    ? "flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]"
                    : "hidden"
                }
              >
                {translation ? (
                  <>
                    {/* Editable Interface Mapping Table */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                            Pemetaan Nama Interface ({translation.sourceLabel} →{" "}
                            {translation.targetMeta.shortLabel})
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Ubah nama port fisik tujuan sesuai hardware router Anda; script output diperbarui seketika.
                          </p>
                        </div>
                        {Object.keys(interfaceOverrides).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setInterfaceOverrides({})}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reset Mapping</span>
                          </button>
                        )}
                      </div>

                      {translation.interfaceMapping.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500">
                          Tidak ada interface L3/L2 terdeteksi pada konfigurasi sumber.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {translation.interfaceMapping.map((item) => (
                            <div
                              key={item.sourceBase}
                              className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-950"
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                                  {item.sourceBase}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <input
                                type="text"
                                aria-label={`Target interface untuk ${item.sourceBase}`}
                                value={interfaceOverrides[item.sourceBase] ?? item.targetBase}
                                onChange={(e) =>
                                  setInterfaceOverrides((prev) => ({
                                    ...prev,
                                    [item.sourceBase]: e.target.value,
                                  }))
                                }
                                className="w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Parsed System & Topology IR Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 text-xs">
                        <h4 className="font-black text-slate-800 dark:text-slate-100">
                          System & Services (IR)
                        </h4>
                        <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                          <div>
                            Hostname: <span className="font-mono font-bold">{translation.ir.hostname}</span>
                          </div>
                          <div>
                            Domain: <span className="font-mono">{translation.ir.domainName || "-"}</span>
                          </div>
                          <div>
                            Timezone: <span className="font-mono">{translation.ir.timeZone || "-"}</span>
                          </div>
                          <div>
                            DNS:{" "}
                            <span className="font-mono">
                              {translation.ir.dnsServers.join(", ") || "-"}
                            </span>
                          </div>
                          <div>
                            NTP:{" "}
                            <span className="font-mono">
                              {translation.ir.ntpServers.join(", ") || "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 text-xs">
                        <h4 className="font-black text-slate-800 dark:text-slate-100">
                          Routing & VLAN (IR)
                        </h4>
                        <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                          <div>
                            VLAN:{" "}
                            <span className="font-mono">
                              {translation.ir.vlans.length > 0
                                ? translation.ir.vlans
                                    .map((v) => `${v.vlanId}${v.name ? `(${v.name})` : ""}`)
                                    .join(", ")
                                : "-"}
                            </span>
                          </div>
                          <div>
                            Static Routes:{" "}
                            <span className="font-mono">{translation.ir.staticRoutes.length}</span>
                          </div>
                          <div>
                            BGP AS:{" "}
                            <span className="font-mono">
                              {translation.ir.bgp.localAsn || "-"} ({translation.ir.bgp.neighbors.length}{" "}
                              peer)
                            </span>
                          </div>
                          <div>
                            OSPF Router-ID:{" "}
                            <span className="font-mono">
                              {translation.ir.ospf.routerId || "-"} ({translation.ir.ospf.interfaces.length}{" "}
                              iface)
                            </span>
                          </div>
                          <div>
                            Prefix-Lists:{" "}
                            <span className="font-mono">
                              {translation.ir.prefixLists.map((p) => p.name).join(", ") || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-16">
                    Belum ada konfigurasi sumber untuk menampilkan tabel Intermediate Representation & mapping interface.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Parsing & konversi berjalan lokal di aplikasi tanpa mengirim credential router ke layanan AI eksternal.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!rawConfig.trim() || downloadingZip}
              onClick={handleDownloadZipAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 disabled:opacity-50 disabled:pointer-events-none text-xs font-bold transition-colors"
            >
              {downloadingZip ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileArchive className="w-3.5 h-3.5" />
              )}
              <span>Download Bundle Semua Vendor (.zip)</span>
            </button>

            <button
              type="button"
              disabled={!translation}
              onClick={handleDownloadSingleFile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                Download {translation ? translation.targetMeta.shortLabel : "Config"}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </NativeDialog>
  );
}

