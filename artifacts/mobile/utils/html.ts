/**
 * HTML Escaping & Sanitization Utilities
 */

/**
 * Escapes &, <, >, ", ' and converts null or undefined into an empty string.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Image sources: allow only data:image/ or https:// URLs.
 * Drops anything else (returning an empty string).
 */
export function sanitizeImageUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}
