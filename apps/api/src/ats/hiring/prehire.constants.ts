import { COMPANY_ID_PATTERN } from '../../core/companies/branding/branding.constants';

export const PREHIRE_FIELD_NAME = 'file';
export const PREHIRE_MAX_BYTES = 10 * 1024 * 1024;

export const PREHIRE_MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  JPG: 'image/jpeg',
  PNG: 'image/png',
} as const;

export type AllowedPreHireMime =
  (typeof PREHIRE_MIME)[keyof typeof PREHIRE_MIME];

export const PREHIRE_EXTENSION_BY_MIME: Record<
  AllowedPreHireMime,
  'pdf' | 'docx' | 'jpg' | 'png'
> = {
  [PREHIRE_MIME.PDF]: 'pdf',
  [PREHIRE_MIME.DOCX]: 'docx',
  [PREHIRE_MIME.JPG]: 'jpg',
  [PREHIRE_MIME.PNG]: 'png',
};

export const PREHIRE_FILE_NAME_PATTERN =
  /^prehire-(security_study|medical_exam)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx|jpg|png)$/;

export { COMPANY_ID_PATTERN };

export const PREHIRE_ERRORS = {
  MISSING: 'Adjunta el documento (PDF, DOCX, JPG o PNG).',
  TYPE: 'El documento debe ser PDF, DOCX, JPG o PNG.',
  SIZE: 'El documento supera el tamaño máximo (10 MB).',
  EMPTY: 'El archivo está vacío.',
  NOT_FOUND: 'No hay documento cargado para este requisito.',
  INVALID_KIND: 'Tipo de documento no válido.',
} as const;

export function isPreHireClear(status: string): boolean {
  return status === 'APPROVED' || status === 'NOT_REQUIRED';
}
