import type { DurationResult } from '../types/rfo';

/**
 * Calculates duration between start and end date times.
 * Formats duration according to PT Jembatan Data Pangrango standard:
 * - < 1 jam: "45 Menit"
 * - Exact 1 hour: "1 Jam"
 * - > 1 jam: "3 Jam 50 Menit"
 * - With days: "1 Hari 2 Jam 15 Menit"
 * 
 * Returns error if end is before or equal to start.
 */
export function calculateDuration(
  startInput: string | Date | number | null | undefined,
  endInput: string | Date | number | null | undefined
): DurationResult {
  if (!startInput || !endInput) {
    return {
      isValid: false,
      formatted: '',
      totalMinutes: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      error: 'Waktu mulai dan waktu selesai wajib diisi.',
    };
  }

  const startDate = new Date(startInput);
  const endDate = new Date(endInput);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return {
      isValid: false,
      formatted: '',
      totalMinutes: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      error: 'Format tanggal atau waktu tidak valid.',
    };
  }

  const diffMs = endDate.getTime() - startDate.getTime();

  if (diffMs < 0) {
    return {
      isValid: false,
      formatted: '',
      totalMinutes: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      error: 'Waktu selesai tidak boleh lebih awal dari waktu mulai.',
    };
  }

  if (diffMs === 0) {
    return {
      isValid: false,
      formatted: '0 Menit',
      totalMinutes: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      error: 'Waktu selesai tidak boleh sama dengan waktu mulai.',
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} Hari`);
  }
  if (hours > 0) {
    parts.push(`${hours} Jam`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} Menit`);
  }

  const formatted = parts.join(' ');

  return {
    isValid: true,
    formatted,
    totalMinutes,
    days,
    hours,
    minutes,
  };
}
