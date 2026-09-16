import {
  ATS_TEMPLATE_ALLOWED_MIMES,
  ATS_TEMPLATE_KIND,
  ATS_TEMPLATE_MIME,
  type AllowedAtsTemplateMime,
  type AtsTemplateKind,
} from './ats-templates.constants';

const DOCX_ENTRY = Buffer.from('word/document.xml');

export function looksLikePdf(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  );
}

export function looksLikeDocx(buffer: Buffer): boolean {
  if (buffer.length < 4 || buffer.subarray(0, 2).toString('ascii') !== 'PK') {
    return false;
  }
  return buffer.includes(DOCX_ENTRY);
}

export function resolveAtsTemplateMime(
  kind: AtsTemplateKind,
  file: { mimetype?: string; originalname?: string; buffer: Buffer },
): AllowedAtsTemplateMime | null {
  const allowed = ATS_TEMPLATE_ALLOWED_MIMES[kind];
  const byContent = detectMimeFromContent(file.buffer);
  if (byContent && allowed.includes(byContent)) {
    return byContent;
  }

  const hinted = hintMime(file.mimetype, file.originalname);
  if (hinted && allowed.includes(hinted)) {
    if (hinted === ATS_TEMPLATE_MIME.DOCX && !looksLikeDocx(file.buffer)) {
      return null;
    }
    if (hinted === ATS_TEMPLATE_MIME.PDF && !looksLikePdf(file.buffer)) {
      return null;
    }
    return hinted;
  }

  if (kind === ATS_TEMPLATE_KIND.OFFER_LETTER && looksLikePdf(file.buffer)) {
    return null;
  }
  return null;
}

function detectMimeFromContent(buffer: Buffer): AllowedAtsTemplateMime | null {
  if (looksLikePdf(buffer)) return ATS_TEMPLATE_MIME.PDF;
  if (looksLikeDocx(buffer)) return ATS_TEMPLATE_MIME.DOCX;
  return null;
}

function hintMime(
  mimetype?: string,
  originalName?: string,
): AllowedAtsTemplateMime | null {
  const mime = (mimetype ?? '').toLowerCase();
  const name = (originalName ?? '').toLowerCase();
  if (mime === ATS_TEMPLATE_MIME.PDF || name.endsWith('.pdf')) {
    return ATS_TEMPLATE_MIME.PDF;
  }
  if (mime === ATS_TEMPLATE_MIME.DOCX || name.endsWith('.docx')) {
    return ATS_TEMPLATE_MIME.DOCX;
  }
  return null;
}
