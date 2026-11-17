import { prisma } from "@/lib/prisma";

export const REQUEST_BARANG_ROLE = "request_barang" as const;
export const REQUEST_BARANG_LOGIN_SETTING_KEY = "request_barang_require_login" as const;

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
    // Fail-closed so login requirement stays enforced on DB read errors
    return true;
  }
}
