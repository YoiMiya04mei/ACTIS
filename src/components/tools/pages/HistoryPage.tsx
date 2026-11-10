import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Edit3,
  Copy,
  Trash2,
  FileDown,
  Printer,
  MessageSquare,
  Calendar,
  X,
  FileText,
  ClipboardList,
  AlertCircle,
  Layers,
  UserCheck,
  RotateCcw,
  Clock,
  Loader2,
  PackageCheck,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';
import type { RFODocument, RFOTemplate, ActiveTab } from '@/types/rfo';
import type { SuratTugasDocument, SuratTugasTemplate } from '@/types/suratTugas';
import type { BeritaAcaraDocument, BeritaAcaraTemplate } from '@/types/beritaAcara';
import type { PermitBarangDocument, PermitBarangTemplate } from '@/types/permitBarang';
import type { BankPaymentVoucherDocument } from '@/types/bankPaymentVoucher';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { authService } from '@/services/authService';
import { storageService } from '@/services/storageService';
import { suratTugasStorage } from '@/services/suratTugasStorage';
import { beritaAcaraStorage } from '@/services/beritaAcaraStorage';
import { permitBarangStorage } from '@/services/permitBarangStorage';
import { bankPaymentVoucherStorage } from '@/services/bankPaymentVoucherStorage';
import { RFOService } from '@/services/rfoService';
import { PDFService } from '@/services/pdfService';
import { RFOPaperDocument } from '@/components/tools/RFOPaperDocument';
import { SuratTugasPaperDocument } from '@/components/tools/SuratTugasPaperDocument';
import { BeritaAcaraPaperDocument } from '@/components/tools/BeritaAcaraPaperDocument';
import { PermitBarangPaperDocument } from '@/components/tools/PermitBarangPaperDocument';
import { BankPaymentVoucherPaperDocument } from '@/components/tools/BankPaymentVoucherPaperDocument';
import { formatIndonesianDateOnly, formatCreationTimestamp } from '@/utils/dateFormatter';
import {
  formatSuratTugasExecutionDate,
  generateSuratTugasWhatsAppText,
  generateSuratTugasFileName,
} from '@/utils/suratTugasUtils';
import {
  formatBeritaAcaraExecutionDate,
  generateBeritaAcaraWhatsAppText,
  generateBeritaAcaraFileName,
} from '@/utils/beritaAcaraUtils';
import {
  formatPermitBarangDate,
  generatePermitBarangWhatsAppText,
  generatePermitBarangFileName,
  isPermitBarangMultiPage,
} from '@/utils/permitBarangUtils';
import {
  formatRupiahFull,
  generateBankPaymentVoucherWhatsAppText,
  generateBankPaymentVoucherFileName,
} from '@/utils/bankPaymentVoucherUtils';
import { downloadBankPaymentVoucherExcel } from '@/services/bankPaymentVoucherExcelService';

export type UnifiedDocType = 'rfo' | 'surat-tugas' | 'berita-acara' | 'permit-barang' | 'bank-voucher';

export interface UnifiedDocumentItem {
  id: string;
  type: UnifiedDocType;
  typeLabel: string;
  number: string;
  title: string;
  subtitle?: string;
  date: string;
  createdDate: string;
  createdAt: string;
  creator?: string;
  creatorRole?: string;
  rawRFO?: RFODocument;
  rawSuratTugas?: SuratTugasDocument;
  rawBeritaAcara?: BeritaAcaraDocument;
  rawPermitBarang?: PermitBarangDocument;
  rawBankPaymentVoucher?: BankPaymentVoucherDocument;
}

interface HistoryPageProps {
  template: RFOTemplate;
  suratTugasTemplate?: SuratTugasTemplate;
  beritaAcaraTemplate?: BeritaAcaraTemplate;
  permitBarangTemplate?: PermitBarangTemplate;
  setActiveTab?: (tab: ActiveTab) => void;
  onEditRFO: (rfo: RFODocument) => void;
  onDuplicateRFO: (rfo: RFODocument) => void;
  onEditSuratTugas: (doc: SuratTugasDocument) => void;
  onDuplicateSuratTugas: (doc: SuratTugasDocument) => void;
  onEditBeritaAcara: (doc: BeritaAcaraDocument) => void;
  onDuplicateBeritaAcara: (doc: BeritaAcaraDocument) => void;
  onEditPermitBarang?: (doc: PermitBarangDocument) => void;
  onDuplicatePermitBarang?: (doc: PermitBarangDocument) => void;
  onEditBankPaymentVoucher?: (doc: BankPaymentVoucherDocument) => void;
  onDuplicateBankPaymentVoucher?: (doc: BankPaymentVoucherDocument) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
  initialTypeFilter?: 'all' | 'rfo' | 'surat-tugas' | 'berita-acara' | 'permit-barang' | 'bank-voucher';
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  template,
  suratTugasTemplate,
  beritaAcaraTemplate,
  permitBarangTemplate,
  setActiveTab: _setActiveTab,
  onEditRFO,
  onDuplicateRFO,
  onEditSuratTugas,
  onDuplicateSuratTugas,
  onEditBeritaAcara,
  onDuplicateBeritaAcara,
  onEditPermitBarang,
  onDuplicatePermitBarang,
  onEditBankPaymentVoucher,
  onDuplicateBankPaymentVoucher,
  addToast,
  currentUser,
  initialTypeFilter = 'all',
}) => {
  // Raw documents from storages
  const [rfos, setRfos] = useState<RFODocument[]>([]);
  const [suratTugasList, setSuratTugasList] = useState<SuratTugasDocument[]>([]);
  const [beritaAcaraList, setBeritaAcaraList] = useState<BeritaAcaraDocument[]>([]);
  const [permitBarangList, setPermitBarangList] = useState<PermitBarangDocument[]>([]);
  const [bankVoucherList, setBankVoucherList] = useState<BankPaymentVoucherDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<'all' | 'rfo' | 'surat-tugas' | 'berita-acara' | 'permit-barang' | 'bank-voucher'>(
    initialTypeFilter
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterCreator, setFilterCreator] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Preview Modals
  const [selectedRFO, setSelectedRFO] = useState<RFODocument | null>(null);
  const [selectedSuratTugas, setSelectedSuratTugas] = useState<SuratTugasDocument | null>(null);
  const [selectedBeritaAcara, setSelectedBeritaAcara] = useState<BeritaAcaraDocument | null>(null);
  const [selectedPermitBarang, setSelectedPermitBarang] = useState<PermitBarangDocument | null>(null);
  const [selectedBankPaymentVoucher, setSelectedBankPaymentVoucher] = useState<BankPaymentVoucherDocument | null>(null);
  const [baModalPageTab, setBaModalPageTab] = useState<'all' | number>('all');
  const [pmModalPageTab, setPmModalPageTab] = useState<'all' | 1 | 2>('all');

  // Delete Confirmation State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    id: string;
    type: UnifiedDocType;
    number: string;
  } | null>(null);

  // Downloading State indicator
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Background PDF Export (direct download without opening overview modal)
  const [exportingItem, setExportingItem] = useState<UnifiedDocumentItem | null>(null);

  // Permissions based on currentUser
  const canDelete = currentUser ? authService.hasPermission(currentUser.role, 'canDeleteRFO') : false;

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    setLoading(true);
    try {
      const [rfoDocs, stDocs, baDocs, pmDocs, bpvDocs] = await Promise.all([
        storageService.getAllRFOs().catch(() => []),
        suratTugasStorage.getAllSuratTugas().catch(() => []),
        beritaAcaraStorage.getAllBeritaAcara().catch(() => []),
        permitBarangStorage.getAllPermitBarang().catch(() => []),
        bankPaymentVoucherStorage.getAllVouchers().catch(() => []),
      ]);
      setRfos(rfoDocs);
      setSuratTugasList(stDocs);
      setBeritaAcaraList(baDocs);
      setPermitBarangList(pmDocs);
      setBankVoucherList(bpvDocs);
    } catch (e) {
      console.error('Failed to load documents:', e);
      addToast('error', 'Gagal Memuat Data', 'Tidak dapat mengambil arsip dokumen.');
    } finally {
      setLoading(false);
    }
  };

  // Convert all items into UnifiedDocumentItem format
  const unifiedItems: UnifiedDocumentItem[] = useMemo(() => {
    const list: UnifiedDocumentItem[] = [];

    // 1. Process RFO
    rfos.forEach((r) => {
      list.push({
        id: r.id,
        type: 'rfo',
        typeLabel: 'Reason For Outage',
        number: r.ticketNo ? `#${r.ticketNo}` : `#${r.id}`,
        title: r.rootCause || 'Insiden Gangguan Jaringan',
        subtitle: r.customerName
          ? `Pelanggan: ${r.customerName} • Tindakan: ${r.actionTaken}`
          : `Tindakan: ${r.actionTaken || '-'}`,
        date: formatIndonesianDateOnly(r.rfoDate),
        createdDate: r.rfoDate || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        createdAt: r.createdAt || r.rfoDate || new Date().toISOString(),
        creator: r.createdByName || 'Staff NOC',
        creatorRole: r.createdByRole || 'engineer',
        rawRFO: r,
      });
    });

    // 2. Process Surat Tugas
    suratTugasList.forEach((st) => {
      const execDate = formatSuratTugasExecutionDate(st.startDate, st.endDate);
      const teamNames = st.personnel.map((p) => p.name).filter(Boolean).join(', ');
      list.push({
        id: st.id,
        type: 'surat-tugas',
        typeLabel: 'Surat Tugas',
        number: st.letterNumber,
        title: st.visitLocation || 'Visit Teknis Data Center',
        subtitle: `Petugas: ${teamNames || 'Personil teknis'} • Periode: ${execDate}`,
        date: execDate,
        createdDate: st.createdDate || (st.createdAt ? st.createdAt.slice(0, 10) : ''),
        createdAt: st.createdAt || st.createdDate || new Date().toISOString(),
        creator: st.createdByName || 'Staff NOC',
        creatorRole: st.createdByRole || 'engineer',
        rawSuratTugas: st,
      });
    });

    // 3. Process Berita Acara
    beritaAcaraList.forEach((ba) => {
      const execDate = formatBeritaAcaraExecutionDate(ba.startDate, ba.endDate);
      const teamNames = ba.personnel.map((p) => p.name).filter(Boolean).join(', ');
      const photosCount = ba.attachments?.length || 0;
      list.push({
        id: ba.id,
        type: 'berita-acara',
        typeLabel: 'Berita Acara',
        number: ba.letterNumber,
        title: `${ba.visitLocation || 'Visit Data Center'} — ${ba.purpose || 'Kegiatan Teknis'}`,
        subtitle: `Tim: ${teamNames || 'Petugas'} • ${photosCount} Foto Dokumentasi`,
        date: execDate,
        createdDate: ba.createdDate || (ba.createdAt ? ba.createdAt.slice(0, 10) : ''),
        createdAt: ba.createdAt || ba.createdDate || new Date().toISOString(),
        creator: ba.createdByName || 'Staff NOC',
        creatorRole: ba.createdByRole || 'engineer',
        rawBeritaAcara: ba,
      });
    });

    // 4. Process Permit Barang
    permitBarangList.forEach((pm) => {
      const deviceSummary =
        pm.devices && pm.devices.length > 0
          ? pm.devices.map((d) => d.name).join(', ')
          : 'Perangkat';
      list.push({
        id: pm.id,
        type: 'permit-barang',
        typeLabel: 'Permit Barang',
        number: pm.letterNumber || pm.subject,
        title: `${pm.subject} — ${pm.location}`,
        subtitle: `Pemohon: ${pm.applicantName} (${pm.applicantPosition}) • ${pm.devices?.length || 0} Perangkat: ${deviceSummary}`,
        date: formatPermitBarangDate(pm.permitDate || pm.createdDate),
        createdDate: pm.createdDate || (pm.createdAt ? pm.createdAt.slice(0, 10) : ''),
        createdAt: pm.createdAt || pm.createdDate || new Date().toISOString(),
        creator: pm.createdByName || 'Staff NOC',
        creatorRole: pm.createdByRole || 'engineer',
        rawPermitBarang: pm,
      });
    });

    // 5. Process Bank Payment Voucher
    bankVoucherList.forEach((bpv) => {
      list.push({
        id: bpv.id,
        type: 'bank-voucher',
        typeLabel: 'Payment Voucher',
        number: bpv.voucherNumber,
        title: `Payment Voucher — ${bpv.payTo}`,
        subtitle: `Total: ${formatRupiahFull(bpv.totalAmount)} • ${bpv.items?.length || 0} Transaksi • Bank: ${bpv.bankName} (${bpv.bankAccount})`,
        date: formatIndonesianDateOnly(bpv.voucherDate),
        createdDate: bpv.voucherDate || (bpv.createdAt ? bpv.createdAt.slice(0, 10) : ''),
        createdAt: bpv.createdAt || bpv.voucherDate || new Date().toISOString(),
        creator: bpv.createdByName || bpv.preparedByName || 'Super Admin',
        creatorRole: bpv.createdByRole || 'admin',
        rawBankPaymentVoucher: bpv,
      });
    });

    // Sort
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [rfos, suratTugasList, beritaAcaraList, permitBarangList, bankVoucherList, sortBy]);

  // Distinct Creator Options
  const creatorOptions = useMemo(() => {
    const set = new Set<string>();
    unifiedItems.forEach((item) => {
      if (item.creator) set.add(item.creator);
    });
    return Array.from(set);
  }, [unifiedItems]);

  // Filtered List
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return unifiedItems.filter((item) => {
      // 1. Type Filter
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      // 2. Search Query
      if (q) {
        const matchesNumber = item.number.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSubtitle = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
        const matchesCreator = item.creator ? item.creator.toLowerCase().includes(q) : false;
        const matchesType = item.typeLabel.toLowerCase().includes(q);

        if (!matchesNumber && !matchesTitle && !matchesSubtitle && !matchesCreator && !matchesType) {
          return false;
        }
      }

      // 3. Date Filter: Filter khusus berdasarkan Tanggal Pembuatan Surat
      if (filterDate) {
        const candidates = new Set<string>();

        if (item.createdDate) {
          candidates.add(item.createdDate.slice(0, 10));
        }

        if (item.type === 'rfo' && item.rawRFO?.rfoDate) {
          candidates.add(item.rawRFO.rfoDate.slice(0, 10));
        }
        if (item.type === 'surat-tugas' && item.rawSuratTugas?.createdDate) {
          candidates.add(item.rawSuratTugas.createdDate.slice(0, 10));
        }
        if (item.type === 'berita-acara' && item.rawBeritaAcara?.createdDate) {
          candidates.add(item.rawBeritaAcara.createdDate.slice(0, 10));
        }
        if (item.type === 'permit-barang' && item.rawPermitBarang?.createdDate) {
          candidates.add(item.rawPermitBarang.createdDate.slice(0, 10));
        }
        if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher?.voucherDate) {
          candidates.add(item.rawBankPaymentVoucher.voucherDate.slice(0, 10));
        }

        if (item.createdAt) {
          candidates.add(item.createdAt.slice(0, 10));
          const d = new Date(item.createdAt);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            candidates.add(`${y}-${m}-${day}`);
          }
        }

        if (!candidates.has(filterDate)) {
          return false;
        }
      }

      // 4. Creator Filter
      if (filterCreator) {
        if (!item.creator || item.creator.toLowerCase() !== filterCreator.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedItems, typeFilter, searchQuery, filterDate, filterCreator]);

  // Document Counts
  const counts = useMemo(() => {
    return {
      all: unifiedItems.length,
      rfo: rfos.length,
      suratTugas: suratTugasList.length,
      beritaAcara: beritaAcaraList.length,
      permitBarang: permitBarangList.length,
      bankVoucher: bankVoucherList.length,
    };
  }, [
    unifiedItems.length,
    rfos.length,
    suratTugasList.length,
    beritaAcaraList.length,
    permitBarangList.length,
    bankVoucherList.length,
  ]);

  // Reset Filters
  const handleResetFilters = () => {
    setTypeFilter('all');
    setSearchQuery('');
    setFilterDate('');
    setFilterCreator('');
  };

  const hasActiveFilters =
    typeFilter !== 'all' || searchQuery !== '' || filterDate !== '' || filterCreator !== '';

  // ================= ACTION HANDLERS =================

  // 1. Preview Modal Open
  const handlePreview = (item: UnifiedDocumentItem) => {
    if (item.type === 'rfo' && item.rawRFO) {
      setSelectedRFO(item.rawRFO);
    } else if (item.type === 'surat-tugas' && item.rawSuratTugas) {
      setSelectedSuratTugas(item.rawSuratTugas);
    } else if (item.type === 'berita-acara' && item.rawBeritaAcara) {
      setSelectedBeritaAcara(item.rawBeritaAcara);
      setBaModalPageTab('all');
    } else if (item.type === 'permit-barang' && item.rawPermitBarang) {
      setSelectedPermitBarang(item.rawPermitBarang);
      setPmModalPageTab('all');
    } else if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher) {
      setSelectedBankPaymentVoucher(item.rawBankPaymentVoucher);
    }
  };

  // 2. Download PDF (Direct download without opening overview modal)
  const handleDownloadPDF = async (item: UnifiedDocumentItem) => {
    if (downloadingId) return;
    setDownloadingId(item.id);

    try {
      if (item.type === 'rfo' && item.rawRFO) {
        addToast('info', 'Membuat PDF RFO...', 'Sedang merender layout dokumen.');
        const isModalOpen = selectedRFO?.id === item.id;
        if (!isModalOpen) {
          setExportingItem(item);
        }

        setTimeout(async () => {
          try {
            const targetId = isModalOpen
              ? 'history-rfo-preview-modal-doc'
              : 'direct-export-rfo-doc';
            const element = document.getElementById(targetId);
            if (!element) {
              addToast('error', 'Gagal', 'Elemen dokumen tidak ditemukan.');
              return;
            }

            const filename = await PDFService.exportToPDF({
              element,
              rfoDate: item.rawRFO!.rfoDate,
              rootCause: item.rawRFO!.rootCause,
            });
            addToast('success', 'PDF Berhasil Diunduh', filename);
          } catch (e) {
            console.error('PDF error:', e);
            addToast('error', 'Gagal', 'Terjadi kesalahan saat memproses PDF.');
          } finally {
            setDownloadingId(null);
            setExportingItem(null);
          }
        }, 250);
      } else if (item.type === 'surat-tugas' && item.rawSuratTugas) {
        addToast('info', 'Membuat PDF Surat Tugas...', 'Sedang merender layout dokumen.');
        const isModalOpen = selectedSuratTugas?.id === item.id;
        if (!isModalOpen) {
          setExportingItem(item);
        }

        setTimeout(async () => {
          try {
            const targetId = isModalOpen
              ? 'history-surat-tugas-modal-doc'
              : 'direct-export-st-doc';
            const element = document.getElementById(targetId);
            if (!element) {
              addToast('error', 'Gagal', 'Elemen dokumen tidak ditemukan.');
              return;
            }

            const filename = generateSuratTugasFileName(
              item.rawSuratTugas!.letterNumber,
              item.rawSuratTugas!.visitLocation
            );
            await PDFService.exportSinglePagePDF(element, filename);
            addToast('success', 'PDF Terunduh', filename);
          } catch (e) {
            console.error('ST PDF error:', e);
            addToast('error', 'Gagal', 'Terjadi kesalahan saat mengekspor PDF.');
          } finally {
            setDownloadingId(null);
            setExportingItem(null);
          }
        }, 250);
      } else if (item.type === 'berita-acara' && item.rawBeritaAcara) {
        addToast('info', 'Membuat PDF Berita Acara...', 'Sedang merender seluruh halaman dokumen.');
        const isModalOpen = selectedBeritaAcara?.id === item.id;
        if (!isModalOpen) {
          setExportingItem(item);
        } else {
          setBaModalPageTab('all');
        }

        setTimeout(async () => {
          try {
            const selector = isModalOpen
              ? '#history-berita-acara-modal-doc .berita-acara-page, #history-berita-acara-modal-doc .berita-acara-single-page'
              : '#direct-export-ba-doc .berita-acara-page, #direct-export-ba-doc .berita-acara-single-page';
            const pageElements = document.querySelectorAll<HTMLElement>(selector);
            if (pageElements.length === 0) {
              addToast('error', 'Gagal', 'Gagal merender dokumen untuk unduhan PDF.');
              return;
            }

            const filename = generateBeritaAcaraFileName(
              item.rawBeritaAcara!.letterNumber,
              item.rawBeritaAcara!.purpose,
              item.rawBeritaAcara!.visitLocation
            );
            await PDFService.exportMultiPagePDF(pageElements, filename);
            addToast('success', 'PDF Berhasil Diunduh', filename);
          } catch (e) {
            console.error('BA PDF error:', e);
            addToast('error', 'Gagal', 'Terjadi kesalahan saat memproses rendering.');
          } finally {
            setDownloadingId(null);
            setExportingItem(null);
          }
        }, 300);
      } else if (item.type === 'permit-barang' && item.rawPermitBarang) {
        addToast('info', 'Membuat PDF Permit Barang...', 'Sedang merender layout dokumen.');
        const isModalOpen = selectedPermitBarang?.id === item.id;
        if (!isModalOpen) {
          setExportingItem(item);
        } else {
          setPmModalPageTab('all');
        }

        setTimeout(async () => {
          try {
            const selector = isModalOpen
              ? '#history-permit-barang-modal-doc .permit-barang-page, #history-permit-barang-modal-doc .permit-barang-single-page'
              : '#direct-export-pm-doc .permit-barang-page, #direct-export-pm-doc .permit-barang-single-page';
            const pageElements = document.querySelectorAll<HTMLElement>(selector);

            const filename = generatePermitBarangFileName(
              item.rawPermitBarang!.subject,
              item.rawPermitBarang!.location,
              item.rawPermitBarang!.permitDate || item.rawPermitBarang!.createdDate
            );

            if (pageElements.length > 1) {
              await PDFService.exportMultiPagePDF(pageElements, filename);
            } else if (pageElements.length === 1) {
              await PDFService.exportSinglePagePDF(pageElements[0], filename);
            } else {
              const targetId = isModalOpen
                ? 'history-permit-barang-modal-doc'
                : 'direct-export-pm-doc';
              const element = document.getElementById(targetId);
              if (!element) {
                addToast('error', 'Gagal', 'Elemen dokumen tidak ditemukan.');
                return;
              }
              await PDFService.exportSinglePagePDF(element, filename);
            }

            addToast('success', 'PDF Terunduh', filename);
          } catch (e) {
            console.error('PM PDF error:', e);
            addToast('error', 'Gagal', 'Terjadi kesalahan saat mengekspor PDF.');
          } finally {
            setDownloadingId(null);
            setExportingItem(null);
          }
        }, 300);
      } else if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher) {
        addToast('info', 'Membuat PDF Voucher...', 'Sedang merender layout dokumen.');
        const isModalOpen = selectedBankPaymentVoucher?.id === item.id;
        if (!isModalOpen) {
          setExportingItem(item);
        }

        setTimeout(async () => {
          try {
            const targetId = isModalOpen
              ? 'history-bpv-modal-doc'
              : 'direct-export-bpv-doc';
            const element = document.getElementById(targetId);
            if (!element) {
              addToast('error', 'Gagal', 'Elemen dokumen tidak ditemukan.');
              return;
            }

            const filename = generateBankPaymentVoucherFileName(item.rawBankPaymentVoucher!);
            await PDFService.exportSinglePagePDF(element, filename);
            addToast('success', 'PDF Terunduh', filename);
          } catch (e) {
            console.error('BPV PDF error:', e);
            addToast('error', 'Gagal', 'Terjadi kesalahan saat mengekspor PDF.');
          } finally {
            setDownloadingId(null);
            setExportingItem(null);
          }
        }, 250);
      }
    } catch {
      setDownloadingId(null);
      setExportingItem(null);
    }
  };

  // Unduh Excel (.xlsx) untuk Bank Payment Voucher
  const handleExportExcel = async (item: UnifiedDocumentItem) => {
    if (item.type !== 'bank-voucher' || !item.rawBankPaymentVoucher) return;
    try {
      addToast('info', 'Membuat File Excel...', 'Sedang memproses berkas Excel...');
      await downloadBankPaymentVoucherExcel(item.rawBankPaymentVoucher);
      const filename = generateBankPaymentVoucherFileName(item.rawBankPaymentVoucher, 'xlsx');
      addToast('success', 'Excel Terunduh', `${filename} berhasil digenerate persis sesuai template asli.`);
    } catch (e) {
      console.error('Excel download error:', e);
      addToast('error', 'Gagal', 'Terjadi kesalahan saat memproses unduhan Excel.');
    }
  };

  // 3. WhatsApp Copy
  const handleCopyWhatsApp = async (item: UnifiedDocumentItem) => {
    try {
      let text = '';
      if (item.type === 'rfo' && item.rawRFO) {
        text = RFOService.generateWhatsAppText(item.rawRFO, template);
      } else if (item.type === 'surat-tugas' && item.rawSuratTugas) {
        text = generateSuratTugasWhatsAppText(
          item.rawSuratTugas,
          suratTugasTemplate?.companyName || template.companyName
        );
      } else if (item.type === 'berita-acara' && item.rawBeritaAcara) {
        text = generateBeritaAcaraWhatsAppText(
          item.rawBeritaAcara,
          beritaAcaraTemplate?.companyName || template.companyName
        );
      } else if (item.type === 'permit-barang' && item.rawPermitBarang) {
        text = generatePermitBarangWhatsAppText(
          item.rawPermitBarang,
          permitBarangTemplate?.companyName || template.companyName
        );
      } else if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher) {
        text = generateBankPaymentVoucherWhatsAppText(item.rawBankPaymentVoucher);
      }

      await navigator.clipboard.writeText(text);
      addToast(
        'success',
        'Format WhatsApp Disalin',
        `Ringkasan pesan ${item.typeLabel} siap dikirimkan.`
      );
    } catch {
      addToast('error', 'Gagal', 'Izin clipboard browser ditolak.');
    }
  };

  // 4. Edit Document
  const handleEdit = (item: UnifiedDocumentItem) => {
    if (item.type === 'rfo' && item.rawRFO) {
      onEditRFO(item.rawRFO);
    } else if (item.type === 'surat-tugas' && item.rawSuratTugas) {
      onEditSuratTugas(item.rawSuratTugas);
    } else if (item.type === 'berita-acara' && item.rawBeritaAcara) {
      onEditBeritaAcara(item.rawBeritaAcara);
    } else if (item.type === 'permit-barang' && item.rawPermitBarang) {
      onEditPermitBarang?.(item.rawPermitBarang);
    } else if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher) {
      onEditBankPaymentVoucher?.(item.rawBankPaymentVoucher);
    }
  };

  // 5. Duplicate Document
  const handleDuplicate = (item: UnifiedDocumentItem) => {
    if (item.type === 'rfo' && item.rawRFO) {
      onDuplicateRFO(item.rawRFO);
    } else if (item.type === 'surat-tugas' && item.rawSuratTugas) {
      onDuplicateSuratTugas(item.rawSuratTugas);
    } else if (item.type === 'berita-acara' && item.rawBeritaAcara) {
      onDuplicateBeritaAcara(item.rawBeritaAcara);
    } else if (item.type === 'permit-barang' && item.rawPermitBarang) {
      onDuplicatePermitBarang?.(item.rawPermitBarang);
    } else if (item.type === 'bank-voucher' && item.rawBankPaymentVoucher) {
      onDuplicateBankPaymentVoucher?.(item.rawBankPaymentVoucher);
    }
  };

  // 6. Delete Confirmation & Execution
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return;
    const { id, type, number } = deleteConfirmItem;

    try {
      let success = false;
      if (type === 'rfo') {
        success = await storageService.deleteRFO(id);
        if (success) setRfos((prev) => prev.filter((r) => r.id !== id));
      } else if (type === 'surat-tugas') {
        success = await suratTugasStorage.deleteSuratTugas(id);
        if (success) setSuratTugasList((prev) => prev.filter((st) => st.id !== id));
      } else if (type === 'berita-acara') {
        success = await beritaAcaraStorage.deleteBeritaAcara(id);
        if (success) setBeritaAcaraList((prev) => prev.filter((ba) => ba.id !== id));
      } else if (type === 'permit-barang') {
        await permitBarangStorage.deletePermitBarang(id);
        setPermitBarangList((prev) => prev.filter((pm) => pm.id !== id));
        success = true;
      } else if (type === 'bank-voucher') {
        await bankPaymentVoucherStorage.deleteVoucher(id);
        setBankVoucherList((prev) => prev.filter((v) => v.id !== id));
        success = true;
      }

      if (success) {
        addToast('success', 'Dokumen Dihapus', `${number} berhasil dihapus dari arsip.`);
        if (selectedRFO?.id === id) setSelectedRFO(null);
        if (selectedSuratTugas?.id === id) setSelectedSuratTugas(null);
        if (selectedBeritaAcara?.id === id) setSelectedBeritaAcara(null);
        if (selectedPermitBarang?.id === id) setSelectedPermitBarang(null);
        if (selectedBankPaymentVoucher?.id === id) setSelectedBankPaymentVoucher(null);
      } else {
        addToast('error', 'Gagal', 'Dokumen tidak ditemukan.');
      }
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal Menghapus', 'Terjadi kesalahan saat menghapus dokumen.');
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  // Helper for Type Badge Styling
  const renderTypeBadge = (type: UnifiedDocType) => {
    switch (type) {
      case 'rfo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            RFO
          </span>
        );
      case 'surat-tugas':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ClipboardList className="w-3 h-3 text-blue-600" />
            Surat Tugas
          </span>
        );
      case 'berita-acara':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FileText className="w-3 h-3 text-emerald-600" />
            Berita Acara
          </span>
        );
      case 'permit-barang':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <PackageCheck className="w-3 h-3 text-purple-600" />
            Permit Barang
          </span>
        );
      case 'bank-voucher':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CreditCard className="w-3 h-3 text-indigo-600" />
            Payment Voucher
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto bg-slate-50">
      {/* Main archive page content (hidden when printing modal) */}
      <div className="no-print space-y-4 sm:space-y-6">
        {/* 1. Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Pusat Arsip Dokumen
              </span>
              <span className="text-xs text-slate-500">Total {counts.all} dokumen</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">
              Arsip & Riwayat Dokumen
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Akses riwayat terpusat untuk dokumen Reason For Outage (RFO), Surat Tugas Visit, Berita Acara Visit, dan Permit Keluar/Masuk Barang.
            </p>
          </div>
        </div>

        {/* 2. Interactive Document Type Filter Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <button
            onClick={() => setTypeFilter('all')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'all'
                ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Semua Dokumen</p>
                <p className="text-base sm:text-lg font-black text-slate-900">{counts.all}</p>
              </div>
            </div>
            {typeFilter === 'all' && (
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setTypeFilter('rfo')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'rfo'
                ? 'bg-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">RFO</p>
                <p className="text-base sm:text-lg font-black text-amber-700">{counts.rfo}</p>
              </div>
            </div>
            {typeFilter === 'rfo' && (
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setTypeFilter('surat-tugas')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'surat-tugas'
                ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Surat Tugas</p>
                <p className="text-base sm:text-lg font-black text-blue-700">{counts.suratTugas}</p>
              </div>
            </div>
            {typeFilter === 'surat-tugas' && (
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setTypeFilter('berita-acara')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'berita-acara'
                ? 'bg-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Berita Acara</p>
                <p className="text-base sm:text-lg font-black text-emerald-700">{counts.beritaAcara}</p>
              </div>
            </div>
            {typeFilter === 'berita-acara' && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setTypeFilter('permit-barang')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'permit-barang'
                ? 'bg-white border-purple-600 shadow-xs ring-2 ring-purple-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Permit Barang</p>
                <p className="text-base sm:text-lg font-black text-purple-700">{counts.permitBarang}</p>
              </div>
            </div>
            {typeFilter === 'permit-barang' && (
              <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
            )}
          </button>

          <button
            onClick={() => setTypeFilter('bank-voucher')}
            className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              typeFilter === 'bank-voucher'
                ? 'bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Payment Voucher</p>
                <p className="text-base sm:text-lg font-black text-indigo-700">{counts.bankVoucher}</p>
              </div>
            </div>
            {typeFilter === 'bank-voucher' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
            )}
          </button>
        </div>

        {/* 3. Search and Filtering Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex-1 w-full flex items-center gap-2.5 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor dokumen, lokasi visit, root cause, kepentingan, atau nama petugas..."
              className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Creator Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="bg-transparent text-slate-800 focus:outline-none text-xs cursor-pointer max-w-[140px]"
              >
                <option value="" className="bg-white text-slate-700">
                  Semua Pembuat
                </option>
                {creatorOptions.map((name) => (
                  <option key={name} value={name} className="bg-white text-slate-900">
                    {name}
                  </option>
                ))}
              </select>
              {filterCreator && (
                <button
                  onClick={() => setFilterCreator('')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 shadow-2xs hover:border-blue-400 transition-colors"
              title="Cari berdasarkan Tanggal Pembuatan Surat"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
                Tgl Surat:
              </span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                aria-label="Cari berdasarkan tanggal pembuatan surat"
                title="Cari berdasarkan tanggal pembuatan surat"
                className="bg-transparent text-slate-800 focus:outline-none text-xs cursor-pointer"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded hover:bg-slate-200"
                  title="Hapus Filter Tanggal"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-white text-slate-900">
                Terbaru Dulu
              </option>
              <option value="oldest" className="bg-white text-slate-900">
                Terlama Dulu
              </option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-medium border border-slate-200 flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                title="Reset Semua Filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Document List / Table */}
        {loading ? (
          <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-500">Memuat seluruh arsip dokumen...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-900">Tidak ada dokumen yang ditemukan</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Tidak ada dokumen yang cocok dengan filter atau kata kunci pencarian Anda. Coba ubah kata kunci atau reset filter.'
                : 'Belum ada dokumen yang dibuat atau tersimpan di sistem.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-4 lg:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Info */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderTypeBadge(item.type)}
                      <span className="font-mono font-bold text-sm text-slate-900 tracking-wide">
                        {item.number}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span
                        className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
                        title="Tanggal Pembuatan Surat"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          Tgl Surat:{' '}
                          <strong className="font-semibold text-slate-900">
                            {formatIndonesianDateOnly(item.createdDate)}
                          </strong>
                        </span>
                      </span>
                      {item.type !== 'rfo' && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span
                            className="text-xs text-slate-500 flex items-center gap-1"
                            title="Periode Pelaksanaan Visit"
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Pelaksanaan: {item.date}</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">
                      {item.title}
                    </h3>

                    {item.subtitle && (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}

                    {/* Creation Metadata: Tanggal & Waktu Pembuatan serta Pembuat */}
                    <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-100 mt-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Dibuat: <strong className="font-semibold text-slate-900">{formatCreationTimestamp(item.createdAt)}</strong></span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Oleh: <strong className="font-semibold text-slate-900">{item.creator}</strong> {item.creatorRole ? `(${item.creatorRole})` : ''}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end pt-2 border-t border-slate-100 md:border-0 md:pt-0">
                    <button
                      onClick={() => handlePreview(item)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors cursor-pointer"
                      title="Lihat / Pratinjau Dokumen"
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                    </button>

                    {item.type !== 'bank-voucher' ? (
                      <button
                        onClick={() => handleDownloadPDF(item)}
                        disabled={downloadingId === item.id}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        title="Unduh PDF Langsung"
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <FileDown className="w-4 h-4 text-slate-700" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExportExcel(item)}
                        className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs transition-colors cursor-pointer"
                        title="Unduh Excel (.xlsx) Template Asli"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyWhatsApp(item)}
                      className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs transition-colors cursor-pointer"
                      title="Salin Format WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-xs transition-colors cursor-pointer"
                      title="Edit Dokumen"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDuplicate(item)}
                      className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-xs transition-colors cursor-pointer"
                      title="Duplikasi Dokumen"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {canDelete && (
                      <button
                        onClick={() =>
                          setDeleteConfirmItem({
                            id: item.id,
                            type: item.type,
                            number: item.number,
                          })
                        }
                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-xs transition-colors cursor-pointer"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL PREVIEW RFO ================= */}
      {selectedRFO && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="print-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="no-print px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  RFO Preview
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold truncate">
                  {selectedRFO.ticketNo || selectedRFO.id}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 font-medium shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Dokumen"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
                <button
                  onClick={() => {
                    const item = unifiedItems.find((u) => u.id === selectedRFO.id && u.type === 'rfo');
                    if (item) handleDownloadPDF(item);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh PDF Resmi"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor PDF</span>
                  <span className="sm:hidden font-semibold">PDF</span>
                </button>
                <button
                  onClick={() => setSelectedRFO(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5 sm:ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Metadata Waktu Pembuatan & Pembuat */}
            <div className="no-print px-3.5 py-2 sm:px-5 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 text-[11px] sm:text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Waktu: <strong className="text-slate-900 font-semibold">{formatCreationTimestamp(selectedRFO.createdAt)}</strong></span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Oleh: <strong className="text-slate-900 font-semibold">{selectedRFO.createdByName || 'Staff NOC'}</strong> {selectedRFO.createdByRole ? `(${selectedRFO.createdByRole})` : ''}</span>
              </span>
            </div>

            {/* Modal Body: A4 Paper Document */}
            <div className="print-modal-body p-2 sm:p-4 lg:p-8 overflow-auto bg-slate-100/70 flex justify-start sm:justify-center">
              <div id="history-rfo-preview-modal-doc" className="print-modal-doc-wrapper w-full max-w-[210mm] min-w-[210mm] sm:min-w-0 shadow-lg shadow-slate-300/60 rounded-sm">
                <RFOPaperDocument
                  rfo={selectedRFO}
                  template={template}
                  id="rfo-paper-doc"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW SURAT TUGAS ================= */}
      {selectedSuratTugas && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="print-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="no-print px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  Surat Tugas
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold truncate">
                  {selectedSuratTugas.letterNumber}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 font-medium shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Dokumen"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
                <button
                  onClick={() => {
                    const item = unifiedItems.find((u) => u.id === selectedSuratTugas.id && u.type === 'surat-tugas');
                    if (item) handleDownloadPDF(item);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh PDF Resmi"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor PDF</span>
                  <span className="sm:hidden font-semibold">PDF</span>
                </button>
                <button
                  onClick={() => setSelectedSuratTugas(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5 sm:ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Metadata Waktu Pembuatan & Pembuat */}
            <div className="no-print px-3.5 py-2 sm:px-5 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 text-[11px] sm:text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Waktu: <strong className="text-slate-900 font-semibold">{formatCreationTimestamp(selectedSuratTugas.createdAt)}</strong></span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Oleh: <strong className="text-slate-900 font-semibold">{selectedSuratTugas.createdByName || 'Staff NOC'}</strong> {selectedSuratTugas.createdByRole ? `(${selectedSuratTugas.createdByRole})` : ''}</span>
              </span>
            </div>

            {/* Modal Body: A4 Paper Document */}
            <div className="print-modal-body p-2 sm:p-4 lg:p-8 overflow-auto bg-slate-100/70 flex justify-start sm:justify-center">
              <div id="history-surat-tugas-modal-doc" className="print-modal-doc-wrapper w-full max-w-[210mm] min-w-[210mm] sm:min-w-0 shadow-lg shadow-slate-300/60 rounded-sm">
                <SuratTugasPaperDocument
                  doc={selectedSuratTugas}
                  template={suratTugasTemplate}
                  id="surat-tugas-paper-doc"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW BERITA ACARA ================= */}
      {selectedBeritaAcara && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="print-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="no-print px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  Berita Acara
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold truncate">
                  {selectedBeritaAcara.letterNumber}
                </span>
              </div>

              {/* Multi-page tabs */}
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 sm:p-1 text-[11px] sm:text-xs overflow-x-auto no-scrollbar order-3 sm:order-2 w-full sm:w-auto justify-center">
                <button
                  onClick={() => setBaModalPageTab('all')}
                  className={`px-2 sm:px-2.5 py-1 rounded cursor-pointer font-medium whitespace-nowrap ${
                    baModalPageTab === 'all'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setBaModalPageTab(1)}
                  className={`px-2 sm:px-2.5 py-1 rounded cursor-pointer font-medium whitespace-nowrap ${
                    baModalPageTab === 1
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hal 1: Utama
                </button>
                {selectedBeritaAcara.attachments && selectedBeritaAcara.attachments.length > 0 && (
                  <button
                    onClick={() => setBaModalPageTab(2)}
                    className={`px-2 sm:px-2.5 py-1 rounded cursor-pointer font-medium whitespace-nowrap ${
                      baModalPageTab === 2
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lampiran
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 sm:order-3">
                <button
                  onClick={() => {
                    setBaModalPageTab('all');
                    setTimeout(() => window.print(), 100);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 font-medium shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Dokumen"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
                <button
                  onClick={() => {
                    const item = unifiedItems.find((u) => u.id === selectedBeritaAcara.id && u.type === 'berita-acara');
                    if (item) handleDownloadPDF(item);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh PDF Resmi"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor PDF</span>
                  <span className="sm:hidden font-semibold">PDF</span>
                </button>
                <button
                  onClick={() => setSelectedBeritaAcara(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5 sm:ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Metadata Waktu Pembuatan & Pembuat */}
            <div className="no-print px-3.5 py-2 sm:px-5 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 text-[11px] sm:text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Waktu: <strong className="text-slate-900 font-semibold">{formatCreationTimestamp(selectedBeritaAcara.createdAt)}</strong></span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Oleh: <strong className="text-slate-900 font-semibold">{selectedBeritaAcara.createdByName || 'Staff NOC'}</strong> {selectedBeritaAcara.createdByRole ? `(${selectedBeritaAcara.createdByRole})` : ''}</span>
              </span>
            </div>

            {/* Modal Body: A4 Paper Document */}
            <div className="print-modal-body p-2 sm:p-4 lg:p-8 overflow-auto bg-slate-100/70 flex justify-start sm:justify-center">
              <div id="history-berita-acara-modal-doc" className="print-modal-doc-wrapper w-full max-w-[210mm] min-w-[210mm] sm:min-w-0 shadow-lg shadow-slate-300/60 rounded-sm">
                <BeritaAcaraPaperDocument
                  doc={selectedBeritaAcara}
                  template={beritaAcaraTemplate || template}
                  id="berita-acara-paper-doc"
                  previewPageFilter={baModalPageTab}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW PERMIT BARANG ================= */}
      {selectedPermitBarang && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="print-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="no-print px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                  Permit Barang
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold truncate">
                  {selectedPermitBarang.subject}
                </span>
              </div>

              {/* Page Tabs for Multi-Page Permit Barang */}
              {isPermitBarangMultiPage(selectedPermitBarang) && (
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 ml-1 sm:ml-2">
                  <button
                    type="button"
                    onClick={() => setPmModalPageTab('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      pmModalPageTab === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setPmModalPageTab(1)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      pmModalPageTab === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hal 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setPmModalPageTab(2)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                      pmModalPageTab === 2
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hal 2
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => {
                    setPmModalPageTab('all');
                    setTimeout(() => window.print(), 100);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 font-medium shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Dokumen"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
                <button
                  onClick={() => {
                    const item = unifiedItems.find((u) => u.id === selectedPermitBarang.id && u.type === 'permit-barang');
                    if (item) handleDownloadPDF(item);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh PDF Resmi"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor PDF</span>
                  <span className="sm:hidden font-semibold">PDF</span>
                </button>
                <button
                  onClick={() => setSelectedPermitBarang(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5 sm:ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Metadata Waktu Pembuatan & Pembuat */}
            <div className="no-print px-3.5 py-2 sm:px-5 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 text-[11px] sm:text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Waktu: <strong className="text-slate-900 font-semibold">{formatCreationTimestamp(selectedPermitBarang.createdAt)}</strong></span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Oleh: <strong className="text-slate-900 font-semibold">{selectedPermitBarang.createdByName || 'Staff NOC'}</strong> {selectedPermitBarang.createdByRole ? `(${selectedPermitBarang.createdByRole})` : ''}</span>
              </span>
            </div>

            {/* Modal Body: A4 Paper Document */}
            <div className="print-modal-body p-2 sm:p-4 lg:p-8 overflow-auto bg-slate-100/70 flex justify-start sm:justify-center">
              <div id="history-permit-barang-modal-doc" className="print-modal-doc-wrapper w-full max-w-[210mm] min-w-[210mm] sm:min-w-0 shadow-lg shadow-slate-300/60 rounded-sm">
                <PermitBarangPaperDocument
                  doc={selectedPermitBarang}
                  template={permitBarangTemplate}
                  id="permit-barang-paper-doc"
                  previewPageFilter={pmModalPageTab}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PREVIEW BANK PAYMENT VOUCHER ================= */}
      {selectedBankPaymentVoucher && (
        <div className="print-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="print-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="no-print px-3.5 py-2.5 sm:px-5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  Payment Voucher
                </span>
                <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold truncate">
                  {selectedBankPaymentVoucher.voucherNumber}
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-xs text-slate-700 font-semibold truncate hidden sm:inline">
                  {selectedBankPaymentVoucher.payTo}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => setTimeout(() => window.print(), 100)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 font-medium shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Cetak Voucher"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      addToast('info', 'Membuat Excel...', 'Sedang memproses berkas Excel...');
                      await downloadBankPaymentVoucherExcel(selectedBankPaymentVoucher);
                      const filename = generateBankPaymentVoucherFileName(selectedBankPaymentVoucher, 'xlsx');
                      addToast('success', 'Excel Terunduh', `${filename} berhasil diunduh.`);
                    } catch {
                      addToast('error', 'Gagal', 'Terjadi kesalahan saat memproses Excel.');
                    }
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh Excel (.xlsx) Template Asli"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor Excel</span>
                  <span className="sm:hidden font-semibold">Excel</span>
                </button>
                <button
                  onClick={() => setSelectedBankPaymentVoucher(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer ml-0.5 sm:ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Subheader: Metadata Waktu Pembuatan & Total */}
            <div className="no-print px-3.5 py-2 sm:px-5 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Dibuat: <strong className="text-slate-900 font-semibold">{formatCreationTimestamp(selectedBankPaymentVoucher.createdAt)}</strong></span>
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Disiapkan: <strong className="text-slate-900 font-semibold">{selectedBankPaymentVoucher.preparedByName || selectedBankPaymentVoucher.payTo}</strong></span>
                </span>
              </div>
              <div className="font-mono font-bold text-indigo-900">
                Total: {formatRupiahFull(selectedBankPaymentVoucher.totalAmount)}
              </div>
            </div>

            {/* Modal Body: A4 Paper Document */}
            <div className="print-modal-body p-2 sm:p-4 lg:p-8 overflow-auto bg-slate-100/70 flex justify-start sm:justify-center">
              <div id="history-bpv-modal-doc" className="print-modal-doc-wrapper w-full max-w-[210mm] min-w-[210mm] sm:min-w-0 shadow-lg shadow-slate-300/60 rounded-sm">
                <BankPaymentVoucherPaperDocument
                  doc={selectedBankPaymentVoucher}
                  id="bank-payment-voucher-paper-doc"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deleteConfirmItem && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Apakah Anda yakin ingin menghapus arsip{' '}
              <strong className="text-slate-900 uppercase font-bold">{deleteConfirmItem.type}</strong> dengan nomor{' '}
              <code className="text-blue-700 font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {deleteConfirmItem.number}
              </code>
              ? Dokumen ini akan dihapus secara permanen dari penyimpanan.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-300 shadow-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offscreen background rendering container for direct PDF download without opening modal */}
      {exportingItem && (
        <div
          id="pdf-direct-export-hidden-container"
          aria-hidden="true"
          className="no-print"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          {exportingItem.type === 'rfo' && exportingItem.rawRFO && (
            <div id="direct-export-rfo-doc" className="w-[794px]">
              <RFOPaperDocument
                rfo={exportingItem.rawRFO}
                template={template}
                id="direct-export-rfo-paper"
              />
            </div>
          )}

          {exportingItem.type === 'surat-tugas' && exportingItem.rawSuratTugas && (
            <div id="direct-export-st-doc" className="w-[794px]">
              <SuratTugasPaperDocument
                doc={exportingItem.rawSuratTugas}
                template={suratTugasTemplate}
                id="direct-export-st-paper"
              />
            </div>
          )}

          {exportingItem.type === 'berita-acara' && exportingItem.rawBeritaAcara && (
            <div id="direct-export-ba-doc" className="w-[794px] flex flex-col gap-4">
              <BeritaAcaraPaperDocument
                doc={exportingItem.rawBeritaAcara}
                template={beritaAcaraTemplate}
                id="direct-export-ba-paper"
                previewPageFilter="all"
              />
            </div>
          )}

          {exportingItem.type === 'permit-barang' && exportingItem.rawPermitBarang && (
            <div id="direct-export-pm-doc" className="w-[794px] flex flex-col gap-4">
              <PermitBarangPaperDocument
                doc={exportingItem.rawPermitBarang}
                template={permitBarangTemplate}
                id="direct-export-pm-paper"
                previewPageFilter="all"
              />
            </div>
          )}

          {exportingItem.type === 'bank-voucher' && exportingItem.rawBankPaymentVoucher && (
            <div id="direct-export-bpv-doc" className="w-[794px]">
              <BankPaymentVoucherPaperDocument
                doc={exportingItem.rawBankPaymentVoucher}
                id="direct-export-bpv-paper"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
