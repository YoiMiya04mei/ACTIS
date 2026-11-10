import type { UserRole } from './auth';

export interface BeritaAcaraPersonnel {
  id: string;
  name: string;
  phone?: string;
  position?: string;
}

export interface BeritaAcaraAttachment {
  id: string;
  imageUrl: string;
  caption?: string;
  fileName?: string;
}

export interface BeritaAcaraDocument {
  id: string;
  letterNumber: string; // e.g. BA/121/X/2026/JDP
  sequenceNumber: number; // e.g. 120, 121
  createdDate: string; // YYYY-MM-DD
  letterLocation: string; // Default: 'Sukabumi'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  visitLocation: string; // e.g. 'Data Center Neucentrix Karet'
  purpose: string; // Kepentingan: e.g. 'Device Instalation'
  personnel: BeritaAcaraPersonnel[];
  attachments: BeritaAcaraAttachment[];
  attachmentLabel?: string; // Default: 'Lampiran 1'
  signerName: string; // Default: 'Nandar Munandar'
  signerPosition: string; // Default: 'Direktur'
  signatureImageUrl?: string;
  stampImageUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  openingText?: string; // Custom opening paragraph
  closingText?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: string;
  createdByName?: string;
  createdByRole?: UserRole;
}

export interface BeritaAcaraDraft {
  letterNumber: string;
  sequenceNumber: number;
  createdDate: string;
  letterLocation: string;
  startDate: string;
  endDate: string;
  visitLocation: string;
  purpose: string;
  personnel: BeritaAcaraPersonnel[];
  attachments: BeritaAcaraAttachment[];
  attachmentLabel?: string;
  openingText?: string;
  closingText?: string;
  signerName: string;
  signerPosition: string;
  savedAt: string;
}

export interface BeritaAcaraTemplate {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  letterLocation: string;
  signerName: string;
  signerPosition: string;
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

export const DEFAULT_BERITA_ACARA_OPENING_TEXT =
  'Bersama ini kami sampaikan bahwa {tanggal} akan dilakukan visit ke {lokasi} . Adapun informasi terkait perihal tersebut adalah sebagai berikut :';

export const DEFAULT_BERITA_ACARA_TEMPLATE: BeritaAcaraTemplate = {
  id: 'default-ba-template',
  name: 'Standard Berita Acara PT Jembatan Data Pangrango',
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
  defaultOpeningText: DEFAULT_BERITA_ACARA_OPENING_TEXT,
  defaultClosingText:
    'Demikian Berita Acara ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.',
};
