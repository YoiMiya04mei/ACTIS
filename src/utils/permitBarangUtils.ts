import type { PermitBarangDocument } from '../types/permitBarang';
import { formatIndonesianDateOnly, formatIndonesianLetterDate } from './dateFormatter';
import { getRomanMonth } from './suratTugasUtils';
import { slugifyRootCause } from './slugify';

/**
 * Formats a date into Indonesian standard date (e.g. "09 Desember 2025")
 */
export function formatPermitBarangDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  if (typeof dateInput === 'string' && /^\d{2}\s+[A-Za-z]+\s+\d{4}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  return formatIndonesianDateOnly(dateInput);
}

/**
 * Formats top-right letter date header: "Sukabumi, 09 Desember 2025"
 */
export function formatPermitBarangHeaderDate(
  location: string = 'Sukabumi',
  dateInput?: string | Date | null
): string {
  return formatIndonesianLetterDate(location || 'Sukabumi', dateInput || new Date());
}

/**
 * Optional auto-generated official number: e.g. PM/101/XII/2025/JDP
 */
export function generatePermitBarangNumber(sequence: number, dateStr?: string | Date): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const roman = getRomanMonth(d.getMonth() + 1);
  const year = d.getFullYear();
  return `PM/${sequence}/${roman}/${year}/JDP`;
}

/**
 * Formats WhatsApp text message
 */
export function generatePermitBarangWhatsAppText(
  doc: Partial<PermitBarangDocument>,
  companyName = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const subject = doc.subject || 'Permit Keluar Barang';
  const recipient = doc.recipientTitle || 'Pihak Gedung / Security';
  const dateStr = formatPermitBarangDate(doc.permitDate || doc.createdDate || new Date());
  const timeStr = doc.permitTime || '09.00 s.d 15.00';
  const activity = doc.activity || 'Permit Keluar';
  const applicantName = doc.applicantName || '-';
  const applicantPos = doc.applicantPosition ? ` (${doc.applicantPosition})` : '';
  const applicantPhone = doc.applicantPhone || '-';
  const location = doc.location || '-';

  const deviceList =
    doc.devices && doc.devices.length > 0
      ? doc.devices
          .map((d, i) => {
            const extra = [d.quantity, d.serialNumber ? `SN: ${d.serialNumber}` : '']
              .filter(Boolean)
              .join(' - ');
            return `   ${i + 1}. ${d.name}${extra ? ` (${extra})` : ''}`;
          })
          .join('\n')
      : '   - (Belum ada perangkat terdaftar)';

  return `*PERMOHONAN ${subject.toUpperCase()}*
*${companyName}*

Kepada Yth.
*${recipient}*
${doc.recipientAddress ? `${doc.recipientAddress}\n` : ''}${doc.recipientCity || ''}

Dengan hormat,
Bersama ini kami mengajukan permohonan *${subject}* dengan rincian sebagai berikut:

👤 *Pemohon / PIC:*
• Nama: ${applicantName}${applicantPos}
• Kontak: ${applicantPhone}

📅 *Waktu Pelaksanaan:*
• Hari / Tanggal: ${dateStr}
• Pukul: ${timeStr}
• Aktivitas: ${activity}
• Lokasi: ${location}

📦 *Daftar Perangkat:*
${deviceList}

Demikian permohonan ini kami ajukan, kami berharap agar permohonan ini dapat segera diproses, saya siap memberikan informasi tambahan yang mungkin diperlukan terkait dengan permohonan ini.

Atas perhatian dan kerjasama yang diberikan, kami ucapkan terima kasih.

Hormat kami,
*${companyName}*
_${doc.signerName || 'Rio Prayoga'} (${doc.signerPosition || 'Direktur'})_`.trim();
}

/**
 * Formats plain text for clipboard
 */
export function generatePermitBarangPlainText(
  doc: Partial<PermitBarangDocument>,
  companyName = 'PT JEMBATAN DATA PANGRANGO'
): string {
  const headerDate = formatPermitBarangHeaderDate(
    doc.letterLocation || 'Sukabumi',
    doc.createdDate || new Date()
  );
  const subject = doc.subject || 'Permit Keluar Barang';
  const dateStr = formatPermitBarangDate(doc.permitDate || doc.createdDate || new Date());

  const deviceList =
    doc.devices && doc.devices.length > 0
      ? doc.devices
          .map((d, i) => {
            const extra = [d.quantity, d.serialNumber ? `SN: ${d.serialNumber}` : '']
              .filter(Boolean)
              .join(' - ');
            return `  ${i + 1}. ${d.name}${extra ? ` (${extra})` : ''}`;
          })
          .join('\n')
      : '  - (Perangkat belum diisi)';

  const isMasuk =
    doc.permitType === 'masuk' ||
    Boolean(doc.subject && doc.subject.toLowerCase().includes('masuk'));

  const actionText = isMasuk
    ? 'memasukkan'
    : doc.permitType === 'keluar'
    ? 'mengeluarkan'
    : 'mengeluarkan';

  const displayCompany = companyName.toLowerCase().includes('jembatan data pangrango')
    ? 'PT. Jembatan Data Pangrango'
    : companyName;

  return `${companyName}
${headerDate}

Perihal: ${subject}

Kepada Yth.
${doc.recipientTitle || 'Pihak Gedung / Security'}
${doc.recipientAddress || ''}
${doc.recipientCity || ''}

Dengan hormat,
Saya yang bertandatangan di bawah ini:
Nama          : ${doc.applicantName || '-'}
Jabatan       : ${doc.applicantPosition || '-'}
Nomor Telepon : ${doc.applicantPhone || '-'}

Sebagai perwakilan dari ${displayCompany}, dengan ini saya mengajukan permohonan ${subject} untuk melakukan beberapa keperluan.
Dengan ini kami sampaikan permohonan izin ${actionText} perangkat kami Dengan spesifikasi yang terlampir dibawah ini :

Waktu           : ${dateStr}
Pukul           : ${doc.permitTime || '09.00 s.d 15.00'}
Aktifitas       : ${doc.activity || subject}
Jenis Perangkat :
${deviceList}
Lokasi          : ${doc.location || '-'}

Demikian permohonan ini kami ajukan, kami berharap agar permohonan ini dapat segera diproses, saya siap memberikan informasi tambahan yang mungkin diperlukan terkait dengan permohonan ini.

Atas perhatian dan kerjasama yang diberikan, kami ucapkan terima kasih.

Hormat kami,
${doc.signerName || 'Rio Prayoga'}
${doc.signerPosition || 'Direktur'}`.trim();
}

/**
 * Generates clean download filename for PDF export
 */
export function generatePermitBarangFileName(
  subject: string,
  location?: string,
  dateStr?: string
): string {
  const cleanSubject = slugifyRootCause(subject || 'Permit-Barang', 30);
  const cleanLocation = location ? `_${slugifyRootCause(location, 25)}` : '';
  const d = dateStr ? new Date(dateStr) : new Date();
  const datePart = !isNaN(d.getTime())
    ? d.toISOString().slice(0, 10)
    : String(dateStr || '').slice(0, 10);

  return `${cleanSubject}${cleanLocation}_${datePart}.pdf`;
}

/**
 * Determines whether a Permit Barang document needs a second sheet (Page 2).
 * Priority: Maintain 1 single page as much as possible until the signature block
 * ("Direktur") would collide with the bottom footer format.
 * Page 1 can comfortably hold up to 10 device rows / variable lines before hitting the bottom footer.
 * Only when content exceeds this threshold does it advance to Page 2.
 */
export function isPermitBarangMultiPage(doc?: Partial<PermitBarangDocument> | null): boolean {
  if (!doc) return false;
  const devices = doc.devices || [];

  // Count device rows (standard device = 1 row; long name > 50 chars = 2 rows)
  const deviceLines = devices.reduce(
    (acc, d) => acc + (d.name && d.name.length > 50 ? 2 : 1),
    0
  );

  // Extra text lines beyond standard template
  const openingText = doc.openingText?.trim() || '';
  const closingText = doc.closingText?.trim() || '';

  const extraOpeningLines = openingText
    ? Math.max(0, openingText.split('\n').filter(Boolean).length - 2)
    : 0;
  const extraClosingLines = closingText
    ? Math.max(0, closingText.split('\n').filter(Boolean).length - 2)
    : 0;

  // Extra text length beyond normal template (character-based safety)
  const extraCharLines = Math.max(
    0,
    Math.floor((Math.max(0, openingText.length - 240) + Math.max(0, closingText.length - 220)) / 90)
  );

  const totalVariableLines =
    deviceLines + extraOpeningLines + extraClosingLines + extraCharLines;

  // Fits on 1 page as long as total variable lines don't exceed 10
  return totalVariableLines > 10;
}
