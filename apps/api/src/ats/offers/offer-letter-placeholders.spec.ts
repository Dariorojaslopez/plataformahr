import { fillOfferLetterPlaceholders } from '@talento/shared';
import {
  fillOfferLetterBuffer,
  htmlToPlainText,
  offerLetterPlaceholderValues,
} from './offer-letter-placeholders';

describe('offer letter placeholders', () => {
  it('replaces tokens in email html and document bytes', () => {
    const values = offerLetterPlaceholderValues({
      candidateName: 'Ana Pérez',
      positionTitle: 'Analista',
      salaryAmount: { toString: () => '3000000' },
      salaryCurrency: 'COP',
      salaryPeriod: 'MONTHLY',
      employmentType: 'FULL_TIME',
      city: 'Bogotá',
      signerName: 'Clara Pasos',
      documentDate: new Date('2026-09-16T12:00:00.000Z'),
    });
    expect(
      fillOfferLetterPlaceholders('Hola [Nombre], cargo [Cargo]', values),
    ).toContain('Ana Pérez');
    expect(values.formaDePago).toBe('Mensual');
    expect(values.tipoDeContrato).toBe('Tiempo completo');
    const filled = fillOfferLetterBuffer(
      Buffer.from('Firma: [Quien firma]', 'utf8'),
      values,
    );
    expect(filled.toString('utf8')).toBe('Firma: Clara Pasos');
    expect(htmlToPlainText('<p>Hola<br/>mundo</p>')).toContain('Hola');
  });
});
