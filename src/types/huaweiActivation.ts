export interface HuaweiStaticRouteItem {
  id: string;
  destinationIp: string;
  subnetMask: string;
  nextHopIp: string;
  description: string;
  enabled: boolean;
}

export interface HuaweiActivationConfig {
  // 1. VLAN
  vlanId: string;
  serviceName: string;
  vlanDescription: string;
  autoFormatVlanDesc: boolean;

  // 2. Traffic Policy
  trafficPolicyName: string;
  autoFormatPolicyName: boolean;
  classifierName: string;
  behaviorName: string;
  precedence: number;
  shareMode: boolean;

  // 3. Vlanif Interface
  vlanifIp: string;
  vlanifSubnetMask: string;
  statisticEnable: boolean;
  applyInboundPolicy: boolean;
  applyOutboundPolicy: boolean;

  // 4. Static Route
  enableStaticRoute: boolean;
  staticRoutes: HuaweiStaticRouteItem[];

  // 5. Physical / Trunk Interfaces (bisa lebih dari 1)
  physicalInterfaces: string[];
}

export interface HuaweiActivationScriptResult {
  step1Vlan: string;
  step2TrafficPolicy: string;
  step3Vlanif: string;
  step4StaticRoute: string;
  step5TrunkTagging: string;
  fullConfig: string;
  undoConfig: string;
}

