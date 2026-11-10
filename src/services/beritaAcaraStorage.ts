import type {
  BeritaAcaraDocument,
  BeritaAcaraDraft,
  BeritaAcaraTemplate,
} from '../types/beritaAcara';
import { DEFAULT_BERITA_ACARA_TEMPLATE } from '../types/beritaAcara';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  DOCUMENTS: 'jdp_berita_acara_documents_v1',
  DRAFT: 'jdp_berita_acara_active_draft_v1',
  TEMPLATE: 'jdp_berita_acara_template_v1',
};

// Initial sample document matching the user's reference document
export const SAMPLE_BERITA_ACARA: BeritaAcaraDocument = {
  id: 'BA-20261005-121',
  letterNumber: 'BA/121/X/2026/JDP',
  sequenceNumber: 121,
  createdDate: '2026-10-05',
  letterLocation: 'Sukabumi',
  startDate: '2026-10-05',
  endDate: '2026-10-05',
  visitLocation: 'Data Center Neucentrix Karet',
  purpose: 'Device Instalation',
  personnel: [
    {
      id: 'p-permadi',
      name: 'Permadi Pratama',
    },
  ],
  attachmentLabel: 'Lampiran 1',
  attachments: [],
  signerName: 'Nandar Munandar',
  signerPosition: 'Direktur',
  companyName: 'PT JEMBATAN DATA PANGRANGO',
  companyAddress: 'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
  companyPhone: '+62 857-9870-8612',
  companyEmail: 'admin@jembatandata.com',
  companyWebsite: 'Sukabuminetwork.net',
  closingText:
    'Demikian Berita Acara ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.',
  createdAt: '2026-10-05T08:00:00.000Z',
  updatedAt: '2026-10-05T08:00:00.000Z',
  createdByName: 'Permadi Pratama',
  createdByRole: 'engineer',
};

class BeritaAcaraStorageService {
  constructor() {
    this.initDefaultData();
  }

  private async initDefaultData(): Promise<void> {
    try {
      const existing = await indexedDbStorage.getItem<BeritaAcaraDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!existing || existing.length === 0) {
        await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, [SAMPLE_BERITA_ACARA]);
      }
      const existingTemplate = await indexedDbStorage.getItem<BeritaAcaraTemplate>(
        STORAGE_KEYS.TEMPLATE
      );
      if (!existingTemplate) {
        await indexedDbStorage.setItem(
          STORAGE_KEYS.TEMPLATE,
          DEFAULT_BERITA_ACARA_TEMPLATE
        );
      }
    } catch (e) {
      console.warn('BeritaAcaraStorage initialization notice:', e);
    }
  }

  async getAllBeritaAcara(): Promise<BeritaAcaraDocument[]> {
    try {
      const data = await indexedDbStorage.getItem<BeritaAcaraDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!data || data.length === 0) {
        return [SAMPLE_BERITA_ACARA];
      }
      // Sort newest created first
      return data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.error('Error fetching Berita Acara list:', e);
      return [];
    }
  }

  async getBeritaAcaraById(id: string): Promise<BeritaAcaraDocument | null> {
    const list = await this.getAllBeritaAcara();
    return list.find((item) => item.id === id) || null;
  }

  /**
   * Calculates next sequence number:
   * Looks for max sequence number.
   * If sample is 120/121, returns max + 1.
   * Defaults to 121.
   */
  async getNextSequenceNumber(): Promise<number> {
    const list = await this.getAllBeritaAcara();
    if (list.length === 0) return 121;

    let maxSeq = 120;
    for (const doc of list) {
      if (typeof doc.sequenceNumber === 'number' && doc.sequenceNumber > maxSeq) {
        maxSeq = doc.sequenceNumber;
      }
    }
    return maxSeq + 1;
  }

  async saveBeritaAcara(doc: BeritaAcaraDocument): Promise<BeritaAcaraDocument> {
    const list = await this.getAllBeritaAcara();
    const existingIndex = list.findIndex((item) => item.id === doc.id);
    const now = new Date().toISOString();

    let updatedList: BeritaAcaraDocument[];
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

  async deleteBeritaAcara(id: string): Promise<boolean> {
    const list = await this.getAllBeritaAcara();
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, filtered);
    return true;
  }

  async getDraft(): Promise<BeritaAcaraDraft | null> {
    try {
      return await indexedDbStorage.getItem<BeritaAcaraDraft>(STORAGE_KEYS.DRAFT);
    } catch {
      return null;
    }
  }

  async saveDraft(draft: BeritaAcaraDraft): Promise<void> {
    try {
      await indexedDbStorage.setItem(STORAGE_KEYS.DRAFT, draft);
    } catch (e) {
      console.warn('Failed to save draft Berita Acara:', e);
    }
  }

  async clearDraft(): Promise<void> {
    try {
      await indexedDbStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.warn('Failed to clear draft Berita Acara:', e);
    }
  }

  async getTemplate(): Promise<BeritaAcaraTemplate> {
    try {
      const data = await indexedDbStorage.getItem<BeritaAcaraTemplate>(STORAGE_KEYS.TEMPLATE);
      if (!data) return DEFAULT_BERITA_ACARA_TEMPLATE;
      return { ...DEFAULT_BERITA_ACARA_TEMPLATE, ...data };
    } catch {
      return DEFAULT_BERITA_ACARA_TEMPLATE;
    }
  }

  async saveTemplate(template: BeritaAcaraTemplate): Promise<BeritaAcaraTemplate> {
    try {
      await indexedDbStorage.setItem(STORAGE_KEYS.TEMPLATE, template);
    } catch (e) {
      console.warn('Failed to save Berita Acara template:', e);
    }
    return template;
  }

  async resetTemplate(): Promise<BeritaAcaraTemplate> {
    try {
      await indexedDbStorage.setItem(
        STORAGE_KEYS.TEMPLATE,
        DEFAULT_BERITA_ACARA_TEMPLATE
      );
    } catch (e) {
      console.warn('Failed to reset Berita Acara template:', e);
    }
    return DEFAULT_BERITA_ACARA_TEMPLATE;
  }
}

export const beritaAcaraStorage = new BeritaAcaraStorageService();
