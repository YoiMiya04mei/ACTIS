import crypto from "crypto";
import {
  createSecureSessionToken,
  verifySecureSessionToken,
  revokeSessionToken,
  getSafeSessionSecret,
} from "@/lib/security";

export interface SessionUser {
  id: string;
  nama: string;
  email: string;
  role: string;
  exp?: number;
  iat?: number;
  jti?: string;
}

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
 * STRICT SECURITY: Never falls back to default passwords like 'admin123' or 'actis123'.
 * If storedHash is missing or malformed, verification strictly returns false.
 */
export function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
  _email?: string
): boolean {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;

  try {
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Create a secure, tamper-proof session token with expiration and JTI.
 */
export function createSessionToken(user: SessionUser): string {
  return createSecureSessionToken(user);
}

/**
 * Verify a session token and extract SessionUser.
 * Checks cryptographic signature, expiration, and revocation.
 */
export function verifySessionToken(token: string | null | undefined): SessionUser | null {
  const verified = verifySecureSessionToken(token);
  if (!verified) return null;

  return {
    id: verified.id,
    nama: verified.nama,
    email: verified.email,
    role: verified.role,
    exp: verified.exp,
    iat: verified.iat,
    jti: verified.jti,
  };
}

/**
 * Invalidate a session token on logout.
 */
export function invalidateSessionToken(token: string | null | undefined): void {
  revokeSessionToken(token);
}

export { getSafeSessionSecret };
