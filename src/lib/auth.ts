import crypto from "crypto";

export interface SessionUser {
  id: string;
  nama: string;
  email: string;
  role: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || "actis-secure-session-key-2026-secret";

/**
 * Hash a plain password using scrypt with random salt.
 * Result format: `<salt_hex>:<hash_hex>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plain password against the stored hash.
 * If storedHash is null, falls back to default seed passwords:
 * - admin: 'admin123' or 'actis123'
 * - other roles: 'actis123' or 'admin123'
 */
export function verifyPassword(password: string, storedHash: string | null, email?: string): boolean {
  if (!storedHash) {
    if (email === "admin.noc@isp-enterprise.net") {
      return password === "admin123" || password === "actis123";
    }
    return password === "actis123" || password === "admin123";
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Create a tamper-proof session token.
 */
export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Verify a session token and extract SessionUser.
 */
export function verifySessionToken(token: string | null | undefined): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

  try {
    const jsonStr = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(jsonStr) as SessionUser;
  } catch {
    return null;
  }
}

