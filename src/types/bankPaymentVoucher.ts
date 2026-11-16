export interface BankPaymentVoucherItem {
  id: string;
  accNo?: string;
  description: string;
  accName?: string;
  amount: number;
}

export interface BankPaymentVoucherDocument {
  id: string;
  voucherNumber: string; // e.g. "VO-           /IX/2026" or "VO-001/IX/2026"
  voucherPrefix?: string; // e.g. "VO-"
  voucherSequence?: string; // e.g. "" or "001"
  voucherDate: string; // YYYY-MM-DD
  payTo: string; // e.g. "PERMADI PRATAMA"
  totalAmount: number; // Sum of items amounts
  inWord: string; // Indonesian Terbilang, e.g. "Delapan Ratus Delapan Puluh Tiga Ribu Dua Ratus Lima Puluh Rupiah"
  items: BankPaymentVoucherItem[];

  // Bank Info
  bankName: string; // e.g. "BCA"
  bankAccount: string; // e.g. "0382576762"
  bankAccountName: string; // e.g. "PERMADI PRATAMA"

  // Approvals & Signatures
  preparedByName: string; // e.g. "" or preparer's name
  preparedBySignature?: string; // Data URL of signature image/canvas
  approvedByName?: string; // Default: "Nandar Munandar"
  processedName?: string; // Default: "Elsya"
  recordedByName?: string; // Default: "Putri Puspita"
  acknowledgedByName?: string; // Default: "Nandar Munandar"

  // Company Details
  companyName?: string; // e.g. "PT. Jembatan Data Pangrango"
  companyAddress?: string; // e.g. "Jl. Pabuaran No.51, Nyomplong, Kec. Warudoyong, Kota Sukabumi"
  companyCountry?: string; // e.g. "Jawa Barat - Indonesia"

  // Metadata
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
}

export interface BankPaymentVoucherDraft {
  payTo: string;
  voucherDate: string;
  voucherPrefix?: string;
  voucherSequence?: string;
  items: BankPaymentVoucherItem[];
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  preparedByName: string;
  preparedBySignature?: string;
  processedName?: string;
  recordedByName?: string;
  approvedByName?: string;
  acknowledgedByName?: string;
  savedAt: string;
}

export const DEFAULT_BANK_PAYMENT_VOUCHER_APPROVALS = {
  approvedByName: 'Nandar Munandar',
  processedName: 'Elsya',
  recordedByName: 'Putri Puspita',
  acknowledgedByName: 'Nandar Munandar',
} as const;

