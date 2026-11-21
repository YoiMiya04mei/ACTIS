export type ActisDefaultRoleKey =
  | "admin"
  | "noc_engineer"
  | "field_engineer"
  | "sales_corporate"
  | "warehouse_admin";

export type ActisRoleKey = ActisDefaultRoleKey | (string & {});

export type MenuAccessKey =
  | "dashboard"
  | "orders"
  | "tools_hub"
  | "queue"
  | "pop_sites"
  | "enterprise"
  | "ipam"
  | "ipam_private"
  | "vlan"
  | "monitoring"
  | "dcim_racks"
  | "dcim_otbs"
  | "inv_dashboard"
  | "inv_items"
  | "inv_stock"
  | "inv_in"
  | "inv_out"
  | "inv_in_use"
  | "inv_returns"
  | "inv_form_barang"
  | "inv_history"
  | "inv_reports"
  | "inv_settings"
  | "inv_mirror"
  | "tools_mikrotik"
  | "tools_traffic_qos"
  | "tools_huawei"
  | "tools_documents"
  | "tools_templates"
  | "tools_history"
  | "backups"
  | "tacacs"
  | "admin_sync"
  | "settings_users"
  | "settings_access_levels"
  | "logs"
  | "admin_updates";

export interface ActisRoleDefinition {
  key: string;
  label: string;
  description: string;
  badgeClass: string;
  isDefault: boolean;
}

export interface ActisMenuItemDefinition {
  key: MenuAccessKey;
  label: string;
  href: string;
  alwaysLocked?: boolean;
  adminLocked?: boolean;
}

export interface ActisMenuCategoryDefinition {
  key: string;
  label: string;
  items: ActisMenuItemDefinition[];
}

export const DEFAULT_ROLE_BADGE_CUSTOM =
  "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";

export const DEFAULT_ACTIS_ROLE_LEVELS: readonly ActisRoleDefinition[] = [
  {
    key: "admin",
    label: "Administrator",
    description: "Akses penuh manajemen sistem, keamanan, user & seluruh modul.",
    badgeClass:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    isDefault: true,
  },
  {
    key: "noc_engineer",
    label: "NOC Engineer",
    description: "Operasional jaringan, antrean provisioning, backup config, & TACACS+.",
    badgeClass:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    isDefault: true,
  },
  {
    key: "field_engineer",
    label: "Field Engineer",
    description: "Teknisi lapangan, pengecekan POP/Enterprise, & pengembalian barang.",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    isDefault: true,
  },
  {
    key: "sales_corporate",
    label: "Sales Corporate",
    description: "Input order provisioning, monitoring status antrean, & dokumen NOC.",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    isDefault: true,
  },
  {
    key: "warehouse_admin",
    label: "Admin Gudang",
    description: "Manajemen master barang, stok masuk/keluar, retur, & Form Barang.",
    badgeClass:
      "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    isDefault: true,
  },
];

// Preserved export alias for backward compatibility
export const ACTIS_ROLE_LEVELS = DEFAULT_ACTIS_ROLE_LEVELS;

export const ACTIS_ACCESS_CATEGORIES: readonly ActisMenuCategoryDefinition[] = [
  {
    key: "utama",
    label: "Utama",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard" },
      { key: "orders", label: "Order & Progress", href: "/orders/new" },
      { key: "tools_hub", label: "Portal Tools Hub", href: "/tools" },
    ],
  },
  {
    key: "layanan",
    label: "Layanan & POP Site",
    items: [
      { key: "queue", label: "List Antrean", href: "/queue" },
      { key: "pop_sites", label: "List POP Site", href: "/pop-sites" },
      { key: "enterprise", label: "List Enterprise", href: "/enterprise" },
      { key: "ipam", label: "Prefix IP Public", href: "/ipam" },
      { key: "ipam_private", label: "Prefix IP Private", href: "/ipam-private" },
      { key: "vlan", label: "VLAN Management", href: "/vlan" },
      { key: "monitoring", label: "ICMP Ping Monitor", href: "/monitoring" },
      { key: "dcim_racks", label: "Database Rack 3D", href: "/dcim/racks" },
      { key: "dcim_otbs", label: "Database OTB 3D", href: "/dcim/otbs" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory Management",
    items: [
      { key: "inv_dashboard", label: "Dashboard Inventory", href: "/inventory/dashboard" },
      { key: "inv_items", label: "Master Barang", href: "/inventory/items" },
      { key: "inv_stock", label: "Stok Inventory", href: "/inventory/stock" },
      { key: "inv_in", label: "Barang Masuk", href: "/inventory/transactions/in" },
      { key: "inv_out", label: "Barang Keluar", href: "/inventory/transactions/out" },
      { key: "inv_in_use", label: "Barang Sedang Digunakan", href: "/inventory/in-use" },
      { key: "inv_returns", label: "Pengembalian Barang", href: "/inventory/returns" },
      { key: "inv_form_barang", label: "Generate Form Barang", href: "/inventory/form-barang" },
      { key: "inv_history", label: "Riwayat Transaksi", href: "/inventory/history" },
      { key: "inv_reports", label: "Laporan Inventory", href: "/inventory/reports" },
      { key: "inv_settings", label: "Pengaturan Inventory", href: "/inventory/settings" },
      { key: "inv_mirror", label: "Mirror Drive / Sheets", href: "/inventory/mirror" },
    ],
  },
  {
    key: "tools",
    label: "Tools & Generator",
    items: [
      { key: "tools_mikrotik", label: "MikroTik Tools", href: "/tools/mikrotik" },
      { key: "tools_traffic_qos", label: "Traffic QoS", href: "/tools/traffic-qos" },
      { key: "tools_huawei", label: "Aktivasi Huawei", href: "/tools/huawei" },
      { key: "tools_documents", label: "Dokumen & Surat", href: "/tools/documents" },
      { key: "tools_templates", label: "Template Surat", href: "/tools/templates" },
      { key: "tools_history", label: "Arsip Dokumen", href: "/tools/documents/history" },
    ],
  },
  {
    key: "backup_network",
    label: "Backup & Jaringan AAA",
    items: [
      { key: "backups", label: "Backup Config", href: "/backups" },
      { key: "tacacs", label: "TACACS+ Server", href: "/tacacs" },
    ],
  },
  {
    key: "sistem",
    label: "Integrasi & Sistem",
    items: [
      { key: "admin_sync", label: "Sheets Sync & Admin", href: "/admin/sync" },
      {
        key: "settings_users",
        label: "Pengaturan User Akses",
        href: "/settings/users",
        adminLocked: true,
      },
      {
        key: "settings_access_levels",
        label: "Level Akses",
        href: "/settings/access-levels",
        adminLocked: true,
      },
      { key: "logs", label: "Log Aplikasi", href: "/logs" },
      { key: "admin_updates", label: "Update & Changelog", href: "/admin/updates" },
    ],
  },
];

export const ALL_ACTIS_MENU_ITEMS: readonly ActisMenuItemDefinition[] =
  ACTIS_ACCESS_CATEGORIES.flatMap((c) => c.items);

export const ALL_ACTIS_MENU_KEYS: readonly MenuAccessKey[] = ALL_ACTIS_MENU_ITEMS.map(
  (m) => m.key
);

const VALID_MENU_KEY_SET = new Set<string>(ALL_ACTIS_MENU_KEYS);
const DEFAULT_ROLE_KEY_SET = new Set<string>(
  DEFAULT_ACTIS_ROLE_LEVELS.map((r) => r.key)
);
const RESERVED_ROLE_KEYS = new Set<string>([
  "request_barang",
  "administrator",
  "system",
  "empty",
  "all",
  "null",
  "undefined",
]);

export function isDefaultRoleKey(role: string): role is ActisDefaultRoleKey {
  return DEFAULT_ROLE_KEY_SET.has(role);
}

export function isValidActisRoleKey(role: string): role is ActisDefaultRoleKey {
  return isDefaultRoleKey(role);
}

export function isValidMenuAccessKey(key: string): key is MenuAccessKey {
  return VALID_MENU_KEY_SET.has(key);
}

export function slugifyCustomRoleKey(
  rawName: string,
  existingKeys: Iterable<string>
): string {
  const existingSet = new Set<string>(existingKeys);
  let base = String(rawName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (base.length < 2) {
    base = `custom_${Date.now().toString(36)}`;
  }
  if (RESERVED_ROLE_KEYS.has(base) || DEFAULT_ROLE_KEY_SET.has(base)) {
    base = `custom_${base}`;
  }

  let candidate = base.slice(0, 48);
  let counter = 2;
  while (
    existingSet.has(candidate) ||
    RESERVED_ROLE_KEYS.has(candidate) ||
    DEFAULT_ROLE_KEY_SET.has(candidate)
  ) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, Math.max(2, 48 - suffix.length))}${suffix}`;
    counter += 1;
  }
  return candidate;
}

export function isMenuLockedForRole(role: string, menuKey: MenuAccessKey): boolean {
  const item = ALL_ACTIS_MENU_ITEMS.find((m) => m.key === menuKey);
  if (!item) return false;
  if (item.alwaysLocked) return true;
  if (role === "admin" && item.adminLocked) return true;
  return false;
}

export const DEFAULT_ROLE_MENU_PERMISSIONS: Record<
  ActisDefaultRoleKey,
  MenuAccessKey[]
> = {
  admin: [...ALL_ACTIS_MENU_KEYS],
  noc_engineer: [
    "dashboard",
    "orders",
    "tools_hub",
    "queue",
    "pop_sites",
    "enterprise",
    "ipam",
    "ipam_private",
    "vlan",
    "monitoring",
    "dcim_racks",
    "dcim_otbs",
    "inv_dashboard",
    "inv_items",
    "inv_stock",
    "inv_in",
    "inv_out",
    "inv_in_use",
    "inv_returns",
    "inv_form_barang",
    "inv_history",
    "inv_reports",
    "tools_mikrotik",
    "tools_traffic_qos",
    "tools_documents",
    "tools_history",
    "backups",
    "tacacs",
    "admin_sync",
    "settings_users",
    "logs",
    "admin_updates",
  ],
  field_engineer: [
    "dashboard",
    "tools_hub",
    "queue",
    "pop_sites",
    "enterprise",
    "monitoring",
    "inv_dashboard",
    "inv_items",
    "inv_stock",
    "inv_in_use",
    "inv_returns",
    "inv_form_barang",
    "tools_documents",
    "tools_history",
    "settings_users",
  ],
  sales_corporate: [
    "dashboard",
    "orders",
    "tools_hub",
    "queue",
    "pop_sites",
    "enterprise",
    "monitoring",
    "inv_dashboard",
    "inv_items",
    "inv_stock",
    "inv_reports",
    "tools_documents",
    "tools_history",
    "settings_users",
  ],
  warehouse_admin: [
    "dashboard",
    "inv_dashboard",
    "inv_items",
    "inv_stock",
    "inv_in",
    "inv_out",
    "inv_in_use",
    "inv_returns",
    "inv_form_barang",
    "inv_history",
    "inv_reports",
    "inv_mirror",
    "settings_users",
  ],
};

export function normalizeRoleMenuPermissions(
  role: string,
  rawList: unknown
): MenuAccessKey[] {
  const defaultList = isDefaultRoleKey(role)
    ? DEFAULT_ROLE_MENU_PERMISSIONS[role]
    : ([] as MenuAccessKey[]);

  const baseList = Array.isArray(rawList)
    ? rawList.filter((k): k is MenuAccessKey => typeof k === "string" && isValidMenuAccessKey(k))
    : defaultList;

  const allowedSet = new Set<MenuAccessKey>(baseList);
  for (const item of ALL_ACTIS_MENU_ITEMS) {
    if (isMenuLockedForRole(role, item.key)) {
      allowedSet.add(item.key);
    }
  }

  return ALL_ACTIS_MENU_KEYS.filter((k) => allowedSet.has(k));
}

export function normalizeCustomRolesList(
  rawCustomRoles: unknown
): ActisRoleDefinition[] {
  if (!Array.isArray(rawCustomRoles)) return [];

  const seenKeys = new Set<string>(DEFAULT_ROLE_KEY_SET);
  const result: ActisRoleDefinition[] = [];

  for (const item of rawCustomRoles) {
    if (!item || typeof item !== "object") continue;
    const rawKey = typeof (item as { key?: unknown }).key === "string"
      ? (item as { key: string }).key.trim().toLowerCase()
      : "";
    const rawLabel = typeof (item as { label?: unknown }).label === "string"
      ? (item as { label: string }).label.trim()
      : "";

    if (!rawKey || !rawLabel) continue;
    if (seenKeys.has(rawKey) || RESERVED_ROLE_KEYS.has(rawKey)) continue;
    if (!/^[a-z0-9_]{2,48}$/.test(rawKey)) continue;

    seenKeys.add(rawKey);
    result.push({
      key: rawKey,
      label: rawLabel.slice(0, 60),
      description:
        typeof (item as { description?: unknown }).description === "string" &&
          (item as { description: string }).description.trim()
          ? (item as { description: string }).description.trim().slice(0, 160)
          : `Level akses kustom "${rawLabel.slice(0, 60)}".`,
      badgeClass:
        typeof (item as { badgeClass?: unknown }).badgeClass === "string" &&
          (item as { badgeClass: string }).badgeClass.trim()
          ? (item as { badgeClass: string }).badgeClass.trim()
          : DEFAULT_ROLE_BADGE_CUSTOM,
      isDefault: false,
    });
  }

  return result;
}

export function buildAllRoleDefinitions(
  customRoles: readonly ActisRoleDefinition[] = []
): ActisRoleDefinition[] {
  return [...DEFAULT_ACTIS_ROLE_LEVELS, ...customRoles];
}

export function normalizeAllRolesPermissions(
  rawMap: unknown,
  customRoles: readonly ActisRoleDefinition[] = []
): Record<string, MenuAccessKey[]> {
  const input =
    rawMap && typeof rawMap === "object" ? (rawMap as Record<string, unknown>) : {};

  const out: Record<string, MenuAccessKey[]> = {
    admin: normalizeRoleMenuPermissions("admin", input.admin ?? DEFAULT_ROLE_MENU_PERMISSIONS.admin),
    noc_engineer: normalizeRoleMenuPermissions(
      "noc_engineer",
      input.noc_engineer ?? DEFAULT_ROLE_MENU_PERMISSIONS.noc_engineer
    ),
    field_engineer: normalizeRoleMenuPermissions(
      "field_engineer",
      input.field_engineer ?? DEFAULT_ROLE_MENU_PERMISSIONS.field_engineer
    ),
    sales_corporate: normalizeRoleMenuPermissions(
      "sales_corporate",
      input.sales_corporate ?? DEFAULT_ROLE_MENU_PERMISSIONS.sales_corporate
    ),
    warehouse_admin: normalizeRoleMenuPermissions(
      "warehouse_admin",
      input.warehouse_admin ?? DEFAULT_ROLE_MENU_PERMISSIONS.warehouse_admin
    ),
  };

  for (const cr of customRoles) {
    out[cr.key] = normalizeRoleMenuPermissions(cr.key, input[cr.key] ?? []);
  }

  return out;
}

export function getDefaultPermissionsForRole(role: string): MenuAccessKey[] {
  if (isDefaultRoleKey(role)) {
    return [...DEFAULT_ROLE_MENU_PERMISSIONS[role]];
  }
  return [];
}

/**
 * Returns the href of the first permitted menu item for a role's allowed menus,
 * or null if no menus are permitted.
 */
export function getFirstAccessibleHref(
  allowedMenus: readonly MenuAccessKey[]
): string | null {
  const allowedSet = new Set(allowedMenus);
  for (const item of ALL_ACTIS_MENU_ITEMS) {
    if (allowedSet.has(item.key)) {
      return item.href;
    }
  }
  return null;
}

/**
 * Resolves the default landing route based on permitted menus.
 * Preserves /queue when allowed, otherwise /dashboard, otherwise the first allowed menu href.
 */
export function resolveDefaultLandingHref(
  allowedMenus: readonly MenuAccessKey[]
): string | null {
  const allowedSet = new Set(allowedMenus);
  if (allowedSet.has("queue")) return "/queue";
  if (allowedSet.has("dashboard")) return "/dashboard";
  return getFirstAccessibleHref(allowedMenus);
}

export function findRoleDefinition(
  roleKey: string,
  roleList: readonly ActisRoleDefinition[] = DEFAULT_ACTIS_ROLE_LEVELS
): ActisRoleDefinition | undefined {
  return roleList.find((r) => r.key === roleKey);
}

/**
 * Resolves the required menu access key for an authenticated ACTIS page route.
 * Returns null for public routes or root paths without menu gating.
 */
export function getRequiredMenuForPathname(pathname: string | null | undefined): MenuAccessKey | null {
  if (!pathname) return null;
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (clean === "/" || clean === "/login" || clean === "/request-barang" || clean.startsWith("/request-barang/")) {
    return null;
  }

  if (clean === "/dashboard" || clean.startsWith("/dashboard/")) return "dashboard";
  if (clean === "/orders" || clean.startsWith("/orders/")) return "orders";
  if (clean === "/queue" || clean.startsWith("/queue/")) return "queue";
  if (clean.startsWith("/pop-sites")) return "pop_sites";
  if (clean.startsWith("/enterprise")) return "enterprise";
  if (clean === "/ipam-private" || clean.startsWith("/ipam-private/")) return "ipam_private";
  if (clean === "/ipam" || clean.startsWith("/ipam/")) return "ipam";
  if (clean.startsWith("/vlan")) return "vlan";
  if (clean.startsWith("/monitoring")) return "monitoring";
  if (clean.startsWith("/dcim/racks")) return "dcim_racks";
  if (clean.startsWith("/dcim/otbs")) return "dcim_otbs";

  if (clean === "/inventory" || clean.startsWith("/inventory/dashboard")) return "inv_dashboard";
  if (clean.startsWith("/inventory/items") || clean.startsWith("/inventory/categories")) return "inv_items";
  if (clean.startsWith("/inventory/stock")) return "inv_stock";
  if (clean.startsWith("/inventory/transactions/in")) return "inv_in";
  if (clean.startsWith("/inventory/transactions/out")) return "inv_out";
  if (clean.startsWith("/inventory/in-use")) return "inv_in_use";
  if (clean.startsWith("/inventory/returns")) return "inv_returns";
  if (clean.startsWith("/inventory/form-barang")) return "inv_form_barang";
  if (clean.startsWith("/inventory/history")) return "inv_history";
  if (clean.startsWith("/inventory/reports")) return "inv_reports";
  if (clean.startsWith("/inventory/settings")) return "inv_settings";
  if (clean.startsWith("/inventory/mirror")) return "inv_mirror";

  if (clean.startsWith("/tools/mikrotik")) return "tools_mikrotik";
  if (clean.startsWith("/tools/traffic-qos")) return "tools_traffic_qos";
  if (clean.startsWith("/tools/huawei")) return "tools_huawei";
  if (
    clean.startsWith("/tools/templates") ||
    clean.startsWith("/tools/documents/templates") ||
    clean === "/templates" ||
    clean.startsWith("/templates/")
  ) {
    return "tools_templates";
  }
  if (
    clean.startsWith("/tools/documents/history") ||
    clean === "/tools/history" ||
    clean.startsWith("/tools/history/")
  ) {
    return "tools_history";
  }
  if (clean.startsWith("/tools/documents")) return "tools_documents";
  if (clean === "/tools") return "tools_hub";

  if (clean.startsWith("/backups")) return "backups";
  if (clean.startsWith("/tacacs")) return "tacacs";

  if (clean.startsWith("/admin/sync")) return "admin_sync";
  if (clean.startsWith("/admin/updates")) return "admin_updates";
  if (clean === "/logs" || clean.startsWith("/logs/") || clean === "/admin/logs" || clean.startsWith("/admin/logs/")) {
    return "logs";
  }
  if (clean.startsWith("/settings/access-levels")) return "settings_access_levels";
  if (clean.startsWith("/settings/users")) return "settings_users";

  return null;
}
