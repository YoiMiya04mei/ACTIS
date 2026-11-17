import crypto from "crypto";
import {
  createSecureSessionToken,
  verifySecureSessionToken,
  revokeSessionToken,
  createRememberMeToken,
  verifyRememberMeToken,
  revokeRememberMeToken,
  verifyPasswordFingerprint,
  getSafeSessionSecret,
  type RememberPurpose,
  type RememberTokenPayload,
  type SessionPurpose,
} from "@/lib/security";

export interface SessionUser {
  id: string;
  nama: string;
  email: string;
  username?: string | null;
  role: string;
  exp?: number;
  iat?: number;
  jti?: string;
  rememberMe?: boolean;
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
export function createSessionToken(
  user: SessionUser,
  expiresInSeconds?: number,
  extra?: { rememberMe?: boolean; purpose?: SessionPurpose }
): string {
  return createSecureSessionToken(user, expiresInSeconds, extra);
}

/**
 * Verify a session token and extract SessionUser.
 * Checks cryptographic signature, expiration, and revocation.
 */
export function verifySessionToken(
  token: string | null | undefined,
  expectedPurpose: SessionPurpose = "session"
): SessionUser | null {
  const verified = verifySecureSessionToken(token, expectedPurpose);
  if (!verified) return null;

  return {
    id: verified.id,
    nama: verified.nama,
    email: verified.email,
    username: verified.username,
    role: verified.role,
    exp: verified.exp,
    iat: verified.iat,
    jti: verified.jti,
    rememberMe: verified.rememberMe,
  };
}

/**
 * Invalidate a session token on logout.
 */
export function invalidateSessionToken(
  token: string | null | undefined,
  expectedPurpose: SessionPurpose = "session"
): void {
  revokeSessionToken(token, expectedPurpose);
}

/**
 * Create a cryptographic Remember Me token bound to user's password fingerprint.
 */
export function createRememberToken(
  user: { id: string; email: string },
  passwordHash: string | null | undefined,
  expiresInSeconds?: number,
  purpose: RememberPurpose = "remember_me"
): string {
  return createRememberMeToken(user, passwordHash, expiresInSeconds, purpose);
}

/**
 * Verify a cryptographic Remember Me token.
 */
export function verifyRememberToken(
  token: string | null | undefined,
  expectedPurpose: RememberPurpose = "remember_me"
): RememberTokenPayload | null {
  return verifyRememberMeToken(token, expectedPurpose);
}

/**
 * Revoke a Remember Me token.
 */
export function invalidateRememberToken(
  token: string | null | undefined,
  expectedPurpose: RememberPurpose = "remember_me"
): void {
  revokeRememberMeToken(token, expectedPurpose);
}

export { getSafeSessionSecret, verifyPasswordFingerprint };
