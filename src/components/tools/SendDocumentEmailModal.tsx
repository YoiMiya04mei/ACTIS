"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  X,
  Paperclip,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  Info,
  Settings,
} from "lucide-react";
import {
  extractInvalidEmailAddresses,
  parseEmailAddressList,
  type EmailGatewayUserStatus,
} from "@/lib/emailGatewayTypes";
import {
  buildDocumentEmailDraft,
  buildDocumentEmailHtmlBody,
  type BuildDocumentEmailInput,
  type DocumentEmailDraftPayload,
} from "@/utils/documentEmailTemplates";
import type { ToastMessage } from "@/components/tools/Toast";

export interface EmailAttachmentPayload {
  filename: string;
  contentBase64: string;
  contentType: string;
}

interface SendDocumentEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftInput: BuildDocumentEmailInput;
  onGenerateAttachment?: (format: "pdf" | "xlsx") => Promise<EmailAttachmentPayload | null>;
  onSuccess?: (info: { recipients: string[]; subject: string }) => void;
  addToast?: (type: ToastMessage["type"], title: string, message?: string) => void;
}

export const SendDocumentEmailModal: React.FC<SendDocumentEmailModalProps> = ({
  isOpen,
  onClose,
  draftInput,
  onGenerateAttachment,
  onSuccess,
  addToast,
}) => {
  const [gatewayStatus, setGatewayStatus] = useState<EmailGatewayUserStatus | null>(null);
  const [canManageGateway, setCanManageGateway] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState(false);

  const [draftPreview, setDraftPreview] = useState<DocumentEmailDraftPayload>(() =>
    buildDocumentEmailDraft(draftInput)
  );
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [attachDocument, setAttachDocument] = useState(true);
  const [attachmentFormat, setAttachmentFormat] = useState<"pdf" | "xlsx">("pdf");

  const [userEditedFields, setUserEditedFields] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingStep, setSendingStep] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const draftInputRef = useRef(draftInput);
  draftInputRef.current = draftInput;
  const attachGenRef = useRef(onGenerateAttachment);
  attachGenRef.current = onGenerateAttachment;

  const applyDraftFromStatus = useCallback(
    (status: EmailGatewayUserStatus | null, forceReset = false) => {
      const nextDraft = buildDocumentEmailDraft({
        ...draftInputRef.current,
        categoryTemplates: status?.categoryTemplates,
        signatureText: status?.signatureText,
      });
      setDraftPreview(nextDraft);

      if (forceReset || !userEditedFields) {
        setToInput((prev) => (forceReset || !prev.trim() ? nextDraft.defaultRecipients : prev));
        setCcInput((prev) =>
          forceReset || !prev.trim() ? status?.defaultCc || "" : prev
        );
        setSubjectInput(nextDraft.defaultSubject);
        setBodyInput(nextDraft.defaultBodyText);
      }
    },
    [userEditedFields]
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setUserEditedFields(false);
    setAttachDocument(Boolean(attachGenRef.current));
    setAttachmentFormat("pdf");

    const initial = buildDocumentEmailDraft(draftInputRef.current);
    setDraftPreview(initial);
    setToInput(initial.defaultRecipients);
    setCcInput("");
    setSubjectInput(initial.defaultSubject);
    setBodyInput(initial.defaultBodyText);

    let cancelled = false;
    setLoadingGateway(true);
    fetch("/api/email-gateway", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && json?.status) {
          const st = json.status as EmailGatewayUserStatus;
          setGatewayStatus(st);
          setCanManageGateway(Boolean(json.canManage));
          const updatedDraft = buildDocumentEmailDraft({
            ...draftInputRef.current,
            categoryTemplates: st.categoryTemplates,
            signatureText: st.signatureText,
          });
          setDraftPreview(updatedDraft);
          setToInput((prev) => prev.trim() || updatedDraft.defaultRecipients);
          setCcInput((prev) => prev.trim() || st.defaultCc || "");
          setSubjectInput(updatedDraft.defaultSubject);
          setBodyInput(updatedDraft.defaultBodyText);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGateway(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isGatewayReady = Boolean(gatewayStatus?.enabled && gatewayStatus?.isConfigured);

  const handleResetRedaksi = () => {
    setUserEditedFields(false);
    applyDraftFromStatus(gatewayStatus, true);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isGatewayReady) {
      setErrorMsg(
        "Email Gateway SMTP belum aktif atau belum dikonfigurasi. Hubungi Administrator atau buka menu Integrasi & Sistem > Email Gateway."
      );
      return;
    }

    const recipients = parseEmailAddressList(toInput);
    const invalidTo = extractInvalidEmailAddresses(toInput);
    if (invalidTo.length > 0) {
      setErrorMsg(`Alamat email Kepada (To) tidak valid: ${invalidTo.join(", ")}`);
      return;
    }
    if (recipients.length === 0) {
      setErrorMsg("Masukkan minimal satu alamat email tujuan (Kepada).");
      return;
    }

    const invalidCc = extractInvalidEmailAddresses(ccInput);
    if (invalidCc.length > 0) {
      setErrorMsg(`Alamat email CC tidak valid: ${invalidCc.join(", ")}`);
      return;
    }

    if (!subjectInput.trim()) {
      setErrorMsg("Subjek email tidak boleh kosong.");
      return;
    }
    if (!bodyInput.trim()) {
      setErrorMsg("Kata-kata redaksi / isi email tidak boleh kosong.");
      return;
    }

    setSending(true);
    try {
      let attachment: EmailAttachmentPayload | null = null;
      if (attachDocument && onGenerateAttachment) {
        setSendingStep(
          attachmentFormat === "xlsx"
            ? "Menyiapkan lampiran Excel (.xlsx)..."
            : "Merender dokumen PDF A4 untuk lampiran..."
        );
        attachment = await onGenerateAttachment(attachmentFormat);
        if (!attachment) {
          throw new Error("Gagal membuat file lampiran dokumen.");
        }
      }

      setSendingStep("Mengirim email melalui SMTP Gateway...");
      const htmlBody = buildDocumentEmailHtmlBody({
        category: draftPreview.category,
        categoryLabel: draftPreview.categoryLabel,
        documentNumber: draftPreview.documentNumber,
        subject: subjectInput.trim(),
        bodyText: bodyInput.trim(),
      });

      const res = await fetch("/api/email-gateway/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients,
          cc: parseEmailAddressList(ccInput),
          subject: subjectInput.trim(),
          bodyText: bodyInput.trim(),
          htmlBody,
          category: draftPreview.category,
          documentNumber: draftPreview.documentNumber,
          attachmentFilename: attachment?.filename,
          attachmentBase64: attachment?.contentBase64,
          attachmentContentType: attachment?.contentType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Gagal mengirim email melalui Email Gateway.");
      }

      addToast?.(
        "success",
        "Email Berhasil Dikirim",
        `${draftPreview.categoryLabel} (${draftPreview.documentNumber}) terkirim ke ${recipients.join(", ")}.`
      );
      onSuccess?.({ recipients, subject: subjectInput.trim() });
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan saat mengirim email.";
      setErrorMsg(msg);
      addToast?.("error", "Gagal Mengirim Email", msg);
    } finally {
      setSending(false);
      setSendingStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-sky-50 via-white to-indigo-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Kirim Dokumen via Email Gateway
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 uppercase">
                  {draftPreview.categoryLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono truncate mt-0.5">
                No: {draftPreview.documentNumber} • {draftPreview.documentTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Category Redaksi Explanation Info */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold">Redaksi Penjelasan Kategori ({draftPreview.categoryLabel}): </span>
              {draftPreview.explanationSummary}
            </div>
          </div>

          {/* Gateway Status Check */}
          {loadingGateway ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              <span>Memeriksa status Email Gateway SMTP...</span>
            </div>
          ) : !isGatewayReady ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {!gatewayStatus?.isConfigured
                      ? "Email Gateway (SMTP) belum dikonfigurasi."
                      : "Email Gateway sedang dinonaktifkan."}
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    {canManageGateway
                      ? "Konfigurasikan server SMTP dan aktifkan gateway di Pengaturan Email Gateway sebelum mengirim surat."
                      : "Silakan minta Administrator untuk mengaktifkan dan mengatur SMTP di menu Integrasi & Sistem > Email Gateway."}
                  </p>
                </div>
              </div>
              {canManageGateway && (
                <Link
                  href="/settings/email-gateway"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 shadow-xs"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Atur Email Gateway</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Gateway Aktif • Pengirim:{" "}
                  <strong className="font-semibold">
                    {gatewayStatus?.fromName} &lt;{gatewayStatus?.fromEmail}&gt;
                  </strong>
                </span>
              </span>
              {canManageGateway && (
                <Link
                  href="/settings/email-gateway"
                  onClick={onClose}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline"
                >
                  Pengaturan SMTP
                </Link>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Recipients */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kepada (Email Tujuan) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={toInput}
                onChange={(e) => {
                  setUserEditedFields(true);
                  setToInput(e.target.value);
                }}
                placeholder="pelanggan@perusahaan.co.id, pic@klien.net"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Pisahkan dengan koma (,) jika mengirim ke lebih dari 1 penerima.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                CC (Opsional)
              </label>
              <input
                type="text"
                value={ccInput}
                onChange={(e) => {
                  setUserEditedFields(true);
                  setCcInput(e.target.value);
                }}
                placeholder="noc@jembatandata.com, manager@perusahaan.co.id"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Otomatis terisi Default CC dari konfigurasi SMTP jika ada.
              </p>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Subjek Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => {
                setUserEditedFields(true);
                setSubjectInput(e.target.value);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white text-slate-900"
            />
          </div>

          {/* Body Redaksi */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Kata-Kata Redaksi &amp; Penjelasan Surat <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleResetRedaksi}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Redaksi Default</span>
              </button>
            </div>
            <textarea
              rows={11}
              value={bodyInput}
              onChange={(e) => {
                setUserEditedFields(true);
                setBodyInput(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 text-xs sm:text-[13px] font-mono leading-relaxed border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50 text-slate-900"
            />
          </div>

          {/* Attachment Option */}
          {onGenerateAttachment && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={attachDocument}
                    onChange={(e) => setAttachDocument(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                      Lampirkan Dokumen Resmi Surat
                    </span>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {attachmentFormat === "xlsx" && draftPreview.suggestedExcelFilename
                        ? draftPreview.suggestedExcelFilename
                        : draftPreview.suggestedPdfFilename}
                    </p>
                  </div>
                </div>

                {draftPreview.category === "bank-voucher" && attachDocument && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setAttachmentFormat("pdf");
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                        attachmentFormat === "pdf"
                          ? "bg-sky-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setAttachmentFormat("xlsx");
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                        attachmentFormat === "xlsx"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      Excel
                    </button>
                  </div>
                )}
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            {sendingStep ? (
              <span className="inline-flex items-center gap-1.5 text-sky-700 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {sendingStep}
              </span>
            ) : (
              <span>Pastikan alamat email tujuan dan isi redaksi sudah sesuai.</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending || !isGatewayReady}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{sending ? "Mengirim..." : "Kirim Email Sekarang"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PostSaveEmailBannerProps {
  visible: boolean;
  categoryLabel: string;
  documentNumber?: string;
  onSendEmail: () => void;
  onDismiss: () => void;
}

export const PostSaveEmailBanner: React.FC<PostSaveEmailBannerProps> = ({
  visible,
  categoryLabel,
  documentNumber,
  onSendEmail,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div className="no-print fixed bottom-16 xl:bottom-6 right-4 z-[60] max-w-md w-[calc(100vw-2rem)] bg-white border border-sky-200 rounded-2xl shadow-xl shadow-sky-900/10 p-3.5 sm:p-4 flex items-start gap-3 animate-fadeIn">
      <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
        <Mail className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
          {categoryLabel} {documentNumber ? `(${documentNumber}) ` : ""}Berhasil Disimpan!
        </p>
        <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-relaxed">
          Ingin langsung mengirim surat ini beserta lampiran PDF &amp; redaksi otomatis via Email Gateway?
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <button
            type="button"
            onClick={onSendEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim via Email Sekarang</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            Nanti Saja
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
        title="Tutup"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
