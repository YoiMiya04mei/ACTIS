import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Copy,
  MessageSquare,
  Users,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  UserCheck,
  FileText,
  ChevronLeft,
  Clock,
  HardDrive,
  Printer,
  FileDown,
  Boxes,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type {
  PermitBarangDocument,
  PermitBarangDevice,
  PermitBarangTemplate,
  PermitType,
} from '@/types/permitBarang';
import type { RFOTemplate } from '@/types/rfo';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { PermitBarangPaperDocument } from '@/components/tools/PermitBarangPaperDocument';
import {
  formatPermitBarangDate,
  generatePermitBarangPlainText,
  generatePermitBarangWhatsAppText,
  generatePermitBarangNumber,
  generatePermitBarangFileName,
  isPermitBarangMultiPage,
} from '@/utils/permitBarangUtils';
import { permitBarangStorage } from '@/services/permitBarangStorage';
import { PDFService } from '@/services/pdfService';
import { toDateInputString } from '@/utils/dateFormatter';
import { useDialog } from '@/context/DialogContext';

interface CreatePermitBarangPageProps {
  template: RFOTemplate;
  permitBarangTemplate?: PermitBarangTemplate;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  initialEditData?: PermitBarangDocument | null;
  onSaved?: () => void;
  currentUser?: UserAccount | null;
}

const COMMON_DEVICES = [
  'Routerboard 1100AHx4',
  'Switch RG-NB3200-24SFP/8GT4XS',
  'Server Dell PowerEdge',
  'PC Rakitan',
  'Mikrotik CCR2004-16G-2S+',
  'Switch Cisco Catalyst 2960',
  'Transceiver SFP+ 10G LR',
  'Patch Cord Fiber LC-LC',
];

const COMMON_LOCATIONS = [
  'Gedung Wisma Bumi Putera Suite 701A',
  'Data Center Neucentrix Karet Lt. 2',
  'Data Center Cyber 1 Kuningan Lt. 3',
  'Data Center IDC 3D Duren Tiga',
  'Data Center Telkom STO Gambir',
  'PoP Sukabumi Kota',
];

export const CreatePermitBarangPage: React.FC<CreatePermitBarangPageProps> = ({
  template,
  permitBarangTemplate,
  addToast,
  initialEditData,
  onSaved,
  currentUser,
}) => {
  const { confirm: confirmDialog } = useDialog();
  // Form State
  const [permitType, setPermitType] = useState<PermitType>(
    initialEditData?.permitType || 'keluar'
  );
  const [createdDate, setCreatedDate] = useState<string>(
    initialEditData?.createdDate || toDateInputString()
  );
  const [letterLocation, setLetterLocation] = useState<string>(
    initialEditData?.letterLocation ||
      permitBarangTemplate?.letterLocation ||
      'Sukabumi'
  );
  const [subject, setSubject] = useState<string>(
    initialEditData?.subject || 'Permit Keluar Barang'
  );

  // Recipient (Kepada Yth)
  const [recipientTitle, setRecipientTitle] = useState<string>(
    initialEditData?.recipientTitle ||
      permitBarangTemplate?.defaultRecipientTitle ||
      'Pihak Gedung / Security Wisma Bumi Putera'
  );
  const [recipientAddress, setRecipientAddress] = useState<string>(
    initialEditData?.recipientAddress ||
      permitBarangTemplate?.defaultRecipientAddress ||
      'Jl. Asia Afrika No. 141-149, Pisang, Sumur Bandung'
  );
  const [recipientCity, setRecipientCity] = useState<string>(
    initialEditData?.recipientCity ||
      permitBarangTemplate?.defaultRecipientCity ||
      'Bandung'
  );

  // Applicant (Pemohon / PIC)
  const [applicantName, setApplicantName] = useState<string>(
    initialEditData?.applicantName || 'Rahmat & Hendrik'
  );
  const [applicantPosition, setApplicantPosition] = useState<string>(
    initialEditData?.applicantPosition ||
      permitBarangTemplate?.defaultApplicantPosition ||
      'PIC'
  );
  const [applicantPhone, setApplicantPhone] = useState<string>(
    initialEditData?.applicantPhone || '085759535195 / 082222203322'
  );

  // Execution Details
  const [permitDate, setPermitDate] = useState<string>(
    initialEditData?.permitDate || toDateInputString()
  );
  const [permitTime, setPermitTime] = useState<string>(
    initialEditData?.permitTime || '09.00 s.d 15.00'
  );
  const [activity, setActivity] = useState<string>(
    initialEditData?.activity || 'Permit Keluar'
  );
  const [location, setLocation] = useState<string>(
    initialEditData?.location ||
      permitBarangTemplate?.defaultLocation ||
      'Gedung Wisma Bumi Putera Suite 701A'
  );

  // Devices List (Bisa lebih dari satu)
  const [devices, setDevices] = useState<PermitBarangDevice[]>(() => {
    if (initialEditData?.devices && initialEditData.devices.length > 0) {
      return initialEditData.devices;
    }
    return [
      { id: 'dev-1', name: 'Routerboard 1100AHx4' },
      { id: 'dev-2', name: 'Switch RG-NB3200-24SFP/8GT4XS' },
      { id: 'dev-3', name: 'Server Dell' },
      { id: 'dev-4', name: 'PC Rakitan' },
    ];
  });

  // Signer
  const [signerName, setSignerName] = useState<string>(
    initialEditData?.signerName ||
      permitBarangTemplate?.signerName ||
      'Rio Prayoga'
  );
  const [signerPosition, setSignerPosition] = useState<string>(
    initialEditData?.signerPosition ||
      permitBarangTemplate?.signerPosition ||
      'Direktur'
  );

  // Custom text toggles
  const [showAdvancedText, setShowAdvancedText] = useState<boolean>(false);
  const [customOpening, setCustomOpening] = useState<string>(
    initialEditData?.openingText || ''
  );
  const [customClosing, setCustomClosing] = useState<string>(
    initialEditData?.closingText || ''
  );

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(
    initialEditData?.id || null
  );
  const [sequenceNumber, setSequenceNumber] = useState<number>(
    initialEditData?.sequenceNumber || 101
  );

  // UI State
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
  );
  const [previewPageTab, setPreviewPageTab] = useState<'all' | 1 | 2>('all');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // When switching permit type between 'keluar' and 'masuk'
  const handlePermitTypeChange = (newType: PermitType) => {
    setPermitType(newType);
    if (newType === 'keluar') {
      setSubject('Permit Keluar Barang');
      setActivity('Permit Keluar');
    } else if (newType === 'masuk') {
      setSubject('Permit Masuk Barang');
      setActivity('Permit Masuk');
    }
  };

  // Sync initialEditData when editing from history
  useEffect(() => {
    if (initialEditData) {
      setEditingId(initialEditData.id);
      setPermitType(initialEditData.permitType || 'keluar');
      setCreatedDate(initialEditData.createdDate || toDateInputString());
      setLetterLocation(initialEditData.letterLocation || 'Sukabumi');
      setSubject(initialEditData.subject || 'Permit Keluar Barang');
      setRecipientTitle(initialEditData.recipientTitle || '');
      setRecipientAddress(initialEditData.recipientAddress || '');
      setRecipientCity(initialEditData.recipientCity || '');
      setApplicantName(initialEditData.applicantName || '');
      setApplicantPosition(initialEditData.applicantPosition || 'PIC');
      setApplicantPhone(initialEditData.applicantPhone || '');
      setPermitDate(initialEditData.permitDate || toDateInputString());
      setPermitTime(initialEditData.permitTime || '09.00 s.d 15.00');
      setActivity(initialEditData.activity || 'Permit Keluar');
      setLocation(initialEditData.location || '');
      setDevices(initialEditData.devices || []);
      setSignerName(initialEditData.signerName || 'Rio Prayoga');
      setSignerPosition(initialEditData.signerPosition || 'Direktur');
      if (initialEditData.openingText) setCustomOpening(initialEditData.openingText);
      if (initialEditData.closingText) setCustomClosing(initialEditData.closingText);
    } else {
      permitBarangStorage.getNextSequenceNumber().then((next) => {
        setSequenceNumber(next);
      });
    }
  }, [initialEditData]);

  // Sync signer, recipient, and location from template if template changes
  useEffect(() => {
    if (!initialEditData && permitBarangTemplate) {
      if (permitBarangTemplate.signerName) setSignerName(permitBarangTemplate.signerName);
      if (permitBarangTemplate.signerPosition) setSignerPosition(permitBarangTemplate.signerPosition);
      if (permitBarangTemplate.letterLocation) setLetterLocation(permitBarangTemplate.letterLocation);
      if (permitBarangTemplate.defaultRecipientTitle) setRecipientTitle(permitBarangTemplate.defaultRecipientTitle);
      if (permitBarangTemplate.defaultRecipientAddress) setRecipientAddress(permitBarangTemplate.defaultRecipientAddress);
      if (permitBarangTemplate.defaultRecipientCity) setRecipientCity(permitBarangTemplate.defaultRecipientCity);
    }
  }, [permitBarangTemplate, initialEditData]);

  // Device List Handlers
  const handleAddDevice = (defaultName = '') => {
    const newId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setDevices((prev) => [
      ...prev,
      {
        id: newId,
        name: defaultName,
      },
    ]);
  };

  const handleUpdateDevice = (id: string, field: keyof PermitBarangDevice, value: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const handleRemoveDevice = (id: string) => {
    if (devices.length <= 1) {
      addToast('info', 'Perhatian', 'Minimal sertakan 1 perangkat dalam daftar permit.');
      return;
    }
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  // Quick fill user
  const handleUseMyAccount = () => {
    if (!currentUser) return;
    setApplicantName(currentUser.name);
    setApplicantPosition(currentUser.position || 'Staff NOC');
    addToast('success', 'Data Pemohon Terisi', `Nama diisi dengan ${currentUser.name}.`);
  };

  // Inventory Stock Integration
  const [checkingStock, setCheckingStock] = useState<boolean>(false);
  const [stockCheckResults, setStockCheckResults] = useState<
    Record<string, { available: number; sufficient: boolean; code?: string; name?: string; message?: string }>
  >({});

  const handleCheckStock = async () => {
    const validDevices = devices.filter((d) => d.name.trim().length > 0);
    if (validDevices.length === 0) {
      addToast('info', 'Daftar Kosong', 'Tambahkan minimal satu nama perangkat untuk mengecek stok.');
      return;
    }

    setCheckingStock(true);
    try {
      const res = await fetch('/api/inventory/permit-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_stock',
          devices: validDevices.map((d) => ({
            name: d.name,
            quantity: d.quantity || '1',
          })),
        }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const resultsMap: Record<string, any> = {};
        json.data.forEach((item: any) => {
          resultsMap[item.device_name.toLowerCase()] = {
            available: item.available_stock,
            sufficient: item.is_sufficient,
            code: item.matched_item_code,
            name: item.matched_item_name,
            message: item.message,
          };
        });
        setStockCheckResults(resultsMap);
        addToast(
          'success',
          'Pemeriksaan Stok Selesai',
          `Berhasil memeriksa ${json.data.length} perangkat terhadap database Inventory.`
        );
      } else {
        throw new Error(json.error || 'Gagal mengecek stok.');
      }
    } catch (err: any) {
      addToast('error', 'Gagal Cek Stok', err.message || 'Koneksi ke database inventory gagal.');
    } finally {
      setCheckingStock(false);
    }
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!subject.trim()) errors.subject = 'Perihal wajib diisi.';
    if (!applicantName.trim()) errors.applicantName = 'Nama pemohon / PIC wajib diisi.';
    if (!applicantPhone.trim()) errors.applicantPhone = 'Nomor telepon wajib diisi.';
    if (!permitDate) errors.permitDate = 'Waktu/tanggal permit wajib diisi.';
    if (!permitTime.trim()) errors.permitTime = 'Pukul pelaksanaan wajib diisi.';
    if (!location.trim()) errors.location = 'Lokasi wajib diisi.';

    const emptyDevice = devices.some((d) => !d.name.trim());
    if (emptyDevice) errors.devices = 'Semua nama perangkat wajib diisi.';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Current document object
  const currentDoc: PermitBarangDocument = useMemo(() => {
    return {
      id: editingId || `PM-${Date.now()}`,
      letterNumber: generatePermitBarangNumber(sequenceNumber, createdDate),
      sequenceNumber,
      createdDate,
      letterLocation,
      subject,
      permitType,
      recipientTitle,
      recipientAddress,
      recipientCity,
      applicantName,
      applicantPosition,
      applicantPhone,
      openingText: customOpening.trim() ? customOpening : undefined,
      permitDate,
      permitTime,
      activity,
      devices: devices.filter((d) => d.name.trim().length > 0),
      location,
      closingText: customClosing.trim() ? customClosing : undefined,
      signerName,
      signerPosition,
      companyName: template?.companyName || 'PT JEMBATAN DATA PANGRANGO',
      companyAddress: template?.companyAddress || 'Jl. Arca No. 07, Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
      companyPhone: template?.companyPhone || '+62 857-9870-8612',
      companyEmail: template?.companyEmail || 'admin@jembatandata.com',
      companyWebsite: template?.companyWebsite || 'Sukabuminetwork.net',
      createdAt: initialEditData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: initialEditData?.createdBy || currentUser?.id,
      createdByName: initialEditData?.createdByName || currentUser?.name || 'Staff NOC',
      createdByRole: initialEditData?.createdByRole || currentUser?.role || 'engineer',
    };
  }, [
    editingId,
    sequenceNumber,
    createdDate,
    letterLocation,
    subject,
    permitType,
    recipientTitle,
    recipientAddress,
    recipientCity,
    applicantName,
    applicantPosition,
    applicantPhone,
    customOpening,
    permitDate,
    permitTime,
    activity,
    devices,
    location,
    customClosing,
    signerName,
    signerPosition,
    template,
    initialEditData,
    currentUser,
  ]);

  // Actions
  const handleSave = async () => {
    if (!validateForm()) {
      addToast('error', 'Formulir Belum Lengkap', 'Silakan lengkapi kolom yang bertanda merah.');
      return;
    }

    try {
      await permitBarangStorage.savePermitBarang(currentDoc);
      addToast(
        'success',
        editingId ? 'Surat Permit Diperbarui' : 'Surat Permit Berhasil Dibuat',
        `Perihal: ${subject} untuk ${location} telah disimpan ke riwayat.`
      );

      if (!editingId) {
        setSequenceNumber((prev) => prev + 1);
      }

      if (onSaved) {
        onSaved();
      }
    } catch {
      addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan sistem saat menyimpan dokumen.');
    }
  };

  const handleCopyWhatsApp = async () => {
    const text = generatePermitBarangWhatsAppText(currentDoc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks WhatsApp Disalin', 'Format siap dikirim via WhatsApp / Telegram.');
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const handleCopyPlainText = async () => {
    const text = generatePermitBarangPlainText(currentDoc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks Resmi Disalin', 'Teks surat permit berhasil disalin.');
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  const handlePrint = () => {
    setPreviewPageTab('all');
    setTimeout(() => window.print(), 100);
  };

  const handleDownloadPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    addToast('info', 'Membuat PDF Permit Barang...', 'Sedang merender layout dokumen.');
    setPreviewPageTab('all');

    setTimeout(async () => {
      try {
        const selector =
          '#create-permit-barang-preview-doc .permit-barang-page, #create-permit-barang-preview-doc .permit-barang-single-page';
        const pageElements = document.querySelectorAll<HTMLElement>(selector);
        const filename = generatePermitBarangFileName(
          currentDoc.subject,
          currentDoc.location,
          currentDoc.permitDate || currentDoc.createdDate
        );

        if (pageElements.length > 1) {
          await PDFService.exportMultiPagePDF(pageElements, filename);
        } else if (pageElements.length === 1) {
          await PDFService.exportSinglePagePDF(pageElements[0], filename);
        } else {
          const docElem = document.getElementById('create-permit-barang-preview-doc');
          if (!docElem) {
            addToast('error', 'Gagal', 'Elemen dokumen tidak ditemukan.');
            return;
          }
          await PDFService.exportSinglePagePDF(docElem, filename);
        }
        addToast('success', 'PDF Terunduh', filename);
      } catch (e) {
        console.error('PDF export error:', e);
        addToast('error', 'Gagal', 'Terjadi kesalahan saat memproses rendering.');
      } finally {
        setIsExportingPDF(false);
      }
    }, 250);
  };

  const handleResetForm = async () => {
    if (await confirmDialog('Reset formulir surat permit barang ke data awal?')) {
      setEditingId(null);
      setPermitType('keluar');
      setSubject('Permit Keluar Barang');
      setCreatedDate(toDateInputString());
      setLetterLocation(permitBarangTemplate?.letterLocation || 'Sukabumi');
      setRecipientTitle(permitBarangTemplate?.defaultRecipientTitle || 'Pihak Gedung / Security Wisma Bumi Putera');
      setRecipientAddress(permitBarangTemplate?.defaultRecipientAddress || 'Jl. Asia Afrika No. 141-149, Pisang, Sumur Bandung');
      setRecipientCity(permitBarangTemplate?.defaultRecipientCity || 'Bandung');
      setApplicantName('Rahmat & Hendrik');
      setApplicantPosition('PIC');
      setApplicantPhone('085759535195 / 082222203322');
      setPermitDate(toDateInputString());
      setPermitTime('09.00 s.d 15.00');
      setActivity('Permit Keluar');
      setLocation(permitBarangTemplate?.defaultLocation || 'Gedung Wisma Bumi Putera Suite 701A');
      setDevices([
        { id: 'dev-1', name: 'Routerboard 1100AHx4' },
        { id: 'dev-2', name: 'Switch RG-NB3200-24SFP/8GT4XS' },
        { id: 'dev-3', name: 'Server Dell' },
        { id: 'dev-4', name: 'PC Rakitan' },
      ]);
      setSignerName(permitBarangTemplate?.signerName || 'Rio Prayoga');
      setSignerPosition(permitBarangTemplate?.signerPosition || 'Direktur');
      setCustomOpening('');
      setCustomClosing('');
      setValidationErrors({});
      addToast('info', 'Form Direset', 'Formulir telah dikembalikan ke kondisi awal.');
    }
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row min-h-0 overflow-y-auto xl:overflow-hidden bg-slate-50">
      {/* Mobile Tab Switcher (< xl) */}
      <div className="xl:hidden bg-white border-b border-slate-200 p-2 flex items-center justify-center gap-2 shrink-0 z-10 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'form'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Isi Formulir</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'preview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Pratinjau A4</span>
        </button>
      </div>

      {/* LEFT COLUMN: Input Form */}
      <div
        className={`w-full xl:w-[48%] flex flex-col border-r border-slate-200 bg-white p-3 sm:p-4 lg:p-6 overflow-y-auto ${
          mobileTab === 'preview' ? 'hidden xl:flex' : 'flex'
        }`}
      >
        <div className="space-y-6 max-w-2xl mx-auto w-full">
          {/* Header Title with Type Switcher */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Permit Generator
                </span>
                {editingId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Mode Edit #{editingId}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {editingId ? 'Edit Surat Permit' : 'Buat Surat Permit Masuk / Keluar Barang'}
              </h1>
              <p className="text-xs text-slate-500">
                Permohonan izin resmi mengeluarkan atau memasukkan perangkat ke gedung / data center
              </p>
            </div>

            <button
              onClick={handleResetForm}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-1.5 transition-colors shadow-xs font-medium cursor-pointer"
              title="Reset Formulir"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Switcher: Permit Keluar vs Permit Masuk */}
          <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePermitTypeChange('keluar')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                permitType === 'keluar'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>Permit Keluar Barang</span>
            </button>
            <button
              type="button"
              onClick={() => handlePermitTypeChange('masuk')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                permitType === 'masuk'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span>Permit Masuk Barang</span>
            </button>
          </div>

          {/* SECTION 1: Tanggal di Pojok Kanan & Perihal */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 1. Tanggal di Pojok Kanan & Perihal
              </span>
              <span className="text-[11px] text-slate-400">Posisi sudut kanan atas surat</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Surat
              </label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-mono"
              />
            </div>

            <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Format Pratinjau Pojok Kanan:</span>
              <span className="font-bold text-blue-800 font-mono">
                {letterLocation ? `${letterLocation}, ` : ''}{formatPermitBarangDate(createdDate)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Perihal Surat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white ${
                  validationErrors.subject ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="Permit Keluar Barang"
              />
              {validationErrors.subject && (
                <p className="text-[11px] text-red-500 mt-1">{validationErrors.subject}</p>
              )}
            </div>
          </div>

          {/* SECTION 2: Data Pemohon (Nama, Jabatan, Nomor Telepon) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> 2. Data Pemohon / Pelaksana
              </span>
              {currentUser && (
                <button
                  type="button"
                  onClick={handleUseMyAccount}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer flex items-center gap-1"
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Gunakan Akun Saya</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Pemohon / Petugas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white ${
                  validationErrors.applicantName ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="Rahmat & Hendrik"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Bisa diisi satu nama atau lebih (misal: Rahmat & Hendrik)
              </span>
              {validationErrors.applicantName && (
                <p className="text-[11px] text-red-500 mt-1">{validationErrors.applicantName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan
                </label>
                <input
                  type="text"
                  value={applicantPosition}
                  onChange={(e) => setApplicantPosition(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="PIC"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Telepon / Kontak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white ${
                    validationErrors.applicantPhone ? 'border-red-500 bg-red-50' : 'border-slate-300'
                  }`}
                  placeholder="085759535195 / 082222203322"
                />
                {validationErrors.applicantPhone && (
                  <p className="text-[11px] text-red-500 mt-1">{validationErrors.applicantPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: Waktu, Pukul, Aktivitas & Lokasi */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> 3. Jadwal & Lokasi Pelaksanaan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Waktu (Tanggal Pelaksanaan) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={permitDate}
                  onChange={(e) => setPermitDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-mono ${
                    validationErrors.permitDate ? 'border-red-500 bg-red-50' : 'border-slate-300'
                  }`}
                />
                {validationErrors.permitDate && (
                  <p className="text-[11px] text-red-500 mt-1">{validationErrors.permitDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pukul <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={permitTime}
                  onChange={(e) => setPermitTime(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white ${
                    validationErrors.permitTime ? 'border-red-500 bg-red-50' : 'border-slate-300'
                  }`}
                  placeholder="09.00 s.d 15.00"
                />
                {validationErrors.permitTime && (
                  <p className="text-[11px] text-red-500 mt-1">{validationErrors.permitTime}</p>
                )}
              </div>
            </div>

            {/* Quick Time Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Preset Pukul:</span>
              {['09.00 s.d 15.00', '08.00 s.d 17.00', '22.00 s.d 04.00', '00.00 s.d 24.00'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPermitTime(preset)}
                  className="px-2 py-0.5 rounded-md text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Aktivitas
              </label>
              <input
                type="text"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Permit Keluar"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lokasi Gedung / Ruangan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white ${
                  validationErrors.location ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="Gedung Wisma Bumi Putera Suite 701A"
              />
              {validationErrors.location && (
                <p className="text-[11px] text-red-500 mt-1">{validationErrors.location}</p>
              )}

              {/* Suggestions */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {COMMON_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 cursor-pointer"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: Jenis Perangkat (Bisa lebih dari satu) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4" /> 4. Jenis Perangkat ({devices.length} Item)
                </span>
                <span className="text-[11px] text-slate-400">Dapat menambahkan banyak perangkat</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckStock}
                  disabled={checkingStock}
                  className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                  title="Periksa ketersediaan stok barang ini di gudang inventory ACTIS"
                >
                  <Boxes className={`w-3.5 h-3.5 ${checkingStock ? 'animate-spin' : ''}`} />
                  <span>{checkingStock ? 'Memeriksa...' : 'Cek Stok Gudang'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddDevice('')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Perangkat</span>
                </button>
              </div>
            </div>

            {/* Quick Add Chips */}
            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-1">
                Pilih Cepat Perangkat Umum:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_DEVICES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddDevice(name)}
                    className="text-[10.5px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-700 border border-slate-200 cursor-pointer transition-colors"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Devices */}
            <div className="space-y-2.5 mt-2">
              {devices.map((device, index) => (
                <div
                  key={device.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-colors flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {index + 1}
                  </span>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        value={device.name}
                        onChange={(e) => handleUpdateDevice(device.id, 'name', e.target.value)}
                        placeholder="Nama/Spesifikasi Perangkat (e.g. Routerboard 1100AHx4)"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
                      />
                      {device.name && stockCheckResults[device.name.trim().toLowerCase()] && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
                          {stockCheckResults[device.name.trim().toLowerCase()].code ? (
                            stockCheckResults[device.name.trim().toLowerCase()].available > 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Stok Gudang: {stockCheckResults[device.name.trim().toLowerCase()].available} unit ({stockCheckResults[device.name.trim().toLowerCase()].code})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                Stok Habis di Gudang (0 unit)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              Belum terdaftar di Master Inventory
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={device.quantity || ''}
                        onChange={(e) => handleUpdateDevice(device.id, 'quantity', e.target.value)}
                        placeholder="Jumlah (1 Unit)"
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={device.serialNumber || ''}
                        onChange={(e) => handleUpdateDevice(device.id, 'serialNumber', e.target.value)}
                        placeholder="Serial Number (Opsional)"
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveDevice(device.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                    title="Hapus Perangkat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {validationErrors.devices && (
              <p className="text-[11px] text-red-500 mt-1">{validationErrors.devices}</p>
            )}

            {permitType === 'keluar' && (
              <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-950">
                <div className="flex items-start gap-2">
                  <Boxes className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-indigo-900 block">Integrasi Stok Gudang ACTIS:</span>
                    <span className="text-[11.5px] text-indigo-700">
                      Pembuatan surat permit tidak memotong stok fisik. Pengurangan stok dilakukan saat barang diserahkan ke teknisi melalui menu Barang Keluar.
                    </span>
                  </div>
                </div>
                <a
                  href="/inventory/transactions/out"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold inline-flex items-center gap-1 text-[11px] shrink-0 shadow-xs transition-colors self-end sm:self-auto"
                >
                  <span>Form Barang Keluar</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* SECTION 5: Kustomisasi Kalimat (Opsional) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setShowAdvancedText(!showAdvancedText)}
              className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Kustomisasi Kalimat Pembuka & Penutup (Opsional)</span>
              </span>
              <span className="text-blue-600 text-[11px] font-semibold">
                {showAdvancedText ? 'Tutup' : 'Buka Kustomisasi'}
              </span>
            </button>

            {showAdvancedText && (
              <div className="p-4 space-y-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kalimat Pembuka Kustom
                  </label>
                  <textarea
                    rows={3}
                    value={customOpening}
                    onChange={(e) => setCustomOpening(e.target.value)}
                    placeholder="Kosongkan jika menggunakan format default otomatis..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kalimat Penutup Kustom
                  </label>
                  <textarea
                    rows={3}
                    value={customClosing}
                    onChange={(e) => setCustomClosing(e.target.value)}
                    placeholder="Kosongkan jika menggunakan format default otomatis..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Sticky Bottom Action Bar (< xl) */}
          <div className="xl:hidden sticky bottom-0 -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 lg:-mx-6 lg:-mb-6 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg z-20 flex items-center justify-between gap-2 mt-6">
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Preview</span>
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95"
                title="Salin Format WhatsApp"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Surat</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Live A4 Preview & Action Bar */}
      <div
        className={`w-full xl:w-[52%] flex flex-col h-full min-h-0 bg-slate-100/70 overflow-hidden ${
          mobileTab === 'form' ? 'hidden xl:flex' : 'flex'
        }`}
      >
        {/* Top Floating Action Bar */}
        <div className="no-print p-2.5 sm:p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className="xl:hidden px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>

            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Live A4 Preview</span>
            </span>

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg ml-1 sm:ml-2">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(30, z - 10))}
                className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer hover:bg-slate-200/50 rounded-l-lg transition-colors"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 sm:px-2 text-slate-700 font-semibold">
                {previewZoom}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(130, z + 10))}
                className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer hover:bg-slate-200/50 rounded-r-lg transition-colors"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setPreviewZoom(
                  typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
                )
              }
              className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg cursor-pointer"
              title="Paskan ke Layar"
            >
              Fit
            </button>

            {/* Page Tabs for Permit multi-page */}
            {isPermitBarangMultiPage(currentDoc) && (
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 ml-1 sm:ml-2">
                <button
                  type="button"
                  onClick={() => setPreviewPageTab('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    previewPageTab === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPageTab(1)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    previewPageTab === 1
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hal 1
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPageTab(2)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    previewPageTab === 2
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hal 2
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Cetak Dokumen A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Ekspor Dokumen ke PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Salin Teks Format WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPlainText}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Salin Teks Biasa"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salin</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Simpan Perubahan' : 'Simpan Surat'}</span>
            </button>
          </div>
        </div>

        {/* Paper Container Scroll Area */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 flex items-start justify-center bg-slate-100/70">
          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="shadow-lg shadow-slate-300/60 rounded-sm shrink-0 mb-12"
          >
            <PermitBarangPaperDocument
              id="create-permit-barang-preview-doc"
              doc={currentDoc}
              template={permitBarangTemplate || template}
              previewPageFilter={previewPageTab}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
