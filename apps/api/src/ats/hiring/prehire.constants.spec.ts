import {
  hireDocumentsRequiredMessage,
  missingRequiredHireDocuments,
} from './prehire.constants';

describe('hire document requirements', () => {
  it('lists missing HV and prehire files', () => {
    expect(
      missingRequiredHireDocuments({
        hasCv: true,
        hasSecurityStudyDoc: true,
        hasMedicalExamDoc: true,
      }),
    ).toEqual([]);
    expect(
      missingRequiredHireDocuments({
        hasCv: false,
        hasSecurityStudyDoc: false,
        hasMedicalExamDoc: true,
      }),
    ).toEqual(['Hoja de vida', 'Estudio de seguridad']);
    expect(hireDocumentsRequiredMessage(['Hoja de vida'])).toContain(
      'permanece en Finalistas',
    );
  });
});
