import {
  LOGO_MAX_DIMENSION,
  LOGO_MAX_BYTES,
  LOGO_MIN_DIMENSION,
  LOGO_MIME,
  type AllowedLogoMime,
} from './branding.constants';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type LogoImageInfo = {
  mime: AllowedLogoMime;
  width: number;
  height: number;
};

export function detectAllowedLogoMime(buffer: Buffer): AllowedLogoMime | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(PNG_SIG)) return LOGO_MIME.PNG;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return LOGO_MIME.JPEG;
  }
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return LOGO_MIME.WEBP;
  }
  return null;
}

export function readPngDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export function readJpegDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= buffer.length) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (
      (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) &&
      offset + 8 < buffer.length
    ) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

export function readWebpDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 16) return null;
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const type = buffer.toString('ascii', 12, 16);
  if (type === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
    return { width, height };
  }
  if (type === 'VP8 ' && buffer.length >= 30) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    if (width === 0 || height === 0) return null;
    return { width, height };
  }
  if (type === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return null;
}

export type LogoInspectResult =
  | { ok: true; info: LogoImageInfo }
  | { ok: false; reason: 'empty' | 'mime' | 'parse' | 'dimensions' | 'size' };

export function inspectLogoBuffer(buffer: Buffer): LogoInspectResult {
  if (!buffer.length) return { ok: false, reason: 'empty' };
  if (buffer.length > LOGO_MAX_BYTES) return { ok: false, reason: 'size' };
  const mime = detectAllowedLogoMime(buffer);
  if (!mime) return { ok: false, reason: 'mime' };
  let size: { width: number; height: number } | null = null;
  if (mime === LOGO_MIME.PNG) size = readPngDimensions(buffer);
  else if (mime === LOGO_MIME.JPEG) size = readJpegDimensions(buffer);
  else size = readWebpDimensions(buffer);
  if (!size) return { ok: false, reason: 'parse' };
  if (
    size.width < LOGO_MIN_DIMENSION ||
    size.height < LOGO_MIN_DIMENSION ||
    size.width > LOGO_MAX_DIMENSION ||
    size.height > LOGO_MAX_DIMENSION
  ) {
    return { ok: false, reason: 'dimensions' };
  }
  return { ok: true, info: { mime, width: size.width, height: size.height } };
}
