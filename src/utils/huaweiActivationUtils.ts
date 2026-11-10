import type {
  HuaweiActivationConfig,
  HuaweiActivationScriptResult,
} from '../types/huaweiActivation';

/**
 * Nilai bawaan (default) konfigurasi aktivasi Huawei sesuai contoh
 */
export const DEFAULT_HUAWEI_ACTIVATION_CONFIG: HuaweiActivationConfig = {
  vlanId: '3191',
  serviceName: 'GIA_CICURUG(TELKOM)',
  vlanDescription: 'VLAN-3191-GIA_CICURUG(TELKOM)',
  autoFormatVlanDesc: true,

  trafficPolicyName: 'VLAN-3191-GIA_CICURUG(TELKOM)',
  autoFormatPolicyName: true,
  classifierName: '200MBPS',
  behaviorName: '200MBPS',
  precedence: 1,
  shareMode: true,

  vlanifIp: '10.100.91.118',
  vlanifSubnetMask: '255.255.255.254',
  statisticEnable: true,
  applyInboundPolicy: true,
  applyOutboundPolicy: true,

  enableStaticRoute: true,
  staticRoutes: [
    {
      id: 'default-route-1',
      destinationIp: '103.97.140.151',
      subnetMask: '255.255.255.255',
      nextHopIp: '10.100.91.119',
      description: 'GIA_CICURUG(TELKOM)',
      enabled: true,
    },
  ],

  physicalInterfaces: ['Eth-Trunk4'],
};

/**
 * Format string deskripsi VLAN standar: VLAN-{vlanId}-{serviceName}
 */
export function formatVlanDescription(vlanId: string, serviceName: string): string {
  const cleanVlan = vlanId.trim();
  const cleanService = serviceName.trim();
  if (!cleanVlan && !cleanService) return '';
  if (!cleanVlan) return cleanService;
  if (!cleanService) return `VLAN-${cleanVlan}`;
  return `VLAN-${cleanVlan}-${cleanService}`;
}

/**
 * Helper untuk menghitung Peer IP (Next-Hop) dari local IP & Subnet Mask (/31 atau /30)
 */
export function calculatePeerIp(localIp: string, mask: string): string | null {
  const ipParts = localIp.trim().split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return null;
  }

  const cleanMask = mask.trim();
  const [a, b, c, d] = ipParts;

  // /31 Subnet (255.255.255.254) RFC 3021
  if (cleanMask === '255.255.255.254' || cleanMask === '/31' || cleanMask === '31') {
    const peerD = d % 2 === 0 ? d + 1 : d - 1;
    if (peerD >= 0 && peerD <= 255) {
      return `${a}.${b}.${c}.${peerD}`;
    }
  }

  // /30 Subnet (255.255.255.252)
  if (cleanMask === '255.255.255.252' || cleanMask === '/30' || cleanMask === '30') {
    const base = d & 252;
    const ip1 = base + 1;
    const ip2 = base + 2;
    if (d === ip1) return `${a}.${b}.${c}.${ip2}`;
    if (d === ip2) return `${a}.${b}.${c}.${ip1}`;
  }

  return null;
}

/**
 * Normalisasi subnet mask jika user memasukkan prefix CIDR (e.g. /31 -> 255.255.255.254)
 */
export function normalizeSubnetMask(mask: string): string {
  const trimmed = mask.trim();
  const cidrMap: Record<string, string> = {
    '/32': '255.255.255.255',
    '32': '255.255.255.255',
    '/31': '255.255.255.254',
    '31': '255.255.255.254',
    '/30': '255.255.255.252',
    '30': '255.255.255.252',
    '/29': '255.255.255.248',
    '29': '255.255.255.248',
    '/28': '255.255.255.240',
    '28': '255.255.255.240',
    '/27': '255.255.255.224',
    '27': '255.255.255.224',
    '/26': '255.255.255.192',
    '26': '255.255.255.192',
    '/25': '255.255.255.128',
    '25': '255.255.255.128',
    '/24': '255.255.255.0',
    '24': '255.255.255.0',
  };

  return cidrMap[trimmed] || trimmed;
}

/**
 * 1. Penambahan VLAN
 * Contoh:
 * vlan 3191
 *  description VLAN-3191-GIA_CICURUG(TELKOM)
 * #
 */
export function generateStep1Vlan(config: HuaweiActivationConfig): string {
  const vlan = config.vlanId.trim() || '3191';
  const desc = config.autoFormatVlanDesc
    ? formatVlanDescription(vlan, config.serviceName)
    : config.vlanDescription.trim() || formatVlanDescription(vlan, config.serviceName);

  const lines = [`vlan ${vlan}`];
  if (desc) {
    lines.push(` description ${desc}`);
  }
  lines.push('#');
  return lines.join('\n');
}

/**
 * 2. Penambahan Traffic Policy
 * Contoh:
 * traffic policy VLAN-3191-GIA_CICURUG(TELKOM)
 *  share-mode
 *  classifier 200MBPS behavior 200MBPS precedence 1
 * #
 */
export function generateStep2TrafficPolicy(config: HuaweiActivationConfig): string {
  const vlan = config.vlanId.trim() || '3191';
  const policyName = config.autoFormatPolicyName
    ? config.autoFormatVlanDesc
      ? formatVlanDescription(vlan, config.serviceName)
      : config.vlanDescription.trim() || formatVlanDescription(vlan, config.serviceName)
    : config.trafficPolicyName.trim() || formatVlanDescription(vlan, config.serviceName);

  const classifier = config.classifierName.trim() || '200MBPS';
  const behavior = config.behaviorName.trim() || classifier;
  const precedence = config.precedence || 1;

  const lines = [`traffic policy ${policyName}`];
  if (config.shareMode) {
    lines.push(' share-mode');
  }
  lines.push(` classifier ${classifier} behavior ${behavior} precedence ${precedence}`);
  lines.push('#');
  return lines.join('\n');
}

/**
 * 3. Penambahan Interfaces Vlanif
 * Contoh:
 * interface Vlanif3191
 *  description VLAN-3191-GIA_CICURUG(TELKOM)
 *  ip address 10.100.91.118 255.255.255.254
 *  statistic enable
 *  traffic-policy VLAN-3191-GIA_CICURUG(TELKOM) inbound
 *  traffic-policy VLAN-3191-GIA_CICURUG(TELKOM) outbound
 * #
 */
export function generateStep3Vlanif(config: HuaweiActivationConfig): string {
  const vlan = config.vlanId.trim() || '3191';
  const desc = config.autoFormatVlanDesc
    ? formatVlanDescription(vlan, config.serviceName)
    : config.vlanDescription.trim() || formatVlanDescription(vlan, config.serviceName);

  const policyName = config.autoFormatPolicyName
    ? desc
    : config.trafficPolicyName.trim() || desc;

  const ip = config.vlanifIp.trim() || '10.100.91.118';
  const mask = normalizeSubnetMask(config.vlanifSubnetMask) || '255.255.255.254';

  const lines = [`interface Vlanif${vlan}`];
  if (desc) {
    lines.push(` description ${desc}`);
  }
  if (ip && mask) {
    lines.push(` ip address ${ip} ${mask}`);
  }
  if (config.statisticEnable) {
    lines.push(' statistic enable');
  }
  if (config.applyInboundPolicy && policyName) {
    lines.push(` traffic-policy ${policyName} inbound`);
  }
  if (config.applyOutboundPolicy && policyName) {
    lines.push(` traffic-policy ${policyName} outbound`);
  }
  lines.push('#');
  return lines.join('\n');
}

/**
 * 4. Penambahan Router Static
 * Contoh:
 * ip route-static 103.97.140.151 255.255.255.255 10.100.91.119 description GIA_CICURUG(TELKOM)
 */
export function generateStep4StaticRoute(config: HuaweiActivationConfig): string {
  if (!config.enableStaticRoute || !config.staticRoutes || config.staticRoutes.length === 0) {
    return '';
  }

  const validRoutes = config.staticRoutes.filter((r) => r.enabled && r.destinationIp && r.nextHopIp);
  if (validRoutes.length === 0) {
    return '';
  }

  const defaultDesc = config.serviceName.trim() || 'GIA_CICURUG(TELKOM)';

  return validRoutes
    .map((r) => {
      const dst = r.destinationIp.trim();
      const mask = normalizeSubnetMask(r.subnetMask) || '255.255.255.255';
      const nextHop = r.nextHopIp.trim();
      const desc = r.description.trim() || defaultDesc;
      const descPart = desc ? ` description ${desc}` : '';
      return `ip route-static ${dst} ${mask} ${nextHop}${descPart}`;
    })
    .join('\n');
}

/**
 * 5. Penambahan Tagging vlan pada interfaces fisik (bisa lebih dari 1)
 * Contoh:
 * interface Eth-Trunk4
 *  port trunk allow-pass vlan 3191
 * #
 */
export function generateStep5TrunkTagging(config: HuaweiActivationConfig): string {
  const vlan = config.vlanId.trim() || '3191';
  const interfaces = (config.physicalInterfaces || []).map((i) => i.trim()).filter(Boolean);

  if (interfaces.length === 0) {
    return '';
  }

  return interfaces
    .map((iface) => {
      return `interface ${iface}\n port trunk allow-pass vlan ${vlan}\n#`;
    })
    .join('\n');
}

/**
 * Generate semua skrip secara utuh (Step 1 -> 2 -> 3 -> 4 -> 5)
 */
export function generateHuaweiActivationScript(config: HuaweiActivationConfig): HuaweiActivationScriptResult {
  const step1 = generateStep1Vlan(config);
  const step2 = generateStep2TrafficPolicy(config);
  const step3 = generateStep3Vlanif(config);
  const step4 = generateStep4StaticRoute(config);
  const step5 = generateStep5TrunkTagging(config);

  const sections: string[] = [];
  if (step1) sections.push(step1);
  if (step2) sections.push(step2);
  if (step3) sections.push(step3);
  if (step4) {
    // Sisipkan `#` setelah static route jika diikuti command berikutnya
    sections.push(step4 + '\n#');
  }
  if (step5) sections.push(step5);

  const fullConfig = sections.join('\n');

  // Rollback / Undo Config (dieksekusi terbalik 5 -> 4 -> 3 -> 2 -> 1)
  const undoSections: string[] = [];
  const vlan = config.vlanId.trim() || '3191';
  const policyName = config.autoFormatPolicyName
    ? config.autoFormatVlanDesc
      ? formatVlanDescription(vlan, config.serviceName)
      : config.vlanDescription.trim() || formatVlanDescription(vlan, config.serviceName)
    : config.trafficPolicyName.trim() || formatVlanDescription(vlan, config.serviceName);

  // Undo 5. Trunk Tagging
  const interfaces = (config.physicalInterfaces || []).map((i) => i.trim()).filter(Boolean);
  if (interfaces.length > 0) {
    const undoTrunks = interfaces
      .map((iface) => `interface ${iface}\n undo port trunk allow-pass vlan ${vlan}\n#`)
      .join('\n');
    undoSections.push(undoTrunks);
  }

  // Undo 4. Static Routes
  if (config.enableStaticRoute && config.staticRoutes) {
    const validRoutes = config.staticRoutes.filter((r) => r.enabled && r.destinationIp && r.nextHopIp);
    if (validRoutes.length > 0) {
      const undoRoutes = validRoutes
        .map((r) => {
          const dst = r.destinationIp.trim();
          const mask = normalizeSubnetMask(r.subnetMask) || '255.255.255.255';
          const nextHop = r.nextHopIp.trim();
          return `undo ip route-static ${dst} ${mask} ${nextHop}`;
        })
        .join('\n');
      undoSections.push(undoRoutes + '\n#');
    }
  }

  // Undo 3. Interface Vlanif
  undoSections.push(`undo interface Vlanif${vlan}\n#`);

  // Undo 2. Traffic Policy
  if (policyName) {
    undoSections.push(`undo traffic policy ${policyName}\n#`);
  }

  // Undo 1. VLAN
  undoSections.push(`undo vlan ${vlan}\n#`);

  const undoConfig = undoSections.join('\n');

  return {
    step1Vlan: step1,
    step2TrafficPolicy: step2,
    step3Vlanif: step3,
    step4StaticRoute: step4,
    step5TrunkTagging: step5,
    fullConfig,
    undoConfig,
  };
}
