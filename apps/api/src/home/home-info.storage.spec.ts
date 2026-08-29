import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOME_INFO_MIME } from './home-info.constants';
import {
  assertSafeHomeInfoFileName,
  buildHomeInfoFileName,
  resolveHomeInfoAbsolutePath,
  writeHomeInfoFile,
} from './home-info.storage';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

describe('home info storage', () => {
  it('rejects path traversal in file names', () => {
    expect(() => assertSafeHomeInfoFileName('../secret.png')).toThrow();
    expect(() =>
      assertSafeHomeInfoFileName(`${COMPANY_ID}/../../etc/passwd`),
    ).toThrow();
    expect(() =>
      resolveHomeInfoAbsolutePath(
        '/data/company-uploads',
        COMPANY_ID,
        '../x.png',
      ),
    ).toThrow();
  });

  it('writes under the company directory with a server-generated name', async () => {
    const root = mkdtempSync(join(tmpdir(), 'home-info-storage-'));
    try {
      const fileName = buildHomeInfoFileName(HOME_INFO_MIME.PNG, COMPANY_ID);
      const absolute = await writeHomeInfoFile({
        uploadsDir: root,
        companyId: COMPANY_ID,
        fileName,
        buffer: Buffer.from('png'),
      });
      expect(fileName.startsWith('info-')).toBe(true);
      expect(absolute.startsWith(root)).toBe(true);
      expect(absolute).toContain(COMPANY_ID);
      expect(absolute.endsWith('.png')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
