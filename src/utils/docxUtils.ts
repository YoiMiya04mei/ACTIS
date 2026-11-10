import JSZip from 'jszip';

export interface DocxExtractionResult {
  headerImageUrl?: string;
  images: Array<{ name: string; dataUrl: string; width?: number; height?: number }>;
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
 * Parses a Microsoft Word (.docx) file to extract embedded images (e.g., kop surat banner, logo)
 * and company contact text from headers or documents.
 */
export async function extractFromDocx(file: File): Promise<DocxExtractionResult> {
  const zip = await JSZip.loadAsync(file);

  const imageEntries = Object.keys(zip.files).filter((path) =>
    path.startsWith('word/media/') &&
    !zip.files[path].dir &&
    /\.(png|jpe?g|webp|svg|gif)$/i.test(path)
  );

  const images: Array<{ name: string; dataUrl: string; width?: number; height?: number }> = [];

  for (const entryPath of imageEntries) {
    const entry = zip.file(entryPath);
    if (!entry) continue;

    const ext = entryPath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'webp'
        ? 'image/webp'
        : 'image/png';

    const base64 = await entry.async('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Get image dimensions to determine banner vs icon
    const dims = await getImageDimensions(dataUrl).catch(() => undefined);
    images.push({
      name: entryPath.replace('word/media/', ''),
      dataUrl,
      width: dims?.width,
      height: dims?.height,
    });
  }

  // Find the best candidate for kop surat banner:
  // Prefer wide landscape aspect ratio, or largest area image
  let headerImageUrl: string | undefined = undefined;
  if (images.length > 0) {
    // Sort by aspect ratio (width / height) and area
    const sorted = [...images].sort((a, b) => {
      const ratioA = (a.width || 1) / (a.height || 1);
      const ratioB = (b.width || 1) / (b.height || 1);
      // If one has banner-like aspect ratio (>= 2.5), prioritize it
      if (ratioA >= 2.5 && ratioB < 2.5) return -1;
      if (ratioB >= 2.5 && ratioA < 2.5) return 1;
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      return areaB - areaA;
    });

    headerImageUrl = sorted[0].dataUrl;
  }

  // Also extract text from word/header1.xml, header2.xml, and document.xml
  const xmlFiles = ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/document.xml'];
  let combinedXmlText = '';

  for (const xmlPath of xmlFiles) {
    const xmlEntry = zip.file(xmlPath);
    if (xmlEntry) {
      try {
        const text = await xmlEntry.async('text');
        combinedXmlText += ' ' + extractTextFromXml(text);
      } catch {
        // ignore xml read errors
      }
    }
  }

  const extractedInfo = parseCompanyInfoFromText(combinedXmlText);

  return {
    headerImageUrl,
    images,
    extractedText: combinedXmlText.trim(),
    extractedInfo,
  };
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Cannot read image dimensions'));
    img.src = dataUrl;
  });
}

function extractTextFromXml(xml: string): string {
  // Strip all XML tags and decode common entities
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCompanyInfoFromText(text: string) {
  const info: {
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
  } = {};

  // Check for PT Jembatan Data Pangrango or other PT names
  const ptMatch = text.match(/\b(PT\.?\s+[A-Z\s]{4,40})/i);
  if (ptMatch) {
    info.companyName = ptMatch[1].trim();
  }

  // Check for Address: Jl. or Jalan
  const addressMatch = text.match(/(Jl\.?\s+[^\n\r]+?(?:Jawa\s+Barat|\d{5}|Sukabumi|[A-Z][a-z]+))/i);
  if (addressMatch) {
    info.companyAddress = addressMatch[1].trim();
  }

  // Check for Telp:
  const phoneMatch = text.match(/(?:Telp|Telepon|Phone|WA|WhatsApp)\s*[:.]?\s*(\+?[\d\s-]{8,20})/i);
  if (phoneMatch) {
    info.companyPhone = phoneMatch[1].trim();
  }

  // Check for Email:
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    info.companyEmail = emailMatch[1].trim();
  }

  // Check for Web:
  const webMatch = text.match(/(?:Web|Website)\s*[:.]?\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);
  if (webMatch) {
    info.companyWebsite = webMatch[1].trim();
  }

  return Object.keys(info).length > 0 ? info : undefined;
}
