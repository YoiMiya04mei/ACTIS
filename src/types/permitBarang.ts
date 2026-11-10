import type { UserRole } from './auth';

export interface PermitBarangDevice {
  id: string;
  name: string;
  quantity?: string; // e.g. "1 Unit"
  serialNumber?: string; // e.g. "SN-123456"
  notes?: string;
}

export type PermitType = 'keluar' | 'masuk' | 'custom';

export interface PermitBarangDocument {
  id: string;
  letterNumber?: string; // Optional reference number e.g. PM/101/XII/2025/JDP
  sequenceNumber?: number;
  createdDate: string; // YYYY-MM-DD for date at top right
  letterLocation: string; // Default: 'Sukabumi' -> "Sukabumi, 09 Desember 2025"
  subject: string; // Perihal, e.g. 'Permit Keluar Barang' or 'Permit Masuk Barang'
  permitType: PermitType;

  // Kepada Yth / Recipient
  recipientTitle: string; // e.g. 'Pihak Gedung / Security Wisma Bumi Putera'
  recipientAddress: string; // e.g. 'Jl. Asia Afrika No. 141-149, Pisang, Sumur Bandung'
  recipientCity: string; // e.g. 'Bandung'

  // Pemohon / PIC
  applicantName: string; // e.g. 'Rahmat & Hendrik'
  applicantPosition: string; // e.g. 'PIC'
  applicantPhone: string; // e.g. '085759535195 / 082222203322'

  // Opening Paragraph
  openingText?: string;

  // Permit Execution Details
  permitDate: string; // Waktu, e.g. '2025-12-09' or formatted
  permitTime: string; // Pukul, e.g. '09.00 s.d 15.00'
  activity: string; // Aktifitas, e.g. 'Permit Keluar' / 'Permit Masuk'
  devices: PermitBarangDevice[]; // Jenis Perangkat (bisa lebih dari satu)
  location: string; // Lokasi, e.g. 'Gedung Wisma Bumi Putera Suite 701A'

  // Closing Paragraph
  closingText?: string;

  // Signer
  signerName: string; // Default: 'Rio Prayoga'
  signerPosition: string; // Default: 'Direktur'
  signatureImageUrl?: string;
  stampImageUrl?: string;

  // Company Information
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;

  // Metadata
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: string;
  createdByName?: string;
  createdByRole?: UserRole;
}

export interface PermitBarangDraft {
  letterNumber?: string;
  sequenceNumber?: number;
  createdDate: string;
  letterLocation: string;
  subject: string;
  permitType: PermitType;
  recipientTitle: string;
  recipientAddress: string;
  recipientCity: string;
  applicantName: string;
  applicantPosition: string;
  applicantPhone: string;
  openingText?: string;
  permitDate: string;
  permitTime: string;
  activity: string;
  devices: PermitBarangDevice[];
  location: string;
  closingText?: string;
  signerName: string;
  signerPosition: string;
  savedAt: string;
}

export interface PermitBarangTemplate {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  letterLocation: string; // Default: 'Sukabumi'

  // Default Recipient
  defaultRecipientTitle: string;
  defaultRecipientAddress: string;
  defaultRecipientCity: string;

  // Defaults
  defaultApplicantPosition: string;
  defaultLocation: string;
  defaultOpeningTextKeluar: string;
  defaultOpeningTextMasuk: string;
  defaultClosingText: string;

  // Signer
  signerName: string; // Default: 'Rio Prayoga'
  signerPosition: string; // Default: 'Direktur'
  signatureImageUrl?: string;
  stampImageUrl?: string;

  // Branding
  logoUrl?: string;
  headerImageUrl?: string;
  footerImageUrl?: string;
  letterheadBackgroundUrl?: string;
  headerSpacerHeight?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showFooter?: boolean;
  showTopCornerWave?: boolean;
}

export const DEFAULT_PERMIT_KELUAR_OPENING =
  'Sebagai perwakilan dari PT. Jembatan Data Pangrango, dengan ini saya mengajukan permohonan Permit Keluar Barang untuk melakukan beberapa keperluan.\nDengan ini kami sampaikan permohonan izin mengeluarkan perangkat kami Dengan spesifikasi yang terlampir dibawah ini :';

export const DEFAULT_PERMIT_MASUK_OPENING =
  'Sebagai perwakilan dari PT. Jembatan Data Pangrango, dengan ini saya mengajukan permohonan Permit Masuk Barang untuk melakukan beberapa keperluan.\nDengan ini kami sampaikan permohonan izin memasukkan perangkat kami Dengan spesifikasi yang terlampir dibawah ini :';

export const DEFAULT_PERMIT_BARANG_CLOSING =
  'Demikian permohonan ini kami ajukan, kami berharap agar permohonan ini dapat segera diproses, saya siap memberikan informasi tambahan yang mungkin diperlukan terkait dengan permohonan ini.\n\nAtas perhatian dan kerjasama yang diberikan, kami ucapkan terima kasih.';

export const DEFAULT_PERMIT_BARANG_TEMPLATE: PermitBarangTemplate = {
  id: 'default-pm-template',
  name: 'Standard Surat Permit Masuk & Keluar Barang PT Jembatan Data Pangrango',
  companyName: 'PT JEMBATAN DATA PANGRANGO',
  companyAddress: 'Jl. Arca No. 07, Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
  companyPhone: '+62 857-9870-8612',
  companyEmail: 'admin@jembatandata.com',
  companyWebsite: 'Sukabuminetwork.net',
  letterLocation: 'Sukabumi',
  defaultRecipientTitle: 'Pihak Gedung / Security Wisma Bumi Putera',
  defaultRecipientAddress: 'Jl. Asia Afrika No. 141-149, Pisang, Sumur Bandung',
  defaultRecipientCity: 'Bandung',
  defaultApplicantPosition: 'PIC',
  defaultLocation: 'Gedung Wisma Bumi Putera Suite 701A',
  defaultOpeningTextKeluar: DEFAULT_PERMIT_KELUAR_OPENING,
  defaultOpeningTextMasuk: DEFAULT_PERMIT_MASUK_OPENING,
  defaultClosingText: DEFAULT_PERMIT_BARANG_CLOSING,
  signerName: 'Rio Prayoga',
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
  showTopCornerWave: true,
};
