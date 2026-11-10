"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  X,
  FileText,
  RefreshCw,
  ArrowRight,
  Database,
  Radio,
  Check,
  Info,
} from "lucide-react";
import {
  parseAndValidatePopSiteCsv,
  generatePopSiteCsvTemplate,
  PopSiteImportRow,
} from "@/lib/popSiteImportService";

interface ImportPopSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportPopSiteModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportPopSiteModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");

  const [parsedData, setParsedData] = useState<{
    rows: PopSiteImportRow[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    headers: string[];
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created_count: number;
    updated_count: number;
    skipped_count: number;
    errors: string[];
    site_ids: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  // Handle Download Template
  const handleDownloadTemplate = () => {
    try {
      const csv = generatePopSiteCsvTemplate();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "template_import_pop_site.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback via server API
      window.open("/api/pop-sites/import", "_blank");
    }
  };

  // Handle File Input
  const processFile = async (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      alert("Format file tidak didukung. Harap unggah file .csv");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const result = parseAndValidatePopSiteCsv(text);
    setParsedData(result);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Paste CSV Input Change
  const handlePasteChange = (text: string) => {
    setCsvText(text);
    if (text.trim().length > 0) {
      const result = parseAndValidatePopSiteCsv(text);
      setParsedData(result);
    } else {
      setParsedData(null);
    }
    setImportResult(null);
  };

  // Reset State
  const handleReset = () => {
    setParsedData(null);
    setCsvText("");
    setFileName(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit Import
  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.validRows === 0) return;

    setIsSubmitting(true);
    try {
      // Filter out invalid rows before sending
      const validRows = parsedData.rows.filter((r) => r._isValid);

      const res = await fetch("/api/pop-sites/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sites: validRows,
          mode: duplicateMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengimport data.");
      }

      setImportResult(data.data);
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat memproses import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishAndClose = () => {
    handleReset();
    onClose();
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Import & Migrasi Data POP Site
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase">
                  Batch CSV
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unggah file CSV untuk mengimport dan memigrasikan master inventaris POP Site beserta sirkuit dan monitoringnya.
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 dark:text-slate-300 text-sm">
          {/* Banner Informasi & Download Template */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                  Format File & Aturan Migrasi
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Kolom <span className="font-bold text-emerald-700 dark:text-emerald-300">Nama PIC</span> wajib diisi. Kolom <span className="font-semibold text-slate-700 dark:text-slate-300">Site ID</span> opsional (akan otomatis di-generate berurutan jika kosong). Jika <span className="font-semibold text-slate-700 dark:text-slate-300">IP Public</span> diisi, monitoring ICMP Ping otomatis dibuatkan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold shadow-sm transition shrink-0"
            >
              <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
              Unduh Template CSV
            </button>
          </div>

          {/* Jika Sudah Selesai Import: Tampilkan Hasil */}
          {importResult ? (
            <div className="space-y-4 py-4 animate-fadeIn">
              {/* Banner Status Dinamis */}
              {(() => {
                const totalSuccess = importResult.created_count + importResult.updated_count;
                const hasErrors = importResult.errors.length > 0;

                if (totalSuccess === 0 && hasErrors) {
                  return (
                    <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                        <AlertTriangle className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                        Import Menemukan Kendala
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                        Data belum berhasil disimpan karena terdapat kendala validasi pada baris di bawah. Silakan periksa catatan error.
                      </p>
                    </div>
                  );
                }

                if (totalSuccess > 0 && hasErrors) {
                  return (
                    <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">
                        Sebagian Data Berhasil Dimigrasikan!
                      </h3>
                      <p className="text-xs text-blue-700 dark:text-blue-300 max-w-md mx-auto">
                        {totalSuccess} data berhasil diproses ke database, namun terdapat {importResult.errors.length} baris yang memiliki catatan error.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                      Migrasi POP Site Berhasil Diselesaikan!
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                      Seluruh data valid telah tersimpan di database master POP Site, riwayat tiket aktivasi awal telah diterbitkan, dan monitoring ICMP Ping telah otomatis diaktifkan.
                    </p>
                  </div>
                );
              })()}

              {/* Stat Card Hasil */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-xs text-slate-500 font-medium">Data Baru Dibuat</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {importResult.created_count}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-xs text-slate-500 font-medium">Data Diperbarui</span>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {importResult.updated_count}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-xs text-slate-500 font-medium">Dilewati (Skip)</span>
                  <div className="text-2xl font-black text-slate-500 dark:text-slate-400 mt-1">
                    {importResult.skipped_count}
                  </div>
                </div>
              </div>

              {/* List Error Jika Ada */}
              {importResult.errors.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                  <div className="flex items-center text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                    Peringatan / Catatan Baris ({importResult.errors.length}):
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tabs: Upload File vs Paste Text */}
              {!parsedData && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("file")}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                        activeTab === "file"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Unggah File CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("paste")}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                        activeTab === "paste"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Tempel Teks CSV (Copy-Paste)
                    </button>
                  </div>

                  {activeTab === "file" ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition ${
                        isDragging
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/20"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <Upload className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Klik untuk memilih file CSV atau drag & drop file ke sini
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Format didukung: File CSV standar (.csv) atau teks (.txt) dipisah koma/titik koma
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Tempelkan Data CSV dari Excel atau Notepad:
                      </label>
                      <textarea
                        value={csvText}
                        onChange={(e) => handlePasteChange(e.target.value)}
                        placeholder="Site ID,Nama PIC,Kontak PIC,Layanan,VLAN ID,Infrastruktur,Media Koneksi,Server BRAS,IP Public,IP Private...&#10;POP-202611-0005,HANYA,08123456789,100Mbps,3005,METRONEXIA,SFP,CIANJUR (GEKBRONG),103.97.111.1,192.168.1.1/31..."
                        rows={7}
                        className="w-full text-xs font-mono p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Preview & Validasi Data */}
              {parsedData && (
                <div className="space-y-4 animate-fadeIn">
                  {/* File & Statistic Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        {fileName || "Data CSV Siap Diimport"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                          ✓ {parsedData.validRows} Siap Diimport
                        </span>
                        {parsedData.invalidRows > 0 && (
                          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                            ✕ {parsedData.invalidRows} Bermasalah
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          (Total {parsedData.totalRows} baris)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-300 text-xs font-bold shadow-sm transition"
                      >
                        Ganti File
                      </button>
                    </div>
                  </div>

                  {/* Mode Duplikasi */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Opsi Duplikasi Site ID:
                    </span>
                    <div className="flex items-center space-x-4 text-xs">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="dupMode"
                          checked={duplicateMode === "skip"}
                          onChange={() => setDuplicateMode("skip")}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-600 dark:text-slate-300">
                          Lewati jika Site ID sudah ada (Skip)
                        </span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="dupMode"
                          checked={duplicateMode === "update"}
                          onChange={() => setDuplicateMode("update")}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          Perbarui data jika Site ID sudah ada (Update)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Tabel Preview Baris */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 sticky top-0 uppercase tracking-wider text-[10px] font-black border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Site ID</th>
                            <th className="py-2.5 px-3">Nama PIC</th>
                            <th className="py-2.5 px-3">Layanan</th>
                            <th className="py-2.5 px-3">VLAN</th>
                            <th className="py-2.5 px-3">IP Public</th>
                            <th className="py-2.5 px-3">Server / BRAS</th>
                            <th className="py-2.5 px-3">Status Layanan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {parsedData.rows.map((row) => (
                            <tr
                              key={row._rowNumber}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                                !row._isValid ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                              }`}
                            >
                              <td className="py-2 px-3 font-mono text-slate-400">
                                {row._rowNumber}
                              </td>
                              <td className="py-2 px-3">
                                {row._isValid ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3 mr-1" />
                                    Valid
                                  </span>
                                ) : (
                                  <span
                                    title={row._errors.join(", ")}
                                    className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/70 px-2 py-0.5 rounded-full cursor-help"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Error
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {row.site_id ? (
                                  row.site_id
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-sans">
                                    (Auto Generate)
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {row.nama_pic || (
                                    <span className="text-rose-500 font-normal italic">
                                      Wajib diisi!
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {row.layanan_dedicated || "100Mbps"}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {row.vlan ? (
                                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                                    {row.vlan}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {row.ip_public ? (
                                  <div>
                                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                      {row.ip_public}
                                    </span>
                                    <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-sans font-bold">
                                      ● ICMP Ping
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                {row.server || "CIANJUR (GEKBRONG)"}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    row.status_layanan === "Isolir"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : row.status_layanan === "Terminated"
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }`}
                                >
                                  {row.status_layanan || "Active"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {importResult ? "Tutup" : "Batal"}
          </button>

          {importResult ? (
            <button
              type="button"
              onClick={handleFinishAndClose}
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition hover:scale-[1.02]"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Selesai & Muat Ulang Tabel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!parsedData || parsedData.validRows === 0 || isSubmitting}
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Memproses Import ({parsedData?.validRows || 0} Data)...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-1.5" />
                  Mulai Import ({parsedData?.validRows || 0} Data Valid)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

