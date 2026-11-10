import * as pdfjsLib from 'pdfjs-dist';

// Configure worker URL for browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {
    // fallback
  }
}

export interface PdfExtractionResult {
  backgroundUrl: string; // Full A4 page rendered as PNG Data URL
  headerImageUrl?: string; // Top header portion (top ~18%)
  footerImageUrl?: string; // Bottom footer portion (bottom ~10%)
  extractedText?: string;
  extractedInfo?: {
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
  };
}

/**
 * Extracts and renders the first page of a PDF document as high-resolution images
 * for the document background, top header, and bottom footer.
 */
export async function extractFromPdf(file: File): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  if (pdfDoc.numPages < 1) {
    throw new Error('Dokumen PDF tidak memiliki halaman.');
  }

  // Render Page 1 at high DPI (scale = 2.0 for sharp quality on A4)
  const page = await pdfDoc.getPage(1);
  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const canvasContext = canvas.getContext('2d');

  if (!canvasContext) {
    throw new Error('Gagal menginisialisasi canvas untuk rendering PDF.');
  }

  canvasContext.imageSmoothingEnabled = true;
  canvasContext.imageSmoothingQuality = 'high';

  await page.render({
    canvas,
    canvasContext,
    viewport,
  }).promise;

  // 1. Full Page Background Data URL
  const backgroundUrl = canvas.toDataURL('image/png', 0.95);

  // 2. Slice Top Header Banner (top ~19% of page height)
  const headerHeight = Math.round(canvas.height * 0.19);
  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = canvas.width;
  headerCanvas.height = headerHeight;
  const headerCtx = headerCanvas.getContext('2d');
  let headerImageUrl: string | undefined = undefined;

  if (headerCtx) {
    headerCtx.imageSmoothingEnabled = true;
    headerCtx.imageSmoothingQuality = 'high';
    headerCtx.drawImage(
      canvas,
      0, 0, canvas.width, headerHeight,
      0, 0, canvas.width, headerHeight
    );
    headerImageUrl = headerCanvas.toDataURL('image/png', 0.95);
  }

  // 3. Slice Bottom Footer (bottom ~10% of page height)
  const footerHeight = Math.round(canvas.height * 0.10);
  const footerStartY = canvas.height - footerHeight;
  const footerCanvas = document.createElement('canvas');
  footerCanvas.width = canvas.width;
  footerCanvas.height = footerHeight;
  const footerCtx = footerCanvas.getContext('2d');
  let footerImageUrl: string | undefined = undefined;

  if (footerCtx) {
    footerCtx.imageSmoothingEnabled = true;
    footerCtx.imageSmoothingQuality = 'high';
    footerCtx.drawImage(
      canvas,
      0, footerStartY, canvas.width, footerHeight,
      0, 0, canvas.width, footerHeight
    );
    footerImageUrl = footerCanvas.toDataURL('image/png', 0.95);
  }

  // 4. Extract text from page 1
  let text = '';
  try {
    const textContent = await page.getTextContent();
    text = (textContent.items as Array<Record<string, unknown>>)
      .map((item) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');
  } catch {
    // Ignore text extraction errors
  }

  const extractedInfo = parseCompanyInfoFromText(text);

  return {
    backgroundUrl,
    headerImageUrl,
    footerImageUrl,
    extractedText: text,
    extractedInfo,
  };
}

function parseCompanyInfoFromText(text: string) {
  const info: {
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
  } = {};

  const ptMatch = text.match(/\b(PT\.?\s+[A-Z\s]{4,40})/i);
  if (ptMatch) {
    info.companyName = ptMatch[1].trim();
  }

  const addressMatch = text.match(/(Jl\.?\s+[^\n\r]+?(?:Jawa\s+Barat|\d{5}|Sukabumi|[A-Z][a-z]+))/i);
  if (addressMatch) {
    info.companyAddress = addressMatch[1].trim();
  }

  const phoneMatch = text.match(/(?:Telp|Telepon|Phone|WA|WhatsApp)\s*[:.]?\s*(\+?[\d\s-]{8,20})/i);
  if (phoneMatch) {
    info.companyPhone = phoneMatch[1].trim();
  }

  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    info.companyEmail = emailMatch[1].trim();
  }

  const webMatch = text.match(/(?:Web|Website)\s*[:.]?\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);
  if (webMatch) {
    info.companyWebsite = webMatch[1].trim();
  }

  return Object.keys(info).length > 0 ? info : undefined;
}
