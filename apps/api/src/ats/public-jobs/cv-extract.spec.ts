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
});
