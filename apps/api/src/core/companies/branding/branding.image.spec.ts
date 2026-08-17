import {
  detectAllowedLogoMime,
  inspectLogoBuffer,
  readPngDimensions,
} from './branding.image';
import { LOGO_MAX_BYTES, LOGO_MIME } from './branding.constants';

/** 1×1 PNG */
const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('logo image inspection', () => {
  it('detects PNG magic bytes and dimensions', () => {
    expect(detectAllowedLogoMime(MIN_PNG)).toBe(LOGO_MIME.PNG);
    expect(readPngDimensions(MIN_PNG)).toEqual({ width: 1, height: 1 });
    expect(inspectLogoBuffer(MIN_PNG)).toEqual({
      ok: true,
      info: { mime: LOGO_MIME.PNG, width: 1, height: 1 },
    });
  });

  it('rejects SVG and text as invalid MIME', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(inspectLogoBuffer(svg)).toEqual({ ok: false, reason: 'mime' });
    expect(inspectLogoBuffer(Buffer.from('not-an-image'))).toEqual({
      ok: false,
      reason: 'mime',
    });
  });

  it('rejects buffers over the byte limit', () => {
    const oversized = Buffer.concat([MIN_PNG, Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(inspectLogoBuffer(oversized)).toEqual({ ok: false, reason: 'size' });
  });
});
