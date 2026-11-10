import type { RFODocument, RFOTemplate, RFODraft } from '../types/rfo';
import { storageService } from './storageService';
import { calculateDuration } from '../utils/duration';
import {
  formatIndonesianDateTime,
  formatIndonesianLetterDate,
} from '../utils/dateFormatter';
import { cleanWhitespace, validateRequiredText } from '../utils/security';

export interface RFOValidationResult {
  isValid: boolean;
  errors: {
    startTime?: string;
    endTime?: string;
    rootCause?: string;
    actionTaken?: string;
  };
}

export interface DashboardStats {
  totalRFO: number;
  thisMonthCount: number;
  thisWeekCount: number;
  latestRFO: RFODocument | null;
  recentList: RFODocument[];
}

export class RFOService {
  /**
   * Validate form fields before save/export
   */
  static validate(data: {
    startTime: string;
    endTime: string;
    rootCause: string;
    actionTaken: string;
  }): RFOValidationResult {
    const errors: RFOValidationResult['errors'] = {};

    if (!data.startTime) {
      errors.startTime = 'Waktu mulai wajib diisi.';
    }

    if (!data.endTime) {
      errors.endTime = 'Waktu selesai wajib diisi.';
    }

    if (data.startTime && data.endTime) {
      const duration = calculateDuration(data.startTime, data.endTime);
      if (!duration.isValid) {
        errors.endTime = duration.error || 'Waktu selesai tidak boleh lebih awal dari waktu mulai.';
      }
    }

    if (!validateRequiredText(data.rootCause)) {
      errors.rootCause = 'Root Cause wajib diisi dan tidak boleh hanya spasi.';
    }

    if (!validateRequiredText(data.actionTaken)) {
      errors.actionTaken = 'Action Taken wajib diisi dan tidak boleh hanya spasi.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Generates formatted clean plain text for ticketing, email, and telegram
   */
  static generatePlainText(rfo: RFODocument, template: RFOTemplate): string {
    const letterDate = formatIndonesianLetterDate(template.letterLocation, rfo.rfoDate);
    const startStr = formatIndonesianDateTime(rfo.startTime);
    const endStr = formatIndonesianDateTime(rfo.endTime);
    const description =
      cleanWhitespace(rfo.disruptionDescription) || template.defaultDescription;

    return `${template.companyName}
${letterDate}

${template.salutation}

${template.openingGreeting}

${template.infoLead}
Waktu Mulai   : ${startStr}
Waktu Selesai : ${endStr}
Total Durasi  : ${rfo.totalDuration}

Root Cause:
${cleanWhitespace(rfo.rootCause)}

Action Taken:
${cleanWhitespace(rfo.actionTaken)}

${description}

${template.closingContact}
${template.contactPhone}

${template.closingRemarks}

${template.signOff}

${template.signerName}
${template.signerPosition}
`.trim();
  }

  /**
   * Generates formatted compact message for WhatsApp
   */
  static generateWhatsAppText(rfo: RFODocument, template: RFOTemplate): string {
    const letterDate = formatIndonesianLetterDate(template.letterLocation, rfo.rfoDate);
    const startStr = formatIndonesianDateTime(rfo.startTime);
    const endStr = formatIndonesianDateTime(rfo.endTime);
    const description =
      cleanWhitespace(rfo.disruptionDescription) || template.defaultDescription;

    return `*REASON FOR OUTAGE (RFO)*
*${template.companyName}*
_${letterDate}_

${template.salutation}
${template.openingGreeting}

📋 *Detail Gangguan:*
• *Waktu Mulai:* ${startStr}
• *Waktu Selesai:* ${endStr}
• *Total Durasi:* ${rfo.totalDuration}

🔍 *Root Cause:*
${cleanWhitespace(rfo.rootCause)}

🛠️ *Action Taken:*
${cleanWhitespace(rfo.actionTaken)}

ℹ️ *Keterangan Layanan:*
${description}

📞 ${template.closingContact}
*${template.contactPhone}*

${template.closingRemarks.split('\n')[0]}

${template.signOff}
*${template.signerName}*
${template.signerPosition}`.trim();
  }

  /**
   * Calculate dashboard statistics
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const all = await storageService.getAllRFOs();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 7 days ago timestamp
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    let thisMonthCount = 0;
    let thisWeekCount = 0;

    for (const rfo of all) {
      const d = new Date(rfo.createdAt || rfo.rfoDate);
      if (!isNaN(d.getTime())) {
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          thisMonthCount++;
        }
        if (d >= oneWeekAgo) {
          thisWeekCount++;
        }
      }
    }

    return {
      totalRFO: all.length,
      thisMonthCount,
      thisWeekCount,
      latestRFO: all.length > 0 ? all[0] : null,
      recentList: all.slice(0, 5),
    };
  }

  /**
   * Duplicate an existing RFO with a fresh ID and current date
   */
  static duplicateRFO(source: RFODocument): RFODraft {
    return {
      startTime: source.startTime,
      endTime: source.endTime,
      rootCause: source.rootCause,
      actionTaken: source.actionTaken,
      disruptionDescription: source.disruptionDescription || '',
      ticketNo: source.ticketNo ? `${source.ticketNo}-COPY` : '',
      customerName: source.customerName,
      savedAt: new Date().toISOString(),
    };
  }
}
