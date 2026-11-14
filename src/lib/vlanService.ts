import { prisma } from "@/lib/prisma";
import { DEFAULT_SERVER_OPTIONS } from "@/lib/ticketUtils";
import {
  MIN_VLAN_ID,
  MAX_VLAN_ID,
  VlanServerConfig,
  UsedVlanDetail,
  UnassignedVlanCircuit,
  ServerVlanSummary,
  VlanGlobalSummary,
  VlanOverviewResponse,
  normalizeServerKey,
  classifyEligibleVlanService,
  isValidVlanId,
  findNextAvailableVlan,
  resolveEffectiveServerName,
} from "@/lib/vlanUtils";

const SETTING_KEY_SERVER_OPTIONS = "server_options";
const SETTING_KEY_VLAN_RANGES = "vlan_server_configs";

/**
 * Load configured server names from system_settings ("server_options") merged with defaults.
 */
export async function getConfiguredServerList(): Promise<string[]> {
  const ordered: string[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (name: unknown) => {
    if (typeof name !== "string") return;
    const clean = name.trim().replace(/\s+/g, " ");
    const key = normalizeServerKey(clean);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    ordered.push(clean);
  };

  for (const s of DEFAULT_SERVER_OPTIONS) {
    pushUnique(s);
  }

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_SERVER_OPTIONS },
    });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          pushUnique(item);
        }
      }
    }
  } catch (err) {
    console.error("Failed to parse server_options setting:", err);
  }

  return ordered;
}

/**
 * Retrieve custom per-server VLAN range pools from system_settings ("vlan_server_configs").
 */
export async function getConfiguredVlanRanges(): Promise<VlanServerConfig[]> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_VLAN_RANGES },
    });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (item) =>
              item &&
              typeof item.serverName === "string" &&
              item.serverName.trim().length > 0
          )
          .map((item) => {
            const start = Math.max(
              MIN_VLAN_ID,
              Math.min(MAX_VLAN_ID, parseInt(String(item.startVlan), 10) || MIN_VLAN_ID)
            );
            const end = Math.max(
              start,
              Math.min(MAX_VLAN_ID, parseInt(String(item.endVlan), 10) || MAX_VLAN_ID)
            );
            return {
              serverName: item.serverName.trim().replace(/\s+/g, " "),
              startVlan: start,
              endVlan: end,
              description:
                typeof item.description === "string" ? item.description.trim() : "",
            };
          });
      }
    }
  } catch (err) {
    console.error("Failed to parse vlan_server_configs:", err);
  }
  return [];
}

/**
 * Persist custom per-server VLAN range configs to system_settings.
 */
export async function saveVlanRanges(configs: VlanServerConfig[]): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_VLAN_RANGES },
    update: { value: JSON.stringify(configs) },
    create: { key: SETTING_KEY_VLAN_RANGES, value: JSON.stringify(configs) },
  });
}

/**
 * Core VLAN Management aggregation:
 * Reads activated PopSite circuits across POP Site, LocalLoop, Content, and Enterprise Dedicated
 * (excluding Terminated circuits), grouped by the Server chosen at activation or updated later.
 */
export async function getVlanOverviewData(): Promise<VlanOverviewResponse> {
  const [configuredServers, customRanges, activeSites] = await Promise.all([
    getConfiguredServerList(),
    getConfiguredVlanRanges(),
    prisma.popSite.findMany({
      where: {
        status_layanan: {
          notIn: ["Terminated", "TERMINATED", "terminated"],
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
        interkoneksi: true,
        ip_public: true,
        ip_private: true,
        infrastruktur: true,
        media_koneksi: true,
        status_layanan: true,
        waktu_go_live: true,
        updated_at: true,
      },
      orderBy: { vlan: "asc" },
    }),
  ]);

  // Map normalized server key -> canonical display name & config
  const serverDisplayMap = new Map<string, string>();
  const configuredKeySet = new Set<string>();
  const serverOrder: string[] = [];

  for (const name of configuredServers) {
    const key = normalizeServerKey(name);
    if (key && !serverDisplayMap.has(key)) {
      serverDisplayMap.set(key, name);
      configuredKeySet.add(key);
      serverOrder.push(key);
    }
  }

  const rangeMap = new Map<string, VlanServerConfig>();
  for (const cfg of customRanges) {
    const key = normalizeServerKey(cfg.serverName);
    if (!key) continue;
    rangeMap.set(key, cfg);
    if (!serverDisplayMap.has(key)) {
      serverDisplayMap.set(key, cfg.serverName);
      serverOrder.push(key);
    }
  }

  // Filter strictly to the 4 eligible services & separate valid VLANs from unassigned VLANs
  const rawUsedRows: Array<{
    site: (typeof activeSites)[number];
    serviceLabel: NonNullable<ReturnType<typeof classifyEligibleVlanService>>;
    serverKey: string;
    serverDisplay: string;
    vlan: number;
  }> = [];
  const unassignedCircuits: UnassignedVlanCircuit[] = [];

  for (const site of activeSites) {
    const serviceLabel = classifyEligibleVlanService(
      site.kategori_layanan,
      site.sub_layanan
    );
    if (!serviceLabel) continue; // Exclude Collocation Rack, Dark Fiber, etc.

    const effectiveServer = resolveEffectiveServerName(
      site.server,
      site.interkoneksi,
      serviceLabel
    );
    const serverKey = normalizeServerKey(effectiveServer);
    if (!serverDisplayMap.has(serverKey)) {
      serverDisplayMap.set(serverKey, effectiveServer);
      serverOrder.push(serverKey);
    }
    const serverDisplay = serverDisplayMap.get(serverKey) || effectiveServer;

    if (!isValidVlanId(site.vlan)) {
      unassignedCircuits.push({
        siteDbId: site.id,
        siteId: site.site_id,
        namaPic: site.nama_pic,
        namaPerusahaan: site.nama_perusahaan,
        serviceLabel,
        kategoriLayanan: site.kategori_layanan,
        subLayanan: site.sub_layanan,
        server: site.server || (serviceLabel === "LocalLoop" ? site.interkoneksi : null),
        statusLayanan: site.status_layanan,
        updatedAt: site.updated_at.toISOString(),
      });
      continue;
    }

    rawUsedRows.push({
      site,
      serviceLabel,
      serverKey,
      serverDisplay,
      vlan: site.vlan,
    });
  }

  // Count occurrences per (serverKey, vlan) to flag duplicate VLAN assignments
  const pairCounts = new Map<string, number>();
  for (const row of rawUsedRows) {
    const pairKey = `${row.serverKey}::${row.vlan}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
  }

  const usedVlans: UsedVlanDetail[] = rawUsedRows.map((row) => {
    const cfg = rangeMap.get(row.serverKey);
    const startVlan = cfg?.startVlan ?? MIN_VLAN_ID;
    const endVlan = cfg?.endVlan ?? MAX_VLAN_ID;
    const dupCount = pairCounts.get(`${row.serverKey}::${row.vlan}`) || 1;

    return {
      vlan: row.vlan,
      siteDbId: row.site.id,
      siteId: row.site.site_id,
      namaPic: row.site.nama_pic,
      namaPerusahaan: row.site.nama_perusahaan,
      kategoriLayanan: row.site.kategori_layanan,
      subLayanan: row.site.sub_layanan,
      serviceLabel: row.serviceLabel,
      server: row.serverDisplay,
      rawServer: row.site.server,
      ipPublic: row.site.ip_public,
      ipPrivate: row.site.ip_private,
      infrastruktur: row.site.infrastruktur,
      mediaKoneksi: row.site.media_koneksi,
      statusLayanan: row.site.status_layanan,
      isOutOfRange: row.vlan < startVlan || row.vlan > endVlan,
      isDuplicate: dupCount > 1,
      duplicateTotal: dupCount,
      waktuGoLive: row.site.waktu_go_live.toISOString(),
      updatedAt: row.site.updated_at.toISOString(),
    };
  });

  // Sort used VLANs by VLAN ascending, then Server name
  usedVlans.sort((a, b) =>
    a.vlan !== b.vlan ? a.vlan - b.vlan : a.server.localeCompare(b.server)
  );

  // Build per-server summary cards
  const rowsByServer = new Map<string, UsedVlanDetail[]>();
  for (const item of usedVlans) {
    const key = normalizeServerKey(item.server);
    const arr = rowsByServer.get(key) || [];
    arr.push(item);
    rowsByServer.set(key, arr);
  }

  const servers: ServerVlanSummary[] = [];
  let totalCapacity = 0;
  let totalUnavailable = 0;
  let totalAvailable = 0;
  let totalDuplicateVlans = 0;
  const globalServiceBreakdown = {
    popSite: 0,
    localLoop: 0,
    content: 0,
    enterpriseDedicated: 0,
  };

  for (const key of serverOrder) {
    const serverName = serverDisplayMap.get(key) || key;
    const cfg = rangeMap.get(key);
    const startVlan = cfg?.startVlan ?? MIN_VLAN_ID;
    const endVlan = cfg?.endVlan ?? MAX_VLAN_ID;
    const capacity = Math.max(0, endVlan - startVlan + 1);

    const serverRows = rowsByServer.get(key) || [];
    const uniqueUsedAll = new Set<number>();
    const uniqueInRange = new Set<number>();
    const uniqueOutOfRange = new Set<number>();
    const dupVlansOnServer = new Set<number>();
    const breakdown = {
      popSite: 0,
      localLoop: 0,
      content: 0,
      enterpriseDedicated: 0,
    };

    for (const r of serverRows) {
      uniqueUsedAll.add(r.vlan);
      if (r.vlan >= startVlan && r.vlan <= endVlan) {
        uniqueInRange.add(r.vlan);
      } else {
        uniqueOutOfRange.add(r.vlan);
      }
      if (r.isDuplicate) {
        dupVlansOnServer.add(r.vlan);
      }
      if (r.serviceLabel === "POP Site") breakdown.popSite++;
      else if (r.serviceLabel === "LocalLoop") breakdown.localLoop++;
      else if (r.serviceLabel === "Content") breakdown.content++;
      else if (r.serviceLabel === "Enterprise Dedicated") breakdown.enterpriseDedicated++;
    }

    const unavailableCount = uniqueInRange.size;
    const availableCount = Math.max(0, capacity - unavailableCount);
    const usagePct =
      capacity > 0 ? parseFloat(((unavailableCount / capacity) * 100).toFixed(2)) : 0;
    const nextAvail = findNextAvailableVlan(uniqueInRange, startVlan, endVlan);

    totalCapacity += capacity;
    totalUnavailable += unavailableCount;
    totalAvailable += availableCount;
    totalDuplicateVlans += dupVlansOnServer.size;
    globalServiceBreakdown.popSite += breakdown.popSite;
    globalServiceBreakdown.localLoop += breakdown.localLoop;
    globalServiceBreakdown.content += breakdown.content;
    globalServiceBreakdown.enterpriseDedicated += breakdown.enterpriseDedicated;

    servers.push({
      serverName,
      description: cfg?.description || (cfg ? `Range VLAN ${startVlan}-${endVlan}` : "Standard IEEE 802.1Q Pool (1 - 4094)"),
      startVlan,
      endVlan,
      totalCapacity: capacity,
      unavailableCount,
      availableCount,
      outOfRangeCount: uniqueOutOfRange.size,
      totalActiveCircuits: serverRows.length,
      usagePct,
      nextAvailableVlan: nextAvail,
      usedVlanNumbers: Array.from(uniqueUsedAll).sort((a, b) => a - b),
      duplicateVlanCount: dupVlansOnServer.size,
      serviceBreakdown: breakdown,
      isConfiguredServer: configuredKeySet.has(key),
      hasCustomRange: Boolean(cfg),
    });
  }

  const overallUsagePct =
    totalCapacity > 0
      ? parseFloat(((totalUnavailable / totalCapacity) * 100).toFixed(2))
      : 0;

  const summary: VlanGlobalSummary = {
    totalServers: servers.length,
    totalCapacity,
    totalUnavailable,
    totalAvailable,
    overallUsagePct,
    totalActiveCircuits: usedVlans.length,
    totalDuplicateVlans,
    totalUnassignedCircuits: unassignedCircuits.length,
    serviceBreakdown: globalServiceBreakdown,
  };

  return {
    summary,
    servers,
    usedVlans,
    unassignedCircuits,
  };
}

/**
 * Check availability of a specific VLAN ID on a given server.
 * Used by both New Activation form & Edit Site modals.
 */
export async function checkVlanAvailabilityOnServer(params: {
  server: string;
  vlan: number | null;
  excludeSiteId?: string;
}): Promise<{
  server: string;
  vlan: number | null;
  available: boolean;
  nextAvailableVlan: number | null;
  activatedConflicts: Array<{
    siteDbId: string;
    siteId: string;
    namaPic: string;
    namaPerusahaan: string | null;
    serviceLabel: string;
    statusLayanan: string;
  }>;
  queueConflicts: Array<{
    id: string;
    ticketNumber: string;
    namaPic: string;
    namaPerusahaan: string | null;
    status: string;
  }>;
}> {
  const targetServerKey = normalizeServerKey(params.server);
  const overview = await getVlanOverviewData();

  const matchingServerSummary = overview.servers.find(
    (s) => normalizeServerKey(s.serverName) === targetServerKey
  );

  const serverUsedSet = new Set<number>();
  const activatedConflicts: Array<{
    siteDbId: string;
    siteId: string;
    namaPic: string;
    namaPerusahaan: string | null;
    serviceLabel: string;
    statusLayanan: string;
  }> = [];

  for (const item of overview.usedVlans) {
    if (normalizeServerKey(item.server) !== targetServerKey) continue;
    if (params.excludeSiteId && item.siteDbId === params.excludeSiteId) continue;

    serverUsedSet.add(item.vlan);
    if (params.vlan !== null && item.vlan === params.vlan) {
      activatedConflicts.push({
        siteDbId: item.siteDbId,
        siteId: item.siteId,
        namaPic: item.namaPic,
        namaPerusahaan: item.namaPerusahaan,
        serviceLabel: item.serviceLabel,
        statusLayanan: item.statusLayanan,
      });
    }
  }

  // Also check pending orders in Antrian Aktivasi for early collision warning
  const queueConflicts: Array<{
    id: string;
    ticketNumber: string;
    namaPic: string;
    namaPerusahaan: string | null;
    status: string;
  }> = [];

  if (targetServerKey && isValidVlanId(params.vlan)) {
    const pendingOrders = await prisma.popSiteOrder.findMany({
      where: {
        status: { notIn: ["Completed", "Cancelled", "Terminated"] },
        vlan: params.vlan,
      },
      select: {
        id: true,
        ticket_number: true,
        nama_pic: true,
        nama_perusahaan: true,
        kategori_layanan: true,
        sub_layanan: true,
        server: true,
        interkoneksi: true,
        status: true,
        pop_site_id: true,
      },
    });

    for (const ord of pendingOrders) {
      if (params.excludeSiteId && ord.pop_site_id === params.excludeSiteId) continue;
      const serviceLabel = classifyEligibleVlanService(
        ord.kategori_layanan,
        ord.sub_layanan
      );
      if (!serviceLabel) continue;
      const ordServer = resolveEffectiveServerName(
        ord.server,
        ord.interkoneksi,
        serviceLabel
      );
      if (normalizeServerKey(ordServer) === targetServerKey) {
        queueConflicts.push({
          id: ord.id,
          ticketNumber: ord.ticket_number,
          namaPic: ord.nama_pic,
          namaPerusahaan: ord.nama_perusahaan,
          status: ord.status,
        });
      }
    }
  }

  const startVlan = matchingServerSummary?.startVlan ?? MIN_VLAN_ID;
  const endVlan = matchingServerSummary?.endVlan ?? MAX_VLAN_ID;
  const nextAvailableVlan = findNextAvailableVlan(
    serverUsedSet,
    startVlan,
    endVlan
  );

  return {
    server: params.server,
    vlan: params.vlan,
    available: isValidVlanId(params.vlan) ? activatedConflicts.length === 0 : true,
    nextAvailableVlan,
    activatedConflicts,
    queueConflicts,
  };
}
