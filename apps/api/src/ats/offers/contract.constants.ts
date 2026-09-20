import {
  OFFER_LETTER_MIME,
  OFFER_SIGN_IMAGE_EXTENSION_BY_MIME,
  OFFER_SIGN_IMAGE_FIELD_NAME,
  OFFER_SIGN_IMAGE_MAX_BYTES,
  OFFER_SIGN_IMAGE_MIME,
  OFFER_SIGN_TOKEN_TTL_MS,
  type AllowedOfferLetterMime,
  type AllowedOfferSignImageMime,
} from './offer-letter.constants';

export const CONTRACT_FIELD_NAME = 'file';
export const CONTRACT_MAX_BYTES = 10 * 1024 * 1024;
export const CONTRACT_MIME = OFFER_LETTER_MIME;
export type AllowedContractMime = AllowedOfferLetterMime;
export const CONTRACT_EXTENSION_BY_MIME = {
  [CONTRACT_MIME.PDF]: 'pdf',
  [CONTRACT_MIME.DOCX]: 'docx',
} as const;

export const CONTRACT_SIGNED_FILE_NAME_PATTERN =
  /^contract-(signed|signimg|candsigned)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx|png|jpe?g|webp|html)$/;

export const CONTRACT_SIGN_IMAGE_FIELD_NAME = OFFER_SIGN_IMAGE_FIELD_NAME;
export const CONTRACT_SIGN_IMAGE_MAX_BYTES = OFFER_SIGN_IMAGE_MAX_BYTES;
export const CONTRACT_SIGN_TOKEN_TTL_MS = OFFER_SIGN_TOKEN_TTL_MS;
export const CONTRACT_SIGN_IMAGE_MIME = OFFER_SIGN_IMAGE_MIME;
export type AllowedContractSignImageMime = AllowedOfferSignImageMime;
export const CONTRACT_SIGN_IMAGE_EXTENSION_BY_MIME =
  OFFER_SIGN_IMAGE_EXTENSION_BY_MIME;

export const CONTRACT_ERRORS = {
  MISSING: 'Adjunta el contrato diligenciado (PDF o DOCX).',
  TYPE: 'El contrato debe ser PDF o DOCX.',
  SIZE: 'El contrato supera el tamaño máximo (10 MB).',
  EMPTY: 'El archivo está vacío.',
  TEMPLATE_NOT_FOUND: 'No hay plantilla de contrato cargada en la compañía.',
  SIGNED_NOT_FOUND: 'No hay contrato diligenciado cargado.',
  STAGE:
    'Solo puedes cargar el contrato cuando el candidato está en A Contratar.',
  CANDIDATE_EMAIL: 'El candidato no tiene un correo válido.',
  SIGN_TOKEN: 'Este enlace de firma no es válido o ya venció.',
  SIGN_ALREADY: 'Este contrato ya fue firmado.',
  SIGN_ACCEPT: 'Debes aceptar el contrato para firmarlo.',
  SIGN_IMAGE: 'Adjunta una imagen de tu firma (PNG, JPEG o WebP).',
  SIGN_IMAGE_TYPE: 'La firma debe ser PNG, JPEG o WebP.',
  SIGN_IMAGE_SIZE: 'La imagen de firma supera el tamaño máximo (5 MB).',
} as const;
