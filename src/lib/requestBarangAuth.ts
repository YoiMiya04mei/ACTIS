import { prisma } from "@/lib/prisma";

export const REQUEST_BARANG_ROLE = "request_barang" as const;
export const REQUEST_BARANG_LOGIN_SETTING_KEY = "request_barang_require_login" as const;
export const INTERNAL_REQUEST_BARANG_EMAIL_DOMAIN = "@request-barang.actis.local";

export const ALL_USER_ROLES = [
  "admin",
  "noc_engineer",
  "field_engineer",
  "sales_corporate",
  "warehouse_admin",
  "request_barang",
] as const;

export type AppUserRole = (typeof ALL_USER_ROLES)[number];

export interface RequestBarangAccessSubject {
  role?: string | null;
  request_barang_access?: boolean | null;
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}

export function buildInternalRequestBarangEmail(username: string): string {
  const clean = normalizeUsername(username);
  return `${clean}${INTERNAL_REQUEST_BARANG_EMAIL_DOMAIN}`;
}

export function isInternalPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(
    email && String(email).toLowerCase().endsWith(INTERNAL_REQUEST_BARANG_EMAIL_DOMAIN)
  );
}

/**
 * Resolves whether a user is allowed to log in and submit forms at `/request-barang`.
 * Explicit boolean (`true`/`false`) overrides the default; otherwise `admin` and `request_barang`
 * default to enabled while dashboard-only staff roles remain restricted unless explicitly granted.
 */
export function hasRequestBarangAccess(
  user: RequestBarangAccessSubject | null | undefined
): boolean {
  if (!user) return false;
  if (typeof user.request_barang_access === "boolean") {
    return user.request_barang_access;
  }
  return user.role === "admin" || user.role === REQUEST_BARANG_ROLE;
}

/**
 * Resolves the explicit or inherited boolean value to store when creating/updating a user.
 */
export function resolveDefaultRequestBarangAccess(
  role: string,
  explicitValue?: unknown
): boolean {
  if (typeof explicitValue === "boolean") {
    return explicitValue;
  }
  return role === "admin" || role === REQUEST_BARANG_ROLE;
}

/**
 * Looks up a user for `/request-barang` username login.
 * Rejects email addresses (`@`) so login uses username strictly; also resolves unambiguous
 * email local-parts for legacy accounts created before the `username` column existed.
 */
export async function findUserByLoginUsername(rawUsername: string) {
  const clean = normalizeUsername(rawUsername);
  if (!clean || clean.includes("@")) {
    return null;
  }

  const byUsername = await prisma.user.findUnique({
    where: { username: clean },
    select: {
      id: true,
      nama: true,
      email: true,
      username: true,
      role: true,
      request_barang_access: true,
      password_hash: true,
    },
  });

  if (byUsername) {
    return byUsername;
  }

  // Fallback for legacy ACTIS users created without explicit `username`
  const prefixMatches = await prisma.user.findMany({
    where: {
      email: { startsWith: `${clean}@` },
    },
    take: 2,
    select: {
      id: true,
      nama: true,
      email: true,
      username: true,
      role: true,
      request_barang_access: true,
      password_hash: true,
    },
  });

  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  return null;
}

/**
 * Reads whether `/request-barang` requires authenticated login.
 * Defaults to `true` (login required) unless Administrator explicitly sets it to `"false"`.
 */
export async function isRequestBarangLoginRequired(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: REQUEST_BARANG_LOGIN_SETTING_KEY },
      select: { value: true },
    });
    if (!setting) return true;
    return setting.value.trim().toLowerCase() !== "false";
  } catch (err) {
    console.error("Failed reading request_barang_require_login setting:", err);
    return true;
  }
}

/**
 * Reads configured auto-logout idle timeout minutes from `SystemSetting` (default 15 minutes).
 */
export async function getConfiguredIdleTimeoutMinutes(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "session_idle_timeout_minutes" },
      select: { value: true },
    });
    if (!setting) return 15;
    const parsed = parseInt(setting.value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 15;
  } catch {
    return 15;
  }
}
