import { CV_MIME } from './cv.constants';
import {
  buildStoredZip,
  detectCvMime,
  extractCvText,
  extractPdfText,
  inspectCvFile,
} from './cv-extract';

describe('cv extract', () => {
  it('reads UTF-8 text files', () => {
    const buffer = Buffer.from('Nombre: Ana\ncorreo ana@acme.test', 'utf8');
    const inspected = inspectCvFile({
      buffer,
      mimetype: 'text/plain',
      originalname: 'cv.txt',
    });
    expect('error' in inspected).toBe(false);
    if ('error' in inspected) return;
    expect(inspected.mime).toBe(CV_MIME.TXT);
    expect(extractCvText(inspected)).toContain('ana@acme.test');
  });

  it('extracts literals from an uncompressed PDF', () => {
    const pdf = Buffer.from(
      '%PDF-1.1\nBT (Ana Perez) Tj (ana@acme.test) Tj ET\n%%EOF',
      'ascii',
    );
    expect(detectCvMime(pdf)).toBe(CV_MIME.PDF);
    expect(extractPdfText(pdf)).toContain('Ana Perez');
    expect(extractPdfText(pdf)).toContain('ana@acme.test');
  });

  it('extracts document.xml text from a stored DOCX zip', () => {
    const zip = buildStoredZip({
      'word/document.xml':
        '<w:p><w:t>Ana Ruiz</w:t></w:p><w:p><w:t>ana@acme.test</w:t></w:p>',
    });
    const inspected = inspectCvFile({
      buffer: zip,
      originalname: 'cv.docx',
    });
    expect('error' in inspected).toBe(false);
    if ('error' in inspected) return;
    expect(inspected.mime).toBe(CV_MIME.DOCX);
    expect(extractCvText(inspected)).toContain('Ana Ruiz');
    expect(extractCvText(inspected)).toContain('ana@acme.test');
  });

  it('rejects zip files that are not DOCX', () => {
    const zip = buildStoredZip({ 'readme.txt': 'not a cv' });
    expect(inspectCvFile({ buffer: zip, originalname: 'file.zip' })).toEqual({
      error: 'type',
    });
  });

  it('extracts printable text from a legacy OLE .doc', () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from('WordDocument', 'ascii'),
      Buffer.alloc(20, 0),
      Buffer.from('A\0n\0a\0 \0R\0u\0i\0z\0', 'binary'),
      Buffer.from(' ana@acme.test ', 'ascii'),
    ]);
    const inspected = inspectCvFile({
      buffer: ole,
      originalname: 'cv.doc',
      mimetype: 'application/msword',
    });
    expect('error' in inspected).toBe(false);
    if ('error' in inspected) return;
    expect(inspected.mime).toBe(CV_MIME.DOC);
    const text = extractCvText(inspected);
    expect(text).toContain('Ana Ruiz');
    expect(text).toContain('ana@acme.test');
  });
});
