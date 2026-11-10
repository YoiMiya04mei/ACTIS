import type {
  BankPaymentVoucherDocument,
  BankPaymentVoucherItem,
} from '../types/bankPaymentVoucher';
import { terbilangRupiah } from './terbilang';
import { formatIndonesianDateOnly } from './dateFormatter';

const ROMAN_MONTHS = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

/**
 * Mengubah angka bulan (1 - 12) menjadi angka Romawi (I - XII)
 */
export function getMonthRoman(month1to12: number): string {
  if (month1to12 < 1 || month1to12 > 12) return '';
  return ROMAN_MONTHS[month1to12] || '';
}

/**
 * Mengambil suffix bulan romawi dan tahun dari tanggal
 * Contoh: 2026-09-17 -> "/IX/2026"
 */
export function getVoucherDateSuffix(dateInput: string | Date = new Date()): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const romanMonth = getMonthRoman(d.getMonth() + 1);
  const year = d.getFullYear();
  return `/${romanMonth}/${year}`;
}

/**
 * Menghasilkan Nomor Voucher sesuai ketentuan:
 * Prefix "VO-" dengan Bulan Romawi dan Tahun mengikuti tanggal
 * Contoh: "VO-           /IX/2026" atau "VO-001/IX/2026"
 */
export function generateVoucherNumber(
  prefix: string = 'VO-',
  sequence: string = '',
  dateInput: string | Date = new Date()
): string {
  const suffix = getVoucherDateSuffix(dateInput);
  const cleanPrefix = prefix.trim() ? (prefix.endsWith('-') ? prefix : `${prefix}-`) : 'VO-';
  const cleanSeq = sequence.trim();

  if (!cleanSeq) {
    return `${cleanPrefix}           ${suffix}`;
  }
  return `${cleanPrefix}${cleanSeq}${suffix}`;
}

/**
 * Format angka ke format mata uang Rupiah standar
 * Contoh: 883250 -> "883.250"
 */
export function formatCurrencyNumber(amount: number): string {
  if (isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('id-ID');
}

/**
 * Format mata uang lengkap dengan awalan Rp
 * Contoh: 883250 -> "Rp 883.250"
 */
export function formatRupiahFull(amount: number): string {
  return `Rp ${formatCurrencyNumber(amount)}`;
}

/**
 * Menghitung total semua amount dari item-item rincian
 */
export function calculateTotalAmount(items: BankPaymentVoucherItem[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Menghasilkan teks WhatsApp siap kirim
 */
export function generateBankPaymentVoucherWhatsAppText(
  doc: Partial<BankPaymentVoucherDocument>
): string {
  const total = doc.totalAmount || 0;
  const inWord = doc.inWord || terbilangRupiah(total);
  const formattedDate = formatIndonesianDateOnly(doc.voucherDate || new Date());

  const itemsList = (doc.items || [])
    .map((item, idx) => {
      const desc = item.description || '-';
      return `${idx + 1}. ${desc} (${formatRupiahFull(item.amount || 0)})`;
    })
    .join('\n');

  return `*BANK PAYMENT VOUCHER*
*${doc.companyName || 'PT. Jembatan Data Pangrango'}*

*No. Voucher:* ${doc.voucherNumber || '-'}
*Date:* ${formattedDate}
*Pay To:* ${doc.payTo || '-'}
*Total Amount:* ${formatRupiahFull(total)}
*In Word:* _${inWord}_

*Rincian Transaksi:*
${itemsList || '-'}

*Data Rekening Bank:*
Bank: ${doc.bankName || '-'}
No. Rekening: ${doc.bankAccount || '-'}
A.N: ${doc.bankAccountName || doc.payTo || '-'}

*Disiapkan Oleh (Prepared by):*
${doc.preparedByName || '-'}
`;
}

/**
 * Menghasilkan nama file dokumen (PDF atau Excel .xlsx)
 * Contoh: "Bank-Payment-Voucher-VO-IX-2026-permadi-pratama.xlsx"
 */
export function generateBankPaymentVoucherFileName(
  doc: Partial<BankPaymentVoucherDocument>,
  extension: 'pdf' | 'xlsx' = 'pdf'
): string {
  const cleanVoucher = (doc.voucherNumber || 'VO')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const cleanPayTo = (doc.payTo || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `Bank-Payment-Voucher-${cleanVoucher}-${cleanPayTo}.${extension}`;
}
