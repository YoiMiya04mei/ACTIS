export type RouterOSVersion = 'v6' | 'v7';

export type MikroTikToolId =
  // Route, Mangle, NAT & VPN (16 tools)
  | 'lb-pcc'
  | 'lb-nth'
  | 'lb-ecmp'
  | 'failover-recursive'
  | 'games-raw'
  | 'games-mangle'
  | 'website-routing'
  | 'client-ip-routing'
  | 'port-forwarding'
  | 'port-tcp-udp-routing'
  | 'vpn-all-traffic'
  | 'remote-access-isp'
  | 'vpn-port-games'
  | 'vpn-ip-games'
  | 'vpn-remote-client'
  | 'social-media-routing'

  // SIMPLE QUEUE // QUEUE TREE // QUEUE TYPE (7 tools)
  | 'burst-limit-calc'
  | 'pcq-burst-queue-size-calc'
  | 'simple-queue-token-bucket'
  | 'simple-queue-shared-upto'
  | 'queue-tree-shared-upto'
  | 'pcq-tree-simple-gen'
  | 'queue-qos-priority'

  // HOTSPOT // PPPOE // PPP (7 tools)
  | 'hotspot-qr-code'
  | 'hotspot-user-gen'
  | 'hotspot-block-sharing-ttl'
  | 'hotspot-bandwidth-up-to'
  | 'hotspot-config-wizard'
  | 'hotspot-expired-notif'
  | 'ppp-secrets-gen'

  // DNS // NETWATCH // INTERFACE // MAC // DHCP (5 tools)
  | 'dns-doh'
  | 'bonding-interface'
  | 'netwatch-notifications'
  | 'dhcp-rogue-protection'
  | 'mac-random-change'

  // PROTECTION // BLOCK // BACKUP (7 tools)
  | 'hide-routerboard-isp'
  | 'port-knocking-icmp'
  | 'advanced-router-protection'
  | 'block-websites-gen'
  | 'auto-backup-email'
  | 'mangle-obfuscator'
  | 'block-social-streaming'

  // ROUTER-OS OTHER TOOLS (4 tools)
  | 'pcc-calculator'
  | 'indonesia-ntp-clock'
  | 'ip-calculator'
  | 'wifi-id-autologin';

export type ToolCategory =
  | 'route-mangle-nat-vpn'
  | 'simple-queue-tree-type'
  | 'hotspot-pppoe-ppp'
  | 'dns-netwatch-dhcp'
  | 'protection-block-backup'
  | 'routeros-other-tools';

export interface WanLine {
  id: string;
  name: string; // e.g. WAN1, WAN2
  interface: string; // e.g. ether1-ISP1
  gateway: string; // e.g. 192.168.1.1
  distance: number;
  weight?: number; // for PCC / ECMP ratio
  speed?: number; // bandwidth speed in Mbps for PCC ratio (e.g. 100, 200)
  targetDns?: string; // for recursive failover, e.g. 8.8.8.8
}

// 1. PCC Config
export interface PCCConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  lanSubnet: string;
  pccClassifier: 'both-addresses-and-ports' | 'both-addresses' | 'src-address' | 'src-address-and-port';
  wans: WanLine[];
  addDefaultRoute: boolean;
  addNatMasquerade: boolean;
  addLocalAcceptRule: boolean;
}

// 2. NTH Config
export interface NTHConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  lanSubnet: string;
  wans: WanLine[];
  addDefaultRoute: boolean;
  addNatMasquerade: boolean;
}

// 3. ECMP Config
export interface ECMPConfig {
  rosVersion: RouterOSVersion;
  wans: WanLine[];
  checkGateway: 'ping' | 'arp' | 'none';
  addNatMasquerade: boolean;
}

// 4. Failover Recursive Gateway Config
export interface RecursiveFailoverConfig {
  rosVersion: RouterOSVersion;
  primaryWan: WanLine;
  secondaryWan: WanLine;
  primaryTargetDns: string;
  secondaryTargetDns: string;
  addNatMasquerade: boolean;
}

// 5 & 6. Games Routing Config
export interface GamesRoutingConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  targetWan: string;
  targetGateway: string;
  routingMarkName: string;
  method: 'raw' | 'mangle';
  selectedGameIds: string[];
  customPortsTcp: string;
  customPortsUdp: string;
}

// 7. Website Static Routing Config
export interface WebsiteRoutingConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  targetWan: string;
  targetGateway: string;
  routingMarkName: string;
  selectedPresets: string[];
  customDomains: string[];
}

// 8. Local Client IP Static Routing Config
export interface ClientIpRoutingConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  targetWan: string;
  targetGateway: string;
  routingMarkName: string;
  clientIpList: string;
  description: string;
}

// 9. Port Forwarding NAT Config
export interface PortForwardingConfig {
  rosVersion: RouterOSVersion;
  wanInterface: string;
  publicIp: string;
  protocol: 'tcp' | 'udp' | 'both';
  externalPort: string;
  internalIp: string;
  internalPort: string;
  comment: string;
  includeHairpinNat: boolean;
  lanSubnet: string;
}

// 10. Port TCP/UDP Static Routing Config
export interface PortRoutingConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  targetWan: string;
  targetGateway: string;
  routingMarkName: string;
  protocol: 'tcp' | 'udp' | 'both';
  ports: string;
  description: string;
}

// 11. All Traffic to VPN Tunnel Config
export interface AllTrafficVPNConfig {
  rosVersion: RouterOSVersion;
  vpnInterface: string;
  lanInterface: string;
  vpnServerIp: string;
  addNatMasquerade: boolean;
  enableKillSwitch: boolean;
  clientSubnet: string;
}

// 12. Remote Access Config
export interface RemoteAccessConfig {
  rosVersion: RouterOSVersion;
  wanInterface: string;
  wanGateway: string;
  allowedSourceIps: string;
  enableWinbox: boolean;
  winboxPort: string;
  enableWebfig: boolean;
  webfigPort: string;
  enableSSH: boolean;
  sshPort: string;
  enableApi: boolean;
  apiPort: string;
  addMangleReplyRule: boolean;
}

// 13 & 14. VPN Routing for Games Config
export interface VPNGamesConfig {
  rosVersion: RouterOSVersion;
  vpnInterface: string;
  routingMarkName: string;
  type: 'port' | 'ip';
  selectedGameIds: string[];
  customPortsTcp: string;
  customPortsUdp: string;
  customIps: string;
}

// 15. VPN Remote Client Config
export interface VPNRemoteClientConfig {
  rosVersion: RouterOSVersion;
  vpnType: 'sstp' | 'l2tp' | 'pptp' | 'ovpn' | 'wireguard';
  serverAddress: string;
  serverPort: string;
  username: string;
  password: string;
  profileName: string;
  interfaceName: string;
  addDefaultRoute: boolean;
  wireguardPrivateKey?: string;
  wireguardClientIp?: string;
  wireguardServerPublicKey?: string;
}

// 16. Social Media Routing Config
export interface SocialMediaRoutingConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  targetWan: string;
  targetGateway: string;
  routingMarkName: string;
  selectedPlatforms: string[];
  customDomains: string[];
}

// ==========================================
// NEW TOOLS CONFIGS
// ==========================================

// 17. Hotspot QR Code Config
export interface HotspotQRCodeConfig {
  rosVersion: RouterOSVersion;
  ssid: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  password?: string;
  hidden: boolean;
  loginUrl?: string; // Hotspot login URL e.g. http://hotspot.lan/login?username=...
  hotspotServerName: string;
}

// 18. Hotspot User Generator Config
export interface HotspotUserGenConfig {
  rosVersion: RouterOSVersion;
  server: string; // e.g. all or hotspot1
  profile: string; // e.g. default or 2Jam
  prefix: string; // e.g. vc-
  userCount: number;
  userType: 'same' | 'different'; // username = password or separate password
  charType: 'numeric' | 'alphanumeric' | 'lowercase';
  length: number;
  uptimeLimit: string; // e.g. 2h, 1d
  comment: string;
}

// 19. Block Sharing Hotspot with Change TTL Config
export interface BlockSharingTTLConfig {
  rosVersion: RouterOSVersion;
  hotspotInterface: string;
  ttlValue: number; // usually 1
  chain: 'postrouting' | 'prerouting';
  comment: string;
}

// 20. Bandwidth Share Up-To (PCQ) Config
export interface BandwidthUpToConfig {
  rosVersion: RouterOSVersion;
  queueName: string;
  targetSubnet: string; // e.g. 192.168.88.0/24
  totalDownloadRate: string; // e.g. 50M
  totalUploadRate: string; // e.g. 20M
  minClientRate: string; // e.g. 1M or 0
  maxClientRate: string; // e.g. 10M or 0 (unlimited up to total)
}

// 21. Easy Hotspot Config Wizard
export interface HotspotWizardConfig {
  rosVersion: RouterOSVersion;
  interfaceName: string; // e.g. ether3-Hotspot
  localIpAddress: string; // e.g. 192.168.20.1/24
  dhcpPoolRange: string; // e.g. 192.168.20.10-192.168.20.250
  dnsName: string; // e.g. hotspot.net
  adminUser: string;
  adminPassword: string;
  defaultProfileRateLimit: string; // e.g. 5M/5M
  sharedUsers: number;
}

// 22. Expired Notification Config
export interface ExpiredNotificationConfig {
  rosVersion: RouterOSVersion;
  serviceType: 'hotspot' | 'pppoe' | 'both';
  redirectUrl: string; // e.g. http://billing.isp.net/isolir.html
  internalProxyPort: string; // 8080
  addressListName: string; // ISOLIR_USERS
}

// 23. PPP Secrets Generator Config
export interface PPPSecretsGenConfig {
  rosVersion: RouterOSVersion;
  service: 'pppoe' | 'l2tp' | 'sstp' | 'ovpn' | 'any';
  profile: string;
  prefix: string;
  userCount: number;
  length: number;
  remoteIpPrefix?: string; // e.g. 10.10.10.
  comment: string;
}

// 24. DNS over HTTPS (DoH) Config
export interface DoHConfig {
  rosVersion: RouterOSVersion;
  provider: 'cloudflare' | 'google' | 'adguard' | 'nextdns' | 'custom';
  dohUrl: string;
  fallbackDns: string;
  verifyCert: boolean;
  cleanStaticEntries: boolean;
}

// 25. Bonding Interface Config
export interface BondingConfig {
  rosVersion: RouterOSVersion;
  bondingName: string;
  slaveInterfaces: string[]; // e.g. ['ether1', 'ether2']
  mode: '802.3ad' | 'balance-rr' | 'active-backup' | 'balance-xor' | 'broadcast' | 'balance-tlb' | 'balance-alb';
  lacpRate: '1sec' | '30sec';
  transmitHashPolicy: 'layer-2' | 'layer-2-and-3' | 'layer-3-and-4';
  ipAddress?: string;
}

// 26. Netwatch Notifications Config
export interface NetwatchConfig {
  rosVersion: RouterOSVersion;
  hostIp: string;
  hostName: string;
  checkInterval: string; // 30s
  timeout: string; // 1000ms
  notifyChannel: 'telegram' | 'whatsapp' | 'email';
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappApiUrl?: string;
  emailRecipient?: string;
}

// 27. Looping / Unknown Rogue DHCP Server Config
export interface RogueDHCPConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  validServerMac: string; // valid DHCP server MAC
  alertTimeout: string; // 1h
  action: 'alert' | 'block' | 'both';
}

// 28. Change / Random MAC Address Config
export interface MacChangeConfig {
  rosVersion: RouterOSVersion;
  targetInterface: string;
  newMacAddress: string;
  backupOldMac: boolean;
}

// 29. Hide Routerboard from ISP (MikroTik Ninja)
export interface HideRouterboardConfig {
  rosVersion: RouterOSVersion;
  wanInterface: string;
  lanInterface: string;
  disableNeighborDiscovery: boolean;
  disableMacServer: boolean;
  disableBandwidthServer: boolean;
  blockIcmpTracerouteToWan: boolean;
  normalizeOutboundTTL: boolean;
}

// 30. Port Knocking with ICMP + Packet Size
export interface PortKnockingConfig {
  rosVersion: RouterOSVersion;
  wanInterface: string;
  targetPort: string; // e.g. 8291 (Winbox) or 22 (SSH)
  knockSize1: number; // e.g. 128
  knockSize2: number; // e.g. 256
  knockTimeout: string; // e.g. 30s
  accessDuration: string; // e.g. 1h
}

// 31. Advanced MikroTik RouterOS Protection
export interface AdvancedProtectionConfig {
  rosVersion: RouterOSVersion;
  wanInterface: string;
  lanInterface: string;
  dropInvalid: boolean;
  blockSynFlood: boolean;
  blockPortScanners: boolean;
  protectBruteForceWinbox: boolean;
  protectBruteForceSSH: boolean;
  blockDnsOpenResolver: boolean;
}

// 32. Block Websites Generator Config
export interface BlockWebsitesConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  categories: Array<'gambling' | 'pornography' | 'crypto_mining' | 'piracy' | 'custom'>;
  customDomains: string[];
  blockMethod: 'tls-host' | 'address-list' | 'dns-static';
}

// 33. Auto Backup to E-Mail Config
export interface AutoBackupEmailConfig {
  rosVersion: RouterOSVersion;
  emailRecipient: string;
  backupPassword?: string;
  exportRsc: boolean;
  scheduleTime: string; // e.g. 02:00:00
  scheduleInterval: '1d' | '7d' | '30d';
  routerIdentity: string;
}

// 34. Mangle Chain Obfuscator Config
export interface MangleObfuscatorConfig {
  rosVersion: RouterOSVersion;
  originalScript: string;
  stripComments: boolean;
  addDecoyRules: boolean;
  renameIdentifiers: boolean;
}

// 35. Block Social Media & Video Streaming
export interface BlockSocialMediaConfig {
  rosVersion: RouterOSVersion;
  lanInterface: string;
  selectedPlatforms: string[]; // youtube, tiktok, facebook, whatsapp, netflix, etc.
  blockTimeStart?: string; // e.g. 08:00:00
  blockTimeEnd?: string; // e.g. 17:00:00
  blockDays?: string; // e.g. mon,tue,wed,thu,fri
}

// 36. PCC Divisor & Remainder Calculator Config
export interface PCCCalculatorConfig {
  wan1Mbps: number;
  wan2Mbps: number;
  wan3Mbps?: number;
  wan4Mbps?: number;
}

// 37. Indonesia NTP / Timezone Config
export interface IndonesiaNTPConfig {
  rosVersion: RouterOSVersion;
  timezone: 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';
  ntpServers: string[];
}

// 38. IP Calculator Config
export interface IPCalculatorConfig {
  ipWithCidr: string; // e.g. 192.168.10.1/24
  targetInterface: string;
}

// 39. Wifi.id Auto-Login Config
export interface WifiIdAutoLoginConfig {
  rosVersion: RouterOSVersion;
  loginType: 'wifi_id' | 'wms' | 'seamless';
  username: string;
  password: string;
  wanInterface: string;
  checkInterval: string; // 2m
}

// 40. Burst Limit Calculator Config
export interface BurstLimitConfig {
  rosVersion: RouterOSVersion;
  upMaxLimit: string;
  upBurstLimit: string;
  upBonusDuration: number;
  downMaxLimit: string;
  downBurstLimit: string;
  downBonusDuration: number;
  targetSubnet?: string;
  queueName?: string;
}

// 41. PCQ Burst Rate + Queue Size Calculator Config
export interface PCQBurstQueueSizeConfig {
  rosVersion: RouterOSVersion;
  totalClient: number;
  queueSize: number;
  maxRate: string;
  burstRate: string;
  actualBurstTime: number;
  queueName?: string;
}

// 42. Simple Queue + Token Bucket Config
export interface SimpleQueueTokenBucketConfig {
  rosVersion: RouterOSVersion;
  parentName: string;
  parentTarget: string;
  parentUpMax: string;
  parentDownMax: string;
  clientPrefix: string;
  clientInitial: number;
  startIp: string;
  endIp: string;
  clientUpMax: string;
  clientDownMax: string;
  bucketSizeUp: number;
  bucketSizeDown: number;
}

// 43. Simple Queue + Bandwidth Shared Up-To Config
export interface SimpleQueueSharedUpToConfig {
  rosVersion: RouterOSVersion;
  parentName: string;
  parentTarget: string;
  parentUpMax: string;
  parentDownMax: string;
  clientPrefix: string;
  clientInitial: number;
  startIp: string;
  endIp: string;
  clientUpMax: string;
  clientDownMax: string;
  limitAtUp: string;
  limitAtDown: string;
  autoShared: boolean;
}

// 44. Queue Tree + Bandwidth Shared Up-To Config
export interface QueueTreeSharedUpToConfig {
  rosVersion: RouterOSVersion;
  parentName: string;
  subQueueUpload: string;
  subQueueDownload: string;
  parentUpMax: string;
  parentDownMax: string;
  clientPrefix: string;
  clientInitial: number;
  startIp: string;
  endIp: string;
  clientUpMax: string;
  clientDownMax: string;
  limitAtUp: string;
  limitAtDown: string;
  autoShared: boolean;
}

// 45. PCQ for Queue Tree & Queue Simple Config
export interface PCQTreeSimpleConfig {
  rosVersion: RouterOSVersion;
  queueOption: 'queue-tree' | 'queue-simple';
  parentName: string;
  subQueueUpload: string;
  subQueueDownload: string;
  parentUpMax: string;
  parentDownMax: string;
  pcqUploadName: string;
  pcqDownloadName: string;
  pcqUpLimit: string;
  pcqDownLimit: string;
  autoShared: boolean;
  localSubnets: string;
}

// 46. QoS Priority Youtube, Tiktok, WA, FB, etc. Config
export interface QoSPriorityConfig {
  rosVersion: RouterOSVersion;
  queueOption: 'queue-simple' | 'queue-tree';
  service: string;
  queueName: string;
  priority: number;
  maxLimit: string;
  matchFilter: 'tls-host' | 'content';
  localSubnets: string;
}

