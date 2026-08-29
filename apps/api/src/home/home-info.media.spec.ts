import { inspectHomeInfoBuffer } from './home-info.media';
import {
  HOME_INFO_IMAGE_MAX_BYTES,
  HOME_INFO_MIME,
} from './home-info.constants';

/** 1×1 PNG */
const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function minimalMp4(): Buffer {
  const buffer = Buffer.alloc(12);
  buffer.write('ftyp', 4);
  buffer.write('isom', 8);
  return buffer;
}

describe('home info media inspection', () => {
  it('accepts PNG images', () => {
    expect(inspectHomeInfoBuffer(MIN_PNG)).toEqual({
      ok: true,
      info: {
        mime: HOME_INFO_MIME.PNG,
        kind: 'IMAGE',
        width: 1,
        height: 1,
      },
    });
  });

  it('accepts MP4 and WebM videos', () => {
    expect(inspectHomeInfoBuffer(minimalMp4())).toEqual({
      ok: true,
      info: { mime: HOME_INFO_MIME.MP4, kind: 'VIDEO' },
    });
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]);
    expect(inspectHomeInfoBuffer(webm)).toEqual({
      ok: true,
      info: { mime: HOME_INFO_MIME.WEBM, kind: 'VIDEO' },
    });
  });

  it('rejects SVG and plain text', () => {
    expect(
      inspectHomeInfoBuffer(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ),
    ).toEqual({ ok: false, reason: 'mime' });
    expect(inspectHomeInfoBuffer(Buffer.from('not-media'))).toEqual({
      ok: false,
      reason: 'mime',
    });
  });

  it('rejects images over the image byte limit', () => {
    const oversized = Buffer.concat([
      MIN_PNG,
      Buffer.alloc(HOME_INFO_IMAGE_MAX_BYTES),
    ]);
    expect(inspectHomeInfoBuffer(oversized)).toEqual({
      ok: false,
      reason: 'size',
    });
  });
});
