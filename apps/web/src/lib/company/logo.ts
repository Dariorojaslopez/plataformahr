/** Keep in sync with API `LOGO_MAX_BYTES` (1 MiB). */
export const COMPANY_LOGO_MAX_BYTES = 1_048_576;

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
    return "El logo no puede superar 1 MB. Comprime la imagen e inténtalo de nuevo.";
  }
  return null;
}
