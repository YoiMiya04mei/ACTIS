"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit3, FolderClock, Loader2, Sliders, X } from "lucide-react";
import { CreateUnifiedDocumentPage } from "@/components/tools/pages/CreateUnifiedDocumentPage";
import { ToastContainer, ToastMessage } from "@/components/tools/Toast";
import { useCurrentUser } from "@/context/UserContext";
import { useSharedDocumentSync } from "@/hooks/useSharedDocumentSync";
import { SHARED_TEMPLATE_KEYS } from "@/lib/sharedDocumentKeys";
import type { RFODocument, RFOTemplate } from "@/types/rfo";
import { DEFAULT_RFO_TEMPLATE } from "@/templates/rfoTemplate";
import { storageService } from "@/services/storageService";
import type { SuratTugasDocument, SuratTugasTemplate } from "@/types/suratTugas";
import { DEFAULT_SURAT_TUGAS_TEMPLATE } from "@/types/suratTugas";
import { suratTugasStorage } from "@/services/suratTugasStorage";
import type { BeritaAcaraDocument, BeritaAcaraTemplate } from "@/types/beritaAcara";
import { DEFAULT_BERITA_ACARA_TEMPLATE } from "@/types/beritaAcara";
import { beritaAcaraStorage } from "@/services/beritaAcaraStorage";
import type { PermitBarangDocument, PermitBarangTemplate } from "@/types/permitBarang";
import { DEFAULT_PERMIT_BARANG_TEMPLATE } from "@/types/permitBarang";
import { permitBarangStorage } from "@/services/permitBarangStorage";
import type { BankPaymentVoucherDocument } from "@/types/bankPaymentVoucher";
import { bankPaymentVoucherStorage } from "@/services/bankPaymentVoucherStorage";

type DocTab = "create" | "create-st" | "create-ba" | "create-pm" | "create-bpv";

interface ActiveEditMeta {
  typeLabel: string;
  number: string;
  id: string;
}

function stripAuditAndIdentityForDuplicate<T extends object>(doc: T): T {
  return {
    ...doc,
    id: "",
    letterNumber: undefined,
    sequenceNumber: undefined,
    voucherSequence: "",
    rfoNumber: undefined,
    createdAt: "",
    updatedAt: "",
    createdBy: undefined,
    createdByName: undefined,
    createdByRole: undefined,
    lastEditedAt: undefined,
    lastEditedById: undefined,
    lastEditedByName: undefined,
    lastEditedByUsername: undefined,
    lastEditedByRole: undefined,
    editHistory: undefined,
  } as T;
}

function DocumentsRouteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";
  const [activeTab, setActiveTab] = useState<DocTab>("create-ba");

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [template, setTemplate] = useState<RFOTemplate>(DEFAULT_RFO_TEMPLATE);
  const [suratTugasTemplate, setSuratTugasTemplate] = useState<SuratTugasTemplate>(
    DEFAULT_SURAT_TUGAS_TEMPLATE
  );
  const [beritaAcaraTemplate, setBeritaAcaraTemplate] = useState<BeritaAcaraTemplate>(
    DEFAULT_BERITA_ACARA_TEMPLATE
  );
  const [permitBarangTemplate, setPermitBarangTemplate] = useState<PermitBarangTemplate>(
    DEFAULT_PERMIT_BARANG_TEMPLATE
  );

  const [editingRFO, setEditingRFO] = useState<RFODocument | null>(null);
  const [editingSuratTugas, setEditingSuratTugas] = useState<SuratTugasDocument | null>(null);
  const [editingBeritaAcara, setEditingBeritaAcara] = useState<BeritaAcaraDocument | null>(null);
  const [editingPermitBarang, setEditingPermitBarang] = useState<PermitBarangDocument | null>(null);
  const [editingBankPaymentVoucher, setEditingBankPaymentVoucher] =
    useState<BankPaymentVoucherDocument | null>(null);

  const [activeEditMeta, setActiveEditMeta] = useState<ActiveEditMeta | null>(null);
  const [resolvedParamKey, setResolvedParamKey] = useState<string>("");

  const modeParam = searchParams.get("mode");
  const typeParam = searchParams.get("type");
  const idParam = searchParams.get("id");
  const paramKey =
    (modeParam === "edit" || modeParam === "duplicate") && typeParam && idParam
      ? `${modeParam}:${typeParam}:${idParam}`
      : "";
  const isWaitingForTargetDoc = Boolean(paramKey && resolvedParamKey !== paramKey);

  const clearAllEditingStates = useCallback(() => {
    setEditingRFO(null);
    setEditingSuratTugas(null);
    setEditingBeritaAcara(null);
    setEditingPermitBarang(null);
    setEditingBankPaymentVoucher(null);
    setActiveEditMeta(null);
  }, []);

  const loadTemplates = useCallback(async () => {
    const [rfoTpl, stTpl, baTpl, pmTpl] = await Promise.all([
      storageService.getTemplate().catch(() => null),
      suratTugasStorage.getTemplate().catch(() => null),
      beritaAcaraStorage.getTemplate().catch(() => null),
      permitBarangStorage.getTemplate().catch(() => null),
    ]);
    if (rfoTpl) setTemplate((prev) => (JSON.stringify(prev) === JSON.stringify(rfoTpl) ? prev : rfoTpl));
    if (stTpl) setSuratTugasTemplate((prev) => (JSON.stringify(prev) === JSON.stringify(stTpl) ? prev : stTpl));
    if (baTpl) setBeritaAcaraTemplate((prev) => (JSON.stringify(prev) === JSON.stringify(baTpl) ? prev : baTpl));
    if (pmTpl) setPermitBarangTemplate((prev) => (JSON.stringify(prev) === JSON.stringify(pmTpl) ? prev : pmTpl));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useSharedDocumentSync(SHARED_TEMPLATE_KEYS, () => {
    loadTemplates();
  });

  const addToast = useCallback((type: ToastMessage["type"], title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load target document from archive when ?mode=edit|duplicate&type=...&id=...
  useEffect(() => {
    if (!paramKey) {
      clearAllEditingStates();
      setResolvedParamKey("");
      return;
    }

    let cancelled = false;
    const isEditMode = modeParam === "edit";

    const loadTargetDocument = async () => {
      clearAllEditingStates();

      try {
        if (typeParam === "rfo") {
          const doc = await storageService.getRFOById(idParam!);
          if (cancelled) return;
          if (!doc) {
            addToast("error", "Dokumen Tidak Ditemukan", `Arsip RFO (${idParam}) tidak ditemukan.`);
            setResolvedParamKey("");
            router.replace("/tools/documents");
            return;
          }
          setActiveTab("create");
          setEditingRFO(isEditMode ? doc : stripAuditAndIdentityForDuplicate(doc));
          if (isEditMode) {
            setActiveEditMeta({
              typeLabel: "RFO",
              number: doc.ticketNo ? `#${doc.ticketNo}` : doc.id,
              id: doc.id,
            });
          }
          setResolvedParamKey(paramKey);
          return;
        }

        if (typeParam === "surat-tugas") {
          const doc = await suratTugasStorage.getSuratTugasById(idParam!);
          if (cancelled) return;
          if (!doc) {
            addToast("error", "Dokumen Tidak Ditemukan", `Arsip Surat Tugas (${idParam}) tidak ditemukan.`);
            setResolvedParamKey("");
            router.replace("/tools/documents");
            return;
          }
          setActiveTab("create-st");
          setEditingSuratTugas(isEditMode ? doc : stripAuditAndIdentityForDuplicate(doc));
          if (isEditMode) {
            setActiveEditMeta({
              typeLabel: "Surat Tugas",
              number: doc.letterNumber || doc.id,
              id: doc.id,
            });
          }
          setResolvedParamKey(paramKey);
          return;
        }

        if (typeParam === "berita-acara") {
          const doc = await beritaAcaraStorage.getBeritaAcaraById(idParam!);
          if (cancelled) return;
          if (!doc) {
            addToast("error", "Dokumen Tidak Ditemukan", `Arsip Berita Acara (${idParam}) tidak ditemukan.`);
            setResolvedParamKey("");
            router.replace("/tools/documents");
            return;
          }
          setActiveTab("create-ba");
          setEditingBeritaAcara(isEditMode ? doc : stripAuditAndIdentityForDuplicate(doc));
          if (isEditMode) {
            setActiveEditMeta({
              typeLabel: "Berita Acara",
              number: doc.letterNumber || doc.id,
              id: doc.id,
            });
          }
          setResolvedParamKey(paramKey);
          return;
        }

        if (typeParam === "permit-barang") {
          const doc = await permitBarangStorage.getPermitBarangById(idParam!);
          if (cancelled) return;
          if (!doc) {
            addToast("error", "Dokumen Tidak Ditemukan", `Arsip Permit Barang (${idParam}) tidak ditemukan.`);
            setResolvedParamKey("");
            router.replace("/tools/documents");
            return;
          }
          setActiveTab("create-pm");
          setEditingPermitBarang(isEditMode ? doc : stripAuditAndIdentityForDuplicate(doc));
          if (isEditMode) {
            setActiveEditMeta({
              typeLabel: "Permit Barang",
              number: doc.letterNumber || doc.subject || doc.id,
              id: doc.id,
            });
          }
          setResolvedParamKey(paramKey);
          return;
        }

        if (typeParam === "bank-voucher") {
          const doc = await bankPaymentVoucherStorage.getVoucherById(idParam!);
          if (cancelled) return;
          if (!doc) {
            addToast("error", "Dokumen Tidak Ditemukan", `Arsip Payment Voucher (${idParam}) tidak ditemukan.`);
            setResolvedParamKey("");
            router.replace("/tools/documents");
            return;
          }
          setActiveTab("create-bpv");
          setEditingBankPaymentVoucher(
            isEditMode ? doc : stripAuditAndIdentityForDuplicate(doc)
          );
          if (isEditMode) {
            setActiveEditMeta({
              typeLabel: "Payment Voucher",
              number: doc.voucherNumber || doc.id,
              id: doc.id,
            });
          }
          setResolvedParamKey(paramKey);
          return;
        }

        addToast("error", "Jenis Dokumen Tidak Dikenal", `Tipe '${typeParam}' tidak valid.`);
        setResolvedParamKey("");
        router.replace("/tools/documents");
      } catch {
        if (cancelled) return;
        addToast("error", "Gagal Memuat Dokumen", "Terjadi kesalahan saat membuka dokumen arsip.");
        setResolvedParamKey("");
        router.replace("/tools/documents");
      }
    };

    loadTargetDocument();
    return () => {
      cancelled = true;
    };
  }, [paramKey, modeParam, typeParam, idParam, clearAllEditingStates, addToast, router]);

  const toolUser = currentUser
    ? {
        id: currentUser.id,
        username: currentUser.username || currentUser.email.split("@")[0],
        name: currentUser.nama,
        role: "admin" as const,
        position: currentUser.role,
        avatarColor: "from-blue-600 to-indigo-600",
        createdAt: new Date().toISOString(),
      }
    : {
        id: "default-admin",
        username: "admin",
        name: "Admin NOC",
        role: "admin" as const,
        position: "admin",
        avatarColor: "from-blue-600 to-indigo-600",
        createdAt: new Date().toISOString(),
      };

  const handleAfterDocumentSaved = (
    docLabel: string,
    wasEdit: boolean,
    editLogText: string,
    createLogText: string
  ) => {
    clearAllEditingStates();
    setResolvedParamKey("");

    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama_lengkap: currentUser?.nama || "NOC User",
        email: currentUser?.email,
        tipe: "DOCUMENT",
        aktifitas: wasEdit ? `${editLogText} (${docLabel})` : createLogText,
      }),
    }).catch(() => {});

    if (wasEdit) {
      setTimeout(() => {
        router.push("/tools/documents/history");
      }, 450);
    } else if (modeParam === "duplicate") {
      router.replace("/tools/documents");
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header & Links to History & Template */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Link
            href="/tools"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-purple-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Kembali ke Hub Tools
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Generator Dokumen & Surat Resmi NOC
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/tools/documents/history"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center transition border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <FolderClock className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Arsip Dokumen
          </Link>
          {isSuperAdmin && (
            <Link
              href="/tools/templates"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center transition border border-slate-200 dark:border-slate-700 shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Template Surat
            </Link>
          )}
        </div>
      </div>

      {/* Mode Edit Banner */}
      {activeEditMeta && (
        <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Mode Edit Dokumen Arsip &mdash; {activeEditMeta.typeLabel}{" "}
                <span className="font-mono text-blue-700 dark:text-blue-300">
                  ({activeEditMeta.number})
                </span>
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                Perubahan akan memperbarui dokumen ini secara langsung (tidak membuat file baru) dan mencatat akun{" "}
                <strong>{currentUser?.nama || toolUser.name}</strong> ke riwayat edit.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              clearAllEditingStates();
              setResolvedParamKey("");
              router.push("/tools/documents/history");
            }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal Edit &amp; Kembali ke Arsip</span>
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {isWaitingForTargetDoc ? (
          <div className="py-24 px-6 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">
              Memuat data dokumen dari arsip...
            </p>
          </div>
        ) : (
          <CreateUnifiedDocumentPage
            activeTab={activeTab}
            setActiveTab={(tab: any) => {
              if (
                tab === "create" ||
                tab === "create-st" ||
                tab === "create-ba" ||
                tab === "create-pm" ||
                tab === "create-bpv"
              ) {
                if (tab !== activeTab && paramKey) {
                  clearAllEditingStates();
                  setResolvedParamKey("");
                  router.replace("/tools/documents");
                }
                setActiveTab(tab);
              }
            }}
            template={template}
            editingRFO={editingRFO}
            onRFOSaved={() =>
              handleAfterDocumentSaved(
                activeEditMeta?.number || editingRFO?.ticketNo || editingRFO?.id || "RFO",
                Boolean(activeEditMeta || editingRFO?.id),
                "Mengedit dokumen RFO",
                "Menerbitkan Laporan Gangguan RFO"
              )
            }
            suratTugasTemplate={suratTugasTemplate}
            editingSuratTugas={editingSuratTugas}
            onSuratTugasSaved={() =>
              handleAfterDocumentSaved(
                activeEditMeta?.number || editingSuratTugas?.letterNumber || "Surat Tugas",
                Boolean(activeEditMeta || editingSuratTugas?.id),
                "Mengedit dokumen Surat Tugas",
                "Menerbitkan Surat Tugas Teknisi Resmi"
              )
            }
            beritaAcaraTemplate={beritaAcaraTemplate}
            editingBeritaAcara={editingBeritaAcara}
            onBeritaAcaraSaved={() =>
              handleAfterDocumentSaved(
                activeEditMeta?.number || editingBeritaAcara?.letterNumber || "Berita Acara",
                Boolean(activeEditMeta || editingBeritaAcara?.id),
                "Mengedit dokumen Berita Acara",
                "Menerbitkan Berita Acara Uji Terima / Aktivasi"
              )
            }
            permitBarangTemplate={permitBarangTemplate}
            editingPermitBarang={editingPermitBarang}
            onPermitBarangSaved={() =>
              handleAfterDocumentSaved(
                activeEditMeta?.number || editingPermitBarang?.letterNumber || "Permit Barang",
                Boolean(activeEditMeta || editingPermitBarang?.id),
                "Mengedit dokumen Permit Barang",
                "Menerbitkan Permit Masuk/Keluar Barang Data Center"
              )
            }
            editingBankPaymentVoucher={editingBankPaymentVoucher}
            onBankPaymentVoucherSaved={() =>
              handleAfterDocumentSaved(
                activeEditMeta?.number ||
                  editingBankPaymentVoucher?.voucherNumber ||
                  "Payment Voucher",
                Boolean(activeEditMeta || editingBankPaymentVoucher?.id),
                "Mengedit dokumen Payment Voucher",
                "Menerbitkan Bank Payment Voucher"
              )
            }
            addToast={addToast}
            currentUser={toolUser}
          />
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function DocumentsRoute() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-xs font-semibold">Menyiapkan editor dokumen...</p>
        </div>
      }
    >
      <DocumentsRouteContent />
    </Suspense>
  );
}
