import { prisma } from "@/lib/prisma";

export const REQUEST_BARANG_ROLE = "request_barang" as const;
export const REQUEST_BARANG_LOGIN_SETTING_KEY = "request_barang_require_login" as const;
export const PORTAL_INTERNAL_EMAIL_DOMAIN = "@request-barang.portal";

/**
 * Roles valid exclusively for the main ACTIS dashboard (`actis.jembatandata.com`).
 * Portal `/request-barang` accounts live separately in `request_barang_accounts`.
 */
export const ACTIS_DASHBOARD_ROLES = [
  "admin",
  "noc_engineer",
  "field_engineer",
  "sales_corporate",
  "warehouse_admin",
] as const;

export type ActisDashboardRole = (typeof ACTIS_DASHBOARD_ROLES)[number];

const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}

export function buildPortalSyntheticEmail(username: string): string {
  return `${normalizeUsername(username)}${PORTAL_INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Migrates any legacy `users` rows created with `role = 'request_barang'` into the dedicated
 * `request_barang_accounts` table so main ACTIS accounts and `/request-barang` accounts stay separated.
 */
export async function syncLegacyRequestBarangUsersIfAny(): Promise<void> {
  try {
    const legacyUsers = await prisma.user.findMany({
      where: { role: REQUEST_BARANG_ROLE },
      select: {
        id: true,
        nama: true,
        email: true,
        username: true,
        password_hash: true,
        request_barang_access: true,
      },
    });
    if (legacyUsers.length === 0) return;

    for (const u of legacyUsers) {
      const cleanUsername = normalizeUsername(u.username || u.email.split("@")[0] || "");
      if (cleanUsername && isValidUsername(cleanUsername) && u.password_hash) {
        const existing = await prisma.requestBarangAccount.findUnique({
          where: { username: cleanUsername },
          select: { id: true },
        });
        if (!existing) {
          await prisma.requestBarangAccount.create({
            data: {
              id: u.id,
              nama: u.nama,
              username: cleanUsername,
              password_hash: u.password_hash,
              is_active: u.request_barang_access !== false,
            },
          });
        }
      }

      // Remove cleanly from ACTIS `users` only when no relational dashboard history exists
      await prisma.user.delete({ where: { id: u.id } }).catch(() => null);
    }
  } catch (err) {
    console.error("Failed syncing legacy request_barang users:", err);
  }
}

/**
 * Looks up an isolated portal account for `/request-barang` strictly by username.
 * Rejects email addresses (`@`) so login remains username-only.
 */
export async function findRequestBarangAccountByUsername(rawUsername: string) {
  const clean = normalizeUsername(rawUsername);
  if (!clean || clean.includes("@")) {
    return null;
  }

  return prisma.requestBarangAccount.findUnique({
    where: { username: clean },
    select: {
      id: true,
      nama: true,
      username: true,
      password_hash: true,
      is_active: true,
    },
  });
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
