/**
 * Creates a clean URL and filesystem safe slug from a root cause string.
 * Limits length to around 40 characters without cutting words awkwardly if possible.
 */
export function slugifyRootCause(text: string, maxLength: number = 40): string {
  if (!text || text.trim() === '') {
    return 'General-Outage';
  }

  // Remove common punctuation and convert spaces/special chars to hyphens
  let cleaned = text
    .trim()
    // Remove characters like parentheses, quotes, punctuation
    .replace(/[^\w\s-]/g, '')
    // Replace consecutive spaces and underscores with single hyphen
    .replace(/[\s_]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Cut to maxLength and trim trailing hyphen
  let trimmed = cleaned.substring(0, maxLength);
  const lastHyphen = trimmed.lastIndexOf('-');
  if (lastHyphen > 15) {
    trimmed = trimmed.substring(0, lastHyphen);
  }

  return trimmed || 'Outage-Report';
}

/**
 * Generates the standardized PDF filename according to PT JDP rules:
 * Format: RFO_[YYYY-MM-DD]_[ROOT-CAUSE-SHORT].pdf
 * Example: RFO_2026-10-11_Microburst-MPLS.pdf
 */
export function generateRFOFileName(dateStr: string, rootCause: string): string {
  let datePart = 'YYYY-MM-DD';
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      datePart = `${year}-${month}-${day}`;
    } else {
      datePart = dateStr.substring(0, 10);
    }
  }

  const slug = slugifyRootCause(rootCause, 40);
  return `RFO_${datePart}_${slug}.pdf`;
}
