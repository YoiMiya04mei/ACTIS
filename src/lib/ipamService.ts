import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_PREFIXES,
  parseCidr,
  isIpInSubnet,
  expandIpPublic,
  findNextAvailableIp,
  ipToLong,
  SubnetSummary,
  IpamGlobalSummary,
  UsedIpDetail,
} from "@/lib/ipamUtils";

const SETTING_KEY_PREFIXES = "ipam_public_prefixes";

/**
 * Retrieve active public IP prefixes from system_settings or default
 */
export async function getConfiguredPublicPrefixes(): Promise<
  { cidr: string; description: string }[]
> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_PREFIXES },
    });

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to read ipam_public_prefixes setting, using defaults:", err);
  }

  return DEFAULT_PUBLIC_PREFIXES;
}

/**
 * Persist public IP prefixes list to system_settings
 */
export async function savePublicPrefixes(
  prefixes: { cidr: string; description: string }[]
): Promise<void> {
  const jsonStr = JSON.stringify(prefixes);
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_PREFIXES },
    update: { value: jsonStr },
    create: { key: SETTING_KEY_PREFIXES, value: jsonStr },
  });
}

/**
 * Reset public IP prefixes to default user prefixes
 */
export async function resetPublicPrefixesToDefault(): Promise<void> {
  await savePublicPrefixes(DEFAULT_PUBLIC_PREFIXES);
}

/**
 * Core IPAM Calculation:
 * Cross-references database IP Public data (from PopSite assets & Order queue)
 * with the configured public prefixes like in phpIPAM.
 */
export async function getIpamOverviewData(): Promise<{
  summary: IpamGlobalSummary;
  subnets: SubnetSummary[];
  unmanagedIps: UsedIpDetail[];
}> {
  const configuredPrefixes = await getConfiguredPublicPrefixes();

  // 1. Fetch active inventory PopSites with ip_public
  const sites = await prisma.popSite.findMany({
    where: {
      ip_public: {
        not: null,
      },
    },
    select: {
      id: true,
      site_id: true,
      nama_pic: true,
      nama_perusahaan: true,
      kategori_layanan: true,
      sub_layanan: true,
      vlan: true,
      server: true,
      infrastruktur: true,
      media_koneksi: true,
      ip_public: true,
      status_layanan: true,
      updated_at: true,
    },
  });

  // 2. Fetch in-progress orders in queue with ip_public (Reserved)
  const pendingOrders = await prisma.popSiteOrder.findMany({
    where: {
      status: {
        notIn: ["Completed", "Cancelled"],
      },
      ip_public: {
        not: null,
      },
    },
    select: {
      id: true,
      ticket_number: true,
      nama_pic: true,
      nama_perusahaan: true,
      kategori_layanan: true,
      sub_layanan: true,
      vlan: true,
      server: true,
      infrastruktur: true,
      media_koneksi: true,
      ip_public: true,
      status: true,
      created_at: true,
    },
  });

  // 3. Map all used IPs
  const allUsedIps: UsedIpDetail[] = [];
  const registeredIpMap = new Map<string, UsedIpDetail>();

  // Process PopSites
  for (const site of sites) {
    if (!site.ip_public) continue;
    const expanded = expandIpPublic(site.ip_public);
    for (const singleIp of expanded.ips) {
      if (registeredIpMap.has(singleIp)) continue; // avoid duplicate count
      const item: UsedIpDetail = {
        ip: singleIp,
        rawCidr: site.ip_public,
        isSubnetBlock: expanded.isBlock,
        blockRange: expanded.blockRange,
        siteId: site.site_id,
        siteDbId: site.id,
        namaPic: site.nama_pic,
        namaPerusahaan: site.nama_perusahaan,
        kategoriLayanan: site.kategori_layanan,
        subLayanan: site.sub_layanan,
        vlan: site.vlan,
        server: site.server,
        infrastruktur: site.infrastruktur,
        mediaKoneksi: site.media_koneksi,
        statusLayanan: site.status_layanan,
        source: "POP_SITE",
        updatedAt: site.updated_at.toISOString(),
      };
      registeredIpMap.set(singleIp, item);
      allUsedIps.push(item);
    }
  }

  // Process pending orders
  for (const order of pendingOrders) {
    if (!order.ip_public) continue;
    const expanded = expandIpPublic(order.ip_public);
    for (const singleIp of expanded.ips) {
      if (registeredIpMap.has(singleIp)) continue; // already assigned
      const item: UsedIpDetail = {
        ip: singleIp,
        rawCidr: order.ip_public,
        isSubnetBlock: expanded.isBlock,
        blockRange: expanded.blockRange,
        siteId: order.ticket_number,
        siteDbId: order.id,
        namaPic: order.nama_pic,
        namaPerusahaan: order.nama_perusahaan,
        kategoriLayanan: order.kategori_layanan,
        subLayanan: order.sub_layanan,
        vlan: order.vlan,
        server: order.server,
        infrastruktur: order.infrastruktur,
        mediaKoneksi: order.media_koneksi,
        statusLayanan: `Reservasi (${order.status})`,
        source: "ORDER_QUEUE",
        updatedAt: order.created_at.toISOString(),
      };
      registeredIpMap.set(singleIp, item);
      allUsedIps.push(item);
    }
  }

  // 4. Calculate stats for each configured subnet
  const subnets: SubnetSummary[] = [];
  const assignedIpsInPrefixes = new Set<string>();

  let totalIps = 0;
  let totalUsableHosts = 0;
  let totalUsedIps = 0;

  for (const pref of configuredPrefixes) {
    const parsed = parseCidr(pref.cidr);
    if (!parsed) continue;

    const usedInThisSubnet: UsedIpDetail[] = [];
    const usedIpSetForSubnet = new Set<string>();

    for (const usedItem of allUsedIps) {
      if (isIpInSubnet(usedItem.ip, pref.cidr)) {
        usedInThisSubnet.push(usedItem);
        usedIpSetForSubnet.add(usedItem.ip);
        assignedIpsInPrefixes.add(usedItem.ip);
      }
    }

    // Sort used IPs ascending
    usedInThisSubnet.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

    const usedCount = usedInThisSubnet.length;
    const freeCount = Math.max(0, parsed.usableHosts - usedCount);
    const usagePct =
      parsed.usableHosts > 0
        ? parseFloat(((usedCount / parsed.usableHosts) * 100).toFixed(2))
        : 0;

    const nextAvail = findNextAvailableIp(parsed, usedIpSetForSubnet);

    totalIps += parsed.totalIps;
    totalUsableHosts += parsed.usableHosts;
    totalUsedIps += usedCount;

    subnets.push({
      cidr: pref.cidr,
      description: pref.description || `Prefix ${pref.cidr}`,
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

  // 5. Unmanaged IPs (assigned IPs that fall outside the configured prefixes)
  const unmanagedIps = allUsedIps.filter(
    (item) => !assignedIpsInPrefixes.has(item.ip)
  );
  unmanagedIps.sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

  const totalFreeIps = Math.max(0, totalUsableHosts - totalUsedIps);
  const overallUsagePct =
    totalUsableHosts > 0
      ? parseFloat(((totalUsedIps / totalUsableHosts) * 100).toFixed(2))
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

