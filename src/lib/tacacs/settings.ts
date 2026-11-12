import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/backupCrypto";

export const SETTING_KEY_TACACS_SERVER = "tacacs_server_settings";

export interface TacacsServerSettings {
  enabled: boolean;
  bind_host: string;
  port: number;
  allow_unencrypted: boolean;
  require_registered_client: boolean;
  default_secret_enc: string | null;
  default_enable_password_enc: string | null;
  allow_actis_users_fallback: boolean;
  log_retention_days: number;
  socket_timeout_ms: number;
}

export interface TacacsServerPublicSettings {
  enabled: boolean;
  bind_host: string;
  port: number;
  allow_unencrypted: boolean;
  require_registered_client: boolean;
  has_default_secret: boolean;
  default_secret_masked: string;
  has_default_enable_password: boolean;
  default_enable_password_masked: string;
  allow_actis_users_fallback: boolean;
  log_retention_days: number;
  socket_timeout_ms: number;
}

const DEFAULT_TACACS_PORT = (() => {
  const raw = Number(process.env.TACACS_PORT);
  return Number.isInteger(raw) && raw >= 1 && raw <= 65535 ? raw : 49;
})();

export const DEFAULT_TACACS_SETTINGS: TacacsServerSettings = {
  enabled: true,
  bind_host: "0.0.0.0",
  port: DEFAULT_TACACS_PORT,
  allow_unencrypted: false,
  require_registered_client: true,
  default_secret_enc: null,
  default_enable_password_enc: null,
  allow_actis_users_fallback: false,
  log_retention_days: 90,
  socket_timeout_ms: 15000,
};

export async function getTacacsSettings(): Promise<TacacsServerSettings> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_TACACS_SERVER },
    });
    if (!row?.value) return DEFAULT_TACACS_SETTINGS;
    const parsed = JSON.parse(row.value);
    const portNum = Number(parsed.port);
    return {
      ...DEFAULT_TACACS_SETTINGS,
      ...parsed,
      port: Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535 ? portNum : DEFAULT_TACACS_PORT,
      log_retention_days: Math.max(1, Math.min(3650, Number(parsed.log_retention_days) || 90)),
      socket_timeout_ms: Math.max(3000, Math.min(120000, Number(parsed.socket_timeout_ms) || 15000)),
    };
  } catch (err) {
    console.error("[TACACS+] Failed to read tacacs_server_settings:", err);
    return DEFAULT_TACACS_SETTINGS;
  }
}

export function toPublicTacacsSettings(s: TacacsServerSettings): TacacsServerPublicSettings {
  return {
    enabled: s.enabled,
    bind_host: s.bind_host,
    port: s.port,
    allow_unencrypted: s.allow_unencrypted,
    require_registered_client: s.require_registered_client,
    has_default_secret: Boolean(s.default_secret_enc),
    default_secret_masked: maskSecret(s.default_secret_enc),
    has_default_enable_password: Boolean(s.default_enable_password_enc),
    default_enable_password_masked: maskSecret(s.default_enable_password_enc),
    allow_actis_users_fallback: s.allow_actis_users_fallback,
    log_retention_days: s.log_retention_days,
    socket_timeout_ms: s.socket_timeout_ms,
  };
}

export async function saveTacacsSettings(input: {
  enabled?: boolean;
  bind_host?: string;
  port?: number;
  allow_unencrypted?: boolean;
  require_registered_client?: boolean;
  default_secret?: string | null;
  clear_default_secret?: boolean;
  default_enable_password?: string | null;
  clear_default_enable_password?: boolean;
  allow_actis_users_fallback?: boolean;
  log_retention_days?: number;
  socket_timeout_ms?: number;
}): Promise<TacacsServerSettings> {
  const current = await getTacacsSettings();

  let defaultSecretEnc = current.default_secret_enc;
  if (input.clear_default_secret) {
    defaultSecretEnc = null;
  } else if (typeof input.default_secret === "string" && input.default_secret.length > 0) {
    defaultSecretEnc = encryptSecret(input.default_secret);
  }

  let defaultEnableEnc = current.default_enable_password_enc;
  if (input.clear_default_enable_password) {
    defaultEnableEnc = null;
  } else if (
    typeof input.default_enable_password === "string" &&
    input.default_enable_password.length > 0
  ) {
    defaultEnableEnc = encryptSecret(input.default_enable_password);
  }

  const nextPort =
    input.port !== undefined && Number.isInteger(Number(input.port))
      ? Math.max(1, Math.min(65535, Number(input.port)))
      : current.port;

  const updated: TacacsServerSettings = {
    enabled: input.enabled ?? current.enabled,
    bind_host: (input.bind_host ?? current.bind_host).trim() || "0.0.0.0",
    port: nextPort,
    allow_unencrypted: input.allow_unencrypted ?? current.allow_unencrypted,
    require_registered_client:
      input.require_registered_client ?? current.require_registered_client,
    default_secret_enc: defaultSecretEnc,
    default_enable_password_enc: defaultEnableEnc,
    allow_actis_users_fallback:
      input.allow_actis_users_fallback ?? current.allow_actis_users_fallback,
    log_retention_days:
      input.log_retention_days !== undefined
        ? Math.max(1, Math.min(3650, Number(input.log_retention_days) || 90))
        : current.log_retention_days,
    socket_timeout_ms:
      input.socket_timeout_ms !== undefined
        ? Math.max(3000, Math.min(120000, Number(input.socket_timeout_ms) || 15000))
        : current.socket_timeout_ms,
  };

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_TACACS_SERVER },
    update: { value: JSON.stringify(updated) },
    create: { key: SETTING_KEY_TACACS_SERVER, value: JSON.stringify(updated) },
  });

  return updated;
}

export function getPlainDefaultSecret(settings: TacacsServerSettings): string | null {
  return decryptSecret(settings.default_secret_enc);
}

export function getPlainDefaultEnablePassword(settings: TacacsServerSettings): string | null {
  return decryptSecret(settings.default_enable_password_enc);
}

export const DEFAULT_GROUP_PRESETS = [
  {
    name: "netadmin-full",
    description: "Full Administrator (Privilege 15) - Diizinkan menjalankan semua perintah CLI.",
    privilege_level: 15,
    default_policy: "permit",
    command_rules: [
      { id: "r1", action: "permit", pattern: ".*", description: "Izinkan seluruh perintah CLI" },
    ],
    service_attrs: [
      { key: "Mikrotik-Group", value: "full" },
      { key: "Juniper-Local-User-Name", value: "super-user" },
    ],
  },
  {
    name: "noc-operator",
    description: "NOC Engineer (Privilege 7) - Diizinkan monitoring, diagnostic, dan konfigurasi interface non-destruktif.",
    privilege_level: 7,
    default_policy: "deny",
    command_rules: [
      { id: "r1", action: "deny", pattern: "^(reload|reboot|write erase|erase|format|reset|delete|shutdown)", description: "Blokir perintah destruktif / reboot" },
      { id: "r2", action: "permit", pattern: "^(show|display|ping|traceroute|tracert|terminal|exit|quit|enable)", description: "Izinkan diagnostic & show" },
      { id: "r3", action: "permit", pattern: "^(configure|interface|description|no shutdown)", description: "Izinkan konfigurasi terbatas" },
    ],
    service_attrs: [
      { key: "Mikrotik-Group", value: "write" },
      { key: "Juniper-Local-User-Name", value: "operator" },
    ],
  },
  {
    name: "readonly-audit",
    description: "Read-Only Audit (Privilege 1) - Hanya perintah show/display/ping/traceroute.",
    privilege_level: 1,
    default_policy: "deny",
    command_rules: [
      { id: "r1", action: "permit", pattern: "^(show|display|ping|traceroute|tracert|exit|quit|terminal length)", description: "Hanya perintah read-only" },
    ],
    service_attrs: [
      { key: "Mikrotik-Group", value: "read" },
      { key: "Juniper-Local-User-Name", value: "read-only" },
    ],
  },
];

export async function seedDefaultTacacsGroupsIfEmpty(): Promise<number> {
  const count = await prisma.tacacsGroup.count();
  if (count > 0) return 0;

  let created = 0;
  for (const preset of DEFAULT_GROUP_PRESETS) {
    await prisma.tacacsGroup.create({
      data: {
        name: preset.name,
        description: preset.description,
        privilege_level: preset.privilege_level,
        default_policy: preset.default_policy,
        command_rules: JSON.stringify(preset.command_rules),
        service_attrs: JSON.stringify(preset.service_attrs),
        is_active: true,
      },
    });
    created++;
  }
  return created;
}

