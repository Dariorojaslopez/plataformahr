/** Keep in sync with API `LOGO_MAX_BYTES` (10 MiB). */
export const COMPANY_LOGO_MAX_BYTES = 10_485_760;

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function validateCompanyLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return "El logo debe ser PNG, JPEG o WebP.";
  }
  if (file.size > COMPANY_LOGO_MAX_BYTES) {
    return "El logo no puede superar 10 MB. Comprime la imagen e inténtalo de nuevo.";
  }
  return null;
}
