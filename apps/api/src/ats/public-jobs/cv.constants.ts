import { COMPANY_ID_PATTERN } from '../../core/companies/branding/branding.constants';

export const CV_FIELD_NAME = 'cv';
export const CV_MAX_BYTES = 5 * 1024 * 1024;

export const CV_MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
} as const;

export type AllowedCvMime = (typeof CV_MIME)[keyof typeof CV_MIME];

export const CV_EXTENSION_BY_MIME: Record<AllowedCvMime, 'pdf' | 'docx' | 'txt'> =
  {
    [CV_MIME.PDF]: 'pdf',
    [CV_MIME.DOCX]: 'docx',
    [CV_MIME.TXT]: 'txt',
  };

export const CV_FILE_NAME_PATTERN =
  /^cv-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx|txt)$/;

export { COMPANY_ID_PATTERN };

export const CV_ERRORS = {
  MISSING: 'Adjunta tu hoja de vida (PDF, DOCX o TXT).',
  TYPE: 'La hoja de vida debe ser PDF, DOCX o TXT.',
  SIZE: 'La hoja de vida supera el tamaño máximo (5 MB).',
  EMPTY: 'El archivo de la hoja de vida está vacío.',
  READ: 'No se pudo leer la hoja de vida.',
  NOT_FOUND: 'Este candidato no tiene una hoja de vida cargada.',
} as const;
