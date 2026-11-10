import React, { useState, useMemo } from 'react';
import {
  Server,
  Layers,
  Network,
  Shield,
  Lock,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  Info,
  Sliders,
  Terminal,
  Sun,
  Moon,
  Gamepad2,
  Globe,
  Share2,
  Radio,
  ArrowRightLeft,
  Key,
  QrCode,
  Users,
  Gauge,
  Wand2,
  Bell,
  FileKey,
  Link2,
  Send,
  AlertTriangle,
  Binary,
  EyeOff,
  DoorClosed,
  ShieldAlert,
  Ban,
  Mail,
  FileCode,
  Clock,
  Calculator,
  Wifi,
  Search,
  Zap,
  FolderTree,
  Coins,
  Activity,
} from 'lucide-react';
import type {
  MikroTikToolId,
  ToolCategory,
  RouterOSVersion,
  WanLine,
  PCCConfig,
  VPNRemoteClientConfig,
} from '@/types/mikrotikTools';
import type { ToastMessage } from '@/components/tools/Toast';
import {
  computePCCRatio,
  generatePCCScript,
  generateNTHScript,
  generateECMPScript,
  generateRecursiveFailoverScript,
  generateGamesRoutingScript,
  generateWebsiteRoutingScript,
  generateClientIpRoutingScript,
  generatePortForwardingScript,
  generatePortTcpUdpRoutingScript,
  generateAllTrafficVPNScript,
  generateRemoteAccessScript,
  generateVPNGamesScript,
  generateVPNRemoteClientScript,
  generateSocialMediaRoutingScript,
  generateHotspotQRCodeScript,
  generateHotspotUserGenScript,
  generateBlockSharingTTLScript,
  generateBandwidthUpToScript,
  generateHotspotWizardScript,
  generateExpiredNotificationScript,
  generatePPPSecretsGenScript,
  generateDoHScript,
  generateBondingScript,
  generateNetwatchScript,
  generateRogueDHCPScript,
  generateMacChangeScript,
  generateHideRouterboardScript,
  generatePortKnockingScript,
  generateAdvancedProtectionScript,
  generateBlockWebsitesScript,
  generateAutoBackupEmailScript,
  generateMangleObfuscatorScript,
  generateBlockSocialMediaScript,
  calculatePCCDivisors,
  generateIndonesiaNTPScript,
  calculateMikroTikIP,
  generateWifiIdAutoLoginScript,
  formatKbpsToSpeed,
  calculateBurstMetrics,
  generateBurstLimitScript,
  calculatePCQMetrics,
  generatePCQBurstQueueSizeScript,
  generateSimpleQueueTokenBucketScript,
  generateSimpleQueueSharedUpToScript,
  generateQueueTreeSharedUpToScript,
  generatePCQTreeSimpleScript,
  generateQoSPriorityScript,
  GAME_PRESETS,
  WEBSITE_PRESETS,
  SOCIAL_PRESETS,
  QOS_SERVICE_PRESETS,
} from '@/utils/mikrotikGenerators';

interface MikroTikToolsPageProps {
  addToast?: (type: ToastMessage['type'], title: string, message?: string) => void;
}

interface ToolItem {
  id: MikroTikToolId;
  name: string;
  category: ToolCategory;
  shortDesc: string;
  icon: React.ReactNode;
}

export const TOOLS_LIST: ToolItem[] = [
  // Category: SIMPLE QUEUE // QUEUE TREE // QUEUE TYPE (7 tools)
  {
    id: 'burst-limit-calc',
    name: 'Burst Limit Calculator',
    category: 'simple-queue-tree-type',
    shortDesc: 'Kalkulator threshold, limit-at, burst-time & bonus durasi detik',
    icon: <Zap className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'pcq-burst-queue-size-calc',
    name: 'PCQ Burst Rate + Queue Size Calculator',
    category: 'simple-queue-tree-type',
    shortDesc: 'Kalkulator ukuran buffer antrian total client & estimasi RAM',
    icon: <Calculator className="w-4 h-4 text-blue-600" />,
  },
  {
    id: 'simple-queue-token-bucket',
    name: 'Simple Queue + Token Bucket',
    category: 'simple-queue-tree-type',
    shortDesc: 'Manajemen antrian token bucket size (bursting data instan)',
    icon: <Coins className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: 'simple-queue-shared-upto',
    name: 'Simple Queue + Bandwidth Shared Up-To',
    category: 'simple-queue-tree-type',
    shortDesc: 'Pembagian bandwidth bertingkat parent-child simple queue',
    icon: <Sliders className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: 'queue-tree-shared-upto',
    name: 'Queue Tree + Bandwidth Shared Up-To',
    category: 'simple-queue-tree-type',
    shortDesc: 'Antrian hirarkis Queue Tree parent-child dengan packet marking mangle',
    icon: <FolderTree className="w-4 h-4 text-purple-600" />,
  },
  {
    id: 'pcq-tree-simple-gen',
    name: 'PCQ for Queue Tree and Queue Simple',
    category: 'simple-queue-tree-type',
    shortDesc: 'Per Connection Queueing otomatis bagi rata bandwidth dinamis',
    icon: <Layers className="w-4 h-4 text-cyan-600" />,
  },
  {
    id: 'queue-qos-priority',
    name: 'QoS Priority Youtube, Tiktok, WA, FB, etc.',
    category: 'simple-queue-tree-type',
    shortDesc: 'Prioritas bandwidth 8 tingkat (Game, Sosmed, Video, Browsing, Download)',
    icon: <Activity className="w-4 h-4 text-rose-600" />,
  },

  // Category 1: Route, Mangle, NAT & VPN (16 tools)
  {
    id: 'lb-pcc',
    name: 'Load Balancing PCC',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Per Connection Classifier multi-WAN balancing',
    icon: <Network className="w-4 h-4 text-orange-600" />,
  },
  {
    id: 'lb-nth',
    name: 'Load Balancing NTH',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Round-robin packet / connection counter balancing',
    icon: <Layers className="w-4 h-4 text-amber-600" />,
  },
  {
    id: 'lb-ecmp',
    name: 'Load Balancing ECMP',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Equal Cost Multi-Path multi-gateway route',
    icon: <ArrowRightLeft className="w-4 h-4 text-blue-600" />,
  },
  {
    id: 'failover-recursive',
    name: 'Failover Recursive Gateway',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'DNS check (8.8.8.8 / 1.1.1.1) recursive gateway failover',
    icon: <Radio className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: 'games-raw',
    name: 'Games Static Routing (Filter Raw)',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Route game traffic with low CPU Raw filter address-list',
    icon: <Gamepad2 className="w-4 h-4 text-purple-600" />,
  },
  {
    id: 'games-mangle',
    name: 'Games Static Routing (Mangle Port)',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Port-based game traffic steering to dedicated ISP',
    icon: <Gamepad2 className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: 'website-routing',
    name: 'Website Static Routing',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Route Perbankan, DJP Online, Zoom ke ISP khusus',
    icon: <Globe className="w-4 h-4 text-teal-600" />,
  },
  {
    id: 'client-ip-routing',
    name: 'Local Client IP Static Routing',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Policy Based Routing untuk IP Client / Subnet VIP',
    icon: <Sliders className="w-4 h-4 text-cyan-600" />,
  },
  {
    id: 'port-tcp-udp-routing',
    name: 'Port TCP/UDP Static Routing',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Route traffic berdasarkan nomor port TCP atau UDP',
    icon: <Sliders className="w-4 h-4 text-sky-600" />,
  },
  {
    id: 'social-media-routing',
    name: 'Static Routing Youtube, Tiktok, FB, WA',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Pisahkan trafik sosmed & streaming ke ISP cadangan',
    icon: <Share2 className="w-4 h-4 text-rose-600" />,
  },
  {
    id: 'port-forwarding',
    name: 'Port Forwarding with NAT',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'DST-NAT untuk CCTV, Web Server, Winbox + Hairpin NAT',
    icon: <Shield className="w-4 h-4 text-green-600" />,
  },
  {
    id: 'remote-access-isp',
    name: 'Remote Access ISP "Public IP Static"',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Filter aman remote Winbox/WebFig & Multi-WAN reply rule',
    icon: <Lock className="w-4 h-4 text-slate-700" />,
  },
  {
    id: 'vpn-all-traffic',
    name: 'All Traffic to VPN Tunnel',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Arahkan seluruh internet ke VPN + proteksi Kill-Switch',
    icon: <Server className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: 'vpn-port-games',
    name: 'VPN Routing Port Games',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Kirim hanya port game online ke tunnel VPN gaming',
    icon: <Key className="w-4 h-4 text-violet-600" />,
  },
  {
    id: 'vpn-ip-games',
    name: 'VPN Routing IP Address Games',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Route IP Address game server melalui tunnel VPN',
    icon: <Gamepad2 className="w-4 h-4 text-fuchsia-600" />,
  },
  {
    id: 'vpn-remote-client',
    name: 'VPN Remote SSTP - L2TP - PPTP - OVPN',
    category: 'route-mangle-nat-vpn',
    shortDesc: 'Client dialer untuk remote Mikrotik & Mikhmon Online',
    icon: <Server className="w-4 h-4 text-blue-700" />,
  },

  // Category 2: Hotspot // PPPoE // PPP (7 tools)
  {
    id: 'hotspot-qr-code',
    name: 'Free Hotspot Wi-Fi QR Code Template',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Format payload QR Code Wi-Fi & walled garden scanner',
    icon: <QrCode className="w-4 h-4 text-blue-600" />,
  },
  {
    id: 'hotspot-user-gen',
    name: 'Hotspot Username Password Generator',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Batch generator voucher akun Hotspot acak / prefix',
    icon: <Users className="w-4 h-4 text-teal-600" />,
  },
  {
    id: 'hotspot-block-sharing-ttl',
    name: 'Block Sharing Hotspot with "Change TTL"',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Anti-tethering Hotspot mengunci nilai TTL paket',
    icon: <Ban className="w-4 h-4 text-red-600" />,
  },
  {
    id: 'hotspot-bandwidth-up-to',
    name: 'Bandwidth Share Up-To for Hotspot',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'PCQ dynamic queue pembagian kuota bandwidth merata',
    icon: <Gauge className="w-4 h-4 text-amber-600" />,
  },
  {
    id: 'hotspot-config-wizard',
    name: 'Easy Hotspot Configuration Wizard',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Wizard skrip lengkap setup Hotspot server, pool & DHCP',
    icon: <Wand2 className="w-4 h-4 text-purple-600" />,
  },
  {
    id: 'hotspot-expired-notif',
    name: 'Expired Notification Hotspot + PPPoE',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Isolir redirect ke web pemberitahuan tagihan jatuh tempo',
    icon: <Bell className="w-4 h-4 text-rose-600" />,
  },
  {
    id: 'ppp-secrets-gen',
    name: 'PPP Secrets Username Password Generator',
    category: 'hotspot-pppoe-ppp',
    shortDesc: 'Batch generator akun pelanggan PPPoE / L2TP / SSTP',
    icon: <FileKey className="w-4 h-4 text-indigo-600" />,
  },

  // Category 3: DNS // NETWATCH // INTERFACE // MAC // DHCP (5 tools)
  {
    id: 'dns-doh',
    name: 'DNS over HTTPS (DoH) Servers',
    category: 'dns-netwatch-dhcp',
    shortDesc: 'DoH terenkripsi Cloudflare, Google, AdGuard, NextDNS',
    icon: <Shield className="w-4 h-4 text-sky-600" />,
  },
  {
    id: 'bonding-interface',
    name: 'Bonding Interface / Link Aggregation',
    category: 'dns-netwatch-dhcp',
    shortDesc: 'Agregasi link LACP 802.3ad / balance-rr port ethernet',
    icon: <Link2 className="w-4 h-4 text-cyan-600" />,
  },
  {
    id: 'netwatch-notifications',
    name: 'Netwatch to Telegram, WA, Email, SMS',
    category: 'dns-netwatch-dhcp',
    shortDesc: 'Monitoring host otomatis kirim notifikasi Telegram / Email',
    icon: <Send className="w-4 h-4 text-blue-600" />,
  },
  {
    id: 'dhcp-rogue-protection',
    name: 'Looping / Unknown DHCP Rogue Server',
    category: 'dns-netwatch-dhcp',
    shortDesc: 'Proteksi loop kabel dan deteksi DHCP server liar di LAN',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  },
  {
    id: 'mac-random-change',
    name: 'Change or Random Mac Address Interface',
    category: 'dns-netwatch-dhcp',
    shortDesc: 'Kloning atau acak MAC Address untuk bypass binding ISP',
    icon: <Binary className="w-4 h-4 text-emerald-600" />,
  },

  // Category 4: PROTECTION // BLOCK // BACKUP (7 tools)
  {
    id: 'hide-routerboard-isp',
    name: 'MikroTik Ninja: Hide Routerboard from ISP',
    category: 'protection-block-backup',
    shortDesc: 'Sembunyikan identitas router, MNDP, MAC, TTL dari ISP',
    icon: <EyeOff className="w-4 h-4 text-slate-800" />,
  },
  {
    id: 'port-knocking-icmp',
    name: 'Port Knocking with ICMP + Packet Size',
    category: 'protection-block-backup',
    shortDesc: 'Buka port Winbox/SSH dengan ketukan ukuran paket ping',
    icon: <DoorClosed className="w-4 h-4 text-orange-700" />,
  },
  {
    id: 'advanced-router-protection',
    name: 'Advanced MikroTik Router-OS Protection',
    category: 'protection-block-backup',
    shortDesc: 'Proteksi SYN flood, port scan, brute force blacklist',
    icon: <ShieldAlert className="w-4 h-4 text-red-600" />,
  },
  {
    id: 'block-websites-gen',
    name: 'Block Websites Generator',
    category: 'protection-block-backup',
    shortDesc: 'Blokir situs judi online, pornografi, malware, mining',
    icon: <Ban className="w-4 h-4 text-rose-700" />,
  },
  {
    id: 'auto-backup-email',
    name: 'MikroTik Auto Backup to E-Mail',
    category: 'protection-block-backup',
    shortDesc: 'Jadwal otomatis backup .backup & .rsc ke email admin',
    icon: <Mail className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: 'mangle-obfuscator',
    name: 'Mangle Chain Obfuscator / Encryption',
    category: 'protection-block-backup',
    shortDesc: 'Pengabur dan pembersih komentar skrip mangle',
    icon: <FileCode className="w-4 h-4 text-purple-700" />,
  },
  {
    id: 'block-social-streaming',
    name: 'Block For Youtube, Tiktok, WA, FB, etc.',
    category: 'protection-block-backup',
    shortDesc: 'Filter pemblokiran sosmed & streaming di jam kerja/sekolah',
    icon: <Ban className="w-4 h-4 text-amber-700" />,
  },

  // Category 5: ROUTER-OS OTHER TOOLS (4 tools)
  {
    id: 'pcc-calculator',
    name: 'Load Balancing PCC Calculation',
    category: 'routeros-other-tools',
    shortDesc: 'Kalkulator pembagi divisor & rasio jalur multi-WAN',
    icon: <Calculator className="w-4 h-4 text-blue-600" />,
  },
  {
    id: 'indonesia-ntp-clock',
    name: 'Indonesia Time Zone NTP/SNTP Client',
    category: 'routeros-other-tools',
    shortDesc: 'Pengaturan jam sistem WIB/WITA/WIT & NTP pool Indonesia',
    icon: <Clock className="w-4 h-4 text-emerald-600" />,
  },
  {
    id: 'ip-calculator',
    name: 'Mikrotik IP Address Calculator',
    category: 'routeros-other-tools',
    shortDesc: 'Kalkulator subnet CIDR, netmask, host min/max & broadcast',
    icon: <Calculator className="w-4 h-4 text-indigo-600" />,
  },
  {
    id: 'wifi-id-autologin',
    name: 'Wifi.id WMS and Seamless Auto Login',
    category: 'routeros-other-tools',
    shortDesc: 'Skrip keepalive auto login portal @wifi.id & WMS 24 jam',
    icon: <Wifi className="w-4 h-4 text-rose-600" />,
  },
];

export const MikroTikToolsPage: React.FC<MikroTikToolsPageProps> = ({ addToast }) => {
  const [selectedToolId, setSelectedToolId] = useState<MikroTikToolId>('lb-pcc');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ToolCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rosVersion, setRosVersion] = useState<RouterOSVersion>('v7');
  const [terminalTheme, setTerminalTheme] = useState<'light' | 'dark'>('light');
  const [copied, setCopied] = useState<boolean>(false);

  // Common Multi-WAN State (used by PCC, NTH, ECMP)
  const [wans, setWans] = useState<WanLine[]>([
    { id: '1', name: 'WAN1', interface: 'ether1-ISP1', gateway: '192.168.1.1', distance: 1, weight: 1, speed: 100, targetDns: '8.8.8.8' },
    { id: '2', name: 'WAN2', interface: 'ether2-ISP2', gateway: '192.168.2.1', distance: 2, weight: 1, speed: 200, targetDns: '1.1.1.1' },
  ]);

  // PCC state
  const [pccLanInterface, setPccLanInterface] = useState<string>('ether3-LAN');
  const [pccLanSubnet, setPccLanSubnet] = useState<string>('192.168.88.0/24');
  const [pccClassifier, setPccClassifier] = useState<PCCConfig['pccClassifier']>('both-addresses-and-ports');

  // NTH state
  const [nthLanInterface, setNthLanInterface] = useState<string>('ether3-LAN');
  const [nthLanSubnet, setNthLanSubnet] = useState<string>('192.168.88.0/24');

  // ECMP state
  const [ecmpCheckGateway, setEcmpCheckGateway] = useState<'ping' | 'arp' | 'none'>('ping');

  // Recursive Failover state
  const [failoverPrimaryTarget, setFailoverPrimaryTarget] = useState<string>('8.8.8.8');
  const [failoverSecondaryTarget, setFailoverSecondaryTarget] = useState<string>('1.1.1.1');

  // Games Routing state
  const [gameLanInterface, setGameLanInterface] = useState<string>('ether3-LAN');
  const [gameTargetWan, setGameTargetWan] = useState<string>('WAN1');
  const [gameTargetGateway, setGameTargetGateway] = useState<string>('192.168.1.1');
  const [gameRoutingMark, setGameRoutingMark] = useState<string>('GAMES_TRAFFIC');
  const [selectedGames, setSelectedGames] = useState<string[]>(['mlbb', 'ff', 'valorant', 'pubgm']);
  const [customGameTcp, setCustomGameTcp] = useState<string>('');
  const [customGameUdp, setCustomGameUdp] = useState<string>('');

  // Website Routing state
  const [webLanInterface, setWebLanInterface] = useState<string>('ether3-LAN');
  const [webTargetWan, setWebTargetWan] = useState<string>('WAN1');
  const [webTargetGateway, setWebTargetGateway] = useState<string>('192.168.1.1');
  const [webRoutingMark, setWebRoutingMark] = useState<string>('WEBSITES_TRAFFIC');
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>(['bank_bca', 'bank_mandiri', 'pajak_djp']);
  const [customWebDomains, setCustomWebDomains] = useState<string>('');

  // Client IP Routing state
  const [clientLanInterface, setClientLanInterface] = useState<string>('ether3-LAN');
  const [clientTargetWan, setClientTargetWan] = useState<string>('WAN2');
  const [clientTargetGateway, setClientTargetGateway] = useState<string>('192.168.2.1');
  const [clientRoutingMark, setClientRoutingMark] = useState<string>('VIP_CLIENTS_ROUTE');
  const [clientIpList, setClientIpList] = useState<string>('192.168.88.50, 192.168.88.100-192.168.88.120');
  const [clientDesc, setClientDesc] = useState<string>('Ruang Direktur & Server');

  // Port Forwarding state
  const [pfWanInterface, setPfWanInterface] = useState<string>('ether1-ISP1');
  const [pfPublicIp, setPfPublicIp] = useState<string>('');
  const [pfProtocol, setPfProtocol] = useState<'tcp' | 'udp' | 'both'>('tcp');
  const [pfExternalPort, setPfExternalPort] = useState<string>('8080');
  const [pfInternalIp, setPfInternalIp] = useState<string>('192.168.88.50');
  const [pfInternalPort, setPfInternalPort] = useState<string>('80');
  const [pfComment, setPfComment] = useState<string>('Web Server Internal');
  const [pfHairpin, setPfHairpin] = useState<boolean>(true);
  const [pfLanSubnet, setPfLanSubnet] = useState<string>('192.168.88.0/24');

  // Port Routing state
  const [prLanInterface, setPrLanInterface] = useState<string>('ether3-LAN');
  const [prTargetWan, setPrTargetWan] = useState<string>('WAN1');
  const [prTargetGateway, setPrTargetGateway] = useState<string>('192.168.1.1');
  const [prRoutingMark, setPrRoutingMark] = useState<string>('PORTS_TRAFFIC');
  const [prProtocol, setPrProtocol] = useState<'tcp' | 'udp' | 'both'>('tcp');
  const [prPorts, setPrPorts] = useState<string>('80,443,8080');
  const [prDesc, setPrDesc] = useState<string>('Browsing HTTP/HTTPS');

  // All Traffic to VPN state
  const [vpnTunnelInterface, setVpnTunnelInterface] = useState<string>('wireguard1');
  const [vpnLanInterface, setVpnLanInterface] = useState<string>('ether3-LAN');
  const [vpnServerEndpoint, setVpnServerEndpoint] = useState<string>('103.150.200.5');
  const [vpnKillSwitch, setVpnKillSwitch] = useState<boolean>(true);
  const [vpnClientSubnet, setVpnClientSubnet] = useState<string>('');

  // Remote Access state
  const [raWanInterface, setRaWanInterface] = useState<string>('ether1-ISP1');
  const [raWanGateway, setRaWanGateway] = useState<string>('192.168.1.1');
  const [raAllowedIps, setRaAllowedIps] = useState<string>('');
  const [raWinbox, setRaWinbox] = useState<boolean>(true);
  const [raWinboxPort, setRaWinboxPort] = useState<string>('8291');
  const [raWebfig, setRaWebfig] = useState<boolean>(true);
  const [raWebfigPort, setRaWebfigPort] = useState<string>('80,443');
  const [raSSH, setRaSSH] = useState<boolean>(false);
  const [raSSHPort, setRaSSHPort] = useState<string>('22');
  const [raApi, setRaApi] = useState<boolean>(false);
  const [raApiPort, setRaApiPort] = useState<string>('8728');
  const [raMangleReply, setRaMangleReply] = useState<boolean>(true);

  // VPN Games state
  const [vpnGamesInterface, setVpnGamesInterface] = useState<string>('ovpn-gaming');
  const [vpnGamesRoutingMark, setVpnGamesRoutingMark] = useState<string>('VPN_GAMES_TRAFFIC');
  const [vpnGamesSelected, setVpnGamesSelected] = useState<string[]>(['mlbb', 'ff', 'valorant']);
  const [vpnGameCustomIps, setVpnGameCustomIps] = useState<string>('103.28.54.0/24, 103.28.55.0/24');

  // VPN Remote Client state
  const [vrcType, setVrcType] = useState<VPNRemoteClientConfig['vpnType']>('sstp');
  const [vrcServer, setVrcServer] = useState<string>('id1.tunnel.my.id');
  const [vrcPort, setVrcPort] = useState<string>('443');
  const [vrcUser, setVrcUser] = useState<string>('mikrotik_client');
  const [vrcPass, setVrcPass] = useState<string>('rahasia123');
  const [vrcProfile, setVrcProfile] = useState<string>('default-encryption');
  const [vrcInterface, setVrcInterface] = useState<string>('sstp-out1');
  const [vrcWgClientIp, setVrcWgClientIp] = useState<string>('10.200.0.2/24');
  const [vrcWgPrivKey, setVrcWgPrivKey] = useState<string>('');
  const [vrcWgServerPubKey, setVrcWgServerPubKey] = useState<string>('');

  // Social Media state
  const [smLanInterface, setSmLanInterface] = useState<string>('ether3-LAN');
  const [smTargetWan, setSmTargetWan] = useState<string>('WAN2');
  const [smTargetGateway, setSmTargetGateway] = useState<string>('192.168.2.1');
  const [smRoutingMark, setSmRoutingMark] = useState<string>('SOSMED_TRAFFIC');
  const [smSelected, setSmSelected] = useState<string[]>(['youtube', 'tiktok', 'facebook_meta', 'whatsapp']);
  const [smCustomDomains, setSmCustomDomains] = useState<string>('');

  // 17. Hotspot QR Code state
  const [qrSsid, setQrSsid] = useState<string>('Cafe_Free_WiFi');
  const [qrEncryption, setQrEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [qrPassword, setQrPassword] = useState<string>('kopi12345');
  const [qrHidden, setQrHidden] = useState<boolean>(false);
  const [qrLoginUrl, setQrLoginUrl] = useState<string>('http://192.168.88.1/login');
  const [qrServerName, setQrServerName] = useState<string>('hotspot1');

  // 18. Hotspot User Gen state
  const [huServer, setHuServer] = useState<string>('all');
  const [huProfile, setHuProfile] = useState<string>('Voucher2Jam');
  const [huPrefix, setHuPrefix] = useState<string>('vc-');
  const [huCount, setHuCount] = useState<number>(10);
  const [huType, setHuType] = useState<'same' | 'different'>('same');
  const [huCharType, setHuCharType] = useState<'numeric' | 'alphanumeric' | 'lowercase'>('numeric');
  const [huLength, setHuLength] = useState<number>(4);
  const [huUptime, setHuUptime] = useState<string>('2h');
  const [huComment, setHuComment] = useState<string>('Voucher 2 Jam Rp 3000');

  // 19. Block Sharing TTL state
  const [ttlHotspotInterface, setTtlHotspotInterface] = useState<string>('ether3-Hotspot');
  const [ttlValue, setTtlValue] = useState<number>(1);
  const [ttlChain, setTtlChain] = useState<'postrouting' | 'prerouting'>('postrouting');
  const [ttlComment, setTtlComment] = useState<string>('Anti-Tethering Hotspot (TTL 1)');

  // 20. Bandwidth Share Up-To PCQ state
  const [pcqQueueName, setPcqQueueName] = useState<string>('Hotspot_UpTo_50M');
  const [pcqTargetSubnet, setPcqTargetSubnet] = useState<string>('192.168.88.0/24');
  const [pcqTotalDown, setPcqTotalDown] = useState<string>('50M');
  const [pcqTotalUp, setPcqTotalUp] = useState<string>('20M');
  const [pcqMaxClientRate, setPcqMaxClientRate] = useState<string>('10M');

  // 21. Hotspot Wizard state
  const [wizIface, setWizIface] = useState<string>('ether3-Hotspot');
  const [wizIp, setWizIp] = useState<string>('192.168.20.1/24');
  const [wizPool, setWizPool] = useState<string>('192.168.20.10-192.168.20.250');
  const [wizDns, setWizDns] = useState<string>('hotspot.lan');
  const [wizAdminUser, setWizAdminUser] = useState<string>('admin');
  const [wizAdminPass, setWizAdminPass] = useState<string>('admin123');
  const [wizRateLimit, setWizRateLimit] = useState<string>('5M/5M');
  const [wizShared, setWizShared] = useState<number>(1);

  // 22. Expired Notification state
  const [expService, setExpService] = useState<'hotspot' | 'pppoe' | 'both'>('both');
  const [expRedirectUrl, setExpRedirectUrl] = useState<string>('http://billing.isp.net/isolir.html');
  const [expProxyPort, setExpProxyPort] = useState<string>('8080');
  const [expAddressList, setExpAddressList] = useState<string>('ISOLIR_CLIENTS');

  // 23. PPP Secrets Gen state
  const [pppService, setPppService] = useState<'pppoe' | 'l2tp' | 'sstp' | 'ovpn' | 'any'>('pppoe');
  const [pppProfile, setPppProfile] = useState<string>('profile-50m');
  const [pppPrefix, setPppPrefix] = useState<string>('user_');
  const [pppCount, setPppCount] = useState<number>(10);
  const [pppLength, setPppLength] = useState<number>(5);
  const [pppRemoteIpPrefix, setPppRemoteIpPrefix] = useState<string>('10.10.10.');
  const [pppComment, setPppComment] = useState<string>('Pelanggan Rumahan');

  // 24. DoH state
  const [dohProvider, setDohProvider] = useState<'cloudflare' | 'google' | 'adguard' | 'nextdns' | 'custom'>('cloudflare');
  const [dohUrl, setDohUrl] = useState<string>('https://cloudflare-dns.com/dns-query');
  const [dohFallback, setDohFallback] = useState<string>('1.1.1.1,8.8.8.8');
  const [dohVerifyCert, setDohVerifyCert] = useState<boolean>(true);

  // 25. Bonding state
  const [bondName, setBondName] = useState<string>('bonding1');
  const [bondSlaves, setBondSlaves] = useState<string>('ether1,ether2');
  const [bondMode, setBondMode] = useState<any>('802.3ad');
  const [bondLacpRate, setBondLacpRate] = useState<'1sec' | '30sec'>('1sec');
  const [bondHashPolicy, setBondHashPolicy] = useState<'layer-2' | 'layer-2-and-3' | 'layer-3-and-4'>('layer-2-and-3');
  const [bondIp, setBondIp] = useState<string>('10.0.0.1/30');

  // 26. Netwatch state
  const [netHostIp, setNetHostIp] = useState<string>('8.8.8.8');
  const [netHostName, setNetHostName] = useState<string>('Google_DNS');
  const [netInterval, setNetInterval] = useState<string>('30s');
  const [netTimeout, setNetTimeout] = useState<string>('1000ms');
  const [netChannel, setNetChannel] = useState<'telegram' | 'whatsapp' | 'email'>('telegram');
  const [netTgToken, setNetTgToken] = useState<string>('1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ');
  const [netTgChatId, setNetTgChatId] = useState<string>('123456789');
  const [netEmail, setNetEmail] = useState<string>('noc@isp.net');

  // 27. Rogue DHCP state
  const [rdLanIface, setRdLanIface] = useState<string>('bridge-LAN');
  const [rdValidMac, setRdValidMac] = useState<string>('00:0C:42:XX:XX:XX');
  const [rdAlertTimeout, setRdAlertTimeout] = useState<string>('1h');
  const [rdAction, setRdAction] = useState<'alert' | 'block' | 'both'>('both');

  // 28. MAC Address Change state
  const [macIface, setMacIface] = useState<string>('ether1');
  const [macAddress, setMacAddress] = useState<string>('B8:69:F4:A1:B2:C3');

  // 29. Hide Routerboard Ninja state
  const [ninjaWan, setNinjaWan] = useState<string>('ether1-ISP1');
  const [ninjaLan, setNinjaLan] = useState<string>('ether2-LAN');
  const [ninjaMndp, setNinjaMndp] = useState<boolean>(true);
  const [ninjaMacServer, setNinjaMacServer] = useState<boolean>(true);
  const [ninjaBwServer, setNinjaBwServer] = useState<boolean>(true);
  const [ninjaBlockTraceroute, setNinjaBlockTraceroute] = useState<boolean>(true);
  const [ninjaNormalTTL, setNinjaNormalTTL] = useState<boolean>(true);

  // 30. Port Knocking state
  const [pkWan, setPkWan] = useState<string>('ether1-ISP1');
  const [pkPort, setPkPort] = useState<string>('8291');
  const [pkSize1, setPkSize1] = useState<number>(128);
  const [pkSize2, setPkSize2] = useState<number>(256);
  const [pkTimeout, setPkTimeout] = useState<string>('30s');
  const [pkDuration, setPkDuration] = useState<string>('1h');

  // 31. Advanced Protection state
  const [apWan, setApWan] = useState<string>('ether1-ISP1');
  const [apLan, setApLan] = useState<string>('ether2-LAN');
  const [apDropInvalid, setApDropInvalid] = useState<boolean>(true);
  const [apSynFlood, setApSynFlood] = useState<boolean>(true);
  const [apPortScanners, setApPortScanners] = useState<boolean>(true);
  const [apWinboxBrute, setApWinboxBrute] = useState<boolean>(true);
  const [apSshBrute, setApSshBrute] = useState<boolean>(true);
  const [apDnsResolver, setApDnsResolver] = useState<boolean>(true);

  // 32. Block Websites state
  const [bwLan, setBwLan] = useState<string>('ether3-LAN');
  const [bwCategories, setBwCategories] = useState<Array<'gambling' | 'pornography' | 'crypto_mining' | 'piracy'>>([
    'gambling',
    'pornography',
  ]);
  const [bwCustomDomains, setBwCustomDomains] = useState<string>('badsite.org, spammer.xyz');
  const [bwMethod, setBwMethod] = useState<'address-list' | 'tls-host' | 'dns-static'>('address-list');

  // 33. Auto Backup Email state
  const [bkEmail, setBkEmail] = useState<string>('backup-router@isp.net');
  const [bkPass, setBkPass] = useState<string>('SecretBackup123');
  const [bkExportRsc, setBkExportRsc] = useState<boolean>(true);
  const [bkTime, setBkTime] = useState<string>('02:00:00');
  const [bkInterval, setBkInterval] = useState<'1d' | '7d' | '30d'>('1d');

  // 34. Mangle Obfuscator state
  const [obfScript, setObfScript] = useState<string>(
    '/ip firewall mangle\nadd chain=prerouting in-interface=ether3-LAN action=mark-connection new-connection-mark=ISP1_conn comment="Route to ISP1"'
  );
  const [obfStripComments, setObfStripComments] = useState<boolean>(true);
  const [obfDecoyRules, setObfDecoyRules] = useState<boolean>(true);

  // 35. Block Social Media state
  const [bsmLan, setBsmLan] = useState<string>('ether3-LAN');
  const [bsmPlatforms, setBsmPlatforms] = useState<string[]>(['youtube', 'tiktok']);
  const [bsmStart, setBsmStart] = useState<string>('08:00:00');
  const [bsmEnd, setBsmEnd] = useState<string>('17:00:00');
  const [bsmDays, setBsmDays] = useState<string>('mon,tue,wed,thu,fri');

  // 36. PCC Calculator state
  const [pccSpeed1, setPccSpeed1] = useState<number>(100);
  const [pccSpeed2, setPccSpeed2] = useState<number>(50);
  const [pccSpeed3, setPccSpeed3] = useState<number>(0);
  const [pccSpeed4, setPccSpeed4] = useState<number>(0);

  // 37. Indonesia NTP state
  const [ntpTimezone, setNtpTimezone] = useState<'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'>('Asia/Jakarta');
  const [ntpServers, setNtpServers] = useState<string>('id.pool.ntp.org, 0.id.pool.ntp.org, 1.id.pool.ntp.org');

  // 38. IP Calculator state
  const [calcIpCidr, setCalcIpCidr] = useState<string>('192.168.10.1/24');
  const [calcIface, setCalcIface] = useState<string>('ether2');

  // 39. Wifi.id Auto Login state
  const [wifiLoginType, setWifiLoginType] = useState<'wifi_id' | 'wms' | 'seamless'>('wifi_id');
  const [wifiUser, setWifiUser] = useState<string>('9912345678');
  const [wifiPass, setWifiPass] = useState<string>('rahasiaWifi123');
  const [wifiWan, setWifiWan] = useState<string>('wlan1');
  const [wifiInterval, setWifiInterval] = useState<string>('2m');

  // === Category: Simple Queue // Queue Tree // Queue Type (7 tools) ===
  // 1. Burst Limit Calculator state
  const [burstTargetName, setBurstTargetName] = useState<string>('Client-1');
  const [burstTargetIp, setBurstTargetIp] = useState<string>('192.168.88.10');
  const [burstMaxLimitUp, setBurstMaxLimitUp] = useState<string>('1M');
  const [burstMaxLimitDown, setBurstMaxLimitDown] = useState<string>('5M');
  const [burstBonusDurationUp, setBurstBonusDurationUp] = useState<number>(8);
  const [burstBonusDurationDown, setBurstBonusDurationDown] = useState<number>(16);
  const [burstLimitUp, setBurstLimitUp] = useState<string>('2M');
  const [burstLimitDown, setBurstLimitDown] = useState<string>('10M');

  // 2. PCQ Burst Rate + Queue Size state
  const [pcqCalcName, setPcqCalcName] = useState<string>('pcq-clients');
  const [pcqCalcTotalClient, setPcqCalcTotalClient] = useState<number>(50);
  const [pcqCalcRate, setPcqCalcRate] = useState<string>('5M');
  const [pcqCalcBurstRate, setPcqCalcBurstRate] = useState<string>('10M');
  const [pcqCalcActualDuration, setPcqCalcActualDuration] = useState<number>(16);

  // 3. Simple Queue + Token Bucket state
  const [sqtbQueueName, setSqtbQueueName] = useState<string>('Client-TokenBucket');
  const [sqtbTargetIp, setSqtbTargetIp] = useState<string>('192.168.88.20');
  const [sqtbMaxLimitUp, setSqtbMaxLimitUp] = useState<string>('2M');
  const [sqtbMaxLimitDown, setSqtbMaxLimitDown] = useState<string>('10M');
  const [sqtbBucketSizeUp, setSqtbBucketSizeUp] = useState<number>(0.1);
  const [sqtbBucketSizeDown, setSqtbBucketSizeDown] = useState<number>(0.1);
  const [sqtbQueueType, setSqtbQueueType] = useState<string>('default-small');

  // 4. Simple Queue + Bandwidth Shared Up-To state
  const [sqsuParentName, setSqsuParentName] = useState<string>('Total-Bandwidth-Kantor');
  const [sqsuTargetSubnet, setSqsuTargetSubnet] = useState<string>('192.168.88.0/24');
  const [sqsuTotalParentUpload, setSqsuTotalParentUpload] = useState<string>('20M');
  const [sqsuTotalParentDownload, setSqsuTotalParentDownload] = useState<string>('100M');
  const [sqsuTotalClients, setSqsuTotalClients] = useState<number>(20);
  const [sqsuClientPrefix, setSqsuClientPrefix] = useState<string>('Client');
  const [sqsuClientSubnetPrefix, setSqsuClientSubnetPrefix] = useState<string>('192.168.88.');
  const [sqsuClientStartIp, setSqsuClientStartIp] = useState<number>(2);
  const [sqsuAutoLimitAt, setSqsuAutoLimitAt] = useState<boolean>(true);

  // 5. Queue Tree + Bandwidth Shared Up-To state
  const [qtsuParentUpload, setQtsuParentUpload] = useState<string>('20M');
  const [qtsuParentDownload, setQtsuParentDownload] = useState<string>('100M');
  const [qtsuWanInterface, setQtsuWanInterface] = useState<string>('ether1-ISP1');
  const [qtsuLanInterface, setQtsuLanInterface] = useState<string>('bridge-LAN');
  const [qtsuTotalClients, setQtsuTotalClients] = useState<number>(10);
  const [qtsuClientSubnetPrefix, setQtsuClientSubnetPrefix] = useState<string>('192.168.88.');
  const [qtsuClientStartIp, setQtsuClientStartIp] = useState<number>(2);
  const [qtsuAutoLimitAt, setQtsuAutoLimitAt] = useState<boolean>(true);

  // 6. PCQ for Queue Tree & Queue Simple state
  const [pcqTargetType, setPcqTargetType] = useState<'queue-tree' | 'queue-simple'>('queue-tree');
  const [pcqParentDownload, setPcqParentDownload] = useState<string>('50M');
  const [pcqParentUpload, setPcqParentUpload] = useState<string>('10M');
  const [pcqLanInterface, setPcqLanInterface] = useState<string>('bridge-LAN');
  const [pcqWanInterface, setPcqWanInterface] = useState<string>('ether1-ISP1');
  const [pcqClientSubnet, setPcqClientSubnet] = useState<string>('192.168.88.0/24');
  const [pcqRateMode, setPcqRateMode] = useState<'auto-equal' | 'fixed'>('auto-equal');
  const [pcqRateDownload, setPcqRateDownload] = useState<string>('5M');
  const [pcqRateUpload, setPcqRateUpload] = useState<string>('1M');

  // 7. QoS Priority state
  const [qosLanInterface, setQosLanInterface] = useState<string>('bridge-LAN');
  const [qosWanInterface, setQosWanInterface] = useState<string>('ether1-ISP1');
  const [qosTotalDownload, setQosTotalDownload] = useState<string>('50M');
  const [qosTotalUpload, setQosTotalUpload] = useState<string>('10M');
  const [qosSelectedServices, setQosSelectedServices] = useState<string[]>([
    'whatsapp',
    'game_mobile_legends',
    'game_free_fire',
    'youtube',
    'tiktok',
    'facebook',
    'instagram',
    'zoom',
  ]);
  const [qosMode, setQosMode] = useState<'complete' | 'step1_fetch' | 'step2_import'>('complete');
  const [qosGithubRawUrl, setQosGithubRawUrl] = useState<string>(
    'https://raw.githubusercontent.com/buananetpbun/mikrotik-script/main/qos-address-list.rsc'
  );

  // Memoized live calculation results for instant UI updates
  const burstCalcResult = useMemo(() => {
    return calculateBurstMetrics(
      burstMaxLimitUp,
      burstLimitUp,
      burstBonusDurationUp,
      burstMaxLimitDown,
      burstLimitDown,
      burstBonusDurationDown
    );
  }, [
    burstMaxLimitUp,
    burstMaxLimitDown,
    burstBonusDurationUp,
    burstBonusDurationDown,
    burstLimitUp,
    burstLimitDown,
  ]);

  const pcqCalcResult = useMemo(() => {
    return calculatePCQMetrics(
      pcqCalcTotalClient,
      50,
      pcqCalcRate,
      pcqCalcBurstRate,
      pcqCalcActualDuration
    );
  }, [pcqCalcTotalClient, pcqCalcRate, pcqCalcBurstRate, pcqCalcActualDuration]);

  // Helper functions
  const handleAddWan = () => {
    const nextIdx = wans.length + 1;
    const newWan: WanLine = {
      id: String(Date.now()),
      name: `WAN${nextIdx}`,
      interface: `ether${nextIdx}-ISP${nextIdx}`,
      gateway: `192.168.${nextIdx}.1`,
      distance: nextIdx,
      weight: 1,
      speed: 100,
      targetDns: nextIdx === 3 ? '208.67.222.222' : '9.9.9.9',
    };
    setWans([...wans, newWan]);
  };

  const handleRemoveWan = (id: string) => {
    if (wans.length <= 2) {
      addToast?.('error', 'Peringatan', 'Minimal harus ada 2 WAN lines untuk Load Balancing.');
      return;
    }
    setWans(wans.filter((w) => w.id !== id));
  };

  const handleUpdateWan = (id: string, field: keyof WanLine, val: string | number) => {
    setWans(
      wans.map((w) => {
        if (w.id === id) {
          return { ...w, [field]: val };
        }
        return w;
      })
    );
  };

  // Generate random MAC address
  const handleGenerateRandomMac = () => {
    const hex = '0123456789ABCDEF';
    let mac = 'B8:69:F4'; // Popular MikroTik OUI prefix
    for (let i = 0; i < 3; i++) {
      const b1 = hex.charAt(Math.floor(Math.random() * hex.length));
      const b2 = hex.charAt(Math.floor(Math.random() * hex.length));
      mac += `:${b1}${b2}`;
    }
    setMacAddress(mac);
    addToast?.('info', 'MAC Diperbarui', `MAC Address baru: ${mac}`);
  };

  // PCC Bandwidth Ratio & Divisor Calculation
  const pccRatioInfo = useMemo(() => computePCCRatio(wans), [wans]);

  // Generate output script dynamically based on active tool
  const generatedScript = useMemo<string>(() => {
    switch (selectedToolId) {
      // 0. Simple Queue // Queue Tree // Queue Type (7 tools)
      case 'burst-limit-calc':
        return generateBurstLimitScript({
          rosVersion,
          upMaxLimit: burstMaxLimitUp,
          upBurstLimit: burstLimitUp,
          upBonusDuration: burstBonusDurationUp,
          downMaxLimit: burstMaxLimitDown,
          downBurstLimit: burstLimitDown,
          downBonusDuration: burstBonusDurationDown,
          targetSubnet: burstTargetIp,
          queueName: burstTargetName,
        });

      case 'pcq-burst-queue-size-calc':
        return generatePCQBurstQueueSizeScript({
          rosVersion,
          totalClient: pcqCalcTotalClient,
          queueSize: 50,
          maxRate: pcqCalcRate,
          burstRate: pcqCalcBurstRate,
          actualBurstTime: pcqCalcActualDuration,
          queueName: pcqCalcName,
        });

      case 'simple-queue-token-bucket':
        return generateSimpleQueueTokenBucketScript({
          rosVersion,
          parentName: 'Total-Bandwidth',
          parentTarget: '192.168.88.0/24',
          parentUpMax: '20M',
          parentDownMax: '100M',
          clientPrefix: sqtbQueueName,
          clientInitial: 1,
          startIp: sqtbTargetIp,
          endIp: sqtbTargetIp,
          clientUpMax: sqtbMaxLimitUp,
          clientDownMax: sqtbMaxLimitDown,
          bucketSizeUp: sqtbBucketSizeUp,
          bucketSizeDown: sqtbBucketSizeDown,
        });

      case 'simple-queue-shared-upto': {
        const endHost = sqsuClientStartIp + sqsuTotalClients - 1;
        return generateSimpleQueueSharedUpToScript({
          rosVersion,
          parentName: sqsuParentName,
          parentTarget: sqsuTargetSubnet,
          parentUpMax: sqsuTotalParentUpload,
          parentDownMax: sqsuTotalParentDownload,
          clientPrefix: sqsuClientPrefix,
          clientInitial: 1,
          startIp: `${sqsuClientSubnetPrefix}${sqsuClientStartIp}`,
          endIp: `${sqsuClientSubnetPrefix}${endHost}`,
          clientUpMax: sqsuTotalParentUpload,
          clientDownMax: sqsuTotalParentDownload,
          limitAtUp: '512k',
          limitAtDown: '2M',
          autoShared: sqsuAutoLimitAt,
        });
      }

      case 'queue-tree-shared-upto': {
        const endHost = qtsuClientStartIp + qtsuTotalClients - 1;
        return generateQueueTreeSharedUpToScript({
          rosVersion,
          parentName: 'Total-Bandwidth',
          subQueueUpload: 'Upload-Shared',
          subQueueDownload: 'Download-Shared',
          parentUpMax: qtsuParentUpload,
          parentDownMax: qtsuParentDownload,
          clientPrefix: 'Client-',
          clientInitial: 1,
          startIp: `${qtsuClientSubnetPrefix}${qtsuClientStartIp}`,
          endIp: `${qtsuClientSubnetPrefix}${endHost}`,
          clientUpMax: qtsuParentUpload,
          clientDownMax: qtsuParentDownload,
          limitAtUp: '512k',
          limitAtDown: '2M',
          autoShared: qtsuAutoLimitAt,
        });
      }

      case 'pcq-tree-simple-gen':
        return generatePCQTreeSimpleScript({
          rosVersion,
          queueOption: pcqTargetType,
          parentName: 'GLOBAL-CONNECTION',
          subQueueUpload: 'Upload-Client',
          subQueueDownload: 'Download-Client',
          parentUpMax: pcqParentUpload,
          parentDownMax: pcqParentDownload,
          pcqUploadName: 'PCQ-Upload',
          pcqDownloadName: 'PCQ-Download',
          pcqUpLimit: pcqRateUpload,
          pcqDownLimit: pcqRateDownload,
          autoShared: pcqRateMode === 'auto-equal',
          localSubnets: pcqClientSubnet,
        });

      case 'queue-qos-priority': {
        const svc = qosSelectedServices[0] || 'Youtube';
        const res = generateQoSPriorityScript({
          rosVersion,
          queueOption: 'queue-tree',
          service: svc,
          queueName: `-> ${svc.toUpperCase()}`,
          priority: 3,
          maxLimit: qosTotalDownload,
          matchFilter: 'tls-host',
          localSubnets: '192.168.0.0/16,172.16.0.0/12,10.0.0.0/8',
        });
        if (qosMode === 'step1_fetch') return res.step1;
        if (qosMode === 'step2_import') return res.step2;
        return res.offlineScript;
      }

      // 1-16: Route, Mangle, NAT, VPN
      case 'lb-pcc':
        return generatePCCScript({
          rosVersion,
          lanInterface: pccLanInterface,
          lanSubnet: pccLanSubnet,
          pccClassifier,
          wans,
          addDefaultRoute: true,
          addNatMasquerade: true,
          addLocalAcceptRule: true,
        });

      case 'lb-nth':
        return generateNTHScript({
          rosVersion,
          lanInterface: nthLanInterface,
          lanSubnet: nthLanSubnet,
          wans,
          addDefaultRoute: true,
          addNatMasquerade: true,
        });

      case 'lb-ecmp':
        return generateECMPScript({
          rosVersion,
          wans,
          checkGateway: ecmpCheckGateway,
          addNatMasquerade: true,
        });

      case 'failover-recursive':
        return generateRecursiveFailoverScript({
          rosVersion,
          primaryWan: wans[0] || { id: '1', name: 'WAN1', interface: 'ether1-ISP1', gateway: '192.168.1.1', distance: 1 },
          secondaryWan: wans[1] || { id: '2', name: 'WAN2', interface: 'ether2-ISP2', gateway: '192.168.2.1', distance: 2 },
          primaryTargetDns: failoverPrimaryTarget,
          secondaryTargetDns: failoverSecondaryTarget,
          addNatMasquerade: true,
        });

      case 'games-raw':
        return generateGamesRoutingScript({
          rosVersion,
          lanInterface: gameLanInterface,
          targetWan: gameTargetWan,
          targetGateway: gameTargetGateway,
          routingMarkName: gameRoutingMark,
          method: 'raw',
          selectedGameIds: selectedGames,
          customPortsTcp: customGameTcp,
          customPortsUdp: customGameUdp,
        });

      case 'games-mangle':
        return generateGamesRoutingScript({
          rosVersion,
          lanInterface: gameLanInterface,
          targetWan: gameTargetWan,
          targetGateway: gameTargetGateway,
          routingMarkName: gameRoutingMark,
          method: 'mangle',
          selectedGameIds: selectedGames,
          customPortsTcp: customGameTcp,
          customPortsUdp: customGameUdp,
        });

      case 'website-routing': {
        const customArr = customWebDomains.split(',').map((s) => s.trim()).filter(Boolean);
        return generateWebsiteRoutingScript({
          rosVersion,
          lanInterface: webLanInterface,
          targetWan: webTargetWan,
          targetGateway: webTargetGateway,
          routingMarkName: webRoutingMark,
          selectedPresets: selectedWebsites,
          customDomains: customArr,
        });
      }

      case 'client-ip-routing':
        return generateClientIpRoutingScript({
          rosVersion,
          lanInterface: clientLanInterface,
          targetWan: clientTargetWan,
          targetGateway: clientTargetGateway,
          routingMarkName: clientRoutingMark,
          clientIpList,
          description: clientDesc,
        });

      case 'port-forwarding':
        return generatePortForwardingScript({
          rosVersion,
          wanInterface: pfWanInterface,
          publicIp: pfPublicIp,
          protocol: pfProtocol,
          externalPort: pfExternalPort,
          internalIp: pfInternalIp,
          internalPort: pfInternalPort,
          comment: pfComment,
          includeHairpinNat: pfHairpin,
          lanSubnet: pfLanSubnet,
        });

      case 'port-tcp-udp-routing':
        return generatePortTcpUdpRoutingScript({
          rosVersion,
          lanInterface: prLanInterface,
          targetWan: prTargetWan,
          targetGateway: prTargetGateway,
          routingMarkName: prRoutingMark,
          protocol: prProtocol,
          ports: prPorts,
          description: prDesc,
        });

      case 'vpn-all-traffic':
        return generateAllTrafficVPNScript({
          rosVersion,
          vpnInterface: vpnTunnelInterface,
          lanInterface: vpnLanInterface,
          vpnServerIp: vpnServerEndpoint,
          addNatMasquerade: true,
          enableKillSwitch: vpnKillSwitch,
          clientSubnet: vpnClientSubnet,
        });

      case 'remote-access-isp':
        return generateRemoteAccessScript({
          rosVersion,
          wanInterface: raWanInterface,
          wanGateway: raWanGateway,
          allowedSourceIps: raAllowedIps,
          enableWinbox: raWinbox,
          winboxPort: raWinboxPort,
          enableWebfig: raWebfig,
          webfigPort: raWebfigPort,
          enableSSH: raSSH,
          sshPort: raSSHPort,
          enableApi: raApi,
          apiPort: raApiPort,
          addMangleReplyRule: raMangleReply,
        });

      case 'vpn-port-games':
        return generateVPNGamesScript({
          rosVersion,
          vpnInterface: vpnGamesInterface,
          routingMarkName: vpnGamesRoutingMark,
          type: 'port',
          selectedGameIds: vpnGamesSelected,
          customPortsTcp: customGameTcp,
          customPortsUdp: customGameUdp,
          customIps: '',
        });

      case 'vpn-ip-games':
        return generateVPNGamesScript({
          rosVersion,
          vpnInterface: vpnGamesInterface,
          routingMarkName: vpnGamesRoutingMark,
          type: 'ip',
          selectedGameIds: [],
          customPortsTcp: '',
          customPortsUdp: '',
          customIps: vpnGameCustomIps,
        });

      case 'vpn-remote-client':
        return generateVPNRemoteClientScript({
          rosVersion,
          vpnType: vrcType,
          serverAddress: vrcServer,
          serverPort: vrcPort,
          username: vrcUser,
          password: vrcPass,
          profileName: vrcProfile,
          interfaceName: vrcInterface,
          addDefaultRoute: false,
          wireguardClientIp: vrcWgClientIp,
          wireguardPrivateKey: vrcWgPrivKey,
          wireguardServerPublicKey: vrcWgServerPubKey,
        });

      case 'social-media-routing': {
        const customArr = smCustomDomains.split(',').map((s) => s.trim()).filter(Boolean);
        return generateSocialMediaRoutingScript({
          rosVersion,
          lanInterface: smLanInterface,
          targetWan: smTargetWan,
          targetGateway: smTargetGateway,
          routingMarkName: smRoutingMark,
          selectedPlatforms: smSelected,
          customDomains: customArr,
        });
      }

      // 17-23: Hotspot // PPPoE // PPP
      case 'hotspot-qr-code':
        return generateHotspotQRCodeScript({
          rosVersion,
          ssid: qrSsid,
          encryption: qrEncryption,
          password: qrPassword,
          hidden: qrHidden,
          loginUrl: qrLoginUrl,
          hotspotServerName: qrServerName,
        });

      case 'hotspot-user-gen':
        return generateHotspotUserGenScript({
          rosVersion,
          server: huServer,
          profile: huProfile,
          prefix: huPrefix,
          userCount: huCount,
          userType: huType,
          charType: huCharType,
          length: huLength,
          uptimeLimit: huUptime,
          comment: huComment,
        });

      case 'hotspot-block-sharing-ttl':
        return generateBlockSharingTTLScript({
          rosVersion,
          hotspotInterface: ttlHotspotInterface,
          ttlValue,
          chain: ttlChain,
          comment: ttlComment,
        });

      case 'hotspot-bandwidth-up-to':
        return generateBandwidthUpToScript({
          rosVersion,
          queueName: pcqQueueName,
          targetSubnet: pcqTargetSubnet,
          totalDownloadRate: pcqTotalDown,
          totalUploadRate: pcqTotalUp,
          minClientRate: '0',
          maxClientRate: pcqMaxClientRate,
        });

      case 'hotspot-config-wizard':
        return generateHotspotWizardScript({
          rosVersion,
          interfaceName: wizIface,
          localIpAddress: wizIp,
          dhcpPoolRange: wizPool,
          dnsName: wizDns,
          adminUser: wizAdminUser,
          adminPassword: wizAdminPass,
          defaultProfileRateLimit: wizRateLimit,
          sharedUsers: wizShared,
        });

      case 'hotspot-expired-notif':
        return generateExpiredNotificationScript({
          rosVersion,
          serviceType: expService,
          redirectUrl: expRedirectUrl,
          internalProxyPort: expProxyPort,
          addressListName: expAddressList,
        });

      case 'ppp-secrets-gen':
        return generatePPPSecretsGenScript({
          rosVersion,
          service: pppService,
          profile: pppProfile,
          prefix: pppPrefix,
          userCount: pppCount,
          length: pppLength,
          remoteIpPrefix: pppRemoteIpPrefix,
          comment: pppComment,
        });

      // 24-28: DNS // Netwatch // DHCP // MAC
      case 'dns-doh':
        return generateDoHScript({
          rosVersion,
          provider: dohProvider,
          dohUrl,
          fallbackDns: dohFallback,
          verifyCert: dohVerifyCert,
          cleanStaticEntries: true,
        });

      case 'bonding-interface':
        return generateBondingScript({
          rosVersion,
          bondingName: bondName,
          slaveInterfaces: bondSlaves.split(',').map((s) => s.trim()).filter(Boolean),
          mode: bondMode,
          lacpRate: bondLacpRate,
          transmitHashPolicy: bondHashPolicy,
          ipAddress: bondIp,
        });

      case 'netwatch-notifications':
        return generateNetwatchScript({
          rosVersion,
          hostIp: netHostIp,
          hostName: netHostName,
          checkInterval: netInterval,
          timeout: netTimeout,
          notifyChannel: netChannel,
          telegramBotToken: netTgToken,
          telegramChatId: netTgChatId,
          emailRecipient: netEmail,
        });

      case 'dhcp-rogue-protection':
        return generateRogueDHCPScript({
          rosVersion,
          lanInterface: rdLanIface,
          validServerMac: rdValidMac,
          alertTimeout: rdAlertTimeout,
          action: rdAction,
        });

      case 'mac-random-change':
        return generateMacChangeScript({
          rosVersion,
          targetInterface: macIface,
          newMacAddress: macAddress,
          backupOldMac: true,
        });

      // 29-35: Protection // Block // Backup
      case 'hide-routerboard-isp':
        return generateHideRouterboardScript({
          rosVersion,
          wanInterface: ninjaWan,
          lanInterface: ninjaLan,
          disableNeighborDiscovery: ninjaMndp,
          disableMacServer: ninjaMacServer,
          disableBandwidthServer: ninjaBwServer,
          blockIcmpTracerouteToWan: ninjaBlockTraceroute,
          normalizeOutboundTTL: ninjaNormalTTL,
        });

      case 'port-knocking-icmp':
        return generatePortKnockingScript({
          rosVersion,
          wanInterface: pkWan,
          targetPort: pkPort,
          knockSize1: pkSize1,
          knockSize2: pkSize2,
          knockTimeout: pkTimeout,
          accessDuration: pkDuration,
        });

      case 'advanced-router-protection':
        return generateAdvancedProtectionScript({
          rosVersion,
          wanInterface: apWan,
          lanInterface: apLan,
          dropInvalid: apDropInvalid,
          blockSynFlood: apSynFlood,
          blockPortScanners: apPortScanners,
          protectBruteForceWinbox: apWinboxBrute,
          protectBruteForceSSH: apSshBrute,
          blockDnsOpenResolver: apDnsResolver,
        });

      case 'block-websites-gen': {
        const customArr = bwCustomDomains.split(',').map((s) => s.trim()).filter(Boolean);
        return generateBlockWebsitesScript({
          rosVersion,
          lanInterface: bwLan,
          categories: bwCategories,
          customDomains: customArr,
          blockMethod: bwMethod,
        });
      }

      case 'auto-backup-email':
        return generateAutoBackupEmailScript({
          rosVersion,
          emailRecipient: bkEmail,
          backupPassword: bkPass,
          exportRsc: bkExportRsc,
          scheduleTime: bkTime,
          scheduleInterval: bkInterval,
          routerIdentity: 'MikroTik-Router',
        });

      case 'mangle-obfuscator':
        return generateMangleObfuscatorScript({
          rosVersion,
          originalScript: obfScript,
          stripComments: obfStripComments,
          addDecoyRules: obfDecoyRules,
          renameIdentifiers: false,
        });

      case 'block-social-streaming':
        return generateBlockSocialMediaScript({
          rosVersion,
          lanInterface: bsmLan,
          selectedPlatforms: bsmPlatforms,
          blockTimeStart: bsmStart,
          blockTimeEnd: bsmEnd,
          blockDays: bsmDays,
        });

      // 36-39: RouterOS Other Tools
      case 'pcc-calculator': {
        const speeds: number[] = [pccSpeed1, pccSpeed2];
        if (pccSpeed3 > 0) speeds.push(pccSpeed3);
        if (pccSpeed4 > 0) speeds.push(pccSpeed4);
        const result = calculatePCCDivisors(speeds);
        return result.cliScript;
      }

      case 'indonesia-ntp-clock': {
        const srvArr = ntpServers.split(',').map((s) => s.trim()).filter(Boolean);
        return generateIndonesiaNTPScript({
          rosVersion,
          timezone: ntpTimezone,
          ntpServers: srvArr,
        });
      }

      case 'ip-calculator': {
        const res = calculateMikroTikIP(calcIpCidr, calcIface, rosVersion);
        return res.cliScript;
      }

      case 'wifi-id-autologin':
        return generateWifiIdAutoLoginScript({
          rosVersion,
          loginType: wifiLoginType,
          username: wifiUser,
          password: wifiPass,
          wanInterface: wifiWan,
          checkInterval: wifiInterval,
        });

      default:
        return '# Pilih salah satu fitur dari daftar untuk men-generate skrip MikroTik.';
    }
  }, [
    selectedToolId,
    rosVersion,
    wans,
    pccLanInterface,
    pccLanSubnet,
    pccClassifier,
    nthLanInterface,
    nthLanSubnet,
    ecmpCheckGateway,
    failoverPrimaryTarget,
    failoverSecondaryTarget,
    gameLanInterface,
    gameTargetWan,
    gameTargetGateway,
    gameRoutingMark,
    selectedGames,
    customGameTcp,
    customGameUdp,
    webLanInterface,
    webTargetWan,
    webTargetGateway,
    webRoutingMark,
    selectedWebsites,
    customWebDomains,
    clientLanInterface,
    clientTargetWan,
    clientTargetGateway,
    clientRoutingMark,
    clientIpList,
    clientDesc,
    pfWanInterface,
    pfPublicIp,
    pfProtocol,
    pfExternalPort,
    pfInternalIp,
    pfInternalPort,
    pfComment,
    pfHairpin,
    pfLanSubnet,
    prLanInterface,
    prTargetWan,
    prTargetGateway,
    prRoutingMark,
    prProtocol,
    prPorts,
    prDesc,
    vpnTunnelInterface,
    vpnLanInterface,
    vpnServerEndpoint,
    vpnKillSwitch,
    vpnClientSubnet,
    raWanInterface,
    raWanGateway,
    raAllowedIps,
    raWinbox,
    raWinboxPort,
    raWebfig,
    raWebfigPort,
    raSSH,
    raSSHPort,
    raApi,
    raApiPort,
    raMangleReply,
    vpnGamesInterface,
    vpnGamesRoutingMark,
    vpnGamesSelected,
    vpnGameCustomIps,
    vrcType,
    vrcServer,
    vrcPort,
    vrcUser,
    vrcPass,
    vrcProfile,
    vrcInterface,
    vrcWgClientIp,
    vrcWgPrivKey,
    vrcWgServerPubKey,
    smLanInterface,
    smTargetWan,
    smTargetGateway,
    smRoutingMark,
    smSelected,
    smCustomDomains,
    qrSsid,
    qrEncryption,
    qrPassword,
    qrHidden,
    qrLoginUrl,
    qrServerName,
    huServer,
    huProfile,
    huPrefix,
    huCount,
    huType,
    huCharType,
    huLength,
    huUptime,
    huComment,
    ttlHotspotInterface,
    ttlValue,
    ttlChain,
    ttlComment,
    pcqQueueName,
    pcqTargetSubnet,
    pcqTotalDown,
    pcqTotalUp,
    pcqMaxClientRate,
    wizIface,
    wizIp,
    wizPool,
    wizDns,
    wizAdminUser,
    wizAdminPass,
    wizRateLimit,
    wizShared,
    expService,
    expRedirectUrl,
    expProxyPort,
    expAddressList,
    pppService,
    pppProfile,
    pppPrefix,
    pppCount,
    pppLength,
    pppRemoteIpPrefix,
    pppComment,
    dohProvider,
    dohUrl,
    dohFallback,
    dohVerifyCert,
    bondName,
    bondSlaves,
    bondMode,
    bondLacpRate,
    bondHashPolicy,
    bondIp,
    netHostIp,
    netHostName,
    netInterval,
    netTimeout,
    netChannel,
    netTgToken,
    netTgChatId,
    netEmail,
    rdLanIface,
    rdValidMac,
    rdAlertTimeout,
    rdAction,
    macIface,
    macAddress,
    ninjaWan,
    ninjaLan,
    ninjaMndp,
    ninjaMacServer,
    ninjaBwServer,
    ninjaBlockTraceroute,
    ninjaNormalTTL,
    pkWan,
    pkPort,
    pkSize1,
    pkSize2,
    pkTimeout,
    pkDuration,
    apWan,
    apLan,
    apDropInvalid,
    apSynFlood,
    apPortScanners,
    apWinboxBrute,
    apSshBrute,
    apDnsResolver,
    bwLan,
    bwCategories,
    bwCustomDomains,
    bwMethod,
    bkEmail,
    bkPass,
    bkExportRsc,
    bkTime,
    bkInterval,
    obfScript,
    obfStripComments,
    obfDecoyRules,
    bsmLan,
    bsmPlatforms,
    bsmStart,
    bsmEnd,
    bsmDays,
    pccSpeed1,
    pccSpeed2,
    pccSpeed3,
    pccSpeed4,
    ntpTimezone,
    ntpServers,
    calcIpCidr,
    calcIface,
    wifiLoginType,
    wifiUser,
    wifiPass,
    wifiWan,
    wifiInterval,
    burstTargetName,
    burstTargetIp,
    burstMaxLimitUp,
    burstMaxLimitDown,
    burstBonusDurationUp,
    burstBonusDurationDown,
    burstLimitUp,
    burstLimitDown,
    pcqCalcName,
    pcqCalcTotalClient,
    pcqCalcRate,
    pcqCalcBurstRate,
    pcqCalcActualDuration,
    sqtbQueueName,
    sqtbTargetIp,
    sqtbMaxLimitUp,
    sqtbMaxLimitDown,
    sqtbBucketSizeUp,
    sqtbBucketSizeDown,
    sqtbQueueType,
    sqsuParentName,
    sqsuTargetSubnet,
    sqsuTotalParentUpload,
    sqsuTotalParentDownload,
    sqsuTotalClients,
    sqsuClientPrefix,
    sqsuClientSubnetPrefix,
    sqsuClientStartIp,
    sqsuAutoLimitAt,
    qtsuParentUpload,
    qtsuParentDownload,
    qtsuWanInterface,
    qtsuLanInterface,
    qtsuTotalClients,
    qtsuClientSubnetPrefix,
    qtsuClientStartIp,
    qtsuAutoLimitAt,
    pcqTargetType,
    pcqParentDownload,
    pcqParentUpload,
    pcqLanInterface,
    pcqWanInterface,
    pcqClientSubnet,
    pcqRateMode,
    pcqRateDownload,
    pcqRateUpload,
    qosLanInterface,
    qosWanInterface,
    qosTotalDownload,
    qosTotalUpload,
    qosSelectedServices,
    qosMode,
    qosGithubRawUrl,
  ]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    addToast?.('success', 'Berhasil Disalin', 'Skrip MikroTik berhasil disalin ke clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadRsc = () => {
    const filename = `mikrotik_${selectedToolId}_${rosVersion}.rsc`;
    const blob = new Blob([generatedScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast?.('success', 'Berhasil Mengunduh', `File ${filename} berhasil diunduh!`);
  };

  const filteredTools = useMemo(() => {
    return TOOLS_LIST.filter((t) => {
      const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [categoryFilter, searchQuery]);

  const activeTool = TOOLS_LIST.find((t) => t.id === selectedToolId) || TOOLS_LIST[0];

  // Specific IP Calculator display
  const ipCalcDetails = useMemo(() => {
    if (selectedToolId === 'ip-calculator') {
      try {
        return calculateMikroTikIP(calcIpCidr, calcIface, rosVersion);
      } catch {
        return null;
      }
    }
    return null;
  }, [selectedToolId, calcIpCidr, calcIface, rosVersion]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Introduction Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-orange-50/60 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                  MikroTik Script Generator Suite
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                  46 Network Tools
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  QUEUE // QOS // HOTSPOT // PPPOE // DNS // NETWATCH // MANGLE // NAT // VPN
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Koleksi generator skrip RouterOS lengkap: Burst Limit, PCQ Buffer Size, Simple Queue & Queue Tree Shared Up-To, QoS Priority 8 Level, Load Balancing, Anti-Tethering Hotspot, DoH, Netwatch, hingga Firewall Protection.
              </p>
            </div>
          </div>

          {/* RouterOS Version Switcher */}
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shrink-0">
            <span className="text-xs font-semibold text-slate-600 pl-2">Target RouterOS:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRosVersion('v7')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  rosVersion === 'v7'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                v7 (v7.x Terbaru)
              </button>
              <button
                type="button"
                onClick={() => setRosVersion('v6')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  rosVersion === 'v6'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                v6 (Legacy)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Category Filter & Tool Selection Grid (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Category Tabs */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'all'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua (46)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('simple-queue-tree-type')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'simple-queue-tree-type'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Queue / QoS (7)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('route-mangle-nat-vpn')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'route-mangle-nat-vpn'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Route / NAT / VPN (16)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('hotspot-pppoe-ppp')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'hotspot-pppoe-ppp'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Hotspot / PPP (7)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('dns-netwatch-dhcp')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'dns-netwatch-dhcp'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              DNS / Netwatch (5)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('protection-block-backup')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'protection-block-backup'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Protection / Backup (7)
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('routeros-other-tools')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === 'routeros-other-tools'
                  ? 'bg-orange-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tools & Calc (4)
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari fitur (misal: pcc, hotspot, qr, netwatch, doh, ninja, wifi.id)..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Tools List Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredTools.map((tool) => {
              const isSelected = tool.id === selectedToolId;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setSelectedToolId(tool.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 my-0.5 ${
                    isSelected
                      ? 'bg-orange-50 border border-orange-200/80 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tool.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold truncate ${isSelected ? 'text-orange-950' : 'text-slate-800'}`}>
                        {tool.name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-orange-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tool.shortDesc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Winbox Terminal Guide Tip */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Petunjuk Eksekusi di Router MikroTik:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600">
              <li>Pilih tool dan sesuaikan parameter pada formulir di sebelah kanan.</li>
              <li>Klik tombol <b>Salin Skrip CLI</b> atau <b>Download .rsc</b>.</li>
              <li>Buka aplikasi <b>Winbox</b> &rarr; Menu <b>New Terminal</b>.</li>
              <li>Klik kanan &rarr; <b>Paste</b>, lalu tekan <b>Enter</b> hingga selesai.</li>
            </ol>
          </div>
        </div>

        {/* Right Column: Form Inputs & Script Viewer (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Tool Form Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                  {activeTool.icon}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">{activeTool.name}</h2>
                  <p className="text-xs text-slate-500">{activeTool.shortDesc}</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md font-mono font-medium bg-slate-100 text-slate-700">
                ROS {rosVersion.toUpperCase()}
              </span>
            </div>

            {/* Dynamic Form per Tool */}

            {/* ============================================================== */}
            {/* Category: Simple Queue // Queue Tree // Queue Type (7 tools) */}
            {/* ============================================================== */}

            {/* 0.1 Burst Limit Calculator */}
            {selectedToolId === 'burst-limit-calc' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Name</label>
                    <input
                      type="text"
                      value={burstTargetName}
                      onChange={(e) => setBurstTargetName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Client-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target IP Address</label>
                    <input
                      type="text"
                      value={burstTargetIp}
                      onChange={(e) => setBurstTargetIp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88.10"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-orange-600" /> Pengaturan Kecepatan Bandwidth & Durasi
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Max Limit (Normal)</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={burstMaxLimitUp}
                          onChange={(e) => setBurstMaxLimitUp(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                          placeholder="Up (1M)"
                          title="Upload Max Limit"
                        />
                        <input
                          type="text"
                          value={burstMaxLimitDown}
                          onChange={(e) => setBurstMaxLimitDown(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                          placeholder="Down (5M)"
                          title="Download Max Limit"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">Format: 512k, 1M, 5M</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Burst Limit (Kecepatan Lonjakan)</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={burstLimitUp}
                          onChange={(e) => setBurstLimitUp(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white text-emerald-700 font-semibold"
                          placeholder="Up (2M)"
                          title="Upload Burst Limit"
                        />
                        <input
                          type="text"
                          value={burstLimitDown}
                          onChange={(e) => setBurstLimitDown(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white text-emerald-700 font-semibold"
                          placeholder="Down (10M)"
                          title="Download Burst Limit"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">Kecepatan saat lonjakan aktif</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Bonus Durasi Diinginkan (detik)</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="number"
                          value={burstBonusDurationUp}
                          onChange={(e) => setBurstBonusDurationUp(Number(e.target.value) || 1)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                          placeholder="8"
                          title="Upload Bonus Duration"
                          min="1"
                        />
                        <input
                          type="number"
                          value={burstBonusDurationDown}
                          onChange={(e) => setBurstBonusDurationDown(Number(e.target.value) || 1)}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                          placeholder="16"
                          title="Download Bonus Duration"
                          min="1"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">Lama waktu user menikmati burst</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Breakdown Table / Cards */}
                <div className="p-4 bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-600" /> Hasil Perhitungan Parameter Burst MikroTik
                    </span>
                    <span className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                      Rumus Standar MikroTik RouterOS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Burst Threshold (75%)</span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        {formatKbpsToSpeed(burstCalcResult.upThresholdKbps)} / {formatKbpsToSpeed(burstCalcResult.downThresholdKbps)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Ambang batas lonjakan</span>
                    </div>

                    <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Burst Time (Input Router)</span>
                      <span className="text-sm font-bold text-orange-600 font-mono">
                        {burstCalcResult.upBurstTime}s / {burstCalcResult.downBurstTime}s
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Parameter waktu di MikroTik</span>
                    </div>

                    <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Actual Duration (Durasi Riil)</span>
                      <span className="text-sm font-bold text-emerald-700 font-mono">
                        ~{burstCalcResult.upActualDuration}s / ~{burstCalcResult.downActualDuration}s
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Lama lonjakan dinikmati client</span>
                    </div>

                    <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Limit-At (Min. Guaranteed 12.5%)</span>
                      <span className="text-sm font-bold text-indigo-700 font-mono">
                        {formatKbpsToSpeed(burstCalcResult.upLimitAtKbps)} / {formatKbpsToSpeed(burstCalcResult.downLimitAtKbps)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Jaminan bandwidth saat sibuk</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold mb-0.5">String Rate Limit Simple Queue:</span>
                    <span className="text-orange-700 font-bold">{burstCalcResult.rateLimitString}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 0.2 PCQ Burst Rate + Queue Size Calculator */}
            {selectedToolId === 'pcq-burst-queue-size-calc' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Queue Type</label>
                    <input
                      type="text"
                      value={pcqCalcName}
                      onChange={(e) => setPcqCalcName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="pcq-clients"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Estimasi Total Client Aktif ({pcqCalcTotalClient} user)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="500"
                      step="5"
                      value={pcqCalcTotalClient}
                      onChange={(e) => setPcqCalcTotalClient(Number(e.target.value))}
                      className="w-full accent-orange-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>5 User</span>
                      <span>50 User</span>
                      <span>200 User</span>
                      <span>500 User</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PCQ Rate (Normal)</label>
                    <input
                      type="text"
                      value={pcqCalcRate}
                      onChange={(e) => setPcqCalcRate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                      placeholder="5M"
                    />
                    <span className="text-[10px] text-slate-400">Kecepatan max per client</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PCQ Burst Rate</label>
                    <input
                      type="text"
                      value={pcqCalcBurstRate}
                      onChange={(e) => setPcqCalcBurstRate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white text-emerald-700 font-semibold"
                      placeholder="10M"
                    />
                    <span className="text-[10px] text-slate-400">Kecepatan lonjakan burst</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Burst Duration (detik)</label>
                    <input
                      type="number"
                      value={pcqCalcActualDuration}
                      onChange={(e) => setPcqCalcActualDuration(Number(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                      placeholder="16"
                      min="1"
                    />
                    <span className="text-[10px] text-slate-400">Durasi bonus lonjakan</span>
                  </div>
                </div>

                {/* Calculation Cards */}
                <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-600" /> Hasil Rekomendasi Buffer & Queue Size
                    </span>
                    <span className="text-[11px] font-mono text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded">
                      Kapasitas RAM RouterBoard
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Queue Size per Sub-Stream</span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        50 KiB
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Buffer paket per client</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Total Buffer Queue Size</span>
                      <span className="text-sm font-bold text-indigo-700 font-mono">
                        {pcqCalcResult.totalQueueSize} KiB
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Buffer seluruh {pcqCalcTotalClient} client</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Estimasi Pemakaian RAM</span>
                      <span className="text-sm font-bold text-emerald-700 font-mono">
                        {pcqCalcResult.estimatedRamMb} MB
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Sangat aman untuk RB & CCR</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[11px] text-slate-500 block">Burst Time RouterOS</span>
                      <span className="text-sm font-bold text-orange-600 font-mono">
                        {pcqCalcResult.burstTime}s
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Threshold: {formatKbpsToSpeed(pcqCalcResult.burstThresholdKbps)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 0.3 Simple Queue + Token Bucket */}
            {selectedToolId === 'simple-queue-token-bucket' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Queue Name</label>
                    <input
                      type="text"
                      value={sqtbQueueName}
                      onChange={(e) => setSqtbQueueName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Client-TokenBucket"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target IP / Subnet</label>
                    <input
                      type="text"
                      value={sqtbTargetIp}
                      onChange={(e) => setSqtbTargetIp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88.20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Queue Type</label>
                    <select
                      value={sqtbQueueType}
                      onChange={(e) => setSqtbQueueType(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="default-small">default-small (Standard)</option>
                      <option value="default">default</option>
                      <option value="ethernet-default">ethernet-default</option>
                      <option value="wireless-default">wireless-default</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Limit (Upload / Download)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sqtbMaxLimitUp}
                        onChange={(e) => setSqtbMaxLimitUp(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="2M"
                        title="Upload"
                      />
                      <input
                        type="text"
                        value={sqtbMaxLimitDown}
                        onChange={(e) => setSqtbMaxLimitDown(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="10M"
                        title="Download"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">Kecepatan stabil setelah burst habis</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bucket Size (0.05s s/d 2.0s): {sqtbBucketSizeDown}s
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="2.0"
                      step="0.05"
                      value={sqtbBucketSizeDown}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSqtbBucketSizeDown(val);
                        setSqtbBucketSizeUp(val);
                      }}
                      className="w-full accent-emerald-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0.05s (Ketat)</span>
                      <span>0.1s (Standar MikroTik)</span>
                      <span>1.0s (Longgar)</span>
                      <span>2.0s (Maks)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                    <Coins className="w-4 h-4 text-emerald-600" /> Bagaimana Token Bucket Bekerja?
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    MikroTik mengimplementasikan algoritma <b>Token Bucket</b> pada Simple Queue. Dengan mengatur <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono">bucket-size={sqtbBucketSizeDown}</code>, client diizinkan mengirim sejumlah paket pertama secepat kemampuan fisik kabel (wire-speed) sebelum antrian mulai menahan dan menurunkannya kembali ke <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono">{sqtbMaxLimitDown}</code>. Hal ini membuat loading awal website / gambar terasa sangat instan tanpa membebani total kuota bandwidth.
                  </p>
                </div>
              </div>
            )}

            {/* 0.4 Simple Queue + Bandwidth Shared Up-To */}
            {selectedToolId === 'simple-queue-shared-upto' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Queue Parent</label>
                    <input
                      type="text"
                      value={sqsuParentName}
                      onChange={(e) => setSqsuParentName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Total-Bandwidth-Kantor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Subnet Parent</label>
                    <input
                      type="text"
                      value={sqsuTargetSubnet}
                      onChange={(e) => setSqsuTargetSubnet(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88.0/24"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bandwidth Induk (Upload / Download)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sqsuTotalParentUpload}
                        onChange={(e) => setSqsuTotalParentUpload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="20M"
                        title="Total Parent Upload"
                      />
                      <input
                        type="text"
                        value={sqsuTotalParentDownload}
                        onChange={(e) => setSqsuTotalParentDownload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="100M"
                        title="Total Parent Download"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah User Client Anak ({sqsuTotalClients} User)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="254"
                      value={sqsuTotalClients}
                      onChange={(e) => setSqsuTotalClients(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix Nama Client</label>
                    <input
                      type="text"
                      value={sqsuClientPrefix}
                      onChange={(e) => setSqsuClientPrefix(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Client"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix IP Subnet Client</label>
                    <input
                      type="text"
                      value={sqsuClientSubnetPrefix}
                      onChange={(e) => setSqsuClientSubnetPrefix(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mulai Dari IP Terakhir</label>
                    <input
                      type="number"
                      min="1"
                      max="254"
                      value={sqsuClientStartIp}
                      onChange={(e) => setSqsuClientStartIp(Number(e.target.value) || 2)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="sqsuAutoLimitAt"
                    checked={sqsuAutoLimitAt}
                    onChange={(e) => setSqsuAutoLimitAt(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 accent-orange-600"
                  />
                  <label htmlFor="sqsuAutoLimitAt" className="text-xs text-slate-700 select-none cursor-pointer">
                    <b>Aktifkan Auto Limit-At (Jaminan Garansi Minimum Adil):</b> Setiap client mendapatkan jaminan minimum (CIR) saat trafik padat, dan otomatis bisa loncat (Up-To) hingga batas maksimal parent saat pengguna lain sedang sepi.
                  </label>
                </div>
              </div>
            )}

            {/* 0.5 Queue Tree + Bandwidth Shared Up-To */}
            {selectedToolId === 'queue-tree-shared-upto' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN Interface (Jalur Upload)</label>
                    <input
                      type="text"
                      value={qtsuWanInterface}
                      onChange={(e) => setQtsuWanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether1-ISP1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface (Jalur Download)</label>
                    <input
                      type="text"
                      value={qtsuLanInterface}
                      onChange={(e) => setQtsuLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="bridge-LAN"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bandwidth Induk (Upload / Download)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={qtsuParentUpload}
                        onChange={(e) => setQtsuParentUpload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="20M"
                      />
                      <input
                        type="text"
                        value={qtsuParentDownload}
                        onChange={(e) => setQtsuParentDownload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="100M"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Client Tree ({qtsuTotalClients} Client)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={qtsuTotalClients}
                      onChange={(e) => setQtsuTotalClients(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subnet Prefix IP Client</label>
                    <input
                      type="text"
                      value={qtsuClientSubnetPrefix}
                      onChange={(e) => setQtsuClientSubnetPrefix(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mulai Dari Host IP Terakhir</label>
                    <input
                      type="number"
                      min="1"
                      max="254"
                      value={qtsuClientStartIp}
                      onChange={(e) => setQtsuClientStartIp(Number(e.target.value) || 2)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="qtsuAutoLimitAt"
                    checked={qtsuAutoLimitAt}
                    onChange={(e) => setQtsuAutoLimitAt(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                  />
                  <label htmlFor="qtsuAutoLimitAt" className="text-xs text-slate-700 select-none cursor-pointer">
                    <b>Aktifkan Auto Limit-At (Jaminan Garansi Minimum Adil):</b> Otomatis membagi parent limit ke setiap cabang tree secara merata.
                  </label>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-purple-700" /> Otomatis Dibuatkan Mangle Packet Mark
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Queue Tree pada MikroTik hanya dapat mengenali paket berdasarkan <b>packet-mark</b>. Skrip ini secara otomatis membuat aturan <code className="bg-purple-100 px-1 py-0.5 rounded font-mono">/ip firewall mangle</code> untuk menandai koneksi (connection-mark) dan paket (packet-mark) per IP client, lalu mengaitkannya langsung ke struktur Queue Tree hierarkis parent-child.
                  </p>
                </div>
              </div>
            )}

            {/* 0.6 PCQ for Queue Tree & Queue Simple */}
            {selectedToolId === 'pcq-tree-simple-gen' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Antrian</label>
                    <select
                      value={pcqTargetType}
                      onChange={(e) => setPcqTargetType(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="queue-tree">Queue Tree (Parent Global + Mangle)</option>
                      <option value="queue-simple">Simple Queue (Target Subnet)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Model Pembagian Bandwidth</label>
                    <select
                      value={pcqRateMode}
                      onChange={(e) => setPcqRateMode(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="auto-equal">Dynamic Shared Rata Otomatis (pcq-rate=0)</option>
                      <option value="fixed">Fixed Max Limit Per User (pcq-rate=X)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                    <input
                      type="text"
                      value={pcqLanInterface}
                      onChange={(e) => setPcqLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                      placeholder="bridge-LAN"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN Interface</label>
                    <input
                      type="text"
                      value={pcqWanInterface}
                      onChange={(e) => setPcqWanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                      placeholder="ether1-ISP1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bandwidth Induk (Upload / Download)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={pcqParentUpload}
                        onChange={(e) => setPcqParentUpload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="10M"
                      />
                      <input
                        type="text"
                        value={pcqParentDownload}
                        onChange={(e) => setPcqParentDownload(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="50M"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Client Subnet</label>
                    <input
                      type="text"
                      value={pcqClientSubnet}
                      onChange={(e) => setPcqClientSubnet(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                      placeholder="192.168.88.0/24"
                    />
                  </div>
                </div>

                {pcqRateMode === 'fixed' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Maksimal Upload Per User</label>
                      <input
                        type="text"
                        value={pcqRateUpload}
                        onChange={(e) => setPcqRateUpload(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="1M"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Maksimal Download Per User</label>
                      <input
                        type="text"
                        value={pcqRateDownload}
                        onChange={(e) => setPcqRateDownload(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono bg-white"
                        placeholder="5M"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 0.7 QoS Priority Youtube, Tiktok, WA, FB, etc. */}
            {selectedToolId === 'queue-qos-priority' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mode Implementasi</label>
                    <select
                      value={qosMode}
                      onChange={(e) => setQosMode(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="complete">Skrip Mandiri Lengkap (Offline / Standalone)</option>
                      <option value="step1_fetch">Step 1: Download File via /tool fetch</option>
                      <option value="step2_import">Step 2: Import & Terapkan Antrian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Download ISP</label>
                    <input
                      type="text"
                      value={qosTotalDownload}
                      onChange={(e) => setQosTotalDownload(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="50M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Upload ISP</label>
                    <input
                      type="text"
                      value={qosTotalUpload}
                      onChange={(e) => setQosTotalUpload(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="10M"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface (Lokal)</label>
                    <input
                      type="text"
                      value={qosLanInterface}
                      onChange={(e) => setQosLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="bridge-LAN"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN Interface (Publik)</label>
                    <input
                      type="text"
                      value={qosWanInterface}
                      onChange={(e) => setQosWanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether1-ISP1"
                    />
                  </div>
                </div>

                {qosMode !== 'complete' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GitHub / Server RSC URL</label>
                    <input
                      type="text"
                      value={qosGithubRawUrl}
                      onChange={(e) => setQosGithubRawUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="https://raw.githubusercontent.com/..."
                    />
                  </div>
                )}

                {/* Service Selection Box */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-rose-600" />
                      Pilih Layanan & Game Yang Diprioritaskan ({qosSelectedServices.length} aktif)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQosSelectedServices(QOS_SERVICE_PRESETS.map((p) => p.id))}
                        className="px-2 py-0.5 text-[11px] font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded"
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setQosSelectedServices([])}
                        className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded"
                      >
                        Batal Semua
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                    {QOS_SERVICE_PRESETS.map((preset) => {
                      const isChecked = qosSelectedServices.includes(preset.id);
                      return (
                        <label
                          key={preset.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-rose-50 border-rose-300 text-rose-950 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setQosSelectedServices([...qosSelectedServices, preset.id]);
                              } else {
                                setQosSelectedServices(qosSelectedServices.filter((id) => id !== preset.id));
                              }
                            }}
                            className="w-3.5 h-3.5 accent-rose-600 rounded"
                          />
                          <span className="truncate">{preset.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Hierarchy Breakdown */}
                <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-rose-950 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-rose-700" /> Hirarki Tingkat Prioritas Antrian (Priority 1 - 8)
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded border border-rose-100">
                      <b className="text-red-700">Priority 1:</b> DNS, ICMP Ping, Game Ping ACK
                    </div>
                    <div className="p-2 bg-white rounded border border-rose-100">
                      <b className="text-amber-700">Priority 2:</b> Game Online (MLBB, FF, Valorant)
                    </div>
                    <div className="p-2 bg-white rounded border border-rose-100">
                      <b className="text-emerald-700">Priority 3:</b> WhatsApp, Zoom, Medsos
                    </div>
                    <div className="p-2 bg-white rounded border border-rose-100">
                      <b className="text-blue-700">Priority 4:</b> YouTube, TikTok Streaming
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 1. PCC & 2. NTH & 3. ECMP WAN Table */}
            {(selectedToolId === 'lb-pcc' || selectedToolId === 'lb-nth' || selectedToolId === 'lb-ecmp') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Daftar WAN Lines (Koneksi ISP):</label>
                    {selectedToolId === 'lb-pcc' && (
                      <p className="text-[11px] text-slate-500">Tentukan bandwidth/kecepatan (Mbps) tiap ISP untuk menghitung rasio PCC.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddWan}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah WAN
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 font-semibold text-slate-600">
                    <div className="col-span-2">Name</div>
                    <div className={selectedToolId === 'lb-pcc' ? 'col-span-3' : 'col-span-4'}>Interface</div>
                    <div className={selectedToolId === 'lb-pcc' ? 'col-span-3' : 'col-span-4'}>Gateway IP</div>
                    {selectedToolId === 'lb-pcc' && (
                      <div className="col-span-3">Bandwidth / Kecepatan</div>
                    )}
                    <div className={selectedToolId === 'lb-pcc' ? 'col-span-1 text-center' : 'col-span-2 text-center'}>Aksi</div>
                  </div>
                  {wans.map((w) => (
                    <div key={w.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center bg-white hover:bg-slate-50/60">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={w.name}
                          onChange={(e) => handleUpdateWan(w.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                        />
                      </div>
                      <div className={selectedToolId === 'lb-pcc' ? 'col-span-3' : 'col-span-4'}>
                        <input
                          type="text"
                          value={w.interface}
                          onChange={(e) => handleUpdateWan(w.id, 'interface', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                        />
                      </div>
                      <div className={selectedToolId === 'lb-pcc' ? 'col-span-3' : 'col-span-4'}>
                        <input
                          type="text"
                          value={w.gateway}
                          onChange={(e) => handleUpdateWan(w.id, 'gateway', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md font-mono"
                        />
                      </div>
                      {selectedToolId === 'lb-pcc' && (
                        <div className="col-span-3">
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={w.speed ?? 100}
                              onChange={(e) => handleUpdateWan(w.id, 'speed', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded-l-md font-mono text-right"
                              placeholder="100"
                            />
                            <span className="px-2 py-1 text-[11px] bg-slate-100 border border-l-0 border-slate-200 rounded-r-md text-slate-600 font-medium">
                              Mbps
                            </span>
                          </div>
                        </div>
                      )}
                      <div className={selectedToolId === 'lb-pcc' ? 'col-span-1 text-center' : 'col-span-2 text-center'}>
                        <button
                          type="button"
                          onClick={() => handleRemoveWan(w.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Hapus baris WAN"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedToolId === 'lb-pcc' && (
                  <div className="p-3.5 bg-gradient-to-r from-orange-50/70 to-amber-50/50 border border-orange-200 rounded-xl text-xs space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="font-semibold text-slate-800">
                          Kalkulasi Rasio PCC (Per Connection Classifier):
                        </span>
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-mono font-bold text-[11px]">
                          Divisor: {pccRatioInfo.totalSlots}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-orange-200/60">
                        Perbandingan: {pccRatioInfo.allocations.map((a) => `${a.wan.name} (${a.slots})`).join(' : ')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-0.5">
                      {pccRatioInfo.allocations.map((alloc) => (
                        <div key={alloc.wan.id} className="bg-white p-2.5 rounded-lg border border-orange-200/60 shadow-xs flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{alloc.wan.name}</span>
                            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 font-mono font-semibold text-[10px] rounded border border-orange-100">
                              {alloc.speed} Mbps
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-baseline justify-between text-[11px]">
                            <span className="text-slate-500">Porsi Trafik:</span>
                            <span className="font-semibold text-orange-600">{alloc.percentage}%</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>Slot PCC:</span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1 rounded truncate max-w-[120px]" title={alloc.ratios.join(', ')}>
                              {alloc.ratios.join(', ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Sistem menghitung rasio bandwidth ISP menggunakan rumus FPB / GCD (Greatest Common Divisor). Mangle prerouting otomatis dipecah menjadi <b className="text-slate-800">{pccRatioInfo.allocations.map((a) => `${a.wan.name}: ${a.slots} slot`).join(', ')}</b> sehingga beban traffic didistribusikan seimbang sesuai kapasitas masing-masing link ISP.
                    </p>
                  </div>
                )}

                {selectedToolId === 'lb-pcc' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                      <input
                        type="text"
                        value={pccLanInterface}
                        onChange={(e) => setPccLanInterface(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="ether3-LAN atau bridge-LAN"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Subnet (RFC1918)</label>
                      <input
                        type="text"
                        value={pccLanSubnet}
                        onChange={(e) => setPccLanSubnet(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="192.168.88.0/24"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">PCC Match Mode</label>
                      <select
                        value={pccClassifier}
                        onChange={(e) => setPccClassifier(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="both-addresses-and-ports">both-addresses-and-ports</option>
                        <option value="both-addresses">both-addresses</option>
                        <option value="src-address">src-address</option>
                        <option value="src-address-and-port">src-address-and-port</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedToolId === 'lb-nth' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                      <input
                        type="text"
                        value={nthLanInterface}
                        onChange={(e) => setNthLanInterface(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="ether3-LAN"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Subnet</label>
                      <input
                        type="text"
                        value={nthLanSubnet}
                        onChange={(e) => setNthLanSubnet(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="192.168.88.0/24"
                      />
                    </div>
                  </div>
                )}

                {selectedToolId === 'lb-ecmp' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check Gateway Protocol</label>
                    <select
                      value={ecmpCheckGateway}
                      onChange={(e) => setEcmpCheckGateway(e.target.value as any)}
                      className="w-full max-w-xs px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="ping">ping (Disarankan)</option>
                      <option value="arp">arp</option>
                      <option value="none">none (Tanpa health-check)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* 4. Failover Recursive */}
            {selectedToolId === 'failover-recursive' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-slate-800">ISP 1 (Jalur Utama)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={wans[0]?.interface || 'ether1-ISP1'}
                        onChange={(e) => handleUpdateWan(wans[0]?.id || '1', 'interface', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="ether1"
                      />
                      <input
                        type="text"
                        value={wans[0]?.gateway || '192.168.1.1'}
                        onChange={(e) => handleUpdateWan(wans[0]?.id || '1', 'gateway', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">DNS Check Target</label>
                    <input
                      type="text"
                      value={failoverPrimaryTarget}
                      onChange={(e) => setFailoverPrimaryTarget(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="8.8.8.8"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-slate-800">ISP 2 (Jalur Cadangan)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={wans[1]?.interface || 'ether2-ISP2'}
                        onChange={(e) => handleUpdateWan(wans[1]?.id || '2', 'interface', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="ether2"
                      />
                      <input
                        type="text"
                        value={wans[1]?.gateway || '192.168.2.1'}
                        onChange={(e) => handleUpdateWan(wans[1]?.id || '2', 'gateway', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                        placeholder="192.168.2.1"
                      />
                    </div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">DNS Check Target</label>
                    <input
                      type="text"
                      value={failoverSecondaryTarget}
                      onChange={(e) => setFailoverSecondaryTarget(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="1.1.1.1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5 & 6. Games Routing */}
            {(selectedToolId === 'games-raw' || selectedToolId === 'games-mangle') && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                    <input
                      type="text"
                      value={gameLanInterface}
                      onChange={(e) => setGameLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether3-LAN"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target WAN</label>
                    <input
                      type="text"
                      value={gameTargetWan}
                      onChange={(e) => setGameTargetWan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="WAN1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Gateway</label>
                    <input
                      type="text"
                      value={gameTargetGateway}
                      onChange={(e) => setGameTargetGateway(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Routing Mark Name</label>
                    <input
                      type="text"
                      value={gameRoutingMark}
                      onChange={(e) => setGameRoutingMark(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="GAMES_TRAFFIC"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Preset Game Online Populer:</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {GAME_PRESETS.map((p) => {
                      const isChecked = selectedGames.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                            isChecked ? 'bg-purple-50 border-purple-300 text-purple-900 font-medium' : 'bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedGames([...selectedGames, p.id]);
                              else setSelectedGames(selectedGames.filter((id) => id !== p.id));
                            }}
                            className="rounded text-purple-600"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={customGameTcp}
                    onChange={(e) => setCustomGameTcp(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Custom TCP Ports (contoh: 8088,9090-9095)"
                  />
                  <input
                    type="text"
                    value={customGameUdp}
                    onChange={(e) => setCustomGameUdp(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Custom UDP Ports (contoh: 20001-20010)"
                  />
                </div>
              </div>
            )}

            {/* 7. Website Routing */}
            {selectedToolId === 'website-routing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                    <input
                      type="text"
                      value={webLanInterface}
                      onChange={(e) => setWebLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether3-LAN"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target WAN</label>
                    <input
                      type="text"
                      value={webTargetWan}
                      onChange={(e) => setWebTargetWan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="WAN1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Gateway</label>
                    <input
                      type="text"
                      value={webTargetGateway}
                      onChange={(e) => setWebTargetGateway(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Routing Mark</label>
                    <input
                      type="text"
                      value={webRoutingMark}
                      onChange={(e) => setWebRoutingMark(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="WEBSITES_TRAFFIC"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Preset Layanan Website:</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {WEBSITE_PRESETS.map((p) => {
                      const isChecked = selectedWebsites.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                            isChecked ? 'bg-teal-50 border-teal-300 text-teal-900 font-medium' : 'bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedWebsites([...selectedWebsites, p.id]);
                              else setSelectedWebsites(selectedWebsites.filter((id) => id !== p.id));
                            }}
                            className="rounded text-teal-600"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <input
                  type="text"
                  value={customWebDomains}
                  onChange={(e) => setCustomWebDomains(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Domain Tambahan (koma pisahkan, misal: klikbca.com, pajak.go.id)"
                />
              </div>
            )}

            {/* 8. Client IP Routing */}
            {selectedToolId === 'client-ip-routing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                    <input
                      type="text"
                      value={clientLanInterface}
                      onChange={(e) => setClientLanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether3-LAN"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target WAN</label>
                    <input
                      type="text"
                      value={clientTargetWan}
                      onChange={(e) => setClientTargetWan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="WAN2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ISP Gateway</label>
                    <input
                      type="text"
                      value={clientTargetGateway}
                      onChange={(e) => setClientTargetGateway(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.2.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Routing Mark</label>
                    <input
                      type="text"
                      value={clientRoutingMark}
                      onChange={(e) => setClientRoutingMark(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="VIP_CLIENTS_ROUTE"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={clientIpList}
                  onChange={(e) => setClientIpList(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Daftar IP Client (misal: 192.168.88.50, 192.168.88.100-192.168.88.120)"
                />
                <input
                  type="text"
                  value={clientDesc}
                  onChange={(e) => setClientDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  placeholder="Keterangan (misal: Ruang Pimpinan, Server Database)"
                />
              </div>
            )}

            {/* 9. Port Forwarding NAT */}
            {selectedToolId === 'port-forwarding' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN Interface</label>
                    <input
                      type="text"
                      value={pfWanInterface}
                      onChange={(e) => setPfWanInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IP Publik (Opsional)</label>
                    <input
                      type="text"
                      value={pfPublicIp}
                      onChange={(e) => setPfPublicIp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Protokol</label>
                    <select
                      value={pfProtocol}
                      onChange={(e) => setPfProtocol(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="both">TCP & UDP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan Rule</label>
                    <input
                      type="text"
                      value={pfComment}
                      onChange={(e) => setPfComment(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={pfExternalPort}
                    onChange={(e) => setPfExternalPort(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Port Eksternal (8080)"
                  />
                  <input
                    type="text"
                    value={pfInternalIp}
                    onChange={(e) => setPfInternalIp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="IP Internal Server (192.168.88.50)"
                  />
                  <input
                    type="text"
                    value={pfInternalPort}
                    onChange={(e) => setPfInternalPort(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Port Internal (80)"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={pfHairpin}
                    onChange={(e) => setPfHairpin(e.target.checked)}
                    className="rounded text-green-600"
                  />
                  <span>Sertakan Rule Hairpin NAT (Bisa akses via IP Publik/DDNS dari LAN)</span>
                </label>
                {pfHairpin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subnet LAN (untuk Hairpin NAT)</label>
                    <input
                      type="text"
                      value={pfLanSubnet}
                      onChange={(e) => setPfLanSubnet(e.target.value)}
                      className="w-full md:w-1/2 px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.88.0/24"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 10. Port TCP/UDP Static Routing */}
            {selectedToolId === 'port-tcp-udp-routing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={prLanInterface}
                    onChange={(e) => setPrLanInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                  <input
                    type="text"
                    value={prTargetWan}
                    onChange={(e) => setPrTargetWan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Target WAN"
                  />
                  <input
                    type="text"
                    value={prTargetGateway}
                    onChange={(e) => setPrTargetGateway(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Gateway IP"
                  />
                  <input
                    type="text"
                    value={prRoutingMark}
                    onChange={(e) => setPrRoutingMark(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Routing Mark"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={prProtocol}
                    onChange={(e) => setPrProtocol(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="both">TCP & UDP</option>
                  </select>
                  <input
                    type="text"
                    value={prPorts}
                    onChange={(e) => setPrPorts(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Port (80,443,8080)"
                  />
                  <input
                    type="text"
                    value={prDesc}
                    onChange={(e) => setPrDesc(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    placeholder="Keterangan"
                  />
                </div>
              </div>
            )}

            {/* 11. All Traffic to VPN */}
            {selectedToolId === 'vpn-all-traffic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={vpnTunnelInterface}
                    onChange={(e) => setVpnTunnelInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="VPN Interface"
                  />
                  <input
                    type="text"
                    value={vpnLanInterface}
                    onChange={(e) => setVpnLanInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                  <input
                    type="text"
                    value={vpnServerEndpoint}
                    onChange={(e) => setVpnServerEndpoint(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="IP Server VPN (Cegah Loop)"
                  />
                </div>
                <input
                  type="text"
                  value={vpnClientSubnet}
                  onChange={(e) => setVpnClientSubnet(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Subnet Client Spesifik (opsional, contoh: 192.168.88.0/24)"
                />
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={vpnKillSwitch}
                    onChange={(e) => setVpnKillSwitch(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Aktifkan Kill-Switch Protection (Blokir bocor internet bila VPN putus)</span>
                </label>
              </div>
            )}

            {/* 12. Remote Access */}
            {selectedToolId === 'remote-access-isp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={raWanInterface}
                    onChange={(e) => setRaWanInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="WAN Interface"
                  />
                  <input
                    type="text"
                    value={raWanGateway}
                    onChange={(e) => setRaWanGateway(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Gateway (untuk Reply)"
                  />
                </div>
                <input
                  type="text"
                  value={raAllowedIps}
                  onChange={(e) => setRaAllowedIps(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Whitelist IP Source Admin (0.0.0.0/0 jika bebas)"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="p-2 border rounded-lg text-xs bg-slate-50 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={raWinbox}
                        onChange={(e) => setRaWinbox(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Winbox</span>
                    </label>
                    <input
                      type="text"
                      value={raWinboxPort}
                      onChange={(e) => setRaWinboxPort(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                      placeholder="8291"
                    />
                  </div>
                  <div className="p-2 border rounded-lg text-xs bg-slate-50 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={raWebfig}
                        onChange={(e) => setRaWebfig(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>WebFig</span>
                    </label>
                    <input
                      type="text"
                      value={raWebfigPort}
                      onChange={(e) => setRaWebfigPort(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                      placeholder="80,443"
                    />
                  </div>
                  <div className="p-2 border rounded-lg text-xs bg-slate-50 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={raSSH}
                        onChange={(e) => setRaSSH(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>SSH</span>
                    </label>
                    <input
                      type="text"
                      value={raSSHPort}
                      onChange={(e) => setRaSSHPort(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                      placeholder="22"
                    />
                  </div>
                  <div className="p-2 border rounded-lg text-xs bg-slate-50 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={raApi}
                        onChange={(e) => setRaApi(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>API</span>
                    </label>
                    <input
                      type="text"
                      value={raApiPort}
                      onChange={(e) => setRaApiPort(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                      placeholder="8728"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={raMangleReply}
                    onChange={(e) => setRaMangleReply(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Sertakan Mangle Reply Rule (Jaminan balasan trafik remote keluar lewat ISP yang sama)</span>
                </label>
              </div>
            )}

            {/* 13 & 14. VPN Games */}
            {(selectedToolId === 'vpn-port-games' || selectedToolId === 'vpn-ip-games') && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={vpnGamesInterface}
                    onChange={(e) => setVpnGamesInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Interface Gaming VPN"
                  />
                  <input
                    type="text"
                    value={vpnGamesRoutingMark}
                    onChange={(e) => setVpnGamesRoutingMark(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Routing Mark"
                  />
                </div>
                {selectedToolId === 'vpn-port-games' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {GAME_PRESETS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vpnGamesSelected.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) setVpnGamesSelected([...vpnGamesSelected, p.id]);
                            else setVpnGamesSelected(vpnGamesSelected.filter((id) => id !== p.id));
                          }}
                          className="rounded text-violet-600"
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={2}
                    value={vpnGameCustomIps}
                    onChange={(e) => setVpnGameCustomIps(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Daftar Subnet IP Server Game"
                  />
                )}
              </div>
            )}

            {/* 15. VPN Remote Client */}
            {selectedToolId === 'vpn-remote-client' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={vrcType}
                    onChange={(e) => setVrcType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="sstp">SSTP (Port 443 - Rekomendasi)</option>
                    <option value="l2tp">L2TP / IPsec</option>
                    <option value="pptp">PPTP (Legacy)</option>
                    <option value="ovpn">OpenVPN (TCP/UDP)</option>
                    <option value="wireguard">WireGuard (RouterOS v7)</option>
                  </select>
                  <input
                    type="text"
                    value={vrcServer}
                    onChange={(e) => setVrcServer(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Server Host / DDNS"
                  />
                  <input
                    type="text"
                    value={vrcPort}
                    onChange={(e) => setVrcPort(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Port"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={vrcUser}
                    onChange={(e) => setVrcUser(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Username"
                  />
                  <input
                    type="text"
                    value={vrcPass}
                    onChange={(e) => setVrcPass(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Password"
                  />
                  <input
                    type="text"
                    value={vrcProfile}
                    onChange={(e) => setVrcProfile(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Profile"
                  />
                  <input
                    type="text"
                    value={vrcInterface}
                    onChange={(e) => setVrcInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Interface Name"
                  />
                </div>

                {vrcType === 'wireguard' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <input
                      type="text"
                      value={vrcWgClientIp}
                      onChange={(e) => setVrcWgClientIp(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="WireGuard IP Client (10.200.0.2/24)"
                    />
                    <input
                      type="text"
                      value={vrcWgPrivKey}
                      onChange={(e) => setVrcWgPrivKey(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Client Private Key"
                    />
                    <input
                      type="text"
                      value={vrcWgServerPubKey}
                      onChange={(e) => setVrcWgServerPubKey(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Server Public Key"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 16. Social Media Routing */}
            {selectedToolId === 'social-media-routing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={smLanInterface}
                    onChange={(e) => setSmLanInterface(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                  <input
                    type="text"
                    value={smTargetWan}
                    onChange={(e) => setSmTargetWan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Target WAN"
                  />
                  <input
                    type="text"
                    value={smTargetGateway}
                    onChange={(e) => setSmTargetGateway(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Target Gateway"
                  />
                  <input
                    type="text"
                    value={smRoutingMark}
                    onChange={(e) => setSmRoutingMark(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Routing Mark"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SOCIAL_PRESETS.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smSelected.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSmSelected([...smSelected, p.id]);
                          else setSmSelected(smSelected.filter((id) => id !== p.id));
                        }}
                        className="rounded text-rose-600"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={smCustomDomains}
                  onChange={(e) => setSmCustomDomains(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Domain Tambahan (koma pisahkan)"
                />
              </div>
            )}

            {/* 17. Hotspot QR Code */}
            {selectedToolId === 'hotspot-qr-code' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama SSID Wi-Fi</label>
                    <input
                      type="text"
                      value={qrSsid}
                      onChange={(e) => setQrSsid(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enkripsi</label>
                    <select
                      value={qrEncryption}
                      onChange={(e) => setQrEncryption(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3</option>
                      <option value="nopass">Tanpa Password (Open Hotspot)</option>
                      <option value="WEP">WEP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password Wi-Fi</label>
                    <input
                      type="text"
                      value={qrPassword}
                      onChange={(e) => setQrPassword(e.target.value)}
                      disabled={qrEncryption === 'nopass'}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={qrServerName}
                    onChange={(e) => setQrServerName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Hotspot Server Name (hotspot1)"
                  />
                  <input
                    type="text"
                    value={qrLoginUrl}
                    onChange={(e) => setQrLoginUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Login URL (http://192.168.88.1/login)"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={qrHidden}
                      onChange={(e) => setQrHidden(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Hidden SSID (Jaringan Tersembunyi)</span>
                  </label>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold">Format String Wi-Fi QR Code:</span>
                    <p className="font-mono mt-0.5 select-all">
                      WIFI:S:{qrSsid};T:{qrEncryption};P:{qrPassword};H:{qrHidden ? 'true' : 'false'};;
                    </p>
                  </div>
                  <QrCode className="w-8 h-8 text-blue-600 shrink-0" />
                </div>
              </div>
            )}

            {/* 18. Hotspot User Generator */}
            {selectedToolId === 'hotspot-user-gen' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Server</label>
                    <input
                      type="text"
                      value={huServer}
                      onChange={(e) => setHuServer(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Profil User</label>
                    <input
                      type="text"
                      value={huProfile}
                      onChange={(e) => setHuProfile(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix Kode</label>
                    <input
                      type="text"
                      value={huPrefix}
                      onChange={(e) => setHuPrefix(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Voucher</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={huCount}
                      onChange={(e) => setHuCount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Login</label>
                    <select
                      value={huType}
                      onChange={(e) => setHuType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="same">User = Password</option>
                      <option value="different">User & Password Beda</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Karakter</label>
                    <select
                      value={huCharType}
                      onChange={(e) => setHuCharType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="numeric">Angka (1234)</option>
                      <option value="alphanumeric">Huruf & Angka</option>
                      <option value="lowercase">Huruf Kecil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Panjang Karakter</label>
                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={huLength}
                      onChange={(e) => setHuLength(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Limit Waktu (Uptime)</label>
                    <input
                      type="text"
                      value={huUptime}
                      onChange={(e) => setHuUptime(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="2h, 1d"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={huComment}
                  onChange={(e) => setHuComment(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  placeholder="Komentar / Harga Voucher (misal: Paket 2 Jam Rp 3.000)"
                />
              </div>
            )}

            {/* 19. Block Sharing TTL */}
            {selectedToolId === 'hotspot-block-sharing-ttl' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hotspot Interface</label>
                    <input
                      type="text"
                      value={ttlHotspotInterface}
                      onChange={(e) => setTtlHotspotInterface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether3-Hotspot"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai TTL</label>
                    <input
                      type="number"
                      min={1}
                      max={255}
                      value={ttlValue}
                      onChange={(e) => setTtlValue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mangle Chain</label>
                    <select
                      value={ttlChain}
                      onChange={(e) => setTtlChain(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="postrouting">postrouting (Rekomendasi)</option>
                      <option value="prerouting">prerouting</option>
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  value={ttlComment}
                  onChange={(e) => setTtlComment(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  placeholder="Komentar rule"
                />
              </div>
            )}

            {/* 20. Bandwidth Share Up-To PCQ */}
            {selectedToolId === 'hotspot-bandwidth-up-to' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Queue</label>
                    <input
                      type="text"
                      value={pcqQueueName}
                      onChange={(e) => setPcqQueueName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Subnet Hotspot</label>
                    <input
                      type="text"
                      value={pcqTargetSubnet}
                      onChange={(e) => setPcqTargetSubnet(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bandwidth Download</label>
                    <input
                      type="text"
                      value={pcqTotalDown}
                      onChange={(e) => setPcqTotalDown(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="50M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bandwidth Upload</label>
                    <input
                      type="text"
                      value={pcqTotalUp}
                      onChange={(e) => setPcqTotalUp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="20M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Maks Rate Tiap Klien (Up-To)</label>
                    <input
                      type="text"
                      value={pcqMaxClientRate}
                      onChange={(e) => setPcqMaxClientRate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="10M (0 = bebas hingga total)"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 21. Hotspot Wizard */}
            {selectedToolId === 'hotspot-config-wizard' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interface Hotspot</label>
                    <input
                      type="text"
                      value={wizIface}
                      onChange={(e) => setWizIface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IP Gateway Hotspot</label>
                    <input
                      type="text"
                      value={wizIp}
                      onChange={(e) => setWizIp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rentang DHCP Pool</label>
                    <input
                      type="text"
                      value={wizPool}
                      onChange={(e) => setWizPool(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">DNS Name</label>
                    <input
                      type="text"
                      value={wizDns}
                      onChange={(e) => setWizDns(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Admin User</label>
                    <input
                      type="text"
                      value={wizAdminUser}
                      onChange={(e) => setWizAdminUser(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Password</label>
                    <input
                      type="text"
                      value={wizAdminPass}
                      onChange={(e) => setWizAdminPass(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Default Rate Limit</label>
                    <input
                      type="text"
                      value={wizRateLimit}
                      onChange={(e) => setWizRateLimit(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Shared Users</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={wizShared}
                      onChange={(e) => setWizShared(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 22. Expired Notification */}
            {selectedToolId === 'hotspot-expired-notif' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Layanan</label>
                    <select
                      value={expService}
                      onChange={(e) => setExpService(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="both">Hotspot & PPPoE</option>
                      <option value="hotspot">Hotspot Saja</option>
                      <option value="pppoe">PPPoE Saja</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Address List</label>
                    <input
                      type="text"
                      value={expAddressList}
                      onChange={(e) => setExpAddressList(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Port Web Proxy Internal</label>
                    <input
                      type="text"
                      value={expProxyPort}
                      onChange={(e) => setExpProxyPort(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Redirect Web Notice URL:</label>
                  <input
                    type="text"
                    value={expRedirectUrl}
                    onChange={(e) => setExpRedirectUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="http://billing.isp.net/isolir.html"
                  />
                </div>
              </div>
            )}

            {/* 23. PPP Secrets Gen */}
            {selectedToolId === 'ppp-secrets-gen' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Service</label>
                    <select
                      value={pppService}
                      onChange={(e) => setPppService(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="pppoe">pppoe</option>
                      <option value="l2tp">l2tp</option>
                      <option value="sstp">sstp</option>
                      <option value="ovpn">ovpn</option>
                      <option value="any">any</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Name</label>
                    <input
                      type="text"
                      value={pppProfile}
                      onChange={(e) => setPppProfile(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={pppPrefix}
                      onChange={(e) => setPppPrefix(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Akun</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={pppCount}
                      onChange={(e) => setPppCount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Panjang Karakter</label>
                    <input
                      type="number"
                      min={3}
                      max={16}
                      value={pppLength}
                      onChange={(e) => setPppLength(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={pppRemoteIpPrefix}
                    onChange={(e) => setPppRemoteIpPrefix(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Prefix Remote IP (10.10.10.)"
                  />
                  <input
                    type="text"
                    value={pppComment}
                    onChange={(e) => setPppComment(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    placeholder="Komentar Akun"
                  />
                </div>
              </div>
            )}

            {/* 24. DoH Servers */}
            {selectedToolId === 'dns-doh' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Penyedia DoH</label>
                    <select
                      value={dohProvider}
                      onChange={(e) => {
                        const prov = e.target.value as any;
                        setDohProvider(prov);
                        if (prov === 'cloudflare') setDohUrl('https://cloudflare-dns.com/dns-query');
                        else if (prov === 'google') setDohUrl('https://dns.google/dns-query');
                        else if (prov === 'adguard') setDohUrl('https://dns.adguard-dns.com/dns-query');
                        else if (prov === 'nextdns') setDohUrl('https://dns.nextdns.io/<ID>');
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="cloudflare">Cloudflare 1.1.1.1 (Cepat)</option>
                      <option value="google">Google DNS 8.8.8.8</option>
                      <option value="adguard">AdGuard (Blokir Iklan)</option>
                      <option value="nextdns">NextDNS (Custom Filtering)</option>
                      <option value="custom">Custom DoH URL</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">DoH Server URL</label>
                    <input
                      type="text"
                      value={dohUrl}
                      onChange={(e) => setDohUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fallback DNS Resolvers</label>
                    <input
                      type="text"
                      value={dohFallback}
                      onChange={(e) => setDohFallback(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={dohVerifyCert}
                        onChange={(e) => setDohVerifyCert(e.target.checked)}
                        className="rounded text-sky-600"
                      />
                      <span>Verify DoH Certificate</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 25. Bonding Interface */}
            {selectedToolId === 'bonding-interface' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bonding Name</label>
                    <input
                      type="text"
                      value={bondName}
                      onChange={(e) => setBondName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Port Slaves (koma pisahkan)</label>
                    <input
                      type="text"
                      value={bondSlaves}
                      onChange={(e) => setBondSlaves(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="ether1,ether2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mode Bonding</label>
                    <select
                      value={bondMode}
                      onChange={(e) => setBondMode(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="802.3ad">802.3ad LACP (Trunk Switch)</option>
                      <option value="balance-rr">balance-rr (Round Robin)</option>
                      <option value="active-backup">active-backup (Failover)</option>
                      <option value="balance-xor">balance-xor</option>
                      <option value="broadcast">broadcast</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={bondIp}
                    onChange={(e) => setBondIp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="IP Address Interface (10.0.0.1/30)"
                  />
                  <select
                    value={bondHashPolicy}
                    onChange={(e) => setBondHashPolicy(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="layer-2-and-3">layer-2-and-3 (Optimal)</option>
                    <option value="layer-2">layer-2</option>
                    <option value="layer-3-and-4">layer-3-and-4</option>
                  </select>
                  {bondMode === '802.3ad' ? (
                    <select
                      value={bondLacpRate}
                      onChange={(e) => setBondLacpRate(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="1sec">LACP Rate: 1 sec (Fast)</option>
                      <option value="30sec">LACP Rate: 30 sec (Slow)</option>
                    </select>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            )}

            {/* 26. Netwatch Notifications */}
            {selectedToolId === 'netwatch-notifications' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Host Target IP</label>
                    <input
                      type="text"
                      value={netHostIp}
                      onChange={(e) => setNetHostIp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Host</label>
                    <input
                      type="text"
                      value={netHostName}
                      onChange={(e) => setNetHostName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interval Ping</label>
                    <input
                      type="text"
                      value={netInterval}
                      onChange={(e) => setNetInterval(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Timeout</label>
                    <input
                      type="text"
                      value={netTimeout}
                      onChange={(e) => setNetTimeout(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notifikasi Via</label>
                    <select
                      value={netChannel}
                      onChange={(e) => setNetChannel(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="telegram">Telegram Bot</option>
                      <option value="email">E-Mail</option>
                    </select>
                  </div>
                </div>

                {netChannel === 'telegram' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={netTgToken}
                      onChange={(e) => setNetTgToken(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Telegram Bot Token (dari @BotFather)"
                    />
                    <input
                      type="text"
                      value={netTgChatId}
                      onChange={(e) => setNetTgChatId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="Telegram Chat ID (dari @userinfobot)"
                    />
                  </div>
                ) : (
                  <input
                    type="email"
                    value={netEmail}
                    onChange={(e) => setNetEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Alamat Email Penerima"
                  />
                )}
              </div>
            )}

            {/* 27. Rogue DHCP Protection */}
            {selectedToolId === 'dhcp-rogue-protection' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LAN Interface</label>
                    <input
                      type="text"
                      value={rdLanIface}
                      onChange={(e) => setRdLanIface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MAC Server Resmi</label>
                    <input
                      type="text"
                      value={rdValidMac}
                      onChange={(e) => setRdValidMac(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Alert Timeout</label>
                    <input
                      type="text"
                      value={rdAlertTimeout}
                      onChange={(e) => setRdAlertTimeout(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="1h"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Aksi Penanganan</label>
                    <select
                      value={rdAction}
                      onChange={(e) => setRdAction(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="both">Catat Log & Drop Paket Liar</option>
                      <option value="alert">Catat Log Saja</option>
                      <option value="block">Drop Paket Liar Saja</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 28. Change or Random MAC Address */}
            {selectedToolId === 'mac-random-change' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interface Target</label>
                    <input
                      type="text"
                      value={macIface}
                      onChange={(e) => setMacIface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MAC Address Baru</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateRandomMac}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200"
                      >
                        Acak MAC
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 29. Hide Routerboard Ninja */}
            {selectedToolId === 'hide-routerboard-isp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={ninjaWan}
                    onChange={(e) => setNinjaWan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="WAN Interface"
                  />
                  <input
                    type="text"
                    value={ninjaLan}
                    onChange={(e) => setNinjaLan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ninjaMndp}
                      onChange={(e) => setNinjaMndp(e.target.checked)}
                      className="rounded text-slate-800"
                    />
                    <span>Matikan Neighbor Discovery (MNDP, CDP, LLDP) ke arah ISP</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ninjaMacServer}
                      onChange={(e) => setNinjaMacServer(e.target.checked)}
                      className="rounded text-slate-800"
                    />
                    <span>Batasi MAC Server & MAC Winbox hanya dari port LAN</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ninjaBwServer}
                      onChange={(e) => setNinjaBwServer(e.target.checked)}
                      className="rounded text-slate-800"
                    />
                    <span>Nonaktifkan Bandwidth Test Server dari internet</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ninjaNormalTTL}
                      onChange={(e) => setNinjaNormalTTL(e.target.checked)}
                      className="rounded text-slate-800"
                    />
                    <span>Samarkan TTL menjadi 64 standar PC normal</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ninjaBlockTraceroute}
                      onChange={(e) => setNinjaBlockTraceroute(e.target.checked)}
                      className="rounded text-slate-800"
                    />
                    <span>Blokir traceroute hop probe agar router tersembunyi</span>
                  </label>
                </div>
              </div>
            )}

            {/* 30. Port Knocking */}
            {selectedToolId === 'port-knocking-icmp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN Interface</label>
                    <input
                      type="text"
                      value={pkWan}
                      onChange={(e) => setPkWan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Port (Winbox/SSH)</label>
                    <input
                      type="text"
                      value={pkPort}
                      onChange={(e) => setPkPort(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi Akses Terbuka</label>
                    <input
                      type="text"
                      value={pkDuration}
                      onChange={(e) => setPkDuration(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Knock 1: Ping Packet Size</label>
                    <input
                      type="number"
                      value={pkSize1}
                      onChange={(e) => setPkSize1(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Knock 2: Ping Packet Size</label>
                    <input
                      type="number"
                      value={pkSize2}
                      onChange={(e) => setPkSize2(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jeda Waktu Ketuk</label>
                    <input
                      type="text"
                      value={pkTimeout}
                      onChange={(e) => setPkTimeout(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 31. Advanced Protection */}
            {selectedToolId === 'advanced-router-protection' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={apWan}
                    onChange={(e) => setApWan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="WAN Interface"
                  />
                  <input
                    type="text"
                    value={apLan}
                    onChange={(e) => setApLan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apDropInvalid}
                      onChange={(e) => setApDropInvalid(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Drop Invalid Connections</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apSynFlood}
                      onChange={(e) => setApSynFlood(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Protect Against SYN Flood Attack</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apPortScanners}
                      onChange={(e) => setApPortScanners(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Detect & Blacklist Port Scanners</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apDnsResolver}
                      onChange={(e) => setApDnsResolver(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Block DNS Open-Resolver WAN Abuse</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apWinboxBrute}
                      onChange={(e) => setApWinboxBrute(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Blacklist Winbox Brute Force</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apSshBrute}
                      onChange={(e) => setApSshBrute(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Blacklist SSH Brute Force</span>
                  </label>
                </div>
              </div>
            )}

            {/* 32. Block Websites Generator */}
            {selectedToolId === 'block-websites-gen' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={bwLan}
                    onChange={(e) => setBwLan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                  <select
                    value={bwMethod}
                    onChange={(e) => setBwMethod(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="address-list">Address List + Filter Drop</option>
                    <option value="tls-host">TLS Host Match Drop</option>
                    <option value="dns-static">DNS Static Sinkhole 127.0.0.1</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bwCategories.includes('gambling')}
                      onChange={(e) => {
                        if (e.target.checked) setBwCategories([...bwCategories, 'gambling']);
                        else setBwCategories(bwCategories.filter((c) => c !== 'gambling'));
                      }}
                      className="rounded text-rose-600"
                    />
                    <span>Judi Online</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bwCategories.includes('pornography')}
                      onChange={(e) => {
                        if (e.target.checked) setBwCategories([...bwCategories, 'pornography']);
                        else setBwCategories(bwCategories.filter((c) => c !== 'pornography'));
                      }}
                      className="rounded text-rose-600"
                    />
                    <span>Pornografi</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bwCategories.includes('crypto_mining')}
                      onChange={(e) => {
                        if (e.target.checked) setBwCategories([...bwCategories, 'crypto_mining']);
                        else setBwCategories(bwCategories.filter((c) => c !== 'crypto_mining'));
                      }}
                      className="rounded text-rose-600"
                    />
                    <span>Web Crypto Mining</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bwCategories.includes('piracy')}
                      onChange={(e) => {
                        if (e.target.checked) setBwCategories([...bwCategories, 'piracy']);
                        else setBwCategories(bwCategories.filter((c) => c !== 'piracy'));
                      }}
                      className="rounded text-rose-600"
                    />
                    <span>Torrent & Bajakan</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={bwCustomDomains}
                  onChange={(e) => setBwCustomDomains(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  placeholder="Domain Tambahan (koma pisahkan, misal: domainjahat.com)"
                />
              </div>
            )}

            {/* 33. Auto Backup to Email */}
            {selectedToolId === 'auto-backup-email' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Penerima</label>
                    <input
                      type="email"
                      value={bkEmail}
                      onChange={(e) => setBkEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password Enkripsi Backup</label>
                    <input
                      type="text"
                      value={bkPass}
                      onChange={(e) => setBkPass(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interval Pengiriman</label>
                    <select
                      value={bkInterval}
                      onChange={(e) => setBkInterval(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="1d">Setiap Hari (1d)</option>
                      <option value="7d">Setiap Minggu (7d)</option>
                      <option value="30d">Setiap Bulan (30d)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <input
                    type="text"
                    value={bkTime}
                    onChange={(e) => setBkTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Waktu Eksekusi (02:00:00)"
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={bkExportRsc}
                      onChange={(e) => setBkExportRsc(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Sertakan File Export .rsc (Script Teks Terbuka)</span>
                  </label>
                </div>
              </div>
            )}

            {/* 34. Mangle Obfuscator */}
            {selectedToolId === 'mangle-obfuscator' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tempel Skrip CLI Asli:</label>
                  <textarea
                    rows={4}
                    value={obfScript}
                    onChange={(e) => setObfScript(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={obfStripComments}
                      onChange={(e) => setObfStripComments(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Hapus Seluruh Komentar (Strip Comments)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={obfDecoyRules}
                      onChange={(e) => setObfDecoyRules(e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Sisipkan Decoy Dummy Rules</span>
                  </label>
                </div>
              </div>
            )}

            {/* 35. Block Social Media */}
            {selectedToolId === 'block-social-streaming' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={bsmLan}
                    onChange={(e) => setBsmLan(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="LAN Interface"
                  />
                  <input
                    type="text"
                    value={bsmStart}
                    onChange={(e) => setBsmStart(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Mulai (08:00:00)"
                  />
                  <input
                    type="text"
                    value={bsmEnd}
                    onChange={(e) => setBsmEnd(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Selesai (17:00:00)"
                  />
                  <input
                    type="text"
                    value={bsmDays}
                    onChange={(e) => setBsmDays(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Hari (mon,tue,wed,thu,fri)"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SOCIAL_PRESETS.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bsmPlatforms.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setBsmPlatforms([...bsmPlatforms, p.id]);
                          else setBsmPlatforms(bsmPlatforms.filter((id) => id !== p.id));
                        }}
                        className="rounded text-rose-600"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 36. PCC Calculator */}
            {selectedToolId === 'pcc-calculator' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kecepatan ISP 1 (Mbps)</label>
                    <input
                      type="number"
                      min={1}
                      value={pccSpeed1}
                      onChange={(e) => setPccSpeed1(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kecepatan ISP 2 (Mbps)</label>
                    <input
                      type="number"
                      min={1}
                      value={pccSpeed2}
                      onChange={(e) => setPccSpeed2(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kecepatan ISP 3 (Opsional)</label>
                    <input
                      type="number"
                      min={0}
                      value={pccSpeed3}
                      onChange={(e) => setPccSpeed3(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kecepatan ISP 4 (Opsional)</label>
                    <input
                      type="number"
                      min={0}
                      value={pccSpeed4}
                      onChange={(e) => setPccSpeed4(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 37. Indonesia NTP */}
            {selectedToolId === 'indonesia-ntp-clock' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Zona Waktu Wilayah</label>
                    <select
                      value={ntpTimezone}
                      onChange={(e) => setNtpTimezone(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Asia/Jakarta">WIB - Waktu Indonesia Barat (GMT+7)</option>
                      <option value="Asia/Makassar">WITA - Waktu Indonesia Tengah (GMT+8)</option>
                      <option value="Asia/Jayapura">WIT - Waktu Indonesia Timur (GMT+9)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">NTP Server Pool</label>
                    <input
                      type="text"
                      value={ntpServers}
                      onChange={(e) => setNtpServers(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 38. IP Calculator */}
            {selectedToolId === 'ip-calculator' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IP Address dengan CIDR</label>
                    <input
                      type="text"
                      value={calcIpCidr}
                      onChange={(e) => setCalcIpCidr(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                      placeholder="192.168.10.1/24"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Interface</label>
                    <input
                      type="text"
                      value={calcIface}
                      onChange={(e) => setCalcIface(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {ipCalcDetails && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Network</span>
                      <span className="font-mono font-bold text-slate-800">{ipCalcDetails.network}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Subnet Mask</span>
                      <span className="font-mono font-bold text-slate-800">{ipCalcDetails.netmask}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Broadcast</span>
                      <span className="font-mono font-bold text-slate-800">{ipCalcDetails.broadcast}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-[11px] text-slate-500 block">Usable Host</span>
                      <span className="font-mono font-bold text-slate-800">{ipCalcDetails.usableHosts} Host</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 39. Wifi.id Auto Login */}
            {selectedToolId === 'wifi-id-autologin' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Layanan</label>
                    <select
                      value={wifiLoginType}
                      onChange={(e) => setWifiLoginType(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="wifi_id">@wifi.id Reguler</option>
                      <option value="wms">WMS (Wifi Managed Service)</option>
                      <option value="seamless">Seamless @wifi.id</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WAN / WLAN Interface</label>
                    <input
                      type="text"
                      value={wifiWan}
                      onChange={(e) => setWifiWan(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cek Interval</label>
                    <input
                      type="text"
                      value={wifiInterval}
                      onChange={(e) => setWifiInterval(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={wifiUser}
                    onChange={(e) => setWifiUser(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Username @wifi.id / Nomor HP"
                  />
                  <input
                    type="password"
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    placeholder="Password Akun"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terminal CLI Output Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-slate-700">Skrip CLI MikroTik RouterOS</span>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-white border border-slate-200 text-slate-600">
                  {selectedToolId}.rsc
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTerminalTheme(terminalTheme === 'light' ? 'dark' : 'light')}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                  title="Ganti Tema Terminal"
                >
                  {terminalTheme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-sm shadow-orange-500/20 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Skrip CLI'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRsc}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all"
                  title="Unduh file .rsc untuk import di MikroTik"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .rsc</span>
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div
              className={`p-4 font-mono text-xs overflow-x-auto max-h-[460px] leading-relaxed transition-colors select-text ${
                terminalTheme === 'light'
                  ? 'bg-slate-50/80 text-slate-800 border-t border-slate-100'
                  : 'bg-slate-900 text-emerald-400'
              }`}
            >
              <pre className="whitespace-pre">{generatedScript}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MikroTikToolsPage;
