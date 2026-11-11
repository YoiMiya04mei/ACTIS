export interface TiaFiberColor {
  index: number; // 1..12
  name: string;
  labelId: string;
  hex: string;
  textHex: string;
  ringClass: string;
}

/**
 * Standar kode warna kabel & core serat optik TIA-598-C (12 Core per Tube/Tray)
 */
export const TIA_598_COLORS: TiaFiberColor[] = [
  { index: 1, name: "Blue", labelId: "Biru", hex: "#2563eb", textHex: "#ffffff", ringClass: "ring-blue-500" },
  { index: 2, name: "Orange", labelId: "Oranye", hex: "#f97316", textHex: "#ffffff", ringClass: "ring-orange-500" },
  { index: 3, name: "Green", labelId: "Hijau", hex: "#16a34a", textHex: "#ffffff", ringClass: "ring-green-500" },
  { index: 4, name: "Brown", labelId: "Cokelat", hex: "#78350f", textHex: "#ffffff", ringClass: "ring-amber-900" },
  { index: 5, name: "Slate", labelId: "Abu-abu", hex: "#64748b", textHex: "#ffffff", ringClass: "ring-slate-500" },
  { index: 6, name: "White", labelId: "Putih", hex: "#f8fafc", textHex: "#0f172a", ringClass: "ring-slate-300" },
  { index: 7, name: "Red", labelId: "Merah", hex: "#dc2626", textHex: "#ffffff", ringClass: "ring-red-500" },
  { index: 8, name: "Black", labelId: "Hitam", hex: "#1e293b", textHex: "#ffffff", ringClass: "ring-slate-800" },
  { index: 9, name: "Yellow", labelId: "Kuning", hex: "#eab308", textHex: "#0f172a", ringClass: "ring-yellow-400" },
  { index: 10, name: "Violet", labelId: "Ungu", hex: "#9333ea", textHex: "#ffffff", ringClass: "ring-purple-500" },
  { index: 11, name: "Rose", labelId: "Pink", hex: "#ec4899", textHex: "#ffffff", ringClass: "ring-pink-500" },
  { index: 12, name: "Aqua", labelId: "Aqua / Tosca", hex: "#06b6d4", textHex: "#0f172a", ringClass: "ring-cyan-400" },
];

export function getTiaColorForCore(coreNumber: number, coresPerTray: number = 12): TiaFiberColor {
  const safePerTray = Math.max(1, Math.min(12, coresPerTray));
  const posInTray = ((Math.max(1, coreNumber) - 1) % safePerTray);
  return TIA_598_COLORS[posInTray % TIA_598_COLORS.length];
}

export function getTiaTubeColorForTray(trayNumber: number): TiaFiberColor {
  const idx = ((Math.max(1, trayNumber) - 1) % TIA_598_COLORS.length);
  return TIA_598_COLORS[idx];
}

export function getTiaColorByName(name?: string | null): TiaFiberColor {
  if (!name) return TIA_598_COLORS[0];
  const found = TIA_598_COLORS.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() || c.labelId.toLowerCase() === name.toLowerCase()
  );
  return found || TIA_598_COLORS[0];
}

export interface RackSlotItem {
  id: string;
  rack_id: string;
  start_u: number;
  unit_size: number;
  end_u: number;
  device_name: string;
  serial_number?: string | null;
  customer_name?: string | null;
  pic_name?: string | null;
  device_type: string;
  power_draw_watt?: number | null;
  color_tag: string;
  status: "Occupied" | "Reserved" | "Maintenance" | string;
  order_id?: string | null;
  pop_site_id?: string | null;
  ticket_number?: string | null;
  site_code?: string | null;
  notes?: string | null;
}

export interface RackSummaryStats {
  total_u: number;
  occupied_u: number;
  reserved_u: number;
  maintenance_u: number;
  free_u: number;
  utilization_pct: number;
  total_power_watt: number;
}

export interface DataCenterRackItem {
  id: string;
  code: string;
  name: string;
  location: string;
  room_zone?: string | null;
  total_u: number;
  power_capacity_va?: number | null;
  status: string;
  notes?: string | null;
  slots: RackSlotItem[];
  stats: RackSummaryStats;
}

export interface OtbCoreItem {
  id: string;
  otb_id: string;
  core_number: number;
  tray_number: number;
  tube_color: string;
  core_color: string;
  status: "Available" | "Reserved" | "Used" | "Damaged" | "Maintenance" | string;
  route_pair?: string | null;
  destination_otb?: string | null;
  customer_name?: string | null;
  attenuation_db?: number | null;
  distance_km?: number | null;
  order_id?: string | null;
  pop_site_id?: string | null;
  ticket_number?: string | null;
  site_code?: string | null;
  notes?: string | null;
}

export interface OtbSummaryStats {
  total_cores: number;
  available_cores: number;
  used_cores: number;
  reserved_cores: number;
  damaged_cores: number;
  utilization_pct: number;
}

export interface OpticalOtbItem {
  id: string;
  code: string;
  name: string;
  location: string;
  pop_node?: string | null;
  total_cores: number;
  cores_per_tray: number;
  connector_type: string;
  fiber_mode: string;
  status: string;
  notes?: string | null;
  ports: OtbCoreItem[];
  stats: OtbSummaryStats;
}

/**
 * Mengonversi tipe layanan Collocation (e.g. "Full Rack 42U", "2U Rackmount Server") ke jumlah U.
 */
export function parseColloUnitsNeeded(tipeLayananCollo?: string | null): number {
  if (!tipeLayananCollo) return 1;
  const lower = tipeLayananCollo.toLowerCase();
  if (lower.includes("full rack")) {
    const m = lower.match(/(\d+)\s*u\b/);
    return m ? parseInt(m[1], 10) : 42;
  }
  if (lower.includes("half rack")) {
    const m = lower.match(/(\d+)\s*u\b/);
    return m ? parseInt(m[1], 10) : 21;
  }
  if (lower.includes("quarter rack")) {
    const m = lower.match(/(\d+)\s*u\b/);
    return m ? parseInt(m[1], 10) : 10;
  }
  const match = lower.match(/(\d+)\s*u\b/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    return Math.max(1, Math.min(52, parsed));
  }
  return 1;
}

/**
 * Mengonversi deskripsi Dark Fiber (e.g. "2 Core (1 Pair) Single-Mode G.652D") menjadi kebutuhan jumlah core.
 */
export function parseDarkFiberCoresNeeded(layananDarkFiber?: string | null): number {
  if (!layananDarkFiber) return 2;
  const match = layananDarkFiber.match(/(\d+)\s*core\b/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num >= 1) return Math.min(48, num);
  }
  const pairMatch = layananDarkFiber.match(/(\d+)\s*pair\b/i);
  if (pairMatch) {
    const pairs = parseInt(pairMatch[1], 10);
    if (!isNaN(pairs) && pairs >= 1) return Math.min(48, pairs * 2);
  }
  return 2;
}

export function computeRackStats(totalU: number, slots: RackSlotItem[]): RackSummaryStats {
  let occupiedU = 0;
  let reservedU = 0;
  let maintenanceU = 0;
  let totalPower = 0;

  for (const s of slots) {
    const span = Math.max(1, s.end_u - s.start_u + 1);
    totalPower += s.power_draw_watt || 0;
    if (s.status === "Reserved") {
      reservedU += span;
    } else if (s.status === "Maintenance") {
      maintenanceU += span;
    } else {
      occupiedU += span;
    }
  }

  const usedCombined = occupiedU + reservedU + maintenanceU;
  const freeU = Math.max(0, totalU - usedCombined);
  const utilizationPct = totalU > 0 ? Math.min(100, Math.round((usedCombined / totalU) * 100)) : 0;

  return {
    total_u: totalU,
    occupied_u: occupiedU,
    reserved_u: reservedU,
    maintenance_u: maintenanceU,
    free_u: freeU,
    utilization_pct: utilizationPct,
    total_power_watt: totalPower,
  };
}

export function computeOtbStats(totalCores: number, ports: OtbCoreItem[]): OtbSummaryStats {
  let available = 0;
  let used = 0;
  let reserved = 0;
  let damaged = 0;

  for (const p of ports) {
    if (p.status === "Used") used++;
    else if (p.status === "Reserved") reserved++;
    else if (p.status === "Damaged" || p.status === "Maintenance") damaged++;
    else available++;
  }

  const activeUsed = used + reserved + damaged;
  const utilizationPct = totalCores > 0 ? Math.min(100, Math.round((activeUsed / totalCores) * 100)) : 0;

  return {
    total_cores: totalCores,
    available_cores: available,
    used_cores: used,
    reserved_cores: reserved,
    damaged_cores: damaged,
    utilization_pct: utilizationPct,
  };
}

/**
 * Mengecek apakah rentang [startU, endU] bebas dari bentrok di dalam Rack.
 */
export function isRackRangeFree(
  rackTotalU: number,
  slots: Pick<RackSlotItem, "id" | "start_u" | "end_u">[],
  startU: number,
  unitSize: number,
  excludeSlotId?: string
): { valid: boolean; reason?: string; endU: number } {
  const endU = startU + unitSize - 1;
  if (startU < 1 || unitSize < 1 || endU > rackTotalU) {
    return {
      valid: false,
      endU,
      reason: `Posisi U${startU}–U${endU} di luar kapasitas rack (1U–${rackTotalU}U).`,
    };
  }
  const conflict = slots.find(
    (s) => s.id !== excludeSlotId && !(endU < s.start_u || startU > s.end_u)
  );
  if (conflict) {
    return {
      valid: false,
      endU,
      reason: `Slot U${startU}–U${endU} bentrok dengan unit yang sudah terisi (U${conflict.start_u}–U${conflict.end_u}).`,
    };
  }
  return { valid: true, endU };
}

/**
 * Mencari semua posisi start_u yang valid untuk ukuran unitSize tertentu.
 */
export function findAvailableStartUs(
  rackTotalU: number,
  slots: Pick<RackSlotItem, "id" | "start_u" | "end_u">[],
  unitSize: number
): number[] {
  const results: number[] = [];
  for (let u = 1; u <= rackTotalU - unitSize + 1; u++) {
    if (isRackRangeFree(rackTotalU, slots, u, unitSize).valid) {
      results.push(u);
    }
  }
  return results;
}

export function formatRackPositionLabel(
  rackCode?: string | null,
  startU?: number | null,
  endU?: number | null
): string {
  if (!rackCode || !startU) return "-";
  const end = endU && endU >= startU ? endU : startU;
  const size = end - startU + 1;
  const uStr = end === startU ? `U${startU}` : `U${startU}–U${end}`;
  return `${rackCode} · ${uStr} (${size}U)`;
}

export function parseCoreNumbersJson(val?: string | number[] | null): number[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0);
  }
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) {
      return parsed.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0);
    }
  } catch {
    // Fallback comma-separated
    return String(val)
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
}

export function formatOtbCoreLabel(otbCode?: string | null, cores?: number[] | string | null): string {
  const coreNums = parseCoreNumbersJson(cores);
  if (!otbCode || coreNums.length === 0) return otbCode || "-";
  const listStr = coreNums.map((c) => `#${c}`).join(", ");
  return `${otbCode} · Core ${listStr}`;
}

export const RACK_DEVICE_COLORS: Array<{ label: string; value: string }> = [
  { label: "Biru (Server)", value: "#3b82f6" },
  { label: "Cyan (Core Switch)", value: "#06b6d4" },
  { label: "Ungu (Router / BGP)", value: "#8b5cf6" },
  { label: "Emerald (Storage / NAS)", value: "#10b981" },
  { label: "Merah (Firewall / Security)", value: "#ef4444" },
  { label: "Amber (PDU / Power)", value: "#f59e0b" },
  { label: "Slate (Patch Panel / OTB)", value: "#64748b" },
];

