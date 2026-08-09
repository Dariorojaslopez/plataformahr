import { describe, expect, it } from "vitest";
import {
  canCalculateParticipantResult,
  canReleaseParticipantResult,
  managerIncludedLabel,
  RESULT_STATUS_LABELS,
  resultStatusVariant,
} from "@/lib/performance/result-labels";
import type { CycleParticipantListItem } from "@/types/performance";

const baseParticipant = (
  overrides: Partial<CycleParticipantListItem> = {},
): CycleParticipantListItem =>
  ({
    id: "p1",
    companyId: "c1",
    cycleId: "cy1",
    employeeId: "e1",
    status: "ACTIVE",
    createdAt: "",
    updatedAt: "",
    employee: {} as CycleParticipantListItem["employee"],
    manager: null,
    evaluations: {
      self: { id: "s1", status: "SUBMITTED", scorePercentage: "80.00" },
      manager: {
        id: "m1",
        status: "SUBMITTED",
        evaluatorEmployeeId: "mgr",
        scorePercentage: "70.00",
      },
    },
    result: null,
    ...overrides,
  }) as CycleParticipantListItem;

describe("result labels", () => {
  it("maps status labels and variants", () => {
    expect(RESULT_STATUS_LABELS.CALCULATED).toBe("Calculado");
    expect(RESULT_STATUS_LABELS.RELEASED).toBe("Publicado");
    expect(resultStatusVariant("CALCULATED")).toBe("secondary");
    expect(resultStatusVariant("RELEASED")).toBe("success");
  });

  it("allows calculate when ACTIVE cycle, ACTIVE participant, all existing SUBMITTED", () => {
    expect(
      canCalculateParticipantResult({
        cycleStatus: "ACTIVE",
        participant: baseParticipant(),
      }),
    ).toBe(true);
  });

  it("allows calculate for SELF-only when SUBMITTED", () => {
    expect(
      canCalculateParticipantResult({
        cycleStatus: "ACTIVE",
        participant: baseParticipant({
          evaluations: {
            self: { id: "s1", status: "SUBMITTED", scorePercentage: "82.50" },
            manager: null,
          },
        }),
      }),
    ).toBe(true);
  });

  it("blocks calculate when an existing evaluation is incomplete", () => {
    expect(
      canCalculateParticipantResult({
        cycleStatus: "ACTIVE",
        participant: baseParticipant({
          evaluations: {
            self: { id: "s1", status: "SUBMITTED", scorePercentage: "80.00" },
            manager: {
              id: "m1",
              status: "IN_PROGRESS",
              evaluatorEmployeeId: "mgr",
              scorePercentage: null,
            },
          },
        }),
      }),
    ).toBe(false);
  });

  it("blocks calculate when result already exists or cycle not ACTIVE", () => {
    expect(
      canCalculateParticipantResult({
        cycleStatus: "ACTIVE",
        participant: baseParticipant({
          result: {
            id: "r1",
            status: "CALCULATED",
            overallScore: "78.13",
            selfScore: "82.50",
            managerScore: "76.25",
            calculatedAt: "",
            releasedAt: null,
          },
        }),
      }),
    ).toBe(false);
    expect(
      canCalculateParticipantResult({
        cycleStatus: "DRAFT",
        participant: baseParticipant(),
      }),
    ).toBe(false);
  });

  it("allows release only for CALCULATED results", () => {
    expect(
      canReleaseParticipantResult(
        baseParticipant({
          result: {
            id: "r1",
            status: "CALCULATED",
            overallScore: "78.13",
            selfScore: "82.50",
            managerScore: "76.25",
            calculatedAt: "",
            releasedAt: null,
          },
        }),
      ),
    ).toBe(true);
    expect(
      canReleaseParticipantResult(
        baseParticipant({
          result: {
            id: "r1",
            status: "RELEASED",
            overallScore: "78.13",
            selfScore: "82.50",
            managerScore: "76.25",
            calculatedAt: "",
            releasedAt: "",
          },
        }),
      ),
    ).toBe(false);
    expect(canReleaseParticipantResult(baseParticipant())).toBe(false);
  });

  it("describes managerIncluded for employee view", () => {
    expect(managerIncludedLabel(true)).toContain("líder");
    expect(managerIncludedLabel(false)).toContain("Solo autoevaluación");
  });
});
