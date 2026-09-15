/** Keep in sync with API `LOGO_MAX_BYTES` (10 MiB). */
export const COMPANY_LOGO_MAX_BYTES = 10_485_760;

/**
 * Stay under common reverse-proxy defaults (`client_max_body_size 1m`)
 * including multipart overhead.
 */
export const COMPANY_LOGO_UPLOAD_SAFE_BYTES = 500_000;

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
 * Always normalize logos before upload so 413 from reverse proxies is avoided.
 */
export async function prepareCompanyLogoForUpload(file: File): Promise<File> {
  const validationError = validateCompanyLogoFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const image = await loadImageElement(file);
  let scaled = scaleLogoDimensions(image.naturalWidth, image.naturalHeight);
  const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

  for (let attempt = 0; attempt < 3; attempt += 1) {
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

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob.size <= COMPANY_LOGO_UPLOAD_SAFE_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
        return new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }

    // Still too heavy: shrink further and retry.
    scaled = {
      width: Math.max(1, Math.round(scaled.width * 0.75)),
      height: Math.max(1, Math.round(scaled.height * 0.75)),
    };
  }

  throw new Error(
    "No se pudo optimizar el logo lo suficiente. Prueba con una imagen más simple.",
  );
}
