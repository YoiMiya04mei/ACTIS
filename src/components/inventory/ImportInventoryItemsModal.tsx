"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  generateInventoryItemCsvTemplate,
  parseAndValidateInventoryItemsCsv,
  type CsvDelimiter,
  type NormalizedInventoryImportRow,
} from "@/lib/inventoryItemImport";

interface ImportInventoryItemsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const DELIMITER_LABEL: Record<CsvDelimiter, string> = {
  ",": "Koma (,)",
  ";": "Titik Koma (;)",
  "\t": "Tab",
};

export function ImportInventoryItemsModal({
  open,
  onClose,
  onSuccess,
}: ImportInventoryItemsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [parsedRows, setParsedRows] = useState<NormalizedInventoryImportRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverRowErrors, setServerRowErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [importing, setImporting] = useState(false);

  const resetPickerState = () => {
    setSelectedFileName(null);
    setParsedRows([]);
    setHeaderError(null);
    setServerError(null);
    setServerRowErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    if (!importing) {
      resetPickerState();
      onClose();
    }
  };

  const handleCancelEvent = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (importing) {
      e.preventDefault();
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateInventoryItemCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_import_barang.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setServerError(null);
    setServerRowErrors([]);

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const result = parseAndValidateInventoryItemsCsv(text);
      setDelimiter(result.delimiter);
      if (result.headerError) {
        setHeaderError(result.headerError);
        setParsedRows([]);
      } else {
        setHeaderError(null);
        setParsedRows(result.rows);
      }
    } catch {
      setHeaderError("Gagal membaca file CSV. Pastikan file tidak rusak dan berformat .csv UTF-8.");
      setParsedRows([]);
    }
  };

  const validRows = parsedRows.filter((row) => row._isValid);
  const invalidRows = parsedRows.filter((row) => !row._isValid);

  const handleConfirmImport = async () => {
    if (validRows.length === 0 || importing) return;

    setImporting(true);
    setServerError(null);
    setServerRowErrors([]);

    try {
      const res = await fetch("/api/inventory/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validRows }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (Array.isArray(json.errors)) {
          setServerRowErrors(json.errors);
        }
        throw new Error(json.error || "Gagal mengimpor data barang.");
      }

      const msg =
        invalidRows.length > 0
          ? `${json.message} (${invalidRows.length} baris invalid tidak ikut diimpor).`
          : json.message;

      resetPickerState();
      onSuccess(msg);
    } catch (err: any) {
      setServerError(err?.message || "Terjadi kesalahan saat mengimpor data barang.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: importing ? "none" : "closerequest" } as any)}
      onCancel={handleCancelEvent}
      onClose={handleClose}
      className="actis-dialog m-auto w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl p-0"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import Data Barang dari CSV / Excel
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mendukung pemisah koma (,), titik koma (;) Excel Indonesia, maupun Tab.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            aria-label="Tutup modal impor"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Format Kolom Header CSV:
              </span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-bold text-[11px] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template CSV
              </button>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto">
              Nama Barang, Kategori, Merek, Model, Satuan, Stok Awal, Stok Minimum, Lokasi Penyimpanan
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <p>
                &bull; Kolom wajib minimal: <code>Nama Barang</code>. Opsional tambahan:{" "}
                <code>Kode Barang</code>, <code>Serial Number</code>.
              </p>
              <p>
                &bull; Pilihan <code>Lokasi Penyimpanan</code>: <code>Gudang Pusat</code>,{" "}
                <code>Gudang Bandung</code>, <code>Gudang Gekbrong</code>.
              </p>
            </div>
          </div>

          {/* File Picker */}
          <div className="space-y-2">
            <label
              htmlFor="csv-import-file"
              className="block font-bold text-slate-700 dark:text-slate-200"
            >
              1. Pilih File CSV
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                id="csv-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={importing}
                onChange={handleSelectFile}
                className="flex-1 min-w-0 text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 dark:file:bg-blue-950/60 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 file:cursor-pointer"
              />
              {selectedFileName && (
                <button
                  type="button"
                  onClick={resetPickerState}
                  disabled={importing}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-[11px] transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Pilihan
                </button>
              )}
            </div>
          </div>

          {headerError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{headerError}</span>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 space-y-1.5"
            >
              <div className="flex items-start gap-2.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
              {serverRowErrors.length > 0 && (
                <ul className="pl-6 list-disc text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                  {serverRowErrors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>
                      Baris {err.row}: {err.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Parsed File Preview */}
          {selectedFileName && parsedRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedFileName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pemisah terdeteksi: <strong>{DELIMITER_LABEL[delimiter]}</strong> &bull; Total{" "}
                      <strong>{parsedRows.length}</strong> baris data
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {validRows.length} Siap Diimpor
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {invalidRows.length} Bermasalah
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Baris</th>
                        <th className="py-2 px-3">Kode</th>
                        <th className="py-2 px-3">Nama Barang</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3 text-right">Stok Awal</th>
                        <th className="py-2 px-3">Lokasi</th>
                        <th className="py-2 px-3">Status Cek</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.slice(0, 50).map((row) => (
                        <tr
                          key={row._rowNumber}
                          className={
                            row._isValid ? "" : "bg-rose-50/60 dark:bg-rose-950/20"
                          }
                        >
                          <td className="py-2 px-3 font-mono text-slate-500">{row._rowNumber}</td>
                          <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400">
                            {row.code || <span className="text-slate-400 italic">Otomatis</span>}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                            {row.name || "-"}
                          </td>
                          <td className="py-2 px-3">{row.category}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {row.initial_stock} {row.unit}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {row.storage_location || "-"}
                          </td>
                          <td className="py-2 px-3">
                            {row._isValid ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                Valid
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                {row._errors.join(", ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 50 && (
                  <p className="px-3 py-1.5 text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                    Menampilkan 50 baris pertama dari {parsedRows.length} baris. Seluruh baris valid tetap akan diimpor.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {validRows.length > 0
              ? `Klik tombol Import sekarang untuk memasukkan ${validRows.length} data barang ke Master Barang.`
              : "Pilih file CSV yang valid untuk mengaktifkan tombol Import."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!selectedFileName || validRows.length === 0 || importing}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              {importing
                ? "Mengimpor..."
                : validRows.length > 0
                  ? `Import File (${validRows.length} Barang)`
                  : "Import File"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
