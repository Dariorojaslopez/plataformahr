function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encoder() {
  return new TextEncoder();
}

/**
 * Minimal PDF 1.4 wrapping a JPEG image. No third-party PDF library.
 */
export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pageW = Math.max(1, Math.round(width));
  const pageH = Math.max(1, Math.round(height));
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const encode = encoder();

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Info = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(width)} /Height ${Math.round(height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`;
  const obj4End = "\nendstream\nendobj\n";
  const obj5 = `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`;

  const chunks: Uint8Array[] = [encode.encode(header)];
  const offsets = [0];
  let cursor = header.length;

  function pushAscii(text: string) {
    offsets.push(cursor);
    const bytes = encode.encode(text);
    chunks.push(bytes);
    cursor += bytes.length;
  }

  pushAscii(obj1);
  pushAscii(obj2);
  pushAscii(obj3);
  offsets.push(cursor);
  const info = encode.encode(obj4Info);
  chunks.push(info);
  cursor += info.length;
  chunks.push(jpeg);
  cursor += jpeg.length;
  const end = encode.encode(obj4End);
  chunks.push(end);
  cursor += end.length;
  pushAscii(obj5);

  const xrefStart = cursor;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(encode.encode(xref));
  chunks.push(encode.encode(trailer));
  return concatBytes(chunks);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.width);
      canvas.height = Math.max(1, image.height);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas is not available"));
        return;
      }
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url);
        if (!png) {
          reject(new Error("PNG export failed"));
          return;
        }
        resolve(png);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render SVG"));
    };
    image.src = url;
  });
}

export function canvasJpegBytes(
  svg: string,
): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.width);
      canvas.height = Math.max(1, image.height);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas is not available"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob(
        async (jpegBlob) => {
          URL.revokeObjectURL(url);
          if (!jpegBlob) {
            reject(new Error("JPEG export failed"));
            return;
          }
          const buffer = new Uint8Array(await jpegBlob.arrayBuffer());
          resolve({
            jpeg: buffer,
            width: canvas.width,
            height: canvas.height,
          });
        },
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render SVG"));
    };
    image.src = url;
  });
}
