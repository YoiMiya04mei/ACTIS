/**
 * IEEE 802.1Q VLAN Management Utilities & Shared Types
 */

export const MIN_VLAN_ID = 1;
export const MAX_VLAN_ID = 4094;
export const TOTAL_STANDARD_VLANS = MAX_VLAN_ID - MIN_VLAN_ID + 1;

export type EligibleVlanService =
  | "POP Site"
  | "LocalLoop"
  | "Content"
  | "Enterprise Dedicated";

export const ELIGIBLE_VLAN_SERVICES: EligibleVlanService[] = [
  "POP Site",
  "LocalLoop",
  "Content",
  "Enterprise Dedicated",
];

export interface VlanServerConfig {
  serverName: string;
  startVlan: number;
  endVlan: number;
  description?: string;
}

export interface UsedVlanDetail {
  vlan: number;
  siteDbId: string;
  siteId: string;
  namaPic: string;
  namaPerusahaan: string | null;
  kategoriLayanan: string;
  subLayanan: string | null;
  serviceLabel: EligibleVlanService;
  server: string;
  rawServer: string | null;
  ipPublic: string | null;
  ipPrivate: string | null;
  infrastruktur: string | null;
  mediaKoneksi: string | null;
  statusLayanan: string;
  isOutOfRange: boolean;
  isDuplicate: boolean;
  duplicateTotal: number;
  waktuGoLive: string;
  updatedAt: string;
}

export interface UnassignedVlanCircuit {
  siteDbId: string;
  siteId: string;
  namaPic: string;
  namaPerusahaan: string | null;
  serviceLabel: EligibleVlanService;
  kategoriLayanan: string;
  subLayanan: string | null;
  server: string | null;
  statusLayanan: string;
  updatedAt: string;
}

export interface ServiceVlanBreakdown {
  popSite: number;
  localLoop: number;
  content: number;
  enterpriseDedicated: number;
}

export interface ServerVlanSummary {
  serverName: string;
  description: string;
  startVlan: number;
  endVlan: number;
  totalCapacity: number;
  unavailableCount: number;
  availableCount: number;
  outOfRangeCount: number;
  totalActiveCircuits: number;
  usagePct: number;
  nextAvailableVlan: number | null;
  usedVlanNumbers: number[];
  duplicateVlanCount: number;
  serviceBreakdown: ServiceVlanBreakdown;
  isConfiguredServer: boolean;
  hasCustomRange: boolean;
}

export interface VlanGlobalSummary {
  totalServers: number;
  totalCapacity: number;
  totalUnavailable: number;
  totalAvailable: number;
  overallUsagePct: number;
  totalActiveCircuits: number;
  totalDuplicateVlans: number;
  totalUnassignedCircuits: number;
  serviceBreakdown: ServiceVlanBreakdown;
}

export interface VlanOverviewResponse {
  summary: VlanGlobalSummary;
  servers: ServerVlanSummary[];
  usedVlans: UsedVlanDetail[];
  unassignedCircuits: UnassignedVlanCircuit[];
}

/**
 * Normalize server string for reliable case-insensitive comparison.
 */
export function normalizeServerKey(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Check whether numeric VLAN ID falls within standard IEEE 802.1Q usable range (1..4094).
 */
export function isValidVlanId(vlan: number | null | undefined): vlan is number {
  return (
    typeof vlan === "number" &&
    Number.isInteger(vlan) &&
    vlan >= MIN_VLAN_ID &&
    vlan <= MAX_VLAN_ID
  );
}

/**
 * Map a PopSite/Order's kategori_layanan & sub_layanan to one of the 4 VLAN-managed services,
 * or null if excluded (e.g. Collocation Rack, Dark Fiber).
 */
export function classifyEligibleVlanService(
  kategoriLayanan: string | null | undefined,
  subLayanan: string | null | undefined
): EligibleVlanService | null {
  const kat = (kategoriLayanan || "").trim().toLowerCase();
  const sub = (subLayanan || "").trim().toLowerCase();

  if (!kat || kat === "pop site") {
    return "POP Site";
  }

  if (kat === "enterprise") {
    if (sub === "localloop" || sub === "local loop") return "LocalLoop";
    if (sub === "content") return "Content";
    if (sub === "enterprise dedicated") return "Enterprise Dedicated";
    return null;
  }

  // Legacy / non-Enterprise rows are treated as POP Site circuits
  return "POP Site";
}

/**
 * Find the smallest unused VLAN ID inside [startVlan..endVlan].
 */
export function findNextAvailableVlan(
  usedVlans: Set<number> | number[],
  startVlan = MIN_VLAN_ID,
  endVlan = MAX_VLAN_ID
): number | null {
  const usedSet = Array.isArray(usedVlans) ? new Set(usedVlans) : usedVlans;
  const min = Math.max(MIN_VLAN_ID, startVlan);
  const max = Math.min(MAX_VLAN_ID, endVlan);
  for (let v = min; v <= max; v++) {
    if (!usedSet.has(v)) {
      return v;
    }
  }
  return null;
}

/**
 * Resolve effective server name from circuit fields.
 * For LocalLoop, legacy/imported records may place server inside `interkoneksi`.
 */
export function resolveEffectiveServerName(
  server: string | null | undefined,
  interkoneksi: string | null | undefined,
  serviceLabel: EligibleVlanService
): string {
  const cleanServer = typeof server === "string" ? server.trim().replace(/\s+/g, " ") : "";
  if (cleanServer) return cleanServer;

  if (serviceLabel === "LocalLoop") {
    const cleanInter =
      typeof interkoneksi === "string" ? interkoneksi.trim().replace(/\s+/g, " ") : "";
    if (cleanInter) return cleanInter;
  }

  return "Belum Ditentukan";
}
