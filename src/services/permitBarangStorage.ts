import type {
  PermitBarangDocument,
  PermitBarangDraft,
  PermitBarangTemplate,
} from '../types/permitBarang';
import {
  DEFAULT_PERMIT_BARANG_TEMPLATE,
  DEFAULT_PERMIT_KELUAR_OPENING,
  DEFAULT_PERMIT_BARANG_CLOSING,
} from '../types/permitBarang';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  DOCUMENTS: 'jdp_permit_barang_documents_v1',
  DRAFT: 'jdp_permit_barang_active_draft_v1',
  TEMPLATE: 'jdp_permit_barang_template_v1',
};

// Initial sample document exactly matching the user's PDF reference
export const SAMPLE_PERMIT_BARANG: PermitBarangDocument = {
  id: 'PM-20251209-001',
  letterNumber: 'PM/101/XII/2025/JDP',
  sequenceNumber: 101,
  createdDate: '2025-12-09',
  letterLocation: 'Sukabumi',
  subject: 'Permit Keluar Barang',
  permitType: 'keluar',
  recipientTitle: 'Pihak Gedung / Security Wisma Bumi Putera',
  recipientAddress: 'Jl. Asia Afrika No. 141-149, Pisang, Sumur Bandung',
  recipientCity: 'Bandung',
  applicantName: 'Rahmat & Hendrik',
  applicantPosition: 'PIC',
  applicantPhone: '085759535195 / 082222203322',
  openingText: DEFAULT_PERMIT_KELUAR_OPENING,
  permitDate: '2025-12-09',
  permitTime: '09.00 s.d 15.00',
  activity: 'Permit Keluar',
  devices: [
    { id: 'dev-1', name: 'Routerboard 1100AHx4' },
    { id: 'dev-2', name: 'Switch RG-NB3200-24SFP/8GT4XS' },
    { id: 'dev-3', name: 'Server Dell' },
    { id: 'dev-4', name: 'PC Rakitan' },
  ],
  location: 'Gedung Wisma Bumi Putera Suite 701A',
  closingText: DEFAULT_PERMIT_BARANG_CLOSING,
  signerName: 'Rio Prayoga',
  signerPosition: 'Direktur',
  companyName: 'PT JEMBATAN DATA PANGRANGO',
  companyAddress: 'Jl. Arca No. 07, Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123',
  companyPhone: '+62 857-9870-8612',
  companyEmail: 'admin@jembatandata.com',
  companyWebsite: 'Sukabuminetwork.net',
  createdAt: '2025-12-09T08:00:00.000Z',
  updatedAt: '2025-12-09T08:00:00.000Z',
  createdByName: 'Rahmat & Hendrik',
  createdByRole: 'engineer',
};

class PermitBarangStorageService {
  constructor() {
    this.initDefaultData();
  }

  private async initDefaultData(): Promise<void> {
    try {
      const existing = await indexedDbStorage.getItem<PermitBarangDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!existing || existing.length === 0) {
        await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, [SAMPLE_PERMIT_BARANG]);
      }
      const existingTemplate = await indexedDbStorage.getItem<PermitBarangTemplate>(
        STORAGE_KEYS.TEMPLATE
      );
      if (!existingTemplate) {
        await indexedDbStorage.setItem(
          STORAGE_KEYS.TEMPLATE,
          DEFAULT_PERMIT_BARANG_TEMPLATE
        );
      }
    } catch (e) {
      console.warn('PermitBarangStorage initialization notice:', e);
    }
  }

  async getAllPermitBarang(): Promise<PermitBarangDocument[]> {
    try {
      const data = await indexedDbStorage.getItem<PermitBarangDocument[]>(STORAGE_KEYS.DOCUMENTS);
      if (!data || data.length === 0) {
        return [SAMPLE_PERMIT_BARANG];
      }
      // Sort newest created first
      return data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.error('Error fetching Permit Barang list:', e);
      return [];
    }
  }

  async getPermitBarangById(id: string): Promise<PermitBarangDocument | null> {
    const list = await this.getAllPermitBarang();
    return list.find((item) => item.id === id) || null;
  }

  async getNextSequenceNumber(): Promise<number> {
    const list = await this.getAllPermitBarang();
    if (list.length === 0) return 101;

    let maxSeq = 100;
    for (const item of list) {
      if (item.sequenceNumber && item.sequenceNumber > maxSeq) {
        maxSeq = item.sequenceNumber;
      }
    }
    return maxSeq + 1;
  }

  async savePermitBarang(doc: PermitBarangDocument): Promise<void> {
    const list = await this.getAllPermitBarang();
    const idx = list.findIndex((item) => item.id === doc.id);

    if (idx >= 0) {
      list[idx] = { ...doc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({
        ...doc,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, list);
    await this.clearDraft();
  }

  async deletePermitBarang(id: string): Promise<void> {
    const list = await this.getAllPermitBarang();
    const filtered = list.filter((item) => item.id !== id);
    await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, filtered);
  }

  async saveDraft(draft: PermitBarangDraft): Promise<void> {
    await indexedDbStorage.setItem(STORAGE_KEYS.DRAFT, draft);
  }

  async getDraft(): Promise<PermitBarangDraft | null> {
    return await indexedDbStorage.getItem<PermitBarangDraft>(STORAGE_KEYS.DRAFT);
  }

  async clearDraft(): Promise<void> {
    await indexedDbStorage.removeItem(STORAGE_KEYS.DRAFT);
  }

  async getTemplate(): Promise<PermitBarangTemplate> {
    const t = await indexedDbStorage.getItem<PermitBarangTemplate>(STORAGE_KEYS.TEMPLATE);
    return t || DEFAULT_PERMIT_BARANG_TEMPLATE;
  }

  async saveTemplate(template: PermitBarangTemplate): Promise<PermitBarangTemplate> {
    await indexedDbStorage.setItem(STORAGE_KEYS.TEMPLATE, template);
    return template;
  }

  async resetTemplate(): Promise<PermitBarangTemplate> {
    await indexedDbStorage.setItem(
      STORAGE_KEYS.TEMPLATE,
      DEFAULT_PERMIT_BARANG_TEMPLATE
    );
    return DEFAULT_PERMIT_BARANG_TEMPLATE;
  }
}

export const permitBarangStorage = new PermitBarangStorageService();
