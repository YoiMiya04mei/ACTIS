import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Copy,
  MessageSquare,
  Clock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import type { RFODocument, RFOTemplate, RFODraft } from '@/types/rfo';
import { RFOPaperDocument } from '@/components/tools/RFOPaperDocument';
import { calculateDuration } from '@/utils/duration';
import {
  formatIndonesianDateTime,
  toDatetimeLocalString,
  toDateInputString,
} from '@/utils/dateFormatter';
import { RFOService } from '@/services/rfoService';
import { storageService } from '@/services/storageService';
import type { ToastMessage } from '@/components/tools/Toast';
import type { UserAccount } from '@/types/auth';
import { useDialog } from '@/context/DialogContext';

interface CreateRFOPageProps {
  template: RFOTemplate;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  initialEditData?: RFODocument | null;
  onSaved?: () => void;
  currentUser?: UserAccount | null;
}

// Common incident templates for quick NOC operations
const NOC_TEMPLATES = [
  {
    name: 'Microburst MPLS (NEX DC)',
    rootCause:
      'Lonjakan traffic sesaat (microburst) pada interface uplink MPLS di sisi NEX DC yang menyebabkan packet drop.',
    actionTaken: 'Penggantian interface dan reconfigure service QoS uplink.',
    description:
      'Selama waktu tersebut, layanan JKT<>BDG sempat mengalami gangguan. Saat ini seluruh layanan telah kembali normal dan dapat digunakan seperti biasa.',
  },
  {
    name: 'Fiber Optic Cut (Backbone)',
    rootCause:
      'Putusnya kabel fiber optic backbone pada segmen Ciawi - Sukabumi akibat pengerjaan proyek galian pihak ketiga.',
    actionTaken:
      'Tim teknis melakukan penyambungan ulang (splicing core) dan rerouting traffic ke jalur proteksi sekunder.',
    description:
      'Selama waktu tersebut, layanan internet pelanggan area Sukabumi & sekitarnya mengalami penurunan performa dan degradasi sinyal. Saat ini seluruh layanan telah normal kembali.',
  },
  {
    name: 'Power Fluctuation / Genset Failover',
    rootCause:
      'Pemadaman suplai listrik utama PLN dan kegagalan otomatisasi transfer switch genset pada PoP distribusi.',
    actionTaken:
      'Manual override switch genset, pengecekan inverter UPS, dan normalisasi pasokan listrik cadangan.',
    description:
      'Selama waktu tersebut, layanan pada segmen distribusi sempat offline sesaat. Saat ini seluruh perangkat telah hidup kembali dan beroperasi stabil.',
  },
  {
    name: 'Core Router Memory Spike',
    rootCause:
      'Memory exhaustion dan high CPU utilization pada core BGP router akibat lonjakan routing table update.',
    actionTaken:
      'Restart BGP routing daemon, update filter prefix list, dan optimasi memory allocation.',
    description:
      'Selama waktu tersebut, terjadi packet loss dan flapping latency antar transit upstream. Saat ini traffic telah stabil.',
  },
];

export const CreateRFOPage: React.FC<CreateRFOPageProps> = ({
  template,
  addToast,
  initialEditData,
  onSaved,
  currentUser,
}) => {
  const { confirm: confirmDialog } = useDialog();
  // Form State
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [rfoDate, setRfoDate] = useState<string>(toDateInputString());
  const [rootCause, setRootCause] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [disruptionDescription, setDisruptionDescription] = useState<string>('');
  const [ticketNo, setTicketNo] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Draft state & banner
  const [hasUnfinishedDraft, setHasUnfinishedDraft] = useState<boolean>(false);
  const [cachedDraft, setCachedDraft] = useState<RFODraft | null>(null);

  // UI state
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Duration calculation
  const durationResult = useMemo(() => {
    return calculateDuration(startTime, endTime);
  }, [startTime, endTime]);

  // Check initial edit data or load draft on mount
  useEffect(() => {
    if (initialEditData) {
      setEditingId(initialEditData.id);
      setStartTime(initialEditData.startTime);
      setEndTime(initialEditData.endTime);
      setRfoDate(initialEditData.rfoDate || toDateInputString());
      setRootCause(initialEditData.rootCause);
      setActionTaken(initialEditData.actionTaken);
      setDisruptionDescription(initialEditData.disruptionDescription || '');
      setTicketNo(initialEditData.ticketNo || '');
      return;
    }

    // Set default times (e.g. today 18:15 to 22:05 or current time)
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);
    setStartTime(toDatetimeLocalString(threeHoursAgo));
    setEndTime(toDatetimeLocalString(now));

    // Check saved draft
    storageService.getDraft().then((draft) => {
      if (
        draft &&
        (draft.rootCause || draft.actionTaken || draft.disruptionDescription)
      ) {
        setCachedDraft(draft);
        setHasUnfinishedDraft(true);
      }
    });
  }, [initialEditData]);

  // Auto-save draft whenever user makes changes (unless editing existing RFO)
  useEffect(() => {
    if (editingId) return; // Don't overwrite draft while editing saved RFO

    // Only save if there's meaningful user input
    if (rootCause || actionTaken || disruptionDescription) {
      const draftObj: RFODraft = {
        startTime,
        endTime,
        rfoDate,
        rootCause,
        actionTaken,
        disruptionDescription,
        ticketNo,
        savedAt: new Date().toISOString(),
      };
      storageService.saveDraft(draftObj);
    }
  }, [
    startTime,
    endTime,
    rfoDate,
    rootCause,
    actionTaken,
    disruptionDescription,
    ticketNo,
    editingId,
  ]);

  // Handle restoring draft
  const handleRestoreDraft = () => {
    if (!cachedDraft) return;
    if (cachedDraft.startTime) setStartTime(cachedDraft.startTime);
    if (cachedDraft.endTime) setEndTime(cachedDraft.endTime);
    if (cachedDraft.rfoDate) setRfoDate(cachedDraft.rfoDate);
    setRootCause(cachedDraft.rootCause || '');
    setActionTaken(cachedDraft.actionTaken || '');
    setDisruptionDescription(cachedDraft.disruptionDescription || '');
    if (cachedDraft.ticketNo) setTicketNo(cachedDraft.ticketNo);
    setHasUnfinishedDraft(false);
    addToast('info', 'Draft Dipulihkan', 'Melanjutkan draft RFO yang belum selesai disimpan.');
  };

  // Handle discarding draft
  const handleDiscardDraft = async () => {
    await storageService.clearDraft();
    setCachedDraft(null);
    setHasUnfinishedDraft(false);
    addToast('info', 'Draft Dihapus', 'Draft sebelumnya telah dibersihkan.');
  };

  // Apply quick NOC template
  const applyTemplate = (t: (typeof NOC_TEMPLATES)[0]) => {
    setRootCause(t.rootCause);
    setActionTaken(t.actionTaken);
    setDisruptionDescription(t.description);
    addToast('success', 'Template Diterapkan', `Memuat template: ${t.name}`);
  };

  // Construct current RFO object
  const currentRFO: RFODocument = useMemo(() => {
    return {
      id: editingId || `RFO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      rfoDate: rfoDate || toDateInputString(),
      startTime,
      endTime,
      totalDuration: durationResult.isValid ? durationResult.formatted : 'Durasi tidak valid',
      durationMinutes: durationResult.totalMinutes,
      rootCause,
      actionTaken,
      disruptionDescription,
      ticketNo,
      createdAt: initialEditData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: initialEditData?.createdBy || currentUser?.id,
      createdByName: initialEditData?.createdByName || currentUser?.name || 'Staff NOC',
      createdByRole: initialEditData?.createdByRole || currentUser?.role || 'engineer',
    };
  }, [
    editingId,
    rfoDate,
    startTime,
    endTime,
    durationResult,
    rootCause,
    actionTaken,
    disruptionDescription,
    ticketNo,
    initialEditData,
    currentUser,
  ]);

  // Save RFO Action
  const handleSaveRFO = async () => {
    const validation = RFOService.validate({
      startTime,
      endTime,
      rootCause,
      actionTaken,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      addToast('error', 'Validasi Gagal', 'Mohon lengkapi seluruh field wajib dengan benar.');
      return;
    }

    setValidationErrors({});

    try {
      await storageService.saveRFO(currentRFO);
      await storageService.clearDraft();
      setHasUnfinishedDraft(false);
      addToast(
        'success',
        'RFO Berhasil Disimpan',
        `Dokumen RFO telah tercatat di arsip History.`
      );
      if (onSaved) {
        onSaved();
      }
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan dokumen ke storage.');
    }
  };


  // Copy Plain Text
  const handleCopyText = async () => {
    const text = RFOService.generatePlainText(currentRFO, template);
    try {
      await navigator.clipboard.writeText(text);
      addToast(
        'success',
        'Text RFO Berhasil Disalin',
        'Format teks siap ditempel ke Email, Telegram, atau Ticketing system.'
      );
    } catch (err) {
      addToast('error', 'Gagal Menyalin', 'Izin clipboard browser ditolak.');
    }
  };

  // Copy WhatsApp
  const handleCopyWhatsApp = async () => {
    const text = RFOService.generateWhatsAppText(currentRFO, template);
    try {
      await navigator.clipboard.writeText(text);
      addToast(
        'success',
        'WhatsApp Text Disalin',
        'Format pesan WhatsApp yang ringkas dan rapi siap dikirim.'
      );
    } catch (err) {
      addToast('error', 'Gagal Menyalin', 'Izin clipboard browser ditolak.');
    }
  };

  // Reset form
  const handleResetForm = async () => {
    if (
      await confirmDialog('Apakah Anda yakin ingin mengosongkan form? Draft akan dibersihkan.')
    ) {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);
      setStartTime(toDatetimeLocalString(threeHoursAgo));
      setEndTime(toDatetimeLocalString(now));
      setRfoDate(toDateInputString());
      setRootCause('');
      setActionTaken('');
      setDisruptionDescription('');
      setTicketNo('');
      setEditingId(null);
      setValidationErrors({});
      storageService.clearDraft();
      addToast('info', 'Form Direset', 'Formulir telah dikosongkan.');
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
          {/* Header Title with quick badge & Reset button */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {editingId ? 'Edit Mode' : 'Form Generator'}
                </span>
                <span className="text-xs text-slate-400">• Standar PT JDP</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {editingId ? 'Edit Dokumen RFO' : 'Buat Dokumen RFO Baru'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Reason for Outage - Laporan insiden gangguan jaringan resmi
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs font-medium"
              title="Reset Formulir"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Draft Notification Banner */}
          {hasUnfinishedDraft && !editingId && (
            <div className="no-print mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900 text-sm">
                    Terdapat draft RFO yang belum selesai.
                  </p>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    Sistem menyimpan progres terakhir Anda secara otomatis.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Lanjutkan Draft
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Hapus Draft
                </button>
              </div>
            </div>
          )}

          {/* Editing notice if in edit mode */}
          {editingId && (
            <div className="no-print mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Sedang mengedit dokumen tersimpan: <strong>{editingId}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  handleResetForm();
                }}
                className="text-xs text-blue-700 hover:text-blue-900 underline font-medium cursor-pointer"
              >
                Batal Edit & Buat Baru
              </button>
            </div>
          )}

          {/* Quick Incident Templates Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Quick Presets NOC (Incident Common)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NOC_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(tmpl)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors shadow-xs cursor-pointer"
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Core Input Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Data Insiden & Waktu Gangguan
              </h3>
              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                WIB Timezone
              </span>
            </div>

            {/* Date of Letter / Report */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal Dokumen RFO
              </label>
              <input
                type="date"
                value={rfoDate}
                onChange={(e) => setRfoDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono shadow-xs"
              />
            </div>

            {/* Time Grid: Start Time & End Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Waktu Mulai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 font-mono shadow-xs ${
                    validationErrors.startTime
                      ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {startTime ? formatIndonesianDateTime(startTime) : 'Pilih waktu mulai'}
                </p>
                {validationErrors.startTime && (
                  <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
                    {validationErrors.startTime}
                  </p>
                )}
              </div>

              {/* End Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Waktu Selesai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 font-mono shadow-xs ${
                    validationErrors.endTime || !durationResult.isValid
                      ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {endTime ? formatIndonesianDateTime(endTime) : 'Pilih waktu selesai'}
                </p>
                {validationErrors.endTime && (
                  <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
                    {validationErrors.endTime}
                  </p>
                )}
              </div>
            </div>

            {/* Total Duration Calculated Badge (Section 4) */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                durationResult.isValid
                  ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Total Durasi Gangguan:
                </span>
                <span
                  className={`text-sm font-bold font-mono px-2.5 py-0.5 rounded shadow-xs ${
                    durationResult.isValid
                      ? 'bg-blue-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {durationResult.isValid
                    ? durationResult.formatted
                    : 'Error Perhitungan'}
                </span>
              </div>
              {!durationResult.isValid && durationResult.error && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-600 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{durationResult.error}</span>
                </div>
              )}
            </div>

            {/* Root Cause Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Root Cause <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {rootCause.length} karakter
                </span>
              </div>
              <textarea
                rows={3}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Contoh: Lonjakan traffic sesaat (microburst) pada interface uplink MPLS di sisi NEX DC yang menyebabkan packet drop."
                className={`w-full bg-white border rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 resize-y placeholder:text-slate-400 shadow-xs ${
                  validationErrors.rootCause
                    ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                }`}
              />
              {validationErrors.rootCause && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {validationErrors.rootCause}
                </p>
              )}
            </div>

            {/* Action Taken Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Action Taken <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {actionTaken.length} karakter
                </span>
              </div>
              <textarea
                rows={3}
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="Contoh: Penggantian interface dan reconfigure service."
                className={`w-full bg-white border rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 resize-y placeholder:text-slate-400 shadow-xs ${
                  validationErrors.actionTaken
                    ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'
                }`}
              />
              {validationErrors.actionTaken && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {validationErrors.actionTaken}
                </p>
              )}
            </div>

            {/* Optional Disruption Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Deskripsi Gangguan <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={disruptionDescription}
                onChange={(e) => setDisruptionDescription(e.target.value)}
                placeholder="Kosongkan untuk menggunakan kalimat default resmi perusahaan..."
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-y placeholder:text-slate-400 shadow-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Jika dikosongkan, sistem memakai default:{' '}
                <em>"{template.defaultDescription}"</em>
              </p>
            </div>

            {/* Optional Ticket Number for NOC tracking */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                No. Tiket / Referensi Insiden{' '}
                <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                value={ticketNo}
                onChange={(e) => setTicketNo(e.target.value)}
                placeholder="Contoh: INC-20261011-889"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono shadow-xs"
              />
            </div>
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
                onClick={handleSaveRFO}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Simpan' : 'Simpan RFO'}</span>
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
              onClick={handleCopyText}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Salin Teks Biasa"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salin</span>
            </button>

            <button
              type="button"
              onClick={handleSaveRFO}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Simpan Perubahan' : 'Simpan RFO'}</span>
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
            <RFOPaperDocument
              id="rfo-paper-doc"
              rfo={currentRFO}
              template={template}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
