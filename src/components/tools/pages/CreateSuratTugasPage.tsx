import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Copy,
  MessageSquare,
  Calendar,
  MapPin,
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
} from 'lucide-react';
import type {
  SuratTugasDocument,
  SuratTugasPersonnel,
  SuratTugasTemplate,
} from '@/types/suratTugas';
import { DEFAULT_SURAT_TUGAS_OPENING_TEXT } from '@/types/suratTugas';
import type { RFOTemplate } from '@/types/rfo';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { SuratTugasPaperDocument } from '@/components/tools/SuratTugasPaperDocument';
import {
  generateSuratTugasNumber,
  generateSuratTugasPlainText,
  generateSuratTugasWhatsAppText,
} from '@/utils/suratTugasUtils';
import { suratTugasStorage } from '@/services/suratTugasStorage';
import { toDateInputString } from '@/utils/dateFormatter';
import { useDialog } from '@/context/DialogContext';

interface CreateSuratTugasPageProps {
  template: RFOTemplate;
  suratTugasTemplate?: SuratTugasTemplate;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  initialEditData?: SuratTugasDocument | null;
  onSaved?: () => void;
  currentUser?: UserAccount | null;
}

const VISIT_LOCATION_SUGGESTIONS = [
  'Data Center Neucentrix Karet',
  'Data Center Cyber 1 Kuningan',
  'Data Center IDC 3D Duren Tiga',
  'Data Center Telkom STO Gambir',
  'Data Center NTT Cibitung',
  'PoP Distribusi Sukabumi Kota',
  'PoP Distribusi Ciawi',
];

export const CreateSuratTugasPage: React.FC<CreateSuratTugasPageProps> = ({
  template,
  suratTugasTemplate,
  addToast,
  initialEditData,
  onSaved,
  currentUser,
}) => {
  const { confirm: confirmDialog } = useDialog();
  // Form State
  const [createdDate, setCreatedDate] = useState<string>(toDateInputString());
  const [letterLocation, setLetterLocation] = useState<string>(
    suratTugasTemplate?.letterLocation || 'Sukabumi'
  );
  const [sequenceNumber, setSequenceNumber] = useState<number>(121);
  const [isManualNumber, setIsManualNumber] = useState<boolean>(false);
  const [customLetterNumber, setCustomLetterNumber] = useState<string>('');

  const [startDate, setStartDate] = useState<string>(toDateInputString());
  const [endDate, setEndDate] = useState<string>(toDateInputString());
  const [visitLocation, setVisitLocation] = useState<string>('Data Center Neucentrix Karet');
  const [openingText, setOpeningText] = useState<string>(
    initialEditData?.openingText ||
    suratTugasTemplate?.defaultOpeningText ||
    DEFAULT_SURAT_TUGAS_OPENING_TEXT
  );

  // Personnel List (Requirement #4: bisa diisi lebih dari satu)
  const [personnel, setPersonnel] = useState<SuratTugasPersonnel[]>([
    {
      id: 'p-1',
      name: currentUser?.name || 'Permadi Pratama',
      phone: '+62 813-8426-4064',
      position: currentUser?.position || 'Technical Support',
    },
  ]);

  // Signer
  const [signerName, setSignerName] = useState<string>(
    suratTugasTemplate?.signerName || 'Nandar Munandar'
  );
  const [signerPosition, setSignerPosition] = useState<string>(
    suratTugasTemplate?.signerPosition || 'Direktur'
  );

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // UI state
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 1. Calculate auto-generated official number based on sequenceNumber + createdDate
  // Format: ST/{seq}/{romanMonth}/{year}/JDP
  const autoLetterNumber = useMemo(() => {
    return generateSuratTugasNumber(sequenceNumber, createdDate);
  }, [sequenceNumber, createdDate]);

  const activeLetterNumber = isManualNumber ? customLetterNumber : autoLetterNumber;

  // Initialize or load next sequence number
  useEffect(() => {
    if (initialEditData) {
      setEditingId(initialEditData.id);
      setSequenceNumber(initialEditData.sequenceNumber || 121);
      setCreatedDate(initialEditData.createdDate || toDateInputString());
      setLetterLocation(initialEditData.letterLocation || 'Sukabumi');
      setStartDate(initialEditData.startDate);
      setEndDate(initialEditData.endDate);
      setVisitLocation(initialEditData.visitLocation);
      setPersonnel(
        initialEditData.personnel && initialEditData.personnel.length > 0
          ? initialEditData.personnel
          : [{ id: 'p-1', name: 'Permadi Pratama', phone: '+62 813-8426-4064' }]
      );
      setSignerName(initialEditData.signerName || 'Nandar Munandar');
      setSignerPosition(initialEditData.signerPosition || 'Direktur');
      setOpeningText(
        initialEditData.openingText ||
        suratTugasTemplate?.defaultOpeningText ||
        DEFAULT_SURAT_TUGAS_OPENING_TEXT
      );

      if (initialEditData.letterNumber) {
        setIsManualNumber(true);
        setCustomLetterNumber(initialEditData.letterNumber);
      }
    } else {
      loadNextSequence();
    }
  }, [initialEditData]);

  // Sync signer, location & openingText from template whenever template updates (for new documents)
  useEffect(() => {
    if (!initialEditData && suratTugasTemplate) {
      if (suratTugasTemplate.signerName) setSignerName(suratTugasTemplate.signerName);
      if (suratTugasTemplate.signerPosition) setSignerPosition(suratTugasTemplate.signerPosition);
      if (suratTugasTemplate.letterLocation) setLetterLocation(suratTugasTemplate.letterLocation);
      if (suratTugasTemplate.defaultOpeningText) setOpeningText(suratTugasTemplate.defaultOpeningText);
    }
  }, [suratTugasTemplate, initialEditData]);

  const loadNextSequence = async () => {
    try {
      const nextSeq = await suratTugasStorage.getNextSequenceNumber();
      setSequenceNumber(nextSeq);
    } catch (e) {
      console.warn('Failed to fetch next sequence:', e);
    }
  };

  // Personnel handlers
  const handleAddPersonnel = () => {
    const newId = `p-${Date.now()}`;
    setPersonnel((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        phone: '+62 ',
        position: 'Staff Teknis',
      },
    ]);
  };

  const handleRemovePersonnel = (id: string) => {
    if (personnel.length <= 1) {
      addToast('error', 'Perhatian', 'Minimal harus ada 1 orang personil yang ditugaskan.');
      return;
    }
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePersonnel = (id: string, field: keyof SuratTugasPersonnel, value: string) => {
    setPersonnel((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleAddCurrentUser = () => {
    if (!currentUser) return;
    const exists = personnel.some((p) => p.name.toLowerCase() === currentUser.name.toLowerCase());
    if (exists) {
      addToast('info', 'Sudah Ada', 'Nama Anda sudah ada di dalam daftar personil.');
      return;
    }
    setPersonnel((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        name: currentUser.name,
        phone: '+62 ',
        position: currentUser.position,
      },
    ]);
  };

  // Quick Date Presets
  const handleDatePreset = (daysOffset: number) => {
    const today = new Date();
    const target = new Date();
    target.setDate(today.getDate() + daysOffset);

    const sStr = toDateInputString(today);
    const eStr = toDateInputString(target);
    setStartDate(sStr);
    setEndDate(eStr);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!startDate) errors.startDate = 'Tanggal mulai wajib diisi.';
    if (!endDate) errors.endDate = 'Tanggal selesai wajib diisi.';
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errors.endDate = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
    }

    if (!visitLocation.trim()) {
      errors.visitLocation = 'Lokasi visit wajib diisi.';
    }

    const invalidPersonnel = personnel.some((p) => !p.name.trim());
    if (invalidPersonnel) {
      errors.personnel = 'Semua nama petugas harus diisi.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Current document object for preview & export
  const currentDoc: SuratTugasDocument = useMemo(() => {
    return {
      id: editingId || `ST-${Date.now()}`,
      letterNumber: activeLetterNumber,
      sequenceNumber,
      createdDate,
      letterLocation,
      startDate,
      endDate,
      visitLocation,
      openingText: openingText.trim() ? openingText : undefined,
      closingText: suratTugasTemplate?.defaultClosingText,
      personnel: personnel.filter((p) => p.name.trim().length > 0),
      signerName,
      signerPosition,
      companyName: template?.companyName || 'PT JEMBATAN DATA PANGRANGO',
      companyAddress:
        'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
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
    activeLetterNumber,
    sequenceNumber,
    createdDate,
    letterLocation,
    startDate,
    endDate,
    visitLocation,
    openingText,
    suratTugasTemplate?.defaultClosingText,
    personnel,
    signerName,
    signerPosition,
    template,
    initialEditData,
    currentUser,
  ]);

  // Actions
  const handleSave = async () => {
    if (!validateForm()) {
      addToast('error', 'Formulir Belum Lengkap', 'Silakan lengkapi data yang ditandai merah.');
      return;
    }

    try {
      await suratTugasStorage.saveSuratTugas(currentDoc);
      addToast(
        'success',
        editingId ? 'Surat Tugas Diperbarui' : 'Surat Tugas Berhasil Dibuat',
        `Nomor: ${activeLetterNumber} telah disimpan ke riwayat.`
      );

      if (!editingId) {
        // Automatically advance next sequence number for future letters
        setSequenceNumber((prev) => prev + 1);
      }

      if (onSaved) {
        onSaved();
      }
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan sistem saat menyimpan dokumen.');
    }
  };


  const handleCopyWhatsApp = async () => {
    const text = generateSuratTugasWhatsAppText(currentDoc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast(
        'success',
        'Teks WhatsApp Disalin',
        'Pesan penugasan siap dikirim via WhatsApp / Telegram.'
      );
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const handleCopyPlainText = async () => {
    const text = generateSuratTugasPlainText(currentDoc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks Resmi Disalin', 'Format teks surat tugas berhasil disalin.');
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const handleResetForm = async () => {
    if (await confirmDialog('Reset formulir surat tugas ke kondisi awal?')) {
      setEditingId(null);
      const nextSeq = await suratTugasStorage.getNextSequenceNumber();
      setSequenceNumber(nextSeq);
      setIsManualNumber(false);
      setCustomLetterNumber('');
      setCreatedDate(toDateInputString());
      setStartDate(toDateInputString());
      setEndDate(toDateInputString());
      setVisitLocation('Data Center Neucentrix Karet');
      setPersonnel([
        {
          id: 'p-1',
          name: currentUser?.name || 'Permadi Pratama',
          phone: '+62 813-8426-4064',
          position: currentUser?.position || 'Technical Support',
        },
      ]);
      setSignerName(suratTugasTemplate?.signerName || 'Nandar Munandar');
      setSignerPosition(suratTugasTemplate?.signerPosition || 'Direktur');
      setLetterLocation(suratTugasTemplate?.letterLocation || 'Sukabumi');
      setOpeningText(suratTugasTemplate?.defaultOpeningText || DEFAULT_SURAT_TUGAS_OPENING_TEXT);
      setValidationErrors({});
      addToast('info', 'Form Direset', `Nomor surat kembali ke otomatis (${generateSuratTugasNumber(nextSeq, toDateInputString())}).`);
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
      <div className={`w-full xl:w-[48%] flex flex-col border-r border-slate-200 bg-white p-3 sm:p-4 lg:p-6 overflow-y-auto ${mobileTab === 'preview' ? 'hidden xl:flex' : 'flex'}`}>
        <div className="space-y-6 max-w-2xl mx-auto w-full">
          {/* Header Title with quick badge */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Surat Tugas Generator
                </span>
                {editingId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Mode Edit #{editingId}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {editingId ? 'Edit Surat Tugas' : 'Buat Surat Tugas Baru'}
              </h1>
              <p className="text-xs text-slate-500">
                Penerbitan surat tugas resmi visit data center atau lokasi teknis
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

          {/* SECTION 1: Nomor Surat & Tanggal Pembuatan */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 1. Nomor & Tanggal Surat
              </span>
              <span className="text-[11px] text-slate-400">
                Format: <code className="text-blue-700 font-mono">ST/[No]/[Bulan]/[Tahun]/JDP</code>
              </span>
            </div>

            {/* Generated Official Number Display */}
            <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                  Nomor Surat Tugas Aktif:
                </span>
                <p className="text-lg font-black font-mono text-slate-900 tracking-wide mt-0.5">
                  {activeLetterNumber}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  ✓ Prefix <code className="text-slate-700 font-mono">/ST</code> • Nomor urut <code className="text-blue-700 font-mono font-bold">/{sequenceNumber}</code> • Bulan & Tahun otomatis dari tanggal surat • Suffix <code className="text-slate-700 font-mono">/JDP</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isManualNumber) {
                      setIsManualNumber(false);
                    } else {
                      setIsManualNumber(true);
                      setCustomLetterNumber(autoLetterNumber);
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-xs cursor-pointer"
                >
                  {isManualNumber ? 'Gunakan Otomatis' : 'Edit Manual'}
                </button>
              </div>
            </div>

            {/* If Manual Edit mode active */}
            {isManualNumber ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Surat Kustom
                </label>
                <input
                  type="text"
                  value={customLetterNumber}
                  onChange={(e) => setCustomLetterNumber(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                  placeholder="ST/120/IX/2026/JDP"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Angka Nomor Urut (/120, /121, ...)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={sequenceNumber}
                      onChange={(e) => setSequenceNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={loadNextSequence}
                      className="shrink-0 px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium shadow-xs cursor-pointer"
                      title="Hitung Ulang Nomor Selanjutnya"
                    >
                      Auto
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Otomatis bertambah 1 setiap kali membuat surat baru.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pembuatan Surat
                  </label>
                  <input
                    type="date"
                    value={createdDate}
                    onChange={(e) => setCreatedDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Bulan Romawi & Tahun nomor surat mengikuti tanggal ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Tanggal Pelaksanaan (Start sd End) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> 2. Tanggal Pelaksanaan
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleDatePreset(0)}
                  className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset(1)}
                  className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Besok
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset(2)}
                  className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-colors shadow-xs cursor-pointer"
                >
                  3 Hari
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || new Date(endDate) < new Date(e.target.value)) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 shadow-xs ${
                    validationErrors.startDate
                      ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
                {validationErrors.startDate && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.startDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 shadow-xs ${
                    validationErrors.endDate
                      ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
                {validationErrors.endDate && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.endDate}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEndDate(startDate)}
                className="text-[11px] text-blue-600 hover:text-blue-700 underline font-medium cursor-pointer"
              >
                Samakan tanggal selesai dengan tanggal mulai (1 hari)
              </button>
            </div>
          </div>

          {/* SECTION 3: Lokasi Visit */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> 3. Lokasi Visit
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lokasi / Data Center / Gedung <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="visit-location-list"
                value={visitLocation}
                onChange={(e) => setVisitLocation(e.target.value)}
                placeholder="Contoh: Data Center Neucentrix Karet"
                className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 shadow-xs ${
                  validationErrors.visitLocation
                    ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                }`}
              />
              <datalist id="visit-location-list">
                {VISIT_LOCATION_SUGGESTIONS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>

              {validationErrors.visitLocation && (
                <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.visitLocation}</p>
              )}
            </div>

            {/* Quick Location Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VISIT_LOCATION_SUGGESTIONS.slice(0, 4).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setVisitLocation(loc)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border shadow-xs cursor-pointer ${
                    visitLocation === loc
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 4: Redaksi Paragraf Pembuka */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> 4. Redaksi Paragraf Pembuka
              </span>
              <button
                type="button"
                onClick={() =>
                  setOpeningText(
                    suratTugasTemplate?.defaultOpeningText || DEFAULT_SURAT_TUGAS_OPENING_TEXT
                  )
                }
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                Reset ke Standar Template
              </button>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">
                Sesuaikan kata-kata pada paragraf pertama surat tugas ini. Gunakan tag dinamis:
              </p>
              <textarea
                rows={3}
                value={openingText}
                onChange={(e) => setOpeningText(e.target.value)}
                placeholder="Tulis redaksi kalimat pembuka surat tugas..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-500">Sisipkan tag:</span>
                <button
                  type="button"
                  onClick={() => setOpeningText((prev) => (prev.trimEnd() + ' {tanggal} ').trimStart())}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{tanggal}'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpeningText((prev) => (prev.trimEnd() + ' {lokasi} ').trimStart())}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{lokasi}'}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Nama dan No Telp (Multi-personnel support) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> 5. Nama dan No Telp Petugas
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dapat diisi lebih dari satu orang personil yang berangkat
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {currentUser && (
                  <button
                    type="button"
                    onClick={handleAddCurrentUser}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 border border-slate-300 flex items-center gap-1 transition-colors shadow-xs font-medium cursor-pointer"
                    title="Tambah Nama Akun Anda Sendiri"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ Saya</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddPersonnel}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Petugas</span>
                </button>
              </div>
            </div>

            {/* List of Personnel Inputs */}
            <div className="space-y-3">
              {personnel.map((person, index) => (
                <div
                  key={person.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 relative group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-mono font-bold">
                        {index + 1}
                      </span>
                      Petugas {index + 1}
                    </span>

                    {personnel.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePersonnel(person.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Hapus Personil Ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => handleUpdatePersonnel(person.id, 'name', e.target.value)}
                        placeholder="Contoh: Permadi Pratama"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        No. Telepon / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={person.phone}
                        onChange={(e) => handleUpdatePersonnel(person.id, 'phone', e.target.value)}
                        placeholder="Contoh: +62 813-8426-4064"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {validationErrors.personnel && (
              <p className="text-[11px] text-rose-500 font-medium">{validationErrors.personnel}</p>
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
      <div className={`w-full xl:w-[52%] flex flex-col h-full min-h-0 bg-slate-100/70 overflow-hidden ${mobileTab === 'form' ? 'hidden xl:flex' : 'flex'}`}>
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
              onClick={() => setPreviewZoom(typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90)}
              className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg cursor-pointer"
              title="Paskan ke Layar"
            >
              Fit
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
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
              <span>Simpan Surat</span>
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
            <SuratTugasPaperDocument
              doc={currentDoc}
              template={suratTugasTemplate || template}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
