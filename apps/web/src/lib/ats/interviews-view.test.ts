import { describe, expect, it } from "vitest";
import {
  groupPendingInterviewsByVacancy,
  pendingCandidateName,
  pendingInterviewPhaseLabel,
} from "@/lib/ats/interviews-view";
import type { PendingInterview } from "@/types/interviews";

function pending(
  id: string,
  vacancyId: string,
  title: string,
  stage: string,
  templateId: string | null = null,
): PendingInterview {
  return {
    id,
    companyId: "c1",
    applicationId: `app-${id}`,
    type: "HR",
    status: "DRAFT",
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    location: null,
    meetingUrl: null,
    notes: null,
    localRecordingName: null,
    createdAt: "",
    updatedAt: "",
    application: {
      id: `app-${id}`,
      stage,
      candidate: {
        id: `cand-${id}`,
        firstName: id,
        lastName: "Pérez",
        email: `${id}@example.com`,
      },
      vacancy: { id: vacancyId, title, interviewFormTemplateId: templateId },
    },
  };
}

describe("interviews view", () => {
  it("groups pending interviews by selection process", () => {
    const groups = groupPendingInterviewsByVacancy([
      pending("b", "v2", "Analista", "INTERVIEW"),
      pending("a", "v1", "Ingeniero", "OFFER", "tpl-1"),
      pending("c", "v1", "Ingeniero", "INTERVIEW", "tpl-1"),
    ]);
    expect(groups.map((group) => group.vacancyTitle)).toEqual([
      "Analista",
      "Ingeniero",
    ]);
    expect(groups[1]?.interviews.map((item) => item.id)).toEqual(["a", "c"]);
    expect(groups[1]?.templateId).toBe("tpl-1");
  });

  it("labels the pipeline phase and candidate name", () => {
    expect(pendingInterviewPhaseLabel("INTERVIEW")).toBe(
      "Entrevista Equipo de Atracción",
    );
    expect(pendingInterviewPhaseLabel("OFFER")).toBe("Entrevista Evaluadores");
    expect(pendingCandidateName(pending("Camila", "v1", "Cargo", "INTERVIEW"))).toBe(
      "Camila Pérez",
    );
  });
});
