import {
  hasLinkedInParsedData,
  normalizeLinkedInProfileUrl,
  parseLinkedInInput,
} from './linkedin';

describe('linkedin helpers', () => {
  it('normalizes profile URLs', () => {
    expect(
      normalizeLinkedInProfileUrl('linkedin.com/in/ana-perez/'),
    ).toBe('https://www.linkedin.com/in/ana-perez');
    expect(
      normalizeLinkedInProfileUrl('https://co.linkedin.com/in/Ana_Perez'),
    ).toBe('https://www.linkedin.com/in/Ana_Perez');
    expect(normalizeLinkedInProfileUrl('https://linkedin.com/company/acme')).toBe(
      null,
    );
  });

  it('prefills contact and sections from pasted LinkedIn text', () => {
    const parsed = parseLinkedInInput({
      linkedinUrl: 'https://www.linkedin.com/in/ana-ruiz',
      profileText: `
Ana Ruiz
ana.ruiz@example.com
https://www.linkedin.com/in/ana-ruiz

About
Ingeniera de software enfocada en productos B2B.

Experience
Acme
Desarrolladora Senior
Ene 2021 - Present

Education
Universidad Nacional
Ingeniería de Sistemas
Profesional
2014 - 2019
`,
    });
    expect(parsed.linkedinUrl).toBe('https://www.linkedin.com/in/ana-ruiz');
    expect(parsed).toMatchObject({
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana.ruiz@example.com',
      professionalProfile:
        'Ingeniera de software enfocada en productos B2B.',
    });
    expect(parsed.workExperience[0]).toMatchObject({
      companyName: 'Acme',
      positionTitle: 'Desarrolladora Senior',
      isCurrent: true,
    });
    expect(parsed.education[0]).toMatchObject({
      institution: 'Universidad Nacional',
      educationLevel: 'PROFESSIONAL',
    });
    expect(hasLinkedInParsedData(parsed)).toBe(true);
  });

  it('keeps URL-only submissions without inventing profile fields', () => {
    expect(
      parseLinkedInInput({
        linkedinUrl: 'https://www.linkedin.com/in/solo-url',
      }),
    ).toEqual({
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      documentType: null,
      documentNumber: null,
      professionalProfile: null,
      workExperience: [],
      education: [],
      linkedinUrl: 'https://www.linkedin.com/in/solo-url',
    });
  });
});
