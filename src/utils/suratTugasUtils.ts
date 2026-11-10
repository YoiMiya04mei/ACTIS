import type { SuratTugasDocument } from '../types/suratTugas';
import { DEFAULT_SURAT_TUGAS_OPENING_TEXT } from '../types/suratTugas';
import { slugifyRootCause } from './slugify';

const NAMA_HARI = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ROMAN_MONTHS = [
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
 * Returns Roman numeral for 1-based month index (1 = I, 9 = IX, 10 = X, etc.)
 */
export function getRomanMonth(monthNumber: number): string {
  const idx = Math.max(1, Math.min(12, monthNumber)) - 1;
  return ROMAN_MONTHS[idx];
}

/**
 * Generates official Surat Tugas Number:
 * Format: ST/{sequenceNumber}/{romanMonth}/{year}/JDP
 * Example: ST/120/IX/2026/JDP or ST/121/X/2026/JDP
 */
export function generateSuratTugasNumber(
  sequenceNumber: number,
  createdDateStr?: string | Date
): string {
  const d = createdDateStr ? new Date(createdDateStr) : new Date();
  const safeDate = isNaN(d.getTime()) ? new Date() : d;
  const month = safeDate.getMonth() + 1;
  const year = safeDate.getFullYear();
  const roman = getRomanMonth(month);
  return `ST/${sequenceNumber}/${roman}/${year}/JDP`;
}

/**
 * Parses a Surat Tugas number to extract its components if possible
 */
export function parseSuratTugasNumber(numStr: string): {
  sequenceNumber?: number;
  romanMonth?: string;
  year?: number;
} | null {
  if (!numStr) return null;
  const match = numStr.trim().match(/^ST\/(\d+)\/([A-Z]+)\/(\d{4})\/JDP$/i);
  if (!match) return null;
  return {
    sequenceNumber: parseInt(match[1], 10),
    romanMonth: match[2].toUpperCase(),
    year: parseInt(match[3], 10),
  };
}

/**
 * Format date into Indonesian standard "23 September 2026"
 */
export function formatIndonesianDate(input?: string | Date | null): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';

  const tgl = d.getDate();
  const bln = NAMA_BULAN[d.getMonth()];
  const thn = d.getFullYear();
  return `${tgl} ${bln} ${thn}`;
}

/**
 * Format day name in Indonesian (e.g. "Rabu")
 */
export function getIndonesianDayName(input?: string | Date | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return NAMA_HARI[d.getDay()] || '';
}

/**
 * Format intro sentence date range as in the reference document:
 * e.g. "pada hari Rabu, 23 September 2026 sd. 23 September 2026"
 * or "pada hari Rabu, 23 September 2026 sd. Jumat, 25 September 2026"
 */
export function formatSuratTugasIntroDate(startDateStr: string, endDateStr: string): string {
  if (!startDateStr && !endDateStr) return 'pada tanggal yang ditentukan';

  const startD = startDateStr ? new Date(startDateStr) : null;
  const endD = endDateStr ? new Date(endDateStr) : null;

  const startValid = startD && !isNaN(startD.getTime());
  const endValid = endD && !isNaN(endD.getTime());

  if (!startValid && !endValid) return 'pada tanggal yang ditentukan';
  if (startValid && !endValid) {
    return `pada hari ${NAMA_HARI[startD.getDay()]}, ${formatIndonesianDate(startD)}`;
  }
  if (!startValid && endValid) {
    return `pada hari ${NAMA_HARI[endD.getDay()]}, ${formatIndonesianDate(endD)}`;
  }

  // Both valid
  const sDay = NAMA_HARI[startD!.getDay()];
  const eDay = NAMA_HARI[endD!.getDay()];
  const sDateStr = formatIndonesianDate(startD);
  const eDateStr = formatIndonesianDate(endD);

  if (startDateStr === endDateStr) {
    return `pada hari ${sDay}, ${sDateStr} sd. ${eDateStr}`;
  }

  return `pada hari ${sDay}, ${sDateStr} sd. ${eDay}, ${eDateStr}`;
}

/**
 * Format execution date range for list item #1:
 * "1. Tanggal Pelaksanaan : 23 September 2026 - 23 September 2026"
 */
export function formatSuratTugasExecutionDate(startDateStr: string, endDateStr: string): string {
  const sFormatted = formatIndonesianDate(startDateStr);
  const eFormatted = formatIndonesianDate(endDateStr);

  if (sFormatted === '-' && eFormatted === '-') return '-';
  if (sFormatted !== '-' && eFormatted === '-') return sFormatted;
  if (sFormatted === '-' && eFormatted !== '-') return eFormatted;

  return `${sFormatted} - ${eFormatted}`;
}

/**
 * Resolves opening paragraph text by replacing dynamic placeholders:
 * {tanggal} / {date} -> formatted intro date
 * {lokasi} / {location} -> visit location
 */
export function resolveSuratTugasOpeningText(
  rawOpeningText: string | undefined,
  introDateText: string,
  visitLocation: string
): string {
  const text =
    rawOpeningText && rawOpeningText.trim()
      ? rawOpeningText
      : DEFAULT_SURAT_TUGAS_OPENING_TEXT;

  return text
    .replace(/\{tanggal\}|\{date\}/gi, introDateText)
    .replace(
      /\{lokasi\}|\{location\}/gi,
      visitLocation ? visitLocation.toLowerCase() : 'data center'
    );
}

/**
 * Generates formatted plain text for email / dispatching
 */
export function generateSuratTugasPlainText(
  doc: SuratTugasDocument,
  companyName: string = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const introDate = formatSuratTugasIntroDate(doc.startDate, doc.endDate);
  const execDate = formatSuratTugasExecutionDate(doc.startDate, doc.endDate);
  const letterDate = formatIndonesianDate(doc.createdDate);
  const openingText = resolveSuratTugasOpeningText(doc.openingText, introDate, doc.visitLocation);
  const closingText =
    doc.closingText ||
    'Demikian surat tugas ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.';

  const personnelList =
    doc.personnel.length === 1
      ? `${doc.personnel[0].name} (${doc.personnel[0].phone})`
      : doc.personnel
          .map((p, idx) => `   ${idx + 1}. ${p.name} (${p.phone})`)
          .join('\n');

  return `${companyName}
SURAT TUGAS
Nomor : ${doc.letterNumber}

${openingText}

1. Tanggal Pelaksanaan : ${execDate}
2. Lokasi Visit : ${doc.visitLocation}
3. Nama dan No Telp : ${doc.personnel.length === 1 ? personnelList : '\n' + personnelList}

${closingText}

${doc.letterLocation || 'Sukabumi'}, ${letterDate}
Hormat Kami,
${companyName}

${doc.signerName || 'Nandar Munandar'}
${doc.signerPosition || 'Direktur'}
`.trim();
}

/**
 * Generates formatted message for WhatsApp
 */
export function generateSuratTugasWhatsAppText(
  doc: SuratTugasDocument,
  companyName: string = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const execDate = formatSuratTugasExecutionDate(doc.startDate, doc.endDate);
  const letterDate = formatIndonesianDate(doc.createdDate);

  const personnelLines = doc.personnel
    .map((p, idx) => `• ${doc.personnel.length > 1 ? `${idx + 1}. ` : ''}*${p.name}* (${p.phone})`)
    .join('\n');

  return `📜 *SURAT TUGAS RESMI*
*${companyName}*
*Nomor:* ${doc.letterNumber}
_Tanggal Terbit: ${doc.letterLocation || 'Sukabumi'}, ${letterDate}_

Bersama ini disampaikan penugasan visit resmi dengan rincian:

📍 *Lokasi Visit:*
${doc.visitLocation}

📅 *Tanggal Pelaksanaan:*
${execDate}

👥 *Petugas Ditugaskan:*
${personnelLines}

_Demikian surat tugas ini diterbitkan agar dapat dilaksanakan dengan penuh tanggung jawab._

*Hormat Kami,*
*${doc.signerName || 'Nandar Munandar'}*
${doc.signerPosition || 'Direktur'}
${companyName}`.trim();
}

/**
 * Creates clean filename for PDF export
 */
export function generateSuratTugasFileName(
  letterNumber: string,
  visitLocation: string
): string {
  const cleanNumber = (letterNumber || 'ST-DOC')
    .replace(/\//g, '-')
    .replace(/[^\w-]/g, '');
  const cleanLoc = slugifyRootCause(visitLocation || 'Visit', 30);
  return `Surat_Tugas_${cleanNumber}_${cleanLoc}.pdf`;
}
