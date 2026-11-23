import { PDFService } from "@/services/pdfService";
import type { EmailAttachmentPayload } from "@/components/tools/SendDocumentEmailModal";

export interface CapturePdfAttachmentOptions {
  /** Selector matching multiple A4 pages inside an active/offscreen wrapper */
  multiPageSelector?: string;
  /** Single element ID if selector finds 0 or isn't multi-page */
  elementId?: string;
  /** Target attachment filename (e.g. RFO_...pdf) */
  filename: string;
}

/**
 * Shared client helper to capture any rendered ACTIS PaperDocument (single or multi-page)
 * into a compact Base64 A4 PDF attachment payload for Email Gateway.
 */
export async function captureDocumentPdfAttachment(
  options: CapturePdfAttachmentOptions
): Promise<EmailAttachmentPayload> {
  // Let React paint any freshly mounted offscreen paper container cleanly
  await new Promise((resolve) => setTimeout(resolve, 120));

  let elements: HTMLElement[] = [];
  if (options.multiPageSelector) {
    const matched = document.querySelectorAll<HTMLElement>(options.multiPageSelector);
    if (matched.length > 0) {
      elements = Array.from(matched);
    }
  }

  if (elements.length === 0 && options.elementId) {
    const el = document.getElementById(options.elementId);
    if (el) {
      elements = [el];
    }
  }

  if (elements.length === 0) {
    throw new Error(
      "Elemen pratinjau dokumen PDF belum siap. Silakan coba kirim ulang."
    );
  }

  const contentBase64 = await PDFService.buildPDFBase64(elements, 0.9);
  return {
    filename: options.filename,
    contentBase64,
    contentType: "application/pdf",
  };
}
