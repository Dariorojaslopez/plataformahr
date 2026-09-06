import {
  DEFAULT_THANK_YOU_SUBJECT,
  renderThankYouLetter,
} from './thank-you-letter';

describe('renderThankYouLetter', () => {
  it('uses defaults and replaces tokens', () => {
    const letter = renderThankYouLetter({
      firstName: 'Camila',
      lastName: 'Puerta',
      vacancyTitle: 'Analista',
      companyName: 'Acme',
    });
    expect(letter.subject).toBe(DEFAULT_THANK_YOU_SUBJECT);
    expect(letter.body).toContain('Camila');
    expect(letter.body).toContain('Analista');
    expect(letter.body).toContain('pool de candidatos');
  });

  it('renders a custom template', () => {
    const letter = renderThankYouLetter({
      subject: 'Gracias {{firstName}} — {{companyName}}',
      body: 'Hola {{fullName}}, sobre {{vacancyTitle}}.',
      firstName: 'Ana',
      lastName: 'Rojas',
      vacancyTitle: 'Dev',
      companyName: 'Talento',
    });
    expect(letter.subject).toBe('Gracias Ana — Talento');
    expect(letter.body).toBe('Hola Ana Rojas, sobre Dev.');
  });
});
