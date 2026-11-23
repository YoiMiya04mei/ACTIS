import {
  DEFAULT_CATEGORY_EMAIL_TEMPLATES,
  DOCUMENT_CATEGORY_LABELS,
  escapeHtmlText,
  type CategoryEmailTemplateConfig,
  type DocumentEmailCategory,
} from "@/lib/emailGatewayTypes";
import type { RFODocument, RFOTemplate } from "@/types/rfo";
import type { SuratTugasDocument } from "@/types/suratTugas";
import type { BeritaAcaraDocument } from "@/types/beritaAcara";
import type { PermitBarangDocument } from "@/types/permitBarang";
import type { BankPaymentVoucherDocument } from "@/types/bankPaymentVoucher";
import { formatIndonesianDateOnly, formatIndonesianDateTime } from "@/utils/dateFormatter";
import { formatRupiahFull } from "@/utils/bankPaymentVoucherUtils";
import { generateRFOFileName } from "@/utils/slugify";
import { generateSuratTugasFileName } from "@/utils/suratTugasUtils";
import { generateBeritaAcaraFileName } from "@/utils/beritaAcaraUtils";
import { generatePermitBarangFileName } from "@/utils/permitBarangUtils";
import { generateBankPaymentVoucherFileName } from "@/utils/bankPaymentVoucherUtils";

export interface DocumentEmailDraftPayload {
  category: DocumentEmailCategory;
  categoryLabel: string;
  documentNumber: string;
  documentTitle: string;
  defaultRecipients: string;
  defaultSubject: string;
  explanationSummary: string;
  defaultBodyText: string;
  suggestedPdfFilename: string;
  suggestedExcelFilename?: string;
}

export interface BuildDocumentEmailInput {
  category: DocumentEmailCategory;
  rfo?: RFODocument;
  rfoTemplate?: RFOTemplate;
  suratTugas?: SuratTugasDocument;
  beritaAcara?: BeritaAcaraDocument;
  permitBarang?: PermitBarangDocument;
  bankVoucher?: BankPaymentVoucherDocument;
  categoryTemplates?: Partial<Record<DocumentEmailCategory, CategoryEmailTemplateConfig>>;
  signatureText?: string;
}

function formatDateRange(startDate?: string, endDate?: string): string {
  const start = formatIndonesianDateOnly(startDate);
  const end = formatIndonesianDateOnly(endDate);
  if (!endDate || start === end) return start;
  return `${start} s.d. ${end}`;
}

function getTemplateForCategory(
  category: DocumentEmailCategory,
  overrides?: Partial<Record<DocumentEmailCategory, CategoryEmailTemplateConfig>>
): CategoryEmailTemplateConfig {
  const custom = overrides?.[category];
  const def = DEFAULT_CATEGORY_EMAIL_TEMPLATES[category];
  return {
    subjectPrefix: custom?.subjectPrefix?.trim() || def.subjectPrefix,
    explanationIntro: custom?.explanationIntro?.trim() || def.explanationIntro,
    closingNote: custom?.closingNote?.trim() || def.closingNote,
    defaultRecipients: custom?.defaultRecipients?.trim() || def.defaultRecipients,
  };
}

function appendSignature(parts: string[], signatureText?: string, fallbackSigner?: string): string {
  const sig = signatureText?.trim() || fallbackSigner?.trim() || "PT Jembatan Data Pangrango — ACTIS Operations";
  return [...parts, "", "Hormat kami,", sig].join("\n");
}

export function buildDocumentEmailDraft(input: BuildDocumentEmailInput): DocumentEmailDraftPayload {
  const tpl = getTemplateForCategory(input.category, input.categoryTemplates);
  const categoryLabel = DOCUMENT_CATEGORY_LABELS[input.category];

  if (input.category === "rfo" && input.rfo) {
    const doc = input.rfo;
    const docNumber = doc.rfoNumber || doc.ticketNo || `RFO-${doc.rfoDate || "DOC"}`;
    const customerLabel = doc.customerName?.trim();
    const greetingTarget = customerLabel ? `Bapak/Ibu ${customerLabel}` : "Tim Terkait / Bapak/Ibu";
    const serviceDesc =
      doc.disruptionDescription?.trim() ||
      input.rfoTemplate?.defaultDescription ||
      "Layanan Koneksi Jaringan / Internet";
    const contactPhone = input.rfoTemplate?.contactPhone || "+62 857-9870-8612";
    const companyName = input.rfoTemplate?.companyName || "PT JEMBATAN DATA PANGRANGO";

    const lines = [
      `Yth. ${greetingTarget},`,
      "",
      tpl.explanationIntro,
      "",
      "Ringkasan Laporan RFO:",
      `- Nomor RFO / Tiket : ${docNumber}${doc.ticketNo && doc.ticketNo !== docNumber ? ` (Tiket: ${doc.ticketNo})` : ""}`,
      `- Tanggal Dokumen   : ${formatIndonesianDateOnly(doc.rfoDate)}`,
      ...(customerLabel ? [`- Pelanggan / Site  : ${customerLabel}`] : []),
      `- Layanan           : ${serviceDesc}`,
      `- Waktu Mulai       : ${formatIndonesianDateTime(doc.startTime)}`,
      `- Waktu Selesai     : ${formatIndonesianDateTime(doc.endTime)}`,
      `- Total Durasi      : ${doc.totalDuration || "-"}`,
      `- Root Cause        : ${doc.rootCause || "-"}`,
      `- Action Taken      : ${doc.actionTaken || "-"}`,
      "",
      tpl.closingNote,
      `Kontak NOC 24/7: ${contactPhone}`,
      "Dokumen resmi RFO dalam format PDF terlampir pada email ini.",
    ];

    return {
      category: "rfo",
      categoryLabel,
      documentNumber: docNumber,
      documentTitle: doc.rootCause || serviceDesc,
      defaultRecipients: tpl.defaultRecipients,
      defaultSubject: `${tpl.subjectPrefix} ${docNumber}${customerLabel ? ` - ${customerLabel}` : ""} — ${
        (doc.rootCause || "Laporan Gangguan").slice(0, 75)
      }`,
      explanationSummary:
        "Redaksi otomatis RFO menjelaskan kronologi gangguan, durasi downtime, akar permasalahan (root cause), serta tindakan pemulihan tim NOC beserta lampiran PDF resmi.",
      defaultBodyText: appendSignature(lines, input.signatureText, companyName),
      suggestedPdfFilename: generateRFOFileName(doc.rfoDate, doc.rootCause),
    };
  }

  if (input.category === "surat-tugas" && input.suratTugas) {
    const doc = input.suratTugas;
    const personnelLines =
      doc.personnel && doc.personnel.length > 0
        ? doc.personnel.map(
            (p, idx) =>
              `  ${idx + 1}. ${p.name}${p.position ? ` (${p.position})` : ""}${p.phone ? ` — Telp/WA: ${p.phone}` : ""}`
          )
        : ["  - (Belum ada data petugas)"];

    const lines = [
      `Yth. Bapak/Ibu Pengelola / Tim Terkait ${doc.visitLocation || ""},`,
      "",
      tpl.explanationIntro,
      "",
      "Detail Surat Tugas Visit:",
      `- Nomor Surat       : ${doc.letterNumber || "-"}`,
      `- Tanggal Terbit    : ${formatIndonesianDateOnly(doc.createdDate)}`,
      `- Lokasi Visit      : ${doc.visitLocation || "-"}`,
      `- Jadwal / Periode  : ${formatDateRange(doc.startDate, doc.endDate)}`,
      ...(doc.purpose?.trim() ? [`- Keperluan Visit   : ${doc.purpose.trim()}`] : []),
      "- Petugas Ditugaskan:",
      ...personnelLines,
      "",
      tpl.closingNote,
      "Dokumen Surat Tugas resmi (PDF) beserta tanda tangan penanggung jawab terlampir pada email ini.",
    ];

    return {
      category: "surat-tugas",
      categoryLabel,
      documentNumber: doc.letterNumber || "-",
      documentTitle: doc.visitLocation || "Surat Tugas Visit",
      defaultRecipients: tpl.defaultRecipients,
      defaultSubject: `${tpl.subjectPrefix} ${doc.letterNumber} — ${doc.visitLocation || "Visit Lapangan"}`,
      explanationSummary:
        "Redaksi otomatis Surat Tugas berisi tujuan lokasi visit, periode pelaksanaan, daftar personel & nomor kontak untuk mempermudah perizinan akses lokasi.",
      defaultBodyText: appendSignature(
        lines,
        input.signatureText,
        `${doc.signerName || "Nandar Munandar"} (${doc.signerPosition || "Direktur"})\n${
          doc.companyName || "PT JEMBATAN DATA PANGRANGO"
        }`
      ),
      suggestedPdfFilename: generateSuratTugasFileName(doc.letterNumber, doc.visitLocation),
    };
  }

  if (input.category === "berita-acara" && input.beritaAcara) {
    const doc = input.beritaAcara;
    const teamList =
      doc.personnel && doc.personnel.length > 0
        ? doc.personnel.map((p) => `${p.name}${p.position ? ` (${p.position})` : ""}`).join(", ")
        : "-";
    const photoCount = Array.isArray(doc.attachments) ? doc.attachments.length : 0;

    const lines = [
      `Yth. Bapak/Ibu / Tim Terkait ${doc.visitLocation || ""},`,
      "",
      tpl.explanationIntro,
      "",
      "Ringkasan Berita Acara:",
      `- Nomor Surat       : ${doc.letterNumber || "-"}`,
      `- Kepentingan       : ${doc.purpose || "-"}`,
      `- Lokasi Pekerjaan  : ${doc.visitLocation || "-"}`,
      `- Tanggal Pelaksana : ${formatDateRange(doc.startDate, doc.endDate)}`,
      `- Tim Pelaksana     : ${teamList}`,
      `- Dokumentasi Foto  : ${photoCount} foto dokumentasi terlampir dalam PDF`,
      "",
      tpl.closingNote,
      "Terlampir file PDF resmi Berita Acara beserta halaman lampiran dokumentasi.",
    ];

    return {
      category: "berita-acara",
      categoryLabel,
      documentNumber: doc.letterNumber || "-",
      documentTitle: `${doc.visitLocation || "-"} — ${doc.purpose || "Berita Acara"}`,
      defaultRecipients: tpl.defaultRecipients,
      defaultSubject: `${tpl.subjectPrefix} ${doc.letterNumber} — ${doc.purpose || "Laporan Visit"} (${
        doc.visitLocation || "-"
      })`,
      explanationSummary:
        "Redaksi otomatis Berita Acara menginformasikan ringkasan pekerjaan/uji terima lapangan, tim pelaksana, dan jumlah lampiran foto dokumentasi.",
      defaultBodyText: appendSignature(
        lines,
        input.signatureText,
        `${doc.signerName || "Nandar Munandar"} (${doc.signerPosition || "Direktur"})\n${
          doc.companyName || "PT JEMBATAN DATA PANGRANGO"
        }`
      ),
      suggestedPdfFilename: generateBeritaAcaraFileName(
        doc.letterNumber,
        doc.purpose,
        doc.visitLocation
      ),
    };
  }

  if (input.category === "permit-barang" && input.permitBarang) {
    const doc = input.permitBarang;
    const deviceLines =
      doc.devices && doc.devices.length > 0
        ? doc.devices.map(
            (d, idx) =>
              `  ${idx + 1}. ${d.name}${d.quantity ? ` (${d.quantity})` : ""}${
                d.serialNumber ? ` | S/N: ${d.serialNumber}` : ""
              }${d.notes ? ` | Ket: ${d.notes}` : ""}`
          )
        : ["  - (Tidak ada daftar perangkat)"];

    const docNumber = doc.letterNumber?.trim() || doc.subject || "PERMIT-BARANG";
    const lines = [
      `Yth. ${doc.recipientTitle || "Pihak Gedung / Tim Security"}${
        doc.recipientCity ? ` (${doc.recipientCity})` : ""
      },`,
      "",
      tpl.explanationIntro,
      "",
      "Rincian Permohonan Permit Barang:",
      ...(doc.letterNumber?.trim() ? [`- Nomor Surat       : ${doc.letterNumber.trim()}`] : []),
      `- Perihal / Subjek  : ${doc.subject || "-"}`,
      `- Jenis Aktivitas   : ${doc.activity || "-"}`,
      `- Tanggal & Waktu   : ${formatIndonesianDateOnly(doc.permitDate)} | Pukul ${doc.permitTime || "-"} WIB`,
      `- Lokasi Tujuan     : ${doc.location || "-"}`,
      `- Pemohon / PIC     : ${doc.applicantName || "-"} (${doc.applicantPosition || "PIC"} | Telp: ${
        doc.applicantPhone || "-"
      })`,
      "- Daftar Perangkat:",
      ...deviceLines,
      "",
      tpl.closingNote,
      "Surat resmi permohonan Permit Barang (PDF) terlampir bersama email ini.",
    ];

    return {
      category: "permit-barang",
      categoryLabel,
      documentNumber: docNumber,
      documentTitle: `${doc.subject || "Permit Barang"} — ${doc.location || "-"}`,
      defaultRecipients: tpl.defaultRecipients,
      defaultSubject: `${tpl.subjectPrefix}${doc.letterNumber?.trim() ? ` ${doc.letterNumber.trim()}` : ""} ${
        doc.subject || "Permit Barang"
      } — ${doc.location || "-"}`,
      explanationSummary:
        "Redaksi otomatis Permit Barang memuat permohonan izin ke pihak gedung/security, jadwal aktivitas keluar/masuk, PIC lapangan, dan daftar serial number perangkat.",
      defaultBodyText: appendSignature(
        lines,
        input.signatureText,
        `${doc.signerName || "Rio Prayoga"} (${doc.signerPosition || "Direktur"})\n${
          doc.companyName || "PT JEMBATAN DATA PANGRANGO"
        }`
      ),
      suggestedPdfFilename: generatePermitBarangFileName(
        doc.subject,
        doc.location,
        doc.permitDate || doc.createdDate
      ),
    };
  }

  // Bank Payment Voucher fallback
  const bpv = input.bankVoucher!;
  const itemsList =
    bpv.items && bpv.items.length > 0
      ? bpv.items.map(
          (item, idx) =>
            `  ${idx + 1}. ${item.description || "-"}${item.accName ? ` [${item.accName}]` : ""}: ${formatRupiahFull(
              item.amount || 0
            )}`
        )
      : ["  - (Belum ada rincian transaksi)"];

  const lines = [
    "Yth. Tim Finance / Approval / Penerima Terkait,",
    "",
    tpl.explanationIntro,
    "",
    "Ringkasan Bank Payment Voucher:",
    `- Nomor Voucher     : ${bpv.voucherNumber || "-"}`,
    `- Tanggal Voucher   : ${formatIndonesianDateOnly(bpv.voucherDate)}`,
    `- Dibayarkan Kepada : ${bpv.payTo || "-"}`,
    `- Total Nominal     : ${formatRupiahFull(bpv.totalAmount || 0)}`,
    `- Terbilang         : ${bpv.inWord || "-"}`,
    `- Rekening Tujuan   : ${bpv.bankName || "-"} — ${bpv.bankAccount || "-"} a.n. ${
      bpv.bankAccountName || bpv.payTo || "-"
    }`,
    `- Disiapkan Oleh    : ${bpv.preparedByName || "-"}`,
    "- Rincian Transaksi :",
    ...itemsList,
    "",
    tpl.closingNote,
    "Dokumen Bank Payment Voucher resmi terlampir pada email ini.",
  ];

  return {
    category: "bank-voucher",
    categoryLabel,
    documentNumber: bpv.voucherNumber || "-",
    documentTitle: `Payment Voucher — ${bpv.payTo || "-"}`,
    defaultRecipients: tpl.defaultRecipients,
    defaultSubject: `${tpl.subjectPrefix} ${bpv.voucherNumber || "-"} — ${bpv.payTo || "-"} (${formatRupiahFull(
      bpv.totalAmount || 0
    )})`,
    explanationSummary:
      "Redaksi otomatis Payment Voucher menyampaikan nominal pengajuan pembayaran, terbilang, rincian item transaksi, dan rekening bank tujuan transfer.",
    defaultBodyText: appendSignature(
      lines,
      input.signatureText,
      bpv.companyName || "PT. Jembatan Data Pangrango"
    ),
    suggestedPdfFilename: generateBankPaymentVoucherFileName(bpv, "pdf"),
    suggestedExcelFilename: generateBankPaymentVoucherFileName(bpv, "xlsx"),
  };
}

export function buildDocumentEmailHtmlBody(params: {
  category: DocumentEmailCategory;
  categoryLabel: string;
  documentNumber?: string;
  subject: string;
  bodyText: string;
}): string {
  const accentColor =
    params.category === "rfo"
      ? "#d97706"
      : params.category === "surat-tugas"
        ? "#2563eb"
        : params.category === "berita-acara"
          ? "#059669"
          : params.category === "permit-barang"
            ? "#7c3aed"
            : "#4338ca";

  const paragraphs = params.bodyText
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px 0;white-space:pre-line;">${escapeHtmlText(block)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#1e293b;margin:0;padding:20px;background-color:#f1f5f9;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
    <div style="background:${accentColor};padding:16px 24px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.9;">
        ACTIS OFFICIAL DOCUMENT GATEWAY
      </div>
      <div style="font-size:17px;font-weight:700;margin-top:4px;">
        ${escapeHtmlText(params.categoryLabel)}${
          params.documentNumber ? ` • ${escapeHtmlText(params.documentNumber)}` : ""
        }
      </div>
    </div>
    <div style="padding:24px;">
      ${paragraphs}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;font-size:11px;color:#64748b;">
      Dikirim melalui ACTIS Email Gateway • ${escapeHtmlText(params.subject)}
    </div>
  </div>
</body>
</html>`;
}
