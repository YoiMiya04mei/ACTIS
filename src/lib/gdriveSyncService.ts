import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/backupCrypto";
import { buildBackupFileName } from "@/lib/backupVendorProfiles";
import {
  buildGoogleOAuthAuthorizeUrl,
  ensureDriveSubfolder,
  exchangeGoogleOAuthCode,
  getOAuth2AccessToken,
  getServiceAccountAccessToken,
  preserveOrUpdateSecret,
} from "@/lib/googleAuth";

export { buildGoogleOAuthAuthorizeUrl, exchangeGoogleOAuthCode };

export type GDriveMethod = "apps_script" | "oauth2" | "service_account";

export interface GDriveStoredConfig {
  enabled: boolean;
  method: GDriveMethod;
  folder_id: string;
  folder_per_device: boolean;
  apps_script_url: string;
  apps_script_secret_enc: string | null;
  oauth_client_id: string;
  oauth_client_secret_enc: string | null;
  oauth_refresh_token_enc: string | null;
  sa_client_email: string;
  sa_private_key_enc: string | null;
}

export interface GDrivePublicConfig {
  enabled: boolean;
  method: GDriveMethod;
  folder_id: string;
  folder_per_device: boolean;
  apps_script_url: string;
  apps_script_secret_masked: string;
  has_apps_script_secret: boolean;
  oauth_client_id: string;
  oauth_client_secret_masked: string;
  has_oauth_client_secret: boolean;
  oauth_refresh_token_masked: string;
  has_oauth_refresh_token: boolean;
  sa_client_email: string;
  sa_private_key_masked: string;
  has_sa_private_key: boolean;
  is_configured: boolean;
}

export const SETTING_KEY_GDRIVE = "network_backup_gdrive";

export const APPS_SCRIPT_DRIVE_TEMPLATE = `/**
 * ACTIS Network Config Backup -> Google Drive Receiver (Apps Script)
 * 1. Buka https://script.google.com -> New Project -> tempel kode ini.
 * 2. Isi SHARED_SECRET sesuai token rahasia yang Anda masukkan di ACTIS (atau biarkan kosong).
 * 3. Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone.
 * 4. Salin Web App URL dan Folder ID Google Drive tujuan ke pengaturan ACTIS.
 */
const SHARED_SECRET = ""; // Opsional: samakan dengan Secret Token di ACTIS

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SHARED_SECRET && data.secret !== SHARED_SECRET) {
      return jsonOut({ success: false, error: "Invalid secret token" });
    }

    let targetFolder = data.folderId
      ? DriveApp.getFolderById(data.folderId)
      : DriveApp.getRootFolder();

    if (data.folderPerDevice && data.deviceFolderName) {
      const existing = targetFolder.getFoldersByName(data.deviceFolderName);
      targetFolder = existing.hasNext()
        ? existing.next()
        : targetFolder.createFolder(data.deviceFolderName);
    }

    const blob = Utilities.newBlob(
      data.content || "",
      data.mimeType || "text/plain",
      data.fileName || "router-config.txt"
    );
    const file = targetFolder.createFile(blob);

    return jsonOut({
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName(),
    });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

function getDefaultStoredConfig(): GDriveStoredConfig {
  const envSaEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const envSaKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";

  return {
    enabled: false,
    method: "apps_script",
    folder_id: "",
    folder_per_device: true,
    apps_script_url: "",
    apps_script_secret_enc: null,
    oauth_client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    oauth_client_secret_enc: process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ? encryptSecret(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      : null,
    oauth_refresh_token_enc: null,
    sa_client_email: envSaEmail,
    sa_private_key_enc: envSaKey ? encryptSecret(envSaKey) : null,
  };
}

export async function getGDriveStoredConfig(): Promise<GDriveStoredConfig> {
  const fallback = getDefaultStoredConfig();
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_GDRIVE },
    });
    if (!row?.value) return fallback;
    const parsed = JSON.parse(row.value);
    return {
      ...fallback,
      ...parsed,
      sa_client_email: parsed.sa_client_email || fallback.sa_client_email,
      sa_private_key_enc: parsed.sa_private_key_enc || fallback.sa_private_key_enc,
      oauth_client_id: parsed.oauth_client_id || fallback.oauth_client_id,
      oauth_client_secret_enc: parsed.oauth_client_secret_enc || fallback.oauth_client_secret_enc,
    };
  } catch (err) {
    console.error("Failed to read Google Drive config:", err);
    return fallback;
  }
}

export function isGDriveConfigReady(cfg: GDriveStoredConfig): boolean {
  if (!cfg.enabled) return false;
  if (cfg.method === "apps_script") {
    return Boolean(cfg.apps_script_url && cfg.apps_script_url.startsWith("http"));
  }
  if (cfg.method === "oauth2") {
    return Boolean(cfg.oauth_client_id && cfg.oauth_client_secret_enc && cfg.oauth_refresh_token_enc);
  }
  if (cfg.method === "service_account") {
    return Boolean(cfg.sa_client_email && cfg.sa_private_key_enc);
  }
  return false;
}

export async function getGDrivePublicConfig(): Promise<GDrivePublicConfig> {
  const cfg = await getGDriveStoredConfig();
  return {
    enabled: cfg.enabled,
    method: cfg.method,
    folder_id: cfg.folder_id || "",
    folder_per_device: cfg.folder_per_device !== false,
    apps_script_url: cfg.apps_script_url || "",
    apps_script_secret_masked: cfg.apps_script_secret_enc ? maskSecret(cfg.apps_script_secret_enc) : "",
    has_apps_script_secret: Boolean(cfg.apps_script_secret_enc),
    oauth_client_id: cfg.oauth_client_id || "",
    oauth_client_secret_masked: cfg.oauth_client_secret_enc ? maskSecret(cfg.oauth_client_secret_enc) : "",
    has_oauth_client_secret: Boolean(cfg.oauth_client_secret_enc),
    oauth_refresh_token_masked: cfg.oauth_refresh_token_enc ? maskSecret(cfg.oauth_refresh_token_enc) : "",
    has_oauth_refresh_token: Boolean(cfg.oauth_refresh_token_enc),
    sa_client_email: cfg.sa_client_email || "",
    sa_private_key_masked: cfg.sa_private_key_enc ? "-----BEGIN PRIVATE KEY----- (Tersimpan Terenkripsi)" : "",
    has_sa_private_key: Boolean(cfg.sa_private_key_enc),
    is_configured: isGDriveConfigReady(cfg),
  };
}

export async function saveGDriveConfig(input: {
  enabled?: boolean;
  method?: GDriveMethod;
  folder_id?: string;
  folder_per_device?: boolean;
  apps_script_url?: string;
  apps_script_secret?: string;
  clear_apps_script_secret?: boolean;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_refresh_token?: string;
  sa_client_email?: string;
  sa_private_key?: string;
}): Promise<GDrivePublicConfig> {
  const current = await getGDriveStoredConfig();

  const updated: GDriveStoredConfig = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : current.enabled,
    method: input.method || current.method,
    folder_id: input.folder_id !== undefined ? input.folder_id.trim() : current.folder_id,
    folder_per_device:
      input.folder_per_device !== undefined ? Boolean(input.folder_per_device) : current.folder_per_device,
    apps_script_url:
      input.apps_script_url !== undefined ? input.apps_script_url.trim() : current.apps_script_url,
    apps_script_secret_enc: input.clear_apps_script_secret
      ? null
      : preserveOrUpdateSecret(input.apps_script_secret, current.apps_script_secret_enc),
    oauth_client_id:
      input.oauth_client_id !== undefined ? input.oauth_client_id.trim() : current.oauth_client_id,
    oauth_client_secret_enc: preserveOrUpdateSecret(
      input.oauth_client_secret,
      current.oauth_client_secret_enc
    ),
    oauth_refresh_token_enc: preserveOrUpdateSecret(
      input.oauth_refresh_token,
      current.oauth_refresh_token_enc
    ),
    sa_client_email:
      input.sa_client_email !== undefined ? input.sa_client_email.trim() : current.sa_client_email,
    sa_private_key_enc: preserveOrUpdateSecret(
      input.sa_private_key ? input.sa_private_key.replace(/\\n/g, "\n") : input.sa_private_key,
      current.sa_private_key_enc
    ),
  };

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_GDRIVE },
    update: { value: JSON.stringify(updated) },
    create: { key: SETTING_KEY_GDRIVE, value: JSON.stringify(updated) },
  });

  return getGDrivePublicConfig();
}

/**
 * Upload plain text network configuration file via Drive v3 multipart upload.
 */
async function uploadFileDriveV3(params: {
  accessToken: string;
  parentFolderId?: string;
  fileName: string;
  content: string;
  description?: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  const boundary = `actis_drive_${crypto.randomBytes(12).toString("hex")}`;
  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: "text/plain",
    description: params.description || "ACTIS Automated Network Config Backup",
  };
  if (params.parentFolderId) {
    metadata.parents = [params.parentFolderId];
  }

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${params.content}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.id) {
    const rawMsg = uploadJson.error?.message || uploadRes.statusText || "Unknown Google Drive error";
    if (rawMsg.toLowerCase().includes("storage quota")) {
      throw new Error(
        "Google Service Account tidak memiliki kuota penyimpanan di My Drive pribadi. Gunakan metode 'Apps Script Webhook', 'OAuth2 Akun Google', atau arahkan ke Google Workspace Shared Drive."
      );
    }
    throw new Error(`Upload Google Drive gagal: ${rawMsg}`);
  }

  return {
    fileId: uploadJson.id,
    fileUrl: uploadJson.webViewLink || `https://drive.google.com/file/d/${uploadJson.id}/view`,
  };
}

export async function uploadBackupToGDrive(input: {
  deviceName: string;
  vendor: string;
  host: string;
  content: string;
  createdAt: Date;
  lineCount: number;
  sizeBytes: number;
  fileName?: string;
}): Promise<{
  status: "SYNCED" | "SKIPPED" | "FAILED";
  fileId?: string;
  fileUrl?: string;
  error?: string;
}> {
  const cfg = await getGDriveStoredConfig();
  if (!cfg.enabled) {
    return { status: "SKIPPED" };
  }

  if (!isGDriveConfigReady(cfg)) {
    return {
      status: "FAILED",
      error: "Sinkronisasi Google Drive aktif tetapi konfigurasi belum lengkap.",
    };
  }

  const fileName = input.fileName || buildBackupFileName(input.deviceName, input.vendor, input.createdAt);
  const deviceFolderName = `${input.vendor.toUpperCase()} - ${input.deviceName}`
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim();

  try {
    if (cfg.method === "apps_script") {
      const secret = decryptSecret(cfg.apps_script_secret_enc) || "";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(cfg.apps_script_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret,
            folderId: cfg.folder_id || "",
            folderPerDevice: cfg.folder_per_device,
            deviceFolderName,
            deviceName: input.deviceName,
            vendor: input.vendor,
            host: input.host,
            fileName,
            mimeType: "text/plain",
            content: input.content,
            lineCount: input.lineCount,
            sizeBytes: input.sizeBytes,
            createdAt: input.createdAt.toISOString(),
          }),
          signal: controller.signal,
          redirect: "follow",
        });

        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(
            res.ok
              ? `Respons Apps Script bukan JSON valid: ${text.slice(0, 120)}`
              : `HTTP ${res.status} dari Apps Script: ${text.slice(0, 120)}`
          );
        }

        if (!parsed?.success) {
          throw new Error(parsed?.error || "Google Apps Script mengembalikan status gagal.");
        }

        return {
          status: "SYNCED",
          fileId: parsed.fileId || undefined,
          fileUrl:
            parsed.fileUrl ||
            (parsed.fileId ? `https://drive.google.com/file/d/${parsed.fileId}/view` : undefined),
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    let accessToken = "";
    if (cfg.method === "oauth2") {
      const clientSecret = decryptSecret(cfg.oauth_client_secret_enc);
      const refreshToken = decryptSecret(cfg.oauth_refresh_token_enc);
      if (!cfg.oauth_client_id || !clientSecret || !refreshToken) {
        throw new Error("Kredensial OAuth2 Google Drive belum lengkap.");
      }
      accessToken = await getOAuth2AccessToken(cfg.oauth_client_id, clientSecret, refreshToken);
    } else if (cfg.method === "service_account") {
      const privateKey = decryptSecret(cfg.sa_private_key_enc);
      if (!cfg.sa_client_email || !privateKey) {
        throw new Error("Email atau Private Key Service Account Google belum lengkap.");
      }
      accessToken = await getServiceAccountAccessToken(cfg.sa_client_email, privateKey);
    } else {
      throw new Error(`Metode Google Drive tidak dikenal: ${cfg.method}`);
    }

    let targetParent = cfg.folder_id?.trim() || undefined;
    if (cfg.folder_per_device) {
      targetParent = await ensureDriveSubfolder(accessToken, targetParent, deviceFolderName);
    }

    const uploaded = await uploadFileDriveV3({
      accessToken,
      parentFolderId: targetParent,
      fileName,
      content: input.content,
      description: `ACTIS Backup (${input.vendor.toUpperCase()}) ${input.deviceName} [${input.host}]`,
    });

    return {
      status: "SYNCED",
      fileId: uploaded.fileId,
      fileUrl: uploaded.fileUrl,
    };
  } catch (err: any) {
    console.error("Google Drive upload error:", err);
    return {
      status: "FAILED",
      error: err?.message || "Gagal mengunggah backup ke Google Drive.",
    };
  }
}

/**
 * Sync a specific saved NetworkConfigBackup record by ID and persist status in PostgreSQL.
 */
export async function syncBackupRecordToGDrive(backupId: string) {
  const backup = await prisma.networkConfigBackup.findUnique({
    where: { id: backupId },
    include: { device: true },
  });

  if (!backup) {
    throw new Error("Data backup tidak ditemukan.");
  }
  if (backup.status !== "SUCCESS" || !backup.config_content) {
    throw new Error("Hanya snapshot backup yang sukses dan memiliki isi konfigurasi yang dapat disinkronkan.");
  }

  const result = await uploadBackupToGDrive({
    deviceName: backup.device.name,
    vendor: backup.device.vendor,
    host: backup.device.host,
    content: backup.config_content,
    createdAt: backup.created_at,
    lineCount: backup.line_count,
    sizeBytes: backup.size_bytes,
  });

  const updated = await prisma.networkConfigBackup.update({
    where: { id: backup.id },
    data: {
      gdrive_status: result.status,
      gdrive_file_id: result.fileId ?? backup.gdrive_file_id,
      gdrive_file_url: result.fileUrl ?? backup.gdrive_file_url,
      gdrive_synced_at: result.status === "SYNCED" ? new Date() : backup.gdrive_synced_at,
      gdrive_error: result.status === "FAILED" ? result.error || "Sync gagal" : null,
    },
  });

  return { backup: updated, result };
}

