import type {
  SuratTugasDocument,
  SuratTugasDraft,
  SuratTugasTemplate,
} from '../types/suratTugas';
import { DEFAULT_SURAT_TUGAS_TEMPLATE } from '../types/suratTugas';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  DOCUMENTS: 'jdp_surat_tugas_documents_v1',
  DRAFT: 'jdp_surat_tugas_active_draft_v1',
  TEMPLATE: 'jdp_surat_tugas_template_v1',
};

// Initial sample document based on the user's reference document
export const SAMPLE_SURAT_TUGAS: SuratTugasDocument = {
  id: 'ST-20260923-120',
  letterNumber: 'ST/120/IX/2026/JDP',
  sequenceNumber: 120,
  createdDate: '2026-10-05',
  letterLocation: 'Sukabumi',
  startDate: '2026-09-23',
  endDate: '2026-09-23',
  visitLocation: 'Data Center Neucentrix Karet',
  personnel: [
    {
      id: 'p-permadi',
      name: 'Permadi Pratama',
      phone: '+62 813-8426-4064',
      position: 'Technical Support',
    },
  ],
  signerName: 'Nandar Munandar',
  signerPosition: 'Direktur',
  companyName: 'PT JEMBATAN DATA PANGRANGO',
  companyAddress: 'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
  companyPhone: '+62 857-9870-8612',
  companyEmail: 'admin@jembatandata.com',
  companyWebsite: 'Sukabuminetwork.net',
  createdAt: '2026-10-05T08:00:00.000Z',
  updatedAt: '2026-10-05T08:00:00.000Z',
  createdByName: 'Permadi Pratama',
  createdByRole: 'engineer',
};

class SuratTugasStorageService {
  constructor() {
    this.initDefaultData();
  }

  private async initDefaultData(): Promise<void> {
    try {
      const existing = await indexedDbStorage.getItem<SuratTugasDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!existing || existing.length === 0) {
        await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, [SAMPLE_SURAT_TUGAS]);
      }
      const existingTemplate = await indexedDbStorage.getItem<SuratTugasTemplate>(
        STORAGE_KEYS.TEMPLATE
      );
      if (!existingTemplate) {
        await indexedDbStorage.setItem(
          STORAGE_KEYS.TEMPLATE,
          DEFAULT_SURAT_TUGAS_TEMPLATE
        );
      }
    } catch (e) {
      console.warn('SuratTugasStorage initialization notice:', e);
    }
  }

  async getAllSuratTugas(): Promise<SuratTugasDocument[]> {
    try {
      const data = await indexedDbStorage.getItem<SuratTugasDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!data || data.length === 0) {
        return [SAMPLE_SURAT_TUGAS];
      }
      // Sort newest created first
      return data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.error('Error fetching Surat Tugas list:', e);
      return [];
    }
  }

  async getSuratTugasById(id: string): Promise<SuratTugasDocument | null> {
    const list = await this.getAllSuratTugas();
    return list.find((item) => item.id === id) || null;
  }

  /**
   * Calculates the next sequence number by finding the highest existing sequence number.
   * If highest is 120, returns 121.
   */
  async getNextSequenceNumber(): Promise<number> {
    const list = await this.getAllSuratTugas();
    if (list.length === 0) return 121;

    let maxSeq = 120;
    for (const doc of list) {
      if (typeof doc.sequenceNumber === 'number' && doc.sequenceNumber > maxSeq) {
        maxSeq = doc.sequenceNumber;
      }
    }
    return maxSeq + 1;
  }

  async saveSuratTugas(doc: SuratTugasDocument): Promise<SuratTugasDocument> {
    const list = await this.getAllSuratTugas();
    const existingIndex = list.findIndex((item) => item.id === doc.id);
    const now = new Date().toISOString();

    let updatedList: SuratTugasDocument[];
    if (existingIndex >= 0) {
      updatedList = [...list];
      updatedList[existingIndex] = {
        ...doc,
        updatedAt: now,
      };
    } else {
      updatedList = [
        {
          ...doc,
          createdAt: doc.createdAt || now,
          updatedAt: now,
        },
        ...list,
      ];
    }

    await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, updatedList);
    return doc;
  }

  async deleteSuratTugas(id: string): Promise<boolean> {
    const list = await this.getAllSuratTugas();
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, filtered);
    return true;
  }

  async getDraft(): Promise<SuratTugasDraft | null> {
    try {
      return await indexedDbStorage.getItem<SuratTugasDraft>(STORAGE_KEYS.DRAFT);
    } catch {
      return null;
    }
  }

  async saveDraft(draft: SuratTugasDraft): Promise<void> {
    try {
      await indexedDbStorage.setItem(STORAGE_KEYS.DRAFT, draft);
    } catch (e) {
      console.warn('Failed to save draft Surat Tugas:', e);
    }
  }

  async clearDraft(): Promise<void> {
    try {
      await indexedDbStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.warn('Failed to clear draft Surat Tugas:', e);
    }
  }

  async getTemplate(): Promise<SuratTugasTemplate> {
    try {
      const data = await indexedDbStorage.getItem<SuratTugasTemplate>(STORAGE_KEYS.TEMPLATE);
      if (!data) return DEFAULT_SURAT_TUGAS_TEMPLATE;
      return { ...DEFAULT_SURAT_TUGAS_TEMPLATE, ...data };
    } catch {
      return DEFAULT_SURAT_TUGAS_TEMPLATE;
    }
  }

  async saveTemplate(template: SuratTugasTemplate): Promise<SuratTugasTemplate> {
    try {
      await indexedDbStorage.setItem(STORAGE_KEYS.TEMPLATE, template);
    } catch (e) {
      console.warn('Failed to save Surat Tugas template:', e);
    }
    return template;
  }

  async resetTemplate(): Promise<SuratTugasTemplate> {
    try {
      await indexedDbStorage.setItem(
        STORAGE_KEYS.TEMPLATE,
        DEFAULT_SURAT_TUGAS_TEMPLATE
      );
    } catch (e) {
      console.warn('Failed to reset Surat Tugas template:', e);
    }
    return DEFAULT_SURAT_TUGAS_TEMPLATE;
  }
}

export const suratTugasStorage = new SuratTugasStorageService();
