"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  PlusCircle,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import {
  PICKUP_LOCATION_OPTIONS,
  WORK_TYPE_OPTIONS,
  type PickupLocationOption,
  type WorkTypeOption,
  formatWorkTypeLabel,
} from "@/lib/inventoryRequest";

interface PublicCatalogItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: string;
  category_name: string | null;
}

interface RequestRow {
  rowKey: string;
  item_id: string;
  quantity: string;
  notes: string;
}

interface SubmittedReceipt {
  id: string;
  request_number: string;
  pic_name: string;
  pic_phone: string | null;
  request_date: string;
  work_type_label: string;
  pickup_location: string;
  notes: string | null;
  status: string;
  items: Array<{
    id: string;
    quantity: string | number;
    unit: string;
    notes: string | null;
    item: {
      id: string;
      code: string;
      name: string;
      unit: string;
    };
  }>;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PublicRequestBarangPage() {
  const formHeadingId = useId();
  const picNameRef = useRef<HTMLInputElement | null>(null);
  const requestDateRef = useRef<HTMLInputElement | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const [catalog, setCatalog] = useState<PublicCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form fields matching INFORMASI REQUEST specification
  const [picName, setPicName] = useState("");
  const [picPhone, setPicPhone] = useState("");
  const [requestDate, setRequestDate] = useState(getTodayDateString);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkTypeOption | "">("");
  const [workTypeOther, setWorkTypeOther] = useState("");
  const [pickupLocation, setPickupLocation] = useState<PickupLocationOption | "">("");
  const [notes, setNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([
    { rowKey: "row-1", item_id: "", quantity: "1", notes: "" },
  ]);
  const [companyWebsite, setCompanyWebsite] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/public/inventory-requests", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat daftar barang.");
      }
      setCatalog(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      setCatalogError(err?.message || "Tidak dapat memuat daftar barang gudang.");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.category_name || "").toLowerCase().includes(q)
    );
  }, [catalog, itemSearch]);

  const handleSelectWorkType = (option: WorkTypeOption) => {
    setFieldErrors((prev) => ({ ...prev, work_types: "" }));
    setSelectedWorkType(option);
    if (option !== "Lainnya") {
      setWorkTypeOther("");
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { rowKey: `row-${Date.now()}-${prev.length + 1}`, item_id: "", quantity: "1", notes: "" },
    ]);
  };

  const handleRemoveRow = (rowKey: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
  };

  const handleRowChange = (
    rowKey: string,
    field: "item_id" | "quantity" | "notes",
    value: string
  ) => {
    setFieldErrors((prev) => ({ ...prev, items: "" }));
    setRows((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row))
    );
  };

  const resetForNewRequest = () => {
    setReceipt(null);
    setPicName("");
    setPicPhone("");
    setRequestDate(getTodayDateString());
    setSelectedWorkType("");
    setWorkTypeOther("");
    setPickupLocation("");
    setNotes("");
    setRows([{ rowKey: `row-${Date.now()}`, item_id: "", quantity: "1", notes: "" }]);
    setFieldErrors({});
    setSubmitError(null);
    loadCatalog();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: Record<string, string> = {};
    if (picName.trim().length < 2) {
      nextErrors.pic_name = "Nama PIC Penerima wajib diisi (minimal 2 karakter).";
    }
    if (!requestDate) {
      nextErrors.request_date = "Tanggal Request wajib diisi.";
    }
    if (!selectedWorkType) {
      nextErrors.work_types = "Pilih 1 Jenis Pekerjaan.";
    }
    if (!pickupLocation) {
      nextErrors.pickup_location = "Lokasi Pengambilan wajib dipilih.";
    }

    const validRows = rows.filter((r) => r.item_id && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      nextErrors.items = "Pilih minimal 1 barang dan tentukan kuantitas lebih dari 0.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSubmitError("Mohon lengkapi seluruh kolom bertanda wajib sebelum mengirim request.");
      if (nextErrors.pic_name) {
        picNameRef.current?.focus();
      } else if (nextErrors.request_date) {
        requestDateRef.current?.focus();
      } else {
        errorBannerRef.current?.focus();
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/inventory-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pic_name: picName.trim(),
          pic_phone: picPhone.trim() || null,
          request_date: requestDate,
          work_types: selectedWorkType ? [selectedWorkType] : [],
          work_type_other: selectedWorkType === "Lainnya" ? workTypeOther.trim() : null,
          pickup_location: pickupLocation,
          notes: notes.trim() || null,
          company_website: companyWebsite,
          items: validRows.map((r) => ({
            item_id: r.item_id,
            quantity: Number(r.quantity),
            notes: r.notes.trim() || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.field) {
          setFieldErrors((prev) => ({ ...prev, [json.field]: json.error }));
        }
        throw new Error(json.error || "Gagal mengirim form request barang.");
      }

      setReceipt({
        ...json.data,
        work_type_label:
          json.data.work_type_label ||
          formatWorkTypeLabel(json.data.work_types, json.data.work_type_other),
      });
      setFieldErrors({});
    } catch (err: any) {
      setSubmitError(err?.message || "Terjadi kesalahan saat mengirim request.");
      errorBannerRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Title Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold tracking-wider uppercase">
            <ClipboardList className="w-3.5 h-3.5 text-sky-300" />
            Formulir Publik (Tanpa Login)
          </div>
          <h1
            id={formHeadingId}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 uppercase"
          >
            Form Request Barang Keluar
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Isi informasi request dan kebutuhan barang di bawah ini. Pengajuan akan masuk ke antrean{" "}
            <strong className="text-slate-800 dark:text-slate-200">Barang Keluar</strong> untuk
            di-ACC oleh petugas gudang.
          </p>
        </header>

        {receipt ? (
          <section
            role="status"
            aria-live="polite"
            className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                    Request Barang Berhasil Dikirim
                  </h2>
                  <p className="text-xs text-emerald-100">
                    Menunggu persetujuan (ACC) petugas di menu Barang Keluar.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-white/15 font-mono font-bold text-xs sm:text-sm">
                {receipt.request_number}
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Nama PIC Penerima
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.pic_name}
                    {receipt.pic_phone ? ` (${receipt.pic_phone})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Tanggal Request
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {new Date(receipt.request_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Jenis Pekerjaan
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.work_type_label}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    Lokasi Pengambilan
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {receipt.pickup_location}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Rincian Barang yang Diminta ({receipt.items.length} item)
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-2.5 px-4">Barang</th>
                        <th className="py-2.5 px-4 text-right">Kuantitas</th>
                        <th className="py-2.5 px-4">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {receipt.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {it.item?.name}
                            </p>
                            <span className="font-mono text-xs text-slate-500">
                              {it.item?.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                            {Number(it.quantity)} {it.unit}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                            {it.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={resetForNewRequest}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Buat Request Barang Baru
                </button>
              </div>
            </div>
          </section>
        ) : (
          <form
            action="/api/public/inventory-requests"
            method="POST"
            aria-labelledby={formHeadingId}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6"
          >
            {/* Anti-spam honeypot field hidden from screen readers and tab order */}
            <div className="absolute -left-[9999px] h-0 w-0 opacity-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="company_website">Company Website</label>
              <input
                type="text"
                id="company_website"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </div>

            {submitError && (
              <div
                ref={errorBannerRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Periksa Kembali Input Anda</p>
                  <p>{submitError}</p>
                </div>
              </div>
            )}

            {/* INFORMASI REQUEST Card matching the institutional form template */}
            <section className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#122659] text-white px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
                  INFORMASI REQUEST
                </h2>
                <span className="text-[11px] text-slate-200 font-medium">
                  Kolom bertanda <span aria-hidden="true">*</span> wajib diisi
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {/* Row 1: Nama PIC Penerima & Tanggal Request */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  <div className="p-5 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                    <label
                      htmlFor="pic_name"
                      className="text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Nama PIC Penerima <span className="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={picNameRef}
                      id="pic_name"
                      name="pic_name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      enterKeyHint="next"
                      value={picName}
                      aria-invalid={Boolean(fieldErrors.pic_name)}
                      aria-describedby={fieldErrors.pic_name ? "err-pic-name" : "hint-pic-name"}
                      onChange={(e) => {
                        setPicName(e.target.value);
                        if (fieldErrors.pic_name) setFieldErrors((p) => ({ ...p, pic_name: "" }));
                      }}
                      placeholder="Masukkan nama lengkap PIC / teknisi penerima"
                      className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    />
                    {fieldErrors.pic_name ? (
                      <p id="err-pic-name" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.pic_name}
                      </p>
                    ) : (
                      <p id="hint-pic-name" className="text-xs text-slate-500 dark:text-slate-400">
                        Nama teknisi/PIC yang akan mengambil barang di gudang.
                      </p>
                    )}

                    <div className="pt-2 flex flex-col gap-1">
                      <label
                        htmlFor="pic_phone"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        No. HP / WhatsApp PIC (Opsional)
                      </label>
                      <input
                        id="pic_phone"
                        name="pic_phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={40}
                        enterKeyHint="next"
                        value={picPhone}
                        onChange={(e) => setPicPhone(e.target.value)}
                        placeholder="Contoh: 0812xxxxxxxx"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                    <label
                      htmlFor="request_date"
                      className="text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Tanggal Request <span className="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={requestDateRef}
                      id="request_date"
                      name="request_date"
                      type="date"
                      required
                      value={requestDate}
                      aria-invalid={Boolean(fieldErrors.request_date)}
                      aria-describedby={fieldErrors.request_date ? "err-request-date" : undefined}
                      onChange={(e) => {
                        setRequestDate(e.target.value);
                        if (fieldErrors.request_date) {
                          setFieldErrors((p) => ({ ...p, request_date: "" }));
                        }
                      }}
                      className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    />
                    {fieldErrors.request_date ? (
                      <p id="err-request-date" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.request_date}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tanggal rencana pengambilan / pengajuan barang.
                      </p>
                    )}

                    <div className="pt-2 flex flex-col gap-1">
                      <label
                        htmlFor="request_notes"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Catatan Tambahan / Referensi Pekerjaan (Opsional)
                      </label>
                      <input
                        id="request_notes"
                        name="notes"
                        type="text"
                        maxLength={500}
                        enterKeyHint="next"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Misal: Nama client, cluster, atau keterangan singkat..."
                        className="w-full min-h-[44px] px-3.5 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Jenis Pekerjaan & Lokasi Pengambilan */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  <fieldset
                    aria-describedby={fieldErrors.work_types ? "err-work-types" : undefined}
                    className="p-5 space-y-3"
                  >
                    <legend className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Jenis Pekerjaan <span className="text-rose-600" aria-hidden="true">*</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {WORK_TYPE_OPTIONS.map((option) => {
                        const checked = selectedWorkType === option;
                        const inputId = `work-type-${option.toLowerCase()}`;
                        return (
                          <div
                            key={option}
                            className={`flex items-center gap-2.5 min-h-[48px] px-3 py-2 rounded-lg border transition ${
                              checked
                                ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            }`}
                          >
                            <input
                              type="radio"
                              id={inputId}
                              name="work_type"
                              value={option}
                              checked={checked}
                              required
                              onChange={() => handleSelectWorkType(option)}
                              className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                            />
                            <label
                              htmlFor={inputId}
                              className="text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer select-none flex-1 py-2 -my-2"
                            >
                              {option}
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {selectedWorkType === "Lainnya" && (
                      <div className="pt-1 flex flex-col gap-1">
                        <label
                          htmlFor="work_type_other"
                          className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Sebutkan Jenis Pekerjaan Lainnya
                        </label>
                        <input
                          id="work_type_other"
                          name="work_type_other"
                          type="text"
                          maxLength={150}
                          value={workTypeOther}
                          onChange={(e) => setWorkTypeOther(e.target.value)}
                          placeholder="Contoh: Relokasi ODP / Dismantle / Audit Lapangan"
                          className="w-full min-h-[44px] px-3 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </div>
                    )}

                    {fieldErrors.work_types && (
                      <p id="err-work-types" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.work_types}
                      </p>
                    )}
                  </fieldset>

                  <fieldset
                    aria-describedby={fieldErrors.pickup_location ? "err-pickup-location" : undefined}
                    className="p-5 space-y-3"
                  >
                    <legend className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Lokasi Pengambilan <span className="text-rose-600" aria-hidden="true">*</span>
                    </legend>
                    <div className="space-y-2.5">
                      {PICKUP_LOCATION_OPTIONS.map((loc) => {
                        const checked = pickupLocation === loc;
                        const inputId = `pickup-${loc.toLowerCase().replace(/\s+/g, "-")}`;
                        return (
                          <div
                            key={loc}
                            className={`flex items-center gap-3 min-h-[48px] px-3.5 py-2 rounded-lg border transition ${
                              checked
                                ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/30"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            }`}
                          >
                            <input
                              type="radio"
                              id={inputId}
                              name="pickup_location"
                              value={loc}
                              checked={checked}
                              required
                              onChange={() => {
                                setPickupLocation(loc);
                                if (fieldErrors.pickup_location) {
                                  setFieldErrors((p) => ({ ...p, pickup_location: "" }));
                                }
                              }}
                              className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                            />
                            <label
                              htmlFor={inputId}
                              className="text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer select-none flex-1 py-2 -my-2"
                            >
                              {loc}
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {fieldErrors.pickup_location && (
                      <p id="err-pickup-location" className="text-xs font-semibold text-rose-600">
                        {fieldErrors.pickup_location}
                      </p>
                    )}
                  </fieldset>
                </div>
              </div>
            </section>

            {/* Daftar Barang yang Diminta */}
            <section className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-sky-300" />
                  <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
                    Daftar Barang yang Diminta <span aria-hidden="true">*</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadCatalog}
                    disabled={loadingCatalog}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCatalog ? "animate-spin" : ""}`} />
                    Muat Ulang Barang
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Tambah Baris Barang
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {catalogError && (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium">
                    {catalogError}
                  </div>
                )}

                {fieldErrors.items && (
                  <p className="text-xs font-bold text-rose-600">{fieldErrors.items}</p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label
                    htmlFor="catalog-filter"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Filter Cepat Nama / Kode Barang ({filteredCatalog.length} dari {catalog.length}{" "}
                    item aktif):
                  </label>
                  <input
                    id="catalog-filter"
                    type="search"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Cari nama barang..."
                    className="sm:w-64 min-h-[40px] px-3 py-1.5 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                </div>

                <div className="space-y-3">
                  {rows.map((row, idx) => {
                    const selectedItem = catalog.find((it) => it.id === row.item_id);
                    const selectId = `item-select-${row.rowKey}`;
                    const qtyId = `item-qty-${row.rowKey}`;
                    const noteId = `item-note-${row.rowKey}`;

                    // Include already chosen item in options even if search filter excludes it
                    const rowOptions =
                      selectedItem && !filteredCatalog.some((c) => c.id === selectedItem.id)
                        ? [selectedItem, ...filteredCatalog]
                        : filteredCatalog;

                    return (
                      <div
                        key={row.rowKey}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                      >
                        <div className="md:col-span-6 flex flex-col gap-1">
                          <label
                            htmlFor={selectId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Barang #{idx + 1} <span className="text-rose-600">*</span>
                          </label>
                          <select
                            id={selectId}
                            name={`items[${idx}][item_id]`}
                            value={row.item_id}
                            onChange={(e) => handleRowChange(row.rowKey, "item_id", e.target.value)}
                            className="w-full min-h-[48px] px-3 py-2 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <option value="">
                              {loadingCatalog ? "Memuat daftar barang..." : "-- Pilih Barang --"}
                            </option>
                            {rowOptions.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({it.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-1">
                          <label
                            htmlFor={qtyId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Kuantitas ({selectedItem?.unit || "Unit"})
                          </label>
                          <input
                            id={qtyId}
                            name={`items[${idx}][quantity]`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]+(\.[0-9]+)?"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.rowKey, "quantity", e.target.value)}
                            className="w-full min-h-[48px] px-3 py-2 text-base rounded-lg border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          />
                        </div>

                        <div className="md:col-span-3 flex flex-col gap-1">
                          <label
                            htmlFor={noteId}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200"
                          >
                            Catatan Item (Opsional)
                          </label>
                          <input
                            id={noteId}
                            name={`items[${idx}][notes]`}
                            type="text"
                            maxLength={250}
                            value={row.notes}
                            onChange={(e) => handleRowChange(row.rowKey, "notes", e.target.value)}
                            placeholder="Opsional..."
                            className="w-full min-h-[48px] px-3 py-2 text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          />
                        </div>

                        <div className="md:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowKey)}
                            disabled={rows.length === 1}
                            title="Hapus baris"
                            aria-label={`Hapus baris barang ${idx + 1}`}
                            className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Pastikan nama PIC penerima, tanggal request, jenis pekerjaan, lokasi pengambilan,
                serta barang yang diminta sudah sesuai.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Mengirim Request..." : "Kirim Form Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
