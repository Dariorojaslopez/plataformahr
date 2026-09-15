import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicJobApplicationDto } from './public-job.dto';

describe('PublicJobApplicationDto multipart nested JSON', () => {
  it('accepts workExperience/education/screeningAnswers as JSON strings', async () => {
    const dto = plainToInstance(PublicJobApplicationDto, {
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@example.com',
      phone: '3001234567',
      documentType: 'CC',
      documentNumber: '1234567890',
      birthDate: '1990-03-15',
      country: 'Colombia',
      state: 'Cundinamarca',
      city: 'Bogotá',
      professionalProfile: 'Perfil',
      workExperience: JSON.stringify([
        {
          companyName: 'Acme',
          country: 'Colombia',
          positionTitle: 'Dev',
          startDate: '2020-01-01',
          endDate: '',
          isCurrent: true,
          functions: 'Code',
          achievements: 'Shipped',
        },
      ]),
      education: JSON.stringify([
        {
          institution: 'UNI',
          program: 'Sistemas',
          educationLevel: 'PROFESSIONAL',
          startDate: '2014-01-01',
          endDate: '2019-01-01',
          isStudying: false,
        },
      ]),
      screeningAnswers: JSON.stringify([
        {
          questionId: '550e8400-e29b-41d4-a716-446655440001',
          answer: true,
        },
        {
          questionId: '550e8400-e29b-41d4-a716-446655440002',
          selectedOptionIds: ['550e8400-e29b-41d4-a716-446655440003'],
        },
      ]),
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toEqual([]);
    expect(dto.workExperience[0]).toMatchObject({
      companyName: 'Acme',
      isCurrent: true,
      endDate: null,
    });
    expect(dto.education[0]?.institution).toBe('UNI');
    expect(dto.screeningAnswers).toHaveLength(2);
  });
});
