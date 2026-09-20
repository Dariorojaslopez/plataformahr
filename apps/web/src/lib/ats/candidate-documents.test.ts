import { describe, expect, it } from "vitest";
import { candidateAvailableDocuments } from "@/lib/ats/candidate-documents";

describe("candidateAvailableDocuments", () => {
  it("lists only files that are already uploaded", () => {
    expect(
      candidateAvailableDocuments({
        id: "c1",
        hasCv: true,
        applications: [
          {
            id: "a1",
            vacancyId: "v1",
            vacancyTitle: "Analista",
            stage: "TO_HIRE",
            hasSecurityStudyDoc: true,
            hasMedicalExamDoc: false,
            hasSignedOfferLetter: true,
            hasSignedContract: false,
          },
        ],
      }).map((item) => item.label),
    ).toEqual(["Hoja de vida", "Estudio de seguridad", "Carta oferta"]);
  });

  it("adds the process title when the candidate applied to more than one", () => {
    const labels = candidateAvailableDocuments({
      id: "c1",
      hasCv: false,
      applications: [
        {
          id: "a1",
          vacancyId: "v1",
          vacancyTitle: "Analista",
          stage: "OFFER",
          hasSecurityStudyDoc: true,
          hasMedicalExamDoc: false,
          hasSignedOfferLetter: false,
          hasSignedContract: false,
        },
        {
          id: "a2",
          vacancyId: "v2",
          vacancyTitle: "Líder",
          stage: "TO_HIRE",
          hasSecurityStudyDoc: false,
          hasMedicalExamDoc: true,
          hasSignedOfferLetter: false,
          hasSignedContract: false,
        },
      ],
    }).map((item) => item.label);
    expect(labels).toEqual([
      "Estudio de seguridad · Analista",
      "Exámenes médicos · Líder",
    ]);
  });
});
