import {
  detectAllowedLogoMime,
  readJpegDimensions,
  readPngDimensions,
  readWebpDimensions,
} from '../core/companies/branding/branding.image';
import {
  HOME_INFO_IMAGE_MAX_BYTES,
  HOME_INFO_IMAGE_MAX_DIMENSION,
  HOME_INFO_IMAGE_MIN_DIMENSION,
  HOME_INFO_MIME,
  HOME_INFO_VIDEO_MAX_BYTES,
  type AllowedHomeInfoMime,
} from './home-info.constants';

export type HomeInfoMediaKind = 'IMAGE' | 'VIDEO';

export type HomeInfoMediaInfo = {
  mime: AllowedHomeInfoMime;
  kind: HomeInfoMediaKind;
  width?: number;
  height?: number;
};

export type HomeInfoInspectResult =
  | { ok: true; info: HomeInfoMediaInfo }
  | { ok: false; reason: 'empty' | 'mime' | 'parse' | 'dimensions' | 'size' };

function detectVideoMime(buffer: Buffer): AllowedHomeInfoMime | null {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return HOME_INFO_MIME.WEBM;
  }
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return HOME_INFO_MIME.MP4;
  }
  return null;
}

export function detectAllowedHomeInfoMime(
  buffer: Buffer,
): AllowedHomeInfoMime | null {
  const image = detectAllowedLogoMime(buffer);
  if (image) return image;
  return detectVideoMime(buffer);
}

export function inspectHomeInfoBuffer(buffer: Buffer): HomeInfoInspectResult {
  if (!buffer.length) return { ok: false, reason: 'empty' };
  if (buffer.length > HOME_INFO_VIDEO_MAX_BYTES) {
    return { ok: false, reason: 'size' };
  }

  const mime = detectAllowedHomeInfoMime(buffer);
  if (!mime) return { ok: false, reason: 'mime' };

  if (
    mime === HOME_INFO_MIME.PNG ||
    mime === HOME_INFO_MIME.JPEG ||
    mime === HOME_INFO_MIME.WEBP
  ) {
    if (buffer.length > HOME_INFO_IMAGE_MAX_BYTES) {
      return { ok: false, reason: 'size' };
    }
    let size: { width: number; height: number } | null = null;
    if (mime === HOME_INFO_MIME.PNG) size = readPngDimensions(buffer);
    else if (mime === HOME_INFO_MIME.JPEG) size = readJpegDimensions(buffer);
    else size = readWebpDimensions(buffer);
    if (!size) return { ok: false, reason: 'parse' };
    if (
      size.width < HOME_INFO_IMAGE_MIN_DIMENSION ||
      size.height < HOME_INFO_IMAGE_MIN_DIMENSION ||
      size.width > HOME_INFO_IMAGE_MAX_DIMENSION ||
      size.height > HOME_INFO_IMAGE_MAX_DIMENSION
    ) {
      return { ok: false, reason: 'dimensions' };
    }
    return {
      ok: true,
      info: {
        mime,
        kind: 'IMAGE',
        width: size.width,
        height: size.height,
      },
    };
  }

  return {
    ok: true,
    info: { mime, kind: 'VIDEO' },
  };
}
