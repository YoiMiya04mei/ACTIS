export type BandwidthUnit = 'KBPS' | 'MBPS' | 'GBPS' | 'TBPS';

export type GbpsConversionMode = 'direct' | 'decimal';

export interface TrafficQoSResult {
  id: string;
  speed: number;
  unit: BandwidthUnit;
  name: string;
  cir: number; // in kbps (e.g. 100 Mbps * 1024 = 102400)
  pir: number; // in kbps (e.g. 102400)
  cbs: number; // in bytes = cir * 8 (e.g. 102400 * 8 = 819200)
  pbs: number; // in bytes = pir * 8 (e.g. 102400 * 8 = 819200)
  operator: 'or' | 'and';
  matchCondition: string; // default: 'if-match any'
  action: string; // default: 'green pass yellow pass red discard'
  trafficClassifierConfig: string;
  trafficBehaviorConfig: string;
  trafficPolicyConfig?: string;
  interfaceExampleConfig?: string;
  fullConfig: string;
  undoConfig: string;
  suggestedNames?: string[];
  equivalentMbps?: number;
}

export interface TrafficQoSOptions {
  customName?: string;
  rawInput?: string;
  operator?: 'or' | 'and';
  matchCondition?: string;
  action?: string;
  includeTrafficPolicy?: boolean;
  includeInterfaceExample?: boolean;
  interfaceName?: string;
  gbpsConversionMode?: GbpsConversionMode; // 'direct' = speed * 1024 * 1024, 'decimal' = speed * 1000 * 1024 (e.g. 1.2G = 1200M)
}

export interface SavedQoSProfile {
  id: string;
  title: string;
  speed: number;
  unit: BandwidthUnit;
  createdAt: string;
}
