import { describe, expect, it } from "vitest";
import {
  justificationRequired,
  replacementCoverOptions,
  toCreateVacancyRequestPayload,
  type VacancyRequestFormValues,
} from "@/lib/ats/vacancy-request-form";
import {
  APPLICATION_STAGE_LABELS,
  VACANCY_STATUS_LABELS,
} from "@/lib/ats/labels";
import {
  canMoveApplication,
  getValidMoveTargets,
  getVacancyStatusActions,
  isTerminalStage,
} from "@/lib/ats/transitions";

const baseValues = (): VacancyRequestFormValues => ({
  motive: "REPLACEMENT_RESIGNATION",
  requestedByEmployeeId: "",
  existingPositionId: "pos-1",
  requestedPositionName: "",
  requestedAreaId: "",
  requestedJobLevelId: "",
  replacedEmployeeId: "emp-replaced",
  requestedHeadcount: "2",
  expectedHiringDate: "2099-06-15",
  justification: "",
  approvalSteps: [],
});

describe("vacancy request form payloads", () => {
  it("builds replacement payload without NEW fields", () => {
    const payload = toCreateVacancyRequestPayload({
      ...baseValues(),
      requestedPositionName: "should-ignore",
      requestedAreaId: "area-1",
      requestedJobLevelId: "jl-1",
    });
    expect(payload).toEqual({
      motive: "REPLACEMENT_RESIGNATION",
      requestedHeadcount: 2,
      expectedHiringDate: "2099-06-15",
      justification: "",
      existingPositionId: "pos-1",
      replacedEmployeeId: "emp-replaced",
    });
    expect(payload).not.toHaveProperty("requestedPositionName");
    expect(payload).not.toHaveProperty("requestedAreaId");
    expect(payload).not.toHaveProperty("extraApprovalSteps");
  });

  it("builds NEW_POSITION payload without existingPositionId", () => {
    const payload = toCreateVacancyRequestPayload({
      ...baseValues(),
      motive: "NEW_POSITION",
      requestedByEmployeeId: "emp-1",
      existingPositionId: "pos-x",
      requestedPositionName: "Data Analyst",
      requestedAreaId: "area-1",
      requestedJobLevelId: "",
      replacedEmployeeId: "",
      requestedHeadcount: "1",
      justification: "Growth",
    });
    expect(payload.existingPositionId).toBeUndefined();
    expect(payload.replacedEmployeeId).toBeUndefined();
    expect(payload.requestedPositionName).toBe("Data Analyst");
    expect(payload.requestedAreaId).toBe("area-1");
    expect(payload.requestedByEmployeeId).toBe("emp-1");
  });

  it("includes requestedByEmployeeId when a collaborator was selected", () => {
    const payload = toCreateVacancyRequestPayload({
      ...baseValues(),
      requestedByEmployeeId: "emp-selected",
      requestedHeadcount: "1",
      justification: "Coverage",
    });
    expect(payload.requestedByEmployeeId).toBe("emp-selected");
  });

  it("requires justification only when exceeding structure or new position", () => {
    expect(
      justificationRequired({
        motive: "REPLACEMENT_RESIGNATION",
        requestedHeadcount: 1,
        positionHeadcount: 5,
      }),
    ).toBe(false);
    expect(
      justificationRequired({
        motive: "REPLACEMENT_RESIGNATION",
        requestedHeadcount: 6,
        positionHeadcount: 5,
      }),
    ).toBe(true);
    expect(
      justificationRequired({
        motive: "NEW_POSITION",
        requestedHeadcount: 1,
        positionHeadcount: 0,
      }),
    ).toBe(true);
  });

  it("lists vacant plazas next to hired people", () => {
    expect(
      replacementCoverOptions(
        [
          { id: "emp-1", firstName: "maria", lastName: "abril", userId: "u1" },
          { id: "emp-2", firstName: "Carlos", lastName: "perez" },
        ],
        3,
      ),
    ).toEqual([
      { value: "emp-1", label: "maria abril" },
      { value: "emp-2", label: "Carlos perez (sin acceso)" },
      { value: "vacant:0", label: "Posición vacante" },
    ]);
  });

  it("omits replacedEmployeeId when covering a vacant plaza", () => {
    const payload = toCreateVacancyRequestPayload({
      ...baseValues(),
      replacedEmployeeId: "vacant:0",
    });
    expect(payload.existingPositionId).toBe("pos-1");
    expect(payload.replacedEmployeeId).toBeUndefined();
  });

  it("builds VACANT_PLAZA payload without replacedEmployeeId", () => {
    const payload = toCreateVacancyRequestPayload({
      ...baseValues(),
      motive: "VACANT_PLAZA",
      replacedEmployeeId: "emp-replaced",
    });
    expect(payload).toEqual({
      motive: "VACANT_PLAZA",
      requestedHeadcount: 2,
      expectedHiringDate: "2099-06-15",
      justification: "",
      existingPositionId: "pos-1",
    });
    expect(payload.replacedEmployeeId).toBeUndefined();
  });
});

describe("labels and transitions", () => {
  it("keeps stage and vacancy labels", () => {
    expect(APPLICATION_STAGE_LABELS.PENDING_REVIEW).toBeTruthy();
    expect(VACANCY_STATUS_LABELS.OPEN).toBeTruthy();
  });

  it("exposes move targets and vacancy actions", () => {
    expect(getValidMoveTargets("PENDING_REVIEW").length).toBeGreaterThan(0);
    expect(canMoveApplication("PENDING_REVIEW")).toBe(true);
    expect(isTerminalStage("HIRED")).toBe(true);
    expect(getVacancyStatusActions("OPEN")).toContain("PAUSED");
  });
});
