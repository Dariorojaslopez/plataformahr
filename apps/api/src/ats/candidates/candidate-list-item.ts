import { PreHireDocumentKind } from '@prisma/client';

export type CandidateListApplicationInput = {
  id: string;
  vacancyId: string;
  stage: string;
  vacancy: { title: string };
  preHireDocuments: Array<{ kind: string }>;
  jobOffer: {
    signedOfferLetterFileName?: string | null;
    signedContractFileName?: string | null;
  } | null;
  interviews?: Array<{
    id: string;
    type: string;
    status: string;
    scheduledAt: Date | string | null;
    interviewers: Array<{
      employee: { firstName: string; lastName: string } | null;
    }>;
  }>;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function toCandidateListItem<T extends { cvFileName?: string | null }>(
  candidate: T & { applications?: CandidateListApplicationInput[] },
) {
  const { applications = [], ...rest } = candidate;
  return {
    ...rest,
    hasCv: Boolean(candidate.cvFileName),
    applications: applications.map((application) => ({
      id: application.id,
      vacancyId: application.vacancyId,
      vacancyTitle: application.vacancy.title,
      stage: application.stage,
      hasSecurityStudyDoc: application.preHireDocuments.some(
        (doc) => doc.kind === PreHireDocumentKind.SECURITY_STUDY,
      ),
      hasMedicalExamDoc: application.preHireDocuments.some(
        (doc) => doc.kind === PreHireDocumentKind.MEDICAL_EXAM,
      ),
      hasSignedOfferLetter: Boolean(
        application.jobOffer?.signedOfferLetterFileName,
      ),
      hasSignedContract: Boolean(application.jobOffer?.signedContractFileName),
      interviews: (application.interviews ?? []).map((interview) => ({
        id: interview.id,
        type: interview.type,
        status: interview.status,
        scheduledAt: toIso(interview.scheduledAt),
        interviewers: interview.interviewers
          .map((row) =>
            row.employee
              ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
              : '',
          )
          .filter(Boolean),
      })),
    })),
  };
}
