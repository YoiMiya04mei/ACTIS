import React, { useState, useMemo } from 'react';
import {
  Network,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sliders,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  FileCode,
  ShieldCheck,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import type { BandwidthUnit, GbpsConversionMode, TrafficQoSOptions } from '@/types/trafficQos';
import type { ToastMessage } from '@/components/tools/Toast';
import {
  generateTrafficQoS,
  formatSpeedName,
  parseBandwidthString,
  parseBatchBandwidths,
} from '@/utils/trafficQosUtils';

interface TrafficQoSPageProps {
  addToast?: (type: ToastMessage['type'], title: string, message?: string) => void;
}

export const TrafficQoSPage: React.FC<TrafficQoSPageProps> = ({ addToast }) => {
  // Mode: 'single' | 'batch'
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single Mode States
  const [speedInput, setSpeedInput] = useState<string>('100');
  const [unit, setUnit] = useState<BandwidthUnit>('MBPS');
  const [customName, setCustomName] = useState<string>('');
  const [useCustomName, setUseCustomName] = useState<boolean>(false);
  const [gbpsConversionMode, setGbpsConversionMode] = useState<GbpsConversionMode>('direct');

  // Advanced Options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [operator, setOperator] = useState<'or' | 'and'>('or');
  const [matchCondition, setMatchCondition] = useState<string>('if-match any');
  const [action, setAction] = useState<string>('green pass yellow pass red discard');
  const [includeTrafficPolicy, setIncludeTrafficPolicy] = useState<boolean>(false);
  const [includeInterfaceExample, setIncludeInterfaceExample] = useState<boolean>(false);
  const [interfaceName, setInterfaceName] = useState<string>('GigabitEthernet0/0/1');

  // Batch Mode States
  const [batchInput, setBatchInput] = useState<string>(
    '10M, 20M, 50M, 100M, 1,2G, 200M, 500M, 1G'
  );

  // Copy feedback state
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);
  const [copiedUndo, setCopiedUndo] = useState<boolean>(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'config' | 'undo' | 'behavior' | 'classifier'>('config');
  const [codeTheme, setCodeTheme] = useState<'light' | 'dark'>('light');

  // Quick preset bandwidth buttons
  const presets = [
    { label: '5 Mbps', speed: 5, unit: 'MBPS' as BandwidthUnit },
    { label: '10 Mbps', speed: 10, unit: 'MBPS' as BandwidthUnit },
    { label: '20 Mbps', speed: 20, unit: 'MBPS' as BandwidthUnit },
    { label: '25 Mbps', speed: 25, unit: 'MBPS' as BandwidthUnit },
    { label: '50 Mbps', speed: 50, unit: 'MBPS' as BandwidthUnit },
    { label: '75 Mbps', speed: 75, unit: 'MBPS' as BandwidthUnit },
    { label: '100 Mbps', speed: 100, unit: 'MBPS' as BandwidthUnit },
    { label: '150 Mbps', speed: 150, unit: 'MBPS' as BandwidthUnit },
    { label: '200 Mbps', speed: 200, unit: 'MBPS' as BandwidthUnit },
    { label: '300 Mbps', speed: 300, unit: 'MBPS' as BandwidthUnit },
    { label: '500 Mbps', speed: 500, unit: 'MBPS' as BandwidthUnit },
    { label: '1 Gbps', speed: 1, unit: 'GBPS' as BandwidthUnit },
    { label: '1,2 Gbps', speed: 1.2, unit: 'GBPS' as BandwidthUnit, raw: '1,2' },
    { label: '2 Gbps', speed: 2, unit: 'GBPS' as BandwidthUnit },
    { label: '2,5 Gbps', speed: 2.5, unit: 'GBPS' as BandwidthUnit, raw: '2,5' },
    { label: '5 Gbps', speed: 5, unit: 'GBPS' as BandwidthUnit },
    { label: '10 Gbps', speed: 10, unit: 'GBPS' as BandwidthUnit },
  ];

  // Number validation (mendukung koma ',' dan titik '.')
  const parsedSpeed = useMemo(() => {
    if (!speedInput) return 0;
    const clean = speedInput.trim().replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? 0 : num;
  }, [speedInput]);

  // Options object
  const currentOptions: TrafficQoSOptions = useMemo(() => ({
    customName: useCustomName ? customName : undefined,
    rawInput: speedInput,
    operator,
    matchCondition,
    action,
    includeTrafficPolicy,
    includeInterfaceExample,
    interfaceName,
    gbpsConversionMode,
  }), [
    useCustomName,
    customName,
    speedInput,
    operator,
    matchCondition,
    action,
    includeTrafficPolicy,
    includeInterfaceExample,
    interfaceName,
    gbpsConversionMode,
  ]);

  // Single Result
  const singleResult = useMemo(() => {
    return generateTrafficQoS(parsedSpeed, unit, currentOptions);
  }, [parsedSpeed, unit, currentOptions]);

  // Batch Result
  const batchParsed = useMemo(() => {
    return parseBatchBandwidths(batchInput);
  }, [batchInput]);

  const batchResults = useMemo(() => {
    return batchParsed.map((item) =>
      generateTrafficQoS(item.speed, item.unit, currentOptions)
    );
  }, [batchParsed, currentOptions]);

  const batchFullConfig = useMemo(() => {
    if (batchResults.length === 0) return '# Tidak ada entri kecepatan yang valid.';
    return batchResults.map((r) => r.fullConfig.trim()).join('\n\n') + '\n';
  }, [batchResults]);

  const batchUndoConfig = useMemo(() => {
    if (batchResults.length === 0) return '# Tidak ada entri kecepatan yang valid.';
    return batchResults.map((r) => r.undoConfig.trim()).join('\n\n') + '\n';
  }, [batchResults]);

  // Active display config based on mode and tab
  const activeDisplayConfig = useMemo(() => {
    if (mode === 'batch') {
      return activePreviewTab === 'undo' ? batchUndoConfig : batchFullConfig;
    }
    switch (activePreviewTab) {
      case 'classifier':
        return singleResult.trafficClassifierConfig;
      case 'behavior':
        return singleResult.trafficBehaviorConfig;
      case 'undo':
        return singleResult.undoConfig;
      case 'config':
      default:
        return singleResult.fullConfig;
    }
  }, [mode, activePreviewTab, singleResult, batchFullConfig, batchUndoConfig]);

  // Copy Handler
  const handleCopy = async (text: string, isUndo = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isUndo) {
        setCopiedUndo(true);
        setTimeout(() => setCopiedUndo(false), 2000);
      } else {
        setCopiedConfig(true);
        setTimeout(() => setCopiedConfig(false), 2000);
      }
      addToast?.('success', 'Tersalin ke Clipboard', 'Konfigurasi QoS siap di-paste ke terminal CLI.');
    } catch {
      addToast?.('error', 'Gagal Menyalin', 'Silakan pilih dan salin teks secara manual.');
    }
  };

  // Download Handler (.cfg)
  const handleDownload = () => {
    const text = activeDisplayConfig;
    const filename =
      mode === 'batch'
        ? 'huawei-qos-batch.cfg'
        : `huawei-qos-${singleResult.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.cfg`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast?.('success', 'File Terunduh', `File ${filename} berhasil disimpan.`);
  };

  // Preset Click Handler
  const handleSelectPreset = (pSpeed: number, pUnit: BandwidthUnit, raw?: string) => {
    setSpeedInput(raw || pSpeed.toString());
    setUnit(pUnit);
    if (!useCustomName) {
      setCustomName(formatSpeedName(pSpeed, pUnit, raw));
    }
  };

  // Smart free-text input
  const handleQuickTextInput = (text: string) => {
    const parsed = parseBandwidthString(text);
    if (parsed) {
      setSpeedInput(parsed.speed.toString());
      setUnit(parsed.unit);
      if (!useCustomName) {
        setCustomName(formatSpeedName(parsed.speed, parsed.unit, text));
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-blue-600" />
                Huawei VRP QoS Generator
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Mendukung Koma (1,2 Gbps) • CIR/PIR/CBS/PBS (×8)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Traffic Classifier & Traffic Behavior Generator
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Otomatisasi pembuatan skrip QoS CAR rate-limiting untuk router dan switch Huawei. Masukkan kecepatan (termasuk desimal berkoma seperti <strong className="text-slate-800">1,2 GBPS</strong> atau <strong className="text-slate-800">100 MBPS</strong>), sistem langsung mengonversi ke satuan <strong className="text-slate-800">kbps (CIR/PIR)</strong> dan mengalikan delapan untuk <strong className="text-slate-800">cbs & pbs</strong>.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setActivePreviewTab('config');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'single'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Satu Kecepatan (Single)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('batch');
                setActivePreviewTab('config');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'batch'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Banyak Sekaligus (Batch)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Input (Left) & Live Script Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Left Column: Generator Inputs */}
        <div className="lg:col-span-5 space-y-4">
          {mode === 'single' ? (
            /* Single Generator Form */
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    Input Kecepatan Bandwidth
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bisa angka bulat maupun desimal berkoma (misal: <code>100</code> atau <code>1,2</code>)
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {singleResult.name}
                </span>
              </div>

              {/* Input Value & Unit Selector (Mendukung Koma & Titik) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Kecepatan Bandwidth
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Mendukung koma (<code>,</code>) & titik (<code>.</code>)
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={speedInput}
                      onChange={(e) => {
                        // Hanya menerima angka, koma (,), dan titik (.)
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        setSpeedInput(val);
                      }}
                      placeholder="Contoh: 100 atau 1,2"
                      className="w-full pl-3.5 pr-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold text-base focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    />
                  </div>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as BandwidthUnit)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-bold text-xs bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="MBPS">MBPS (Mbps)</option>
                    <option value="GBPS">GBPS (Gbps)</option>
                    <option value="KBPS">KBPS (Kbps)</option>
                    <option value="TBPS">TBPS (Tbps)</option>
                  </select>
                </div>

                {/* Quick Free-Text Parser */}
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Atau ketik cepat cth: 1,2GBPS, 1G 200M, 100M, 500k..."
                    onChange={(e) => handleQuickTextInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-slate-50 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Basis Penjelasan Desimal GBPS jika unit === 'GBPS' */}
              {unit === 'GBPS' && (
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Nilai Bandwidth {speedInput} GBPS:
                    </span>
                    <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                      ≈ {singleResult.equivalentMbps?.toLocaleString('id-ID')} MBPS{' '}
                      {parsedSpeed % 1 !== 0 && (
                        <span className="text-slate-500 font-normal">
                          ({Math.floor(parsedSpeed)}G {Math.round((parsedSpeed - Math.floor(parsedSpeed)) * 1000)}MBPS)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-600 block font-medium">
                      Pilihan Metode Konversi ke Kbps:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {/* Mode 1: Direct Binary */}
                      <button
                        type="button"
                        onClick={() => setGbpsConversionMode('direct')}
                        className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                          gbpsConversionMode === 'direct'
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="text-[11px] font-bold">1. Langsung Konversi Biner</div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            gbpsConversionMode === 'direct' ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {parsedSpeed} × 1024 × 1024 ={' '}
                          {Math.round(parsedSpeed * 1024 * 1024).toLocaleString('id-ID')} Kbps
                        </div>
                      </button>

                      {/* Mode 2: Decimal Telecom 1G = 1000M */}
                      <button
                        type="button"
                        onClick={() => setGbpsConversionMode('decimal')}
                        className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                          gbpsConversionMode === 'decimal'
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="text-[11px] font-bold">2. Nilai 1G 200MBPS (1200M)</div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            gbpsConversionMode === 'decimal' ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {Math.round(parsedSpeed * 1000)}M × 1024 ={' '}
                          {Math.round(parsedSpeed * 1000 * 1024).toLocaleString('id-ID')} Kbps
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Bandwidth Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Pilihan Cepat (Preset Bandwidth):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => {
                    const isSelected = parsedSpeed === p.speed && unit === p.unit;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handleSelectPreset(p.speed, p.unit, p.raw)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Conversion Metrics Cards */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Hasil Kalkulasi Otomatis:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* CIR */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">car cir (Kbps)</div>
                    <div className="text-sm font-black text-blue-700 font-mono mt-0.5">
                      {singleResult.cir.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {unit === 'GBPS' && gbpsConversionMode === 'decimal'
                        ? `${Math.round(parsedSpeed * 1000)} Mbps × 1024`
                        : `${speedInput} ${unit} → kbps`}
                    </div>
                  </div>

                  {/* PIR */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">pir (Kbps)</div>
                    <div className="text-sm font-black text-blue-700 font-mono mt-0.5">
                      {singleResult.pir.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Sama dengan CIR</div>
                  </div>

                  {/* CBS */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">cbs (Bytes)</div>
                    <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                      {singleResult.cbs.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      cir × 8 ({singleResult.cir.toLocaleString('id-ID')} × 8)
                    </div>
                  </div>

                  {/* PBS */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">pbs (Bytes)</div>
                    <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                      {singleResult.pbs.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      pir × 8 ({singleResult.pir.toLocaleString('id-ID')} × 8)
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Name Override & Suggested Names */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomName}
                      onChange={(e) => {
                        setUseCustomName(e.target.checked);
                        if (!e.target.checked) {
                          setCustomName('');
                        } else if (!customName) {
                          setCustomName(singleResult.name);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Kustomisasi Nama Classifier & Behavior</span>
                  </label>
                  {!useCustomName && (
                    <span className="text-[10px] text-slate-400">
                      Otomatis: <strong>{singleResult.name}</strong>
                    </span>
                  )}
                </div>

                {useCustomName && (
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={`Contoh: ${singleResult.name}`}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                )}

                {/* Saran Pilihan Nama Instan */}
                {singleResult.suggestedNames && singleResult.suggestedNames.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                    <span className="text-[10px] text-slate-400 font-medium">Format Nama Lain:</span>
                    {singleResult.suggestedNames.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          setUseCustomName(true);
                          setCustomName(sug);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                          singleResult.name === sug
                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Settings Collapsible */}
              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    Pengaturan Lanjutan (Match, Action, Policy)
                  </span>
                  <span className="text-[10px] text-blue-600">
                    {showAdvanced ? 'Tutup ▲' : 'Buka ▼'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    {/* Operator */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Operator Classifier:
                      </label>
                      <select
                        value={operator}
                        onChange={(e) => setOperator(e.target.value as 'or' | 'and')}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      >
                        <option value="or">operator or (Default)</option>
                        <option value="and">operator and</option>
                      </select>
                    </div>

                    {/* Match Condition */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Kondisi Match:
                      </label>
                      <input
                        type="text"
                        value={matchCondition}
                        onChange={(e) => setMatchCondition(e.target.value)}
                        placeholder="if-match any"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400">
                        Default: <code>if-match any</code> (Bisa diganti ACL misal:{' '}
                        <code>if-match acl 3000</code>)
                      </span>
                    </div>

                    {/* Action */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Aksi Warna Token (CAR Action):
                      </label>
                      <input
                        type="text"
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        placeholder="green pass yellow pass red discard"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>

                    {/* Checkbox: Include Traffic Policy */}
                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={includeTrafficPolicy}
                          onChange={(e) => setIncludeTrafficPolicy(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Sertakan blok <strong>traffic policy</strong>
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={includeInterfaceExample}
                          onChange={(e) => setIncludeInterfaceExample(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          Sertakan contoh binding ke <strong>interface</strong>
                        </span>
                      </label>

                      {includeInterfaceExample && (
                        <div className="pl-6 pt-1">
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            Nama Interface:
                          </label>
                          <input
                            type="text"
                            value={interfaceName}
                            onChange={(e) => setInterfaceName(e.target.value)}
                            placeholder="GigabitEthernet0/0/1"
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Batch Generator Form */
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Mode Batch (Banyak Kecepatan Sekaligus)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan daftar kecepatan dipisahkan koma atau baris baru (mendukung <code>1,2G</code>, <code>2,5G</code>, dll.)
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Daftar Bandwidth
                </label>
                <textarea
                  rows={5}
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="Contoh: 10M, 20M, 50M, 100M, 1,2G, 200M, 500M, 1G"
                  className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-[11px] text-slate-500">
                  Format yang didukung: <code>100MBPS</code>, <code>1,2GBPS</code>, <code>1.2G</code>, <code>1G 200M</code>, <code>500k</code>.
                </p>
              </div>

              {/* Batch Summary Table */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Ringkasan Entri ({batchResults.length} tier terdeteksi):
                </span>
                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-2">CIR (Kbps)</th>
                        <th className="py-2 px-2">CBS (Bytes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 font-mono">
                          <td className="py-1.5 px-3 font-bold text-blue-700">{item.name}</td>
                          <td className="py-1.5 px-2 text-slate-700">
                            {item.cir.toLocaleString('id-ID')}
                          </td>
                          <td className="py-1.5 px-2 text-emerald-700">
                            {item.cbs.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Quick Explanation & Formula Card */}
          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Panduan Formula Huawei VRP QoS:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-5 list-disc">
              <li>
                <strong className="text-slate-800">car cir</strong> (Committed Information Rate):
                Kecepatan terjamin yang dihitung dalam satuan <strong>kbps</strong>. Untuk <code>100 MBPS</code> = 100 × 1024 = 102.400 Kbps.
              </li>
              <li>
                <strong className="text-slate-800">Kecepatan Desimal (1,2 GBPS)</strong>: Dapat langsung dikonversi biner (1.2 × 1024 × 1024 = 1.258.291 Kbps) atau secara nilai 1G 200MBPS (1.200 Mbps × 1024 = 1.228.800 Kbps).
              </li>
              <li>
                <strong className="text-slate-800">pir</strong> (Peak Information Rate): Disamakan dengan CIR untuk pembatasan ketat.
              </li>
              <li>
                <strong className="text-slate-800">cbs & pbs</strong> (Burst Sizes): Dihitung dari{' '}
                <strong>CIR × 8</strong> bytes (sesuai spesifikasi token bucket rate-limiting).
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Code Preview & Terminal Box */}
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
                    {mode === 'batch'
                      ? `huawei-qos-batch-${batchResults.length}-tiers.cfg`
                      : `huawei-qos-${singleResult.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.cfg`}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Copy, Undo, Download, Theme Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(activeDisplayConfig, activePreviewTab === 'undo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    (activePreviewTab === 'undo' ? copiedUndo : copiedConfig)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                  }`}
                  title="Salin skrip ke clipboard"
                >
                  {(activePreviewTab === 'undo' ? copiedUndo : copiedConfig) ? (
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
                  onClick={() => setActivePreviewTab('config')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    activePreviewTab === 'config'
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

                {mode === 'single' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActivePreviewTab('classifier')}
                      className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                        activePreviewTab === 'classifier'
                          ? codeTheme === 'light'
                            ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                            : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                          : codeTheme === 'light'
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Hanya Classifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePreviewTab('behavior')}
                      className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                        activePreviewTab === 'behavior'
                          ? codeTheme === 'light'
                            ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs'
                            : 'bg-slate-800 text-blue-300 font-bold border border-slate-700'
                          : codeTheme === 'light'
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Hanya Behavior
                    </button>
                  </>
                )}

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
                  <span>VRP QoS Valid</span>
                </span>
                <span>•</span>
                <span>Mode: {mode === 'single' ? 'Single' : 'Batch'}</span>
                <span>•</span>
                <span>
                  Target: {mode === 'single' ? singleResult.name : `${batchResults.length} Tiers`}
                </span>
              </div>
              <div className={codeTheme === 'light' ? 'text-slate-500' : 'text-slate-500'}>
                PT Jembatan Data Pangrango Tools
              </div>
            </div>
          </div>

          {/* Quick Workflow Tips Card */}
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
                  display traffic classifier user-defined
                </code>{' '}
                dan{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">
                  display traffic behavior user-defined
                </code>
                .
              </li>
              <li>
                Jika ingin membatalkan/rollback, gunakan tab <strong>Rollback / Undo</strong> lalu paste perintah{' '}
                <code>undo traffic behavior ...</code> dan <code>undo traffic classifier ...</code>.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TrafficQoSPage;
