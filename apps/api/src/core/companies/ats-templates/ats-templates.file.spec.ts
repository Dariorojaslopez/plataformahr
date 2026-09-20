import {
  ATS_TEMPLATE_KIND,
  ATS_TEMPLATE_MIME,
} from './ats-templates.constants';
import { resolveAtsTemplateMime } from './ats-templates.file';

function fakeDocx(): Buffer {
  return Buffer.concat([
    Buffer.from('PK'),
    Buffer.from('word/document.xml'),
    Buffer.from('[Nombre] [Cargo]'),
  ]);
}

describe('resolveAtsTemplateMime', () => {
  it('requires a Word .docx for the offer letter', () => {
    expect(
      resolveAtsTemplateMime(ATS_TEMPLATE_KIND.OFFER_LETTER, {
        mimetype: ATS_TEMPLATE_MIME.DOCX,
        originalname: 'carta.docx',
        buffer: fakeDocx(),
      }),
    ).toBe(ATS_TEMPLATE_MIME.DOCX);

    expect(
      resolveAtsTemplateMime(ATS_TEMPLATE_KIND.OFFER_LETTER, {
        mimetype: ATS_TEMPLATE_MIME.PDF,
        originalname: 'carta.pdf',
        buffer: Buffer.from('%PDF-1.4'),
      }),
    ).toBeNull();

    expect(
      resolveAtsTemplateMime(ATS_TEMPLATE_KIND.OFFER_LETTER, {
        mimetype: 'application/msword',
        originalname: 'carta.doc',
        buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
      }),
    ).toBeNull();
  });

  it('requires a Word .docx for the contract template', () => {
    expect(
      resolveAtsTemplateMime(ATS_TEMPLATE_KIND.CONTRACT, {
        mimetype: ATS_TEMPLATE_MIME.PDF,
        originalname: 'contrato.pdf',
        buffer: Buffer.from('%PDF-1.4'),
      }),
    ).toBeNull();

    expect(
      resolveAtsTemplateMime(ATS_TEMPLATE_KIND.CONTRACT, {
        mimetype: ATS_TEMPLATE_MIME.DOCX,
        originalname: 'contrato.docx',
        buffer: fakeDocx(),
      }),
    ).toBe(ATS_TEMPLATE_MIME.DOCX);
  });
});
