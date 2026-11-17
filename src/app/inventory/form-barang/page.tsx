"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileDown,
  Printer,
  Search,
  RefreshCw,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FilePlus2,
  ZoomIn,
  ZoomOut,
  CheckSquare,
  SlidersHorizontal,
} from "lucide-react";
import { PDFService } from "@/services/pdfService";
import { FormBarangPaperDocument } from "@/components/inventory/FormBarangPaperDocument";
import {
  createEmptyFormBarangData,
  generateFormBarangPdfFileName,
  paginateFormBarangData,
  type FormBarangDocumentData,
  type FormBarangSourceListItem,
} from "@/lib/inventoryFormBarang";
import { WORK_TYPE_OPTIONS, type WorkTypeOption } from "@/lib/inventoryRequest";

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Semua Alur" },
  { value: "SEDANG_DIGUNAKAN", label: "Sedang Digunakan" },
  { value: "MENUNGGU_PENGEMBALIAN", label: "Menunggu Pengembalian" },
  { value: "SEBAGIAN_KEMBALI", label: "Sebagian Kembali" },
  { value: "SUDAH_KEMBALI", label: "Sudah Kembali" },
  { value: "REQUEST_PENDING", label: "Request Pending (Belum Keluar)" },
] as const;

function GenerateFormBarangContent() {
  const searchParams = useSearchParams();
  const initialTxId = searchParams.get("tx_id") || "";
  const initialRequestId = searchParams.get("request_id") || "";

  const [sources, setSources] = useState<FormBarangSourceListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selector filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Active selected source
  const [selectedSource, setSelectedSource] = useState<{
    type: "transaction" | "request" | "blank";
    id: string | null;
  }>(() => {
    if (initialTxId) return { type: "transaction", id: initialTxId };
    if (initialRequestId) return { type: "request", id: initialRequestId };
    return { type: "blank", id: null };
  });

  // Options fetched from backend
  const [includeSerials, setIncludeSerials] = useState(false);
  const [includePendingRemaining, setIncludePendingRemaining] = useState(false);

  // Active Document State (populated automatically from DB, editable before PDF)
  const [dbSnapshot, setDbSnapshot] = useState<FormBarangDocumentData>(() =>
    createEmptyFormBarangData()
  );
  const [docData, setDocData] = useState<FormBarangDocumentData>(() =>
    createEmptyFormBarangData()
  );

  // Preview controls
  const [previewZoom, setPreviewZoom] = useState<number>(80);
  const [previewPageTab, setPreviewPageTab] = useState<"all" | number>("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Load source list
  const fetchSourceList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: "50",
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/inventory/form-barang?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setSources(json.data);
      } else {
        setNotification({
          type: "error",
          message: json.error || "Gagal memuat daftar alur transaksi inventory.",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.message || "Gagal memuat daftar alur transaksi.",
      });
    } finally {
      setListLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSourceList();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchSourceList]);

  // Load full workflow document when selection or options change
  const loadSelectedDocument = useCallback(
    async (
      targetType: "transaction" | "request" | "blank",
      targetId: string | null,
      withSerials: boolean,
      withPending: boolean
    ) => {
      if (targetType === "blank" || !targetId) {
        const empty = createEmptyFormBarangData();
        setDbSnapshot(empty);
        setDocData(empty);
        setPreviewPageTab("all");
        return;
      }

      setDetailLoading(true);
      setNotification(null);
      try {
        const params = new URLSearchParams({
          id: targetId,
          sourceType: targetType,
          includeSerials: String(withSerials),
          includePendingRemaining: String(withPending),
          prefillPenerima: "true",
        });

        const res = await fetch(`/api/inventory/form-barang?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || "Gagal memuat detail alur Form Barang.");
        }

        const loaded: FormBarangDocumentData = json.data;
        setDbSnapshot(loaded);
        setDocData(loaded);
        setPreviewPageTab("all");
      } catch (err: any) {
        setNotification({
          type: "error",
          message: err?.message || "Gagal mengambil detail dokumen Form Barang.",
        });
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  // Auto-load initial deep-link or newest completed/active transaction once list arrives
  const [hasAutoSelected, setHasAutoSelected] = useState(
    Boolean(initialTxId || initialRequestId)
  );

  useEffect(() => {
    if (initialTxId) {
      loadSelectedDocument("transaction", initialTxId, includeSerials, includePendingRemaining);
      return;
    }
    if (initialRequestId) {
      loadSelectedDocument("request", initialRequestId, includeSerials, includePendingRemaining);
      return;
    }
    if (!hasAutoSelected && !listLoading && sources.length > 0) {
      setHasAutoSelected(true);
      const first = sources[0];
      setSelectedSource({ type: first.sourceType, id: first.id });
      loadSelectedDocument(first.sourceType, first.id, includeSerials, includePendingRemaining);
    }
  }, [
    initialTxId,
    initialRequestId,
    hasAutoSelected,
    listLoading,
    sources,
    includeSerials,
    includePendingRemaining,
    loadSelectedDocument,
  ]);

  const handleSelectItem = (item: FormBarangSourceListItem) => {
    setSelectedSource({ type: item.sourceType, id: item.id });
    loadSelectedDocument(item.sourceType, item.id, includeSerials, includePendingRemaining);
  };

  const handleUseBlankTemplate = () => {
    setHasAutoSelected(true);
    setSelectedSource({ type: "blank", id: null });
    const empty = createEmptyFormBarangData();
    setDbSnapshot(empty);
    setDocData(empty);
    setPreviewPageTab("all");
  };

  const handleToggleOption = (
    option: "serials" | "pending",
    checked: boolean
  ) => {
    const nextSerials = option === "serials" ? checked : includeSerials;
    const nextPending = option === "pending" ? checked : includePendingRemaining;
    if (option === "serials") setIncludeSerials(checked);
    if (option === "pending") setIncludePendingRemaining(checked);

    if (selectedSource.type !== "blank" && selectedSource.id) {
      loadSelectedDocument(
        selectedSource.type,
        selectedSource.id,
        nextSerials,
        nextPending
      );
    }
  };

  const handleToggleWorkType = (wt: WorkTypeOption) => {
    setDocData((prev) => {
      const exists = prev.requestInfo.workTypes.includes(wt);
      const next = exists
        ? prev.requestInfo.workTypes.filter((x) => x !== wt)
        : WORK_TYPE_OPTIONS.filter((opt) =>
            opt === wt ? true : prev.requestInfo.workTypes.includes(opt)
          );
      return {
        ...prev,
        requestInfo: {
          ...prev.requestInfo,
          workTypes: next,
        },
      };
    });
  };

  const handleDownloadPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    const prevTab = previewPageTab;
    setPreviewPageTab("all");
    setNotification({
      type: "info",
      message: "Sedang merender Form Barang ke file PDF A4...",
    });

    setTimeout(async () => {
      try {
        const pages = document.querySelectorAll<HTMLElement>(
          "#form-barang-preview-doc .form-barang-page"
        );
        const filename = generateFormBarangPdfFileName(docData);
        if (pages.length > 1) {
          await PDFService.exportMultiPagePDF(pages, filename);
        } else if (pages.length === 1) {
          await PDFService.exportSinglePagePDF(pages[0], filename);
        } else {
          throw new Error("Elemen halaman PDF tidak ditemukan.");
        }
        setNotification({
          type: "success",
          message: `PDF Form Barang berhasil diunduh: ${filename}`,
        });
      } catch (err: any) {
        console.error("Error exporting Form Barang PDF:", err);
        setNotification({
          type: "error",
          message: err?.message || "Gagal mengunduh PDF Form Barang.",
        });
      } finally {
        setExportingPdf(false);
        setPreviewPageTab(prevTab);
      }
    }, 250);
  };

  const handlePrint = () => {
    const prevTab = previewPageTab;
    setPreviewPageTab("all");
    setTimeout(() => {
      window.print();
      setPreviewPageTab(prevTab);
    }, 150);
  };

  const pageSlices = paginateFormBarangData(docData);
  const summary = docData.summary;

  return (
    <div id="form-barang-root" className="space-y-5">
      {/* Scoped print CSS so native Cetak prints ONLY the A4 Form Barang pages cleanly */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body aside,
          body header,
          body footer,
          body .no-print {
            display: none !important;
          }
          body main {
            padding: 0 !important;
            margin: 0 !important;
          }
          body main > div {
            margin: 0 !important;
            padding: 0 !important;
          }
          #form-barang-root {
            margin: 0 !important;
            padding: 0 !important;
          }
          .form-barang-preview-shell {
            background: #ffffff !important;
            border: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .form-barang-scale-wrapper {
            transform: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .form-barang-page {
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Breadcrumb & Title */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/inventory/dashboard" className="hover:underline">
              Inventory
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">
              Generate Form Barang
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#0F2B59] dark:text-blue-400" />
            <span>Generate Form Barang (PDF)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Otomatis menggabungkan alur{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              Informasi Request → Barang Keluar → Barang Terpakai → Barang Kembali / Sisa
            </strong>{" "}
            sesuai format resmi Word untuk diunduh menjadi PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUseBlankTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4 text-slate-500" />
            <span>Form Kosong</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Cetak</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || detailLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F2B59] hover:bg-blue-900 text-white text-xs font-bold shadow-md shadow-blue-950/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{exportingPdf ? "Membuat PDF..." : "Download PDF"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`no-print p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : notification.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT CONTROL PANEL */}
        <div className="no-print xl:col-span-4 space-y-4">
          {/* Card 1: Source Selector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                <span>Pilih Data Alur Inventory</span>
              </h2>
              <button
                type="button"
                onClick={fetchSourceList}
                disabled={listLoading}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Muat ulang daftar alur"
              >
                <RefreshCw className={`w-4 h-4 ${listLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari No. OUT, No. REQ, PIC, Client, Gudang..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl">
              {listLoading && sources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Memuat alur transaksi...
                </div>
              ) : sources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Belum ada data transaksi keluar / request barang yang cocok.
                </div>
              ) : (
                sources.map((item) => {
                  const isSelected =
                    selectedSource.type === item.sourceType &&
                    selectedSource.id === item.id;
                  return (
                    <button
                      key={`${item.sourceType}-${item.id}`}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-3 transition cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-blue-50/90 dark:bg-blue-950/50 border-l-4 border-l-blue-600"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.transaction_number || item.request_number}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            item.transaction_status === "SUDAH_KEMBALI"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : item.transaction_status === "MENUNGGU_PENGEMBALIAN" ||
                                  item.transaction_status === "SEBAGIAN_KEMBALI"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : item.sourceType === "request"
                                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {item.transaction_status || `REQ ${item.request_status}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-semibold truncate">{item.pic_name}</span>
                        <span className="text-slate-400 shrink-0">
                          {new Date(item.date_iso).toLocaleDateString("id-ID")}
                        </span>
                      </div>

                      {item.request_number && item.transaction_number && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                          Request: {item.request_number} • {item.location}
                        </div>
                      )}

                      {/* 4 Flow Progress Badges */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9.5px] font-semibold text-slate-700 dark:text-slate-300">
                          Keluar: {item.items_count} brg
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-[9.5px] font-semibold text-purple-700 dark:text-purple-300">
                          Terpakai: {item.used_count} brg
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Kembali: {item.returns_count} brg
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 2: Active Workflow Summary & Adjustments */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0F2B59] dark:text-blue-400" />
                <span>Penyesuaian Informasi &amp; TTD</span>
              </h2>
              {summary.sourceType !== "blank" && (
                <button
                  type="button"
                  onClick={() => setDocData(dbSnapshot)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  title="Kembalikan field ke hasil otomatis dari database"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset DB</span>
                </button>
              )}
            </div>

            {/* Workflow Status Alert */}
            {summary.sourceType === "request" && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                Request <strong>{summary.requestNumber}</strong> masih berstatus{" "}
                <strong>{summary.requestStatus}</strong>. Tabel Barang Keluar, Terpakai, dan Kembali akan terisi otomatis setelah diproses di menu Barang Keluar.
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Tim
                </label>
                <input
                  type="text"
                  value={docData.requestInfo.namaTim}
                  onChange={(e) =>
                    setDocData((p) => ({
                      ...p,
                      requestInfo: { ...p.requestInfo, namaTim: e.target.value },
                    }))
                  }
                  placeholder="Nama PIC / Tim Lapangan"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Request
                  </label>
                  <input
                    type="text"
                    value={docData.requestInfo.tanggalRequest}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        requestInfo: {
                          ...p.requestInfo,
                          tanggalRequest: e.target.value,
                        },
                      }))
                    }
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lokasi Pengembalian
                  </label>
                  <input
                    type="text"
                    value={docData.requestInfo.lokasiPengembalian}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        requestInfo: {
                          ...p.requestInfo,
                          lokasiPengembalian: e.target.value,
                        },
                      }))
                    }
                    placeholder="Gudang Pusat"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jenis Pekerjaan (Centang Otomatis / Manual)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WORK_TYPE_OPTIONS.map((wt) => (
                    <label
                      key={wt}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={docData.requestInfo.workTypes.includes(wt)}
                        onChange={() => handleToggleWorkType(wt)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>{wt}</span>
                    </label>
                  ))}
                </div>
                {docData.requestInfo.workTypes.includes("Lainnya") && (
                  <input
                    type="text"
                    value={docData.requestInfo.workTypeOther}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        requestInfo: {
                          ...p.requestInfo,
                          workTypeOther: e.target.value,
                        },
                      }))
                    }
                    placeholder="Detail pekerjaan lainnya..."
                    className="mt-1.5 w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                )}
              </div>

              {/* Opsi Sinkronisasi Baris Tabel */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeSerials}
                    onChange={(e) => handleToggleOption("serials", e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Tampilkan Serial Number (SN) di Nama Barang</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includePendingRemaining}
                    onChange={(e) => handleToggleOption("pending", e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    Sertakan sisa belum dikembalikan di Bagian C (
                    {docData.pendingRemainingRows.length} item)
                  </span>
                </label>
              </div>

              {/* Nama Penanda Tangan Persetujuan */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="font-bold text-[11px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nama Penanda Tangan (Opsional)</span>
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={docData.approval.pemohonName}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        approval: { ...p.approval, pemohonName: e.target.value },
                      }))
                    }
                    placeholder="Pemohon / SPV (kosong = titik-titik)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={docData.approval.pengelolaName}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        approval: { ...p.approval, pengelolaName: e.target.value },
                      }))
                    }
                    placeholder="Pengelola Gudang / SPV CS (kosong = titik-titik)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={docData.approval.penerimaName}
                    onChange={(e) =>
                      setDocData((p) => ({
                        ...p,
                        approval: { ...p.approval, penerimaName: e.target.value },
                      }))
                    }
                    placeholder="Penerima / PIC Tim Lapangan"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PREVIEW PANEL */}
        <div className="xl:col-span-8 space-y-3">
          {/* Preview Controls Bar */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewPageTab("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  previewPageTab === "all"
                    ? "bg-[#0F2B59] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Semua ({pageSlices.length} Hal)
              </button>
              {pageSlices.map((p) => (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => setPreviewPageTab(p.pageNumber)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    previewPageTab === p.pageNumber
                      ? "bg-[#0F2B59] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  Hal {p.pageNumber}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(55, z - 10))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Perkecil preview"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 w-10 text-center">
                {previewZoom}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(110, z + 10))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Perbesar preview"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* A4 Paper Preview Container */}
          <div className="form-barang-preview-shell bg-slate-200/75 dark:bg-slate-900/70 border border-slate-300/70 dark:border-slate-800 rounded-2xl p-4 sm:p-6 overflow-auto min-h-[680px] flex justify-center items-start">
            {detailLoading ? (
              <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                <span className="text-xs font-semibold">
                  Menarik data Request, Keluar, Terpakai &amp; Pengembalian...
                </span>
              </div>
            ) : (
              <div
                className="form-barang-scale-wrapper shrink-0"
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: "top center",
                  marginBottom: `${-((1 - previewZoom / 100) * pageSlices.length * 1123)}px`,
                }}
              >
                <FormBarangPaperDocument
                  id="form-barang-preview-doc"
                  doc={docData}
                  previewPageFilter={previewPageTab}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GenerateFormBarangPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500">
          Memuat halaman Generate Form Barang...
        </div>
      }
    >
      <GenerateFormBarangContent />
    </Suspense>
  );
}
