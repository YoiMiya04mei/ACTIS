import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ZoomIn,
  ZoomOut,
  UserCheck,
  Image as ImageIcon,
  Upload,
  ArrowUp,
  ArrowDown,
  FileText,
  Sparkles,
  Eye,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import type {
  BeritaAcaraDocument,
  BeritaAcaraPersonnel,
  BeritaAcaraAttachment,
  BeritaAcaraTemplate,
} from '@/types/beritaAcara';
import { DEFAULT_BERITA_ACARA_OPENING_TEXT } from '@/types/beritaAcara';
import type { RFOTemplate } from '@/types/rfo';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { BeritaAcaraPaperDocument } from '@/components/tools/BeritaAcaraPaperDocument';
import {
  generateBeritaAcaraNumber,
  generateBeritaAcaraPlainText,
  generateBeritaAcaraWhatsAppText,
} from '@/utils/beritaAcaraUtils';
import { beritaAcaraStorage } from '@/services/beritaAcaraStorage';
import { toDateInputString } from '@/utils/dateFormatter';
import { compressDocumentationPhoto, compressBase64Image } from '@/utils/imageUtils';

interface CreateBeritaAcaraPageProps {
  template: RFOTemplate;
  beritaAcaraTemplate?: BeritaAcaraTemplate;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  initialEditData?: BeritaAcaraDocument | null;
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

const PURPOSE_SUGGESTIONS = [
  'Device Instalation',
  'Maintenance Switch & Router',
  'Penarikan Kabel Fiber Optic',
  'Perbaikan Link BGP Peering',
  'Instalasi Rack & Server',
  'Survey Lokasi Point of Presence (PoP)',
  'Troubleshooting Power & Kelistrikan',
];

export const CreateBeritaAcaraPage: React.FC<CreateBeritaAcaraPageProps> = ({
  template,
  beritaAcaraTemplate,
  addToast,
  initialEditData,
  onSaved,
  currentUser,
}) => {
  // Form State
  const [createdDate, setCreatedDate] = useState<string>(toDateInputString());
  const [letterLocation, setLetterLocation] = useState<string>(
    beritaAcaraTemplate?.letterLocation || 'Sukabumi'
  );
  const [sequenceNumber, setSequenceNumber] = useState<number>(121);
  const [isManualNumber, setIsManualNumber] = useState<boolean>(false);
  const [customLetterNumber, setCustomLetterNumber] = useState<string>('');

  const [startDate, setStartDate] = useState<string>(toDateInputString());
  const [endDate, setEndDate] = useState<string>(toDateInputString());
  const [visitLocation, setVisitLocation] = useState<string>('Data Center Neucentrix Karet');
  const [purpose, setPurpose] = useState<string>('Device Instalation');
  const [openingText, setOpeningText] = useState<string>(
    initialEditData?.openingText ||
    beritaAcaraTemplate?.defaultOpeningText ||
    DEFAULT_BERITA_ACARA_OPENING_TEXT
  );

  // Personnel List (Requirement #5: bisa diisi lebih dari satu)
  const [personnel, setPersonnel] = useState<BeritaAcaraPersonnel[]>([
    {
      id: 'p-1',
      name: currentUser?.name || 'Permadi Pratama',
    },
  ]);

  // Attachments List (Requirement #6: lampiran berupa image dan bisa lebih dari satu tersusun rapih)
  const [attachments, setAttachments] = useState<BeritaAcaraAttachment[]>([]);
  const [attachmentLabel, setAttachmentLabel] = useState<string>('Lampiran 1');
  const [imagesPerPage, setImagesPerPage] = useState<number>(2);
  const [isUploadingImages, setIsUploadingImages] = useState<boolean>(false);
  const [isDraggingImages, setIsDraggingImages] = useState<boolean>(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Signer
  const [signerName, setSignerName] = useState<string>(
    beritaAcaraTemplate?.signerName || 'Nandar Munandar'
  );
  const [signerPosition, setSignerPosition] = useState<string>(
    beritaAcaraTemplate?.signerPosition || 'Direktur'
  );

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // UI state
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
  );
  const [previewPageTab, setPreviewPageTab] = useState<'all' | number>('all');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 1. Calculate auto-generated official number based on sequenceNumber + createdDate
  // Format: BA/{seq}/{romanMonth}/{year}/JDP
  const autoLetterNumber = useMemo(() => {
    return generateBeritaAcaraNumber(sequenceNumber, createdDate);
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
      setPurpose(initialEditData.purpose || 'Device Instalation');
      setAttachmentLabel(initialEditData.attachmentLabel || 'Lampiran 1');
      setPersonnel(
        initialEditData.personnel && initialEditData.personnel.length > 0
          ? initialEditData.personnel
          : [{ id: 'p-1', name: 'Permadi Pratama' }]
      );
      setAttachments(initialEditData.attachments || []);
      setSignerName(initialEditData.signerName || 'Nandar Munandar');
      setSignerPosition(initialEditData.signerPosition || 'Direktur');
      setOpeningText(
        initialEditData.openingText ||
        beritaAcaraTemplate?.defaultOpeningText ||
        DEFAULT_BERITA_ACARA_OPENING_TEXT
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
    if (!initialEditData && beritaAcaraTemplate) {
      if (beritaAcaraTemplate.signerName) setSignerName(beritaAcaraTemplate.signerName);
      if (beritaAcaraTemplate.signerPosition) setSignerPosition(beritaAcaraTemplate.signerPosition);
      if (beritaAcaraTemplate.letterLocation) setLetterLocation(beritaAcaraTemplate.letterLocation);
      if (beritaAcaraTemplate.defaultOpeningText) setOpeningText(beritaAcaraTemplate.defaultOpeningText);
    }
  }, [beritaAcaraTemplate, initialEditData]);

  const loadNextSequence = async () => {
    try {
      const nextSeq = await beritaAcaraStorage.getNextSequenceNumber();
      setSequenceNumber(nextSeq);
    } catch (e) {
      console.warn('Failed to fetch next sequence for Berita Acara:', e);
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
      },
    ]);
  };

  const handleRemovePersonnel = (id: string) => {
    if (personnel.length <= 1) {
      addToast('error', 'Perhatian', 'Minimal harus ada 1 orang tim yang bertugas.');
      return;
    }
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePersonnel = (id: string, field: keyof BeritaAcaraPersonnel, value: string) => {
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
      },
    ]);
  };

  // Attachment Image Handlers
  const handleImagesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploadingImages(true);
    let successCount = 0;
    const newAttachments: BeritaAcaraAttachment[] = [];

    for (const file of fileArray) {
      try {
        const dataUrl = await compressDocumentationPhoto(file, 1024, 768, 0.75);
        newAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          imageUrl: dataUrl,
          fileName: file.name,
          caption: `Dokumentasi ${file.name.replace(/\.[^/.]+$/, '')}`,
        });
        successCount++;
      } catch (err) {
        console.error('Failed to process image:', file.name, err);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
      addToast(
        'success',
        'Foto Berhasil Ditambahkan',
        `${successCount} foto dokumentasi berhasil dimuat dan dioptimasi.`
      );
    }
    setIsUploadingImages(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateAttachmentCaption = (id: string, caption: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, caption } : a))
    );
  };

  const handleMoveAttachment = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= attachments.length) return;
    setAttachments((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Quick Date Presets (Exact match to Surat Tugas)
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

    if (!activeLetterNumber.trim()) {
      errors.letterNumber = 'Nomor Berita Acara tidak boleh kosong.';
    }
    if (!startDate) {
      errors.startDate = 'Tanggal mulai pelaksanaan wajib diisi.';
    }
    if (!endDate) {
      errors.endDate = 'Tanggal selesai pelaksanaan wajib diisi.';
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errors.endDate = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
    }
    if (!visitLocation.trim()) {
      errors.visitLocation = 'Lokasi visit wajib diisi.';
    }
    if (!purpose.trim()) {
      errors.purpose = 'Kepentingan kegiatan wajib diisi.';
    }

    const validPersonnel = personnel.filter((p) => p.name.trim().length > 0);
    if (validPersonnel.length === 0) {
      errors.personnel = 'Minimal harus ada 1 nama petugas yang bertugas.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Build current document object
  const currentDoc: BeritaAcaraDocument = useMemo(() => {
    const filteredPersonnel = personnel.filter((p) => p.name.trim().length > 0);
    return {
      id: editingId || `ba-${Date.now()}`,
      letterNumber: activeLetterNumber,
      sequenceNumber,
      createdDate,
      letterLocation,
      startDate,
      endDate,
      visitLocation,
      purpose,
      personnel: filteredPersonnel.length > 0 ? filteredPersonnel : personnel,
      attachments,
      attachmentLabel,
      signerName,
      signerPosition,
      signatureImageUrl: beritaAcaraTemplate?.signatureImageUrl,
      stampImageUrl: beritaAcaraTemplate?.stampImageUrl,
      companyName: beritaAcaraTemplate?.companyName,
      companyAddress: beritaAcaraTemplate?.companyAddress,
      companyPhone: beritaAcaraTemplate?.companyPhone,
      companyEmail: beritaAcaraTemplate?.companyEmail,
      companyWebsite: beritaAcaraTemplate?.companyWebsite,
      openingText: openingText.trim() ? openingText : undefined,
      closingText: beritaAcaraTemplate?.defaultClosingText,
      createdAt: initialEditData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser?.id,
      createdByName: currentUser?.name,
      createdByRole: currentUser?.role,
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
    purpose,
    openingText,
    personnel,
    attachments,
    attachmentLabel,
    signerName,
    signerPosition,
    beritaAcaraTemplate,
    initialEditData,
    currentUser,
  ]);

  // Actions
  const handleSave = async () => {
    if (!validateForm()) {
      addToast('error', 'Validasi Gagal', 'Mohon lengkapi seluruh field wajib yang ditandai merah.');
      return;
    }

    try {
      // Re-compress any attachment images if needed to keep them lightweight
      const optimizedAttachments = await Promise.all(
        currentDoc.attachments.map(async (att) => {
          if (att.imageUrl && att.imageUrl.length > 200_000) {
            const compressed = await compressBase64Image(att.imageUrl, 1024, 768, 0.75);
            return { ...att, imageUrl: compressed };
          }
          return att;
        })
      );
      const docToSave = { ...currentDoc, attachments: optimizedAttachments };

      await beritaAcaraStorage.saveBeritaAcara(docToSave);
      addToast(
        'success',
        editingId ? 'Berita Acara Diperbarui' : 'Berita Acara Berhasil Dibuat',
        `Nomor: ${activeLetterNumber} telah disimpan ke riwayat.`
      );

      if (!editingId) {
        // Automatically advance next sequence number for future letters
        setSequenceNumber((prev) => prev + 1);
      }
      if (onSaved) onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan Berita Acara.';
      addToast('error', 'Gagal Menyimpan', msg);
    }
  };



  const handleCopyWhatsApp = async () => {
    const text = generateBeritaAcaraWhatsAppText(currentDoc, beritaAcaraTemplate?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast(
        'success',
        'Teks WhatsApp Disalin',
        'Pesan Berita Acara siap dikirim via WhatsApp / Telegram.'
      );
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const handleCopyPlainText = async () => {
    const text = generateBeritaAcaraPlainText(currentDoc, beritaAcaraTemplate?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks Resmi Disalin', 'Format teks Berita Acara berhasil disalin.');
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  const handleResetForm = async () => {
    if (window.confirm('Reset formulir Berita Acara ke kondisi awal?')) {
      setEditingId(null);
      const nextSeq = await beritaAcaraStorage.getNextSequenceNumber();
      setSequenceNumber(nextSeq);
      setIsManualNumber(false);
      setCustomLetterNumber('');
      setCreatedDate(toDateInputString());
      setStartDate(toDateInputString());
      setEndDate(toDateInputString());
      setVisitLocation('Data Center Neucentrix Karet');
      setPurpose('Device Instalation');
      setAttachmentLabel('Lampiran 1');
      setAttachments([]);
      setPersonnel([
        {
          id: 'p-1',
          name: currentUser?.name || 'Permadi Pratama',
        },
      ]);
      setOpeningText(
        beritaAcaraTemplate?.defaultOpeningText || DEFAULT_BERITA_ACARA_OPENING_TEXT
      );
      setValidationErrors({});
      addToast('info', 'Form Direset', `Nomor surat kembali ke otomatis (${generateBeritaAcaraNumber(nextSeq, toDateInputString())}).`);
    }
  };

  // Calculate total pages for UI pill
  const totalPagesCount = 1 + (attachments.length > 0 ? Math.ceil(attachments.length / imagesPerPage) : 0);

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
                  Berita Acara Generator
                </span>
                {editingId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Mode Edit #{editingId}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {editingId ? 'Edit Berita Acara' : 'Buat Berita Acara Baru'}
              </h1>
              <p className="text-xs text-slate-500">
                Penerbitan Berita Acara resmi visit data center beserta lampiran dokumentasi foto
              </p>
            </div>

            <button
              onClick={handleResetForm}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
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
              <span className="text-[11px] text-slate-500">
                Format: <code className="text-blue-700 font-mono font-medium">BA/[No]/[Bulan]/[Tahun]/JDP</code>
              </span>
            </div>

            {/* Generated Official Number Display */}
            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                  Nomor Berita Acara Aktif:
                </span>
                <p className="text-lg font-black font-mono text-blue-900 tracking-wide mt-0.5">
                  {activeLetterNumber}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  ✓ Prefix <code className="text-slate-700 font-mono">/BA</code> • Nomor urut <code className="text-blue-700 font-mono font-semibold">/{sequenceNumber}</code> • Bulan & Tahun otomatis dari tanggal surat • Suffix <code className="text-slate-700 font-mono">/JDP</code>
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
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors cursor-pointer"
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
                  placeholder="BA/121/X/2026/JDP"
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
                      className="shrink-0 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 rounded-lg text-xs shadow-xs cursor-pointer"
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

          {/* SECTION 2: Tanggal Pelaksanaan */}
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
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs ${
                    validationErrors.startDate ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {validationErrors.startDate && (
                  <p className="text-[10px] text-rose-500 mt-1">{validationErrors.startDate}</p>
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
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs ${
                    validationErrors.endDate ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {validationErrors.endDate && (
                  <p className="text-[10px] text-rose-500 mt-1">{validationErrors.endDate}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEndDate(startDate)}
                className="text-[11px] text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
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
                className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs ${
                  validationErrors.visitLocation ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              <datalist id="visit-location-list">
                {VISIT_LOCATION_SUGGESTIONS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>

              {validationErrors.visitLocation && (
                <p className="text-[10px] text-rose-500 mt-1">{validationErrors.visitLocation}</p>
              )}
            </div>

            {/* Quick Location Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VISIT_LOCATION_SUGGESTIONS.slice(0, 4).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setVisitLocation(loc)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border cursor-pointer font-medium ${
                    visitLocation === loc
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
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
                    beritaAcaraTemplate?.defaultOpeningText || DEFAULT_BERITA_ACARA_OPENING_TEXT
                  )
                }
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                Reset ke Standar Template
              </button>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 mb-1.5">
                Sesuaikan kata-kata pada paragraf pertama berita acara ini. Gunakan tag dinamis:
              </p>
              <textarea
                rows={3}
                value={openingText}
                onChange={(e) => setOpeningText(e.target.value)}
                placeholder="Tulis redaksi kalimat pembuka berita acara..."
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
                <button
                  type="button"
                  onClick={() => setOpeningText((prev) => (prev.trimEnd() + ' {kepentingan} ').trimStart())}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{kepentingan}'}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 5: Nama Tim Yang Bertugas */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> 5. Nama Petugas
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
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 font-medium border border-slate-200 flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
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
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 relative group space-y-2"
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
                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
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
                        value={person.phone || ''}
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
              <p className="text-[11px] text-rose-500">{validationErrors.personnel}</p>
            )}
          </div>

          {/* SECTION 5: Kepentingan & Keterangan Lampiran */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> 5. Kepentingan & Keterangan Lampiran
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kepentingan / Perihal Kegiatan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="purpose-suggestions-list"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Contoh: Device Instalation"
                className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs ${
                  validationErrors.purpose ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              <datalist id="purpose-suggestions-list">
                {PURPOSE_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {validationErrors.purpose && (
                <p className="text-[10px] text-rose-500 mt-1">{validationErrors.purpose}</p>
              )}
            </div>

            {/* Quick Purpose Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PURPOSE_SUGGESTIONS.slice(0, 4).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border cursor-pointer font-medium ${
                    purpose === p
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keterangan Lampiran
              </label>
              <input
                type="text"
                value={attachmentLabel}
                onChange={(e) => setAttachmentLabel(e.target.value)}
                placeholder="Lampiran 1"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
              />
            </div>
          </div>

          {/* SECTION 6: Lampiran Foto Dokumentasi */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-600" /> 6. Lampiran Foto Dokumentasi
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {attachments.length} foto terlampir • Tersusun rapi pada halaman Lampiran
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-medium">Grid:</span>
                <select
                  value={imagesPerPage}
                  onChange={(e) => setImagesPerPage(parseInt(e.target.value, 10))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                >
                  <option value={1}>1 Foto / Halaman (Besar)</option>
                  <option value={2}>2 Foto / Halaman (Standar Rapi)</option>
                  <option value={4}>4 Foto / Halaman (Grid 2x2)</option>
                </select>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingImages(true);
              }}
              onDragLeave={() => setIsDraggingImages(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingImages(false);
                if (e.dataTransfer.files) handleImagesUpload(e.dataTransfer.files);
              }}
              onClick={() => imageInputRef.current?.click()}
              className={`p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDraggingImages
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => e.target.files && handleImagesUpload(e.target.files)}
              />

              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2 shadow-xs">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {isUploadingImages ? 'Memproses Foto...' : 'Klik atau Tarik Foto ke Sini'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Mendukung banyak foto sekaligus (PNG, JPG, WEBP). Gambar dioptimasi otomatis.
              </p>
            </div>

            {/* List of Attachments with Thumbnail, Caption & Reordering */}
            {attachments.length > 0 && (
              <div className="space-y-2.5 mt-3">
                {attachments.map((att, idx) => (
                  <div
                    key={att.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 shadow-xs"
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center">
                      <img
                        src={att.imageUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Caption Input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={att.caption || ''}
                        onChange={(e) => handleUpdateAttachmentCaption(att.id, e.target.value)}
                        placeholder="Keterangan foto (contoh: Pemasangan Switch Rack 12)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Foto #{idx + 1} • {att.fileName || 'Dokumentasi'}
                      </span>
                    </div>

                    {/* Move Up / Down & Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveAttachment(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Geser ke atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveAttachment(idx, 'down')}
                        disabled={idx === attachments.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Geser ke bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
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
                <span>Preview ({totalPagesCount} Hal)</span>
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
                  <span>Simpan Berita Acara</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* RIGHT COLUMN: Interactive Live A4 Preview & Action Bar */}
      <div className={`w-full xl:w-[52%] flex flex-col h-full min-h-0 bg-slate-100/70 overflow-hidden ${mobileTab === 'form' ? 'hidden xl:flex' : 'flex'}`}>
        {/* Top Floating Action Bar */}
        <div className="no-print p-2.5 sm:p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className="xl:hidden px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>

            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
              <Eye className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Live A4 Preview</span>
            </span>

            {/* Page Tabs for Berita Acara multi-page */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 ml-1 sm:ml-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setPreviewPageTab('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                  previewPageTab === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3 h-3 inline mr-1" />
                Semua ({totalPagesCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewPageTab(1)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                  previewPageTab === 1
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hal 1
              </button>
              {attachments.length > 0 &&
                Array.from({ length: Math.ceil(attachments.length / imagesPerPage) }).map((_, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setPreviewPageTab(pIdx + 2)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                      previewPageTab === pIdx + 2
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lampiran {pIdx + 1}
                  </button>
                ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg ml-1 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(30, z - 10))}
                className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer"
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
                className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPreviewZoom(typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90)}
              className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg cursor-pointer shrink-0"
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
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Salin Teks Format WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPlainText}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Salin Teks Biasa"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salin</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Simpan Perubahan' : 'Simpan Berita Acara'}</span>
            </button>
          </div>
        </div>

        {/* Paper View Container */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 lg:p-8 flex justify-center bg-slate-100/70">
          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="shrink-0 mb-12 shadow-lg shadow-slate-300/60 rounded-sm"
          >
            <BeritaAcaraPaperDocument
              id="berita-acara-paper-doc"
              doc={currentDoc}
              template={beritaAcaraTemplate || template}
              imagesPerPage={imagesPerPage}
              previewPageFilter={previewPageTab}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
