import React from 'react';
import { AlertCircle, ClipboardList, FileText, UserCheck, Clock, PackageCheck, CreditCard } from 'lucide-react';
import type { ActiveTab, RFODocument, RFOTemplate } from '@/types/rfo';
import type { SuratTugasDocument, SuratTugasTemplate } from '@/types/suratTugas';
import type { BeritaAcaraDocument, BeritaAcaraTemplate } from '@/types/beritaAcara';
import type { PermitBarangDocument, PermitBarangTemplate } from '@/types/permitBarang';
import type { BankPaymentVoucherDocument } from '@/types/bankPaymentVoucher';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { formatIndonesianDateOnly } from '@/utils/dateFormatter';

import { CreateRFOPage } from './CreateRFOPage';
import { CreateSuratTugasPage } from './CreateSuratTugasPage';
import { CreateBeritaAcaraPage } from './CreateBeritaAcaraPage';
import { CreatePermitBarangPage } from './CreatePermitBarangPage';
import { CreateBankPaymentVoucherPage } from './CreateBankPaymentVoucherPage';

interface CreateUnifiedDocumentPageProps {
  activeTab: 'create' | 'create-st' | 'create-ba' | 'create-pm' | 'create-bpv';
  setActiveTab: (tab: ActiveTab) => void;
  // RFO Props
  template: RFOTemplate;
  editingRFO: RFODocument | null;
  onRFOSaved: () => void;
  // Surat Tugas Props
  suratTugasTemplate: SuratTugasTemplate;
  editingSuratTugas: SuratTugasDocument | null;
  onSuratTugasSaved: () => void;
  // Berita Acara Props
  beritaAcaraTemplate: BeritaAcaraTemplate;
  editingBeritaAcara: BeritaAcaraDocument | null;
  onBeritaAcaraSaved: () => void;
  // Permit Barang Props
  permitBarangTemplate?: PermitBarangTemplate;
  editingPermitBarang?: PermitBarangDocument | null;
  onPermitBarangSaved?: () => void;
  // Bank Payment Voucher Props
  editingBankPaymentVoucher?: BankPaymentVoucherDocument | null;
  onBankPaymentVoucherSaved?: () => void;
  // Common
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser: UserAccount | null;
}

export const CreateUnifiedDocumentPage: React.FC<CreateUnifiedDocumentPageProps> = ({
  activeTab,
  setActiveTab,
  template,
  editingRFO,
  onRFOSaved,
  suratTugasTemplate,
  editingSuratTugas,
  onSuratTugasSaved,
  beritaAcaraTemplate,
  editingBeritaAcara,
  onBeritaAcaraSaved,
  permitBarangTemplate,
  editingPermitBarang,
  onPermitBarangSaved,
  editingBankPaymentVoucher,
  onBankPaymentVoucherSaved,
  addToast,
  currentUser,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50">
      {/* Top Document Type Selector Header Bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-10 shadow-xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:inline shrink-0">
            Pilih Jenis Dokumen:
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto no-scrollbar shrink-0">
            {/* 1. RFO Switcher */}
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'create'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${activeTab === 'create' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="sm:hidden">RFO</span>
              <span className="hidden sm:inline">RFO (Reason For Outage)</span>
            </button>

            {/* 2. Surat Tugas Switcher */}
            <button
              type="button"
              onClick={() => setActiveTab('create-st')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'create-st'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <ClipboardList className={`w-3.5 h-3.5 ${activeTab === 'create-st' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="sm:hidden">Surat Tugas</span>
              <span className="hidden sm:inline">Surat Tugas Visit</span>
            </button>

            {/* 3. Berita Acara Switcher */}
            <button
              type="button"
              onClick={() => setActiveTab('create-ba')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'create-ba'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'create-ba' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="sm:hidden">Berita Acara</span>
              <span className="hidden sm:inline">Berita Acara Visit</span>
            </button>

            {/* 4. Permit Barang Switcher */}
            <button
              type="button"
              onClick={() => setActiveTab('create-pm')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'create-pm'
                  ? 'bg-white text-blue-700 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <PackageCheck className={`w-3.5 h-3.5 ${activeTab === 'create-pm' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="sm:hidden">Permit Barang</span>
              <span className="hidden sm:inline">Permit Masuk & Keluar</span>
            </button>

            {/* 5. Bank Payment Voucher Switcher (Semua User) */}
            <button
              type="button"
              onClick={() => setActiveTab('create-bpv')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'create-bpv'
                  ? 'bg-white text-indigo-700 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'create-bpv' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="sm:hidden">Payment Voucher</span>
              <span className="hidden sm:inline">Payment Voucher</span>
            </button>
          </div>
        </div>

        {/* Author & Creation Date Indicator */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Dibuat: <strong className="text-slate-900 font-bold">{currentUser?.name || 'Staff NOC'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-mono font-bold text-slate-900 text-[11px] sm:text-xs">{formatIndonesianDateOnly(new Date())}</span>
          </div>
        </div>
      </div>

      {/* Main Generator Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'create' && (
          <CreateRFOPage
            template={template}
            addToast={addToast}
            initialEditData={editingRFO}
            onSaved={onRFOSaved}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'create-st' && (
          <CreateSuratTugasPage
            template={template}
            suratTugasTemplate={suratTugasTemplate}
            addToast={addToast}
            initialEditData={editingSuratTugas}
            onSaved={onSuratTugasSaved}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'create-ba' && (
          <CreateBeritaAcaraPage
            template={template}
            beritaAcaraTemplate={beritaAcaraTemplate}
            addToast={addToast}
            initialEditData={editingBeritaAcara}
            onSaved={onBeritaAcaraSaved}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'create-pm' && (
          <CreatePermitBarangPage
            template={template}
            permitBarangTemplate={permitBarangTemplate}
            addToast={addToast}
            initialEditData={editingPermitBarang}
            onSaved={onPermitBarangSaved}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'create-bpv' && currentUser?.role === 'admin' && (
          <CreateBankPaymentVoucherPage
            addToast={addToast}
            initialEditData={editingBankPaymentVoucher}
            onSaved={onBankPaymentVoucherSaved}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
};
