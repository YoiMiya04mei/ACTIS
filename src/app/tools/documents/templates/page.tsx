"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FolderClock, FileText, ShieldAlert } from "lucide-react";
import { TemplatePage } from "@/components/tools/pages/TemplatePage";
import { ToastContainer, ToastMessage } from "@/components/tools/Toast";
import { useCurrentUser } from "@/context/UserContext";
import type { RFOTemplate } from "@/types/rfo";
import { DEFAULT_RFO_TEMPLATE } from "@/templates/rfoTemplate";
import { storageService } from "@/services/storageService";
import type { SuratTugasTemplate } from "@/types/suratTugas";
import { DEFAULT_SURAT_TUGAS_TEMPLATE } from "@/types/suratTugas";
import { suratTugasStorage } from "@/services/suratTugasStorage";
import type { BeritaAcaraTemplate } from "@/types/beritaAcara";
import { DEFAULT_BERITA_ACARA_TEMPLATE } from "@/types/beritaAcara";
import { beritaAcaraStorage } from "@/services/beritaAcaraStorage";
import type { PermitBarangTemplate } from "@/types/permitBarang";
import { DEFAULT_PERMIT_BARANG_TEMPLATE } from "@/types/permitBarang";
import { permitBarangStorage } from "@/services/permitBarangStorage";

export default function DocumentTemplatesRoute() {
  const { currentUser } = useCurrentUser();
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

  // Role Guard: Only Super Admin (admin)
  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4 animate-fadeIn">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
            Super Admin Only
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-1">
            Akses Ditolak / Terbatas
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Pengaturan <strong>Template Surat, Kop Dokumen & Tanda Tangan</strong> hanya dapat dikelola oleh akun dengan peran <strong>Super Admin (Head of NOC / Admin)</strong>. Akun Anda saat ini ({currentUser.nama}) tidak memiliki izin akses untuk fitur ini.
        </p>
        <div className="pt-2 flex justify-center">
          <Link
            href="/tools/documents"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition shadow-xs flex items-center"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Kembali ke Dokumen & Surat
          </Link>
        </div>
      </div>
    );
  }

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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Link
            href="/tools/documents"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-purple-600 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Kembali ke Buat Surat
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Pengaturan Template Kop Surat & Tanda Tangan
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/tools/documents"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center transition border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Buat Surat
          </Link>
          <Link
            href="/tools/documents/history"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center transition border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <FolderClock className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Arsip Dokumen
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <TemplatePage
          template={template}
          onUpdateTemplate={async (t) => {
            setTemplate(t);
            await storageService.saveTemplate(t);
            addToast("success", "Template RFO Tersimpan", "Perubahan template berhasil diperbarui.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "Super Admin",
                email: currentUser?.email,
                tipe: "DOCUMENT_GENERATE",
                aktifitas: "Memperbarui Template Kop Surat & TTD RFO",
                detail: `Perusahaan: ${t.companyName || "-"}`,
              }),
            }).catch(() => {});
          }}
          suratTugasTemplate={suratTugasTemplate}
          onUpdateSuratTugasTemplate={async (st) => {
            setSuratTugasTemplate(st);
            await suratTugasStorage.saveTemplate(st);
            addToast("success", "Template Surat Tugas Tersimpan", "Perubahan template berhasil diperbarui.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "Super Admin",
                email: currentUser?.email,
                tipe: "DOCUMENT_GENERATE",
                aktifitas: "Memperbarui Template Kop Surat & TTD Surat Tugas",
                detail: `Perusahaan: ${st.companyName || "-"}`,
              }),
            }).catch(() => {});
          }}
          beritaAcaraTemplate={beritaAcaraTemplate}
          onUpdateBeritaAcaraTemplate={async (ba) => {
            setBeritaAcaraTemplate(ba);
            await beritaAcaraStorage.saveTemplate(ba);
            addToast("success", "Template Berita Acara Tersimpan", "Perubahan template berhasil diperbarui.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "Super Admin",
                email: currentUser?.email,
                tipe: "DOCUMENT_GENERATE",
                aktifitas: "Memperbarui Template Kop Surat & TTD Berita Acara",
                detail: `Perusahaan: ${ba.companyName || "-"}`,
              }),
            }).catch(() => {});
          }}
          permitBarangTemplate={permitBarangTemplate}
          onUpdatePermitBarangTemplate={async (pm) => {
            setPermitBarangTemplate(pm);
            await permitBarangStorage.saveTemplate(pm);
            addToast("success", "Template Permit Barang Tersimpan", "Perubahan template berhasil diperbarui.");
            fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nama_lengkap: currentUser?.nama || "Super Admin",
                email: currentUser?.email,
                tipe: "DOCUMENT_GENERATE",
                aktifitas: "Memperbarui Template Kop Surat & TTD Permit Keluar/Masuk Barang",
                detail: `Perusahaan: ${pm.companyName || "-"}`,
              }),
            }).catch(() => {});
          }}
          addToast={addToast}
          currentUser={toolUser}
        />
      </div>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
