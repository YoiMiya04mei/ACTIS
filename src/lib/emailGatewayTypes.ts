export type DocumentEmailCategory =
  | "rfo"
  | "surat-tugas"
  | "berita-acara"
  | "permit-barang"
  | "bank-voucher";

export type EmailEncryptionMode = "tls" | "ssl" | "none";

export interface CategoryEmailTemplateConfig {
  subjectPrefix: string;
  explanationIntro: string;
  closingNote: string;
  defaultRecipients: string;
}

export interface EmailGatewayPublicConfig {
  enabled: boolean;
  isConfigured: boolean;
  smtpHost: string;
  smtpPort: number;
  encryption: EmailEncryptionMode;
  smtpUser: string;
  hasPassword: boolean;
  passwordMasked: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  defaultCc: string;
  signatureText: string;
  rejectUnauthorized: boolean;
  categoryTemplates: Record<DocumentEmailCategory, CategoryEmailTemplateConfig>;
  updatedAt: string | null;
  updatedBy: string | null;
  source: "database" | "env" | "unconfigured";
}

export interface EmailGatewayUserStatus {
  enabled: boolean;
  isConfigured: boolean;
  fromName: string;
  fromEmail: string;
  defaultCc: string;
  signatureText: string;
  categoryTemplates: Record<DocumentEmailCategory, CategoryEmailTemplateConfig>;
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentEmailCategory, string> = {
  rfo: "Reason For Outage (RFO)",
  "surat-tugas": "Surat Tugas Visit",
  "berita-acara": "Berita Acara Visit",
  "permit-barang": "Permit Keluar / Masuk Barang",
  "bank-voucher": "Bank Payment Voucher",
};

export const DEFAULT_CATEGORY_EMAIL_TEMPLATES: Record<
  DocumentEmailCategory,
  CategoryEmailTemplateConfig
> = {
  rfo: {
    subjectPrefix: "[RFO Resmi]",
    explanationIntro:
      "Bersama email ini kami sampaikan Laporan Resmi Reason For Outage (RFO) sebagai penjelasan teknis mengenai kronologi gangguan layanan, akar permasalahan (root cause), serta langkah penanganan dan pemulihan yang telah dilakukan oleh tim NOC.",
    closingNote:
      "Apabila diperlukan penjelasan teknis tambahan atau klarifikasi lanjutan, silakan membalas email ini atau menghubungi tim NOC kami yang bertugas 24/7.",
    defaultRecipients: "",
  },
  "surat-tugas": {
    subjectPrefix: "[Surat Tugas Visit]",
    explanationIntro:
      "Bersama email ini kami kirimkan Surat Tugas resmi penugasan personel teknis/lapangan untuk pelaksanaan kegiatan kunjungan/visit pada lokasi dan jadwal yang tercantum dalam lampiran dokumen.",
    closingNote:
      "Mohon bantuan koordinasi akses lokasi dan perizinan kepada tim petugas kami yang tertera pada Surat Tugas terlampir.",
    defaultRecipients: "",
  },
  "berita-acara": {
    subjectPrefix: "[Berita Acara Visit]",
    explanationIntro:
      "Bersama email ini kami sampaikan Berita Acara resmi sebagai laporan dokumentasi hasil pelaksanaan pekerjaan, instalasi, pemeliharaan, atau uji terima lapangan yang telah diselesaikan oleh tim teknis kami.",
    closingNote:
      "Mohon dokumen Berita Acara terlampir dapat ditinjau dan disimpan sebagai arsip resmi penyelesaian pekerjaan.",
    defaultRecipients: "",
  },
  "permit-barang": {
    subjectPrefix: "[Izin / Permit Barang]",
    explanationIntro:
      "Bersama email ini kami mengajukan surat Permohonan Izin (Permit) Keluar/Masuk Barang beserta rincian daftar perangkat, nomor seri, jadwal pelaksanaan, dan identitas PIC yang bertanggung jawab.",
    closingNote:
      "Mohon persetujuan serta bantuan fasilitasi akses keluar/masuk perangkat oleh tim gedung/security sesuai jadwal yang tertera.",
    defaultRecipients: "",
  },
  "bank-voucher": {
    subjectPrefix: "[Payment Voucher]",
    explanationIntro:
      "Bersama email ini kami sampaikan dokumen Bank Payment Voucher (BPV) sebagai pemberitahuan pengajuan dan rincian transaksi pembayaran beserta informasi rekening tujuan yang terlampir.",
    closingNote:
      "Mohon dapat diproses sesuai prosedur persetujuan keuangan dan konfirmasi apabila pembayaran telah direalisasikan.",
    defaultRecipients: "",
  },
};

export const DOCUMENT_EMAIL_CATEGORIES: readonly DocumentEmailCategory[] = [
  "rfo",
  "surat-tugas",
  "berita-acara",
  "permit-barang",
  "bank-voucher",
] as const;

const EMAIL_ADDRESS_REGEX =
  /^[^\s@<>()[\]\\,;:\"]+@[^\s@<>()[\]\\,;:\"]+\.[^\s@<>()[\]\\,;:\"]{2,}$/;

export function isValidEmailAddress(value: string): boolean {
  const clean = value.trim();
  if (!clean || clean.length > 254) return false;
  if (/[\r\n]/.test(clean)) return false;
  return EMAIL_ADDRESS_REGEX.test(clean);
}

/**
 * Splits comma/semicolon-separated email list into unique trimmed addresses.
 * Deliberately does NOT split on CR/LF so injected newline headers are rejected by email validation.
 */
export function splitEmailTokens(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : raw.split(/[,;]+/);
  return items.map((s) => s.trim()).filter(Boolean);
}

/**
 * Returns only valid, deduplicated email addresses from a raw recipient string or array.
 */
export function parseEmailAddressList(raw: string | string[] | null | undefined): string[] {
  const tokens = splitEmailTokens(raw);
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const token of tokens) {
    // Support "Display Name <user@domain.com>" style as well as plain email
    const bracketMatch = token.match(/<([^<>]+)>$/);
    const emailPart = bracketMatch ? bracketMatch[1].trim() : token;
    if (!isValidEmailAddress(emailPart)) continue;
    const key = emailPart.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(emailPart);
  }
  return valid;
}

export function extractInvalidEmailAddresses(
  raw: string | string[] | null | undefined
): string[] {
  const tokens = splitEmailTokens(raw);
  const invalid: string[] = [];
  for (const token of tokens) {
    const bracketMatch = token.match(/<([^<>]+)>$/);
    const emailPart = bracketMatch ? bracketMatch[1].trim() : token;
    if (!isValidEmailAddress(emailPart)) {
      invalid.push(token);
    }
  }
  return invalid;
}

export function sanitizeEmailHeader(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtmlText(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeCategoryTemplates(
  raw: unknown
): Record<DocumentEmailCategory, CategoryEmailTemplateConfig> {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = {} as Record<DocumentEmailCategory, CategoryEmailTemplateConfig>;

  for (const cat of DOCUMENT_EMAIL_CATEGORIES) {
    const def = DEFAULT_CATEGORY_EMAIL_TEMPLATES[cat];
    const item =
      source[cat] && typeof source[cat] === "object"
        ? (source[cat] as Record<string, unknown>)
        : {};
    result[cat] = {
      subjectPrefix:
        typeof item.subjectPrefix === "string" && item.subjectPrefix.trim()
          ? sanitizeEmailHeader(item.subjectPrefix)
          : def.subjectPrefix,
      explanationIntro:
        typeof item.explanationIntro === "string" && item.explanationIntro.trim()
          ? item.explanationIntro.trim()
          : def.explanationIntro,
      closingNote:
        typeof item.closingNote === "string" && item.closingNote.trim()
          ? item.closingNote.trim()
          : def.closingNote,
      defaultRecipients:
        typeof item.defaultRecipients === "string"
          ? parseEmailAddressList(item.defaultRecipients).join(", ")
          : def.defaultRecipients,
    };
  }

  return result;
}
