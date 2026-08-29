import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CV_MIME } from './cv.constants';
import {
  assertSafeCvFileName,
  buildCvFileName,
  resolveCvAbsolutePath,
  writeCvFile,
} from './cv.storage';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

describe('cv storage', () => {
  it('rejects path traversal in file names', () => {
    expect(() => assertSafeCvFileName('../secret.pdf')).toThrow();
    expect(() =>
      resolveCvAbsolutePath('/data/company-uploads', COMPANY_ID, '../x.pdf'),
    ).toThrow();
  });

  it('writes under the company directory with a server-generated name', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cv-storage-'));
    try {
      const fileName = buildCvFileName(CV_MIME.PDF, COMPANY_ID);
      const absolute = await writeCvFile({
        uploadsDir: root,
        companyId: COMPANY_ID,
        fileName,
        buffer: Buffer.from('%PDF'),
      });
      expect(fileName.startsWith('cv-')).toBe(true);
      expect(absolute.startsWith(root)).toBe(true);
      expect(absolute).toContain(COMPANY_ID);
      expect(absolute.endsWith('.pdf')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
