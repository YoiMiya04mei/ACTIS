import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ROLE_MENU_PERMISSIONS,
  normalizeAllRolesPermissions,
  type ActisRoleKey,
  type MenuAccessKey,
  isValidActisRoleKey,
} from "@/lib/accessLevels";

export const ACCESS_LEVELS_SETTING_KEY = "actis_role_menu_permissions_v1";

export interface StoredAccessLevelsPayload {
  roles: Record<ActisRoleKey, MenuAccessKey[]>;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function getStoredAccessLevels(): Promise<StoredAccessLevelsPayload> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: ACCESS_LEVELS_SETTING_KEY },
  });

  if (!row || !row.value) {
    return {
      roles: normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS),
      updatedAt: null,
      updatedBy: null,
    };
  }

  try {
    const parsed = JSON.parse(row.value);
    const rawRoles = parsed?.roles ?? parsed;
    return {
      roles: normalizeAllRolesPermissions(rawRoles),
      updatedAt:
        typeof parsed?.updatedAt === "string"
          ? parsed.updatedAt
          : row.updated_at.toISOString(),
      updatedBy:
        typeof parsed?.updatedBy === "string" ? parsed.updatedBy : null,
    };
  } catch {
    return {
      roles: normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS),
      updatedAt: row.updated_at.toISOString(),
      updatedBy: null,
    };
  }
}

export async function saveStoredAccessLevels(
  nextRoles: unknown,
  actorName?: string | null
): Promise<StoredAccessLevelsPayload> {
  const normalized = normalizeAllRolesPermissions(nextRoles);
  const nowIso = new Date().toISOString();
  const payload = {
    roles: normalized,
    updatedAt: nowIso,
    updatedBy: actorName || "Administrator",
  };

  await prisma.systemSetting.upsert({
    where: { key: ACCESS_LEVELS_SETTING_KEY },
    update: { value: JSON.stringify(payload) },
    create: {
      key: ACCESS_LEVELS_SETTING_KEY,
      value: JSON.stringify(payload),
    },
  });

  return payload;
}

export async function resetStoredAccessLevels(
  targetRole?: string | null,
  actorName?: string | null
): Promise<StoredAccessLevelsPayload> {
  if (targetRole && isValidActisRoleKey(targetRole)) {
    const current = await getStoredAccessLevels();
    const merged = {
      ...current.roles,
      [targetRole]: [...DEFAULT_ROLE_MENU_PERMISSIONS[targetRole]],
    };
    return saveStoredAccessLevels(merged, actorName);
  }

  return saveStoredAccessLevels(DEFAULT_ROLE_MENU_PERMISSIONS, actorName);
}

export function getAllowedMenusForRole(
  rolesMap: Record<ActisRoleKey, MenuAccessKey[]>,
  role: string
): MenuAccessKey[] {
  if (isValidActisRoleKey(role)) {
    return rolesMap[role];
  }
  return ["dashboard"];
}
