import { describe, expect, it } from "vitest";
import {
  extraApprovalRows,
  requestPlanToApprovalRows,
  workflowToLockedApprovalRows,
} from "@/lib/ats/approval-plan";
import type {
  VacancyApprovalWorkflow,
  VacancyRequest,
  VacancyRequestApprovalPlanStep,
} from "@/types/ats";

const workflow: VacancyApprovalWorkflow = {
  enabled: true,
  allowedRoles: [],
  steps: [
    {
      id: "wf-1",
      sequence: 1,
      approverType: "POSITION",
      label: null,
      positionId: "pos-1",
      specificEmployeeId: "emp-1",
      requiredRoleCode: null,
      position: { id: "pos-1", name: "Gerencia" },
      specificEmployee: {
        id: "emp-1",
        firstName: "Ana",
        lastName: "Ruiz",
        email: "ana@example.com",
      },
    },
  ],
};

function requestWithPlan(
  steps: VacancyRequestApprovalPlanStep[],
): VacancyRequest {
  return {
    id: "req-1",
    companyId: "co-1",
    type: "EXISTING_POSITION",
    status: "DRAFT",
    requestedByEmployeeId: "emp-req",
    existingPositionId: "pos-req",
    requestedPositionName: null,
    requestedAreaId: null,
    requestedJobLevelId: null,
    requestedHeadcount: 1,
    justification: "Coverage",
    generalManagerApprovalRequired: false,
    submittedAt: null,
    decidedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    approvalPlanSteps: steps,
  };
}

describe("approval plan rows", () => {
  it("locks global workflow levels and ignores a disabled workflow", () => {
    const rows = workflowToLockedApprovalRows(workflow);
    expect(rows).toEqual([
      expect.objectContaining({
        key: "wf-1",
        positionId: "pos-1",
        occupantId: "emp-1",
        locked: true,
        positionName: "Gerencia",
        occupantName: "Ana Ruiz",
      }),
    ]);
    expect(workflowToLockedApprovalRows({ ...workflow, enabled: false })).toEqual(
      [],
    );
  });

  it("keeps DEFAULT plan steps locked and CUSTOM steps editable", () => {
    const rows = requestPlanToApprovalRows(
      requestWithPlan([
        {
          id: "plan-d",
          sequence: 1,
          origin: "DEFAULT",
          approverType: "POSITION",
          label: null,
          positionId: "pos-1",
          specificEmployeeId: "emp-1",
          requiredRoleCode: null,
          position: { id: "pos-1", name: "Gerencia" },
          specificEmployee: {
            id: "emp-1",
            firstName: "Ana",
            lastName: "Ruiz",
            email: "ana@example.com",
          },
        },
        {
          id: "plan-c",
          sequence: 2,
          origin: "CUSTOM",
          approverType: "POSITION",
          label: null,
          positionId: "pos-2",
          specificEmployeeId: "emp-2",
          requiredRoleCode: null,
          position: { id: "pos-2", name: "Jefatura" },
          specificEmployee: {
            id: "emp-2",
            firstName: "Luis",
            lastName: "Gómez",
            email: "luis@example.com",
          },
        },
      ]),
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({ key: "plan-d", locked: true }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        key: "plan-c",
        positionId: "pos-2",
        occupantId: "emp-2",
        occupantName: "Luis Gómez",
      }),
    );
    expect(rows[1]?.locked).toBeUndefined();
    expect(extraApprovalRows(rows).map((row) => row.key)).toEqual(["plan-c"]);
  });

  it("falls back to the current workflow when a draft has no frozen plan", () => {
    const rows = requestPlanToApprovalRows(requestWithPlan([]), workflow);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locked).toBe(true);
    expect(rows[0]?.key).toBe("wf-1");
  });
});
