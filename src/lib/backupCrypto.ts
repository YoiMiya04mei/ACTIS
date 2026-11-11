import crypto from "crypto";

const RAW_SECRET =
  process.env.BACKUP_ENCRYPTION_KEY ||
  process.env.SESSION_SECRET ||
  "actis-secure-session-key-2026-secret";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  return crypto.createHash("sha256").update(RAW_SECRET).digest();
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt sensitive device passwords / keys / Drive tokens using AES-256-GCM
 * before persisting into PostgreSQL.
 */
export function encryptSecret(plainText: string | null | undefined): string | null {
  if (plainText === null || plainText === undefined || plainText === "") {
    return null;
  }
  if (isEncryptedSecret(plainText)) {
    return plainText;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt AES-256-GCM encrypted secrets back into plaintext strictly server-side.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) {
    return stored;
  }

  const body = stored.slice(PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 3) return null;

  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(plainOrEncrypted: string | null | undefined): string {
  if (!plainOrEncrypted) return "";
  return "••••••••••••";
}

