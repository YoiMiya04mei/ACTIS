import type { UserRole } from './auth';

export interface SuratTugasPersonnel {
  id: string;
  name: string;
  phone: string;
  position?: string;
}

export interface SuratTugasDocument {
  id: string;
  letterNumber: string; // e.g. ST/120/IX/2026/JDP
  sequenceNumber: number; // e.g. 120, 121
  createdDate: string; // YYYY-MM-DD
  letterLocation: string; // Default: 'Sukabumi'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  visitLocation: string; // e.g. 'Data Center Neucentrix Karet'
  personnel: SuratTugasPersonnel[];
  purpose?: string; // Optional purpose / notes
  openingText?: string; // Custom opening paragraph
  closingText?: string; // Custom closing paragraph
  signerName: string; // Default: 'Nandar Munandar'
  signerPosition: string; // Default: 'Direktur'
  signatureImageUrl?: string;
  stampImageUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: string;
  createdByName?: string;
  createdByRole?: UserRole;
}

export interface SuratTugasDraft {
  letterNumber: string;
  sequenceNumber: number;
  createdDate: string;
  letterLocation: string;
  startDate: string;
  endDate: string;
  visitLocation: string;
  personnel: SuratTugasPersonnel[];
  purpose?: string;
  openingText?: string;
  closingText?: string;
  signerName: string;
  signerPosition: string;
  savedAt: string;
}

export interface SuratTugasTemplate {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  letterLocation: string; // Default: 'Sukabumi'
  signerName: string; // Default: 'Nandar Munandar'
  signerPosition: string; // Default: 'Direktur'
  signatureImageUrl?: string;
  stampImageUrl?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  footerImageUrl?: string;
  letterheadBackgroundUrl?: string;
  headerSpacerHeight?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showFooter?: boolean;
  defaultOpeningText?: string;
  defaultClosingText?: string;
}

export const DEFAULT_SURAT_TUGAS_OPENING_TEXT =
  'Bersama ini kami sampaikan bahwa {tanggal} akan dilakukan visit ke {lokasi} . Adapun informasi terkait perihal tersebut adalah sebagai berikut :';

export const DEFAULT_SURAT_TUGAS_TEMPLATE: SuratTugasTemplate = {
  id: 'default-st-template',
  name: 'Standard Surat Tugas PT Jembatan Data Pangrango',
  companyName: 'PT JEMBATAN DATA PANGRANGO',
  companyAddress: 'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
  companyPhone: '+62 857-9870-8612',
  companyEmail: 'admin@jembatandata.com',
  companyWebsite: 'Sukabuminetwork.net',
  letterLocation: 'Sukabumi',
  signerName: 'Nandar Munandar',
  signerPosition: 'Direktur',
  signatureImageUrl: '',
  stampImageUrl: '',
  logoUrl: '',
  headerImageUrl: '',
  footerImageUrl: '',
  letterheadBackgroundUrl: '',
  headerSpacerHeight: 6,
  showWatermark: true,
  watermarkText: 'PT. JEMBATAN DATA PANGRANGO',
  showFooter: true,
  defaultOpeningText: DEFAULT_SURAT_TUGAS_OPENING_TEXT,
  defaultClosingText:
    'Demikian surat tugas ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.',
};
