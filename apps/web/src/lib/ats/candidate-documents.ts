import type { Candidate, CandidateListApplication } from "@/types/ats";

export type CandidateDownloadItem = {
  key: string;
  label: string;
  kind:
    | "cv"
    | "SECURITY_STUDY"
    | "MEDICAL_EXAM"
    | "offer-letter"
    | "contract";
  candidateId: string;
  applicationId?: string;
};

function processSuffix(application: CandidateListApplication, count: number) {
  return count > 1 ? ` · ${application.vacancyTitle}` : "";
}

export function candidateAvailableDocuments(
  candidate: Pick<Candidate, "id" | "hasCv" | "cvFileName" | "applications">,
): CandidateDownloadItem[] {
  const items: CandidateDownloadItem[] = [];
  if (candidate.hasCv || candidate.cvFileName) {
    items.push({
      key: `cv-${candidate.id}`,
      label: "Hoja de vida",
      kind: "cv",
      candidateId: candidate.id,
    });
  }

  const applications = candidate.applications ?? [];
  for (const application of applications) {
    const suffix = processSuffix(application, applications.length);
    if (application.hasSecurityStudyDoc) {
      items.push({
        key: `security-${application.id}`,
        label: `Estudio de seguridad${suffix}`,
        kind: "SECURITY_STUDY",
        candidateId: candidate.id,
        applicationId: application.id,
      });
    }
    if (application.hasMedicalExamDoc) {
      items.push({
        key: `medical-${application.id}`,
        label: `Exámenes médicos${suffix}`,
        kind: "MEDICAL_EXAM",
        candidateId: candidate.id,
        applicationId: application.id,
      });
    }
    if (application.hasSignedOfferLetter) {
      items.push({
        key: `offer-${application.id}`,
        label: `Carta oferta${suffix}`,
        kind: "offer-letter",
        candidateId: candidate.id,
        applicationId: application.id,
      });
    }
    if (application.hasSignedContract) {
      items.push({
        key: `contract-${application.id}`,
        label: `Contrato${suffix}`,
        kind: "contract",
        candidateId: candidate.id,
        applicationId: application.id,
      });
    }
  }

  return items;
}
