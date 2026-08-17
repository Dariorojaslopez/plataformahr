import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertSafeLogoFileName,
  buildLogoFileName,
  resolveCompanyUploadsDir,
  resolveLogoAbsolutePath,
  writeCompanyLogoFile,
} from './branding.storage';
import { LOGO_MIME } from './branding.constants';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

describe('branding storage', () => {
  it('requires COMPANY_UPLOADS_DIR in production', () => {
    expect(() => resolveCompanyUploadsDir({ NODE_ENV: 'production' })).toThrow(
      /COMPANY_UPLOADS_DIR/,
    );
  });

  it('uses the configured directory, not an ephemeral default, when set', () => {
    const dir = resolveCompanyUploadsDir({
      NODE_ENV: 'production',
      COMPANY_UPLOADS_DIR: '/data/company-uploads',
    });
    expect(dir).toBe('/data/company-uploads');
    expect(dir).not.toContain('tmp');
  });

  it('rejects path traversal in file names', () => {
    expect(() => assertSafeLogoFileName('../secret.png')).toThrow();
    expect(() =>
      assertSafeLogoFileName(`${COMPANY_ID}/../../etc/passwd`),
    ).toThrow();
    expect(() =>
      resolveLogoAbsolutePath('/data/company-uploads', COMPANY_ID, '../x.png'),
    ).toThrow();
  });

  it('writes under the company directory with a server-generated name', async () => {
    const root = mkdtempSync(join(tmpdir(), 'branding-storage-'));
    try {
      const fileName = buildLogoFileName(LOGO_MIME.PNG, COMPANY_ID);
      const absolute = await writeCompanyLogoFile({
        uploadsDir: root,
        companyId: COMPANY_ID,
        fileName,
        buffer: Buffer.from('png'),
      });
      expect(absolute.startsWith(root)).toBe(true);
      expect(absolute).toContain(COMPANY_ID);
      expect(absolute.endsWith('.png')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
