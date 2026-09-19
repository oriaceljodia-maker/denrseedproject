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

/** Format an inventory quantity without inventing a unit or showing trailing zeros. */
export function formatNumber(value, maximumFractionDigits = 3) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(quantity);
}

export function formatQuantity(value, unit = '') {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`;
}

/** Keep grams, kilograms, pieces, and packs separate in summaries. */
export function formatUnitTotals(items, valueGetter = item => item.quantity, unitGetter = item => item.unit) {
  const totals = new Map();
  items.forEach(item => {
    const unit = unitGetter(item) || 'units';
    totals.set(unit, (totals.get(unit) || 0) + (Number(valueGetter(item)) || 0));
  });
  return totals.size ? [...totals.entries()].map(([unit, value]) => formatQuantity(value, unit)).join(' · ') : '0';
}
