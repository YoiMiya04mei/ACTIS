/**
 * Utility to process uploaded image files (signatures, stamps, logos, and documentation photos).
 * Converts file to an optimized base64 Data URL to fit cleanly in local storage and IndexedDB.
 */

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp' | 'auto';
}

export function processImageFile(
  file: File,
  maxWidth: number = 600,
  maxHeight: number = 400,
  options?: ProcessImageOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File tidak ditemukan.'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('Format file harus berupa gambar (PNG, JPG, WEBP, atau SVG).'));
      return;
    }

    // Limit raw upload size to 8MB
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Ukuran file terlalu besar. Maksimal 8MB.'));
      return;
    }

    // For SVG files, read directly as Data URL to keep crisp vector quality
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca file SVG.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale proportionally if larger
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        let exportFormat = 'image/png';
        const quality = options?.quality ?? 0.85;

        if (options?.format && options.format !== 'auto') {
          exportFormat = options.format;
        } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          exportFormat = 'image/jpeg';
        } else if (file.type === 'image/webp') {
          exportFormat = 'image/webp';
        }

        const compressed = canvas.toDataURL(exportFormat, quality);
        resolve(compressed);
      };

      img.onerror = () => reject(new Error('Gagal memproses gambar yang diunggah.'));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Specifically optimizes documentation photos (e.g. for Berita Acara lampiran).
 * Compresses to JPEG with 1024x768 max resolution and 0.75 quality.
 * Shrinks raw photos from 3MB-10MB down to ~40KB-80KB while keeping sharp visual clarity for A4 and PDF.
 */
export async function compressDocumentationPhoto(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 768,
  quality: number = 0.75
): Promise<string> {
  return processImageFile(file, maxWidth, maxHeight, {
    format: 'image/jpeg',
    quality,
  });
}

/**
 * Re-compresses an existing base64 image dataUrl if it is too large.
 */
export function compressBase64Image(
  dataUrl: string,
  maxWidth: number = 1024,
  maxHeight: number = 768,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 150_000) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
