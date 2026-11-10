/**
 * Hybrid Storage Service (Remote MySQL API + Local IndexedDB Caching)
 *
 * Fitur:
 * - Sinkronisasi otomatis ke Database MariaDB/MySQL di VPS melalui REST API (/api/storage/:key)
 * - Semua pengguna (lintas perangkat/laptop) dapat melihat dan memperbarui data yang sama
 * - IndexedDB lokal digunakan sebagai cache performa tinggi & fallback saat koneksi terputus
 * - Mirroring aman ke localStorage dengan penanganan QuotaExceededError
 */

const DB_NAME = 'jdp_tools_database_v1';
const STORE_NAME = 'keyval_store';
const DB_VERSION = 1;

class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isServerAvailable: boolean | null = null;

  public getIsServerAvailable(): boolean | null {
    return this.isServerAvailable;
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = (e) => {
            console.warn('[Storage] IndexedDB gagal dibuka, beralih ke localStorage:', e);
            resolve(null);
          };
        } catch (err) {
          console.warn('[Storage] Inisialisasi IndexedDB exception:', err);
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Membaca dari IndexedDB lokal
   */
  private async getLocalItem<T>(key: string): Promise<T | null> {
    const db = await this.getDB();

    if (db) {
      try {
        const val = await new Promise<T | null>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
          req.onerror = () => reject(req.error);
        });

        if (val !== null && val !== undefined) {
          return val;
        }
      } catch (err) {
        console.warn(`[Storage] IndexedDB getLocalItem("${key}") error:`, err);
      }
    }

    // Fallback ke localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
      } catch (err) {
        console.warn(`[Storage] localStorage getLocalItem("${key}") error:`, err);
      }
    }

    return null;
  }

  /**
   * Menyimpan ke IndexedDB lokal dan mirror ke localStorage
   */
  private async setLocalItem<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();

    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn(`[Storage] IndexedDB setLocalItem("${key}") warning:`, e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Abaikan jika quota localStorage browser terlampaui
      }
    }
  }

  /**
   * Mengambil data: Mengutamakan database server VPS (MySQL), dengan fallback lokal
   */
  async getItem<T>(key: string): Promise<T | null> {
    // 1. Coba ambil dari Database Server via REST API
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          this.isServerAvailable = true;

          if (json.success && json.data !== null && json.data !== undefined) {
            // Update cache lokal
            this.setLocalItem(key, json.data).catch(() => {});
            return json.data as T;
          }

          // Jika server mengembalikan null (belum ada di database), cek data lokal
          const localVal = await this.getLocalItem<T>(key);
          if (localVal !== null && localVal !== undefined) {
            // Sinkronkan data lokal ke database server agar user lain dapat melihat
            this.syncToServer(key, localVal).catch(() => {});
            return localVal;
          }

          return null;
        }
      } catch (e) {
        // Server API tidak dapat dijangkau (misal saat offline atau dev tanpa backend)
        this.isServerAvailable = false;
      }
    }

    // 2. Fallback: baca dari IndexedDB / LocalStorage lokal
    return await this.getLocalItem<T>(key);
  }

  /**
   * Menyimpan data: Simpan ke IndexedDB lokal dan sinkronkan ke database server VPS
   */
  async setItem<T>(key: string, value: T): Promise<void> {
    // Simpan ke lokal terlebih dahulu agar UI responsif seketika
    await this.setLocalItem(key, value);

    // Kirim ke database server
    await this.syncToServer(key, value);
  }

  /**
   * Menghapus data dari penyimpanan lokal dan database server
   */
  async removeItem(key: string): Promise<void> {
    // Hapus dari IndexedDB
    const db = await this.getDB();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn(`[Storage] IndexedDB removeItem("${key}") warning:`, err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    // Hapus dari database server
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.warn(`[Storage] Gagal menghapus key "${key}" di server:`, e);
      }
    }
  }

  /**
   * Helper untuk mengirim data ke database server
   */
  private async syncToServer<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    try {
      await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });
    } catch (e) {
      console.warn(`[Storage] Sinkronisasi ke server untuk key "${key}" tertunda (offline):`, e);
    }
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
