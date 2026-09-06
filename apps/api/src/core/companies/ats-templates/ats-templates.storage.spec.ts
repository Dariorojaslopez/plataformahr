import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ATS_TEMPLATE_KIND, ATS_TEMPLATE_MIME } from './ats-templates.constants';
import {
  buildAtsTemplateFileName,
  deleteAtsTemplateFile,
  readAtsTemplateFile,
  resolveAtsTemplateAbsolutePath,
  writeAtsTemplateFile,
} from './ats-templates.storage';

describe('ats-templates.storage', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ats-tmpl-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('builds safe filenames and writes/reads/deletes', async () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    const fileName = buildAtsTemplateFileName(
      ATS_TEMPLATE_KIND.OFFER_LETTER,
      ATS_TEMPLATE_MIME.PDF,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(fileName).toBe(
      'ats-tmpl-offer-22222222-2222-4222-8222-222222222222.pdf',
    );

    await writeAtsTemplateFile({
      uploadsDir: root,
      companyId,
      fileName,
      buffer: Buffer.from('%PDF-1.4'),
    });

    const absolute = resolveAtsTemplateAbsolutePath(root, companyId, fileName);
    expect(await readFile(absolute, 'utf8')).toBe('%PDF-1.4');
    expect(
      await readAtsTemplateFile({ uploadsDir: root, companyId, fileName }),
    ).toEqual(Buffer.from('%PDF-1.4'));

    await deleteAtsTemplateFile({ uploadsDir: root, companyId, fileName });
    await expect(
      readAtsTemplateFile({ uploadsDir: root, companyId, fileName }),
    ).rejects.toThrow();
  });

  it('rejects path traversal', () => {
    expect(() =>
      resolveAtsTemplateAbsolutePath(
        root,
        '11111111-1111-4111-8111-111111111111',
        '../evil.pdf',
      ),
    ).toThrow(/Invalid ats template file name/);
  });

  it('rejects writing outside company folder', async () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    const fileName = buildAtsTemplateFileName(
      ATS_TEMPLATE_KIND.CONTRACT,
      ATS_TEMPLATE_MIME.DOCX,
    );
    await writeFile(join(root, 'marker'), 'x');
    await writeAtsTemplateFile({
      uploadsDir: root,
      companyId,
      fileName,
      buffer: Buffer.from('docx'),
    });
    const absolute = resolveAtsTemplateAbsolutePath(root, companyId, fileName);
    expect(absolute.startsWith(join(root, companyId))).toBe(true);
  });
});
