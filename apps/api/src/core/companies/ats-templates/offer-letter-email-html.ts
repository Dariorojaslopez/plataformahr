export const OFFER_LETTER_EMAIL_SUBJECT_MAX = 200;
export const OFFER_LETTER_EMAIL_BODY_MAX = 800_000;

const DANGEROUS_BLOCKS =
  /<(script|iframe|object|embed|form|style|svg|math|video|audio|applet|frameset)\b[^>]*>[\s\S]*?<\/\1>/gi;
const DANGEROUS_TAGS =
  /<\/?(?:script|iframe|object|embed|form|link|meta|svg|math|video|audio|source|style|base|applet|frame|frameset)\b[^>]*>/gi;

export function isBlankOfferLetterEmailHtml(html: string): boolean {
  const hasImage = /<img\b/i.test(html);
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !hasImage && text.length === 0;
}

export function sanitizeOfferLetterEmailHtml(html: string): string {
  let next = html.replace(DANGEROUS_BLOCKS, '').replace(DANGEROUS_TAGS, '');
  next = next.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  next = next.replace(
    /\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,
    '',
  );
  return next.replace(/<img\b[^>]*>/gi, (tag) => sanitizeImgTag(tag));
}

export function normalizeOfferLetterEmailHtml(
  html: string | null | undefined,
): string | null {
  if (html == null) return null;
  const sanitized = sanitizeOfferLetterEmailHtml(html).trim();
  if (!sanitized || isBlankOfferLetterEmailHtml(sanitized)) return null;
  return sanitized;
}

function sanitizeImgTag(tag: string): string {
  const srcMatch = tag.match(/\ssrc\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!srcMatch) return '';
  const src = srcMatch[2].trim();
  if (!isAllowedImgSrc(src)) return '';
  const altMatch = tag.match(/\salt\s*=\s*(["'])([\s\S]*?)\1/i);
  const alt = altMatch ? altMatch[2].replace(/[<>"]/g, '') : '';
  const escapedSrc = src.replace(/"/g, '%22');
  return `<img src="${escapedSrc}" alt="${alt}" />`;
}

function isAllowedImgSrc(src: string): boolean {
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) return true;
  if (/^https:\/\//i.test(src)) return true;
  return false;
}
