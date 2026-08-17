import {
  ApprovalStatus,
  VacancyApprovalStep,
  VacancyApproverType,
} from '@prisma/client';

export type ApprovalActor = {
  userEmployeeId: string | null;
  roleCodes: Set<string>;
};

export type ApprovalStepView = {
  step: VacancyApprovalStep;
  sequence: number;
  status: ApprovalStatus;
  approverEmployeeId: string | null;
  requiredRoleCode: string | null;
};

export function isEmployeeBoundStep(step: VacancyApprovalStep): boolean {
  return (
    step === VacancyApprovalStep.DIRECT_MANAGER ||
    step === VacancyApprovalStep.SPECIFIC_EMPLOYEE
  );
}

export function currentPendingStep<T extends ApprovalStepView>(
  approvals: T[],
): T | null {
  return (
    [...approvals]
      .sort((a, b) => a.sequence - b.sequence)
      .find((item) => item.status === ApprovalStatus.PENDING) ?? null
  );
}

export function canDecideStep(
  step: Pick<
    ApprovalStepView,
    'step' | 'approverEmployeeId' | 'requiredRoleCode'
  >,
  actor: ApprovalActor,
): boolean {
  if (isEmployeeBoundStep(step.step)) {
    return (
      Boolean(step.approverEmployeeId) &&
      actor.userEmployeeId === step.approverEmployeeId
    );
  }
  return Boolean(
    step.requiredRoleCode && actor.roleCodes.has(step.requiredRoleCode),
  );
}

export function snapshotStepFromApproverType(
  type: VacancyApproverType,
): VacancyApprovalStep {
  switch (type) {
    case VacancyApproverType.MANAGER_OF_REQUESTER:
      return VacancyApprovalStep.DIRECT_MANAGER;
    case VacancyApproverType.SPECIFIC_EMPLOYEE:
      return VacancyApprovalStep.SPECIFIC_EMPLOYEE;
    case VacancyApproverType.ROLE:
      return VacancyApprovalStep.ROLE;
  }
}
