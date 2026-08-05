/**
 * Escape a string for safe interpolation into HTML template literals.
 * Prevents XSS and HTML breakage from user-supplied content.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a value for use inside an HTML attribute (e.g. data-* attributes).
 */
export function escapeAttr(value) {
  return escapeHtml(value);
}
