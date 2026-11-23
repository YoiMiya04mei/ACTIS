import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/backupCrypto";
import {
  DEFAULT_CATEGORY_EMAIL_TEMPLATES,
  DOCUMENT_CATEGORY_LABELS,
  extractInvalidEmailAddresses,
  isValidEmailAddress,
  normalizeCategoryTemplates,
  parseEmailAddressList,
  sanitizeEmailHeader,
  escapeHtmlText,
  type CategoryEmailTemplateConfig,
  type DocumentEmailCategory,
  type EmailEncryptionMode,
  type EmailGatewayPublicConfig,
  type EmailGatewayUserStatus,
} from "@/lib/emailGatewayTypes";

export const EMAIL_GATEWAY_SETTING_KEY = "actis_email_gateway_v1";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB binary limit per email
const MASKED_PASSWORD_PLACEHOLDER = "••••••••••••";

interface StoredEmailGatewayRecord {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  encryption: EmailEncryptionMode;
  smtpUser: string;
  smtpPassEnc: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  defaultCc: string;
  signatureText: string;
  rejectUnauthorized: boolean;
  categoryTemplates: Record<DocumentEmailCategory, CategoryEmailTemplateConfig>;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface DecryptedEmailGatewayConfig extends StoredEmailGatewayRecord {
  smtpPass: string;
  source: "database" | "env" | "unconfigured";
  isConfigured: boolean;
}

export interface EmailGatewayAttachmentInput {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export interface SendGatewayEmailParams {
  to: string | string[];
  cc?: string | string[];
  replyTo?: string;
  subject: string;
  bodyText: string;
  htmlBody?: string;
  attachments?: EmailGatewayAttachmentInput[];
}

export interface SendGatewayEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

function normalizeEncryption(value: unknown, port: number): EmailEncryptionMode {
  if (value === "ssl" || value === "tls" || value === "none") {
    return value;
  }
  return port === 465 ? "ssl" : "tls";
}

function normalizePort(value: unknown, encryption?: EmailEncryptionMode): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return encryption === "ssl" ? 465 : 587;
}

function buildEnvFallbackRecord(): StoredEmailGatewayRecord {
  const host = (process.env.SMTP_HOST || "").trim();
  const rawEncryption = (process.env.SMTP_SECURE || "").trim().toLowerCase();
  const port = normalizePort(
    process.env.SMTP_PORT,
    rawEncryption === "true" || rawEncryption === "ssl" ? "ssl" : "tls"
  );
  const encryption: EmailEncryptionMode =
    rawEncryption === "true" || rawEncryption === "ssl"
      ? "ssl"
      : rawEncryption === "none"
        ? "none"
        : port === 465
          ? "ssl"
          : "tls";

  return {
    enabled: Boolean(host),
    smtpHost: host,
    smtpPort: port,
    encryption,
    smtpUser: (process.env.SMTP_USER || "").trim(),
    smtpPassEnc: process.env.SMTP_PASS ? encryptSecret(process.env.SMTP_PASS) : null,
    fromName: (process.env.SMTP_FROM_NAME || "ACTIS Operations").trim(),
    fromEmail: (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim(),
    replyTo: (process.env.SMTP_REPLY_TO || "").trim(),
    defaultCc: "",
    signatureText:
      "PT Jembatan Data Pangrango — ACTIS Operations & NOC\nEmail ini dikirim secara otomatis melalui Email Gateway ACTIS.",
    rejectUnauthorized: true,
    categoryTemplates: { ...DEFAULT_CATEGORY_EMAIL_TEMPLATES },
    updatedAt: null,
    updatedBy: null,
  };
}

function isPlaceholderMask(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed === MASKED_PASSWORD_PLACEHOLDER || /^•{4,}$/.test(trimmed);
}

async function getStoredEmailGatewayRecord(): Promise<{
  record: StoredEmailGatewayRecord;
  source: "database" | "env" | "unconfigured";
}> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: EMAIL_GATEWAY_SETTING_KEY },
  });

  if (row && row.value) {
    try {
      const parsed = JSON.parse(row.value) as Partial<StoredEmailGatewayRecord>;
      const encMode = normalizeEncryption(
        parsed.encryption,
        typeof parsed.smtpPort === "number" ? parsed.smtpPort : 587
      );
      const port = normalizePort(parsed.smtpPort, encMode);
      const record: StoredEmailGatewayRecord = {
        enabled: parsed.enabled !== false,
        smtpHost: sanitizeEmailHeader(parsed.smtpHost || ""),
        smtpPort: port,
        encryption: encMode,
        smtpUser: sanitizeEmailHeader(parsed.smtpUser || ""),
        smtpPassEnc: typeof parsed.smtpPassEnc === "string" ? parsed.smtpPassEnc : null,
        fromName: sanitizeEmailHeader(parsed.fromName || "ACTIS Operations"),
        fromEmail: sanitizeEmailHeader(parsed.fromEmail || ""),
        replyTo: sanitizeEmailHeader(parsed.replyTo || ""),
        defaultCc: parseEmailAddressList(parsed.defaultCc).join(", "),
        signatureText:
          typeof parsed.signatureText === "string"
            ? parsed.signatureText.trim()
            : buildEnvFallbackRecord().signatureText,
        rejectUnauthorized: parsed.rejectUnauthorized !== false,
        categoryTemplates: normalizeCategoryTemplates(parsed.categoryTemplates),
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : row.updated_at.toISOString(),
        updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : null,
      };
      return {
        record,
        source: record.smtpHost && record.fromEmail ? "database" : "unconfigured",
      };
    } catch {
      // Fallback below
    }
  }

  const envFallback = buildEnvFallbackRecord();
  return {
    record: envFallback,
    source: envFallback.smtpHost && envFallback.fromEmail ? "env" : "unconfigured",
  };
}

function isRecordConfigured(rec: StoredEmailGatewayRecord): boolean {
  return Boolean(
    rec.smtpHost.trim() &&
      rec.smtpPort >= 1 &&
      isValidEmailAddress(rec.fromEmail || rec.smtpUser)
  );
}

export async function getDecryptedEmailGatewayConfig(): Promise<DecryptedEmailGatewayConfig> {
  const { record, source } = await getStoredEmailGatewayRecord();
  const smtpPass = decryptSecret(record.smtpPassEnc) || "";
  const effectiveFromEmail = record.fromEmail || record.smtpUser;
  return {
    ...record,
    fromEmail: effectiveFromEmail,
    smtpPass,
    source,
    isConfigured: isRecordConfigured({ ...record, fromEmail: effectiveFromEmail }),
  };
}

export async function getAdminEmailGatewayConfig(): Promise<EmailGatewayPublicConfig> {
  const { record, source } = await getStoredEmailGatewayRecord();
  const effectiveFromEmail = record.fromEmail || record.smtpUser;
  const hasPassword = Boolean(record.smtpPassEnc);
  return {
    enabled: record.enabled,
    isConfigured: isRecordConfigured({ ...record, fromEmail: effectiveFromEmail }),
    smtpHost: record.smtpHost,
    smtpPort: record.smtpPort,
    encryption: record.encryption,
    smtpUser: record.smtpUser,
    hasPassword,
    passwordMasked: hasPassword ? maskSecret(record.smtpPassEnc) : "",
    fromName: record.fromName,
    fromEmail: effectiveFromEmail,
    replyTo: record.replyTo,
    defaultCc: record.defaultCc,
    signatureText: record.signatureText,
    rejectUnauthorized: record.rejectUnauthorized,
    categoryTemplates: record.categoryTemplates,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    source,
  };
}

export async function getDocumentUserEmailGatewayStatus(): Promise<EmailGatewayUserStatus> {
  const { record } = await getStoredEmailGatewayRecord();
  const effectiveFromEmail = record.fromEmail || record.smtpUser;
  return {
    enabled: record.enabled,
    isConfigured: isRecordConfigured({ ...record, fromEmail: effectiveFromEmail }),
    fromName: record.fromName,
    fromEmail: effectiveFromEmail,
    defaultCc: record.defaultCc,
    signatureText: record.signatureText,
    categoryTemplates: record.categoryTemplates,
  };
}

export interface UpdateEmailGatewayInput {
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number | string;
  encryption?: EmailEncryptionMode;
  smtpUser?: string;
  smtpPass?: string;
  clearPassword?: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  defaultCc?: string;
  signatureText?: string;
  rejectUnauthorized?: boolean;
  categoryTemplates?: Partial<Record<DocumentEmailCategory, Partial<CategoryEmailTemplateConfig>>>;
}

export async function saveEmailGatewayConfig(
  input: UpdateEmailGatewayInput,
  actorName?: string | null
): Promise<EmailGatewayPublicConfig> {
  const current = await getStoredEmailGatewayRecord();
  const prev = current.record;

  const nextEncryption = normalizeEncryption(
    input.encryption ?? prev.encryption,
    normalizePort(input.smtpPort ?? prev.smtpPort)
  );
  const nextPort = normalizePort(input.smtpPort ?? prev.smtpPort, nextEncryption);
  const nextHost = sanitizeEmailHeader(
    input.smtpHost !== undefined ? input.smtpHost : prev.smtpHost
  );
  const nextUser = sanitizeEmailHeader(
    input.smtpUser !== undefined ? input.smtpUser : prev.smtpUser
  );
  const nextFromName = sanitizeEmailHeader(
    input.fromName !== undefined ? input.fromName : prev.fromName
  ) || "ACTIS Operations";
  const nextFromEmail = sanitizeEmailHeader(
    input.fromEmail !== undefined ? input.fromEmail : prev.fromEmail
  ) || nextUser;
  const nextReplyTo = sanitizeEmailHeader(
    input.replyTo !== undefined ? input.replyTo : prev.replyTo
  );

  if (nextFromEmail && !isValidEmailAddress(nextFromEmail)) {
    throw new Error("Format Email Pengirim (From Email) tidak valid.");
  }
  if (nextReplyTo && !isValidEmailAddress(nextReplyTo)) {
    throw new Error("Format Email Reply-To tidak valid.");
  }

  const ccRaw = input.defaultCc !== undefined ? input.defaultCc : prev.defaultCc;
  const invalidCc = extractInvalidEmailAddresses(ccRaw);
  if (invalidCc.length > 0) {
    throw new Error(`Alamat Default CC tidak valid: ${invalidCc.join(", ")}`);
  }

  let nextPassEnc = prev.smtpPassEnc;
  if (input.clearPassword === true) {
    nextPassEnc = null;
  } else if (
    typeof input.smtpPass === "string" &&
    input.smtpPass.trim() !== "" &&
    !isPlaceholderMask(input.smtpPass)
  ) {
    nextPassEnc = encryptSecret(input.smtpPass);
  }

  const nextCategoryTemplates = input.categoryTemplates
    ? normalizeCategoryTemplates({
        ...prev.categoryTemplates,
        ...Object.fromEntries(
          Object.entries(input.categoryTemplates).map(([k, v]) => [
            k,
            {
              ...(prev.categoryTemplates[k as DocumentEmailCategory] || {}),
              ...(v || {}),
            },
          ])
        ),
      })
    : prev.categoryTemplates;

  const nowIso = new Date().toISOString();
  const nextRecord: StoredEmailGatewayRecord = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : prev.enabled,
    smtpHost: nextHost,
    smtpPort: nextPort,
    encryption: nextEncryption,
    smtpUser: nextUser,
    smtpPassEnc: nextPassEnc,
    fromName: nextFromName,
    fromEmail: nextFromEmail,
    replyTo: nextReplyTo,
    defaultCc: parseEmailAddressList(ccRaw).join(", "),
    signatureText:
      input.signatureText !== undefined
        ? String(input.signatureText).trim()
        : prev.signatureText,
    rejectUnauthorized:
      input.rejectUnauthorized !== undefined
        ? Boolean(input.rejectUnauthorized)
        : prev.rejectUnauthorized,
    categoryTemplates: nextCategoryTemplates,
    updatedAt: nowIso,
    updatedBy: actorName || "Administrator",
  };

  await prisma.systemSetting.upsert({
    where: { key: EMAIL_GATEWAY_SETTING_KEY },
    update: { value: JSON.stringify(nextRecord) },
    create: { key: EMAIL_GATEWAY_SETTING_KEY, value: JSON.stringify(nextRecord) },
  });

  return getAdminEmailGatewayConfig();
}

export async function resolveDraftConfigForTest(
  draft?: UpdateEmailGatewayInput | null
): Promise<DecryptedEmailGatewayConfig> {
  const current = await getDecryptedEmailGatewayConfig();
  if (!draft) return current;

  const encryption = normalizeEncryption(
    draft.encryption ?? current.encryption,
    normalizePort(draft.smtpPort ?? current.smtpPort)
  );
  const smtpPort = normalizePort(draft.smtpPort ?? current.smtpPort, encryption);
  const smtpHost = sanitizeEmailHeader(
    draft.smtpHost !== undefined ? draft.smtpHost : current.smtpHost
  );
  const smtpUser = sanitizeEmailHeader(
    draft.smtpUser !== undefined ? draft.smtpUser : current.smtpUser
  );
  const fromName =
    sanitizeEmailHeader(draft.fromName !== undefined ? draft.fromName : current.fromName) ||
    "ACTIS Operations";
  const fromEmail =
    sanitizeEmailHeader(
      draft.fromEmail !== undefined ? draft.fromEmail : current.fromEmail
    ) || smtpUser;
  const replyTo = sanitizeEmailHeader(
    draft.replyTo !== undefined ? draft.replyTo : current.replyTo
  );

  let smtpPass = current.smtpPass;
  if (draft.clearPassword === true) {
    smtpPass = "";
  } else if (
    typeof draft.smtpPass === "string" &&
    draft.smtpPass.trim() !== "" &&
    !isPlaceholderMask(draft.smtpPass)
  ) {
    smtpPass = draft.smtpPass;
  }

  return {
    ...current,
    enabled: draft.enabled !== undefined ? Boolean(draft.enabled) : current.enabled,
    smtpHost,
    smtpPort,
    encryption,
    smtpUser,
    smtpPass,
    fromName,
    fromEmail,
    replyTo,
    rejectUnauthorized:
      draft.rejectUnauthorized !== undefined
        ? Boolean(draft.rejectUnauthorized)
        : current.rejectUnauthorized,
    isConfigured: Boolean(smtpHost && smtpPort >= 1 && isValidEmailAddress(fromEmail)),
  };
}

function createNodemailerTransport(config: DecryptedEmailGatewayConfig) {
  const isSsl = config.encryption === "ssl";
  const isTls = config.encryption === "tls";

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: isSsl,
    requireTLS: isTls ? true : undefined,
    ignoreTLS: config.encryption === "none" ? true : undefined,
    auth:
      config.smtpUser && config.smtpPass
        ? { user: config.smtpUser, pass: config.smtpPass }
        : config.smtpUser
          ? { user: config.smtpUser, pass: "" }
          : undefined,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized !== false,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 25000,
  });
}

export function formatSmtpErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || "Unknown error");
  const code = (err as { code?: string; responseCode?: number })?.code || "";
  const responseCode = (err as { responseCode?: number })?.responseCode;

  if (code === "EAUTH" || responseCode === 535 || /auth|535|credentials|login/i.test(msg)) {
    return "Autentikasi SMTP gagal (Username / App Password salah atau diblokir oleh penyedia email).";
  }
  if (code === "ECONNREFUSED") {
    return "Koneksi ke server SMTP ditolak (ECONNREFUSED). Periksa Host dan Port SMTP.";
  }
  if (code === "ETIMEDOUT" || /timeout/i.test(msg)) {
    return "Koneksi ke server SMTP timeout. Pastikan firewall / jaringan VPS mengizinkan port SMTP (587 / 465).";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "Hostname server SMTP tidak ditemukan (DNS gagal resolve).";
  }
  if (/self[- ]signed|certificate|tls|ssl|wrong version number/i.test(msg)) {
    return `Negosiasi SSL/TLS gagal (${msg}). Cek mode enkripsi (STARTTLS port 587 vs SSL port 465) atau matikan validasi sertifikat ketat jika SMTP memakai self-signed certificate.`;
  }
  return `Gagal mengirim email melalui SMTP: ${msg}`;
}

export async function verifySmtpConnection(
  configOverride?: DecryptedEmailGatewayConfig
): Promise<void> {
  const config = configOverride || (await getDecryptedEmailGatewayConfig());
  if (!config.smtpHost || !config.smtpPort) {
    throw new Error("Host dan Port SMTP wajib diisi terlebih dahulu.");
  }
  const transporter = createNodemailerTransport(config);
  try {
    await transporter.verify();
  } catch (err) {
    throw new Error(formatSmtpErrorMessage(err));
  }
}

export function buildFallbackHtmlFromText(bodyText: string): string {
  const safeHtmlParagraphs = escapeHtmlText(bodyText)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px 0;">${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;margin:0;padding:16px;background-color:#f8fafc;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
    ${safeHtmlParagraphs}
  </div>
</body>
</html>`;
}

export async function sendGatewayEmail(
  params: SendGatewayEmailParams,
  configOverride?: DecryptedEmailGatewayConfig
): Promise<SendGatewayEmailResult> {
  const config = configOverride || (await getDecryptedEmailGatewayConfig());
  if (!configOverride && !config.enabled) {
    throw new Error(
      "Email Gateway saat ini nonaktif. Aktifkan terlebih dahulu di menu Integrasi & Sistem > Email Gateway."
    );
  }
  if (!config.isConfigured || !config.smtpHost || !config.fromEmail) {
    throw new Error(
      "Email Gateway belum dikonfigurasi. Lengkapi pengaturan SMTP di menu Integrasi & Sistem > Email Gateway."
    );
  }

  const invalidTo = extractInvalidEmailAddresses(params.to);
  if (invalidTo.length > 0) {
    throw new Error(`Alamat email tujuan (Kepada) tidak valid: ${invalidTo.join(", ")}`);
  }
  const toList = parseEmailAddressList(params.to);
  if (toList.length === 0) {
    throw new Error("Minimal satu alamat email tujuan (Kepada) wajib diisi.");
  }

  const invalidCc = extractInvalidEmailAddresses(params.cc);
  if (invalidCc.length > 0) {
    throw new Error(`Alamat email CC tidak valid: ${invalidCc.join(", ")}`);
  }
  const ccList = parseEmailAddressList(params.cc);

  const subject = sanitizeEmailHeader(params.subject);
  if (!subject) {
    throw new Error("Subjek email wajib diisi.");
  }

  const bodyText = String(params.bodyText || "").trim();
  if (!bodyText) {
    throw new Error("Isi redaksi email wajib diisi.");
  }

  const preparedAttachments: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }> = [];

  if (Array.isArray(params.attachments)) {
    for (const att of params.attachments) {
      if (!att?.contentBase64) continue;
      const cleanBase64 = att.contentBase64.includes(",")
        ? att.contentBase64.split(",").pop() || ""
        : att.contentBase64;
      const buffer = Buffer.from(cleanBase64, "base64");
      if (buffer.length === 0) continue;
      if (buffer.length > MAX_ATTACHMENT_BYTES) {
        throw new Error(
          `Ukuran lampiran "${att.filename}" melebihi batas maksimal 15 MB.`
        );
      }
      const safeFilename = (att.filename || "dokumen-actis.pdf").replace(
        /[\\/:*?"<>|\r\n]+/g,
        "_"
      );
      preparedAttachments.push({
        filename: safeFilename,
        content: buffer,
        contentType: att.contentType || "application/pdf",
      });
    }
  }

  const cleanFromName = sanitizeEmailHeader(config.fromName).replace(/"/g, "");
  const formattedFrom = cleanFromName
    ? `"${cleanFromName}" <${config.fromEmail}>`
    : config.fromEmail;
  const replyTo = sanitizeEmailHeader(params.replyTo || config.replyTo);

  const transporter = createNodemailerTransport(config);

  try {
    const info = await transporter.sendMail({
      from: formattedFrom,
      to: toList.join(", "),
      cc: ccList.length > 0 ? ccList.join(", ") : undefined,
      replyTo: isValidEmailAddress(replyTo) ? replyTo : undefined,
      subject,
      text: bodyText,
      html: params.htmlBody?.trim() || buildFallbackHtmlFromText(bodyText),
      attachments: preparedAttachments.length > 0 ? preparedAttachments : undefined,
    });

    return {
      messageId: String(info.messageId || ""),
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
      response: String(info.response || ""),
    };
  } catch (err) {
    throw new Error(formatSmtpErrorMessage(err));
  }
}

export function getCategoryLabel(category: string | undefined): string {
  if (!category) return "Dokumen Resmi";
  return (
    DOCUMENT_CATEGORY_LABELS[category as DocumentEmailCategory] || category
  );
}
