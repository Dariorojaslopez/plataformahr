import { type CargoOccupantRow } from "@/lib/ats/position-occupant";
import {
  COMPANY_ROLE_LABELS,
  VACANCY_APPROVER_TYPE_LABELS,
  formatEmployeeName,
} from "@/lib/ats/labels";
import type {
  VacancyApprovalWorkflow,
  VacancyApprovalWorkflowStep,
  VacancyRequest,
  VacancyRequestApprovalPlanStep,
} from "@/types/ats";

function lockedRowFromStep(
  step: VacancyApprovalWorkflowStep | VacancyRequestApprovalPlanStep,
): CargoOccupantRow {
  const positionBased = step.approverType === "POSITION";
  const roleLabel = step.requiredRoleCode
    ? COMPANY_ROLE_LABELS[step.requiredRoleCode] ?? step.requiredRoleCode
    : null;
  return {
    key: step.id,
    positionId: step.positionId ?? "",
    occupantId: step.specificEmployeeId ?? "",
    locked: true,
    positionName: step.position?.name,
    occupantName: formatEmployeeName(step.specificEmployee),
    legacySummary: positionBased
      ? undefined
      : step.label ??
        (roleLabel
          ? `${VACANCY_APPROVER_TYPE_LABELS[step.approverType]} · ${roleLabel}`
          : VACANCY_APPROVER_TYPE_LABELS[step.approverType]),
  };
}

export function workflowToLockedApprovalRows(
  workflow: VacancyApprovalWorkflow | undefined,
): CargoOccupantRow[] {
  if (!workflow?.enabled) return [];
  return workflow.steps.map((step) => lockedRowFromStep(step));
}

export function requestPlanToApprovalRows(
  request: VacancyRequest,
  workflow?: VacancyApprovalWorkflow,
): CargoOccupantRow[] {
  const plan = request.approvalPlanSteps ?? [];
  if (plan.length === 0) {
    return workflowToLockedApprovalRows(workflow);
  }
  return plan.map((step) => {
    if (step.origin === "DEFAULT") {
      return lockedRowFromStep(step);
    }
    return {
      key: step.id,
      positionId: step.positionId ?? "",
      occupantId: step.specificEmployeeId ?? "",
      positionName: step.position?.name,
      occupantName: formatEmployeeName(step.specificEmployee),
    };
  });
}

export function extraApprovalRows(rows: CargoOccupantRow[]): CargoOccupantRow[] {
  return rows.filter((row) => !row.locked);
}
