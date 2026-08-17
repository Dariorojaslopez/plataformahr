export const COMPANY_BRANDING_AUDIT = {
  UPDATED: 'COMPANY_BRANDING_UPDATED',
  LOGO_REPLACED: 'COMPANY_LOGO_REPLACED',
  LOGO_REMOVED: 'COMPANY_LOGO_REMOVED',
} as const;

export const BRANDING_ENTITY = 'Company';

/** Official Plataforma HR accent. Companies without branding inherit this. */
export const PLATFORM_BRAND_PRIMARY = '#0F5C5A';

export const BRAND_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export const LOGO_MAX_BYTES = 1_048_576;
export const LOGO_MAX_DIMENSION = 2048;
export const LOGO_MIN_DIMENSION = 1;

export const LOGO_MIME = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
} as const;

export type AllowedLogoMime = (typeof LOGO_MIME)[keyof typeof LOGO_MIME];

export const LOGO_EXTENSION_BY_MIME: Record<AllowedLogoMime, string> = {
  [LOGO_MIME.PNG]: 'png',
  [LOGO_MIME.JPEG]: 'jpg',
  [LOGO_MIME.WEBP]: 'webp',
};

export const LOGO_FIELD_NAME = 'file';

export const DEFAULT_COMPANY_UPLOADS_DIR = 'var/company-uploads';
export const PROD_COMPANY_UPLOADS_DIR = '/data/company-uploads';

export const COMPANY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LOGO_FILE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;
