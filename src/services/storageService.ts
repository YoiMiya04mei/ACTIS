import type { RFODocument, RFOTemplate, RFODraft } from '../types/rfo';
import { DEFAULT_RFO_TEMPLATE } from '../templates/rfoTemplate';
import { indexedDbStorage } from './indexedDbStorage';

export interface IStorageProvider {
  // RFO CRUD
  getAllRFOs(): Promise<RFODocument[]>;
  getRFOById(id: string): Promise<RFODocument | null>;
  saveRFO(rfo: RFODocument): Promise<RFODocument>;
  updateRFO(id: string, updates: Partial<RFODocument>): Promise<RFODocument>;
  deleteRFO(id: string): Promise<boolean>;

  // Template Management
  getTemplate(): Promise<RFOTemplate>;
  saveTemplate(template: RFOTemplate): Promise<RFOTemplate>;
  resetTemplate(): Promise<RFOTemplate>;

  // Auto-Save Draft
  getDraft(): Promise<RFODraft | null>;
  saveDraft(draft: RFODraft): Promise<void>;
  clearDraft(): Promise<void>;
}

const STORAGE_KEYS = {
  RFOS: 'jdp_rfo_documents_v1',
  TEMPLATE: 'jdp_rfo_template_v1',
  DRAFT: 'jdp_rfo_active_draft_v1',
};

// Initial sample data based on the provided company document
const SAMPLE_RFO: RFODocument = {
  id: 'RFO-20261011-001',
  rfoNumber: 'JDP/RFO/2026/10/001',
  rfoDate: '2026-10-12',
  startTime: '2026-10-11T18:15',
  endTime: '2026-10-11T22:05',
  totalDuration: '3 Jam 50 Menit',
  durationMinutes: 230,
  rootCause: 'Lonjakan traffic sesaat (microburst) pada interface uplink MPLS di sisi NEX DC yang menyebabkan packet drop.',
  actionTaken: 'Penggantian interface dan reconfigure service.',
  disruptionDescription: 'Selama waktu tersebut, layanan JKT<>BDG sempat mengalami gangguan. Saat ini seluruh layanan telah kembali normal dan dapat digunakan seperti biasa.',
  ticketNo: 'INC-20261011-889',
  customerName: 'Pelanggan Yang Terhormat',
  createdAt: '2026-10-12T08:30:00.000Z',
  updatedAt: '2026-10-12T08:30:00.000Z',
  createdBy: 'usr-admin-01',
  createdByName: 'Reza Pahlawan',
  createdByRole: 'admin',
};

class LocalStorageProvider implements IStorageProvider {
  async getAllRFOs(): Promise<RFODocument[]> {
    try {
      const data = await indexedDbStorage.ensureSharedDocuments<RFODocument>(
        STORAGE_KEYS.RFOS as 'jdp_rfo_documents_v1',
        [SAMPLE_RFO]
      );
      return [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.error('Error fetching RFOs from storage:', e);
      return [];
    }
  }

  async getRFOById(id: string): Promise<RFODocument | null> {
    const list = await this.getAllRFOs();
    return list.find((item) => item.id === id) || null;
  }

  async saveRFO(rfo: RFODocument): Promise<RFODocument> {
    const now = new Date().toISOString();
    const docToSave: RFODocument = {
      ...rfo,
      createdAt: rfo.createdAt || now,
      updatedAt: now,
    };

    const updatedList = await indexedDbStorage.upsertSharedDocument<RFODocument>(
      STORAGE_KEYS.RFOS as 'jdp_rfo_documents_v1',
      docToSave
    );
    return updatedList.find((item) => item.id === docToSave.id) || docToSave;
  }

  async updateRFO(id: string, updates: Partial<RFODocument>): Promise<RFODocument> {
    const existing = await this.getRFOById(id);
    if (!existing) {
      throw new Error(`RFO with ID ${id} not found.`);
    }

    const updated: RFODocument = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = await indexedDbStorage.upsertSharedDocument<RFODocument>(
      STORAGE_KEYS.RFOS as 'jdp_rfo_documents_v1',
      updated
    );
    return updatedList.find((item) => item.id === id) || updated;
  }

  async deleteRFO(id: string): Promise<boolean> {
    const res = await indexedDbStorage.deleteSharedDocument<RFODocument>(
      STORAGE_KEYS.RFOS as 'jdp_rfo_documents_v1',
      id
    );
    return res.deleted;
  }

  async getTemplate(): Promise<RFOTemplate> {
    try {
      return await indexedDbStorage.ensureSharedTemplate<RFOTemplate>(
        STORAGE_KEYS.TEMPLATE as 'jdp_rfo_template_v1',
        DEFAULT_RFO_TEMPLATE
      );
    } catch {
      return DEFAULT_RFO_TEMPLATE;
    }
  }

  async saveTemplate(template: RFOTemplate): Promise<RFOTemplate> {
    return await indexedDbStorage.saveSharedTemplate<RFOTemplate>(
      STORAGE_KEYS.TEMPLATE as 'jdp_rfo_template_v1',
      template,
      DEFAULT_RFO_TEMPLATE
    );
  }

  async resetTemplate(): Promise<RFOTemplate> {
    return await indexedDbStorage.saveSharedTemplate<RFOTemplate>(
      STORAGE_KEYS.TEMPLATE as 'jdp_rfo_template_v1',
      DEFAULT_RFO_TEMPLATE,
      DEFAULT_RFO_TEMPLATE
    );
  }

  async getDraft(): Promise<RFODraft | null> {
    try {
      return await indexedDbStorage.getLocalItem<RFODraft>(STORAGE_KEYS.DRAFT);
    } catch {
      return null;
    }
  }

  async saveDraft(draft: RFODraft): Promise<void> {
    try {
      await indexedDbStorage.setLocalItem(STORAGE_KEYS.DRAFT, draft);
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  }

  async clearDraft(): Promise<void> {
    try {
      await indexedDbStorage.removeLocalItem(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.warn('Failed to clear draft:', e);
    }
  }
}

export const storageService = new LocalStorageProvider();
