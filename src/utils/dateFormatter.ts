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

/**
 * Format string datetime (YYYY-MM-DDTHH:mm or Date) into standard Indonesian RFO format:
 * Example: "Minggu, 11 Oktober 2026 Pukul 18:15 WIB"
 */
export function formatIndonesianDateTime(input: string | Date | null | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';

  const hari = NAMA_HARI[d.getDay()];
  const tanggal = d.getDate();
  const bulan = NAMA_BULAN[d.getMonth()];
  const tahun = d.getFullYear();
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');

  return `${hari}, ${tanggal} ${bulan} ${tahun} Pukul ${jam}:${menit} WIB`;
}

/**
 * Format document creation timestamp for history cards and metadata:
 * Example: "19 Oktober 2026, 18:32 WIB"
 */
export function formatCreationTimestamp(input: string | Date | null | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';

  const tanggal = d.getDate();
  const bulan = NAMA_BULAN[d.getMonth()];
  const tahun = d.getFullYear();

  const hasTime =
    input instanceof Date ||
    (typeof input === 'string' && (input.includes('T') || input.includes(':')));

  if (hasTime) {
    const jam = String(d.getHours()).padStart(2, '0');
    const menit = String(d.getMinutes()).padStart(2, '0');
    return `${tanggal} ${bulan} ${tahun}, ${jam}:${menit} WIB`;
  }

  return `${tanggal} ${bulan} ${tahun}`;
}

/**
 * Format date only in Indonesian:
 * Example: "12 Oktober 2026"
 */
export function formatIndonesianDateOnly(input: string | Date | null | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';

  const tanggal = d.getDate();
  const bulan = NAMA_BULAN[d.getMonth()];
  const tahun = d.getFullYear();

  return `${tanggal} ${bulan} ${tahun}`;
}

/**
 * Format letter header date with location:
 * Example: "Sukabumi, 12 Oktober 2026"
 */
export function formatIndonesianLetterDate(
  location: string = 'Sukabumi',
  input?: string | Date | null
): string {
  const dateFormatted = formatIndonesianDateOnly(input || new Date());
  return `${location}, ${dateFormatted}`;
}

/**
 * Converts a Date or current time to YYYY-MM-DDTHH:mm format for HTML datetime-local input
 */
export function toDatetimeLocalString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a Date to YYYY-MM-DD
 */
export function toDateInputString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
