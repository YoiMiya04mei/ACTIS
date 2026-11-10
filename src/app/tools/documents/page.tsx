"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FolderClock, Sliders } from "lucide-react";
import { CreateUnifiedDocumentPage } from "@/components/tools/pages/CreateUnifiedDocumentPage";
import { ToastContainer, ToastMessage } from "@/components/tools/Toast";
import { useCurrentUser } from "@/context/UserContext";
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

export default function DocumentsRoute() {
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";
  const [activeTab, setActiveTab] = useState<
    "create" | "create-st" | "create-ba" | "create-pm" | "create-bpv"
  >("create-ba");

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

  useEffect(() => {
    storageService.getTemplate().then(setTemplate).catch(() => {});
    suratTugasStorage.getTemplate().then(setSuratTugasTemplate).catch(() => {});
    beritaAcaraStorage.getTemplate().then(setBeritaAcaraTemplate).catch(() => {});
    permitBarangStorage.getTemplate().then(setPermitBarangTemplate).catch(() => {});
  }, []);

  const addToast = (type: ToastMessage["type"], title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toolUser = currentUser
    ? {
        id: currentUser.id,
        username: currentUser.email.split("@")[0],
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

      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
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
              setActiveTab(tab);
            }
          }}
          template={template}
          editingRFO={editingRFO}
          onRFOSaved={() => {
            setEditingRFO(null);
            addToast("success", "RFO Berhasil Disimpan", "Dokumen telah tersimpan di arsip.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "NOC User",
                email: currentUser?.email,
                tipe: "DOCUMENT",
                aktifitas: "Menerbitkan Laporan Gangguan RFO",
              }),
            }).catch(() => {});
          }}
          suratTugasTemplate={suratTugasTemplate}
          editingSuratTugas={editingSuratTugas}
          onSuratTugasSaved={() => {
            setEditingSuratTugas(null);
            addToast("success", "Surat Tugas Berhasil Disimpan", "Dokumen telah tersimpan di arsip.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "NOC User",
                email: currentUser?.email,
                tipe: "DOCUMENT",
                aktifitas: "Menerbitkan Surat Tugas Teknisi Resmi",
              }),
            }).catch(() => {});
          }}
          beritaAcaraTemplate={beritaAcaraTemplate}
          editingBeritaAcara={editingBeritaAcara}
          onBeritaAcaraSaved={() => {
            setEditingBeritaAcara(null);
            addToast("success", "Berita Acara Berhasil Disimpan", "Dokumen telah tersimpan di arsip.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "NOC User",
                email: currentUser?.email,
                tipe: "DOCUMENT",
                aktifitas: "Menerbitkan Berita Acara Uji Terima / Aktivasi",
              }),
            }).catch(() => {});
          }}
          permitBarangTemplate={permitBarangTemplate}
          editingPermitBarang={editingPermitBarang}
          onPermitBarangSaved={() => {
            setEditingPermitBarang(null);
            addToast("success", "Permit Barang Berhasil Disimpan", "Dokumen telah tersimpan di arsip.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "NOC User",
                email: currentUser?.email,
                tipe: "DOCUMENT",
                aktifitas: "Menerbitkan Permit Masuk/Keluar Barang Data Center",
              }),
            }).catch(() => {});
          }}
          editingBankPaymentVoucher={editingBankPaymentVoucher}
          onBankPaymentVoucherSaved={() => {
            setEditingBankPaymentVoucher(null);
            addToast("success", "Voucher Kas/Bank Berhasil Disimpan", "Dokumen telah tersimpan di arsip.");
          }}
          addToast={addToast}
          currentUser={toolUser}
        />
      </div>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
