import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { generateRFOFileName } from '../utils/slugify';

export interface PDFExportOptions {
  elementId?: string;
  element?: HTMLElement;
  rfoDate: string;
  rootCause: string;
  onProgress?: (progress: number) => void;
}

export class PDFService {
  /**
   * Renders a document paper element to a high-resolution HTML Canvas,
   * isolating it cleanly from any modal dialogs or outer containers.
   */
  static async renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
    // 1. Ensure all images inside the element are fully loaded before capturing
    const imgs = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          // Safety timeout 2.5s in case of broken remote resource
          setTimeout(() => resolve(), 2500);
        });
      })
    );

    // Standard A4 pixel dimensions at 96 DPI: 210mm = 794px, 297mm = 1123px
    const targetWidth = 794;
    const targetHeight = 1123;

    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = 'none';

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // 1588 x 2246 - ultra crisp 300 DPI equivalent
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedTarget) => {
          // Identify the real paper element in the clone
          let paperElement = clonedTarget as HTMLElement;
          if (
            !paperElement.classList.contains('rfo-document-container') &&
            !paperElement.classList.contains('surat-tugas-container') &&
            !paperElement.classList.contains('berita-acara-page') &&
            !paperElement.classList.contains('berita-acara-single-page') &&
            !paperElement.classList.contains('permit-barang-container') &&
            !paperElement.classList.contains('permit-barang-page') &&
            !paperElement.classList.contains('bank-voucher-container') &&
            !paperElement.classList.contains('bank-voucher-page')
          ) {
            const found = paperElement.querySelector<HTMLElement>(
              '.rfo-document-container, .surat-tugas-container, .berita-acara-page, .berita-acara-single-page, .permit-barang-container, .permit-barang-page, .bank-voucher-container, .bank-voucher-page'
            );
            if (found) {
              paperElement = found;
            }
          }

          // Hide all siblings of ancestors so only the paper document renders
          let node: HTMLElement | null = paperElement;
          while (node && node !== clonedDoc.body) {
            const parent: HTMLElement | null = node.parentElement;
            if (parent) {
              Array.from(parent.children).forEach((child) => {
                if (child !== node && child instanceof HTMLElement) {
                  child.style.display = 'none';
                }
              });
            }
            node = parent;
          }

          // Neutralize all ancestors up to clonedDoc.body
          let curr: HTMLElement | null = paperElement.parentElement;
          while (curr && curr !== clonedDoc.body) {
            curr.style.position = 'static';
            curr.style.margin = '0';
            curr.style.padding = '0';
            curr.style.transform = 'none';
            curr.style.border = 'none';
            curr.style.boxShadow = 'none';
            curr.style.maxWidth = 'none';
            curr.style.maxHeight = 'none';
            curr.style.overflow = 'visible';
            curr.style.display = 'block';
            curr = curr.parentElement;
          }

          // Clean up clonedDoc.body
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          clonedDoc.body.style.width = `${targetWidth}px`;
          clonedDoc.body.style.height = `${targetHeight}px`;
          clonedDoc.body.style.overflow = 'hidden';
          clonedDoc.body.style.backgroundColor = '#ffffff';

          // Snap paper element to exact (0, 0) and exact A4 dimensions
          paperElement.style.position = 'absolute';
          paperElement.style.top = '0';
          paperElement.style.left = '0';
          paperElement.style.margin = '0';
          paperElement.style.width = `${targetWidth}px`;
          paperElement.style.minWidth = `${targetWidth}px`;
          paperElement.style.maxWidth = `${targetWidth}px`;
          paperElement.style.height = `${targetHeight}px`;
          paperElement.style.minHeight = `${targetHeight}px`;
          paperElement.style.maxHeight = `${targetHeight}px`;
          paperElement.style.boxShadow = 'none';
          paperElement.style.transform = 'none';
          paperElement.style.overflow = 'hidden';
          paperElement.style.boxSizing = 'border-box';
          paperElement.style.backgroundColor = '#ffffff';
        },
      });

      element.style.boxShadow = originalShadow;
      return canvas;
    } catch (err) {
      element.style.boxShadow = originalShadow;
      throw err;
    }
  }

  /**
   * Exports a single page document (RFO or Surat Tugas) to A4 PDF.
   */
  static async exportSinglePagePDF(
    element: HTMLElement,
    filename: string
  ): Promise<string> {
    const canvas = await this.renderElementToCanvas(element);
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // 210mm x 297mm full bleed
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(filename);
    return filename;
  }

  /**
   * Exports a multi-page document (e.g. Berita Acara with photo attachments) to A4 PDF.
   */
  static async exportMultiPagePDF(
    elements: HTMLElement[] | NodeListOf<HTMLElement>,
    filename: string
  ): Promise<string> {
    const list = Array.from(elements);
    if (list.length === 0) {
      throw new Error('Tidak ada halaman dokumen yang dapat diekspor ke PDF.');
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < list.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }
      const canvas = await this.renderElementToCanvas(list[i]);
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    pdf.save(filename);
    return filename;
  }

  /**
   * Generates and downloads an A4 PDF document matching the on-screen preview.
   * Backwards compatible with existing RFO export calls.
   */
  static async exportToPDF(options: PDFExportOptions): Promise<string> {
    const { elementId, element: directElement, rfoDate, rootCause } = options;
    const element =
      directElement ||
      (typeof document !== 'undefined' && elementId
        ? document.getElementById(elementId)
        : null);

    if (!element) {
      throw new Error(`Elemen dokumen ${elementId ? `#${elementId}` : ''} tidak ditemukan.`);
    }

    const filename = generateRFOFileName(rfoDate, rootCause);
    return this.exportSinglePagePDF(element, filename);
  }

  /**
   * Trigger native browser print dialog configured for A4
   */
  static printDocument(): void {
    window.print();
  }
}
