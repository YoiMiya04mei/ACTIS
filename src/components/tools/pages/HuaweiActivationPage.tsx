import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Info,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  Sun,
  Moon,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import type {
  HuaweiActivationConfig,
  HuaweiStaticRouteItem,
} from '@/types/huaweiActivation';
import {
  DEFAULT_HUAWEI_ACTIVATION_CONFIG,
  formatVlanDescription,
  calculatePeerIp,
  normalizeSubnetMask,
  generateHuaweiActivationScript,
} from '@/utils/huaweiActivationUtils';

interface HuaweiActivationPageProps {
  addToast?: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
  onNavigateDashboard?: () => void;
}

export const HuaweiActivationPage: React.FC<HuaweiActivationPageProps> = ({
  addToast,
  currentUser,
  onNavigateDashboard,
}) => {
  // Access control: Khusus Super Admin
  const isSuperAdmin = !currentUser || currentUser.role === 'admin';

  // State konfigurasi aktivasi
  const [config, setConfig] = useState<HuaweiActivationConfig>(DEFAULT_HUAWEI_ACTIVATION_CONFIG);

  // Tab filter langkah formulir di kolom kiri
  const [formStepTab, setFormStepTab] = useState<'all' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5'>('all');

  // Input interface fisik baru
  const [newInterfaceInput, setNewInterfaceInput] = useState<string>('');

  // Status tampilan terminal preview di kolom kanan
  const [activePreviewTab, setActivePreviewTab] = useState<
    'full' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'undo'
  >('full');
  const [codeTheme, setCodeTheme] = useState<'light' | 'dark'>('light');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedUndo, setCopiedUndo] = useState<boolean>(false);

  // Presets bandwidth classifier & behavior
  const bandwidthPresets = [
    '10MBPS',
    '20MBPS',
    '50MBPS',
    '100MBPS',
    '200MBPS',
    '300MBPS',
    '500MBPS',
    '1GBPS',
    '2GBPS',
    '10GBPS',
  ];

  // Presets netmask
  const vlanifMaskPresets = [
    { label: '/31 (255.255.255.254 - P2P)', value: '255.255.255.254' },
    { label: '/30 (255.255.255.252 - P2P)', value: '255.255.255.252' },
    { label: '/29 (255.255.255.248 - 6 IP)', value: '255.255.255.248' },
    { label: '/28 (255.255.255.240 - 14 IP)', value: '255.255.255.240' },
    { label: '/24 (255.255.255.0 - 254 IP)', value: '255.255.255.0' },
  ];

  // Presets interface fisik umum
  const commonInterfaces = [
    'Eth-Trunk1',
    'Eth-Trunk2',
    'Eth-Trunk3',
    'Eth-Trunk4',
    'GigabitEthernet0/0/1',
    'GigabitEthernet0/0/2',
    '10GE1/0/1',
    '10GE1/0/2',
    'XGigabitEthernet0/0/1',
  ];

  // Sinkronisasi otomatis deskripsi VLAN jika autoFormatVlanDesc aktif
  const currentVlanDesc = useMemo(() => {
    if (config.autoFormatVlanDesc) {
      return formatVlanDescription(config.vlanId, config.serviceName);
    }
    return config.vlanDescription;
  }, [config.autoFormatVlanDesc, config.vlanId, config.serviceName, config.vlanDescription]);

  // Sinkronisasi nama traffic policy jika autoFormatPolicyName aktif
  const currentPolicyName = useMemo(() => {
    if (config.autoFormatPolicyName) {
      return currentVlanDesc;
    }
    return config.trafficPolicyName;
  }, [config.autoFormatPolicyName, currentVlanDesc, config.trafficPolicyName]);

  // Generate skrip
  const scriptResult = useMemo(() => {
    return generateHuaweiActivationScript({
      ...config,
      vlanDescription: currentVlanDesc,
      trafficPolicyName: currentPolicyName,
    });
  }, [config, currentVlanDesc, currentPolicyName]);

  // Teks skrip yang sedang aktif ditampilkan pada preview terminal
  const activeDisplayConfig = useMemo(() => {
    switch (activePreviewTab) {
      case 'step1':
        return scriptResult.step1Vlan;
      case 'step2':
        return scriptResult.step2TrafficPolicy;
      case 'step3':
        return scriptResult.step3Vlanif;
      case 'step4':
        return scriptResult.step4StaticRoute || '# (Tidak ada route static aktif)';
      case 'step5':
        return scriptResult.step5TrunkTagging || '# (Tidak ada interface fisik terdaftar)';
      case 'undo':
        return scriptResult.undoConfig;
      case 'full':
      default:
        return scriptResult.fullConfig;
    }
  }, [activePreviewTab, scriptResult]);

  // Handler Copy
  const handleCopy = async (text: string, isUndo: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isUndo) {
        setCopiedUndo(true);
        setTimeout(() => setCopiedUndo(false), 2000);
      } else {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      }
      if (addToast) {
        addToast('success', 'Skrip Berhasil Disalin', 'Skrip siap dipaste langsung ke Huawei VRP CLI.');
      }
    } catch {
      if (addToast) {
        addToast('error', 'Gagal Menyalin', 'Silakan blok dan salin skrip secara manual.');
      }
    }
  };

  // Handler Download
  const handleDownload = () => {
    const vlanStr = config.vlanId ? `vlan${config.vlanId}` : 'config';
    const filename = `huawei-activation-${vlanStr}.cfg`;
    const blob = new Blob([activeDisplayConfig], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (addToast) {
      addToast('success', 'File Terunduh', `Skrip berhasil disimpan sebagai ${filename}`);
    }
  };

  // Handler Tambah Interface Fisik
  const handleAddInterface = (ifaceName?: string) => {
    const nameToAdd = (ifaceName || newInterfaceInput).trim();
    if (!nameToAdd) return;

    if (config.physicalInterfaces.includes(nameToAdd)) {
      if (addToast) {
        addToast('info', 'Interface Sudah Ada', `Interface ${nameToAdd} sudah ada di daftar tagging.`);
      }
      return;
    }

    setConfig((prev) => ({
      ...prev,
      physicalInterfaces: [...prev.physicalInterfaces, nameToAdd],
    }));
    setNewInterfaceInput('');
  };

  // Handler Hapus Interface Fisik
  const handleRemoveInterface = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      physicalInterfaces: prev.physicalInterfaces.filter((_, i) => i !== index),
    }));
  };

  // Handler Tambah Static Route
  const handleAddStaticRoute = () => {
    const newRoute: HuaweiStaticRouteItem = {
      id: `route-${Date.now()}`,
      destinationIp: '',
      subnetMask: '255.255.255.255',
      nextHopIp: config.vlanifIp ? calculatePeerIp(config.vlanifIp, config.vlanifSubnetMask) || '' : '',
      description: config.serviceName || '',
      enabled: true,
    };
    setConfig((prev) => ({
      ...prev,
      staticRoutes: [...prev.staticRoutes, newRoute],
    }));
  };

  // Handler Update Static Route
  const handleUpdateStaticRoute = (id: string, updates: Partial<HuaweiStaticRouteItem>) => {
    setConfig((prev) => ({
      ...prev,
      staticRoutes: prev.staticRoutes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  };

  // Handler Hapus Static Route
  const handleRemoveStaticRoute = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      staticRoutes: prev.staticRoutes.filter((r) => r.id !== id),
    }));
  };

  // Auto-fill Peer IP ke Next-Hop Static Route
  const handleAutoFillPeerIp = () => {
    const peer = calculatePeerIp(config.vlanifIp, config.vlanifSubnetMask);
    if (!peer) {
      if (addToast) {
        addToast('error', 'Gagal Menghitung Peer IP', 'Pastikan IP Vlanif valid dan subnet mask berupa /31 atau /30.');
      }
      return;
    }

    setConfig((prev) => ({
      ...prev,
      staticRoutes: prev.staticRoutes.map((r, i) => (i === 0 ? { ...r, nextHopIp: peer } : r)),
    }));

    if (addToast) {
      addToast('success', 'Next-Hop Terisi Otomatis', `Peer IP dihitung: ${peer}`);
    }
  };

  // Reset form ke contoh default
  const handleResetDefault = () => {
    setConfig(DEFAULT_HUAWEI_ACTIVATION_CONFIG);
    if (addToast) {
      addToast('info', 'Form Direset', 'Data formulir telah dikembalikan ke data contoh default.');
    }
  };

  // Kosongkan form
  const handleClearForm = () => {
    setConfig({
      vlanId: '',
      serviceName: '',
      vlanDescription: '',
      autoFormatVlanDesc: true,
      trafficPolicyName: '',
      autoFormatPolicyName: true,
      classifierName: '',
      behaviorName: '',
      precedence: 1,
      shareMode: true,
      vlanifIp: '',
      vlanifSubnetMask: '255.255.255.254',
      statisticEnable: true,
      applyInboundPolicy: true,
      applyOutboundPolicy: true,
      enableStaticRoute: true,
      staticRoutes: [
        {
          id: `route-${Date.now()}`,
          destinationIp: '',
          subnetMask: '255.255.255.255',
          nextHopIp: '',
          description: '',
          enabled: true,
        },
      ],
      physicalInterfaces: [],
    });
    if (addToast) {
      addToast('info', 'Form Dikosongkan', 'Formulir telah dikosongkan untuk aktivasi baru.');
    }
  };

  // Jika bukan Super Admin, tampilkan halaman blokir akses
  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-slate-50 p-4 sm:p-8 justify-center items-center">
        <div className="bg-white border border-rose-200 rounded-2xl p-6 sm:p-10 shadow-xs text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Akses Ditolak: Khusus Super Admin</h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
            Fitur <strong>Aktivasi Huawei</strong> hanya dapat diakses oleh akun dengan wewenang level{' '}
            <strong className="text-rose-600">Super Admin</strong>.
          </p>
          {onNavigateDashboard && (
            <button
              onClick={onNavigateDashboard}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Kembali ke Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Banner (Persis bergaya Traffic QoS) */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                Khusus Super Admin
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Huawei VRP Engine • 5-Step Activation Sequence
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              Aktivasi Layanan Huawei (VRP Script Generator)
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Otomatisasi pembuatan konfigurasi aktivasi router & switch Huawei berurutan:{' '}
              <strong className="text-slate-800">1. VLAN</strong> →{' '}
              <strong className="text-slate-800">2. Traffic Policy</strong> →{' '}
              <strong className="text-slate-800">3. Vlanif</strong> →{' '}
              <strong className="text-slate-800">4. Route Static</strong> →{' '}
              <strong className="text-slate-800">5. Trunk Tagging</strong>.
            </p>
          </div>

          {/* Quick Buttons on Top Right */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={handleResetDefault}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Muat contoh default GIA_CICURUG(TELKOM)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Muat Contoh Default</span>
            </button>
            <button
              type="button"
              onClick={handleClearForm}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Kosongkan form untuk aktivasi baru"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kosongkan Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Inputs (Left: 5 Cols) & Terminal Preview (Right: 7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column: Form Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            {/* Form Header with Badge */}
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Form Konfigurasi Aktivasi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi parameter layanan pelanggan sesuai urutan eksekusi
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                VLAN {config.vlanId || '3191'}
              </span>
            </div>

            {/* Step Tabs Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto no-scrollbar text-xs">
              {[
                { id: 'all' as const, label: 'Semua Step' },
                { id: 'step1' as const, label: '1. Vlan' },
                { id: 'step2' as const, label: '2. Policy' },
                { id: 'step3' as const, label: '3. Vlanif' },
                { id: 'step4' as const, label: '4. Route' },
                { id: 'step5' as const, label: '5. Trunk' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormStepTab(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    formStepTab === tab.id
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* STEP 1: Penambahan VLAN */}
            {(formStepTab === 'all' || formStepTab === 'step1') && (
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-slate-900">Penambahan VLAN</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">vlan &lt;id&gt;</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      VLAN ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.vlanId}
                      onChange={(e) => setConfig({ ...config, vlanId: e.target.value.replace(/\D/g, '') })}
                      placeholder="3191"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Layanan / Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.serviceName}
                      onChange={(e) => setConfig({ ...config, serviceName: e.target.value })}
                      placeholder="GIA_CICURUG(TELKOM)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">Deskripsi VLAN:</label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.autoFormatVlanDesc}
                        onChange={(e) => setConfig({ ...config, autoFormatVlanDesc: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Format otomatis (VLAN-[ID]-[NAMA])</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={currentVlanDesc}
                    disabled={config.autoFormatVlanDesc}
                    onChange={(e) => setConfig({ ...config, vlanDescription: e.target.value })}
                    placeholder="VLAN-3191-GIA_CICURUG(TELKOM)"
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono ${
                      config.autoFormatVlanDesc
                        ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Penambahan Traffic Policy */}
            {(formStepTab === 'all' || formStepTab === 'step2') && (
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-bold text-slate-900">Penambahan Traffic Policy</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">traffic policy</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">Nama Traffic Policy:</label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.autoFormatPolicyName}
                        onChange={(e) => setConfig({ ...config, autoFormatPolicyName: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Sama dengan Deskripsi VLAN</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={currentPolicyName}
                    disabled={config.autoFormatPolicyName}
                    onChange={(e) => setConfig({ ...config, trafficPolicyName: e.target.value })}
                    placeholder="VLAN-3191-GIA_CICURUG(TELKOM)"
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono ${
                      config.autoFormatPolicyName
                        ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Classifier <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.classifierName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig({
                          ...config,
                          classifierName: val,
                          behaviorName: config.behaviorName === config.classifierName ? val : config.behaviorName,
                        });
                      }}
                      placeholder="200MBPS"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Behavior <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.behaviorName}
                      onChange={(e) => setConfig({ ...config, behaviorName: e.target.value })}
                      placeholder="200MBPS"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Precedence
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={config.precedence}
                      onChange={(e) => setConfig({ ...config, precedence: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Presets Bandwidth */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Preset Bandwidth Cepat:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {bandwidthPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setConfig({ ...config, classifierName: preset, behaviorName: preset })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                          config.classifierName === preset
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={config.shareMode}
                    onChange={(e) => setConfig({ ...config, shareMode: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Aktifkan <strong>share-mode</strong>
                  </span>
                </label>
              </div>
            )}

            {/* STEP 3: Penambahan Interfaces Vlanif */}
            {(formStepTab === 'all' || formStepTab === 'step3') && (
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs font-bold text-slate-900">Penambahan Interfaces Vlanif</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">interface Vlanif{config.vlanId || '3191'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      IP Address Vlanif <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.vlanifIp}
                      onChange={(e) => setConfig({ ...config, vlanifIp: e.target.value })}
                      placeholder="10.100.91.118"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subnet Mask <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.vlanifSubnetMask}
                      onChange={(e) => setConfig({ ...config, vlanifSubnetMask: e.target.value })}
                      placeholder="255.255.255.254"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Mask Presets */}
                <div className="flex flex-wrap gap-1">
                  {vlanifMaskPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setConfig({ ...config, vlanifSubnetMask: preset.value })}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                        normalizeSubnetMask(config.vlanifSubnetMask) === preset.value
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.statisticEnable}
                      onChange={(e) => setConfig({ ...config, statisticEnable: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>statistic enable</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.applyInboundPolicy}
                      onChange={(e) => setConfig({ ...config, applyInboundPolicy: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>policy inbound</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.applyOutboundPolicy}
                      onChange={(e) => setConfig({ ...config, applyOutboundPolicy: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>policy outbound</span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 4: Penambahan Router Static */}
            {(formStepTab === 'all' || formStepTab === 'step4') && (
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      4
                    </span>
                    <span className="text-xs font-bold text-slate-900">Penambahan Router Static</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enableStaticRoute}
                      onChange={(e) => setConfig({ ...config, enableStaticRoute: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Aktifkan</span>
                  </label>
                </div>

                {config.enableStaticRoute && (
                  <div className="space-y-2.5">
                    {/* Auto-fill peer IP */}
                    <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-lg px-2.5 py-1.5 text-[11px]">
                      <span className="text-blue-800">
                        Peer IP: <strong className="font-mono">{calculatePeerIp(config.vlanifIp, config.vlanifSubnetMask) || '-'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoFillPeerIp}
                        className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] transition-colors cursor-pointer"
                      >
                        Auto-fill Next-Hop
                      </button>
                    </div>

                    {config.staticRoutes.map((route, idx) => (
                      <div key={route.id} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Route #{idx + 1}
                          </span>
                          {config.staticRoutes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStaticRoute(route.id)}
                              className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Dest IP:</label>
                            <input
                              type="text"
                              value={route.destinationIp}
                              onChange={(e) => handleUpdateStaticRoute(route.id, { destinationIp: e.target.value })}
                              placeholder="103.97.140.151"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mask:</label>
                            <input
                              type="text"
                              value={route.subnetMask}
                              onChange={(e) => handleUpdateStaticRoute(route.id, { subnetMask: e.target.value })}
                              placeholder="255.255.255.255"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Next-Hop:</label>
                            <input
                              type="text"
                              value={route.nextHopIp}
                              onChange={(e) => handleUpdateStaticRoute(route.id, { nextHopIp: e.target.value })}
                              placeholder="10.100.91.119"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Deskripsi:</label>
                          <input
                            type="text"
                            value={route.description}
                            onChange={(e) => handleUpdateStaticRoute(route.id, { description: e.target.value })}
                            placeholder={config.serviceName || 'GIA_CICURUG(TELKOM)'}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddStaticRoute}
                      className="w-full py-1.5 border border-dashed border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Route Static</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Tagging VLAN pada Interface Fisik */}
            {(formStepTab === 'all' || formStepTab === 'step5') && (
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      5
                    </span>
                    <span className="text-xs font-bold text-slate-900">Tagging VLAN Interface Fisik</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">bisa lebih dari 1</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newInterfaceInput}
                    onChange={(e) => setNewInterfaceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInterface();
                      }
                    }}
                    placeholder="Contoh: Eth-Trunk4 atau 10GE1/0/1"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddInterface()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {/* Preset Chips */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                    Preset Interface Cepat:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {commonInterfaces.map((iface) => {
                      const isSelected = config.physicalInterfaces.includes(iface);
                      return (
                        <button
                          key={iface}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              const idx = config.physicalInterfaces.indexOf(iface);
                              handleRemoveInterface(idx);
                            } else {
                              handleAddInterface(iface);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? `✓ ${iface}` : `+ ${iface}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daftar Tagged Interfaces */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-700 block">
                    Daftar Interface Fisik ({config.physicalInterfaces.length}):
                  </span>
                  {config.physicalInterfaces.length === 0 ? (
                    <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400">
                      Belum ada interface fisik terdaftar.
                    </div>
                  ) : (
                    config.physicalInterfaces.map((iface, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center font-sans">
                            {index + 1}
                          </span>
                          <span className="font-bold text-slate-800">{iface}</span>
                          <span className="text-slate-400 font-sans text-[10px]">
                            → allow-pass vlan {config.vlanId || '3191'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInterface(index)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Explanation / Formula Card (Persis posisi kiri bawah seperti Traffic QoS) */}
          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Panduan Formula &amp; Spesifikasi Aktivasi Huawei:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-5 list-disc">
              <li>
                <strong className="text-slate-800">1. VLAN &amp; Deskripsi</strong>: Membuat ID VLAN (1-4094) dan deskripsi layanan pelanggan dengan pola <code>VLAN-[ID]-[NAMA]</code>.
              </li>
              <li>
                <strong className="text-slate-800">2. Traffic Policy &amp; Share-mode</strong>: Mengikat classifier bandwidth dan behavior dengan mode <code>share-mode</code> untuk alokasi terpusat.
              </li>
              <li>
                <strong className="text-slate-800">3. Vlanif &amp; P2P Subnet</strong>: Local gateway router. Mendukung subnet <code>/31 (RFC 3021)</code> dan <code>/30</code> dengan policy inbound/outbound.
              </li>
              <li>
                <strong className="text-slate-800">4. Route Static</strong>: Meneruskan blok IP publik pelanggan menuju peer next-hop di sisi perangkat pelanggan.
              </li>
              <li>
                <strong className="text-slate-800">5. Trunk Tagging</strong>: Menambahkan tagging allow-pass pada satu atau lebih interface fisik (Eth-Trunk / 10GE).
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Code Preview & Terminal Box (7 Cols, Persis Traffic QoS) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className={`rounded-2xl overflow-hidden flex flex-col transition-all ${
              codeTheme === 'light'
                ? 'bg-white border border-slate-200 shadow-xs'
                : 'bg-slate-900 border border-slate-800 shadow-xl'
            }`}
          >
            {/* Terminal Top Window Bar */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${
                codeTheme === 'light'
                  ? 'bg-slate-100/90 border-slate-200'
                  : 'bg-slate-950 border-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Traffic lights dots */}
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div
                  className={`flex items-center gap-2 text-xs font-mono font-medium ${
                    codeTheme === 'light' ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  <FileCode className={`w-4 h-4 ${codeTheme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                  <span>
                    huawei-activation-vlan{config.vlanId || '3191'}.cfg
                  </span>
                </div>
              </div>

              {/* Action Buttons: Copy, Download, Theme Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(activeDisplayConfig, activePreviewTab === 'undo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    (activePreviewTab === 'undo' ? copiedUndo : copiedScript)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                  }`}
                  title="Salin skrip ke clipboard"
                >
                  {(activePreviewTab === 'undo' ? copiedUndo : copiedScript) ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{activePreviewTab === 'undo' ? 'Salin Undo Skrip' : 'Salin Skrip'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    codeTheme === 'light'
                      ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-800 border border-slate-300/60'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Download file .cfg"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download .cfg</span>
                </button>

                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={() => setCodeTheme(codeTheme === 'light' ? 'dark' : 'light')}
                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center ${
                    codeTheme === 'light'
                      ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-700 border border-slate-300/60'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                  }`}
                  title={codeTheme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}
                >
                  {codeTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Sub-tab view inside terminal */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs overflow-x-auto no-scrollbar ${
                codeTheme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-600'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('full')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'full'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Skrip Lengkap
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('step1')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'step1'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  1. VLAN
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('step2')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'step2'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  2. Policy
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('step3')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'step3'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  3. Vlanif
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('step4')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'step4'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  4. Route
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('step5')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'step5'
                      ? codeTheme === 'light'
                        ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                        : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  5. Trunk
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('undo')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                    activePreviewTab === 'undo'
                      ? codeTheme === 'light'
                        ? 'bg-amber-50 text-amber-800 font-bold border border-amber-300 shadow-xs'
                        : 'bg-slate-800 text-amber-300 font-bold border border-slate-700'
                      : codeTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rollback / Undo</span>
                </button>
              </div>

              <span
                className={`text-[11px] font-mono hidden md:inline ${
                  codeTheme === 'light' ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                {activeDisplayConfig.split('\n').filter(Boolean).length} Baris
              </span>
            </div>

            {/* Code Body */}
            <div
              className={`p-4 sm:p-5 font-mono text-xs sm:text-sm overflow-x-auto min-h-[300px] max-h-[580px] transition-colors ${
                codeTheme === 'light'
                  ? 'bg-slate-50/70 text-slate-800 selection:bg-blue-100'
                  : 'bg-slate-950/60 text-slate-200 selection:bg-blue-600/40'
              }`}
            >
              <pre className="leading-relaxed whitespace-pre font-mono">
                {activeDisplayConfig}
              </pre>
            </div>

            {/* Terminal Footer Status Bar */}
            <div
              className={`px-4 py-2 border-t flex items-center justify-between text-[11px] font-mono flex-wrap gap-2 ${
                codeTheme === 'light'
                  ? 'bg-slate-100/90 border-slate-200 text-slate-600'
                  : 'bg-slate-950 border-slate-800/80 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>VRP Konfigurasi Valid</span>
                </span>
                <span>•</span>
                <span>VLAN: {config.vlanId || '3191'}</span>
                <span>•</span>
                <span className="truncate max-w-[200px]">
                  Target: {config.serviceName || 'GIA_CICURUG(TELKOM)'}
                </span>
              </div>
              <div className={codeTheme === 'light' ? 'text-slate-500' : 'text-slate-500'}>
                PT Jembatan Data Pangrango Tools
              </div>
            </div>
          </div>

          {/* Quick Workflow Tips Card (Persis Traffic QoS) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-xs space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Langkah Eksekusi di Router / Switch Huawei:
            </h3>
            <ol className="space-y-1.5 text-slate-600 pl-5 list-decimal">
              <li>
                Buka terminal CLI console/SSH router, ketik{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">system-view</code>.
              </li>
              <li>
                Klik tombol <strong>Salin Skrip</strong> di atas, lalu paste langsung ke terminal CLI.
              </li>
              <li>
                Cek hasil konfigurasi dengan perintah:{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">
                  display current-configuration interface Vlanif{config.vlanId || '3191'}
                </code>
                .
              </li>
              <li>
                Jika ingin membatalkan/rollback, gunakan tab <strong>Rollback / Undo</strong> lalu paste perintah rollback.
              </li>
              <li>
                Ketik <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">return</code> lalu{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">save</code> untuk menyimpan konfigurasi ke memory router.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HuaweiActivationPage;
