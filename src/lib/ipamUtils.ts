/**
 * IPv4 and CIDR Utilities for phpIPAM-style Public Prefix Management
 */

export const DEFAULT_PUBLIC_PREFIXES: { cidr: string; description: string }[] = [
  { cidr: "103.155.196.0/23", description: "Blok IP Public 1" },
  { cidr: "103.97.140.0/23", description: "Blok IP Public 2" },
  { cidr: "202.57.19.0/24", description: "Blok IP Public 3" },
  { cidr: "202.57.20.0/23", description: "Blok IP Public 4" },
  { cidr: "103.54.171.0/24", description: "Blok IP Public 5" },
];

export interface ParsedSubnet {
  cidr: string;
  ip: string;
  prefixLen: number;
  networkLong: number;
  broadcastLong: number;
  network: string;
  broadcast: string;
  netmask: string;
  wildcard: string;
  firstUsable: string;
  lastUsable: string;
  totalIps: number;
  usableHosts: number;
}

export interface UsedIpDetail {
  ip: string;
  rawCidr?: string;
  isSubnetBlock?: boolean;
  blockRange?: string;
  siteId: string;
  siteDbId: string;
  namaPic: string;
  namaPerusahaan: string | null;
  kategoriLayanan: string;
  subLayanan: string | null;
  vlan: number | null;
  server: string | null;
  infrastruktur: string | null;
  mediaKoneksi: string | null;
  statusLayanan: string;
  source: "POP_SITE" | "ORDER_QUEUE";
  updatedAt?: string;
}

export interface SubnetSummary {
  cidr: string;
  description: string;
  network: string;
  broadcast: string;
  netmask: string;
  wildcard: string;
  firstUsable: string;
  lastUsable: string;
  totalIps: number;
  usableHosts: number;
  usedIpsCount: number;
  freeIpsCount: number;
  usagePct: number;
  nextAvailableIp: string | null;
  usedIps: UsedIpDetail[];
}

export interface IpamGlobalSummary {
  totalPrefixes: number;
  totalIps: number;
  totalUsableHosts: number;
  totalUsedIps: number;
  totalFreeIps: number;
  overallUsagePct: number;
}

/**
 * Convert IPv4 dotted string to unsigned 32-bit integer
 */
export function ipToLong(ip: string): number {
  if (!ip || typeof ip !== "string") return 0;
  const parts = ip.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert unsigned 32-bit integer to IPv4 dotted string
 */
export function longToIp(long: number): string {
  const safe = long >>> 0;
  return [
    (safe >>> 24) & 255,
    (safe >>> 16) & 255,
    (safe >>> 8) & 255,
    safe & 255,
  ].join(".");
}

/**
 * Validate IPv4 format
 */
export function isValidIpv4(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false;
    const num = parseInt(p, 10);
    return num >= 0 && num <= 255 && (p === "0" || !p.startsWith("0"));
  });
}

/**
 * Parse CIDR prefix (e.g. "103.155.196.0/23") into full network specs
 */
export function parseCidr(cidrStr: string): ParsedSubnet | null {
  if (!cidrStr || typeof cidrStr !== "string") return null;
  const [ipPart, prefixPart] = cidrStr.trim().split("/");
  if (!isValidIpv4(ipPart)) return null;

  const prefixLen = prefixPart !== undefined ? parseInt(prefixPart, 10) : 32;
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  const ipLong = ipToLong(ipPart);
  const netmaskLong = prefixLen === 0 ? 0 : ((0xffffffff << (32 - prefixLen)) >>> 0);
  const wildcardLong = ~netmaskLong >>> 0;
  const networkLong = (ipLong & netmaskLong) >>> 0;
  const broadcastLong = (networkLong | wildcardLong) >>> 0;

  const totalIps = prefixLen === 32 ? 1 : Math.pow(2, 32 - prefixLen);
  let usableHosts = totalIps;
  let firstUsableLong = networkLong;
  let lastUsableLong = broadcastLong;

  if (prefixLen <= 30) {
    usableHosts = Math.max(0, totalIps - 2);
    firstUsableLong = networkLong + 1;
    lastUsableLong = broadcastLong - 1;
  } else if (prefixLen === 31) {
    usableHosts = 2; // RFC 3021
    firstUsableLong = networkLong;
    lastUsableLong = broadcastLong;
  }

  return {
    cidr: `${longToIp(networkLong)}/${prefixLen}`,
    ip: ipPart,
    prefixLen,
    networkLong,
    broadcastLong,
    network: longToIp(networkLong),
    broadcast: longToIp(broadcastLong),
    netmask: longToIp(netmaskLong),
    wildcard: longToIp(wildcardLong),
    firstUsable: longToIp(firstUsableLong),
    lastUsable: longToIp(lastUsableLong),
    totalIps,
    usableHosts,
  };
}

/**
 * Check if a given host IP falls within a subnet CIDR
 */
export function isIpInSubnet(ip: string, subnetCidr: string): boolean {
  const ipLong = ipToLong(ip);
  if (ipLong === 0) return false;
  const parsed = parseCidr(subnetCidr);
  if (!parsed) return false;
  return ipLong >= parsed.networkLong && ipLong <= parsed.broadcastLong;
}

/**
 * Extract and expand IP Public string from database record.
 * Handles single IP ("103.97.140.32"), /32 ("103.97.140.32/32"), or subnets (/30, /29, /28)
 */
export function expandIpPublic(rawIp: string | null | undefined): {
  ips: string[];
  baseIp: string;
  prefixLen: number;
  isBlock: boolean;
  blockRange?: string;
} {
  if (!rawIp || typeof rawIp !== "string") {
    return { ips: [], baseIp: "", prefixLen: 32, isBlock: false };
  }

  const cleaned = rawIp.trim();
  const [ipPart, prefixPart] = cleaned.split("/");
  if (!isValidIpv4(ipPart)) {
    return { ips: [], baseIp: "", prefixLen: 32, isBlock: false };
  }

  const prefixLen = prefixPart !== undefined ? parseInt(prefixPart, 10) : 32;
  if (isNaN(prefixLen) || prefixLen >= 32 || prefixLen < 24) {
    // Single IP or invalid prefix
    return {
      ips: [ipPart],
      baseIp: ipPart,
      prefixLen: 32,
      isBlock: false,
    };
  }

  // It's a subnet block (/24 to /31)
  const parsed = parseCidr(cleaned);
  if (!parsed) {
    return {
      ips: [ipPart],
      baseIp: ipPart,
      prefixLen: 32,
      isBlock: false,
    };
  }

  const count = parsed.totalIps;
  const ips: string[] = [];
  for (let i = 0; i < count; i++) {
    ips.push(longToIp(parsed.networkLong + i));
  }

  return {
    ips,
    baseIp: ipPart,
    prefixLen,
    isBlock: true,
    blockRange: `${parsed.network} - ${parsed.broadcast} (/${prefixLen})`,
  };
}

/**
 * Find next available free IP in a subnet given the set of already assigned IPs
 */
export function findNextAvailableIp(
  parsedSubnet: ParsedSubnet,
  usedIpsSet: Set<string>
): string | null {
  const startLong = ipToLong(parsedSubnet.firstUsable);
  const endLong = ipToLong(parsedSubnet.lastUsable);

  for (let curr = startLong; curr <= endLong; curr++) {
    const ipStr = longToIp(curr);
    if (!usedIpsSet.has(ipStr)) {
      return ipStr;
    }
  }

  return null;
}

export type IpSubnetSegment =
  | {
      type: "IDLE";
      key: string;
      startIp: string;
      endIp: string;
      startLong: number;
      endLong: number;
      count: number;
    }
  | {
      type: "USED";
      key: string;
      ipLong: number;
      detail: UsedIpDetail;
    };

/**
 * Build an ascending phpIPAM-style list of interleaved contiguous IDLE IP ranges
 * and individual USED IP rows for a subnet prefix.
 */
export function buildIpSubnetSegments(subnet: SubnetSummary): IpSubnetSegment[] {
  const segments: IpSubnetSegment[] = [];
  const parsed = parseCidr(subnet.cidr);

  const usableStartLong = parsed
    ? ipToLong(parsed.firstUsable)
    : ipToLong(subnet.firstUsable);
  const usableEndLong = parsed
    ? ipToLong(parsed.lastUsable)
    : ipToLong(subnet.lastUsable);

  const byIpLong = new Map<number, UsedIpDetail[]>();
  for (const item of subnet.usedIps || []) {
    const n = ipToLong(item.ip);
    if (n === 0) continue;
    const list = byIpLong.get(n);
    if (list) {
      list.push(item);
    } else {
      byIpLong.set(n, [item]);
    }
  }

  const sortedUsedLongs = Array.from(byIpLong.keys()).sort((a, b) => a - b);

  let cursor = usableStartLong;
  let closedTrailingIdle = false;

  const flushTrailingIdle = () => {
    if (!closedTrailingIdle && usableStartLong <= usableEndLong && cursor <= usableEndLong) {
      segments.push({
        type: "IDLE",
        key: `idle-${cursor}-${usableEndLong}`,
        startIp: longToIp(cursor),
        endIp: longToIp(usableEndLong),
        startLong: cursor,
        endLong: usableEndLong,
        count: usableEndLong - cursor + 1,
      });
    }
    closedTrailingIdle = true;
  };

  for (const occLong of sortedUsedLongs) {
    const details = byIpLong.get(occLong) || [];

    if (occLong < usableStartLong) {
      details.forEach((detail, idx) => {
        segments.push({
          type: "USED",
          key: `used-${occLong}-${detail.siteDbId}-${detail.source}-${idx}`,
          ipLong: occLong,
          detail,
        });
      });
      continue;
    }

    if (occLong <= usableEndLong) {
      if (occLong > cursor && cursor <= usableEndLong) {
        const idleEnd = occLong - 1;
        segments.push({
          type: "IDLE",
          key: `idle-${cursor}-${idleEnd}`,
          startIp: longToIp(cursor),
          endIp: longToIp(idleEnd),
          startLong: cursor,
          endLong: idleEnd,
          count: idleEnd - cursor + 1,
        });
      }

      details.forEach((detail, idx) => {
        segments.push({
          type: "USED",
          key: `used-${occLong}-${detail.siteDbId}-${detail.source}-${idx}`,
          ipLong: occLong,
          detail,
        });
      });

      cursor = Math.max(cursor, occLong + 1);
      continue;
    }

    // Out-of-usable-bounds (e.g. broadcast IP)
    flushTrailingIdle();
    details.forEach((detail, idx) => {
      segments.push({
        type: "USED",
        key: `used-${occLong}-${detail.siteDbId}-${detail.source}-${idx}`,
        ipLong: occLong,
        detail,
      });
    });
  }

  flushTrailingIdle();

  return segments;
}

/**
 * Match a search query against an IP segment (including exact IP fallback inside IDLE ranges).
 */
export function matchesIpSegmentSearch(segment: IpSubnetSegment, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  if (segment.type === "USED") {
    const item = segment.detail;
    return (
      item.ip.toLowerCase().includes(q) ||
      (item.rawCidr || "").toLowerCase().includes(q) ||
      item.siteId.toLowerCase().includes(q) ||
      item.namaPic.toLowerCase().includes(q) ||
      (item.namaPerusahaan || "").toLowerCase().includes(q) ||
      (item.server || "").toLowerCase().includes(q) ||
      (item.infrastruktur || "").toLowerCase().includes(q) ||
      (item.vlan ? String(item.vlan).includes(q) : false)
    );
  }

  if (
    segment.startIp.toLowerCase().includes(q) ||
    segment.endIp.toLowerCase().includes(q) ||
    `${segment.startIp} - ${segment.endIp}`.toLowerCase().includes(q) ||
    "idle".includes(q) ||
    "tersedia".includes(q) ||
    "free".includes(q)
  ) {
    return true;
  }

  if (isValidIpv4(q)) {
    const targetLong = ipToLong(q);
    return targetLong >= segment.startLong && targetLong <= segment.endLong;
  }

  return false;
}

