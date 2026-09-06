import { parseCandidateFromCvText } from './cv-parse';

const SAMPLE = `
Hoja de vida
Ana María Pérez Gómez
Correo: ana.perez@example.com
Teléfono: +57 300 123 4567
Cédula de ciudadanía: 1.234.567.890

Perfil profesional
Ingeniera de software con 5 años construyendo productos web.

Experiencia laboral
Empresa: Acme S.A.S.
Cargo: Desarrolladora Senior
Ene 2020 - Actualidad
Funciones: Liderar features de React y Nest.
Logros: Redujo el tiempo de onboarding 40%.

Empresa: Beta Labs
Cargo: Desarrolladora
2018-01 - 2019-12
Funciones: Mantener APIs internas.

Educación
Institución: Universidad Nacional
Programa: Ingeniería de Sistemas
Nivel: Profesional
2012 - 2017
`;

describe('parseCandidateFromCvText', () => {
  it('extracts contact, profile, experience and education from a Spanish CV', () => {
    const parsed = parseCandidateFromCvText(SAMPLE);
    expect(parsed).toMatchObject({
      firstName: 'Ana María',
      lastName: 'Pérez Gómez',
      email: 'ana.perez@example.com',
      phone: '+573001234567',
      documentType: 'CC',
      documentNumber: '1234567890',
      professionalProfile:
        'Ingeniera de software con 5 años construyendo productos web.',
    });
    expect(parsed.workExperience).toHaveLength(2);
    expect(parsed.workExperience[0]).toMatchObject({
      companyName: 'Acme S.A.S.',
      positionTitle: 'Desarrolladora Senior',
      startDate: '2020-01-01',
      endDate: null,
      isCurrent: true,
      functions: 'Liderar features de React y Nest.',
      achievements: 'Redujo el tiempo de onboarding 40%.',
    });
    expect(parsed.workExperience[1]).toMatchObject({
      companyName: 'Beta Labs',
      positionTitle: 'Desarrolladora',
      startDate: '2018-01-01',
      endDate: '2019-12-01',
      isCurrent: false,
    });
    expect(parsed.education).toHaveLength(1);
    expect(parsed.education[0]).toMatchObject({
      institution: 'Universidad Nacional',
      program: 'Ingeniería de Sistemas',
      educationLevel: 'PROFESSIONAL',
      startDate: '2012-01-01',
      endDate: '2017-01-01',
      isStudying: false,
    });
  });

  it('reads labeled first and last names', () => {
    expect(
      parseCandidateFromCvText(
        'Nombre: Carlos\nApellido: Ruiz\nEmail: carlos@acme.test\nCC 1020304050',
      ),
    ).toMatchObject({
      firstName: 'Carlos',
      lastName: 'Ruiz',
      email: 'carlos@acme.test',
      documentType: 'CC',
      documentNumber: '1020304050',
      professionalProfile: null,
      workExperience: [],
      education: [],
    });
  });

  it('returns nulls when the file has no contact data', () => {
    expect(parseCandidateFromCvText('Experiencia laboral en ventas')).toEqual({
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      documentType: null,
      documentNumber: null,
      professionalProfile: null,
      workExperience: [],
      education: [],
    });
  });
});
