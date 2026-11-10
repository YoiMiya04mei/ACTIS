import type { BeritaAcaraDocument } from '../types/beritaAcara';
import { DEFAULT_BERITA_ACARA_OPENING_TEXT } from '../types/beritaAcara';
import { slugifyRootCause } from './slugify';
import {
  formatIndonesianDate,
  getIndonesianDayName,
  getRomanMonth,
} from './suratTugasUtils';

/**
 * Generates official Berita Acara Number:
 * Format: BA/{sequenceNumber}/{romanMonth}/{year}/JDP
 * Example: BA/121/X/2026/JDP
 */
export function generateBeritaAcaraNumber(
  sequenceNumber: number,
  createdDateStr?: string | Date
): string {
  const d = createdDateStr ? new Date(createdDateStr) : new Date();
  const safeDate = isNaN(d.getTime()) ? new Date() : d;
  const month = safeDate.getMonth() + 1;
  const year = safeDate.getFullYear();
  const roman = getRomanMonth(month);
  return `BA/${sequenceNumber}/${roman}/${year}/JDP`;
}

/**
 * Parses a Berita Acara number to extract components if possible
 */
export function parseBeritaAcaraNumber(numStr: string): {
  sequenceNumber?: number;
  romanMonth?: string;
  year?: number;
} | null {
  if (!numStr) return null;
  const match = numStr.trim().match(/^BA\/(\d+)\/([A-Z]+)\/(\d{4})\/JDP$/i);
  if (!match) return null;
  return {
    sequenceNumber: parseInt(match[1], 10),
    romanMonth: match[2].toUpperCase(),
    year: parseInt(match[3], 10),
  };
}

/**
 * Format intro sentence date range as in the reference document:
 * e.g. "pada hari Senin, 05 Oktober 2026 sd. 05 Oktober 2026"
 * or "pada hari Senin, 05 Oktober 2026 sd. Rabu, 07 Oktober 2026"
 */
export function formatBeritaAcaraIntroDate(startDateStr: string, endDateStr: string): string {
  if (!startDateStr && !endDateStr) return 'pada tanggal yang ditentukan';

  const startD = startDateStr ? new Date(startDateStr) : null;
  const endD = endDateStr ? new Date(endDateStr) : null;

  const startValid = startD && !isNaN(startD.getTime());
  const endValid = endD && !isNaN(endD.getTime());

  if (!startValid && !endValid) return 'pada tanggal yang ditentukan';
  if (startValid && !endValid) {
    const sDay = getIndonesianDayName(startD);
    return `pada hari ${sDay}, ${formatIndonesianDate(startD)}`;
  }
  if (!startValid && endValid) {
    const eDay = getIndonesianDayName(endD);
    return `pada hari ${eDay}, ${formatIndonesianDate(endD)}`;
  }

  const sDay = getIndonesianDayName(startD!);
  const eDay = getIndonesianDayName(endD!);
  const sDateStr = formatIndonesianDate(startD);
  const eDateStr = formatIndonesianDate(endD);

  if (startDateStr === endDateStr) {
    return `pada hari ${sDay}, ${sDateStr} sd. ${eDateStr}`;
  }

  return `pada hari ${sDay}, ${sDateStr} sd. ${eDay}, ${eDateStr}`;
}

/**
 * Format execution date range for detail list item:
 * "Tanggal Pelaksanaan : 05 Oktober 2026 - 05 Oktober 2026"
 */
export function formatBeritaAcaraExecutionDate(startDateStr: string, endDateStr: string): string {
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
 * {kepentingan} / {tujuan} / {purpose} -> purpose
 */
export function resolveBeritaAcaraOpeningText(
  rawOpeningText: string | undefined,
  introDateText: string,
  visitLocation: string,
  purpose?: string
): string {
  const text =
    rawOpeningText && rawOpeningText.trim()
      ? rawOpeningText
      : DEFAULT_BERITA_ACARA_OPENING_TEXT;

  return text
    .replace(/\{tanggal\}|\{date\}/gi, introDateText)
    .replace(
      /\{lokasi\}|\{location\}/gi,
      visitLocation ? visitLocation.toLowerCase() : 'data center'
    )
    .replace(
      /\{kepentingan\}|\{tujuan\}|\{purpose\}/gi,
      purpose ? purpose : 'visit teknis'
    );
}

/**
 * Generates formatted plain text for Berita Acara
 */
export function generateBeritaAcaraPlainText(
  doc: BeritaAcaraDocument,
  companyName: string = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const introDate = formatBeritaAcaraIntroDate(doc.startDate, doc.endDate);
  const execDate = formatBeritaAcaraExecutionDate(doc.startDate, doc.endDate);
  const letterDate = formatIndonesianDate(doc.createdDate);

  const teamList =
    doc.personnel.length === 1
      ? doc.personnel[0].name
      : doc.personnel
          .map((p, idx) => `   ${idx + 1}. ${p.name}`)
          .join('\n');

  const attachmentRef = doc.attachmentLabel || (doc.attachments.length > 0 ? 'Lampiran 1' : '-');
  const openingText = resolveBeritaAcaraOpeningText(
    doc.openingText,
    introDate,
    doc.visitLocation,
    doc.purpose
  );

  return `${companyName}
BERITA ACARA
Nomor : ${doc.letterNumber}

${openingText}

Tanggal Pelaksanaan : ${execDate}
Lokasi Visit        : ${doc.visitLocation}
Kepentingan         : ${doc.purpose}
Nama tim yang bertugas : ${doc.personnel.length === 1 ? teamList : '\n' + teamList}
${doc.purpose || 'Lampiran'} : ${attachmentRef}

${doc.closingText || 'Demikian Berita Acara ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.'}

${doc.letterLocation || 'Sukabumi'}, ${letterDate}
Hormat Kami,
${companyName}

${doc.signerName || 'Nandar Munandar'}
${doc.signerPosition || 'Direktur'}
`.trim();
}

/**
 * Generates WhatsApp friendly text for Berita Acara
 */
export function generateBeritaAcaraWhatsAppText(
  doc: BeritaAcaraDocument,
  companyName: string = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const execDate = formatBeritaAcaraExecutionDate(doc.startDate, doc.endDate);
  const letterDate = formatIndonesianDate(doc.createdDate);

  const teamLines = doc.personnel
    .map((p, idx) => `• ${doc.personnel.length > 1 ? `${idx + 1}. ` : ''}*${p.name}*`)
    .join('\n');

  return `📑 *BERITA ACARA RESMI*
*${companyName}*
*Nomor:* ${doc.letterNumber}
_Tanggal Terbit: ${doc.letterLocation || 'Sukabumi'}, ${letterDate}_

Bersama ini disampaikan informasi Berita Acara visit teknis:

📍 *Lokasi Visit:*
${doc.visitLocation}

🎯 *Kepentingan:*
${doc.purpose}

📅 *Tanggal Pelaksanaan:*
${execDate}

👥 *Tim yang Bertugas:*
${teamLines}

📎 *Lampiran:*
${doc.attachmentLabel || (doc.attachments.length > 0 ? `${doc.attachments.length} Foto Dokumentasi (Terlampir)` : 'Tidak ada lampiran')}

_${doc.closingText || 'Demikian Berita Acara ini diterbitkan agar dapat dilaksanakan dengan penuh tanggung jawab.'}_

*Hormat Kami,*
*${doc.signerName || 'Nandar Munandar'}*
${doc.signerPosition || 'Direktur'}
${companyName}`.trim();
}

/**
 * Creates clean filename for PDF export
 */
export function generateBeritaAcaraFileName(
  letterNumber: string,
  purpose: string,
  visitLocation: string
): string {
  const cleanNumber = (letterNumber || 'BA-DOC')
    .replace(/\//g, '-')
    .replace(/[^\w-]/g, '');
  const cleanPurpose = slugifyRootCause(purpose || 'Berita-Acara', 24);
  const cleanLoc = slugifyRootCause(visitLocation || 'Visit', 24);
  return `Berita_Acara_${cleanNumber}_${cleanPurpose}_${cleanLoc}.pdf`;
}
