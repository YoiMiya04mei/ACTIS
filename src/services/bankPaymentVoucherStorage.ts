import type {
  BankPaymentVoucherDocument,
  BankPaymentVoucherDraft,
} from '../types/bankPaymentVoucher';
import { indexedDbStorage } from './indexedDbStorage';

const STORAGE_KEYS = {
  DOCUMENTS: 'jdp_bank_payment_voucher_documents_v1',
  DRAFT: 'jdp_bank_payment_voucher_active_draft_v1',
};

// Initial sample document matching the user's reference
export const SAMPLE_BANK_PAYMENT_VOUCHER: BankPaymentVoucherDocument = {
  id: 'BPV-20260917-001',
  voucherNumber: 'VO-           /IX/2026',
  voucherPrefix: 'VO-',
  voucherSequence: '',
  voucherDate: '2026-09-17',
  payTo: 'PERMADI PRATAMA',
  totalAmount: 883250,
  inWord: 'Delapan Ratus Delapan Puluh Tiga Ribu Dua Ratus Lima Puluh Rupiah',
  items: [
    { id: 'item-1', description: 'Reimburse Pembayaran Travel SKBM<>JKT 2 orang', amount: 220000 },
    { id: 'item-2', description: 'Reimburse Pembayaran gocar Shuttle <> Gedung Cyber', amount: 32500 },
    { id: 'item-3', description: 'Reimburse Pembayaran gocar Gedung Cyber<> NeuCentrix Karet', amount: 22500 },
    { id: 'item-4', description: 'Reimburse Pembayaran gocar NeuCentrix Karet <> Gedung Cyber', amount: 30000 },
    { id: 'item-5', description: 'Reimburse Pembayaran gocar Gedung Cyber<> Shuttle', amount: 18500 },
    { id: 'item-6', description: 'Reimburse Pembayaran Travel JKT<>SKBM 2 orang', amount: 220000 },
    { id: 'item-7', description: 'SPD Permadi Pratama 1 Hari', amount: 90000 },
    { id: 'item-8', description: 'Reimburse pembayaran 4C8G100 - Rocket VPS 3', amount: 249750 },
  ],
  bankName: 'BCA',
  bankAccount: '0382576762',
  bankAccountName: 'PERMADI PRATAMA',
  preparedByName: 'Permadi Pratama',
  processedName: 'Elsya',
  recordedByName: 'Sarah',
  approvedByName: '',
  acknowledgedByName: 'Nandar Munandar',
  companyName: 'PT. Jembatan Data Pangrango',
  companyAddress: 'Jl. Pabuaran No.51, Nyomplong, Kec. Warudoyong, Kota Sukabumi',
  companyCountry: 'Jawa Barat - Indonesia',
  createdAt: '2026-09-17T08:00:00.000Z',
  updatedAt: '2026-09-17T08:00:00.000Z',
  createdByName: 'Permadi Pratama',
  createdByRole: 'admin',
};

class BankPaymentVoucherStorageService {
  constructor() {
    this.initDefaultData();
  }

  private async initDefaultData(): Promise<void> {
    try {
      const existing = await indexedDbStorage.getItem<BankPaymentVoucherDocument[]>(
        STORAGE_KEYS.DOCUMENTS
      );
      if (!existing || existing.length === 0) {
        await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, [
          SAMPLE_BANK_PAYMENT_VOUCHER,
        ]);
      }
    } catch (e) {
      console.warn('BankPaymentVoucherStorage initialization notice:', e);
    }
  }

  async getAllVouchers(): Promise<BankPaymentVoucherDocument[]> {
    try {
      const data = await indexedDbStorage.getItem<BankPaymentVoucherDocument[]>(
        STORAGE_KEYS.DOCUMENTS
      );
      if (!data || data.length === 0) {
        return [SAMPLE_BANK_PAYMENT_VOUCHER];
      }
      return data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.error('Error fetching Bank Payment Voucher list:', e);
      return [];
    }
  }

  async getVoucherById(id: string): Promise<BankPaymentVoucherDocument | null> {
    const list = await this.getAllVouchers();
    return list.find((item) => item.id === id) || null;
  }

  async saveVoucher(doc: BankPaymentVoucherDocument): Promise<boolean> {
    try {
      const list = await this.getAllVouchers();
      const existingIndex = list.findIndex((item) => item.id === doc.id);

      if (existingIndex >= 0) {
        list[existingIndex] = {
          ...doc,
          updatedAt: new Date().toISOString(),
        };
      } else {
        list.unshift({
          ...doc,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, list);
      return true;
    } catch (e) {
      console.error('Error saving Bank Payment Voucher:', e);
      return false;
    }
  }

  async deleteVoucher(id: string): Promise<boolean> {
    try {
      const list = await this.getAllVouchers();
      const filtered = list.filter((item) => item.id !== id);
      await indexedDbStorage.setItem(STORAGE_KEYS.DOCUMENTS, filtered);
      return true;
    } catch (e) {
      console.error('Error deleting Bank Payment Voucher:', e);
      return false;
    }
  }

  async saveDraft(draft: BankPaymentVoucherDraft): Promise<void> {
    try {
      await indexedDbStorage.setItem(STORAGE_KEYS.DRAFT, draft);
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  }

  async getDraft(): Promise<BankPaymentVoucherDraft | null> {
    try {
      return await indexedDbStorage.getItem<BankPaymentVoucherDraft>(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.error('Error loading draft:', e);
      return null;
    }
  }

  async clearDraft(): Promise<void> {
    try {
      await indexedDbStorage.removeItem(STORAGE_KEYS.DRAFT);
    } catch (e) {
      console.error('Error clearing draft:', e);
    }
  }
}

export const bankPaymentVoucherStorage = new BankPaymentVoucherStorageService();

