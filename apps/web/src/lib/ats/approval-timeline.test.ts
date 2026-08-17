import { describe, expect, it } from "vitest";
import type { VacancyApproval } from "@/types/ats";
import {
  approvalStepTitle,
  buildApprovalTimeline,
  canShowVacancyDecisionActions,
} from "@/lib/ats/approval-timeline";

const baseStep = {
  companyId: "c1",
  vacancyRequestId: "r1",
  approverEmployeeId: null,
  requiredRoleCode: null,
  decidedByUserId: null,
  decidedAt: null,
  comment: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  label: null,
};

function step(
  overrides: Partial<VacancyApproval> & Pick<VacancyApproval, "id" | "step" | "sequence" | "status">,
): VacancyApproval {
  return { ...baseStep, ...overrides };
}

describe("approval timeline", () => {
  it("prefers the configured label and never falls back to a UUID", () => {
    expect(
      approvalStepTitle({
        label: "Jefe directo",
        step: "DIRECT_MANAGER",
        requiredRoleCode: null,
      }),
    ).toBe("Jefe directo");
    expect(
      approvalStepTitle({
        label: null,
        step: "ROLE",
        requiredRoleCode: "CLIENT_ADMIN",
      }),
    ).toBe("Administrador de compañía");
  });

  it("marks later pending steps as waiting", () => {
    const items = buildApprovalTimeline([
      step({
        id: "1",
        step: "DIRECT_MANAGER",
        sequence: 1,
        status: "APPROVED",
        approverEmployee: {
          id: "e1",
          firstName: "Juan",
          lastName: "Pérez",
          email: "juan@example.com",
        },
      }),
      step({
        id: "2",
        step: "ROLE",
        sequence: 2,
        status: "PENDING",
        requiredRoleCode: "CLIENT_ADMIN",
        label: "RRHH",
      }),
      step({
        id: "3",
        step: "ROLE",
        sequence: 3,
        status: "PENDING",
        requiredRoleCode: "LEADER",
        label: "Dirección",
      }),
    ]);
    expect(items.map((item) => [item.marker, item.title, item.statusLabel, item.actor])).toEqual([
      ["✓", "Líder directo", "Aprobado", "Juan Pérez"],
      ["●", "RRHH", "Pendiente", "Administrador de compañía"],
      ["○", "Dirección", "Esperando", "Líder"],
    ]);
    expect(JSON.stringify(items)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("hides approve/reject unless the current user can decide", () => {
    expect(
      canShowVacancyDecisionActions({
        status: "PENDING_APPROVAL",
        currentUserCanDecide: false,
      }),
    ).toBe(false);
    expect(
      canShowVacancyDecisionActions({
        status: "PENDING_APPROVAL",
        currentUserCanDecide: true,
      }),
    ).toBe(true);
    expect(
      canShowVacancyDecisionActions({ status: "DRAFT", currentUserCanDecide: true }),
    ).toBe(false);
  });
});
