import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ACTIS_ROLE_LEVELS,
  DEFAULT_ROLE_BADGE_CUSTOM,
  DEFAULT_ROLE_MENU_PERMISSIONS,
  buildAllRoleDefinitions,
  isDefaultRoleKey,
  normalizeAllRolesPermissions,
  normalizeCustomRolesList,
  normalizeRoleMenuPermissions,
  slugifyCustomRoleKey,
  type ActisRoleDefinition,
  type MenuAccessKey,
} from "@/lib/accessLevels";

export const ACCESS_LEVELS_SETTING_KEY = "actis_role_menu_permissions_v1";

const MIGRATED_NEW_MENUS: { key: MenuAccessKey; inheritFrom?: MenuAccessKey }[] = [
  { key: "ipam_private", inheritFrom: "ipam" },
  { key: "settings_email_gateway" },
];

export interface StoredAccessLevelsPayload {
  roles: Record<string, MenuAccessKey[]>;
  customRoles: ActisRoleDefinition[];
  rolesList: ActisRoleDefinition[];
  updatedAt: string | null;
  updatedBy: string | null;
}

function applyNewMenuMigrationIfNeeded(
  roles: Record<string, MenuAccessKey[]>,
  recordedMigrations: unknown
): Record<string, MenuAccessKey[]> {
  const migratedSet = new Set<string>(
    Array.isArray(recordedMigrations)
      ? recordedMigrations.filter((x): x is string => typeof x === "string")
      : []
  );

  const pending = MIGRATED_NEW_MENUS.filter((m) => !migratedSet.has(m.key));
  if (pending.length === 0) return roles;

  const updated: Record<string, MenuAccessKey[]> = {};
  for (const [roleKey, list] of Object.entries(roles)) {
    const nextSet = new Set<MenuAccessKey>(list);
    for (const entry of pending) {
      if (roleKey === "admin" || (entry.inheritFrom && nextSet.has(entry.inheritFrom))) {
        nextSet.add(entry.key);
      }
    }
    updated[roleKey] = normalizeRoleMenuPermissions(roleKey, Array.from(nextSet));
  }
  return updated;
}

export async function getStoredAccessLevels(): Promise<StoredAccessLevelsPayload> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: ACCESS_LEVELS_SETTING_KEY },
  });

  if (!row || !row.value) {
    const rolesList = buildAllRoleDefinitions([]);
    return {
      roles: normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS, []),
      customRoles: [],
      rolesList,
      updatedAt: null,
      updatedBy: null,
    };
  }

  try {
    const parsed = JSON.parse(row.value);
    const customRoles = normalizeCustomRolesList(parsed?.customRoles);
    const rawRoles = parsed?.roles ?? parsed;
    const normalizedRoles = normalizeAllRolesPermissions(rawRoles, customRoles);
    const roles = applyNewMenuMigrationIfNeeded(normalizedRoles, parsed?.migratedMenus);
    return {
      roles,
      customRoles,
      rolesList: buildAllRoleDefinitions(customRoles),
      updatedAt:
        typeof parsed?.updatedAt === "string"
          ? parsed.updatedAt
          : row.updated_at.toISOString(),
      updatedBy:
        typeof parsed?.updatedBy === "string" ? parsed.updatedBy : null,
    };
  } catch {
    return {
      roles: normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS, []),
      customRoles: [],
      rolesList: buildAllRoleDefinitions([]),
      updatedAt: row.updated_at.toISOString(),
      updatedBy: null,
    };
  }
}

async function persistAccessLevelsState(
  customRoles: ActisRoleDefinition[],
  roles: Record<string, MenuAccessKey[]>,
  actorName?: string | null
): Promise<StoredAccessLevelsPayload> {
  const cleanCustom = normalizeCustomRolesList(customRoles);
  const normalizedRoles = normalizeAllRolesPermissions(roles, cleanCustom);
  const nowIso = new Date().toISOString();

  const dbPayload = {
    customRoles: cleanCustom,
    roles: normalizedRoles,
    migratedMenus: MIGRATED_NEW_MENUS.map((m) => m.key),
    updatedAt: nowIso,
    updatedBy: actorName || "Administrator",
  };

  await prisma.systemSetting.upsert({
    where: { key: ACCESS_LEVELS_SETTING_KEY },
    update: { value: JSON.stringify(dbPayload) },
    create: {
      key: ACCESS_LEVELS_SETTING_KEY,
      value: JSON.stringify(dbPayload),
    },
  });

  return {
    roles: normalizedRoles,
    customRoles: cleanCustom,
    rolesList: buildAllRoleDefinitions(cleanCustom),
    updatedAt: nowIso,
    updatedBy: actorName || "Administrator",
  };
}

export async function saveStoredAccessLevels(
  nextRoles: unknown,
  actorName?: string | null
): Promise<StoredAccessLevelsPayload> {
  const current = await getStoredAccessLevels();
  return persistAccessLevelsState(
    current.customRoles,
    normalizeAllRolesPermissions(nextRoles, current.customRoles),
    actorName
  );
}

export async function resetStoredAccessLevels(
  targetRole?: string | null,
  actorName?: string | null
): Promise<StoredAccessLevelsPayload> {
  const current = await getStoredAccessLevels();

  if (targetRole) {
    if (isDefaultRoleKey(targetRole)) {
      const merged = {
        ...current.roles,
        [targetRole]: [...DEFAULT_ROLE_MENU_PERMISSIONS[targetRole]],
      };
      return persistAccessLevelsState(current.customRoles, merged, actorName);
    }

    if (current.customRoles.some((r) => r.key === targetRole)) {
      const merged = {
        ...current.roles,
        [targetRole]: [] as MenuAccessKey[],
      };
      return persistAccessLevelsState(current.customRoles, merged, actorName);
    }
  }

  return persistAccessLevelsState(
    current.customRoles,
    normalizeAllRolesPermissions(DEFAULT_ROLE_MENU_PERMISSIONS, current.customRoles),
    actorName
  );
}

export async function createCustomRoleLevel(
  input: {
    name: string;
    copyFromRole?: string | null;
    description?: string | null;
  },
  actorName?: string | null
): Promise<{
  createdRole: ActisRoleDefinition;
  state: StoredAccessLevelsPayload;
}> {
  const cleanName = String(input.name || "").trim();
  if (cleanName.length < 2) {
    throw new Error("Nama level user minimal harus terdiri dari 2 karakter.");
  }
  if (cleanName.length > 50) {
    throw new Error("Nama level user maksimal 50 karakter.");
  }

  const current = await getStoredAccessLevels();
  const allDefs = buildAllRoleDefinitions(current.customRoles);

  const duplicateLabel = allDefs.find(
    (r) => r.label.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicateLabel) {
    throw new Error(`Level user "${cleanName}" sudah tersedia.`);
  }

  const newKey = slugifyCustomRoleKey(
    cleanName,
    allDefs.map((r) => r.key)
  );

  const copySource = String(input.copyFromRole || "").trim();
  const copiedMenus =
    copySource && copySource !== "empty" && current.roles[copySource]
      ? normalizeRoleMenuPermissions(newKey, current.roles[copySource])
      : ([] as MenuAccessKey[]);

  const newDef: ActisRoleDefinition = {
    key: newKey,
    label: cleanName,
    description:
      input.description && input.description.trim()
        ? input.description.trim().slice(0, 160)
        : `Level akses kustom (${cleanName}).`,
    badgeClass: DEFAULT_ROLE_BADGE_CUSTOM,
    isDefault: false,
  };

  const nextCustomRoles = [...current.customRoles, newDef];
  const nextRoles = {
    ...current.roles,
    [newKey]: copiedMenus,
  };

  const state = await persistAccessLevelsState(nextCustomRoles, nextRoles, actorName);
  return {
    createdRole: newDef,
    state,
  };
}

export async function deleteCustomRoleLevel(
  roleKey: string,
  actorName?: string | null
): Promise<{
  deletedRole: ActisRoleDefinition;
  state: StoredAccessLevelsPayload;
}> {
  const cleanKey = String(roleKey || "").trim();
  if (!cleanKey) {
    throw new Error("Key level user wajib diisi.");
  }

  if (isDefaultRoleKey(cleanKey)) {
    const def = DEFAULT_ACTIS_ROLE_LEVELS.find((r) => r.key === cleanKey);
    throw new Error(
      `Level default "${def?.label || cleanKey}" dilindungi dan tidak dapat dihapus.`
    );
  }

  const current = await getStoredAccessLevels();
  const target = current.customRoles.find((r) => r.key === cleanKey);
  if (!target) {
    throw new Error("Level user buatan sendiri tidak ditemukan.");
  }

  const assignedUsersCount = await prisma.user.count({
    where: {
      role: cleanKey,
      email: { not: "system.archived@actis.internal" },
    },
  });

  if (assignedUsersCount > 0) {
    throw new Error(
      `Level "${target.label}" masih digunakan oleh ${assignedUsersCount} akun. Ubah level akun tersebut terlebih dahulu di Pengaturan User Akses.`
    );
  }

  const nextCustomRoles = current.customRoles.filter((r) => r.key !== cleanKey);
  const nextRoles = { ...current.roles };
  delete nextRoles[cleanKey];

  const state = await persistAccessLevelsState(nextCustomRoles, nextRoles, actorName);
  return {
    deletedRole: target,
    state,
  };
}

export async function isValidDashboardRole(roleKey: string): Promise<boolean> {
  if (!roleKey || roleKey === "request_barang") return false;
  if (isDefaultRoleKey(roleKey)) return true;
  const current = await getStoredAccessLevels();
  return current.customRoles.some((r) => r.key === roleKey);
}

export function getAllowedMenusForRole(
  rolesMap: Record<string, MenuAccessKey[]>,
  role: string
): MenuAccessKey[] {
  if (role && Array.isArray(rolesMap[role])) {
    return normalizeRoleMenuPermissions(role, rolesMap[role]);
  }
  return [];
}
