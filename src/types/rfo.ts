import type { UserRole } from './auth';

export interface RFODocument {
  id: string;
  rfoNumber?: string;
  rfoDate: string; // YYYY-MM-DD
  startTime: string; // YYYY-MM-DDTHH:mm
  endTime: string; // YYYY-MM-DDTHH:mm
  totalDuration: string;
  durationMinutes: number;
  rootCause: string;
  actionTaken: string;
  disruptionDescription?: string;
  ticketNo?: string;
  customerName?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy?: string; // User ID
  createdByName?: string; // Full Name of author
  createdByRole?: UserRole; // Role of author
}

export interface RFOTemplate {
  id: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  letterLocation: string;
  salutation: string;
  openingGreeting: string;
  infoLead: string;
  defaultDescription: string;
  closingContact: string;
  contactPhone: string;
  closingRemarks: string;
  signOff: string;
  signerName: string;
  signerPosition: string;
  signatureImageUrl?: string;
  stampImageUrl?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  footerImageUrl?: string;
  letterheadBackgroundUrl?: string;
  companyWebsite?: string;
  showWatermark?: boolean;
  watermarkText?: string;
  showFooter?: boolean;
  showTopCornerWave?: boolean;
  headerSpacerHeight?: number; // Spacer in mm between letterhead and date/body text
}

export interface RFODraft {
  startTime: string;
  endTime: string;
  rootCause: string;
  actionTaken: string;
  disruptionDescription?: string;
  ticketNo?: string;
  customerName?: string;
  rfoDate?: string;
  savedAt: string;
}

export interface DurationResult {
  isValid: boolean;
  formatted: string;
  totalMinutes: number;
  days: number;
  hours: number;
  minutes: number;
  error?: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'create'
  | 'history'
  | 'create-st'
  | 'history-st'
  | 'templates-st'
  | 'create-ba'
  | 'history-ba'
  | 'templates-ba'
  | 'create-pm'
  | 'history-pm'
  | 'templates-pm'
  | 'create-bpv'
  | 'history-bpv'
  | 'templates'
  | 'users'
  | 'settings'
  | 'traffic-qos'
  | 'mikrotik-tools'
  | 'huawei-activation';

