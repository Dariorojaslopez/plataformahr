import {
  isBlankOfferLetterEmailHtml,
  normalizeOfferLetterEmailHtml,
  sanitizeOfferLetterEmailHtml,
} from './offer-letter-email-html';

describe('offer-letter-email-html', () => {
  it('strips scripts and event handlers', () => {
    const html = sanitizeOfferLetterEmailHtml(
      '<p onclick="alert(1)">Hola</p><script>alert(1)</script>',
    );
    expect(html).toContain('<p>Hola</p>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('onclick');
  });

  it('keeps png logos and drops javascript images', () => {
    const kept = sanitizeOfferLetterEmailHtml(
      '<p>Logo</p><img src="data:image/png;base64,aaa" alt="Logo" />',
    );
    expect(kept).toContain('data:image/png;base64,aaa');
    const dropped = sanitizeOfferLetterEmailHtml(
      '<img src="javascript:alert(1)" alt="x" />',
    );
    expect(dropped).not.toContain('img');
  });

  it('treats empty paragraphs as a blank template', () => {
    expect(isBlankOfferLetterEmailHtml('<p></p>')).toBe(true);
    expect(isBlankOfferLetterEmailHtml('<p>Hola</p>')).toBe(false);
    expect(
      isBlankOfferLetterEmailHtml(
        '<p></p><img src="data:image/png;base64,aaa" alt="" />',
      ),
    ).toBe(false);
    expect(normalizeOfferLetterEmailHtml('<p></p>')).toBeNull();
    expect(normalizeOfferLetterEmailHtml('<p>Oferta</p>')).toBe(
      '<p>Oferta</p>',
    );
  });
});
