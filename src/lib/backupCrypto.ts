import crypto from "crypto";
import { getSafeSessionSecret } from "@/lib/security";

function getRawSecret(): string {
  const customKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (customKey && customKey.length >= 16) {
    return customKey;
  }
  return getSafeSessionSecret();
}

const PREFIX = "enc:v1:";

const LEGACY_CANDIDATE_SECRETS = [
  "actis-dev-session-key-must-be-rotated-for-production-use-only-2026",
  "actis-secure-session-key-2026-secret",
  "b468d98196b7d960abc12b36b663c0d65bbb44ebe595ca7abebcd683f3a22bd9",
];

function getKey(): Buffer {
  return crypto.createHash("sha256").update(getRawSecret()).digest();
}

function tryDecryptWithKey(
  ivHex: string,
  tagHex: string,
  dataHex: string,
  keyBuf: Buffer
): string | null {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
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
 * Gracefully handles key rotation across previous secrets without throwing unhandled exceptions.
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

  // 1. Try with currently configured key
  const primaryKey = getKey();
  const primaryResult = tryDecryptWithKey(ivHex, tagHex, dataHex, primaryKey);
  if (primaryResult !== null) {
    return primaryResult;
  }

  // 2. Fallback to candidate secrets (handles key rotation/transitions seamlessly)
  for (const candidate of LEGACY_CANDIDATE_SECRETS) {
    const candidateKey = crypto.createHash("sha256").update(candidate).digest();
    if (Buffer.compare(candidateKey, primaryKey) === 0) continue;
    const fallbackResult = tryDecryptWithKey(ivHex, tagHex, dataHex, candidateKey);
    if (fallbackResult !== null) {
      return fallbackResult;
    }
  }

  return null;
}

export function maskSecret(plainOrEncrypted: string | null | undefined): string {
  if (!plainOrEncrypted) return "";
  return "••••••••••••";
}

