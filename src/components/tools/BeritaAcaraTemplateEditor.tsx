import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RotateCcw,
  Building,
  Upload,
  Trash2,
  Stamp,
  PenTool,
  CheckCircle2,
  Eye,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Sliders,
  ArrowUp,
  ArrowDown,
  Lock,
  ShieldAlert,
  UserCheck,
  FileText,
} from 'lucide-react';
import type { BeritaAcaraTemplate } from '@/types/beritaAcara';
import { DEFAULT_BERITA_ACARA_OPENING_TEXT } from '@/types/beritaAcara';
import type { UserAccount } from '@/types/auth';
import { BeritaAcaraPaperDocument } from './BeritaAcaraPaperDocument';
import { beritaAcaraStorage } from '@/services/beritaAcaraStorage';
import { processImageFile } from '@/utils/imageUtils';
import { extractFromPdf } from '@/utils/pdfUtils';
import { extractFromDocx } from '@/utils/docxUtils';
import type { ToastMessage } from './Toast';
import { useDialog } from '@/context/DialogContext';

interface BeritaAcaraTemplateEditorProps {
  template: BeritaAcaraTemplate;
  onUpdateTemplate: (newTemplate: BeritaAcaraTemplate) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
}

export const BeritaAcaraTemplateEditor: React.FC<BeritaAcaraTemplateEditorProps> = ({
  template,
  onUpdateTemplate,
  addToast,
  currentUser,
}) => {
  const { confirm: confirmDialog } = useDialog();
  const isAdmin = !currentUser || currentUser.role === 'admin' || (currentUser as any).role === 'noc_engineer';
  const [formData, setFormData] = useState<BeritaAcaraTemplate>(() => {
    const initial = { ...template };
    if (initial.companyName) {
      initial.companyName = initial.companyName.replace(/\s+Jl\.?$/i, '').trim();
    }
    // If background kop exists but spacer is at default low value, set to 38mm
    if (initial.letterheadBackgroundUrl && (!initial.headerSpacerHeight || initial.headerSpacerHeight <= 10)) {
      initial.headerSpacerHeight = 38;
    }
    return initial;
  });

  useEffect(() => {
    if (template) {
      const updated = { ...template };
      if (updated.companyName) {
        updated.companyName = updated.companyName.replace(/\s+Jl\.?$/i, '').trim();
      }
      if (updated.letterheadBackgroundUrl && (!updated.headerSpacerHeight || updated.headerSpacerHeight <= 10)) {
        updated.headerSpacerHeight = 38;
      }
      setFormData(updated);
    }
  }, [template]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingSig, setIsUploadingSig] = useState<boolean>(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState<boolean>(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState<boolean>(false);
  const [isDraggingSig, setIsDraggingSig] = useState<boolean>(false);
  const [isDraggingStamp, setIsDraggingStamp] = useState<boolean>(false);
  const [isDraggingHeader, setIsDraggingHeader] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 80
  );

  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const currentSpacerHeight =
    typeof formData.headerSpacerHeight === 'number'
      ? formData.headerSpacerHeight
      : formData.letterheadBackgroundUrl
      ? 38
      : 6;

  const handleMoveTextUp = () => {
    setFormData((prev) => ({
      ...prev,
      headerSpacerHeight: Math.max(0, currentSpacerHeight - 2),
    }));
  };

  const handleMoveTextDown = () => {
    setFormData((prev) => ({
      ...prev,
      headerSpacerHeight: Math.min(100, currentSpacerHeight + 2),
    }));
  };

  // Sample data for preview
  const sampleBeritaAcara = {
    id: 'sample-ba-preview',
    letterNumber: 'BA/121/X/2026/JDP',
    sequenceNumber: 121,
    createdDate: '2026-10-05',
    letterLocation: formData.letterLocation || 'Sukabumi',
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    visitLocation: 'Data Center Neucentrix Karet',
    purpose: 'Device Instalation',
    personnel: [
      { id: 'p-1', name: 'Permadi Pratama' },
    ],
    attachmentLabel: 'Lampiran 1',
    attachments: [],
    signerName: formData.signerName || 'Nandar Munandar',
    signerPosition: formData.signerPosition || 'Direktur',
    companyName: (formData.companyName || 'PT JEMBATAN DATA PANGRANGO').replace(/\s+Jl\.?$/i, '').trim(),
    companyAddress: formData.companyAddress || 'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
    companyPhone: formData.companyPhone || '+62 857-9870-8612',
    companyEmail: formData.companyEmail || 'admin@jembatandata.com',
    companyWebsite: formData.companyWebsite || 'Sukabuminetwork.net',
    openingText: formData.defaultOpeningText,
    closingText: formData.defaultClosingText,
    createdAt: '2026-10-05T08:00:00.000Z',
    updatedAt: '2026-10-05T08:00:00.000Z',
  };

  const handleSave = async () => {
    if (!isAdmin) {
      addToast('error', 'Akses Ditolak', 'Hanya akun Super Admin yang diizinkan mengubah dan menyimpan template.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await beritaAcaraStorage.saveTemplate(formData);
      onUpdateTemplate(saved);
      addToast(
        'success',
        'Template Berita Acara Disimpan',
        'Kop surat, penandatangan, tanda tangan, dan cap perusahaan untuk Berita Acara berhasil diperbarui.'
      );
    } catch {
      addToast('error', 'Gagal', 'Terjadi kesalahan saat menyimpan template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) {
      addToast('error', 'Akses Ditolak', 'Hanya akun Super Admin yang diizinkan mereset template.');
      return;
    }

    if (
      await confirmDialog(
        'Kembalikan template Berita Acara ke konfigurasi standar PT Jembatan Data Pangrango?'
      )
    ) {
      const reset = await beritaAcaraStorage.resetTemplate();
      setFormData(reset);
      onUpdateTemplate(reset);
      addToast('info', 'Template Direset', 'Konfigurasi template Berita Acara kembali ke default.');
    }
  };

  const handleSignatureUpload = async (file: File) => {
    if (!isAdmin) return;
    setIsUploadingSig(true);
    try {
      const dataUrl = await processImageFile(file, 600, 300);
      setFormData((prev) => ({ ...prev, signatureImageUrl: dataUrl }));
      addToast('success', 'Tanda Tangan Diunggah', 'Tanda tangan resmi siap digunakan pada Berita Acara.');
    } catch {
      addToast('error', 'Gagal Upload', 'Gagal memproses file tanda tangan.');
    } finally {
      setIsUploadingSig(false);
    }
  };

  const handleRemoveSignature = () => {
    setFormData((prev) => ({ ...prev, signatureImageUrl: '' }));
    addToast('info', 'TTD Direset', 'Tanda tangan dikembalikan ke format vektor standar.');
  };

  const handleStampUpload = async (file: File) => {
    if (!isAdmin) return;
    setIsUploadingStamp(true);
    try {
      const dataUrl = await processImageFile(file, 500, 300);
      setFormData((prev) => ({ ...prev, stampImageUrl: dataUrl }));
      addToast('success', 'Cap Perusahaan Diunggah', 'Cap stempel resmi siap digunakan pada Berita Acara.');
    } catch {
      addToast('error', 'Gagal Upload', 'Gagal memproses file cap stempel.');
    } finally {
      setIsUploadingStamp(false);
    }
  };

  const handleRemoveStamp = () => {
    setFormData((prev) => ({ ...prev, stampImageUrl: '' }));
    addToast('info', 'Cap Direset', 'Cap stempel dikembalikan ke format standar JDP.');
  };

  const handleHeaderFileUpload = async (file: File) => {
    if (!isAdmin) return;
    setIsUploadingHeader(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const res = await extractFromPdf(file);
        setFormData((prev) => ({
          ...prev,
          headerImageUrl: res.headerImageUrl || '',
          letterheadBackgroundUrl: res.backgroundUrl,
          headerSpacerHeight: (!prev.headerSpacerHeight || prev.headerSpacerHeight <= 10) ? 38 : prev.headerSpacerHeight,
          ...(res.extractedInfo?.companyName && { companyName: res.extractedInfo.companyName }),
          ...(res.extractedInfo?.companyAddress && { companyAddress: res.extractedInfo.companyAddress }),
        }));
        addToast('success', 'PDF Diproses', 'Kop surat berhasil diekstrak dari PDF.');
      } else if (ext === 'docx') {
        const res = await extractFromDocx(file);
        if (res.headerImageUrl) {
          setFormData((prev) => ({
            ...prev,
            headerImageUrl: res.headerImageUrl || '',
            letterheadBackgroundUrl: '',
            headerSpacerHeight: prev.headerSpacerHeight || 6,
            ...(res.extractedInfo?.companyName && { companyName: res.extractedInfo.companyName }),
          }));
          addToast('success', 'Word Dokumen Diproses', 'Kop surat berhasil diekstrak.');
        } else {
          addToast('info', 'Informasi Diekstrak', 'Data teks kop surat berhasil diperbarui.');
        }
      } else {
        const dataUrl = await processImageFile(file, 1600, 600);
        setFormData((prev) => ({
          ...prev,
          headerImageUrl: dataUrl,
          letterheadBackgroundUrl: '',
          headerSpacerHeight: prev.headerSpacerHeight || 6,
        }));
        addToast('success', 'Kop Surat Diunggah', 'Gambar banner kop surat berhasil dipasang.');
      }
    } catch {
      addToast('error', 'Gagal Upload', 'Gagal memproses file kop surat.');
    } finally {
      setIsUploadingHeader(false);
    }
  };

  const handleRemoveHeaderImage = () => {
    setFormData((prev) => ({
      ...prev,
      headerImageUrl: '',
      letterheadBackgroundUrl: '',
      headerSpacerHeight: 6,
    }));
    addToast('info', 'Kop Direset', 'Kop surat dikembalikan ke format standar JDP.');
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-slate-50">
      {/* Top Banner (Identical layout to Surat Tugas) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            Manajemen Template Berita Acara Perusahaan
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi kop surat, penandatangan, tanda tangan, cap stempel, dan format berita acara resmi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isAdmin}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
              !isAdmin
                ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs cursor-pointer'
            }`}
            title={!isAdmin ? 'Hanya Super Admin yang berhak mereset template' : 'Reset ke standar'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!isAdmin || isSaving}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              !isAdmin
                ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
            }`}
            title={!isAdmin ? 'Hanya Super Admin yang berhak menyimpan perubahan template' : 'Simpan template'}
          >
            {isAdmin ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </div>

      {/* Non-Admin Warning Banner */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Mode Hanya-Lihat (Read-Only)</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Anda masuk sebagai <strong>{currentUser?.name || 'Staf'}</strong> ({currentUser?.role}). Pengelolaan format Kop Surat, tanda tangan pejabat, dan template Berita Acara resmi hanya dapat diubah dan disimpan oleh <strong>Super Admin</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 12-Column Responsive Layout (Identical to Surat Tugas) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Settings (6 cols) */}
        <fieldset disabled={!isAdmin} className="xl:col-span-6 space-y-5 border-none p-0 m-0">
          {/* Card 1: Kop Surat Resmi Perusahaan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building className="w-4 h-4 text-blue-600" />
              Kop Surat Resmi Perusahaan
            </h3>

            {/* Upload Kop Surat Resmi (Support PDF, Word, Image) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Kop Surat Resmi (Support File PDF & Word)
                </span>
                {formData.letterheadBackgroundUrl || formData.headerImageUrl ? (
                  <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Kop Surat Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Format Standar JDP
                  </span>
                )}
              </div>

              {formData.letterheadBackgroundUrl || formData.headerImageUrl ? (
                <div className="bg-white rounded-lg p-2.5 flex items-center justify-center border border-slate-200 shadow-inner overflow-hidden max-h-36">
                  <img
                    src={formData.letterheadBackgroundUrl || formData.headerImageUrl}
                    alt="Preview Kop Surat"
                    className="max-h-32 w-auto object-contain"
                  />
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingHeader(true);
                  }}
                  onDragLeave={() => setIsDraggingHeader(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingHeader(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleHeaderFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => headerInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg h-28 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${
                    isDraggingHeader
                      ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                      : 'border-slate-300 hover:border-slate-400 hover:bg-white text-slate-500 bg-white'
                  }`}
                >
                  <Upload className="w-6 h-6 mb-1 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {isUploadingHeader ? 'Mengekstrak kop surat...' : 'Upload Kop Surat (PDF atau Word .docx)'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Mendukung dokumen PDF (.pdf), Microsoft Word (.docx), atau gambar (PNG/JPG)
                  </span>
                  <span className="text-[9px] text-blue-600 mt-1 font-medium">
                    Otomatis memperbarui kop surat bagian atas dan nomor surat resmi
                  </span>
                </div>
              )}

              <input
                ref={headerInputRef}
                type="file"
                accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleHeaderFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => headerInputRef.current?.click()}
                  disabled={isUploadingHeader}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {formData.letterheadBackgroundUrl || formData.headerImageUrl
                      ? 'Ganti File Kop Surat'
                      : 'Pilih File Kop (PDF / Word / Gambar)'}
                  </span>
                </button>
                {(formData.letterheadBackgroundUrl || formData.headerImageUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveHeaderImage}
                    className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Hapus dan gunakan kop surat teks standar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>

            {/* Setting Jarak Garis Kop Surat ke Judul & Nomor Berita Acara */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  Jarak Garis Kop ke Judul & Nomor Berita Acara
                </span>
                <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {currentSpacerHeight} mm
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Naikkan atau turunkan posisi teks agar judul <strong>BERITA ACARA</strong> dan nomor surat berada pas dan rapi tepat di bawah garis kop surat:
              </p>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleMoveTextUp}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="Naikkan posisi teks mendekati garis (-2 mm)"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                  <span>⬆ Lebih Naik (Rapat)</span>
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentSpacerHeight}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      headerSpacerHeight: Number(e.target.value),
                    }))
                  }
                  className="flex-1 accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleMoveTextDown}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="Turunkan posisi teks menjauhi garis (+2 mm)"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>⬇ Lebih Turun</span>
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium mr-1">Preset Cepat:</span>
                {[
                  { label: 'Rapat (6mm)', value: 6 },
                  { label: 'Kop Sedang (25mm)', value: 25 },
                  { label: 'Kop PDF Garis (38mm)', value: 38 },
                  { label: 'Kop Luas (48mm)', value: 48 },
                  { label: 'Ekstra (60mm)', value: 60 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        headerSpacerHeight: preset.value,
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      currentSpacerHeight === preset.value
                        ? 'bg-blue-50 text-blue-700 border border-blue-300 font-bold'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-xs'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Redaksi & Kalimat Resmi Berita Acara */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Redaksi & Kalimat Resmi Berita Acara
            </h3>

            {/* Paragraf Pembuka Standar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Paragraf Pembuka Standar
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      defaultOpeningText: DEFAULT_BERITA_ACARA_OPENING_TEXT,
                    })
                  }
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Reset ke Standar
                </button>
              </div>
              <textarea
                rows={3}
                value={
                  formData.defaultOpeningText !== undefined
                    ? formData.defaultOpeningText
                    : DEFAULT_BERITA_ACARA_OPENING_TEXT
                }
                onChange={(e) =>
                  setFormData({ ...formData, defaultOpeningText: e.target.value })
                }
                placeholder="Tulis redaksi kalimat pembuka berita acara..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-xs"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-500">Sisipkan tag dinamis:</span>
                <button
                  type="button"
                  onClick={() => {
                    const current =
                      formData.defaultOpeningText !== undefined
                        ? formData.defaultOpeningText
                        : DEFAULT_BERITA_ACARA_OPENING_TEXT;
                    setFormData({
                      ...formData,
                      defaultOpeningText: (current.trimEnd() + ' {tanggal} ').trimStart(),
                    });
                  }}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{tanggal}'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current =
                      formData.defaultOpeningText !== undefined
                        ? formData.defaultOpeningText
                        : DEFAULT_BERITA_ACARA_OPENING_TEXT;
                    setFormData({
                      ...formData,
                      defaultOpeningText: (current.trimEnd() + ' {lokasi} ').trimStart(),
                    });
                  }}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{lokasi}'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current =
                      formData.defaultOpeningText !== undefined
                        ? formData.defaultOpeningText
                        : DEFAULT_BERITA_ACARA_OPENING_TEXT;
                    setFormData({
                      ...formData,
                      defaultOpeningText: (current.trimEnd() + ' {kepentingan} ').trimStart(),
                    });
                  }}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono border border-blue-200 cursor-pointer transition-colors"
                >
                  + {'{kepentingan}'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Kata-kata dalam paragraf pembuka dapat diedit bebas. Gunakan tag <code className="px-1 py-0.2 bg-slate-100 rounded text-blue-600 font-mono">{'{tanggal}'}</code> untuk hari &amp; tanggal visit, <code className="px-1 py-0.2 bg-slate-100 rounded text-blue-600 font-mono">{'{lokasi}'}</code> untuk lokasi visit, atau <code className="px-1 py-0.2 bg-slate-100 rounded text-blue-600 font-mono">{'{kepentingan}'}</code> untuk keperluan visit.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kalimat Penutup Standar
              </label>
              <textarea
                rows={2}
                value={formData.defaultClosingText}
                onChange={(e) =>
                  setFormData({ ...formData, defaultClosingText: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-1 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-700 block">
                  Tampilkan Watermark Latar Belakang
                </span>
                <span className="text-[10px] text-slate-500">
                  Logo miring samar di latar belakang lembar A4 Berita Acara
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.showWatermark !== false}
                onChange={(e) =>
                  setFormData({ ...formData, showWatermark: e.target.checked })
                }
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Card 3: Penandatangan Dokumen Resmi */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Penandatangan Dokumen Resmi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Penandatangan
                </label>
                <input
                  type="text"
                  value={formData.signerName}
                  onChange={(e) =>
                    setFormData({ ...formData, signerName: e.target.value })
                  }
                  placeholder="Nandar Munandar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={formData.signerPosition}
                  onChange={(e) =>
                    setFormData({ ...formData, signerPosition: e.target.value })
                  }
                  placeholder="Direktur"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kota Asal Surat
                </label>
                <input
                  type="text"
                  value={formData.letterLocation}
                  onChange={(e) =>
                    setFormData({ ...formData, letterLocation: e.target.value })
                  }
                  placeholder="Sukabumi"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Signature & Stamp Upload Section */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <PenTool className="w-3.5 h-3.5 text-blue-600" />
                  Upload Tanda Tangan & Cap Perusahaan
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Unggah file tanda tangan dan cap stempel resmi perusahaan untuk Berita Acara.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Upload Tanda Tangan */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-blue-600" />
                      Tanda Tangan (Signature)
                    </span>
                    {formData.signatureImageUrl ? (
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Kustom
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        Standar
                      </span>
                    )}
                  </div>

                  {formData.signatureImageUrl ? (
                    <div className="bg-white rounded-lg p-2 flex items-center justify-center h-24 border border-slate-200 shadow-inner overflow-hidden">
                      <img
                        src={formData.signatureImageUrl}
                        alt="Preview TTD"
                        className="max-h-full max-w-full object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingSig(true);
                      }}
                      onDragLeave={() => setIsDraggingSig(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingSig(false);
                        if (e.dataTransfer.files?.[0]) {
                          handleSignatureUpload(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => signatureInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${
                        isDraggingSig
                          ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                          : 'border-slate-300 hover:border-slate-400 hover:bg-white text-slate-500 bg-white'
                      }`}
                    >
                      <Upload className="w-5 h-5 mb-1 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {isUploadingSig ? 'Memproses...' : 'Upload File TTD'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        PNG transparan atau foto TTD di kertas putih
                      </span>
                    </div>
                  )}

                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleSignatureUpload(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={isUploadingSig}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>{formData.signatureImageUrl ? 'Ganti TTD' : 'Pilih File TTD'}</span>
                    </button>
                    {formData.signatureImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Hapus dan gunakan TTD standar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Upload Cap Stempel */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Stamp className="w-3.5 h-3.5 text-blue-600" />
                      Cap Perusahaan (Stamp)
                    </span>
                    {formData.stampImageUrl ? (
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Kustom
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        Cap Standar
                      </span>
                    )}
                  </div>

                  {formData.stampImageUrl ? (
                    <div className="bg-white rounded-lg p-2 flex items-center justify-center h-24 border border-slate-200 shadow-inner overflow-hidden">
                      <img
                        src={formData.stampImageUrl}
                        alt="Preview Cap"
                        className="max-h-full max-w-full object-contain"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingStamp(true);
                      }}
                      onDragLeave={() => setIsDraggingStamp(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingStamp(false);
                        if (e.dataTransfer.files?.[0]) {
                          handleStampUpload(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => stampInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${
                        isDraggingStamp
                          ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                          : 'border-slate-300 hover:border-slate-400 hover:bg-white text-slate-500 bg-white'
                      }`}
                    >
                      <Upload className="w-5 h-5 mb-1 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {isUploadingStamp ? 'Memproses...' : 'Upload File Cap'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        PNG transparan stempel biru disarankan
                      </span>
                    </div>
                  )}

                  <input
                    ref={stampInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleStampUpload(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => stampInputRef.current?.click()}
                      disabled={isUploadingStamp}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>{formData.stampImageUrl ? 'Ganti Cap' : 'Pilih File Cap'}</span>
                    </button>
                    {formData.stampImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveStamp}
                        className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 text-slate-600 hover:text-red-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Hapus dan gunakan Cap standar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Combined Result Preview in Left Column */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Pratinjau Susunan Tanda Tangan & Cap Berita Acara
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Format Resmi
                  </span>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-xs border border-slate-200 flex justify-start">
                  <div className="w-64 select-none text-slate-900 font-sans">
                    <p className="text-[13px] text-slate-800 mb-0.5">
                      {formData.letterLocation || 'Sukabumi'}, 05 Oktober 2026
                    </p>
                    <p className="text-[13px] text-slate-800 mb-0.5">Hormat Kami,</p>
                    <p className="text-[12px] font-bold text-slate-900 mb-1">
                      {formData.companyName || 'PT JEMBATAN DATA PANGRANGO'}
                    </p>
                    <div className="relative h-[68px] w-56 my-0.5 select-none">
                      {formData.stampImageUrl ? (
                        <img
                          src={formData.stampImageUrl}
                          alt="Cap Perusahaan"
                          className="absolute object-contain pointer-events-none select-none"
                          style={{
                            left: '50px',
                            top: '2px',
                            height: '62px',
                            maxWidth: '135px',
                            mixBlendMode: 'multiply',
                            transform: 'rotate(-2deg)',
                          }}
                        />
                      ) : (
                        <div
                          className="absolute select-none pointer-events-none"
                          style={{
                            left: '50px',
                            top: '2px',
                            width: '135px',
                            height: '60px',
                            transform: 'rotate(-2deg)',
                            mixBlendMode: 'multiply',
                          }}
                        >
                          <svg viewBox="0 0 185 75" className="w-full h-full" fill="none">
                            <path d="M36 10 L10 38 L36 66 L46 56 L28 38 L46 20 Z" fill="#1e40af" />
                            <path d="M48 20 L32 38 L48 56 L56 48 L44 38 L56 28 Z" fill="#1d4ed8" />
                            <text x="57" y="52" fontFamily="sans-serif" fontWeight="900" fontSize="42" fill="#1e40af" letterSpacing="-1">JDP</text>
                            <text x="8" y="71" fontFamily="sans-serif" fontWeight="800" fontSize="10" fill="#1e40af" letterSpacing="0.6">PT JEMBATAN DATA PANGRANGO</text>
                          </svg>
                        </div>
                      )}
                      {formData.signatureImageUrl ? (
                        <img
                          src={formData.signatureImageUrl}
                          alt="Tanda Tangan"
                          className="absolute object-contain pointer-events-none select-none z-10"
                          style={{
                            left: '0px',
                            top: '0px',
                            height: '68px',
                            maxWidth: '145px',
                            mixBlendMode: 'multiply',
                          }}
                        />
                      ) : (
                        <div
                          className="absolute select-none pointer-events-none z-10"
                          style={{ left: '0px', top: '0px', width: '130px', height: '65px' }}
                        >
                          <svg viewBox="0 0 160 80" className="w-full h-full" fill="none">
                            <path
                              d="M15 50 C25 20, 35 15, 45 40 C55 65, 40 70, 50 35 C60 10, 75 45, 90 40 C105 35, 120 20, 135 45"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M30 65 Q70 60 140 55"
                              stroke="#0f172a"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-[13px] font-bold text-slate-900 underline decoration-1 underline-offset-2">
                      {formData.signerName || 'Nandar Munandar'}
                    </p>
                    <p className="text-[11.5px] text-slate-700 font-medium">
                      {formData.signerPosition || 'Direktur'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </fieldset>

        {/* Right Column: Live Document Preview using current form data (6 cols) */}
        <div className="xl:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-[210mm] mb-2 px-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Live Preview Kop & Format Berita Acara
            </span>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setPreviewZoom(45)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                  previewZoom === 45
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
                title="Sesuaikan dengan layar HP (Fit)"
              >
                Fit
              </button>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.max(30, z - 10))}
                  className="p-1 hover:text-slate-900 text-slate-400 cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-blue-600 font-semibold">{previewZoom}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.min(120, z + 10))}
                  className="p-1 hover:text-slate-900 text-slate-400 cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[11px] text-blue-600 font-mono hidden sm:inline">
                Perubahan tampak real-time
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto flex justify-center pb-6">
            <div
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="shadow-2xl rounded-sm shrink-0 mb-8"
            >
              <BeritaAcaraPaperDocument
                id="template-preview-ba-doc"
                doc={sampleBeritaAcara}
                template={formData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
