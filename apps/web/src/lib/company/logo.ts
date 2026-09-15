/** Keep in sync with API `LOGO_MAX_BYTES` (10 MiB). */
export const COMPANY_LOGO_MAX_BYTES = 10_485_760;

/** Keep under common reverse-proxy defaults (often 1m) with multipart overhead. */
export const COMPANY_LOGO_UPLOAD_SAFE_BYTES = 900_000;

/** Keep in sync with API `LOGO_MAX_DIMENSION`. */
export const COMPANY_LOGO_MAX_DIMENSION = 2048;

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

export function scaleLogoDimensions(
  width: number,
  height: number,
  maxDimension: number = COMPANY_LOGO_MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen del logo."));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo optimizar el logo."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Resize/compress large logos so uploads survive reverse-proxy body limits.
 * Small valid files are returned unchanged.
 */
export async function prepareCompanyLogoForUpload(file: File): Promise<File> {
  const validationError = validateCompanyLogoFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const image = await loadImageElement(file);
  const scaled = scaleLogoDimensions(image.naturalWidth, image.naturalHeight);
  const needsResize =
    scaled.width !== image.naturalWidth ||
    scaled.height !== image.naturalHeight;
  const needsCompress = file.size > COMPANY_LOGO_UPLOAD_SAFE_BYTES;

  if (!needsResize && !needsCompress) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar el logo en este navegador.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, scaled.width, scaled.height);

  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
  let best: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    best = blob;
    if (blob.size <= COMPANY_LOGO_UPLOAD_SAFE_BYTES) {
      break;
    }
  }

  if (!best) {
    throw new Error("No se pudo optimizar el logo.");
  }
  if (best.size > COMPANY_LOGO_MAX_BYTES) {
    throw new Error(
      "No se pudo dejar el logo por debajo de 10 MB. Usa una imagen más liviana.",
    );
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
  return new File([best], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
