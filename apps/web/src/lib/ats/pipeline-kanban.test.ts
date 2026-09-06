import { describe, expect, it } from "vitest";
import {
  fitLevelFromRatings,
  finalistCardsForDocs,
  getValidKanbanTargets,
  groupCardsByKanbanColumn,
  hireRequirementChecks,
  interviewPhaseDecisionOptions,
  KANBAN_COLUMNS,
  kanbanColumnForStage,
  nextStageForInterviewAdvance,
  stageForKanbanColumn,
} from "@/lib/ats/pipeline-kanban";
import type { PipelineCard } from "@/types/ats";

describe("pipeline kanban", () => {
  it("maps the four recruiter columns", () => {
    expect(kanbanColumnForStage("PENDING_REVIEW")).toBe("NEW");
    expect(kanbanColumnForStage("CONTACTED")).toBe("NEW");
    expect(kanbanColumnForStage("INTERVIEW")).toBe("ATTRACTION");
    expect(kanbanColumnForStage("OFFER")).toBe("EVALUATORS");
    expect(kanbanColumnForStage("HIRED")).toBe("HIRED");
    expect(kanbanColumnForStage("REJECTED")).toBeNull();
    expect(
      [
        "Aplicantes",
        "Evaluación",
        "Finalistas",
        "a Contratar",
      ].every((label, index) => KANBAN_COLUMNS[index]?.label === label),
    ).toBe(true);
  });

  it("lists only finalist (OFFER) cards for recruiter docs table", () => {
    expect(
      finalistCardsForDocs([
        card("a", "PENDING_REVIEW"),
        card("b", "OFFER"),
        card("c", "INTERVIEW"),
        card("d", "OFFER"),
      ]).map((item) => item.applicationId),
    ).toEqual(["b", "d"]);
  });

  it("lets a recruiter advance Nuevo to attraction in one drop", () => {
    expect(getValidKanbanTargets("PENDING_REVIEW")).toEqual(["ATTRACTION"]);
    expect(stageForKanbanColumn("ATTRACTION")).toBe("INTERVIEW");
  });

  it("sends attraction to evaluators and evaluators to hired", () => {
    expect(getValidKanbanTargets("INTERVIEW")).toEqual(["EVALUATORS"]);
    expect(getValidKanbanTargets("OFFER")).toEqual(["HIRED"]);
    expect(getValidKanbanTargets("HIRED")).toEqual([]);
  });

  it("computes the traffic-light fit from ratings", () => {
    expect(fitLevelFromRatings([])).toBe("gray");
    expect(fitLevelFromRatings([5, 4])).toBe("green");
    expect(fitLevelFromRatings([3, 3])).toBe("yellow");
    expect(fitLevelFromRatings([1, 2])).toBe("red");
  });

  it("advances interview decisions to the next pipeline stage", () => {
    expect(nextStageForInterviewAdvance("INTERVIEW")).toBe("OFFER");
    expect(nextStageForInterviewAdvance("OFFER")).toBeNull();
    expect(interviewPhaseDecisionOptions()).toEqual([
      "DISCARDED",
      "STANDBY",
      "ADVANCE",
    ]);
  });

  it("groups pipeline cards into the four recruiter columns", () => {
    const grouped = groupCardsByKanbanColumn([
      card("a", "PENDING_REVIEW"),
      card("b", "CONTACTED"),
      card("c", "INTERVIEW"),
      card("d", "OFFER"),
      card("e", "HIRED"),
      card("f", "REJECTED"),
    ]);
    expect(grouped.NEW.map((item) => item.applicationId)).toEqual(["a", "b"]);
    expect(grouped.ATTRACTION.map((item) => item.applicationId)).toEqual(["c"]);
    expect(grouped.EVALUATORS.map((item) => item.applicationId)).toEqual(["d"]);
    expect(grouped.HIRED.map((item) => item.applicationId)).toEqual(["e"]);
  });

  it("blocks hiring until offer, stage and vacancy capacity are met", () => {
    const blocked = hireRequirementChecks({
      stage: "INTERVIEW",
      offerStatus: null,
      headcount: 1,
      filledCount: 1,
      securityStudyStatus: "PENDING",
      medicalExamStatus: "PENDING",
      contractApprovalStatus: "PENDING",
      hasCompanyOfferLetterTemplate: true,
      hasSignedOfferLetter: false,
    });
    expect(blocked.every((item) => !item.met)).toBe(true);
    expect(
      hireRequirementChecks({
        stage: "OFFER",
        offerStatus: "ACCEPTED",
        headcount: 2,
        filledCount: 1,
        securityStudyStatus: "APPROVED",
        medicalExamStatus: "NOT_REQUIRED",
        contractApprovalStatus: "APPROVED",
      }).every((item) => item.met),
    ).toBe(true);
    expect(
      hireRequirementChecks({
        stage: "OFFER",
        offerStatus: "ACCEPTED",
        headcount: 2,
        filledCount: 1,
        securityStudyStatus: "APPROVED",
        medicalExamStatus: "APPROVED",
        contractApprovalStatus: "NOT_REQUIRED",
        hasCompanyOfferLetterTemplate: true,
        hasSignedOfferLetter: false,
      }).find((item) => item.id === "SIGNED_OFFER_LETTER")?.met,
    ).toBe(false);
    expect(
      hireRequirementChecks({
        stage: "OFFER",
        offerStatus: "ACCEPTED",
        headcount: 2,
        filledCount: 1,
        securityStudyStatus: "PENDING",
        medicalExamStatus: "APPROVED",
        contractApprovalStatus: "NOT_REQUIRED",
      }).find((item) => item.id === "SECURITY_STUDY")?.met,
    ).toBe(false);
  });
});

function card(applicationId: string, stage: PipelineCard["stage"]): PipelineCard {
  return {
    applicationId,
    candidateId: applicationId,
    candidateName: applicationId,
    candidateEmail: `${applicationId}@example.com`,
    stage,
    lastStageChangedAt: "2026-01-01T00:00:00.000Z",
  };
}
