import type {
  BandwidthUnit,
  GbpsConversionMode,
  TrafficQoSResult,
  TrafficQoSOptions,
} from '../types/trafficQos';

/**
 * Konversi kecepatan ke satuan Kbps (Kilobits per second).
 * Contoh:
 * - 100 MBPS = 100 * 1024 = 102400 Kbps
 * - 1 GBPS = 1 * 1024 * 1024 = 1048576 Kbps
 * - 1,2 GBPS (Direct Binary) = 1.2 * 1024 * 1024 = 1258291 Kbps
 * - 1,2 GBPS (Decimal 1G 200M) = 1200 MBPS * 1024 = 1228800 Kbps
 * - 512 KBPS = 512 Kbps
 */
export function convertSpeedToKbps(
  speed: number,
  unit: BandwidthUnit,
  gbpsMode: GbpsConversionMode = 'direct'
): number {
  if (isNaN(speed) || speed <= 0) return 0;

  switch (unit) {
    case 'TBPS':
      return Math.round(speed * 1024 * 1024 * 1024);
    case 'GBPS':
      if (gbpsMode === 'decimal') {
        // Mode Desimal (1G = 1000M): 1.2 GBPS dihitung 1200 MBPS (1G 200MBPS)
        const speedInMbps = speed * 1000;
        return Math.round(speedInMbps * 1024);
      }
      // Mode Direct Binary: 1.2 * 1024 * 1024
      return Math.round(speed * 1024 * 1024);
    case 'MBPS':
      return Math.round(speed * 1024);
    case 'KBPS':
    default:
      return Math.round(speed);
  }
}

/**
 * Hitung CBS (Committed Burst Size) = CIR * 8
 */
export function calculateCBS(cir: number): number {
  return cir * 8;
}

/**
 * Hitung PBS (Peak Burst Size) = PIR * 8
 */
export function calculatePBS(pir: number): number {
  return pir * 8;
}

/**
 * Format nama default classifier/behavior (misal: "100MBPS", "1.2GBPS", "512KBPS")
 */
export function formatSpeedName(speed: number, unit: BandwidthUnit, rawInput?: string): string {
  if (rawInput && rawInput.trim()) {
    const clean = rawInput.trim().replace(/[^0-9.,]/g, '').replace(',', '.');
    if (clean) {
      return `${clean}${unit.toUpperCase()}`;
    }
  }
  const cleanSpeed = Number.isInteger(speed) ? speed.toString() : speed.toString();
  return `${cleanSpeed}${unit.toUpperCase()}`;
}

/**
 * Berikan daftar saran nama classifier & behavior untuk kemudahan pengguna
 */
export function getSuggestedNames(speed: number, unit: BandwidthUnit): string[] {
  const names: string[] = [];
  if (Number.isInteger(speed)) {
    names.push(`${speed}${unit.toUpperCase()}`);
    return names;
  }

  // Format titik standar CLI: "1.2GBPS"
  names.push(`${speed}${unit.toUpperCase()}`);
  // Format underscore: "1_2GBPS"
  names.push(`${speed.toString().replace('.', '_')}${unit.toUpperCase()}`);

  if (unit === 'GBPS') {
    // 1.2 GBPS -> 1G200MBPS atau 1200MBPS
    const gPart = Math.floor(speed);
    const mPart = Math.round((speed - gPart) * 1000);
    if (gPart > 0 && mPart > 0) {
      names.push(`${gPart}G${mPart}MBPS`);
      names.push(`${Math.round(speed * 1000)}MBPS`);
    }
  }

  return Array.from(new Set(names));
}

/**
 * Generate konfigurasi Traffic Classifier (Huawei VRP syntax)
 */
export function generateTrafficClassifierConfig(
  name: string,
  matchCondition: string = 'if-match any',
  operator: 'or' | 'and' = 'or'
): string {
  const trimmedName = name.trim();
  const trimmedMatch = matchCondition.trim();
  return `traffic classifier ${trimmedName} operator ${operator}\n ${trimmedMatch}\n#`;
}

/**
 * Generate konfigurasi Traffic Behavior (Huawei VRP syntax)
 */
export function generateTrafficBehaviorConfig(
  name: string,
  cir: number,
  pir: number,
  cbs: number,
  pbs: number,
  action: string = 'green pass yellow pass red discard'
): string {
  const trimmedName = name.trim();
  const trimmedAction = action.trim();
  return `traffic behavior ${trimmedName}\n car cir ${cir} pir ${pir} cbs ${cbs} pbs ${pbs} ${trimmedAction}\n#`;
}

/**
 * Generate konfigurasi Traffic Policy (Opsional)
 */
export function generateTrafficPolicyConfig(
  policyName: string,
  classifierName: string,
  behaviorName: string
): string {
  return `traffic policy ${policyName.trim()}\n classifier ${classifierName.trim()} behavior ${behaviorName.trim()}\n#`;
}

/**
 * Generate skrip Rollback / Undo
 */
export function generateUndoConfig(name: string, includePolicy: boolean = false): string {
  const trimmedName = name.trim();
  const lines: string[] = [];
  if (includePolicy) {
    lines.push(`undo traffic policy ${trimmedName}`);
  }
  lines.push(`undo traffic behavior ${trimmedName}`);
  lines.push(`undo traffic classifier ${trimmedName}`);
  lines.push('#');
  return lines.join('\n');
}

/**
 * Generate konfigurasi lengkap QoS (Classifier + Behavior)
 */
export function generateTrafficQoS(
  speed: number,
  unit: BandwidthUnit,
  options?: TrafficQoSOptions
): TrafficQoSResult {
  const gbpsMode = options?.gbpsConversionMode || 'direct';
  const cir = convertSpeedToKbps(speed, unit, gbpsMode);
  const pir = cir; // Default PIR = CIR sesuai contoh
  const cbs = calculateCBS(cir);
  const pbs = calculatePBS(pir);

  const defaultName = formatSpeedName(speed, unit, options?.rawInput);
  const name = options?.customName?.trim() || defaultName;
  const operator = options?.operator || 'or';
  const matchCondition = options?.matchCondition || 'if-match any';
  const action = options?.action || 'green pass yellow pass red discard';

  const classifierConfig = generateTrafficClassifierConfig(name, matchCondition, operator);
  const behaviorConfig = generateTrafficBehaviorConfig(name, cir, pir, cbs, pbs, action);

  let trafficPolicyConfig: string | undefined;
  if (options?.includeTrafficPolicy) {
    trafficPolicyConfig = generateTrafficPolicyConfig(name, name, name);
  }

  let interfaceExampleConfig: string | undefined;
  if (options?.includeInterfaceExample) {
    const iface = options.interfaceName?.trim() || 'GigabitEthernet0/0/1';
    interfaceExampleConfig = `interface ${iface}\n traffic-policy ${name} inbound\n traffic-policy ${name} outbound\n#`;
  }

  // Gabungkan konfigurasi utama persis sesuai spesifikasi user
  const fullParts = [classifierConfig, '', behaviorConfig];
  if (trafficPolicyConfig) {
    fullParts.push('', trafficPolicyConfig);
  }
  if (interfaceExampleConfig) {
    fullParts.push('', interfaceExampleConfig);
  }
  const fullConfig = fullParts.join('\n') + '\n';

  const undoConfig = generateUndoConfig(name, !!options?.includeTrafficPolicy);
  const suggestedNames = getSuggestedNames(speed, unit);

  let equivalentMbps: number | undefined;
  if (unit === 'GBPS') {
    equivalentMbps = Math.round(speed * 1000);
  } else if (unit === 'MBPS') {
    equivalentMbps = speed;
  }

  return {
    id: `${name}-${Date.now()}`,
    speed,
    unit,
    name,
    cir,
    pir,
    cbs,
    pbs,
    operator,
    matchCondition,
    action,
    trafficClassifierConfig: classifierConfig,
    trafficBehaviorConfig: behaviorConfig,
    trafficPolicyConfig,
    interfaceExampleConfig,
    fullConfig,
    undoConfig,
    suggestedNames,
    equivalentMbps,
  };
}

/**
 * Parser string cerdas: menerima masukan seperti "100MBPS", "1,2GBPS", "1.2 Gbps", "1G 200M", "512 kbps", "2.5G", "100M"
 */
export function parseBandwidthString(input: string): { speed: number; unit: BandwidthUnit } | null {
  if (!input) return null;
  const clean = input.trim();

  // Pola kombinasi seperti 1G 200M atau 1G200MBPS
  const comboMatch = clean.match(/^([0-9]+)\s*G(?:BPS)?\s*([0-9]+)\s*M(?:BPS)?$/i);
  if (comboMatch) {
    const gVal = parseFloat(comboMatch[1]);
    const mVal = parseFloat(comboMatch[2]);
    const decimalSpeed = gVal + mVal / 1000;
    return { speed: decimalSpeed, unit: 'GBPS' };
  }

  // Regex menangkap angka (integer / decimal dengan koma atau titik) dan unit teks
  const match = clean.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]*)$/);
  if (!match) return null;

  const rawNum = parseFloat(match[1].replace(',', '.'));
  if (isNaN(rawNum) || rawNum <= 0) return null;

  const rawUnit = match[2].toUpperCase();

  let unit: BandwidthUnit = 'MBPS';
  if (rawUnit.startsWith('T')) {
    unit = 'TBPS';
  } else if (rawUnit.startsWith('G')) {
    unit = 'GBPS';
  } else if (rawUnit.startsWith('K')) {
    unit = 'KBPS';
  } else if (rawUnit.startsWith('M') || rawUnit === '') {
    unit = 'MBPS';
  }

  return { speed: rawNum, unit };
}

/**
 * Parser batch masukan: dapat menerima list terpisah koma, spasi, atau baris baru
 * Contoh: "10M, 20M, 1,2G, 50M, 100M, 200M, 1G"
 */
export function parseBatchBandwidths(input: string): Array<{ speed: number; unit: BandwidthUnit; raw: string }> {
  if (!input) return [];

  // Split by newline, semicolon, or comma (kecuali koma di dalam angka desimal seperti 1,2)
  // Cara aman: ganti baris baru dan titik koma, dan koma yang diikuti spasi atau koma non-desimal
  const items = input
    .split(/[\n;]+|(?<=\s),(?=\s)|,(?=[a-zA-Z])|(?<=[a-zA-Z]),|,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: Array<{ speed: number; unit: BandwidthUnit; raw: string }> = [];

  for (const item of items) {
    const parsed = parseBandwidthString(item);
    if (parsed) {
      results.push({ ...parsed, raw: item });
    }
  }

  return results;
}
