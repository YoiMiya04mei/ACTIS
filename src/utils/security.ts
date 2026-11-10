/**
 * Security and sanitization utilities to prevent XSS and malformed input.
 */

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanWhitespace(input: string | null | undefined): string {
  if (!input) return '';
  return input.trim();
}

export function validateRequiredText(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().length > 0;
}
