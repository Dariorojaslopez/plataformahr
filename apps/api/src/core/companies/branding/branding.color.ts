import { BRAND_COLOR_PATTERN } from './branding.constants';

/**
 * Accept only a complete #RRGGBB hex. Reject CSS, urls, variables, and shorthand.
 */
export function normalizeBrandPrimaryColor(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length !== 7) return null;
  const upper = trimmed.toUpperCase();
  if (!BRAND_COLOR_PATTERN.test(upper)) return null;
  return upper;
}

export function isBrandPrimaryColor(raw: string): boolean {
  return normalizeBrandPrimaryColor(raw) !== null;
}
