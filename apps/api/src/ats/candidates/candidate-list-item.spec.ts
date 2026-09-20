import { PreHireDocumentKind } from '@prisma/client';
import { toCandidateListItem } from './candidate-list-item';

describe('toCandidateListItem', () => {
  it('maps vacancies and downloadable documents for the candidates list', () => {
    const item = toCandidateListItem({
      id: 'cand-1',
      cvFileName: 'cv.pdf',
      applications: [
        {
          id: 'app-1',
          vacancyId: 'vac-1',
          stage: 'TO_HIRE',
          vacancy: { title: 'Analista' },
          preHireDocuments: [{ kind: PreHireDocumentKind.SECURITY_STUDY }],
          jobOffer: {
            signedOfferLetterFileName: 'letter.docx',
            signedContractFileName: null,
          },
          interviews: [
            {
              id: 'int-1',
              type: 'TECHNICAL',
              status: 'SCHEDULED',
              scheduledAt: new Date('2026-09-18T15:00:00.000Z'),
              interviewers: [
                { employee: { firstName: 'Ana', lastName: 'Ríos' } },
              ],
            },
          ],
        },
      ],
    });

    expect(item.hasCv).toBe(true);
    expect(item.applications).toEqual([
      {
        id: 'app-1',
        vacancyId: 'vac-1',
        vacancyTitle: 'Analista',
        stage: 'TO_HIRE',
        hasSecurityStudyDoc: true,
        hasMedicalExamDoc: false,
        hasSignedOfferLetter: true,
        hasSignedContract: false,
        interviews: [
          {
            id: 'int-1',
            type: 'TECHNICAL',
            status: 'SCHEDULED',
            scheduledAt: '2026-09-18T15:00:00.000Z',
            interviewers: ['Ana Ríos'],
          },
        ],
      },
    ]);
  });

  it('returns empty applications and hasCv=false without files', () => {
    const item = toCandidateListItem({
      id: 'cand-2',
      cvFileName: null,
    });
    expect(item.hasCv).toBe(false);
    expect(item.applications).toEqual([]);
  });
});
