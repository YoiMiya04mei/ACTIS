import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_PREFIXES,
  DEFAULT_PRIVATE_PREFIXES,
  parseCidr,
  isIpInSubnet,
  expandIpPublic,
  findNextAvailableIp,
  ipToLong,
  SubnetSummary,
  IpamGlobalSummary,
  UsedIpDetail,
} from "@/lib/ipamUtils";

export type IpamScope = "public" | "private";

export interface PrefixEntry {
  id?: string;
  cidr: string;
  description: string;
  is_default?: boolean;
  created_at?: string;
}

const IPAM_SCOPE_META: Record<
  IpamScope,
  {
    settingKey: string;
    defaultPrefixes: { cidr: string; description: string }[];
    label: string;
    resetDetail: string;
    resetMessage: string;
  }
> = {
  public: {
    settingKey: "ipam_public_prefixes",
    defaultPrefixes: DEFAULT_PUBLIC_PREFIXES,
    label: "Prefix IP Public",
    resetDetail: "Reset ke 5 default prefixes",
    resetMessage: "Seluruh Prefix IP Public berhasil direset ke daftar default 5 prefix utama.",
  },
  private: {
    settingKey: "ipam_private_prefixes",
    defaultPrefixes: DEFAULT_PRIVATE_PREFIXES,
    label: "Prefix IP Private",
    resetDetail: "Reset Prefix IP Private ke konfigurasi awal",
    resetMessage: "Daftar Prefix IP Private berhasil dikosongkan ke konfigurasi awal.",
  },
};

export function getIpamScopeMeta(scope: IpamScope) {
  return IPAM_SCOPE_META[scope];
}

/**
 * Retrieve active IP prefixes for the given scope from system_settings or defaults.
 */
export async function getConfiguredPrefixes(
  scope: IpamScope = "public"
): Promise<PrefixEntry[]> {
  const meta = IPAM_SCOPE_META[scope];
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: meta.settingKey },
    });

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        if (scope === "private" || parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error(`Failed to read ${meta.settingKey} setting, using defaults:`, err);
  }

  return meta.defaultPrefixes.map((p) => ({ ...p }));
}

/**
 * Persist IP prefixes list for the given scope to system_settings.
 */
export async function saveConfiguredPrefixes(
  scope: IpamScope,
  prefixes: PrefixEntry[]
): Promise<void> {
  const meta = IPAM_SCOPE_META[scope];
  const jsonStr = JSON.stringify(prefixes);
  await prisma.systemSetting.upsert({
    where: { key: meta.settingKey },
    update: { value: jsonStr },
    create: { key: meta.settingKey, value: jsonStr },
  });
}

/**
 * Reset IP prefixes for the given scope back to defaults.
 */
export async function resetPrefixesToDefault(scope: IpamScope = "public"): Promise<void> {
  const meta = IPAM_SCOPE_META[scope];
  await saveConfiguredPrefixes(
    scope,
    meta.defaultPrefixes.map((p) => ({ ...p }))
  );
}

// Backward-compatible wrappers for Public scope + named helpers for Private scope
export async function getConfiguredPublicPrefixes(): Promise<PrefixEntry[]> {
  return getConfiguredPrefixes("public");
}

export async function savePublicPrefixes(prefixes: PrefixEntry[]): Promise<void> {
  return saveConfiguredPrefixes("public", prefixes);
}

export async function resetPublicPrefixesToDefault(): Promise<void> {
  return resetPrefixesToDefault("public");
}

export async function getConfiguredPrivatePrefixes(): Promise<PrefixEntry[]> {
  return getConfiguredPrefixes("private");
}

export async function savePrivatePrefixes(prefixes: PrefixEntry[]): Promise<void> {
  return saveConfiguredPrefixes("private", prefixes);
}

export async function resetPrivatePrefixesToDefault(): Promise<void> {
  return resetPrefixesToDefault("private");
}

interface RawIpSourceRecord {
  id: string;
  refCode: string;
  rawIp: string | null;
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
  updatedAt: string;
}

async function fetchIpRecordsForScope(scope: IpamScope): Promise<RawIpSourceRecord[]> {
  const commonSelect = {
    id: true,
    nama_pic: true,
    nama_perusahaan: true,
    kategori_layanan: true,
    sub_layanan: true,
    vlan: true,
    server: true,
    infrastruktur: true,
    media_koneksi: true,
  } as const;

  if (scope === "private") {
    const [sites, pendingOrders] = await Promise.all([
      prisma.popSite.findMany({
        where: { ip_private: { not: null } },
        select: {
          ...commonSelect,
          site_id: true,
          ip_private: true,
          status_layanan: true,
          updated_at: true,
        },
      }),
      prisma.popSiteOrder.findMany({
        where: {
          status: { notIn: ["Completed", "Cancelled"] },
          ip_private: { not: null },
        },
        select: {
          ...commonSelect,
          ticket_number: true,
          ip_private: true,
          status: true,
          created_at: true,
        },
      }),
    ]);

    return [
      ...sites.map((s) => ({
        id: s.id,
        refCode: s.site_id,
        rawIp: s.ip_private,
        namaPic: s.nama_pic,
        namaPerusahaan: s.nama_perusahaan,
        kategoriLayanan: s.kategori_layanan,
        subLayanan: s.sub_layanan,
        vlan: s.vlan,
        server: s.server,
        infrastruktur: s.infrastruktur,
        mediaKoneksi: s.media_koneksi,
        statusLayanan: s.status_layanan,
        source: "POP_SITE" as const,
        updatedAt: s.updated_at.toISOString(),
      })),
      ...pendingOrders.map((o) => ({
        id: o.id,
        refCode: o.ticket_number,
        rawIp: o.ip_private,
        namaPic: o.nama_pic,
        namaPerusahaan: o.nama_perusahaan,
        kategoriLayanan: o.kategori_layanan,
        subLayanan: o.sub_layanan,
        vlan: o.vlan,
        server: o.server,
        infrastruktur: o.infrastruktur,
        mediaKoneksi: o.media_koneksi,
        statusLayanan: `Reservasi (${o.status})`,
        source: "ORDER_QUEUE" as const,
        updatedAt: o.created_at.toISOString(),
      })),
    ];
  }

  const [sites, pendingOrders] = await Promise.all([
    prisma.popSite.findMany({
      where: { ip_public: { not: null } },
      select: {
        ...commonSelect,
        site_id: true,
        ip_public: true,
        status_layanan: true,
        updated_at: true,
      },
    }),
    prisma.popSiteOrder.findMany({
      where: {
        status: { notIn: ["Completed", "Cancelled"] },
        ip_public: { not: null },
      },
      select: {
        ...commonSelect,
        ticket_number: true,
        ip_public: true,
        status: true,
        created_at: true,
      },
    }),
  ]);

  return [
    ...sites.map((s) => ({
      id: s.id,
      refCode: s.site_id,
      rawIp: s.ip_public,
      namaPic: s.nama_pic,
      namaPerusahaan: s.nama_perusahaan,
      kategoriLayanan: s.kategori_layanan,
      subLayanan: s.sub_layanan,
      vlan: s.vlan,
      server: s.server,
      infrastruktur: s.infrastruktur,
      mediaKoneksi: s.media_koneksi,
      statusLayanan: s.status_layanan,
      source: "POP_SITE" as const,
      updatedAt: s.updated_at.toISOString(),
    })),
    ...pendingOrders.map((o) => ({
      id: o.id,
      refCode: o.ticket_number,
      rawIp: o.ip_public,
      namaPic: o.nama_pic,
      namaPerusahaan: o.nama_perusahaan,
      kategoriLayanan: o.kategori_layanan,
      subLayanan: o.sub_layanan,
      vlan: o.vlan,
      server: o.server,
      infrastruktur: o.infrastruktur,
      mediaKoneksi: o.media_koneksi,
      statusLayanan: `Reservasi (${o.status})`,
      source: "ORDER_QUEUE" as const,
      updatedAt: o.created_at.toISOString(),
    })),
  ];
}

/**
 * Pure IPAM Calculation Engine shared by both Public (`ip_public`) and Private (`ip_private`) scopes.
 */
export function computeIpamOverview(
  configuredPrefixes: PrefixEntry[],
  records: RawIpSourceRecord[]
): {
  summary: IpamGlobalSummary;
  subnets: SubnetSummary[];
  unmanagedIps: UsedIpDetail[];
} {
  const allUsedIps: UsedIpDetail[] = [];
  const registeredIpMap = new Map<string, UsedIpDetail>();

  // Ensure active POP_SITE records always take priority over pending ORDER_QUEUE reservations
  const sortedRecords = [
    ...records.filter((r) => r.source === "POP_SITE"),
    ...records.filter((r) => r.source === "ORDER_QUEUE"),
  ];

  for (const rec of sortedRecords) {
    const cleanRaw = typeof rec.rawIp === "string" ? rec.rawIp.trim() : "";
    if (!cleanRaw) continue;

    const expanded = expandIpPublic(cleanRaw);
    for (const singleIp of expanded.ips) {
      if (registeredIpMap.has(singleIp)) continue;
      const item: UsedIpDetail = {
        ip: singleIp,
        rawCidr: cleanRaw,
        isSubnetBlock: expanded.isBlock,
        blockRange: expanded.blockRange,
        siteId: rec.refCode,
        siteDbId: rec.id,
        namaPic: rec.namaPic,
        namaPerusahaan: rec.namaPerusahaan,
        kategoriLayanan: rec.kategoriLayanan,
        subLayanan: rec.subLayanan,
        vlan: rec.vlan,
        server: rec.server,
        infrastruktur: rec.infrastruktur,
        mediaKoneksi: rec.mediaKoneksi,
        statusLayanan: rec.statusLayanan,
        source: rec.source,
        updatedAt: rec.updatedAt,
      };
      registeredIpMap.set(singleIp, item);
      allUsedIps.push(item);
    }
  }

  const subnets: SubnetSummary[] = [];
  const assignedIpsInPrefixes = new Set<string>();

  let totalIps = 0;
  let totalUsableHosts = 0;
  let totalUsedIps = 0;
  let totalFreeIps = 0;

  for (const pref of configuredPrefixes) {
    const parsed = parseCidr(pref.cidr);
    if (!parsed) continue;

    const firstUsableLong = ipToLong(parsed.firstUsable);
    const lastUsableLong = ipToLong(parsed.lastUsable);

    const usedInThisSubnet: UsedIpDetail[] = [];
    const usedIpSetForSubnet = new Set<string>();
    const usedUsableIpSet = new Set<string>();

    for (const usedItem of allUsedIps) {
      if (isIpInSubnet(usedItem.ip, pref.cidr)) {
        usedInThisSubnet.push(usedItem);
        usedIpSetForSubnet.add(usedItem.ip);
        assignedIpsInPrefixes.add(usedItem.ip);

        const nLong = ipToLong(usedItem.ip);
        if (nLong >= firstUsableLong && nLong <= lastUsableLong) {
          usedUsableIpSet.add(usedItem.ip);
        }
      }
    }

    usedInThisSubnet.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

    const usedCount = usedInThisSubnet.length;
    const freeCount = Math.max(0, parsed.usableHosts - usedUsableIpSet.size);
    const usagePct =
      parsed.usableHosts > 0
        ? Math.min(100, parseFloat(((usedCount / parsed.usableHosts) * 100).toFixed(2)))
        : usedCount > 0
        ? 100
        : 0;

    const nextAvail = findNextAvailableIp(parsed, usedIpSetForSubnet);

    totalIps += parsed.totalIps;
    totalUsableHosts += parsed.usableHosts;
    totalUsedIps += usedCount;
    totalFreeIps += freeCount;

    subnets.push({
      cidr: parsed.cidr,
      description: pref.description || `Prefix ${parsed.cidr}`,
      network: parsed.network,
      broadcast: parsed.broadcast,
      netmask: parsed.netmask,
      wildcard: parsed.wildcard,
      firstUsable: parsed.firstUsable,
      lastUsable: parsed.lastUsable,
      totalIps: parsed.totalIps,
      usableHosts: parsed.usableHosts,
      usedIpsCount: usedCount,
      freeIpsCount: freeCount,
      usagePct,
      nextAvailableIp: nextAvail,
      usedIps: usedInThisSubnet,
    });
  }

  const unmanagedIps = allUsedIps.filter(
    (item) => !assignedIpsInPrefixes.has(item.ip)
  );
  unmanagedIps.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

  const overallUsagePct =
    totalUsableHosts > 0
      ? Math.min(100, parseFloat(((totalUsedIps / totalUsableHosts) * 100).toFixed(2)))
      : 0;

  const summary: IpamGlobalSummary = {
    totalPrefixes: subnets.length,
    totalIps,
    totalUsableHosts,
    totalUsedIps,
    totalFreeIps,
    overallUsagePct,
  };

  return {
    summary,
    subnets,
    unmanagedIps,
  };
}

/**
 * Core IPAM Calculation Entrypoint:
 * Cross-references database IP Public or IP Private data (from PopSite assets & Order queue)
 * with configured prefixes like in phpIPAM.
 */
export async function getIpamOverviewData(
  scope: IpamScope = "public"
): Promise<{
  summary: IpamGlobalSummary;
  subnets: SubnetSummary[];
  unmanagedIps: UsedIpDetail[];
}> {
  const [configuredPrefixes, records] = await Promise.all([
    getConfiguredPrefixes(scope),
    fetchIpRecordsForScope(scope),
  ]);

  return computeIpamOverview(configuredPrefixes, records);
}
