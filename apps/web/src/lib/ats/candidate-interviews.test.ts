import { describe, expect, it } from "vitest";
import { candidateInterviewSummaries } from "@/lib/ats/candidate-interviews";

describe("candidateInterviewSummaries", () => {
  it("summarizes interviews for the candidates table", () => {
    expect(
      candidateInterviewSummaries({
        applications: [
          {
            id: "a1",
            vacancyId: "v1",
            vacancyTitle: "Analista",
            stage: "INTERVIEW",
            hasSecurityStudyDoc: false,
            hasMedicalExamDoc: false,
            hasSignedOfferLetter: false,
            hasSignedContract: false,
            interviews: [
              {
                id: "int-1",
                type: "TECHNICAL",
                status: "SCHEDULED",
                scheduledAt: "2026-09-18T15:00:00.000Z",
                interviewers: ["Ana Ríos"],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        id: "int-1",
        href: "/ats/interviews/int-1",
        title: "Técnica",
        status: "SCHEDULED",
        statusLabel: "Programada",
        scheduledAt: "2026-09-18T15:00:00.000Z",
        interviewers: "Ana Ríos",
      },
    ]);
  });

  it("adds the process title when the candidate applied to more than one", () => {
    const titles = candidateInterviewSummaries({
      applications: [
        {
          id: "a1",
          vacancyId: "v1",
          vacancyTitle: "Analista",
          stage: "INTERVIEW",
          hasSecurityStudyDoc: false,
          hasMedicalExamDoc: false,
          hasSignedOfferLetter: false,
          hasSignedContract: false,
          interviews: [
            {
              id: "int-1",
              type: "HR",
              status: "COMPLETED",
              scheduledAt: null,
              interviewers: [],
            },
          ],
        },
        {
          id: "a2",
          vacancyId: "v2",
          vacancyTitle: "Líder",
          stage: "OFFER",
          hasSecurityStudyDoc: false,
          hasMedicalExamDoc: false,
          hasSignedOfferLetter: false,
          hasSignedContract: false,
          interviews: [
            {
              id: "int-2",
              type: "MANAGER",
              status: "IN_PROGRESS",
              scheduledAt: null,
              interviewers: ["Luis Mora"],
            },
          ],
        },
      ],
    }).map((item) => item.title);
    expect(titles).toEqual(["RRHH · Analista", "Gerencial · Líder"]);
  });
});
