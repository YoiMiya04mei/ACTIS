export type SourceVendorFormat =
  | "auto"
  | "juniper_hier"
  | "juniper_set"
  | "mikrotik"
  | "cisco_ios"
  | "huawei_vrp"
  | "vyos";

export type TargetVendorFormat =
  | "mikrotik_v7"
  | "mikrotik_v6"
  | "cisco_ios"
  | "huawei_vrp"
  | "juniper_set"
  | "juniper_hier"
  | "arista_eos"
  | "vyos"
  | "zte_zxros";

export interface TargetVendorMeta {
  id: TargetVendorFormat;
  label: string;
  shortLabel: string;
  fileExt: string;
  badgeColor: string;
  description: string;
}

export const TARGET_VENDOR_META: Record<TargetVendorFormat, TargetVendorMeta> = {
  mikrotik_v7: {
    id: "mikrotik_v7",
    label: "MikroTik RouterOS v7",
    shortLabel: "MikroTik v7",
    fileExt: "rsc",
    badgeColor: "blue",
    description: "Script .rsc RouterOS v7 (/routing bgp connection, /routing ospf, /interface vlan)",
  },
  mikrotik_v6: {
    id: "mikrotik_v6",
    label: "MikroTik RouterOS v6",
    shortLabel: "MikroTik v6",
    fileExt: "rsc",
    badgeColor: "sky",
    description: "Script .rsc RouterOS v6 (/routing bgp instance & peer)",
  },
  cisco_ios: {
    id: "cisco_ios",
    label: "Cisco IOS / IOS-XE",
    shortLabel: "Cisco IOS",
    fileExt: "cfg",
    badgeColor: "indigo",
    description: "Konfigurasi CLI Cisco IOS / IOS-XE / Catalyst / ASR",
  },
  huawei_vrp: {
    id: "huawei_vrp",
    label: "Huawei VRP (NetEngine / Switch)",
    shortLabel: "Huawei VRP",
    fileExt: "cfg",
    badgeColor: "rose",
    description: "Konfigurasi Huawei VRP (sysname, dot1q termination, ip route-static, bgp)",
  },
  juniper_set: {
    id: "juniper_set",
    label: "Juniper Junos OS (Flat Set)",
    shortLabel: "Juniper Set",
    fileExt: "conf",
    badgeColor: "emerald",
    description: "Format perintah datar Junos OS (set system / set interfaces / set protocols)",
  },
  juniper_hier: {
    id: "juniper_hier",
    label: "Juniper Junos OS (Hierarchy)",
    shortLabel: "Juniper Hierarki",
    fileExt: "conf",
    badgeColor: "teal",
    description: "Format struktur kurung kurawal { ... } standar Junos OS",
  },
  arista_eos: {
    id: "arista_eos",
    label: "Arista EOS",
    shortLabel: "Arista EOS",
    fileExt: "cfg",
    badgeColor: "violet",
    description: "Konfigurasi Arista EOS Switch/Router",
  },
  vyos: {
    id: "vyos",
    label: "VyOS / EdgeRouter",
    shortLabel: "VyOS",
    fileExt: "conf",
    badgeColor: "amber",
    description: "Perintah CLI VyOS / EdgeOS set-based",
  },
  zte_zxros: {
    id: "zte_zxros",
    label: "ZTE ZXR10 / ZXROS",
    shortLabel: "ZTE ZXROS",
    fileExt: "cfg",
    badgeColor: "cyan",
    description: "Konfigurasi ZTE ZXR10 Series Router/Switch",
  },
};

export interface ParsedIpAddress {
  ip: string;
  prefixLen: number;
  cidr: string;
  netmask: string;
}

export interface ParsedInterface {
  sourceName: string;
  baseInterface: string;
  unitNumber?: number;
  vlanId?: number;
  description?: string;
  adminUp: boolean;
  mtu?: number;
  isLoopback?: boolean;
  isLag?: boolean;
  lagParent?: string;
  addresses: ParsedIpAddress[];
}

export interface ParsedStaticRoute {
  dstCidr: string;
  network: string;
  prefixLen: number;
  netmask: string;
  nextHop: string;
  distance?: number;
  comment?: string;
}

export interface ParsedBgpNeighbor {
  peerIp: string;
  remoteAsn: number;
  description?: string;
  groupName?: string;
  localAddress?: string;
  updateSource?: string;
  ebgpMultihop?: number;
  importPolicy?: string;
  exportPolicy?: string;
}

export interface ParsedOspfInterface {
  interfaceName: string;
  areaId: string;
  passive?: boolean;
  networkCidr?: string;
}

export interface ParsedVlan {
  vlanId: number;
  name?: string;
}

export interface ParsedPrefixList {
  name: string;
  entries: Array<{ cidr: string; action?: "permit" | "deny" }>;
}

export interface ParsedNetworkIR {
  detectedSource: Exclude<SourceVendorFormat, "auto">;
  hostname: string;
  domainName?: string;
  timeZone?: string;
  dnsServers: string[];
  ntpServers: string[];
  vlans: ParsedVlan[];
  interfaces: ParsedInterface[];
  staticRoutes: ParsedStaticRoute[];
  bgp: {
    localAsn?: number;
    routerId?: string;
    neighbors: ParsedBgpNeighbor[];
    networks: string[];
  };
  ospf: {
    processId?: number;
    routerId?: string;
    interfaces: ParsedOspfInterface[];
  };
  prefixLists: ParsedPrefixList[];
  warnings: string[];
  rawLineCount: number;
}

export interface InterfaceMappingEntry {
  sourceBase: string;
  targetBase: string;
}

export interface TranslationResult {
  detectedSource: Exclude<SourceVendorFormat, "auto">;
  sourceLabel: string;
  targetVendor: TargetVendorFormat;
  targetMeta: TargetVendorMeta;
  suggestedFileName: string;
  generatedConfig: string;
  ir: ParsedNetworkIR;
  interfaceMapping: InterfaceMappingEntry[];
  stats: {
    interfaces: number;
    vlans: number;
    ipAddresses: number;
    staticRoutes: number;
    bgpNeighbors: number;
    ospfEntries: number;
    prefixLists: number;
    dnsNtpCount: number;
    outputLines: number;
  };
}

// ============================================================================
// IPv4 / Netmask / Wildcard Utilities
// ============================================================================

export function cidrToMask(prefixLen: number): string {
  const safe = Math.max(0, Math.min(32, Math.floor(prefixLen)));
  if (safe === 0) return "0.0.0.0";
  const maskInt = (0xffffffff << (32 - safe)) >>> 0;
  return [
    (maskInt >>> 24) & 255,
    (maskInt >>> 16) & 255,
    (maskInt >>> 8) & 255,
    maskInt & 255,
  ].join(".");
}

export function cidrToWildcard(prefixLen: number): string {
  const safe = Math.max(0, Math.min(32, Math.floor(prefixLen)));
  const maskInt = safe === 0 ? 0 : (0xffffffff << (32 - safe)) >>> 0;
  const wildInt = (~maskInt) >>> 0;
  return [
    (wildInt >>> 24) & 255,
    (wildInt >>> 16) & 255,
    (wildInt >>> 8) & 255,
    wildInt & 255,
  ].join(".");
}

export function maskToCidr(mask: string): number {
  const parts = mask.trim().split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return 32;
  }
  const intVal = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((intVal >>> i) & 1) bits++;
    else break;
  }
  return bits;
}

export function wildcardToCidr(wildcard: string): number {
  const parts = wildcard.trim().split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return 24;
  }
  const inverted = parts.map((p) => 255 - p).join(".");
  return maskToCidr(inverted);
}

export function parseIpCidrOrMask(ipOrCidr: string, maybeMask?: string): ParsedIpAddress | null {
  const raw = ipOrCidr.trim().replace(/;$/, "");
  if (!raw) return null;

  if (raw.includes("/")) {
    const [ip, lenStr] = raw.split("/");
    if (!isValidIpv4(ip)) return null;
    const prefixLen = Math.max(0, Math.min(32, parseInt(lenStr, 10)));
    if (Number.isNaN(prefixLen)) return null;
    return {
      ip,
      prefixLen,
      cidr: `${ip}/${prefixLen}`,
      netmask: cidrToMask(prefixLen),
    };
  }

  if (isValidIpv4(raw) && maybeMask && isValidIpv4(maybeMask)) {
    const prefixLen = maskToCidr(maybeMask);
    return {
      ip: raw,
      prefixLen,
      cidr: `${raw}/${prefixLen}`,
      netmask: maybeMask,
    };
  }

  if (isValidIpv4(raw)) {
    return {
      ip: raw,
      prefixLen: 32,
      cidr: `${raw}/32`,
      netmask: "255.255.255.255",
    };
  }

  return null;
}

function isValidIpv4(val: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(val.trim());
  if (!m) return false;
  return [m[1], m[2], m[3], m[4]].every((oct) => {
    const n = Number(oct);
    return n >= 0 && n <= 255;
  });
}

function normalizeOspfArea(area: string): string {
  const clean = area.trim();
  if (isValidIpv4(clean)) return clean;
  const num = Number(clean);
  if (Number.isInteger(num) && num >= 0) {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255,
    ].join(".");
  }
  return "0.0.0.0";
}

function stripQuotes(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function quoteIfNeeded(val: string): string {
  if (!val) return '""';
  if (/[\s;]/.test(val)) return `"${val.replace(/"/g, '\\"')}"`;
  return val;
}

function safeFileSlug(val: string): string {
  return (
    val
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "router"
  );
}

// ============================================================================
// Source Vendor Auto-Detection
// ============================================================================

export function detectSourceVendor(rawConfig: string): Exclude<SourceVendorFormat, "auto"> {
  const lines = rawConfig
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("!"));

  const sample = lines.slice(0, 200).join("\n");
  const lower = sample.toLowerCase();

  // MikroTik RouterOS (.rsc)
  if (
    /^\/(system|interface|ip|routing|user|snmp)\b/m.test(sample) ||
    /add\s+address=\d+\.\d+\.\d+\.\d+\/\d+\s+interface=/i.test(sample)
  ) {
    return "mikrotik";
  }

  // VyOS / EdgeRouter (`set system host-name` / `set interfaces ethernet ... vif`)
  const hasVyosMarkers =
    /^set\s+interfaces\s+(ethernet|dummy|bonding|bridge)\s+/m.test(sample) ||
    /^set\s+protocols\s+(static\s+route|bgp\s+\d+)/m.test(sample) ||
    /^set\s+service\s+ssh\b/m.test(sample);
  if (hasVyosMarkers) {
    return "vyos";
  }

  // Juniper flat `set`
  const setLinesCount = lines.filter((l) => /^set\s+/.test(l)).length;
  if (
    setLinesCount >= 3 &&
    (/^set\s+(system|interfaces|routing-options|protocols|policy-options|vlans|chassis)\s+/m.test(
      sample
    ) ||
      /\b(ge|xe|et|ae|lo)-\d|\bfamily\s+inet\b/i.test(sample))
  ) {
    return "juniper_set";
  }

  // Juniper hierarchical `{ ... }`
  if (
    /^(system|interfaces|routing-options|protocols|policy-options|vlans|chassis|security)\s*\{/m.test(
      sample
    ) ||
    (/\bfamily\s+inet\b/i.test(sample) && rawConfig.includes("{") && rawConfig.includes(";"))
  ) {
    return "juniper_hier";
  }

  // Huawei VRP / Comware
  if (
    /^\s*sysname\s+/m.test(sample) ||
    /^\s*ip\s+route-static\s+/m.test(sample) ||
    /^\s*vlan\s+batch\s+/m.test(sample) ||
    /^\s*dot1q\s+termination\s+vid\s+/m.test(sample) ||
    /^\s*peer\s+\d+\.\d+\.\d+\.\d+\s+as-number\s+/m.test(sample) ||
    lower.includes("return\n#") ||
    /^\s*interface\s+vlanif\d+/im.test(sample)
  ) {
    return "huawei_vrp";
  }

  // Cisco IOS / NX-OS / Arista / ZTE CLI style
  if (
    /^\s*hostname\s+/m.test(sample) ||
    /^\s*interface\s+(GigabitEthernet|TenGigabitEthernet|FastEthernet|Ethernet|Loopback|Port-channel|Vlan|gei-|xgei-)/im.test(
      sample
    ) ||
    /^\s*router\s+(bgp|ospf)\s+/m.test(sample) ||
    /^\s*ip\s+route\s+/m.test(sample)
  ) {
    return "cisco_ios";
  }

  // Fallback heuristics
  if (rawConfig.includes("{") && rawConfig.includes(";")) return "juniper_hier";
  if (/^set\s+/m.test(sample)) return "juniper_set";
  return "cisco_ios";
}

export function getSourceVendorLabel(source: Exclude<SourceVendorFormat, "auto">): string {
  switch (source) {
    case "juniper_hier":
      return "Juniper Junos OS (Hierarchy { })";
    case "juniper_set":
      return "Juniper Junos OS (Flat Set)";
    case "mikrotik":
      return "MikroTik RouterOS (.rsc)";
    case "cisco_ios":
      return "Cisco IOS / Arista / ZTE CLI";
    case "huawei_vrp":
      return "Huawei VRP / Comware";
    case "vyos":
      return "VyOS / EdgeRouter";
  }
}

// ============================================================================
// Juniper Hierarchy -> Flat Set Flattener & Parser
// ============================================================================

function tokenizeJunosLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && (ch === "{" || ch === "}" || ch === ";" || ch === "[" || ch === "]")) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      tokens.push(ch);
    } else if (!inQuotes && /\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export function flattenJunosHierarchy(rawConfig: string): string[] {
  // Remove /* ... */ block comments
  const withoutBlockComments = rawConfig.replace(/\/\*[\s\S]*?\*\//g, "");
  const rawLines = withoutBlockComments.split(/\r?\n/);

  const stack: string[][] = [];
  let stmtTokens: string[] = [];
  const emitted: string[] = [];

  for (const rawLine of rawLines) {
    // Strip # comments outside quotes
    let clean = "";
    let inQuotes = false;
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      if (!inQuotes && ch === "#") break;
      clean += ch;
    }
    clean = clean.trim();
    if (!clean) continue;

    // Ignore Junos commit/version header directives
    if (/^(version|apply-groups-except)\s+/i.test(clean) && stack.length === 0) {
      continue;
    }

    const tokens = tokenizeJunosLine(clean);
    let inBracket = false;
    let bracketPrefix: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === "inactive:" || tok === "protect:" || tok === "replace:") {
        continue;
      }

      if (tok === "{") {
        stack.push(stmtTokens);
        stmtTokens = [];
      } else if (tok === "}") {
        stmtTokens = [];
        stack.pop();
      } else if (tok === "[") {
        inBracket = true;
        bracketPrefix = [...stmtTokens];
        stmtTokens = [];
      } else if (tok === "]") {
        const prefixPath = [...stack.flat(), ...bracketPrefix];
        for (const item of stmtTokens) {
          emitted.push(`set ${[...prefixPath, item].join(" ")}`);
        }
        inBracket = false;
        bracketPrefix = [];
        stmtTokens = [];
      } else if (tok === ";") {
        if (!inBracket && stmtTokens.length > 0) {
          const full = [...stack.flat(), ...stmtTokens];
          emitted.push(`set ${full.join(" ")}`);
          stmtTokens = [];
        }
      } else {
        stmtTokens.push(tok);
      }
    }
  }

  return emitted;
}

function parseSetTokens(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && /\s/.test(ch)) {
      if (current) tokens.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function ensureInterfaceEntry(
  map: Map<string, ParsedInterface>,
  key: string,
  baseInterface: string,
  unitNumber?: number
): ParsedInterface {
  const existing = map.get(key);
  if (existing) return existing;
  const lower = baseInterface.toLowerCase();
  const entry: ParsedInterface = {
    sourceName: key,
    baseInterface,
    unitNumber,
    adminUp: true,
    isLoopback: lower.startsWith("lo") || lower.includes("loopback"),
    isLag:
      lower.startsWith("ae") ||
      lower.startsWith("port-channel") ||
      lower.startsWith("eth-trunk") ||
      lower.startsWith("bond") ||
      lower.startsWith("smartgroup"),
    addresses: [],
  };
  map.set(key, entry);
  return entry;
}

function addUniqueIp(target: ParsedIpAddress[], addr: ParsedIpAddress | null) {
  if (!addr) return;
  if (!target.some((x) => x.cidr === addr.cidr)) {
    target.push(addr);
  }
}

function parseJuniperSetLines(
  setLines: string[],
  detectedSource: "juniper_hier" | "juniper_set",
  rawLineCount: number
): ParsedNetworkIR {
  const ir: ParsedNetworkIR = {
    detectedSource,
    hostname: "ROUTER-MIGRATED",
    dnsServers: [],
    ntpServers: [],
    vlans: [],
    interfaces: [],
    staticRoutes: [],
    bgp: { neighbors: [], networks: [] },
    ospf: { interfaces: [] },
    prefixLists: [],
    warnings: [],
    rawLineCount,
  };

  const ifMap = new Map<string, ParsedInterface>();
  const vlanMap = new Map<number, ParsedVlan>();
  const routeMap = new Map<string, ParsedStaticRoute>();
  const bgpGroupDefaults = new Map<
    string,
    { peerAs?: number; localAddress?: string; description?: string; importPolicy?: string; exportPolicy?: string }
  >();
  const bgpNeighborMap = new Map<string, ParsedBgpNeighbor>();
  const prefixListMap = new Map<string, ParsedPrefixList>();
  const unsupportedTop = new Set<string>();

  for (const rawLine of setLines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const tokens = parseSetTokens(trimmed);
    if (tokens[0] !== "set" || tokens.length < 2) continue;

    const rest = tokens.slice(1);
    const top = rest[0];

    // system ...
    if (top === "system") {
      if (rest[1] === "host-name" && rest[2]) {
        ir.hostname = stripQuotes(rest[2]);
      } else if (rest[1] === "domain-name" && rest[2]) {
        ir.domainName = stripQuotes(rest[2]);
      } else if (rest[1] === "time-zone" && rest[2]) {
        ir.timeZone = stripQuotes(rest[2]);
      } else if (rest[1] === "name-server" && rest[2] && isValidIpv4(rest[2])) {
        if (!ir.dnsServers.includes(rest[2])) ir.dnsServers.push(rest[2]);
      } else if (rest[1] === "ntp" && rest[2] === "server" && rest[3] && isValidIpv4(rest[3])) {
        if (!ir.ntpServers.includes(rest[3])) ir.ntpServers.push(rest[3]);
      }
      continue;
    }

    // interfaces <ifName> ...
    if (top === "interfaces" && rest[1]) {
      const baseIf = stripQuotes(rest[1]);
      if (rest[2] === "unit" && rest[3]) {
        const unitNum = parseInt(rest[3], 10);
        const fullKey = `${baseIf}.${rest[3]}`;
        const entry = ensureInterfaceEntry(
          ifMap,
          fullKey,
          baseIf,
          Number.isNaN(unitNum) ? undefined : unitNum
        );
        const uIdx = 4;
        if (rest[uIdx] === "description" && rest.length > uIdx + 1) {
          entry.description = stripQuotes(rest.slice(uIdx + 1).join(" "));
        } else if (rest[uIdx] === "vlan-id" && rest[uIdx + 1]) {
          const vid = parseInt(rest[uIdx + 1], 10);
          if (!Number.isNaN(vid)) entry.vlanId = vid;
        } else if (rest[uIdx] === "disable") {
          entry.adminUp = false;
        } else if (
          rest[uIdx] === "family" &&
          rest[uIdx + 1] === "inet" &&
          rest[uIdx + 2] === "address" &&
          rest[uIdx + 3]
        ) {
          addUniqueIp(entry.addresses, parseIpCidrOrMask(rest[uIdx + 3]));
        } else if (
          rest[uIdx] === "family" &&
          rest[uIdx + 1] === "inet" &&
          rest[uIdx + 2] === "mtu" &&
          rest[uIdx + 3]
        ) {
          const mtuVal = parseInt(rest[uIdx + 3], 10);
          if (!Number.isNaN(mtuVal)) entry.mtu = mtuVal;
        }
      } else {
        const baseEntry = ensureInterfaceEntry(ifMap, baseIf, baseIf);
        if (rest[2] === "description" && rest.length > 3) {
          baseEntry.description = stripQuotes(rest.slice(3).join(" "));
        } else if (rest[2] === "mtu" && rest[3]) {
          const mtuVal = parseInt(rest[3], 10);
          if (!Number.isNaN(mtuVal)) baseEntry.mtu = mtuVal;
        } else if (rest[2] === "disable") {
          baseEntry.adminUp = false;
        } else if (
          (rest[2] === "gigether-options" || rest[2] === "ether-options") &&
          rest[3] === "802.3ad" &&
          rest[4]
        ) {
          baseEntry.lagParent = stripQuotes(rest[4]);
        }
      }
      continue;
    }

    // vlans / bridge-domains
    if ((top === "vlans" || top === "bridge-domains") && rest[1]) {
      const vlanName = stripQuotes(rest[1]);
      if (rest[2] === "vlan-id" && rest[3]) {
        const vid = parseInt(rest[3], 10);
        if (!Number.isNaN(vid) && !vlanMap.has(vid)) {
          vlanMap.set(vid, { vlanId: vid, name: vlanName });
        }
      }
      continue;
    }

    // routing-options
    if (top === "routing-options") {
      if (rest[1] === "autonomous-system" && rest[2]) {
        const asn = parseInt(rest[2], 10);
        if (!Number.isNaN(asn)) ir.bgp.localAsn = asn;
      } else if (rest[1] === "router-id" && rest[2] && isValidIpv4(rest[2])) {
        ir.bgp.routerId = rest[2];
        ir.ospf.routerId = rest[2];
      } else if (rest[1] === "static" && rest[2] === "route" && rest[3]) {
        const dstParsed = parseIpCidrOrMask(rest[3]);
        if (dstParsed) {
          const existingRoute = routeMap.get(dstParsed.cidr) || {
            dstCidr: dstParsed.cidr,
            network: dstParsed.ip,
            prefixLen: dstParsed.prefixLen,
            netmask: dstParsed.netmask,
            nextHop: "",
          };
          if (rest[4] === "next-hop" && rest[5]) {
            existingRoute.nextHop = stripQuotes(rest[5]);
          } else if (rest[4] === "preference" && rest[5]) {
            const dist = parseInt(rest[5], 10);
            if (!Number.isNaN(dist)) existingRoute.distance = dist;
          }
          routeMap.set(dstParsed.cidr, existingRoute);
        }
      }
      continue;
    }

    // protocols bgp / ospf
    if (top === "protocols" && rest[1] === "bgp" && rest[2] === "group" && rest[3]) {
      const groupName = stripQuotes(rest[3]);
      const gDef = bgpGroupDefaults.get(groupName) || {};

      if (rest[4] === "neighbor" && rest[5]) {
        const peerIp = rest[5];
        const key = `${groupName}:${peerIp}`;
        const neighbor: ParsedBgpNeighbor = bgpNeighborMap.get(key) || {
          peerIp,
          remoteAsn: gDef.peerAs || 0,
          groupName,
          localAddress: gDef.localAddress,
          description: gDef.description,
          importPolicy: gDef.importPolicy,
          exportPolicy: gDef.exportPolicy,
        };
        const pIdx = 6;
        if (rest[pIdx] === "peer-as" && rest[pIdx + 1]) {
          neighbor.remoteAsn = parseInt(rest[pIdx + 1], 10) || 0;
        } else if (rest[pIdx] === "description" && rest.length > pIdx + 1) {
          neighbor.description = stripQuotes(rest.slice(pIdx + 1).join(" "));
        } else if (rest[pIdx] === "local-address" && rest[pIdx + 1]) {
          neighbor.localAddress = rest[pIdx + 1];
        } else if (rest[pIdx] === "multihop") {
          neighbor.ebgpMultihop = rest[pIdx + 2] ? parseInt(rest[pIdx + 2], 10) || 2 : 2;
        } else if (rest[pIdx] === "import" && rest[pIdx + 1]) {
          neighbor.importPolicy = stripQuotes(rest[pIdx + 1]);
        } else if (rest[pIdx] === "export" && rest[pIdx + 1]) {
          neighbor.exportPolicy = stripQuotes(rest[pIdx + 1]);
        }
        bgpNeighborMap.set(key, neighbor);
      } else {
        if (rest[4] === "peer-as" && rest[5]) {
          gDef.peerAs = parseInt(rest[5], 10) || undefined;
        } else if (rest[4] === "local-address" && rest[5]) {
          gDef.localAddress = rest[5];
        } else if (rest[4] === "description" && rest.length > 5) {
          gDef.description = stripQuotes(rest.slice(5).join(" "));
        } else if (rest[4] === "import" && rest[5]) {
          gDef.importPolicy = stripQuotes(rest[5]);
        } else if (rest[4] === "export" && rest[5]) {
          gDef.exportPolicy = stripQuotes(rest[5]);
        }
        bgpGroupDefaults.set(groupName, gDef);
        // Backfill already added neighbors in group
        for (const [k, nb] of bgpNeighborMap.entries()) {
          if (k.startsWith(`${groupName}:`)) {
            if (!nb.remoteAsn && gDef.peerAs) nb.remoteAsn = gDef.peerAs;
            if (!nb.localAddress && gDef.localAddress) nb.localAddress = gDef.localAddress;
          }
        }
      }
      continue;
    }

    if (top === "protocols" && rest[1] === "ospf" && rest[2] === "area" && rest[3]) {
      const areaId = normalizeOspfArea(rest[3]);
      if (rest[4] === "interface" && rest[5]) {
        const ifName = stripQuotes(rest[5]);
        let item = ir.ospf.interfaces.find(
          (o) => o.areaId === areaId && o.interfaceName === ifName
        );
        if (!item) {
          item = { interfaceName: ifName, areaId };
          ir.ospf.interfaces.push(item);
        }
        if (rest[6] === "passive") item.passive = true;
      }
      continue;
    }

    // policy-options prefix-list <name> <cidr>
    if (top === "policy-options" && rest[1] === "prefix-list" && rest[2] && rest[3]) {
      const listName = stripQuotes(rest[2]);
      const cidr = parseIpCidrOrMask(rest[3]);
      if (cidr) {
        const existing = prefixListMap.get(listName) || { name: listName, entries: [] };
        existing.entries.push({ cidr: cidr.cidr, action: "permit" });
        prefixListMap.set(listName, existing);
      }
      continue;
    }

    if (
      ["policy-options", "firewall", "class-of-service", "security", "routing-instances"].includes(
        top
      )
    ) {
      unsupportedTop.add(top);
    }
  }

  // Merge VLANs referenced only on interface units
  for (const iface of ifMap.values()) {
    if (iface.vlanId && !vlanMap.has(iface.vlanId)) {
      vlanMap.set(iface.vlanId, {
        vlanId: iface.vlanId,
        name: iface.description
          ? iface.description.replace(/\s+/g, "_").slice(0, 24)
          : `VLAN_${iface.vlanId}`,
      });
    }
  }

  ir.interfaces = Array.from(ifMap.values());
  ir.vlans = Array.from(vlanMap.values()).sort((a, b) => a.vlanId - b.vlanId);
  ir.staticRoutes = Array.from(routeMap.values()).filter((r) => Boolean(r.nextHop));
  ir.bgp.neighbors = Array.from(bgpNeighborMap.values()).map((nb) => {
    const gDef = nb.groupName ? bgpGroupDefaults.get(nb.groupName) : undefined;
    return {
      ...nb,
      remoteAsn: nb.remoteAsn || gDef?.peerAs || 0,
      localAddress: nb.localAddress || gDef?.localAddress,
    };
  });
  ir.prefixLists = Array.from(prefixListMap.values());

  if (unsupportedTop.size > 0) {
    ir.warnings.push(
      `Stanza spesifik Junos (${Array.from(unsupportedTop).join(", ")}) bersifat vendor-proprietary; verifikasi manual policy/firewall setelah konversi.`
    );
  }

  return ir;
}

// ============================================================================
// MikroTik RouterOS (.rsc) Parser
// ============================================================================

function parseKeyValParams(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  const len = str.length;
  while (i < len) {
    while (i < len && /\s/.test(str[i])) i++;
    if (i >= len) break;

    let key = "";
    while (i < len && str[i] !== "=" && !/\s/.test(str[i])) {
      key += str[i++];
    }
    if (str[i] !== "=") {
      while (i < len && !/\s/.test(str[i])) i++;
      continue;
    }
    i++; // skip '='

    let val = "";
    if (str[i] === '"') {
      i++;
      while (i < len && str[i] !== '"') {
        if (str[i] === "\\" && i + 1 < len) {
          i++;
          val += str[i++];
        } else {
          val += str[i++];
        }
      }
      if (str[i] === '"') i++;
    } else {
      while (i < len && !/\s/.test(str[i])) {
        val += str[i++];
      }
    }
    if (key) result[key] = val;
  }
  return result;
}

function parseMikrotikRsc(rawConfig: string): ParsedNetworkIR {
  // Join multiline backslash continuations
  const joinedLines: string[] = [];
  let buffer = "";
  const rawSplit = rawConfig.split(/\r?\n/);
  for (const raw of rawSplit) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("#")) continue;
    if (trimmed.endsWith("\\")) {
      buffer += trimmed.slice(0, -1) + " ";
    } else {
      buffer += trimmed;
      if (buffer.trim()) joinedLines.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) joinedLines.push(buffer.trim());

  const ir: ParsedNetworkIR = {
    detectedSource: "mikrotik",
    hostname: "MIKROTIK-MIGRATED",
    dnsServers: [],
    ntpServers: [],
    vlans: [],
    interfaces: [],
    staticRoutes: [],
    bgp: { neighbors: [], networks: [] },
    ospf: { interfaces: [] },
    prefixLists: [],
    warnings: [],
    rawLineCount: rawSplit.length,
  };

  let currentSection = "";
  const ifMap = new Map<string, ParsedInterface>();
  const vlanMap = new Map<number, ParsedVlan>();
  const prefixListMap = new Map<string, ParsedPrefixList>();
  const bgpTemplateAsn = new Map<string, { as?: number; routerId?: string }>();

  for (const line of joinedLines) {
    if (line.startsWith("/")) {
      // Handle single-line command like `/system identity set name=RTR` or section header `/ip address`
      const parts = line.split(/\s+/);
      let sectionEnd = parts.length;
      for (let i = 0; i < parts.length; i++) {
        if (["add", "set", "print", "remove", "enable", "disable"].includes(parts[i])) {
          sectionEnd = i;
          break;
        }
      }
      currentSection = parts.slice(0, sectionEnd).join(" ").toLowerCase();
      if (sectionEnd === parts.length) continue;
      // Otherwise fall through processing the command tail
      const cmdRest = parts.slice(sectionEnd).join(" ");
      handleMikrotikCmd(currentSection, cmdRest);
      continue;
    }

    handleMikrotikCmd(currentSection, line);
  }

  function handleMikrotikCmd(section: string, cmdLine: string) {
    const params = parseKeyValParams(cmdLine);
    const isDisabled = params.disabled === "yes";

    if (section === "/system identity" && params.name) {
      ir.hostname = params.name;
      return;
    }
    if (section === "/system clock" && params["time-zone-name"]) {
      ir.timeZone = params["time-zone-name"];
      return;
    }
    if (section === "/ip dns" && params.servers) {
      for (const s of params.servers.split(",")) {
        if (isValidIpv4(s.trim()) && !ir.dnsServers.includes(s.trim())) {
          ir.dnsServers.push(s.trim());
        }
      }
      return;
    }
    if ((section === "/system ntp client" || section === "/system ntp client servers") && (params.servers || params["primary-ntp"] || params.address)) {
      const list = (params.servers || params["primary-ntp"] || params.address || "").split(",");
      for (const s of list) {
        if (isValidIpv4(s.trim()) && !ir.ntpServers.includes(s.trim())) {
          ir.ntpServers.push(s.trim());
        }
      }
      return;
    }

    if (section === "/interface ethernet" || section === "/interface bonding" || section === "/interface bridge") {
      const name = params.name || params["default-name"] || "ether1";
      const entry = ensureInterfaceEntry(ifMap, name, name);
      if (params.comment) entry.description = params.comment;
      if (params.mtu) entry.mtu = parseInt(params.mtu, 10) || undefined;
      if (isDisabled) entry.adminUp = false;
      if (section === "/interface bonding") entry.isLag = true;
      return;
    }

    if (section === "/interface vlan" && params.name && params["vlan-id"]) {
      const vid = parseInt(params["vlan-id"], 10);
      const parentIf = params.interface || "ether1";
      const entry = ensureInterfaceEntry(ifMap, params.name, parentIf, vid);
      entry.vlanId = vid;
      if (params.comment) entry.description = params.comment;
      if (isDisabled) entry.adminUp = false;
      if (!vlanMap.has(vid)) {
        vlanMap.set(vid, { vlanId: vid, name: params.name });
      }
      return;
    }

    if (section === "/ip address" && params.address && params.interface && !isDisabled) {
      const addr = parseIpCidrOrMask(params.address);
      if (addr) {
        const existing = ifMap.get(params.interface);
        const entry = existing || ensureInterfaceEntry(ifMap, params.interface, params.interface);
        if (!entry.description && params.comment) entry.description = params.comment;
        addUniqueIp(entry.addresses, addr);
      }
      return;
    }

    if (section === "/ip route" && params.gateway && !isDisabled) {
      const dst = params["dst-address"] || "0.0.0.0/0";
      const parsed = parseIpCidrOrMask(dst);
      if (parsed && isValidIpv4(params.gateway.split("%")[0])) {
        ir.staticRoutes.push({
          dstCidr: parsed.cidr,
          network: parsed.ip,
          prefixLen: parsed.prefixLen,
          netmask: parsed.netmask,
          nextHop: params.gateway.split("%")[0],
          distance: params.distance ? parseInt(params.distance, 10) || undefined : undefined,
          comment: params.comment,
        });
      }
      return;
    }

    // BGP v7 (`template` + `connection`) & v6 (`instance` + `peer`)
    if (section === "/routing bgp template" && params.name) {
      const asn = params.as ? parseInt(params.as, 10) : undefined;
      const rid = params["router-id"];
      bgpTemplateAsn.set(params.name, { as: asn, routerId: rid });
      if (asn && !ir.bgp.localAsn) ir.bgp.localAsn = asn;
      if (rid && !ir.bgp.routerId) ir.bgp.routerId = rid;
      return;
    }
    if (section === "/routing bgp instance") {
      if (params.as) ir.bgp.localAsn = parseInt(params.as, 10) || ir.bgp.localAsn;
      if (params["router-id"]) ir.bgp.routerId = params["router-id"];
      return;
    }
    if (section === "/routing bgp connection" && params["remote.address"] && !isDisabled) {
      const peerIp = params["remote.address"].split("/")[0];
      const remoteAs = parseInt(params["remote.as"] || params.as || "0", 10);
      const tInfo = params.templates ? bgpTemplateAsn.get(params.templates) : undefined;
      if (!ir.bgp.localAsn && (params["local.as"] || tInfo?.as)) {
        ir.bgp.localAsn = parseInt(params["local.as"] || String(tInfo?.as || 0), 10) || undefined;
      }
      if (!ir.bgp.routerId && tInfo?.routerId) ir.bgp.routerId = tInfo.routerId;
      ir.bgp.neighbors.push({
        peerIp,
        remoteAsn: remoteAs,
        description: params.comment || params.name,
        localAddress: params["local.address"]?.split("/")[0],
        ebgpMultihop: params.multihop === "yes" ? 2 : undefined,
      });
      return;
    }
    if (section === "/routing bgp peer" && params["remote-address"] && !isDisabled) {
      ir.bgp.neighbors.push({
        peerIp: params["remote-address"].split("/")[0],
        remoteAsn: parseInt(params["remote-as"] || "0", 10),
        description: params.comment || params.name,
        updateSource: params["update-source"],
        ebgpMultihop: params.multihop === "yes" ? 2 : undefined,
      });
      return;
    }

    if (section === "/routing ospf instance" && params["router-id"]) {
      ir.ospf.routerId = params["router-id"];
      return;
    }
    if ((section === "/routing ospf network" || section === "/routing ospf interface-template") && params.area) {
      ir.ospf.interfaces.push({
        interfaceName: params.interfaces || "ether1",
        areaId: normalizeOspfArea(params.area),
        passive: params.passive === "yes",
        networkCidr: params.network || params.networks,
      });
      return;
    }

    if (section === "/ip firewall address-list" && params.list && params.address && !isDisabled) {
      const addr = parseIpCidrOrMask(params.address);
      if (addr) {
        const listObj = prefixListMap.get(params.list) || { name: params.list, entries: [] };
        listObj.entries.push({ cidr: addr.cidr, action: "permit" });
        prefixListMap.set(params.list, listObj);
      }
    }
  }

  ir.interfaces = Array.from(ifMap.values());
  ir.vlans = Array.from(vlanMap.values()).sort((a, b) => a.vlanId - b.vlanId);
  ir.prefixLists = Array.from(prefixListMap.values());
  return ir;
}

// ============================================================================
// Cisco IOS / NX-OS / Arista / ZTE CLI Parser
// ============================================================================

function parseCiscoLikeCli(rawConfig: string): ParsedNetworkIR {
  const rawLines = rawConfig.split(/\r?\n/);
  const ir: ParsedNetworkIR = {
    detectedSource: "cisco_ios",
    hostname: "CISCO-MIGRATED",
    dnsServers: [],
    ntpServers: [],
    vlans: [],
    interfaces: [],
    staticRoutes: [],
    bgp: { neighbors: [], networks: [] },
    ospf: { interfaces: [] },
    prefixLists: [],
    warnings: [],
    rawLineCount: rawLines.length,
  };

  let mode: "global" | "interface" | "vlan" | "bgp" | "ospf" | "other" = "global";
  let currentIf: ParsedInterface | null = null;
  let currentVlan: ParsedVlan | null = null;

  const ifMap = new Map<string, ParsedInterface>();
  const vlanMap = new Map<number, ParsedVlan>();
  const bgpNeighborMap = new Map<string, ParsedBgpNeighbor>();
  const prefixListMap = new Map<string, ParsedPrefixList>();

  for (const raw of rawLines) {
    const isIndented = /^\s+/.test(raw);
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("!")) {
      if (trimmed === "!") mode = "global";
      continue;
    }

    if (!isIndented) {
      mode = "global";
      currentIf = null;
      currentVlan = null;

      if (/^hostname\s+(.+)$/i.test(trimmed)) {
        ir.hostname = stripQuotes(trimmed.replace(/^hostname\s+/i, ""));
        continue;
      }
      if (/^ip\s+domain[- ]name\s+(.+)$/i.test(trimmed)) {
        ir.domainName = trimmed.replace(/^ip\s+domain[- ]name\s+/i, "").trim();
        continue;
      }
      if (/^ip\s+name-server\s+(.+)$/i.test(trimmed)) {
        for (const tok of trimmed.replace(/^ip\s+name-server\s+/i, "").split(/\s+/)) {
          if (isValidIpv4(tok) && !ir.dnsServers.includes(tok)) ir.dnsServers.push(tok);
        }
        continue;
      }
      if (/^ntp\s+server\s+(\S+)/i.test(trimmed)) {
        const m = /^ntp\s+server\s+(\S+)/i.exec(trimmed);
        if (m && isValidIpv4(m[1]) && !ir.ntpServers.includes(m[1])) ir.ntpServers.push(m[1]);
        continue;
      }
      if (/^vlan\s+(\d+)$/i.test(trimmed)) {
        const vid = parseInt(trimmed.replace(/^vlan\s+/i, ""), 10);
        if (!Number.isNaN(vid)) {
          currentVlan = vlanMap.get(vid) || { vlanId: vid };
          vlanMap.set(vid, currentVlan);
          mode = "vlan";
        }
        continue;
      }
      if (/^interface\s+(.+)$/i.test(trimmed)) {
        const ifName = trimmed.replace(/^interface\s+/i, "").trim();
        const dotMatch = /^(.+)\.(\d+)$/.exec(ifName);
        const vlanIfMatch = /^Vlan(\d+)$/i.exec(ifName);
        const baseIf = dotMatch ? dotMatch[1] : ifName;
        const unitNum = dotMatch ? parseInt(dotMatch[2], 10) : vlanIfMatch ? parseInt(vlanIfMatch[1], 10) : undefined;
        currentIf = ensureInterfaceEntry(ifMap, ifName, baseIf, unitNum);
        if (vlanIfMatch) currentIf.vlanId = parseInt(vlanIfMatch[1], 10);
        mode = "interface";
        continue;
      }
      if (/^ip\s+route\s+/i.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        // `ip route <net> <mask> <gw> [dist]` or `ip route <net/cidr> <gw>`
        let idx = 2;
        if (parts[2]?.toLowerCase() === "vrf" && parts[3]) idx = 4;
        const dstToken = parts[idx];
        if (dstToken?.includes("/") && parts[idx + 1]) {
          const parsed = parseIpCidrOrMask(dstToken);
          if (parsed && isValidIpv4(parts[idx + 1])) {
            ir.staticRoutes.push({
              dstCidr: parsed.cidr,
              network: parsed.ip,
              prefixLen: parsed.prefixLen,
              netmask: parsed.netmask,
              nextHop: parts[idx + 1],
              distance: parts[idx + 2] && /^\d+$/.test(parts[idx + 2]) ? parseInt(parts[idx + 2], 10) : undefined,
            });
          }
        } else if (dstToken && parts[idx + 1] && parts[idx + 2]) {
          const parsed = parseIpCidrOrMask(dstToken, parts[idx + 1]);
          if (parsed && isValidIpv4(parts[idx + 2])) {
            ir.staticRoutes.push({
              dstCidr: parsed.cidr,
              network: parsed.ip,
              prefixLen: parsed.prefixLen,
              netmask: parsed.netmask,
              nextHop: parts[idx + 2],
              distance: parts[idx + 3] && /^\d+$/.test(parts[idx + 3]) ? parseInt(parts[idx + 3], 10) : undefined,
            });
          }
        }
        continue;
      }
      if (/^router\s+bgp\s+(\d+)/i.test(trimmed)) {
        const m = /^router\s+bgp\s+(\d+)/i.exec(trimmed);
        if (m) ir.bgp.localAsn = parseInt(m[1], 10);
        mode = "bgp";
        continue;
      }
      if (/^router\s+ospf\s+(\d+)/i.test(trimmed)) {
        const m = /^router\s+ospf\s+(\d+)/i.exec(trimmed);
        if (m) ir.ospf.processId = parseInt(m[1], 10);
        mode = "ospf";
        continue;
      }
      if (/^ip\s+prefix-list\s+(\S+)\s+.*?(permit|deny)\s+(\S+)/i.test(trimmed)) {
        const m = /^ip\s+prefix-list\s+(\S+)\s+.*?(permit|deny)\s+(\S+)/i.exec(trimmed);
        if (m) {
          const addr = parseIpCidrOrMask(m[3]);
          if (addr) {
            const pl = prefixListMap.get(m[1]) || { name: m[1], entries: [] };
            pl.entries.push({ cidr: addr.cidr, action: m[2].toLowerCase() === "deny" ? "deny" : "permit" });
            prefixListMap.set(m[1], pl);
          }
        }
        continue;
      }
      continue;
    }

    // Indented child lines
    if (mode === "vlan" && currentVlan && /^name\s+(.+)$/i.test(trimmed)) {
      currentVlan.name = stripQuotes(trimmed.replace(/^name\s+/i, ""));
      continue;
    }

    if (mode === "interface" && currentIf) {
      if (/^description\s+(.+)$/i.test(trimmed)) {
        currentIf.description = trimmed.replace(/^description\s+/i, "").trim();
      } else if (/^mtu\s+(\d+)$/i.test(trimmed)) {
        currentIf.mtu = parseInt(trimmed.split(/\s+/)[1], 10);
      } else if (/^encapsulation\s+dot1[qQ]\s+(\d+)/i.test(trimmed)) {
        const m = /^encapsulation\s+dot1[qQ]\s+(\d+)/i.exec(trimmed);
        if (m) currentIf.vlanId = parseInt(m[1], 10);
      } else if (/^shutdown$/i.test(trimmed)) {
        currentIf.adminUp = false;
      } else if (/^no\s+shutdown$/i.test(trimmed)) {
        currentIf.adminUp = true;
      } else if (/^channel-group\s+(\d+)/i.test(trimmed)) {
        const m = /^channel-group\s+(\d+)/i.exec(trimmed);
        if (m) currentIf.lagParent = `Port-channel${m[1]}`;
      } else if (/^ip\s+address\s+(\S+)(?:\s+(\S+))?/i.test(trimmed)) {
        const m = /^ip\s+address\s+(\S+)(?:\s+(\S+))?/i.exec(trimmed);
        if (m) {
          addUniqueIp(currentIf.addresses, parseIpCidrOrMask(m[1], m[2]));
        }
      }
      continue;
    }

    if (mode === "bgp") {
      if (/^bgp\s+router-id\s+(\S+)/i.test(trimmed)) {
        const m = /^bgp\s+router-id\s+(\S+)/i.exec(trimmed);
        if (m && isValidIpv4(m[1])) ir.bgp.routerId = m[1];
      } else if (/^neighbor\s+(\d+\.\d+\.\d+\.\d+)\s+(.+)$/i.test(trimmed)) {
        const m = /^neighbor\s+(\d+\.\d+\.\d+\.\d+)\s+(.+)$/i.exec(trimmed);
        if (m) {
          const peerIp = m[1];
          const rest = m[2].trim();
          const nb = bgpNeighborMap.get(peerIp) || { peerIp, remoteAsn: 0 };
          if (/^remote-as\s+(\d+)/i.test(rest)) {
            nb.remoteAsn = parseInt(rest.split(/\s+/)[1], 10) || 0;
          } else if (/^description\s+(.+)/i.test(rest)) {
            nb.description = rest.replace(/^description\s+/i, "").trim();
          } else if (/^update-source\s+(\S+)/i.test(rest)) {
            nb.updateSource = rest.split(/\s+/)[1];
          } else if (/^ebgp-multihop(?:\s+(\d+))?/i.test(rest)) {
            const hm = /^ebgp-multihop(?:\s+(\d+))?/i.exec(rest);
            nb.ebgpMultihop = hm?.[1] ? parseInt(hm[1], 10) : 2;
          }
          bgpNeighborMap.set(peerIp, nb);
        }
      } else if (/^network\s+(\S+)(?:\s+mask\s+(\S+))?/i.test(trimmed)) {
        const m = /^network\s+(\S+)(?:\s+mask\s+(\S+))?/i.exec(trimmed);
        if (m) {
          const parsed = parseIpCidrOrMask(m[1], m[2]);
          if (parsed && !ir.bgp.networks.includes(parsed.cidr)) ir.bgp.networks.push(parsed.cidr);
        }
      }
      continue;
    }

    if (mode === "ospf") {
      if (/^router-id\s+(\S+)/i.test(trimmed)) {
        const m = /^router-id\s+(\S+)/i.exec(trimmed);
        if (m && isValidIpv4(m[1])) ir.ospf.routerId = m[1];
      } else if (/^network\s+(\S+)\s+(\S+)\s+area\s+(\S+)/i.test(trimmed)) {
        const m = /^network\s+(\S+)\s+(\S+)\s+area\s+(\S+)/i.exec(trimmed);
        if (m && isValidIpv4(m[1])) {
          const len = wildcardToCidr(m[2]);
          ir.ospf.interfaces.push({
            interfaceName: `${m[1]}/${len}`,
            areaId: normalizeOspfArea(m[3]),
            networkCidr: `${m[1]}/${len}`,
          });
        }
      }
    }
  }

  for (const iface of ifMap.values()) {
    if (iface.vlanId && !vlanMap.has(iface.vlanId)) {
      vlanMap.set(iface.vlanId, { vlanId: iface.vlanId, name: `VLAN_${iface.vlanId}` });
    }
  }

  ir.interfaces = Array.from(ifMap.values());
  ir.vlans = Array.from(vlanMap.values()).sort((a, b) => a.vlanId - b.vlanId);
  ir.bgp.neighbors = Array.from(bgpNeighborMap.values());
  ir.prefixLists = Array.from(prefixListMap.values());
  return ir;
}

// ============================================================================
// Huawei VRP / Comware Parser
// ============================================================================

function parseHuaweiVrp(rawConfig: string): ParsedNetworkIR {
  const rawLines = rawConfig.split(/\r?\n/);
  const ir: ParsedNetworkIR = {
    detectedSource: "huawei_vrp",
    hostname: "HUAWEI-MIGRATED",
    dnsServers: [],
    ntpServers: [],
    vlans: [],
    interfaces: [],
    staticRoutes: [],
    bgp: { neighbors: [], networks: [] },
    ospf: { interfaces: [] },
    prefixLists: [],
    warnings: [],
    rawLineCount: rawLines.length,
  };

  let mode: "global" | "interface" | "vlan" | "bgp" | "ospf" | "ospf_area" = "global";
  let currentIf: ParsedInterface | null = null;
  let currentVlan: ParsedVlan | null = null;
  let currentOspfArea = "0.0.0.0";

  const ifMap = new Map<string, ParsedInterface>();
  const vlanMap = new Map<number, ParsedVlan>();
  const bgpNeighborMap = new Map<string, ParsedBgpNeighbor>();
  const prefixListMap = new Map<string, ParsedPrefixList>();

  for (const raw of rawLines) {
    const isIndented = /^\s+/.test(raw);
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "#") {
      if (trimmed === "#") mode = "global";
      continue;
    }

    if (!isIndented) {
      mode = "global";
      currentIf = null;
      currentVlan = null;

      if (/^sysname\s+(.+)$/i.test(trimmed)) {
        ir.hostname = stripQuotes(trimmed.replace(/^sysname\s+/i, ""));
        continue;
      }
      if (/^dns\s+server\s+(\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
        const m = /^dns\s+server\s+(\d+\.\d+\.\d+\.\d+)/i.exec(trimmed);
        if (m && !ir.dnsServers.includes(m[1])) ir.dnsServers.push(m[1]);
        continue;
      }
      if (/^ntp-service\s+unicast-server\s+(\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
        const m = /^ntp-service\s+unicast-server\s+(\d+\.\d+\.\d+\.\d+)/i.exec(trimmed);
        if (m && !ir.ntpServers.includes(m[1])) ir.ntpServers.push(m[1]);
        continue;
      }
      if (/^vlan\s+batch\s+(.+)$/i.test(trimmed)) {
        const tokens = trimmed.replace(/^vlan\s+batch\s+/i, "").split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i + 1]?.toLowerCase() === "to" && tokens[i + 2]) {
            const start = parseInt(tokens[i], 10);
            const end = parseInt(tokens[i + 2], 10);
            if (!Number.isNaN(start) && !Number.isNaN(end) && end - start <= 128) {
              for (let v = start; v <= end; v++) {
                if (!vlanMap.has(v)) vlanMap.set(v, { vlanId: v });
              }
            }
            i += 2;
          } else if (/^\d+$/.test(tokens[i])) {
            const v = parseInt(tokens[i], 10);
            if (!vlanMap.has(v)) vlanMap.set(v, { vlanId: v });
          }
        }
        continue;
      }
      if (/^vlan\s+(\d+)$/i.test(trimmed)) {
        const vid = parseInt(trimmed.replace(/^vlan\s+/i, ""), 10);
        if (!Number.isNaN(vid)) {
          currentVlan = vlanMap.get(vid) || { vlanId: vid };
          vlanMap.set(vid, currentVlan);
          mode = "vlan";
        }
        continue;
      }
      if (/^interface\s+(.+)$/i.test(trimmed)) {
        const ifName = trimmed.replace(/^interface\s+/i, "").trim();
        const dotMatch = /^(.+)\.(\d+)$/.exec(ifName);
        const vlanifMatch = /^Vlanif(\d+)$/i.exec(ifName);
        const baseIf = dotMatch ? dotMatch[1] : ifName;
        const unitNum = dotMatch ? parseInt(dotMatch[2], 10) : vlanifMatch ? parseInt(vlanifMatch[1], 10) : undefined;
        currentIf = ensureInterfaceEntry(ifMap, ifName, baseIf, unitNum);
        if (vlanifMatch) currentIf.vlanId = parseInt(vlanifMatch[1], 10);
        mode = "interface";
        continue;
      }
      if (/^ip\s+route-static\s+/i.test(trimmed)) {
        const parts = trimmed.split(/\s+/);
        // `ip route-static <dst> <mask|len> <gw> [preference <p>] [description <desc>]`
        const dst = parts[2];
        const maskOrLen = parts[3];
        const gw = parts[4];
        if (dst && maskOrLen && gw && isValidIpv4(gw)) {
          const parsed = /^\d+$/.test(maskOrLen)
            ? parseIpCidrOrMask(`${dst}/${maskOrLen}`)
            : parseIpCidrOrMask(dst, maskOrLen);
          if (parsed) {
            let pref: number | undefined;
            let comment: string | undefined;
            const prefIdx = parts.findIndex((p) => p.toLowerCase() === "preference");
            if (prefIdx !== -1 && parts[prefIdx + 1]) pref = parseInt(parts[prefIdx + 1], 10);
            const descIdx = parts.findIndex((p) => p.toLowerCase() === "description");
            if (descIdx !== -1 && parts[descIdx + 1]) comment = stripQuotes(parts.slice(descIdx + 1).join(" "));
            ir.staticRoutes.push({
              dstCidr: parsed.cidr,
              network: parsed.ip,
              prefixLen: parsed.prefixLen,
              netmask: parsed.netmask,
              nextHop: gw,
              distance: pref,
              comment,
            });
          }
        }
        continue;
      }
      if (/^bgp\s+(\d+)/i.test(trimmed)) {
        const m = /^bgp\s+(\d+)/i.exec(trimmed);
        if (m) ir.bgp.localAsn = parseInt(m[1], 10);
        mode = "bgp";
        continue;
      }
      if (/^ospf(?:\s+(\d+))?/i.test(trimmed)) {
        const m = /^ospf(?:\s+(\d+))?/i.exec(trimmed);
        if (m?.[1]) ir.ospf.processId = parseInt(m[1], 10);
        mode = "ospf";
        continue;
      }
      if (/^ip\s+ip-prefix\s+(\S+)\s+.*?(permit|deny)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)/i.test(trimmed)) {
        const m = /^ip\s+ip-prefix\s+(\S+)\s+.*?(permit|deny)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)/i.exec(trimmed);
        if (m) {
          const pl = prefixListMap.get(m[1]) || { name: m[1], entries: [] };
          pl.entries.push({ cidr: `${m[3]}/${m[4]}`, action: m[2].toLowerCase() === "deny" ? "deny" : "permit" });
          prefixListMap.set(m[1], pl);
        }
        continue;
      }
      continue;
    }

    // Indented block content
    if (mode === "vlan" && currentVlan && /^(description|name)\s+(.+)$/i.test(trimmed)) {
      currentVlan.name = stripQuotes(trimmed.replace(/^(description|name)\s+/i, ""));
      continue;
    }

    if (mode === "interface" && currentIf) {
      if (/^description\s+(.+)$/i.test(trimmed)) {
        currentIf.description = trimmed.replace(/^description\s+/i, "").trim();
      } else if (/^mtu\s+(\d+)$/i.test(trimmed)) {
        currentIf.mtu = parseInt(trimmed.split(/\s+/)[1], 10);
      } else if (/^(dot1q\s+termination\s+vid|vlan-type\s+dot1q)\s+(\d+)/i.test(trimmed)) {
        const m = /^(?:dot1q\s+termination\s+vid|vlan-type\s+dot1q)\s+(\d+)/i.exec(trimmed);
        if (m) currentIf.vlanId = parseInt(m[1], 10);
      } else if (/^shutdown$/i.test(trimmed)) {
        currentIf.adminUp = false;
      } else if (/^undo\s+shutdown$/i.test(trimmed)) {
        currentIf.adminUp = true;
      } else if (/^eth-trunk\s+(\d+)/i.test(trimmed)) {
        const m = /^eth-trunk\s+(\d+)/i.exec(trimmed);
        if (m) currentIf.lagParent = `Eth-Trunk${m[1]}`;
      } else if (/^ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)/i.test(trimmed)) {
        const m = /^ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)/i.exec(trimmed);
        if (m) {
          const parsed = /^\d+$/.test(m[2])
            ? parseIpCidrOrMask(`${m[1]}/${m[2]}`)
            : parseIpCidrOrMask(m[1], m[2]);
          addUniqueIp(currentIf.addresses, parsed);
        }
      }
      continue;
    }

    if (mode === "bgp") {
      if (/^router-id\s+(\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
        const m = /^router-id\s+(\d+\.\d+\.\d+\.\d+)/i.exec(trimmed);
        if (m) ir.bgp.routerId = m[1];
      } else if (/^peer\s+(\d+\.\d+\.\d+\.\d+)\s+(.+)$/i.test(trimmed)) {
        const m = /^peer\s+(\d+\.\d+\.\d+\.\d+)\s+(.+)$/i.exec(trimmed);
        if (m) {
          const peerIp = m[1];
          const rest = m[2].trim();
          const nb = bgpNeighborMap.get(peerIp) || { peerIp, remoteAsn: 0 };
          if (/^as-number\s+(\d+)/i.test(rest)) {
            nb.remoteAsn = parseInt(rest.split(/\s+/)[1], 10) || 0;
          } else if (/^description\s+(.+)/i.test(rest)) {
            nb.description = rest.replace(/^description\s+/i, "").trim();
          } else if (/^connect-interface\s+(\S+)/i.test(rest)) {
            nb.updateSource = rest.split(/\s+/)[1];
          } else if (/^ebgp-max-hop(?:\s+(\d+))?/i.test(rest)) {
            const hm = /^ebgp-max-hop(?:\s+(\d+))?/i.exec(rest);
            nb.ebgpMultihop = hm?.[1] ? parseInt(hm[1], 10) : 2;
          }
          bgpNeighborMap.set(peerIp, nb);
        }
      } else if (/^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)/i.test(trimmed)) {
        const m = /^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)/i.exec(trimmed);
        if (m) {
          const parsed = /^\d+$/.test(m[2])
            ? parseIpCidrOrMask(`${m[1]}/${m[2]}`)
            : parseIpCidrOrMask(m[1], m[2]);
          if (parsed && !ir.bgp.networks.includes(parsed.cidr)) ir.bgp.networks.push(parsed.cidr);
        }
      }
      continue;
    }

    if (mode === "ospf" || mode === "ospf_area") {
      if (/^router-id\s+(\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
        const m = /^router-id\s+(\d+\.\d+\.\d+\.\d+)/i.exec(trimmed);
        if (m) ir.ospf.routerId = m[1];
      } else if (/^area\s+(\S+)/i.test(trimmed)) {
        const m = /^area\s+(\S+)/i.exec(trimmed);
        if (m) currentOspfArea = normalizeOspfArea(m[1]);
        mode = "ospf_area";
      } else if (/^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/i.test(trimmed)) {
        const m = /^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/i.exec(trimmed);
        if (m) {
          const len = wildcardToCidr(m[2]);
          ir.ospf.interfaces.push({
            interfaceName: `${m[1]}/${len}`,
            areaId: currentOspfArea,
            networkCidr: `${m[1]}/${len}`,
          });
        }
      }
    }
  }

  for (const iface of ifMap.values()) {
    if (iface.vlanId && !vlanMap.has(iface.vlanId)) {
      vlanMap.set(iface.vlanId, { vlanId: iface.vlanId, name: `VLAN_${iface.vlanId}` });
    }
  }

  ir.interfaces = Array.from(ifMap.values());
  ir.vlans = Array.from(vlanMap.values()).sort((a, b) => a.vlanId - b.vlanId);
  ir.bgp.neighbors = Array.from(bgpNeighborMap.values());
  ir.prefixLists = Array.from(prefixListMap.values());
  return ir;
}

// ============================================================================
// VyOS / EdgeOS Parser
// ============================================================================

function parseVyosConfig(rawConfig: string): ParsedNetworkIR {
  const lines = rawConfig.split(/\r?\n/);
  const ir: ParsedNetworkIR = {
    detectedSource: "vyos",
    hostname: "VYOS-MIGRATED",
    dnsServers: [],
    ntpServers: [],
    vlans: [],
    interfaces: [],
    staticRoutes: [],
    bgp: { neighbors: [], networks: [] },
    ospf: { interfaces: [] },
    prefixLists: [],
    warnings: [],
    rawLineCount: lines.length,
  };

  const ifMap = new Map<string, ParsedInterface>();
  const vlanMap = new Map<number, ParsedVlan>();
  const routeMap = new Map<string, ParsedStaticRoute>();
  const bgpNeighborMap = new Map<string, ParsedBgpNeighbor>();

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("set ")) continue;
    const tokens = parseSetTokens(trimmed);
    const rest = tokens.slice(1);

    if (rest[0] === "system") {
      if (rest[1] === "host-name" && rest[2]) ir.hostname = stripQuotes(rest[2]);
      else if (rest[1] === "time-zone" && rest[2]) ir.timeZone = stripQuotes(rest[2]);
      else if (rest[1] === "name-server" && rest[2] && isValidIpv4(stripQuotes(rest[2]))) {
        const ip = stripQuotes(rest[2]);
        if (!ir.dnsServers.includes(ip)) ir.dnsServers.push(ip);
      } else if (rest[1] === "ntp" && rest[2] === "server" && rest[3] && isValidIpv4(stripQuotes(rest[3]))) {
        const ip = stripQuotes(rest[3]);
        if (!ir.ntpServers.includes(ip)) ir.ntpServers.push(ip);
      }
      continue;
    }

    if (rest[0] === "interfaces" && rest[1] && rest[2]) {
      const baseIf = stripQuotes(rest[2]);
      if (rest[3] === "vif" && rest[4]) {
        const vid = parseInt(rest[4], 10);
        const fullKey = `${baseIf}.${vid}`;
        const entry = ensureInterfaceEntry(ifMap, fullKey, baseIf, vid);
        entry.vlanId = vid;
        if (!vlanMap.has(vid)) vlanMap.set(vid, { vlanId: vid, name: `VLAN_${vid}` });
        if (rest[5] === "description" && rest[6]) {
          entry.description = stripQuotes(rest.slice(6).join(" "));
        } else if (rest[5] === "address" && rest[6]) {
          addUniqueIp(entry.addresses, parseIpCidrOrMask(stripQuotes(rest[6])));
        }
      } else {
        const entry = ensureInterfaceEntry(ifMap, baseIf, baseIf);
        if (rest[1] === "loopback" || rest[1] === "dummy") entry.isLoopback = true;
        if (rest[3] === "description" && rest[4]) {
          entry.description = stripQuotes(rest.slice(4).join(" "));
        } else if (rest[3] === "address" && rest[4]) {
          addUniqueIp(entry.addresses, parseIpCidrOrMask(stripQuotes(rest[4])));
        } else if (rest[3] === "mtu" && rest[4]) {
          entry.mtu = parseInt(rest[4], 10) || undefined;
        } else if (rest[3] === "disable") {
          entry.adminUp = false;
        }
      }
      continue;
    }

    if (rest[0] === "protocols" && rest[1] === "static" && rest[2] === "route" && rest[3]) {
      const parsed = parseIpCidrOrMask(stripQuotes(rest[3]));
      if (parsed) {
        const r = routeMap.get(parsed.cidr) || {
          dstCidr: parsed.cidr,
          network: parsed.ip,
          prefixLen: parsed.prefixLen,
          netmask: parsed.netmask,
          nextHop: "",
        };
        if (rest[4] === "next-hop" && rest[5]) r.nextHop = stripQuotes(rest[5]);
        routeMap.set(parsed.cidr, r);
      }
      continue;
    }

    if (rest[0] === "protocols" && rest[1] === "bgp") {
      // VyOS 1.4 (`protocols bgp system-as <asn>`) or VyOS 1.3 (`protocols bgp <asn> ...`)
      let offset = 2;
      if (rest[2] === "system-as" && rest[3]) {
        ir.bgp.localAsn = parseInt(rest[3], 10);
        continue;
      }
      if (/^\d+$/.test(rest[2])) {
        ir.bgp.localAsn = parseInt(rest[2], 10);
        offset = 3;
      }
      if (rest[offset] === "parameters" && rest[offset + 1] === "router-id" && rest[offset + 2]) {
        ir.bgp.routerId = stripQuotes(rest[offset + 2]);
      } else if (rest[offset] === "neighbor" && rest[offset + 1]) {
        const peerIp = stripQuotes(rest[offset + 1]);
        const nb = bgpNeighborMap.get(peerIp) || { peerIp, remoteAsn: 0 };
        const attr = rest[offset + 2];
        const val = rest[offset + 3];
        if (attr === "remote-as" && val) nb.remoteAsn = parseInt(stripQuotes(val), 10) || 0;
        else if (attr === "description" && val) nb.description = stripQuotes(rest.slice(offset + 3).join(" "));
        else if (attr === "update-source" && val) nb.updateSource = stripQuotes(val);
        else if (attr === "ebgp-multihop" && val) nb.ebgpMultihop = parseInt(val, 10) || 2;
        bgpNeighborMap.set(peerIp, nb);
      }
    }
  }

  ir.interfaces = Array.from(ifMap.values());
  ir.vlans = Array.from(vlanMap.values()).sort((a, b) => a.vlanId - b.vlanId);
  ir.staticRoutes = Array.from(routeMap.values()).filter((r) => Boolean(r.nextHop));
  ir.bgp.neighbors = Array.from(bgpNeighborMap.values());
  return ir;
}

export function parseNetworkConfig(
  rawConfig: string,
  sourceHint: SourceVendorFormat = "auto"
): ParsedNetworkIR {
  const detected = sourceHint === "auto" ? detectSourceVendor(rawConfig) : sourceHint;

  if (detected === "juniper_hier") {
    const flatLines = flattenJunosHierarchy(rawConfig);
    return parseJuniperSetLines(flatLines, "juniper_hier", rawConfig.split(/\r?\n/).length);
  }
  if (detected === "juniper_set") {
    const lines = rawConfig.split(/\r?\n/);
    return parseJuniperSetLines(lines, "juniper_set", lines.length);
  }
  if (detected === "mikrotik") {
    return parseMikrotikRsc(rawConfig);
  }
  if (detected === "huawei_vrp") {
    return parseHuaweiVrp(rawConfig);
  }
  if (detected === "vyos") {
    return parseVyosConfig(rawConfig);
  }
  return parseCiscoLikeCli(rawConfig);
}

// ============================================================================
// Intelligent Cross-Vendor Interface Name Mapper
// ============================================================================

export function suggestTargetInterfaceName(
  sourceBaseIf: string,
  targetVendor: TargetVendorFormat,
  fallbackIndex = 1
): string {
  const raw = sourceBaseIf.trim();
  const lower = raw.toLowerCase();

  // Extract numeric slot/port hints
  const tripleMatch = /(\d+)\/(\d+)\/(\d+)/.exec(raw);
  const doubleMatch = /(\d+)\/(\d+)/.exec(raw);
  const trailingNumMatch = /(\d+)$/.exec(raw);

  const portZeroBased = tripleMatch
    ? parseInt(tripleMatch[3], 10)
    : doubleMatch
    ? parseInt(doubleMatch[2], 10)
    : trailingNumMatch
    ? Math.max(0, parseInt(trailingNumMatch[1], 10) - (lower.startsWith("ether") ? 1 : 0))
    : fallbackIndex - 1;
  const portOneBased = portZeroBased + 1;

  const isLoopback = lower.startsWith("lo") || lower.includes("loopback") || lower.startsWith("dum");
  const isLag =
    lower.startsWith("ae") ||
    lower.startsWith("port-channel") ||
    lower.startsWith("eth-trunk") ||
    lower.startsWith("bond") ||
    lower.startsWith("smartgroup");
  const isTenGig =
    lower.startsWith("xe") ||
    lower.startsWith("ten") ||
    lower.startsWith("xgi") ||
    lower.startsWith("xgei") ||
    lower.includes("sfp-sfpplus") ||
    lower.includes("sfp+");
  const isSvi = lower.startsWith("irb") || lower.startsWith("vlanif") || /^vlan\d*/i.test(lower);
  const isBridge = lower.startsWith("bridge") || lower === "br0";

  if (isLoopback) {
    switch (targetVendor) {
      case "mikrotik_v7":
      case "mikrotik_v6":
        return "loopback0";
      case "juniper_set":
      case "juniper_hier":
        return "lo0";
      case "cisco_ios":
      case "arista_eos":
        return "Loopback0";
      case "huawei_vrp":
        return "LoopBack0";
      case "vyos":
        return "dum0";
      case "zte_zxros":
        return "loopback1";
    }
  }

  if (isLag) {
    const lagNum = trailingNumMatch ? parseInt(trailingNumMatch[1], 10) : 0;
    const oneIdx = lagNum === 0 ? 1 : lagNum;
    switch (targetVendor) {
      case "mikrotik_v7":
      case "mikrotik_v6":
        return `bonding${oneIdx}`;
      case "juniper_set":
      case "juniper_hier":
        return `ae${lagNum}`;
      case "cisco_ios":
        return `Port-channel${oneIdx}`;
      case "arista_eos":
        return `Port-Channel${oneIdx}`;
      case "huawei_vrp":
        return `Eth-Trunk${oneIdx}`;
      case "vyos":
        return `bond${lagNum}`;
      case "zte_zxros":
        return `smartgroup${oneIdx}`;
    }
  }

  if (isSvi || isBridge) {
    switch (targetVendor) {
      case "mikrotik_v7":
      case "mikrotik_v6":
        return "bridge-lan";
      case "juniper_set":
      case "juniper_hier":
        return "irb";
      case "cisco_ios":
      case "arista_eos":
        return "Vlan";
      case "huawei_vrp":
        return "Vlanif";
      case "vyos":
        return "br0";
      case "zte_zxros":
        return "vlan";
    }
  }

  switch (targetVendor) {
    case "mikrotik_v7":
    case "mikrotik_v6":
      return isTenGig ? `sfp-sfpplus${portOneBased}` : `ether${portOneBased}`;
    case "juniper_set":
    case "juniper_hier":
      return isTenGig ? `xe-0/0/${portZeroBased}` : `ge-0/0/${portZeroBased}`;
    case "cisco_ios":
      return isTenGig
        ? `TenGigabitEthernet0/0/${portZeroBased}`
        : `GigabitEthernet0/${portZeroBased}`;
    case "huawei_vrp":
      return isTenGig
        ? `XGigabitEthernet0/0/${portZeroBased}`
        : `GigabitEthernet0/0/${portZeroBased}`;
    case "arista_eos":
      return `Ethernet${portOneBased}`;
    case "vyos":
      return `eth${portZeroBased}`;
    case "zte_zxros":
      return isTenGig ? `xgei-0/1/0/${portOneBased}` : `gei-0/1/0/${portOneBased}`;
  }
}

export function buildInterfaceMapping(
  ir: ParsedNetworkIR,
  targetVendor: TargetVendorFormat,
  customMap?: Record<string, string>
): InterfaceMappingEntry[] {
  const uniqueBases = Array.from(new Set(ir.interfaces.map((i) => i.baseInterface)));
  return uniqueBases.map((base, idx) => ({
    sourceBase: base,
    targetBase:
      customMap && customMap[base] && customMap[base].trim()
        ? customMap[base].trim()
        : suggestTargetInterfaceName(base, targetVendor, idx + 1),
  }));
}

function resolveMappedInterface(
  iface: ParsedInterface,
  targetVendor: TargetVendorFormat,
  mapLookup: Map<string, string>
): string {
  const baseTarget = mapLookup.get(iface.baseInterface) || suggestTargetInterfaceName(iface.baseInterface, targetVendor);
  if (iface.isLoopback) return baseTarget;

  // Handle SVI VLAN interfaces
  const lower = iface.baseInterface.toLowerCase();
  if (lower === "irb" || lower.startsWith("vlan")) {
    const vid = iface.vlanId || iface.unitNumber || 1;
    switch (targetVendor) {
      case "cisco_ios":
      case "arista_eos":
        return `Vlan${vid}`;
      case "huawei_vrp":
        return `Vlanif${vid}`;
      case "zte_zxros":
        return `vlan${vid}`;
      case "juniper_set":
      case "juniper_hier":
        return `irb.${vid}`;
      case "vyos":
        return `br0.${vid}`;
      case "mikrotik_v7":
      case "mikrotik_v6":
        return `vlan${vid}`;
    }
  }

  return baseTarget;
}

// ============================================================================
// Vendor Target Emitters
// ============================================================================

function buildBannerComments(ir: ParsedNetworkIR, targetMeta: TargetVendorMeta, commentPrefix: string): string[] {
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  return [
    `${commentPrefix} ========================================================================`,
    `${commentPrefix} Generated by ACTIS Cross-Vendor Backup Config Translator`,
    `${commentPrefix} Source Vendor : ${getSourceVendorLabel(ir.detectedSource)}`,
    `${commentPrefix} Target Vendor : ${targetMeta.label}`,
    `${commentPrefix} Hostname      : ${ir.hostname}`,
    `${commentPrefix} Generated At  : ${nowStr}`,
    `${commentPrefix} NOTE: Review interface names, BGP policies & credentials before apply!`,
    `${commentPrefix} ========================================================================`,
    "",
  ];
}

function emitMikrotik(
  ir: ParsedNetworkIR,
  version: "v7" | "v6",
  mapLookup: Map<string, string>
): string {
  const meta = TARGET_VENDOR_META[version === "v7" ? "mikrotik_v7" : "mikrotik_v6"];
  const lines: string[] = [...buildBannerComments(ir, meta, "#")];

  // Identity & Clock
  lines.push("/system identity");
  lines.push(`set name=${quoteIfNeeded(ir.hostname)}`);
  if (ir.timeZone) {
    lines.push("/system clock");
    lines.push(`set time-zone-name=${quoteIfNeeded(ir.timeZone)}`);
  }
  lines.push("");

  // Loopback bridge
  const hasLoopback = ir.interfaces.some((i) => i.isLoopback);
  if (hasLoopback) {
    lines.push("/interface bridge");
    lines.push('add name=loopback0 comment="Loopback / Router-ID"');
    lines.push("");
  }

  // Physical base descriptions/MTU & LAG
  const lagBaseIfs = ir.interfaces.filter((i) => i.isLag && !i.vlanId);
  if (lagBaseIfs.length > 0) {
    lines.push("/interface bonding");
    for (const lag of lagBaseIfs) {
      const targetName = resolveMappedInterface(lag, version === "v7" ? "mikrotik_v7" : "mikrotik_v6", mapLookup);
      const slaves = ir.interfaces
        .filter((m) => m.lagParent === lag.baseInterface)
        .map((m) => mapLookup.get(m.baseInterface) || m.baseInterface);
      lines.push(
        `add name=${targetName} mode=802.3ad lacp-rate=30secs${
          slaves.length > 0 ? ` slaves=${slaves.join(",")}` : ""
        }${lag.description ? ` comment=${quoteIfNeeded(lag.description)}` : ""}`
      );
    }
    lines.push("");
  }

  const physIfs = ir.interfaces.filter((i) => !i.isLoopback && !i.isLag && !i.vlanId);
  if (physIfs.length > 0) {
    lines.push("/interface ethernet");
    for (const p of physIfs) {
      const targetName = resolveMappedInterface(p, version === "v7" ? "mikrotik_v7" : "mikrotik_v6", mapLookup);
      const attrs: string[] = [];
      if (p.mtu) attrs.push(`mtu=${p.mtu}`);
      if (p.description) attrs.push(`comment=${quoteIfNeeded(p.description)}`);
      if (!p.adminUp) attrs.push("disabled=yes");
      if (attrs.length > 0) {
        lines.push(`set [ find default-name=${targetName} ] ${attrs.join(" ")}`);
      }
    }
    lines.push("");
  }

  // VLAN Subinterfaces
  const vlanIfs = ir.interfaces.filter((i) => Boolean(i.vlanId));
  const createdVlanIfNames = new Map<string, string>();
  if (vlanIfs.length > 0 || ir.vlans.length > 0) {
    lines.push("/interface vlan");
    for (const vif of vlanIfs) {
      const parentName = mapLookup.get(vif.baseInterface) || suggestTargetInterfaceName(vif.baseInterface, "mikrotik_v7");
      const safeParent = parentName === "bridge-lan" ? "ether1" : parentName;
      const vlanIfName =
        vif.baseInterface.toLowerCase().startsWith("irb") || vif.baseInterface.toLowerCase().startsWith("vlan")
          ? `vlan${vif.vlanId}`
          : `${safeParent}-vlan${vif.vlanId}`;
      createdVlanIfNames.set(vif.sourceName, vlanIfName);
      lines.push(
        `add name=${vlanIfName} vlan-id=${vif.vlanId} interface=${safeParent}${
          vif.description ? ` comment=${quoteIfNeeded(vif.description)}` : ""
        }${!vif.adminUp ? " disabled=yes" : ""}`
      );
    }
    lines.push("");
  }

  // IP Addresses
  const ipEntries = ir.interfaces.flatMap((iface) =>
    iface.addresses.map((addr) => ({ iface, addr }))
  );
  if (ipEntries.length > 0) {
    lines.push("/ip address");
    for (const { iface, addr } of ipEntries) {
      const targetIf = iface.isLoopback
        ? "loopback0"
        : createdVlanIfNames.get(iface.sourceName) ||
          resolveMappedInterface(iface, version === "v7" ? "mikrotik_v7" : "mikrotik_v6", mapLookup);
      lines.push(
        `add address=${addr.cidr} interface=${targetIf}${
          iface.description ? ` comment=${quoteIfNeeded(iface.description)}` : ""
        }`
      );
    }
    lines.push("");
  }

  // DNS & NTP
  if (ir.dnsServers.length > 0) {
    lines.push("/ip dns");
    lines.push(`set servers=${ir.dnsServers.join(",")} allow-remote-requests=no`);
    lines.push("");
  }
  if (ir.ntpServers.length > 0) {
    lines.push("/system ntp client");
    lines.push(
      version === "v7"
        ? `set enabled=yes servers=${ir.ntpServers.join(",")}`
        : `set enabled=yes primary-ntp=${ir.ntpServers[0]}${
            ir.ntpServers[1] ? ` secondary-ntp=${ir.ntpServers[1]}` : ""
          }`
    );
    lines.push("");
  }

  // Static Routes
  if (ir.staticRoutes.length > 0) {
    lines.push("/ip route");
    for (const r of ir.staticRoutes) {
      lines.push(
        `add dst-address=${r.dstCidr} gateway=${r.nextHop}${
          r.distance ? ` distance=${r.distance}` : ""
        }${r.comment ? ` comment=${quoteIfNeeded(r.comment)}` : ""}`
      );
    }
    lines.push("");
  }

  // Prefix Lists -> Address List
  if (ir.prefixLists.length > 0) {
    lines.push("/ip firewall address-list");
    for (const pl of ir.prefixLists) {
      for (const entry of pl.entries) {
        lines.push(`add list=${quoteIfNeeded(pl.name)} address=${entry.cidr}`);
      }
    }
    lines.push("");
  }

  // BGP
  if (ir.bgp.localAsn || ir.bgp.neighbors.length > 0) {
    const localAs = ir.bgp.localAsn || 65000;
    const rid = ir.bgp.routerId || "1.1.1.1";

    if (version === "v7") {
      lines.push("/routing bgp template");
      lines.push(`add name=bgp-default as=${localAs} router-id=${rid}`);
      if (ir.bgp.neighbors.length > 0) {
        lines.push("/routing bgp connection");
        for (const nb of ir.bgp.neighbors) {
          const peerName = safeFileSlug(nb.description || `peer-${nb.peerIp}`);
          const role = nb.remoteAsn === localAs ? "ibgp" : "ebgp";
          lines.push(
            `add name=${quoteIfNeeded(peerName)} template=bgp-default remote.address=${
              nb.peerIp
            }/32 remote.as=${nb.remoteAsn || localAs} local.role=${role}${
              nb.localAddress ? ` local.address=${nb.localAddress}` : ""
            }${nb.ebgpMultihop ? " multihop=yes" : ""}${
              nb.description ? ` comment=${quoteIfNeeded(nb.description)}` : ""
            }`
          );
        }
      }
    } else {
      lines.push("/routing bgp instance");
      lines.push(`set default as=${localAs} router-id=${rid}`);
      if (ir.bgp.neighbors.length > 0) {
        lines.push("/routing bgp peer");
        for (const nb of ir.bgp.neighbors) {
          const peerName = safeFileSlug(nb.description || `peer-${nb.peerIp}`);
          lines.push(
            `add name=${quoteIfNeeded(peerName)} instance=default remote-address=${
              nb.peerIp
            } remote-as=${nb.remoteAsn || localAs}${
              nb.ebgpMultihop ? " multihop=yes" : ""
            }${nb.description ? ` comment=${quoteIfNeeded(nb.description)}` : ""}`
          );
        }
      }
    }
    lines.push("");
  }

  // OSPF
  if (ir.ospf.interfaces.length > 0 || ir.ospf.routerId) {
    if (version === "v7") {
      lines.push("/routing ospf instance");
      lines.push(`add name=ospf-v2 version=2 router-id=${ir.ospf.routerId || ir.bgp.routerId || "1.1.1.1"}`);
      const areas = Array.from(new Set(ir.ospf.interfaces.map((i) => i.areaId)));
      if (areas.length > 0) {
        lines.push("/routing ospf area");
        for (const areaId of areas) {
          lines.push(`add name=area-${areaId} instance=ospf-v2 area-id=${areaId}`);
        }
        lines.push("/routing ospf interface-template");
        for (const oi of ir.ospf.interfaces) {
          const base = oi.interfaceName.split(".")[0];
          const mappedIf = mapLookup.get(base) || suggestTargetInterfaceName(base, "mikrotik_v7");
          lines.push(
            `add area=area-${oi.areaId}${
              oi.networkCidr ? ` networks=${oi.networkCidr}` : ` interfaces=${mappedIf}`
            }${oi.passive ? " passive" : ""}`
          );
        }
      }
    } else {
      lines.push("/routing ospf instance");
      lines.push(`set default router-id=${ir.ospf.routerId || ir.bgp.routerId || "1.1.1.1"}`);
      lines.push("/routing ospf network");
      for (const oi of ir.ospf.interfaces) {
        if (oi.networkCidr) {
          lines.push(`add network=${oi.networkCidr} area=backbone`);
        } else {
          lines.push(`# interface=${oi.interfaceName} area=${oi.areaId}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function emitCiscoStyle(
  ir: ParsedNetworkIR,
  variant: "cisco_ios" | "arista_eos" | "zte_zxros",
  mapLookup: Map<string, string>
): string {
  const meta = TARGET_VENDOR_META[variant];
  const lines: string[] = [...buildBannerComments(ir, meta, "!")];

  lines.push(`hostname ${ir.hostname}`);
  if (ir.domainName) lines.push(`ip domain-name ${ir.domainName}`);
  for (const dns of ir.dnsServers) {
    lines.push(`ip name-server ${dns}`);
  }
  for (const ntp of ir.ntpServers) {
    lines.push(`ntp server ${ntp}`);
  }
  lines.push("!");

  // VLAN Database
  if (ir.vlans.length > 0) {
    for (const v of ir.vlans) {
      lines.push(`vlan ${v.vlanId}`);
      if (v.name) lines.push(` name ${v.name}`);
      lines.push("!");
    }
  }

  // Group physical interfaces + subinterfaces cleanly
  for (const iface of ir.interfaces) {
    const baseMapped = resolveMappedInterface(iface, variant, mapLookup);
    const isSubIf =
      Boolean(iface.vlanId) &&
      !iface.baseInterface.toLowerCase().startsWith("irb") &&
      !iface.baseInterface.toLowerCase().startsWith("vlan");
    const targetName = isSubIf ? `${baseMapped}.${iface.vlanId}` : baseMapped;

    lines.push(`interface ${targetName}`);
    if (iface.description) lines.push(` description ${iface.description}`);
    if (iface.mtu && !isSubIf) lines.push(` mtu ${iface.mtu}`);
    if (isSubIf && iface.vlanId) {
      lines.push(
        variant === "zte_zxros"
          ? ` encapsulation dot1q ${iface.vlanId}`
          : ` encapsulation dot1Q ${iface.vlanId}`
      );
    }
    if (iface.lagParent && !isSubIf) {
      const lagId = /(\d+)$/.exec(iface.lagParent)?.[1] || "1";
      lines.push(
        variant === "zte_zxros"
          ? ` smartgroup ${lagId} mode active`
          : ` channel-group ${lagId === "0" ? "1" : lagId} mode active`
      );
    }
    for (const addr of iface.addresses) {
      lines.push(` ip address ${addr.ip} ${addr.netmask}`);
    }
    lines.push(iface.adminUp ? " no shutdown" : " shutdown");
    lines.push("!");
  }

  // Static Routes
  for (const r of ir.staticRoutes) {
    lines.push(
      `ip route ${r.network} ${r.netmask} ${r.nextHop}${r.distance ? ` ${r.distance}` : ""}`
    );
  }
  if (ir.staticRoutes.length > 0) lines.push("!");

  // Prefix Lists
  for (const pl of ir.prefixLists) {
    pl.entries.forEach((e, idx) => {
      lines.push(`ip prefix-list ${pl.name} seq ${(idx + 1) * 5} ${e.action || "permit"} ${e.cidr}`);
    });
    lines.push("!");
  }

  // BGP
  if (ir.bgp.localAsn || ir.bgp.neighbors.length > 0) {
    const localAs = ir.bgp.localAsn || 65000;
    lines.push(`router bgp ${localAs}`);
    if (ir.bgp.routerId) lines.push(` bgp router-id ${ir.bgp.routerId}`);
    lines.push(" bgp log-neighbor-changes");
    for (const nb of ir.bgp.neighbors) {
      lines.push(` neighbor ${nb.peerIp} remote-as ${nb.remoteAsn || localAs}`);
      if (nb.description) lines.push(` neighbor ${nb.peerIp} description ${nb.description}`);
      if (nb.updateSource) lines.push(` neighbor ${nb.peerIp} update-source ${nb.updateSource}`);
      if (nb.ebgpMultihop) lines.push(` neighbor ${nb.peerIp} ebgp-multihop ${nb.ebgpMultihop}`);
    }
    lines.push(" address-family ipv4");
    for (const net of ir.bgp.networks) {
      const parsed = parseIpCidrOrMask(net);
      if (parsed) lines.push(`  network ${parsed.ip} mask ${parsed.netmask}`);
    }
    for (const nb of ir.bgp.neighbors) {
      lines.push(`  neighbor ${nb.peerIp} activate`);
    }
    lines.push(" exit-address-family");
    lines.push("!");
  }

  // OSPF
  if (ir.ospf.interfaces.length > 0 || ir.ospf.routerId) {
    lines.push(`router ospf ${ir.ospf.processId || 1}`);
    if (ir.ospf.routerId) lines.push(` router-id ${ir.ospf.routerId}`);
    for (const oi of ir.ospf.interfaces) {
      if (oi.networkCidr) {
        const parsed = parseIpCidrOrMask(oi.networkCidr);
        if (parsed) {
          lines.push(
            ` network ${parsed.ip} ${cidrToWildcard(parsed.prefixLen)} area ${oi.areaId}`
          );
        }
      } else {
        lines.push(` ! area ${oi.areaId} -> interface ${oi.interfaceName}`);
      }
      if (oi.passive && !oi.networkCidr) {
        const base = oi.interfaceName.split(".")[0];
        lines.push(` passive-interface ${mapLookup.get(base) || base}`);
      }
    }
    lines.push("!");
  }

  lines.push("end");
  return lines.join("\n") + "\n";
}

function emitHuaweiVrp(ir: ParsedNetworkIR, mapLookup: Map<string, string>): string {
  const meta = TARGET_VENDOR_META.huawei_vrp;
  const lines: string[] = [...buildBannerComments(ir, meta, "#")];

  lines.push(`sysname ${ir.hostname}`);
  lines.push("#");
  for (const dns of ir.dnsServers) lines.push(`dns server ${dns}`);
  for (const ntp of ir.ntpServers) lines.push(`ntp-service unicast-server ${ntp}`);
  if (ir.vlans.length > 0) {
    lines.push(`vlan batch ${ir.vlans.map((v) => v.vlanId).join(" ")}`);
    for (const v of ir.vlans) {
      if (v.name) {
        lines.push(`vlan ${v.vlanId}`);
        lines.push(` description ${v.name}`);
      }
    }
  }
  lines.push("#");

  for (const iface of ir.interfaces) {
    const baseMapped = resolveMappedInterface(iface, "huawei_vrp", mapLookup);
    const isSubIf =
      Boolean(iface.vlanId) &&
      !iface.baseInterface.toLowerCase().startsWith("irb") &&
      !iface.baseInterface.toLowerCase().startsWith("vlan");
    const targetName = isSubIf ? `${baseMapped}.${iface.vlanId}` : baseMapped;

    lines.push(`interface ${targetName}`);
    if (iface.description) lines.push(` description ${iface.description}`);
    if (iface.mtu && !isSubIf) lines.push(` mtu ${iface.mtu}`);
    if (isSubIf && iface.vlanId) {
      lines.push(` dot1q termination vid ${iface.vlanId}`);
      lines.push(" arp broadcast enable");
    }
    if (iface.lagParent && !isSubIf) {
      const lagNum = /(\d+)$/.exec(iface.lagParent)?.[1] || "1";
      lines.push(` eth-trunk ${lagNum === "0" ? "1" : lagNum}`);
    }
    for (const addr of iface.addresses) {
      lines.push(` ip address ${addr.ip} ${addr.netmask}`);
    }
    lines.push(iface.adminUp ? " undo shutdown" : " shutdown");
    lines.push("#");
  }

  for (const r of ir.staticRoutes) {
    lines.push(
      `ip route-static ${r.network} ${r.netmask} ${r.nextHop}${
        r.distance ? ` preference ${r.distance}` : ""
      }${r.comment ? ` description ${safeFileSlug(r.comment)}` : ""}`
    );
  }
  if (ir.staticRoutes.length > 0) lines.push("#");

  for (const pl of ir.prefixLists) {
    pl.entries.forEach((e, idx) => {
      const parsed = parseIpCidrOrMask(e.cidr);
      if (parsed) {
        lines.push(
          `ip ip-prefix ${pl.name} index ${(idx + 1) * 10} ${e.action || "permit"} ${
            parsed.ip
          } ${parsed.prefixLen}`
        );
      }
    });
  }
  if (ir.prefixLists.length > 0) lines.push("#");

  if (ir.bgp.localAsn || ir.bgp.neighbors.length > 0) {
    const localAs = ir.bgp.localAsn || 65000;
    lines.push(`bgp ${localAs}`);
    if (ir.bgp.routerId) lines.push(` router-id ${ir.bgp.routerId}`);
    for (const nb of ir.bgp.neighbors) {
      lines.push(` peer ${nb.peerIp} as-number ${nb.remoteAsn || localAs}`);
      if (nb.description) lines.push(` peer ${nb.peerIp} description ${nb.description}`);
      if (nb.updateSource) lines.push(` peer ${nb.peerIp} connect-interface ${nb.updateSource}`);
      if (nb.ebgpMultihop) lines.push(` peer ${nb.peerIp} ebgp-max-hop ${nb.ebgpMultihop}`);
    }
    lines.push(" ipv4-family unicast");
    lines.push("  undo synchronization");
    for (const net of ir.bgp.networks) {
      const parsed = parseIpCidrOrMask(net);
      if (parsed) lines.push(`  network ${parsed.ip} ${parsed.netmask}`);
    }
    for (const nb of ir.bgp.neighbors) {
      lines.push(`  peer ${nb.peerIp} enable`);
    }
    lines.push("#");
  }

  if (ir.ospf.interfaces.length > 0 || ir.ospf.routerId) {
    lines.push(`ospf ${ir.ospf.processId || 1}${ir.ospf.routerId ? ` router-id ${ir.ospf.routerId}` : ""}`);
    const byArea = new Map<string, ParsedOspfInterface[]>();
    for (const oi of ir.ospf.interfaces) {
      const list = byArea.get(oi.areaId) || [];
      list.push(oi);
      byArea.set(oi.areaId, list);
    }
    for (const [areaId, items] of byArea.entries()) {
      lines.push(` area ${areaId}`);
      for (const oi of items) {
        if (oi.networkCidr) {
          const parsed = parseIpCidrOrMask(oi.networkCidr);
          if (parsed) lines.push(`  network ${parsed.ip} ${cidrToWildcard(parsed.prefixLen)}`);
        } else {
          lines.push(`  # interface ${oi.interfaceName}${oi.passive ? " (silent)" : ""}`);
        }
      }
    }
    lines.push("#");
  }

  lines.push("return");
  return lines.join("\n") + "\n";
}

function emitJuniperSet(ir: ParsedNetworkIR, mapLookup: Map<string, string>): string {
  const meta = TARGET_VENDOR_META.juniper_set;
  const lines: string[] = [...buildBannerComments(ir, meta, "#")];

  lines.push(`set system host-name ${ir.hostname}`);
  if (ir.domainName) lines.push(`set system domain-name ${ir.domainName}`);
  if (ir.timeZone) lines.push(`set system time-zone ${ir.timeZone}`);
  for (const dns of ir.dnsServers) lines.push(`set system name-server ${dns}`);
  for (const ntp of ir.ntpServers) lines.push(`set system ntp server ${ntp}`);

  // Group VLAN-tagging bases
  const vlanTaggedBases = new Set(
    ir.interfaces.filter((i) => Boolean(i.vlanId)).map((i) => i.baseInterface)
  );
  for (const base of vlanTaggedBases) {
    const mappedBase = mapLookup.get(base) || suggestTargetInterfaceName(base, "juniper_set");
    if (mappedBase !== "irb") lines.push(`set interfaces ${mappedBase} vlan-tagging`);
  }

  for (const iface of ir.interfaces) {
    const baseMapped = mapLookup.get(iface.baseInterface) || suggestTargetInterfaceName(iface.baseInterface, "juniper_set");
    const unitNum = iface.vlanId || iface.unitNumber || 0;
    if (iface.description) {
      lines.push(`set interfaces ${baseMapped} unit ${unitNum} description ${quoteIfNeeded(iface.description)}`);
    }
    if (iface.vlanId && baseMapped !== "irb") {
      lines.push(`set interfaces ${baseMapped} unit ${unitNum} vlan-id ${iface.vlanId}`);
    }
    if (!iface.adminUp) {
      lines.push(`set interfaces ${baseMapped} unit ${unitNum} disable`);
    }
    if (iface.lagParent) {
      const aeMapped = suggestTargetInterfaceName(iface.lagParent, "juniper_set");
      lines.push(`set interfaces ${baseMapped} gigether-options 802.3ad ${aeMapped}`);
    }
    for (const addr of iface.addresses) {
      lines.push(`set interfaces ${baseMapped} unit ${unitNum} family inet address ${addr.cidr}`);
    }
  }

  for (const v of ir.vlans) {
    const vName = safeFileSlug(v.name || `VLAN-${v.vlanId}`);
    lines.push(`set vlans ${vName} vlan-id ${v.vlanId}`);
  }

  if (ir.bgp.localAsn) lines.push(`set routing-options autonomous-system ${ir.bgp.localAsn}`);
  if (ir.bgp.routerId || ir.ospf.routerId) {
    lines.push(`set routing-options router-id ${ir.bgp.routerId || ir.ospf.routerId}`);
  }
  for (const r of ir.staticRoutes) {
    lines.push(`set routing-options static route ${r.dstCidr} next-hop ${r.nextHop}`);
    if (r.distance) lines.push(`set routing-options static route ${r.dstCidr} preference ${r.distance}`);
  }

  for (const nb of ir.bgp.neighbors) {
    const gName = safeFileSlug(nb.groupName || "BGP-PEERS");
    lines.push(`set protocols bgp group ${gName} type ${nb.remoteAsn === ir.bgp.localAsn ? "internal" : "external"}`);
    if (nb.localAddress) {
      lines.push(`set protocols bgp group ${gName} neighbor ${nb.peerIp} local-address ${nb.localAddress}`);
    }
    if (nb.description) {
      lines.push(`set protocols bgp group ${gName} neighbor ${nb.peerIp} description ${quoteIfNeeded(nb.description)}`);
    }
    lines.push(`set protocols bgp group ${gName} neighbor ${nb.peerIp} peer-as ${nb.remoteAsn || ir.bgp.localAsn || 65000}`);
    if (nb.ebgpMultihop) {
      lines.push(`set protocols bgp group ${gName} neighbor ${nb.peerIp} multihop ttl ${nb.ebgpMultihop}`);
    }
  }

  for (const oi of ir.ospf.interfaces) {
    const ifMapped = oi.interfaceName.includes("/") ? "ge-0/0/0.0" : oi.interfaceName;
    lines.push(`set protocols ospf area ${oi.areaId} interface ${ifMapped}${oi.passive ? " passive" : ""}`);
  }

  for (const pl of ir.prefixLists) {
    for (const e of pl.entries) {
      lines.push(`set policy-options prefix-list ${pl.name} ${e.cidr}`);
    }
  }

  return lines.join("\n") + "\n";
}

function emitJuniperHier(ir: ParsedNetworkIR, mapLookup: Map<string, string>): string {
  const meta = TARGET_VENDOR_META.juniper_hier;
  const lines: string[] = [...buildBannerComments(ir, meta, "#")];

  lines.push("system {");
  lines.push(`    host-name ${ir.hostname};`);
  if (ir.domainName) lines.push(`    domain-name ${ir.domainName};`);
  if (ir.timeZone) lines.push(`    time-zone ${ir.timeZone};`);
  if (ir.dnsServers.length > 0) {
    lines.push("    name-server {");
    for (const dns of ir.dnsServers) lines.push(`        ${dns};`);
    lines.push("    }");
  }
  if (ir.ntpServers.length > 0) {
    lines.push("    ntp {");
    for (const ntp of ir.ntpServers) lines.push(`        server ${ntp};`);
    lines.push("    }");
  }
  lines.push("}");

  // Interfaces grouped by mapped base interface
  const grouped = new Map<string, ParsedInterface[]>();
  for (const iface of ir.interfaces) {
    const baseMapped = mapLookup.get(iface.baseInterface) || suggestTargetInterfaceName(iface.baseInterface, "juniper_hier");
    const list = grouped.get(baseMapped) || [];
    list.push(iface);
    grouped.set(baseMapped, list);
  }

  if (grouped.size > 0) {
    lines.push("interfaces {");
    for (const [baseName, items] of grouped.entries()) {
      lines.push(`    ${baseName} {`);
      const hasVlan = items.some((i) => Boolean(i.vlanId)) && baseName !== "irb";
      if (hasVlan) lines.push("        vlan-tagging;");
      for (const item of items) {
        const unitNum = item.vlanId || item.unitNumber || 0;
        lines.push(`        unit ${unitNum} {`);
        if (item.description) lines.push(`            description ${quoteIfNeeded(item.description)};`);
        if (item.vlanId && baseName !== "irb") lines.push(`            vlan-id ${item.vlanId};`);
        if (!item.adminUp) lines.push("            disable;");
        if (item.addresses.length > 0) {
          lines.push("            family inet {");
          for (const addr of item.addresses) lines.push(`                address ${addr.cidr};`);
          lines.push("            }");
        }
        lines.push("        }");
      }
      lines.push("    }");
    }
    lines.push("}");
  }

  if (ir.staticRoutes.length > 0 || ir.bgp.localAsn || ir.bgp.routerId) {
    lines.push("routing-options {");
    if (ir.staticRoutes.length > 0) {
      lines.push("    static {");
      for (const r of ir.staticRoutes) {
        if (r.distance) {
          lines.push(`        route ${r.dstCidr} {`);
          lines.push(`            next-hop ${r.nextHop};`);
          lines.push(`            preference ${r.distance};`);
          lines.push("        }");
        } else {
          lines.push(`        route ${r.dstCidr} next-hop ${r.nextHop};`);
        }
      }
      lines.push("    }");
    }
    if (ir.bgp.routerId || ir.ospf.routerId) {
      lines.push(`    router-id ${ir.bgp.routerId || ir.ospf.routerId};`);
    }
    if (ir.bgp.localAsn) lines.push(`    autonomous-system ${ir.bgp.localAsn};`);
    lines.push("}");
  }

  if (ir.bgp.neighbors.length > 0 || ir.ospf.interfaces.length > 0) {
    lines.push("protocols {");
    if (ir.bgp.neighbors.length > 0) {
      lines.push("    bgp {");
      lines.push("        group EXTERNAL-PEERS {");
      lines.push("            type external;");
      for (const nb of ir.bgp.neighbors) {
        lines.push(`            neighbor ${nb.peerIp} {`);
        if (nb.description) lines.push(`                description ${quoteIfNeeded(nb.description)};`);
        if (nb.localAddress) lines.push(`                local-address ${nb.localAddress};`);
        lines.push(`                peer-as ${nb.remoteAsn || ir.bgp.localAsn || 65000};`);
        lines.push("            }");
      }
      lines.push("        }");
      lines.push("    }");
    }
    if (ir.ospf.interfaces.length > 0) {
      lines.push("    ospf {");
      for (const oi of ir.ospf.interfaces) {
        lines.push(`        area ${oi.areaId} {`);
        lines.push(`            interface ${oi.interfaceName}${oi.passive ? " { passive; }" : ";"}`);
        lines.push("        }");
      }
      lines.push("    }");
    }
    lines.push("}");
  }

  return lines.join("\n") + "\n";
}

function emitVyos(ir: ParsedNetworkIR, mapLookup: Map<string, string>): string {
  const meta = TARGET_VENDOR_META.vyos;
  const lines: string[] = [...buildBannerComments(ir, meta, "#")];

  lines.push(`set system host-name ${quoteIfNeeded(ir.hostname)}`);
  if (ir.timeZone) lines.push(`set system time-zone ${quoteIfNeeded(ir.timeZone)}`);
  for (const dns of ir.dnsServers) lines.push(`set system name-server ${dns}`);
  for (const ntp of ir.ntpServers) lines.push(`set system ntp server ${ntp}`);

  for (const iface of ir.interfaces) {
    const baseMapped = mapLookup.get(iface.baseInterface) || suggestTargetInterfaceName(iface.baseInterface, "vyos");
    const ifType = iface.isLoopback ? "dummy" : iface.isLag ? "bonding" : "ethernet";
    const prefix =
      iface.vlanId && !iface.isLoopback
        ? `set interfaces ${ifType} ${baseMapped} vif ${iface.vlanId}`
        : `set interfaces ${ifType} ${baseMapped}`;

    if (iface.description) lines.push(`${prefix} description ${quoteIfNeeded(iface.description)}`);
    if (iface.mtu && !iface.vlanId) lines.push(`${prefix} mtu ${iface.mtu}`);
    if (!iface.adminUp) lines.push(`${prefix} disable`);
    for (const addr of iface.addresses) {
      lines.push(`${prefix} address '${addr.cidr}'`);
    }
  }

  for (const r of ir.staticRoutes) {
    lines.push(`set protocols static route ${r.dstCidr} next-hop ${r.nextHop}`);
  }

  if (ir.bgp.localAsn || ir.bgp.neighbors.length > 0) {
    const localAs = ir.bgp.localAsn || 65000;
    lines.push(`set protocols bgp system-as ${localAs}`);
    if (ir.bgp.routerId) lines.push(`set protocols bgp parameters router-id ${ir.bgp.routerId}`);
    for (const nb of ir.bgp.neighbors) {
      lines.push(`set protocols bgp neighbor ${nb.peerIp} remote-as ${nb.remoteAsn || localAs}`);
      if (nb.description) {
        lines.push(`set protocols bgp neighbor ${nb.peerIp} description ${quoteIfNeeded(nb.description)}`);
      }
      if (nb.updateSource) {
        lines.push(`set protocols bgp neighbor ${nb.peerIp} update-source ${nb.updateSource}`);
      }
      if (nb.ebgpMultihop) {
        lines.push(`set protocols bgp neighbor ${nb.peerIp} ebgp-multihop ${nb.ebgpMultihop}`);
      }
      lines.push(`set protocols bgp neighbor ${nb.peerIp} address-family ipv4-unicast`);
    }
  }

  return lines.join("\n") + "\n";
}

// ============================================================================
// Public Translation Entrypoint
// ============================================================================

export function translateNetworkConfig(
  rawConfig: string,
  options: {
    sourceVendor?: SourceVendorFormat;
    targetVendor: TargetVendorFormat;
    customHostname?: string;
    interfaceMap?: Record<string, string>;
  }
): TranslationResult {
  const ir = parseNetworkConfig(rawConfig, options.sourceVendor || "auto");
  if (options.customHostname && options.customHostname.trim()) {
    ir.hostname = options.customHostname.trim();
  }

  const targetMeta = TARGET_VENDOR_META[options.targetVendor];
  const interfaceMapping = buildInterfaceMapping(ir, options.targetVendor, options.interfaceMap);
  const mapLookup = new Map<string, string>(
    interfaceMapping.map((m) => [m.sourceBase, m.targetBase])
  );

  let generatedConfig = "";
  switch (options.targetVendor) {
    case "mikrotik_v7":
      generatedConfig = emitMikrotik(ir, "v7", mapLookup);
      break;
    case "mikrotik_v6":
      generatedConfig = emitMikrotik(ir, "v6", mapLookup);
      break;
    case "cisco_ios":
    case "arista_eos":
    case "zte_zxros":
      generatedConfig = emitCiscoStyle(ir, options.targetVendor, mapLookup);
      break;
    case "huawei_vrp":
      generatedConfig = emitHuaweiVrp(ir, mapLookup);
      break;
    case "juniper_set":
      generatedConfig = emitJuniperSet(ir, mapLookup);
      break;
    case "juniper_hier":
      generatedConfig = emitJuniperHier(ir, mapLookup);
      break;
    case "vyos":
      generatedConfig = emitVyos(ir, mapLookup);
      break;
  }

  const ipCount = ir.interfaces.reduce((acc, i) => acc + i.addresses.length, 0);
  const stamp = new Date().toISOString().slice(0, 10);
  const suggestedFileName = `${safeFileSlug(ir.hostname)}_to_${targetMeta.id}_${stamp}.${targetMeta.fileExt}`;

  return {
    detectedSource: ir.detectedSource,
    sourceLabel: getSourceVendorLabel(ir.detectedSource),
    targetVendor: options.targetVendor,
    targetMeta,
    suggestedFileName,
    generatedConfig,
    ir,
    interfaceMapping,
    stats: {
      interfaces: ir.interfaces.length,
      vlans: ir.vlans.length,
      ipAddresses: ipCount,
      staticRoutes: ir.staticRoutes.length,
      bgpNeighbors: ir.bgp.neighbors.length,
      ospfEntries: ir.ospf.interfaces.length,
      prefixLists: ir.prefixLists.length,
      dnsNtpCount: ir.dnsServers.length + ir.ntpServers.length,
      outputLines: generatedConfig.split(/\r?\n/).length,
    },
  };
}

/**
 * Contoh konfigurasi Juniper realistis untuk simulasi langsung di UI Translator.
 */
export const SAMPLE_JUNIPER_CONFIG = `## Contoh Backup Konfigurasi Juniper Junos OS
system {
    host-name CORE-JNP-CYBER1;
    domain-name actis.net.id;
    time-zone Asia/Jakarta;
    name-server {
        1.1.1.1;
        8.8.8.8;
    }
    ntp {
        server 202.43.117.10;
    }
}
interfaces {
    ge-0/0/0 {
        description "UPLINK-TRANSIT-IX";
        mtu 1500;
        unit 0 {
            family inet {
                address 103.155.196.2/30;
            }
        }
    }
    xe-0/0/1 {
        description "TRUNK-ENTERPRISE-CLIENT";
        vlan-tagging;
        unit 100 {
            description "PT Nusantara Fintech VLAN 100";
            vlan-id 100;
            family inet {
                address 103.148.72.1/29;
            }
        }
        unit 200 {
            description "POP Gedung Tifa VLAN 200";
            vlan-id 200;
            family inet {
                address 10.200.1.1/24;
            }
        }
    }
    lo0 {
        unit 0 {
            family inet {
                address 103.155.196.254/32;
            }
        }
    }
}
routing-options {
    static {
        route 0.0.0.0/0 next-hop 103.155.196.1;
        route 10.10.0.0/16 next-hop 10.200.1.254;
    }
    router-id 103.155.196.254;
    autonomous-system 139999;
}
protocols {
    bgp {
        group UPSTREAM-IX {
            type external;
            local-address 103.155.196.2;
            neighbor 103.155.196.1 {
                description "TI-TRANSIT-PRIMARY";
                peer-as 7713;
            }
        }
    }
    ospf {
        area 0.0.0.0 {
            interface lo0.0 {
                passive;
            }
        }
    }
}
policy-options {
    prefix-list ACTIS-PUBLIC-PREFIX {
        103.148.72.0/24;
        103.155.196.0/24;
    }
}
vlans {
    CORP-FINTECH {
        vlan-id 100;
    }
    POP-TIFA {
        vlan-id 200;
    }
}`;

