import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  FolderClock,
  ArrowRight,
  ShieldAlert,
  ClipboardList,
  FileCheck,
  Layers,
  Sliders,
  ChevronRight,
  PackageCheck,
  Network,
} from 'lucide-react';
import type { RFODocument, RFOTemplate, ActiveTab } from '@/types/rfo';
import type { SuratTugasDocument, SuratTugasTemplate } from '@/types/suratTugas';
import type { BeritaAcaraDocument, BeritaAcaraTemplate } from '@/types/beritaAcara';
import type { PermitBarangDocument, PermitBarangTemplate } from '@/types/permitBarang';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { storageService } from '@/services/storageService';
import { suratTugasStorage } from '@/services/suratTugasStorage';
import { beritaAcaraStorage } from '@/services/beritaAcaraStorage';
import { permitBarangStorage } from '@/services/permitBarangStorage';
import { formatIndonesianDateOnly } from '@/utils/dateFormatter';
import { formatSuratTugasExecutionDate } from '@/utils/suratTugasUtils';
import { formatBeritaAcaraExecutionDate } from '@/utils/beritaAcaraUtils';
import { formatPermitBarangDate } from '@/utils/permitBarangUtils';

interface DashboardPageProps {
  template?: RFOTemplate;
  suratTugasTemplate?: SuratTugasTemplate;
  beritaAcaraTemplate?: BeritaAcaraTemplate;
  permitBarangTemplate?: PermitBarangTemplate;
  setActiveTab: (tab: ActiveTab) => void;
  onEditRFO?: (rfo: RFODocument) => void;
  onViewRFO: (rfo: RFODocument) => void;
  onEditSuratTugas?: (doc: SuratTugasDocument) => void;
  onEditBeritaAcara?: (doc: BeritaAcaraDocument) => void;
  onEditPermitBarang?: (doc: PermitBarangDocument) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
}

type FeedFilterType = 'all' | 'surat-tugas' | 'berita-acara' | 'permit-barang' | 'rfo';

interface UnifiedFeedItem {
  id: string;
  type: 'surat-tugas' | 'berita-acara' | 'permit-barang' | 'rfo';
  typeLabel: string;
  number: string;
  title: string;
  subtitle: string;
  date: string;
  createdAt: string;
  creator: string;
  rawST?: SuratTugasDocument;
  rawBA?: BeritaAcaraDocument;
  rawPM?: PermitBarangDocument;
  rawRFO?: RFODocument;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  setActiveTab,
  onViewRFO,
  onEditSuratTugas,
  onEditBeritaAcara,
  onEditPermitBarang,
  addToast,
  currentUser,
}) => {
  const [rfos, setRfos] = useState<RFODocument[]>([]);
  const [suratTugasList, setSuratTugasList] = useState<SuratTugasDocument[]>([]);
  const [beritaAcaraList, setBeritaAcaraList] = useState<BeritaAcaraDocument[]>([]);
  const [permitBarangList, setPermitBarangList] = useState<PermitBarangDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedFilter, setFeedFilter] = useState<FeedFilterType>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [rfoDocs, stDocs, baDocs, pmDocs] = await Promise.all([
        storageService.getAllRFOs().catch(() => []),
        suratTugasStorage.getAllSuratTugas().catch(() => []),
        beritaAcaraStorage.getAllBeritaAcara().catch(() => []),
        permitBarangStorage.getAllPermitBarang().catch(() => []),
      ]);
      setRfos(rfoDocs);
      setSuratTugasList(stDocs);
      setBeritaAcaraList(baDocs);
      setPermitBarangList(pmDocs);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      addToast('error', 'Gagal Memuat Data', 'Tidak dapat mengambil ringkasan dokumen.');
    } finally {
      setLoading(false);
    }
  };

  // Combined feed sorted newest first
  const unifiedFeed: UnifiedFeedItem[] = useMemo(() => {
    const list: UnifiedFeedItem[] = [];

    // Surat Tugas
    suratTugasList.forEach((st) => {
      list.push({
        id: st.id,
        type: 'surat-tugas',
        typeLabel: 'Surat Tugas Visit',
        number: st.letterNumber || `ST-${st.sequenceNumber}`,
        title: st.visitLocation || 'Kunjungan Lapangan',
        subtitle: `Personel: ${st.personnel.map((p) => p.name).join(', ') || '-'} • Jadwal: ${formatSuratTugasExecutionDate(st.startDate, st.endDate)}`,
        date: formatIndonesianDateOnly(st.createdDate),
        createdAt: st.createdAt || st.createdDate || new Date().toISOString(),
        creator: st.createdByName || 'Staff Operasional',
        rawST: st,
      });
    });

    // Berita Acara
    beritaAcaraList.forEach((ba) => {
      list.push({
        id: ba.id,
        type: 'berita-acara',
        typeLabel: 'Berita Acara',
        number: ba.letterNumber || `BA-${ba.sequenceNumber}`,
        title: ba.purpose || 'Pelaksanaan Tugas Lapangan',
        subtitle: `Lokasi: ${ba.visitLocation || '-'} • Jadwal: ${formatBeritaAcaraExecutionDate(ba.startDate, ba.endDate)}`,
        date: formatIndonesianDateOnly(ba.createdDate),
        createdAt: ba.createdAt || ba.createdDate || new Date().toISOString(),
        creator: ba.createdByName || 'Staff Operasional',
        rawBA: ba,
      });
    });

    // Permit Barang
    permitBarangList.forEach((pm) => {
      list.push({
        id: pm.id,
        type: 'permit-barang',
        typeLabel: pm.permitType === 'masuk' ? 'Permit Masuk' : 'Permit Keluar',
        number: pm.subject,
        title: pm.location || 'Lokasi Gedung',
        subtitle: `PIC: ${pm.applicantName} (${pm.applicantPosition}) • ${pm.devices.length} Perangkat • Jadwal: ${formatPermitBarangDate(pm.permitDate)} (${pm.permitTime})`,
        date: formatIndonesianDateOnly(pm.createdDate),
        createdAt: pm.createdAt || pm.createdDate || new Date().toISOString(),
        creator: pm.createdByName || 'Staff Operasional',
        rawPM: pm,
      });
    });

    // RFO
    rfos.forEach((r) => {
      list.push({
        id: r.id,
        type: 'rfo',
        typeLabel: 'Laporan RFO',
        number: r.ticketNo ? `#${r.ticketNo}` : `#${r.id}`,
        title: r.rootCause || 'Insiden Kendala Jaringan',
        subtitle: `Durasi: ${r.totalDuration} • Tindakan: ${r.actionTaken || '-'}`,
        date: formatIndonesianDateOnly(r.rfoDate),
        createdAt: r.createdAt || r.rfoDate || new Date().toISOString(),
        creator: r.createdByName || 'Staff NOC',
        rawRFO: r,
      });
    });

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [suratTugasList, beritaAcaraList, permitBarangList, rfos]);

  const filteredFeed = useMemo(() => {
    if (feedFilter === 'all') return unifiedFeed;
    return unifiedFeed.filter((item) => item.type === feedFilter);
  }, [unifiedFeed, feedFilter]);

  const handleOpenItem = (item: UnifiedFeedItem) => {
    if (item.type === 'surat-tugas' && item.rawST && onEditSuratTugas) {
      onEditSuratTugas(item.rawST);
    } else if (item.type === 'berita-acara' && item.rawBA && onEditBeritaAcara) {
      onEditBeritaAcara(item.rawBA);
    } else if (item.type === 'permit-barang' && item.rawPM && onEditPermitBarang) {
      onEditPermitBarang(item.rawPM);
    } else if (item.type === 'rfo' && item.rawRFO) {
      onViewRFO(item.rawRFO);
    }
  };

  const totalDocuments =
    suratTugasList.length + beritaAcaraList.length + permitBarangList.length + rfos.length;
  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm font-medium">Memuat dashboard GENERATOR TOOLS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto bg-slate-50">
      {/* Top Banner with Unified Branding */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="relative z-10 space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              PT Jembatan Data Pangrango
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Official Document Generator System
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            GENERATOR TOOLS
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Platform terpadu penerbitan surat & dokumen resmi operasional. Buat dan cetak{' '}
            <span className="font-semibold text-slate-800">Surat Tugas Visit</span>,{' '}
            <span className="font-semibold text-slate-800">Berita Acara Pekerjaan</span>,{' '}
            <span className="font-semibold text-slate-800">Surat Permit Masuk & Keluar Barang</span>, dan{' '}
            <span className="font-semibold text-slate-800">Laporan RFO</span> dengan penomoran
            urut otomatis, layout kop standar, dan ekspor instan format A4.
          </p>
        </div>
      </div>

      {/* 5 Core Balanced KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Dokumen */}
        <div
          onClick={() => setActiveTab('history')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Dokumen Terbit</span>
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-mono">
              {totalDocuments}
            </span>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {suratTugasList.length} ST • {beritaAcaraList.length} BA • {permitBarangList.length} PM • {rfos.length} RFO
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-600 font-semibold group-hover:underline">
            <span>Buka Arsip Terpadu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 2: Surat Tugas */}
        <div
          onClick={() => setActiveTab('history-st')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-sky-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Surat Tugas Terbit</span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-sky-700 tracking-tight font-mono">
              {suratTugasList.length}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Penugasan tim & visit lapangan</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-sky-600 font-semibold group-hover:underline">
            <span>Arsip Surat Tugas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 3: Berita Acara */}
        <div
          onClick={() => setActiveTab('history-ba')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Berita Acara Terbit</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-indigo-700 tracking-tight font-mono">
              {beritaAcaraList.length}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Instalasi, serah terima & pekerjaan</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-600 font-semibold group-hover:underline">
            <span>Arsip Berita Acara</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 4: Permit Barang */}
        <div
          onClick={() => setActiveTab('history-pm')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Permit Barang Terbit</span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-purple-700 tracking-tight font-mono">
              {permitBarangList.length}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Izin masuk & keluar perangkat</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-purple-600 font-semibold group-hover:underline">
            <span>Arsip Permit Barang</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 5: Laporan RFO */}
        <div
          onClick={() => setActiveTab('history')}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Laporan RFO Terbit</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-700 tracking-tight font-mono">
              {rfos.length}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Laporan investigasi kendala jaringan</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-600 font-semibold group-hover:underline">
            <span>Arsip Laporan RFO</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Network QoS Tool Quick Launch Banner (Tema Terang) */}
      <div className="bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 border border-blue-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-100/80 border border-blue-200 text-blue-700 shrink-0 shadow-xs">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 uppercase tracking-wider">
                Fitur Baru
              </span>
              <span className="text-xs text-slate-500 font-mono">Huawei VRP QoS Tool</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Traffic Classifier & Traffic Behavior Generator
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Konversi otomatis bandwidth ke formula CAR (CIR, PIR, CBS, PBS) siap paste ke router/switch.
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('traffic-qos')}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <span>Buka QoS Generator</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Unified Recent Document Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderClock className="w-4 h-4 text-blue-600" />
              Riwayat Penerbitan Dokumen Terbaru
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar kronologis surat dan dokumen yang telah diterbitkan
            </p>
          </div>

          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Buka Semua Arsip Dokumen</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filter Chips inside feed */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setFeedFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
              feedFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Semua Dokumen ({totalDocuments})
          </button>

          <button
            onClick={() => setFeedFilter('surat-tugas')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              feedFilter === 'surat-tugas'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Surat Tugas ({suratTugasList.length})</span>
          </button>

          <button
            onClick={() => setFeedFilter('berita-acara')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              feedFilter === 'berita-acara'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Berita Acara ({beritaAcaraList.length})</span>
          </button>

          <button
            onClick={() => setFeedFilter('permit-barang')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              feedFilter === 'permit-barang'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Permit Barang ({permitBarangList.length})</span>
          </button>

          <button
            onClick={() => setFeedFilter('rfo')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              feedFilter === 'rfo'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Laporan RFO ({rfos.length})</span>
          </button>
        </div>

        {/* Feed List Items */}
        <div className="space-y-2.5">
          {filteredFeed.length > 0 ? (
            filteredFeed.slice(0, 7).map((item) => {
              const isST = item.type === 'surat-tugas';
              const isBA = item.type === 'berita-acara';
              const isPM = item.type === 'permit-barang';
              const isRFO = item.type === 'rfo';

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleOpenItem(item)}
                  className="p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isST
                          ? 'bg-sky-100 text-sky-700'
                          : isBA
                          ? 'bg-indigo-100 text-indigo-700'
                          : isPM
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isST && <ClipboardList className="w-4 h-4" />}
                      {isBA && <FileCheck className="w-4 h-4" />}
                      {isPM && <PackageCheck className="w-4 h-4" />}
                      {isRFO && <FileText className="w-4 h-4" />}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isST
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : isBA
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : isPM
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.typeLabel}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600">
                          {item.number}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">• {item.date}</span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                        {item.title}
                      </p>

                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 self-end sm:self-center">
                    <span className="text-[11px] text-slate-400">
                      Oleh: <span className="font-medium text-slate-600">{item.creator}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                      Buka Dokumen
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400">
              <FolderClock className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Tidak ada riwayat dokumen untuk filter yang dipilih.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Access to Document Templates Configuration (For Admin) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Pengaturan Kop Surat & Template Dokumen
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Khusus Super Admin</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveTab('templates-st')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-sky-700">
                  Template Surat Tugas
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Kop surat, TTD Direktur, cap & margin
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600" />
            </button>

            <button
              onClick={() => setActiveTab('templates-ba')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-indigo-700">
                  Template Berita Acara
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Kop surat, redaksi pembuka, penandatangan
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </button>

            <button
              onClick={() => setActiveTab('templates-pm')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-purple-700">
                  Template Permit Barang
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Kop surat, TTD Direktur, pembuka & penutup
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-slate-900 block group-hover:text-blue-700">
                  Template Laporan RFO
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Kop surat perusahaan, kontak darurat & TTD
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
