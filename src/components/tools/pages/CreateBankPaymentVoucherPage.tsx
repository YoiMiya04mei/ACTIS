import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save,
  Copy,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Eye,
  ZoomIn,
  ZoomOut,
  Printer,
  FileSpreadsheet,
  CreditCard,
  Building2,
  FileText,
  PenTool,
  Upload,
  Eraser,
} from 'lucide-react';
import type {
  BankPaymentVoucherDocument,
  BankPaymentVoucherItem,
} from '@/types/bankPaymentVoucher';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { BankPaymentVoucherPaperDocument } from '@/components/tools/BankPaymentVoucherPaperDocument';
import {
  generateVoucherNumber,
  calculateTotalAmount,
  generateBankPaymentVoucherWhatsAppText,
  generateBankPaymentVoucherFileName,
  formatCurrencyNumber,
  getVoucherDateSuffix,
} from '@/utils/bankPaymentVoucherUtils';
import { terbilangRupiah } from '@/utils/terbilang';
import { bankPaymentVoucherStorage, SAMPLE_BANK_PAYMENT_VOUCHER } from '@/services/bankPaymentVoucherStorage';
import { downloadBankPaymentVoucherExcel } from '@/services/bankPaymentVoucherExcelService';
import { toDateInputString } from '@/utils/dateFormatter';

interface CreateBankPaymentVoucherPageProps {
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  initialEditData?: BankPaymentVoucherDocument | null;
  onSaved?: () => void;
  currentUser?: UserAccount | null;
}

export const CreateBankPaymentVoucherPage: React.FC<CreateBankPaymentVoucherPageProps> = ({
  addToast,
  initialEditData,
  onSaved,
  currentUser,
}) => {
  // Form State
  const [editingId, setEditingId] = useState<string | null>(initialEditData?.id || null);
  const [payTo, setPayTo] = useState<string>(
    initialEditData?.payTo || 'PERMADI PRATAMA'
  );
  // Tanggal default mengikuti saat surat di-generate
  const [voucherDate, setVoucherDate] = useState<string>(
    initialEditData?.voucherDate || toDateInputString()
  );
  const [voucherPrefix, setVoucherPrefix] = useState<string>(
    initialEditData?.voucherPrefix || 'VO-'
  );
  const [voucherSequence, setVoucherSequence] = useState<string>(
    initialEditData?.voucherSequence || ''
  );

  // Rincian items (descriptions & amount)
  const [items, setItems] = useState<BankPaymentVoucherItem[]>(() => {
    if (initialEditData?.items && initialEditData.items.length > 0) {
      return initialEditData.items;
    }
    return SAMPLE_BANK_PAYMENT_VOUCHER.items;
  });

  // Data Bank
  const [bankName, setBankName] = useState<string>(
    initialEditData?.bankName || 'BCA'
  );
  const [bankAccount, setBankAccount] = useState<string>(
    initialEditData?.bankAccount || '0382576762'
  );
  const [bankAccountName, setBankAccountName] = useState<string>(
    initialEditData?.bankAccountName || 'PERMADI PRATAMA'
  );

  // Signatures / Approvals
  const [preparedByName, setPreparedByName] = useState<string>(
    initialEditData?.preparedByName || currentUser?.name || 'Permadi Pratama'
  );
  const [preparedBySignature, setPreparedBySignature] = useState<string>(
    initialEditData?.preparedBySignature || ''
  );
  const [processedName, setProcessedName] = useState<string>(
    initialEditData?.processedName || 'Elsya'
  );
  const [recordedByName, setRecordedByName] = useState<string>(
    initialEditData?.recordedByName || 'Sarah'
  );
  const [approvedByName, setApprovedByName] = useState<string>(
    initialEditData?.approvedByName || ''
  );
  const [acknowledgedByName, setAcknowledgedByName] = useState<string>(
    initialEditData?.acknowledgedByName || 'Nandar Munandar'
  );

  // Company Details
  const [companyName, setCompanyName] = useState<string>(
    initialEditData?.companyName || 'PT. Jembatan Data Pangrango'
  );
  const [companyAddress, setCompanyAddress] = useState<string>(
    initialEditData?.companyAddress ||
      'Jl. Pabuaran No.51, Nyomplong, Kec. Warudoyong, Kota Sukabumi'
  );
  const [companyCountry, setCompanyCountry] = useState<string>(
    initialEditData?.companyCountry || 'Jawa Barat - Indonesia'
  );

  // UI States
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [previewZoom, setPreviewZoom] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 90
  );
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);

  // Signature Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Perhitungan otomatis nomor voucher
  const voucherNumber = useMemo(() => {
    return generateVoucherNumber(voucherPrefix, voucherSequence, voucherDate);
  }, [voucherPrefix, voucherSequence, voucherDate]);

  // Perhitungan otomatis Total Amount & Terbilang (In Word)
  const totalAmount = useMemo(() => {
    return calculateTotalAmount(items);
  }, [items]);

  const inWord = useMemo(() => {
    return terbilangRupiah(totalAmount);
  }, [totalAmount]);

  // Sync initialEditData when editing from history
  useEffect(() => {
    if (initialEditData) {
      setEditingId(initialEditData.id);
      setPayTo(initialEditData.payTo || '');
      setVoucherDate(initialEditData.voucherDate || toDateInputString());
      setVoucherPrefix(initialEditData.voucherPrefix || 'VO-');
      setVoucherSequence(initialEditData.voucherSequence || '');
      setItems(initialEditData.items || []);
      setBankName(initialEditData.bankName || 'BCA');
      setBankAccount(initialEditData.bankAccount || '');
      setBankAccountName(initialEditData.bankAccountName || '');
      setPreparedByName(initialEditData.preparedByName || '');
      setPreparedBySignature(initialEditData.preparedBySignature || '');
      setProcessedName(initialEditData.processedName || '');
      setRecordedByName(initialEditData.recordedByName || '');
      setApprovedByName(initialEditData.approvedByName || '');
      setAcknowledgedByName(initialEditData.acknowledgedByName || '');
      if (initialEditData.companyName) setCompanyName(initialEditData.companyName);
      if (initialEditData.companyAddress) setCompanyAddress(initialEditData.companyAddress);
      if (initialEditData.companyCountry) setCompanyCountry(initialEditData.companyCountry);
    }
  }, [initialEditData]);

  // Current Document Model for Preview
  const currentDoc: BankPaymentVoucherDocument = useMemo(() => {
    return {
      id: editingId || `BPV-${Date.now()}`,
      voucherNumber,
      voucherPrefix,
      voucherSequence,
      voucherDate,
      payTo,
      totalAmount,
      inWord,
      items,
      bankName,
      bankAccount,
      bankAccountName,
      preparedByName,
      preparedBySignature,
      processedName,
      recordedByName,
      approvedByName,
      acknowledgedByName,
      companyName,
      companyAddress,
      companyCountry,
      createdAt: initialEditData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: initialEditData?.createdByName || currentUser?.name || 'Permadi Pratama',
      createdByRole: initialEditData?.createdByRole || currentUser?.role || 'admin',
    };
  }, [
    editingId,
    voucherNumber,
    voucherPrefix,
    voucherSequence,
    voucherDate,
    payTo,
    totalAmount,
    inWord,
    items,
    bankName,
    bankAccount,
    bankAccountName,
    preparedByName,
    preparedBySignature,
    processedName,
    recordedByName,
    approvedByName,
    acknowledgedByName,
    companyName,
    companyAddress,
    companyCountry,
    initialEditData,
    currentUser,
  ]);

  // Item List Handlers
  const handleAddItem = () => {
    const newItem: BankPaymentVoucherItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: '',
      amount: 0,
      accNo: '',
      accName: '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<BankPaymentVoucherItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      addToast('info', 'Minimal 1 Baris', 'Voucher harus memiliki minimal satu baris transaksi.');
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Signature Canvas Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setPreparedBySignature(dataUrl);
    setShowSignatureModal(false);
    addToast('success', 'Tanda Tangan Disimpan', 'TTD Prepared By berhasil ditambahkan.');
  };

  const handleUploadSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Format Tidak Didukung', 'Silakan pilih berkas gambar (PNG, JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPreparedBySignature(result);
        addToast('success', 'Berkas TTD Diunggah', 'Gambar tanda tangan berhasil disematkan.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save to Archive
  const handleSave = async () => {
    if (!payTo.trim()) {
      addToast('error', 'Pay To Kosong', 'Harap isi nama penerima pembayaran (Pay To).');
      return;
    }

    if (items.some((i) => !i.description.trim())) {
      addToast('error', 'Deskripsi Kosong', 'Semua baris transaksi harus memiliki deskripsi.');
      return;
    }

    try {
      const success = await bankPaymentVoucherStorage.saveVoucher(currentDoc);
      if (success) {
        addToast(
          'success',
          'Voucher Berhasil Disimpan',
          `Dokumen ${currentDoc.voucherNumber} berhasil diarsipkan ke Arsip Dokumen.`
        );
        if (onSaved) {
          onSaved();
        }
      } else {
        addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan sistem saat menyimpan dokumen.');
      }
    } catch {
      addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan saat memproses data voucher.');
    }
  };

  // Print Document
  const handlePrint = () => {
    setTimeout(() => window.print(), 100);
  };

  // Unduh Berkas Excel (.xlsx) persis template asli
  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await downloadBankPaymentVoucherExcel(currentDoc);
      const filename = generateBankPaymentVoucherFileName(currentDoc, 'xlsx');
      addToast(
        'success',
        'Excel Berhasil Dibuat',
        `File ${filename} berhasil digenerate persis sesuai template aslinya.`
      );
    } catch (e) {
      console.error('Excel generation error:', e);
      addToast('error', 'Gagal Membuat Excel', 'Terjadi kesalahan saat menyusun berkas Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Copy WhatsApp
  const handleCopyWhatsApp = async () => {
    const text = generateBankPaymentVoucherWhatsAppText(currentDoc);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks WhatsApp Disalin', 'Rincian voucher siap dikirim via WhatsApp.');
    } catch {
      addToast('error', 'Gagal', 'Tidak dapat mengakses clipboard browser.');
    }
  };

  // Reset to Sample
  const handleLoadSample = () => {
    setPayTo(SAMPLE_BANK_PAYMENT_VOUCHER.payTo);
    setVoucherDate(SAMPLE_BANK_PAYMENT_VOUCHER.voucherDate);
    setVoucherPrefix(SAMPLE_BANK_PAYMENT_VOUCHER.voucherPrefix || 'VO-');
    setVoucherSequence(SAMPLE_BANK_PAYMENT_VOUCHER.voucherSequence || '');
    setItems(SAMPLE_BANK_PAYMENT_VOUCHER.items);
    setBankName(SAMPLE_BANK_PAYMENT_VOUCHER.bankName);
    setBankAccount(SAMPLE_BANK_PAYMENT_VOUCHER.bankAccount);
    setBankAccountName(SAMPLE_BANK_PAYMENT_VOUCHER.bankAccountName);
    setPreparedByName(SAMPLE_BANK_PAYMENT_VOUCHER.preparedByName);
    setProcessedName(SAMPLE_BANK_PAYMENT_VOUCHER.processedName || 'Elsya');
    setRecordedByName(SAMPLE_BANK_PAYMENT_VOUCHER.recordedByName || 'Sarah');
    setApprovedByName(SAMPLE_BANK_PAYMENT_VOUCHER.approvedByName || '');
    setAcknowledgedByName(SAMPLE_BANK_PAYMENT_VOUCHER.acknowledgedByName || 'Nandar Munandar');
    addToast('info', 'Data Contoh Dimuat', 'Data contoh Bank Payment Voucher berhasil dimuat.');
  };

  // Clear Form
  const handleClearForm = () => {
    setPayTo('');
    setVoucherDate(toDateInputString());
    setVoucherSequence('');
    setItems([
      {
        id: `item-${Date.now()}`,
        description: '',
        amount: 0,
        accNo: '',
        accName: '',
      },
    ]);
    setBankAccount('');
    setPreparedBySignature('');
    addToast('info', 'Form Dikosongkan', 'Formulir telah dikosongkan.');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 font-sans">
      {/* Top Action Header Bar */}
      <div className="no-print bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                Bank Payment Voucher Generator
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                Voucher
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate hidden md:block">
              Buat dan terbitkan voucher pembayaran bank, otomatis menghitung total &amp; terbilang
            </p>
          </div>
        </div>

        {/* Action Buttons: Simpan, PDF, Print, WhatsApp, Muat Contoh */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearForm}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Kosongkan formulir"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Muat contoh voucher Permadi Pratama"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Contoh</span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsApp}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Salin ringkasan ke format WhatsApp"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Salin WA</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Cetak voucher"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Cetak</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Unduh Excel (.xlsx) persis template asli"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Excel</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Simpan voucher ke arsip dokumen"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* Mobile Switcher (Formulir vs Preview Lembar Dokumen) */}
      <div className="md:hidden bg-white border-b border-slate-200 p-1.5 flex gap-1 shrink-0 no-print">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mobileTab === 'form'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600'
          }`}
        >
          Formulir Voucher
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mobileTab === 'preview'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
              : 'text-slate-600'
          }`}
        >
          Preview Lembar
        </button>
      </div>

      {/* Main Workspace Grid (Left = Form, Right = Live Paper Preview) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Form Area */}
        <div
          className={`w-full md:w-[48%] lg:w-[46%] xl:w-[44%] h-full overflow-y-auto p-3 sm:p-5 space-y-4 border-r border-slate-200 bg-white shrink-0 no-print ${
            mobileTab === 'preview' ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Section 1: Informasi Utama (Pay To, Date, No Voucher) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Informasi Utama Voucher
              </h2>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                {currentDoc.voucherNumber}
              </span>
            </div>

            {/* Pay To */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pay To (Penerima Pembayaran) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={payTo}
                onChange={(e) => {
                  const val = e.target.value;
                  setPayTo(val);
                  if (!bankAccountName || bankAccountName === payTo) {
                    setBankAccountName(val);
                  }
                  if (!preparedByName || preparedByName === payTo) {
                    setPreparedByName(val);
                  }
                }}
                placeholder="PERMADI PRATAMA"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Grid Date & No Voucher */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Voucher <span className="text-slate-400 font-normal">(Otomatis)</span>
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Bulan Romawi &amp; Tahun mengikuti tanggal ini
                </span>
              </div>

              {/* No Voucher Prefix & Sequence */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Urut Voucher <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-600">
                    VO-
                  </span>
                  <input
                    type="text"
                    value={voucherSequence}
                    onChange={(e) => setVoucherSequence(e.target.value)}
                    placeholder="kosongkan / 001"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="px-2 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-600">
                    {getVoucherDateSuffix(voucherDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Amount & In Word (Otomatis) */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-900">Total Amount:</span>
                <span className="text-sm font-extrabold text-indigo-950 font-mono">
                  Rp {formatCurrencyNumber(totalAmount)}
                </span>
              </div>
              <div className="pt-1 border-t border-indigo-200/60">
                <span className="text-[11px] font-semibold text-indigo-800 block mb-0.5">
                  In Word (Bilangan Terbilang):
                </span>
                <p className="text-xs italic text-indigo-950 font-medium leading-relaxed bg-white/70 p-2 rounded-lg border border-indigo-100">
                  {inWord}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Descriptions & Amount (Bisa Lebih Dari Satu) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Rincian Transaksi ({items.length} Baris)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tambahkan satu atau lebih deskripsi &amp; amount
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            {/* List of Transaction Rows */}
            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                      Baris #{index + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                        title="Hapus baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                      placeholder="Contoh: Reimburse Pembayaran Travel SKBM<>JKT 2 orang"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* Amount & Optional Acc No */}
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Amount (Nominal Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.amount === 0 ? '' : item.amount}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="220000"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Acc No <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input
                        type="text"
                        value={item.accNo || ''}
                        onChange={(e) => handleUpdateItem(item.id, { accNo: e.target.value })}
                        placeholder="Kode Akun"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Add Baris button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris Transaksi Lainnya</span>
            </button>
          </div>

          {/* Section 3: Data Rekening Bank */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Data Rekening Bank
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Bank
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="BCA"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. Rekening (Account)
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="0382576762"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Atas Nama (Name)
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="PERMADI PRATAMA"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Kolom Prepared by (TTD & Nama) serta Pengesahan Lainnya */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
              <PenTool className="w-4 h-4 text-indigo-600" />
              Kolom Prepared by (TTD &amp; Nama) serta Approval
            </h2>

            {/* Prepared By Box */}
            <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Prepared by
                </span>
                <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  Wajib Diisi TTD &amp; Nama
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Nama Pembuat / Yang Menyiapkan:
                </label>
                <input
                  type="text"
                  value={preparedByName}
                  onChange={(e) => setPreparedByName(e.target.value)}
                  placeholder="Permadi Pratama"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                />
              </div>

              {/* TTD Signature controls */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Tanda Tangan Prepared by:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSignatureModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{preparedBySignature ? 'Gambar Ulang TTD' : 'Tanda Tangan (Canvas)'}</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Unggah Gambar TTD</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadSignatureFile}
                      className="hidden"
                    />
                  </label>

                  {preparedBySignature && (
                    <button
                      type="button"
                      onClick={() => setPreparedBySignature('')}
                      className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
                      title="Hapus TTD"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {preparedBySignature && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                    <img
                      src={preparedBySignature}
                      alt="Preview TTD"
                      className="max-h-12 max-w-[120px] object-contain mix-blend-multiply"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Other 4 Columns: Processed, Recorded by, Approved by, Acknowledged by */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Processed by:
                </label>
                <input
                  type="text"
                  value={processedName}
                  onChange={(e) => setProcessedName(e.target.value)}
                  placeholder="Elsya"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Recorded by:
                </label>
                <input
                  type="text"
                  value={recordedByName}
                  onChange={(e) => setRecordedByName(e.target.value)}
                  placeholder="Sarah / Efrida"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Approved by:
                </label>
                <input
                  type="text"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  placeholder="Fauzi A.P"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Acknowledged by:
                </label>
                <input
                  type="text"
                  value={acknowledgedByName}
                  onChange={(e) => setAcknowledgedByName(e.target.value)}
                  placeholder="Nandar Munandar / Rio Prayoga"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Document Preview Area */}
        <div
          className={`flex-1 h-full overflow-y-auto bg-slate-200/80 p-3 sm:p-6 flex flex-col items-center select-none ${
            mobileTab === 'form' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Zoom & View Controls Bar */}
          <div className="no-print bg-white/90 backdrop-blur-xs border border-slate-300/80 rounded-xl px-3 py-1.5 mb-4 shadow-xs flex items-center gap-3 sticky top-0 z-10 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              Preview Lembar A4
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(35, z - 5))}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs w-10 text-center font-bold">
                {previewZoom}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(120, z + 5))}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPreviewZoom(90)}
              className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
            >
              Reset 90%
            </button>
          </div>

          {/* Scaled A4 Document Container */}
          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <BankPaymentVoucherPaperDocument
              id="create-bpv-preview-doc"
              doc={currentDoc}
            />
          </div>
        </div>
      </div>

      {/* Modal Tanda Tangan Canvas */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-indigo-600" />
                  Goreskan Tanda Tangan (Prepared by)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Gunakan mouse atau layar sentuh untuk menandatangani
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSignatureModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* Drawing Canvas */}
            <div className="border-2 border-dashed border-indigo-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={380}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 bg-white cursor-crosshair touch-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearCanvas}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Bersihkan</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCanvasSignature}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Gunakan TTD Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateBankPaymentVoucherPage;
