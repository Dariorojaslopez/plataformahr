import { describe, expect, it } from '@jest/globals';
import { parseCandidateFromCvText } from './cv-parse';

const SAMPLE = `
Hoja de vida
Ana María Pérez Gómez
Correo: ana.perez@example.com
Teléfono: +57 300 123 4567
Cédula de ciudadanía: 1.234.567.890

Experiencia
Desarrolladora en Acme
`;

describe('parseCandidateFromCvText', () => {
  it('extracts name, email, phone and cédula from a Spanish CV', () => {
    expect(parseCandidateFromCvText(SAMPLE)).toEqual({
      firstName: 'Ana María',
      lastName: 'Pérez Gómez',
      email: 'ana.perez@example.com',
      phone: '+573001234567',
      documentType: 'CC',
      documentNumber: '1234567890',
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
    });
  });
});
