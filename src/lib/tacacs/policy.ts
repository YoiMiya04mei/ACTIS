export interface TacacsCommandRule {
  id: string;
  action: "permit" | "deny";
  pattern: string;
  description?: string;
}

export interface TacacsServiceAttr {
  key: string;
  value: string;
}

export const TACACS_VENDORS = [
  { value: "cisco", label: "Cisco IOS / IOS-XE / NX-OS" },
  { value: "huawei", label: "Huawei VRP (NE40E / Switch)" },
  { value: "juniper", label: "Juniper Junos" },
  { value: "mikrotik", label: "MikroTik RouterOS" },
  { value: "arista", label: "Arista EOS" },
  { value: "fortinet", label: "Fortinet FortiGate" },
  { value: "custom", label: "Custom / Generic RFC 8907" },
] as const;

export function normalizeIpAddress(ip: string | null | undefined): string {
  if (!ip) return "";
  let trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    trimmed = trimmed.slice(7);
  }
  const zoneIdx = trimmed.indexOf("%");
  if (zoneIdx !== -1) {
    trimmed = trimmed.slice(0, zoneIdx);
  }
  if (trimmed === "::1") return "127.0.0.1";
  return trimmed;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const oct = Number(part);
    if (oct < 0 || oct > 255) return null;
    num = (num << 8) | oct;
  }
  return num >>> 0;
}

function isIPv4(ip: string): boolean {
  return ipv4ToInt(ip) !== null;
}

function isIPv6(ip: string): boolean {
  if (!ip.includes(":")) return false;
  const doubleColonParts = ip.split("::");
  if (doubleColonParts.length > 2) return false;
  const hasCompression = doubleColonParts.length === 2;
  const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const right = hasCompression && doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
  const groups = [...left, ...right];
  if (!hasCompression && groups.length !== 8) return false;
  if (hasCompression && groups.length >= 8) return false;
  return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

function isIP(ip: string): number {
  if (isIPv4(ip)) return 4;
  if (isIPv6(ip)) return 6;
  return 0;
}

export function isValidIpOrCidr(value: string): boolean {
  const raw = normalizeIpAddress(value);
  if (!raw) return false;
  if (raw.includes("/")) {
    const [ipPart, maskPart] = raw.split("/");
    if (!ipPart || maskPart === undefined || !/^\d{1,3}$/.test(maskPart)) return false;
    const prefix = Number(maskPart);
    if (isIPv4(ipPart)) {
      return prefix >= 0 && prefix <= 32;
    }
    if (isIPv6(ipPart)) {
      return prefix >= 0 && prefix <= 128;
    }
    return false;
  }
  return isIP(raw) !== 0;
}

export function matchIpOrCidr(sourceIp: string, ruleIpOrCidr: string): boolean {
  const src = normalizeIpAddress(sourceIp);
  const target = normalizeIpAddress(ruleIpOrCidr);
  if (!src || !target) return false;

  if (!target.includes("/")) {
    return src === target;
  }

  const [networkIp, prefixStr] = target.split("/");
  const prefix = Number(prefixStr);

  if (isIPv4(src) && isIPv4(networkIp)) {
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;
    if (prefix === 0) return true;
    const srcInt = ipv4ToInt(src);
    const netInt = ipv4ToInt(networkIp);
    if (srcInt === null || netInt === null) return false;
    const mask = prefix === 32 ? 0xffffffff : (~((1 << (32 - prefix)) - 1)) >>> 0;
    return (srcInt & mask) === (netInt & mask);
  }

  if (isIPv6(src) && isIPv6(networkIp)) {
    // Fallback exact prefix check for ::/0
    if (prefix === 0) return true;
    return src === networkIp;
  }

  return false;
}

export function parseCommandRules(raw: string | null | undefined): TacacsCommandRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.pattern === "string")
      .map((r, idx) => ({
        id: typeof r.id === "string" && r.id ? r.id : `rule-${idx + 1}`,
        action: r.action === "deny" ? "deny" : "permit",
        pattern: r.pattern.trim(),
        description: typeof r.description === "string" ? r.description : undefined,
      }));
  } catch {
    return [];
  }
}

export function parseServiceAttrs(raw: string | null | undefined): TacacsServiceAttr[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.key === "string" && a.key.trim().length > 0)
      .map((a) => ({
        key: a.key.trim(),
        value: String(a.value ?? "").trim(),
      }));
  } catch {
    return [];
  }
}

/**
 * Extract normalized CLI command and service from TACACS+ AV pairs.
 * Example AV-pairs: ["service=shell", "cmd=show", "cmd-arg=ip", "cmd-arg=bgp", "cmd-arg=<cr>"]
 */
export function extractArgsMetadata(args: string[]): {
  service: string;
  cmd: string | null;
  fullCommand: string | null;
  isShellLogin: boolean;
  elapsedSec: number | null;
  kvMap: Record<string, string>;
} {
  const kvMap: Record<string, string> = {};
  let service = "shell";
  let cmd: string | null = null;
  const cmdArgs: string[] = [];
  let elapsedSec: number | null = null;

  for (const arg of args) {
    const eqIdx = arg.indexOf("=");
    const starIdx = arg.indexOf("*");
    const sepIdx =
      eqIdx !== -1 && starIdx !== -1
        ? Math.min(eqIdx, starIdx)
        : eqIdx !== -1
          ? eqIdx
          : starIdx;

    if (sepIdx === -1) continue;
    const key = arg.slice(0, sepIdx).trim();
    const val = arg.slice(sepIdx + 1).trim();
    kvMap[key] = val;

    if (key === "service") {
      service = val || "shell";
    } else if (key === "cmd") {
      cmd = val;
    } else if (key === "cmd-arg") {
      if (val && val !== "<cr>") {
        cmdArgs.push(val);
      }
    } else if (key === "elapsed_time") {
      const n = parseInt(val, 10);
      if (!Number.isNaN(n)) elapsedSec = n;
    }
  }

  const isShellLogin = cmd === null || cmd === "";
  const fullCommand =
    cmd && cmd.length > 0 ? [cmd, ...cmdArgs].join(" ").trim() : null;

  return { service, cmd, fullCommand, isShellLogin, elapsedSec, kvMap };
}

function matchCommandPattern(command: string, pattern: string): boolean {
  const cleanPattern = pattern.trim();
  if (!cleanPattern) return false;
  if (cleanPattern === "*" || cleanPattern === ".*") return true;

  let regexStr = cleanPattern;
  if (cleanPattern.startsWith("/") && cleanPattern.endsWith("/") && cleanPattern.length > 2) {
    regexStr = cleanPattern.slice(1, -1);
  }

  try {
    const regex = new RegExp(regexStr, "i");
    return regex.test(command);
  } catch {
    return command.toLowerCase().startsWith(cleanPattern.toLowerCase());
  }
}

export function evaluateCommandAuthorization(params: {
  fullCommand: string;
  rules: TacacsCommandRule[];
  defaultPolicy: "permit" | "deny";
}): {
  allowed: boolean;
  reason: string;
  matchedRule?: TacacsCommandRule;
} {
  const command = params.fullCommand.trim();

  for (const rule of params.rules) {
    if (matchCommandPattern(command, rule.pattern)) {
      if (rule.action === "permit") {
        return {
          allowed: true,
          reason: `Diizinkan oleh rule: ${rule.pattern}`,
          matchedRule: rule,
        };
      }
      return {
        allowed: false,
        reason: `Ditolak oleh rule: ${rule.pattern}`,
        matchedRule: rule,
      };
    }
  }

  if (params.defaultPolicy === "permit") {
    return {
      allowed: true,
      reason: "Diizinkan oleh default policy grup (permit)",
    };
  }

  return {
    allowed: false,
    reason: "Ditolak oleh default policy grup (deny)",
  };
}

export function generateVendorCliSnippet(params: {
  vendor: string;
  serverIp: string;
  port: number;
  sharedSecret: string;
}): string {
  const { vendor, serverIp, port, sharedSecret } = params;
  const host = serverIp || "<IP_SERVER_ACTIS>";
  const key = sharedSecret || "<SHARED_SECRET>";
  const p = port || 49;

  switch (vendor) {
    case "cisco":
      return `! Cisco IOS / IOS-XE TACACS+ Configuration
aaa new-model
!
tacacs server ACTIS_TACACS
 address ipv4 ${host}
 port ${p}
 key ${key}
 timeout 5
!
aaa group server tacacs+ ACTIS_TACACS_GRP
 server name ACTIS_TACACS
!
aaa authentication login default group ACTIS_TACACS_GRP local
aaa authentication enable default group ACTIS_TACACS_GRP enable
aaa authorization exec default group ACTIS_TACACS_GRP local
aaa authorization commands 1 default group ACTIS_TACACS_GRP local
aaa authorization commands 15 default group ACTIS_TACACS_GRP local
aaa accounting exec default start-stop group ACTIS_TACACS_GRP
aaa accounting commands 15 default start-stop group ACTIS_TACACS_GRP`;

    case "huawei":
      return `# Huawei VRP (NE40E / CloudEngine / S-Series) TACACS+ Configuration
hwtacacs-server template actis_tacacs
 hwtacacs-server authentication ${host}${p !== 49 ? ` ${p}` : ""}
 hwtacacs-server authorization ${host}${p !== 49 ? ` ${p}` : ""}
 hwtacacs-server accounting ${host}${p !== 49 ? ` ${p}` : ""}
 hwtacacs-server shared-key cipher ${key}
 hwtacacs-server user-name original
 undo hwtacacs-server user-name domain-included
!
aaa
 authentication-scheme actis_auth
  authentication-mode hwtacacs local
 authorization-scheme actis_author
  authorization-mode hwtacacs local
  authorization-cmd 15 hwtacacs local
 accounting-scheme actis_acct
  accounting-mode hwtacacs
  accounting start-fail online
 recording-scheme actis_rec
  recording-mode hwtacacs actis_tacacs
 cmd recording-scheme actis_rec
 domain default_admin
  authentication-scheme actis_auth
  authorization-scheme actis_author
  accounting-scheme actis_acct
  hwtacacs-server actis_tacacs`;

    case "juniper":
      return `# Juniper Junos TACACS+ Configuration
set system authentication-order [ tacplus password ]
set system tacplus-server ${host} port ${p}
set system tacplus-server ${host} secret "${key}"
set system tacplus-server ${host} timeout 5
set system accounting events [ login change-log interactive-commands ]
set system accounting destination tacplus server ${host} secret "${key}"`;

    case "mikrotik":
      return `# MikroTik RouterOS TACACS+ Configuration (RouterOS v7.16+ / AAA Client)
# Catatan: Pastikan paket RouterOS mendukung TACACS+ atau gunakan IP/Secret sesuai NAS Client.
/system/logging/add topics=tacacs,info
# Jika menggunakan User-Manager / AAA TACACS+ (atau bridge via FreeRADIUS/TACACS):
# Server: ${host}:${p} | Secret: ${key}
# Group Attribute pada ACTIS Group: Mikrotik-Group=full`;

    case "arista":
      return `! Arista EOS TACACS+ Configuration
tacacs-server host ${host} port ${p} key ${key}
aaa authentication login default group tacacs+ local
aaa authentication enable default group tacacs+ local
aaa authorization exec default group tacacs+ local
aaa authorization commands all default group tacacs+ local
aaa accounting exec default start-stop group tacacs+
aaa accounting commands all default start-stop group tacacs+`;

    case "fortinet":
      return `# FortiGate TACACS+ Configuration
config user tacacs+
    edit "ACTIS_TACACS"
        set server "${host}"
        set port ${p}
        set key "${key}"
        set authen-type auto
        set authorization enable
    next
end
config user group
    edit "TACACS_ADMINS"
        set member "ACTIS_TACACS"
    next
end`;

    default:
      return `# Generic RFC 8907 TACACS+ Client Settings
Server IP     : ${host}
TCP Port      : ${p}
Shared Secret : ${key}
Auth Types    : ASCII / PAP / CHAP / ENABLE`;
  }
}

