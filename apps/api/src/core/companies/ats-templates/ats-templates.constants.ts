export const ATS_TEMPLATE_FIELD_NAME = 'file';
export const ATS_TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;

export const ATS_TEMPLATE_KIND = {
  OFFER_LETTER: 'offer-letter',
  CONTRACT: 'contract',
} as const;

export type AtsTemplateKind =
  (typeof ATS_TEMPLATE_KIND)[keyof typeof ATS_TEMPLATE_KIND];

export const ATS_TEMPLATE_KIND_SLUG: Record<
  AtsTemplateKind,
  'offer' | 'contract'
> = {
  [ATS_TEMPLATE_KIND.OFFER_LETTER]: 'offer',
  [ATS_TEMPLATE_KIND.CONTRACT]: 'contract',
};

export const ATS_TEMPLATE_MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export type AllowedAtsTemplateMime =
  (typeof ATS_TEMPLATE_MIME)[keyof typeof ATS_TEMPLATE_MIME];

export const ATS_TEMPLATE_EXTENSION_BY_MIME: Record<
  AllowedAtsTemplateMime,
  'pdf' | 'docx'
> = {
  [ATS_TEMPLATE_MIME.PDF]: 'pdf',
  [ATS_TEMPLATE_MIME.DOCX]: 'docx',
};

export const ATS_TEMPLATE_FILE_NAME_PATTERN =
  /^ats-tmpl-(offer|contract)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$/;

export const ATS_TEMPLATES_AUDIT = {
  UPLOADED: 'ATS_DOCUMENT_TEMPLATE_UPLOADED',
  REMOVED: 'ATS_DOCUMENT_TEMPLATE_REMOVED',
} as const;

export const ATS_TEMPLATE_ERRORS = {
  MISSING: 'Adjunta la plantilla (PDF o DOCX).',
  TYPE: 'La plantilla debe ser PDF o DOCX.',
  SIZE: 'La plantilla supera el tamaño máximo (10 MB).',
  EMPTY: 'El archivo de la plantilla está vacío.',
  NOT_FOUND: 'No hay plantilla cargada.',
  INVALID_KIND: 'Tipo de plantilla no válido.',
} as const;

export function parseAtsTemplateKind(raw: string): AtsTemplateKind {
  if (
    raw === ATS_TEMPLATE_KIND.OFFER_LETTER ||
    raw === ATS_TEMPLATE_KIND.CONTRACT
  ) {
    return raw;
  }
  throw new Error(ATS_TEMPLATE_ERRORS.INVALID_KIND);
}
