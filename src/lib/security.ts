import crypto from "crypto";
import net from "net";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type UserRole = "admin" | "noc_engineer" | "field_engineer" | "sales_corporate" | "warehouse_admin";

export interface SessionPayload {
  id: string;
  nama: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedUser {
  id: string;
  nama: string;
  email: string;
  role: string;
}

export interface RequireAuthOptions {
  roles?: UserRole[];
  allowedRoles?: string[];
  requireAdmin?: boolean;
}

// In-memory token revocation list (e.g. on logout or password change)
const revokedTokens = new Map<string, number>();

// In-memory sliding window rate limiter
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired revocations every 30 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (now > exp) {
      revokedTokens.delete(jti);
    }
  }
  for (const [key, record] of rateLimitMap.entries()) {
    if (Date.now() > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 30 * 60 * 1000);

const KNOWN_INSECURE_SECRETS = new Set([
  "actis-secure-session-key-2026-secret",
  "secret",
  "changeme",
  "password",
  "admin",
  "default",
]);

/**
 * Validates and retrieves the SESSION_SECRET.
 * In production mode, application refuses to use default/insecure keys.
 */
export function getSafeSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (!envSecret || envSecret.length < 32 || KNOWN_INSECURE_SECRETS.has(envSecret)) {
      throw new Error(
        "[SECURITY CRITICAL] SESSION_SECRET must be set to a cryptographically secure random string with at least 32 characters in production."
      );
    }
    return envSecret;
  }

  // Development/test fallback (warn if default used)
  return envSecret || "actis-dev-session-key-must-be-rotated-for-production-use-only-2026";
}

/**
 * Creates a cryptographically signed, tamper-proof session token with expiration and JTI.
 */
export function createSecureSessionToken(
  user: { id: string; nama: string; email: string; role: string },
  expiresInSeconds = 60 * 60 * 24 * 7 // 7 days default
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomBytes(16).toString("hex"),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSafeSessionSecret();
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a session token. Checks signature, expiry, and revocation.
 */
export function verifySecureSessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  let secret: string;
  try {
    secret = getSafeSessionSecret();
  } catch {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    // Expiration check
    if (!payload.exp || now > payload.exp) {
      return null;
    }

    // Revocation check
    if (payload.jti && revokedTokens.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Revokes a session token so it cannot be used again.
 */
export function revokeSessionToken(token: string | null | undefined): void {
  const session = verifySecureSessionToken(token);
  if (session && session.jti) {
    revokedTokens.set(session.jti, session.exp);
  }
}

/**
 * Centralized RBAC Authentication & Authorization validator for API routes.
 * Verifies session cookie, looks up live role in DB, and enforces role matrix.
 */
export async function requireAuth(
  request: NextRequest,
  options?: RequireAuthOptions
): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse }
> {
  const token = request.cookies.get("actis_session")?.value;
  const session = verifySecureSessionToken(token);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          error: "Sesi login tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        },
        { status: 401 }
      ),
    };
  }

  // Always verify against live database record to ensure role and account are current
  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, nama: true, email: true, role: true },
  });

  if (!dbUser) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_NOT_FOUND",
          error: "Akun pengguna tidak ditemukan atau telah dinonaktifkan.",
        },
        { status: 401 }
      ),
    };
  }

  // Enforce Administrator role if required
  if (options?.requireAdmin && dbUser.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          error: "Akses ditolak: Operasi ini membutuhkan hak akses Administrator.",
        },
        { status: 403 }
      ),
    };
  }

  // Enforce specific role matrix if provided
  const targetRoles = options?.allowedRoles || options?.roles;
  if (targetRoles && targetRoles.length > 0) {
    if (!targetRoles.includes(dbUser.role as any)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            code: "FORBIDDEN",
            error: `Akses ditolak: Role '${dbUser.role}' tidak memiliki izin untuk mengakses resource ini.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, user: dbUser };
}

/**
 * Standard secure session cookie options.
 */
export function getSessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * In-memory sliding window rate limiter.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

/**
 * Strict IP address validation (IPv4 or IPv6).
 */
export function isValidIpAddress(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return net.isIP(trimmed) !== 0;
}

/**
 * SSRF Protection: Checks if an IP or host is loopback, link-local, cloud metadata, or unsafe target.
 */
export function isRestrictedNetworkTarget(host: string): boolean {
  if (!host || typeof host !== "string") return true;
  let clean = host.trim().toLowerCase().replace(/[\[\]]/g, "");

  // Cloud metadata services & known SSRF aliases
  if (
    clean === "169.254.169.254" ||
    clean === "fd00:ec2::254" ||
    clean === "instance-data" ||
    clean === "metadata.google.internal" ||
    clean.includes("metadata.google") ||
    clean.includes("169.254.")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "");
  }

  // Localhost aliases & IPv6 loopback
  if (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "0.0.0.0" ||
    clean === "::" ||
    clean === "0:0:0:0:0:0:0:1" ||
    clean === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }

  // IPv6 link-local (fe80::/10)
  if (clean.startsWith("fe80:") || clean.startsWith("fe9") || clean.startsWith("fea") || clean.startsWith("feb")) {
    return true;
  }

  // Obfuscated integer/hex/octal IP detection (e.g. 2130706433, 0177.0.0.1, 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(clean) || /^\d+$/.test(clean) || /^0[0-7]+$/i.test(clean)) {
    return true; // Deny raw integer/hex notation to prevent localhost bypass
  }

  // IPv4 checks
  if (net.isIPv4(clean)) {
    const parts = clean.split(".").map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local & AWS/Azure/GCP metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
  }

  return false;
}

/**
 * Secure file upload validation with Magic Bytes signature verification.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf"]);
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateUploadedBuffer(
  buffer: Buffer,
  fileName: string
): { valid: boolean; error?: string; detectedMime?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: "File kosong." };
  }
  if (buffer.length > MAX_UPLOAD_FILE_SIZE) {
    return { valid: false, error: "Ukuran file melebihi batas maksimum 10MB." };
  }

  // Verify file extension
  const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 1).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Format file '${ext}' tidak didukung. Ekstensi yang diizinkan: PNG, JPG, JPEG, PDF.`,
    };
  }

  // Verify Magic Bytes
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: "image/png" };
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, detectedMime: "application/pdf" };
  }

  return {
    valid: false,
    error: "Signature file tidak cocok dengan tipe file yang diizinkan. Upload dibatalkan.",
  };
}
