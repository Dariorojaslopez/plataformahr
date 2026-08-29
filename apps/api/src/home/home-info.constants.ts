export const HOME_COMPANY_INFO_AUDIT = {
  UPDATED: 'HOME_COMPANY_INFO_UPDATED',
  MEDIA_REPLACED: 'HOME_COMPANY_INFO_MEDIA_REPLACED',
  MEDIA_REMOVED: 'HOME_COMPANY_INFO_MEDIA_REMOVED',
} as const;

export const HOME_COMPANY_INFO_ENTITY = 'CompanyHomeInfo';

export const HOME_INFO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const HOME_INFO_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const HOME_INFO_IMAGE_MAX_DIMENSION = 4096;
export const HOME_INFO_IMAGE_MIN_DIMENSION = 1;

export const HOME_INFO_FIELD_NAME = 'file';

export const HOME_INFO_MIME = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  MP4: 'video/mp4',
  WEBM: 'video/webm',
} as const;

export type AllowedHomeInfoMime =
  (typeof HOME_INFO_MIME)[keyof typeof HOME_INFO_MIME];

export const HOME_INFO_EXTENSION_BY_MIME: Record<AllowedHomeInfoMime, string> =
  {
    [HOME_INFO_MIME.PNG]: 'png',
    [HOME_INFO_MIME.JPEG]: 'jpg',
    [HOME_INFO_MIME.WEBP]: 'webp',
    [HOME_INFO_MIME.MP4]: 'mp4',
    [HOME_INFO_MIME.WEBM]: 'webm',
  };

export const HOME_INFO_FILE_NAME_PATTERN =
  /^info-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|mp4|webm)$/;
