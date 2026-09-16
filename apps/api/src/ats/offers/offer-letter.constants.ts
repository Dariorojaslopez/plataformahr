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
  /^offer-(signed|signimg|candsigned)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx|png|jpe?g|webp|html)$/;

export const OFFER_SIGN_IMAGE_FIELD_NAME = 'file';
export const OFFER_SIGN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const OFFER_SIGN_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const OFFER_SIGN_IMAGE_MIME = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
} as const;

export type AllowedOfferSignImageMime =
  (typeof OFFER_SIGN_IMAGE_MIME)[keyof typeof OFFER_SIGN_IMAGE_MIME];

export const OFFER_SIGN_IMAGE_EXTENSION_BY_MIME: Record<
  AllowedOfferSignImageMime,
  'png' | 'jpg' | 'webp'
> = {
  [OFFER_SIGN_IMAGE_MIME.PNG]: 'png',
  [OFFER_SIGN_IMAGE_MIME.JPEG]: 'jpg',
  [OFFER_SIGN_IMAGE_MIME.WEBP]: 'webp',
};

export const OFFER_LETTER_ERRORS = {
  MISSING: 'Adjunta la carta oferta diligenciada (PDF o DOCX).',
  TYPE: 'La carta oferta debe ser PDF o DOCX.',
  SIZE: 'La carta oferta supera el tamaño máximo (10 MB).',
  EMPTY: 'El archivo está vacío.',
  TEMPLATE_NOT_FOUND:
    'No hay plantilla de carta oferta cargada en la compañía.',
  SIGNED_NOT_FOUND: 'No hay carta oferta diligenciada cargada.',
  STAGE: 'Solo puedes cargar la carta oferta en Evaluación o Finalistas.',
  EMAIL_NOT_CONFIGURED:
    'Configura el asunto y el cuerpo del correo de carta oferta en ATS.',
  CANDIDATE_EMAIL: 'El candidato no tiene un correo válido.',
  SIGN_TOKEN: 'Este enlace de firma no es válido o ya venció.',
  SIGN_ALREADY: 'Esta carta oferta ya fue firmada.',
  SIGN_ACCEPT: 'Debes aceptar la carta oferta para firmarla.',
  SIGN_IMAGE: 'Adjunta una imagen de tu firma (PNG, JPEG o WebP).',
  SIGN_IMAGE_TYPE: 'La firma debe ser PNG, JPEG o WebP.',
  SIGN_IMAGE_SIZE: 'La imagen de firma supera el tamaño máximo (5 MB).',
  PREMIUM_SIGNATURE:
    'La firma digital no está activa para esta compañía.',
} as const;
