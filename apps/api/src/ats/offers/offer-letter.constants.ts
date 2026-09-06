export const OFFER_LETTER_FIELD_NAME = 'file';
export const OFFER_LETTER_MAX_BYTES = 10 * 1024 * 1024;

export const OFFER_LETTER_MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

export type AllowedOfferLetterMime =
  (typeof OFFER_LETTER_MIME)[keyof typeof OFFER_LETTER_MIME];

export const OFFER_LETTER_EXTENSION_BY_MIME: Record<
  AllowedOfferLetterMime,
  'pdf' | 'docx'
> = {
  [OFFER_LETTER_MIME.PDF]: 'pdf',
  [OFFER_LETTER_MIME.DOCX]: 'docx',
};

export const OFFER_SIGNED_FILE_NAME_PATTERN =
  /^offer-signed-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$/;

export const OFFER_LETTER_ERRORS = {
  MISSING: 'Adjunta la carta oferta firmada (PDF o DOCX).',
  TYPE: 'La carta oferta debe ser PDF o DOCX.',
  SIZE: 'La carta oferta supera el tamaño máximo (10 MB).',
  EMPTY: 'El archivo está vacío.',
  TEMPLATE_NOT_FOUND:
    'No hay plantilla de carta oferta cargada en la compañía.',
  SIGNED_NOT_FOUND: 'No hay carta oferta firmada cargada.',
} as const;
