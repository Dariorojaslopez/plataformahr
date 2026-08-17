import {
  ApprovalStatus,
  VacancyApprovalStep,
  VacancyApproverType,
} from '@prisma/client';
import {
  canDecideStep,
  currentPendingStep,
  snapshotStepFromApproverType,
} from './vacancy-approval.helpers';

describe('vacancy-approval.helpers', () => {
  const managerActor = {
    userEmployeeId: 'mgr-1',
    roleCodes: new Set<string>(['LEADER']),
  };
  const adminActor = {
    userEmployeeId: 'admin-1',
    roleCodes: new Set<string>(['CLIENT_ADMIN']),
  };

  it('picks the first PENDING step by sequence', () => {
    const current = currentPendingStep([
      {
        step: VacancyApprovalStep.ROLE,
        sequence: 2,
        status: ApprovalStatus.PENDING,
        approverEmployeeId: null,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
      {
        step: VacancyApprovalStep.DIRECT_MANAGER,
        sequence: 1,
        status: ApprovalStatus.PENDING,
        approverEmployeeId: 'mgr-1',
        requiredRoleCode: null,
      },
    ]);
    expect(current?.sequence).toBe(1);
    expect(current?.step).toBe(VacancyApprovalStep.DIRECT_MANAGER);
  });

  it('authorizes only the assigned employee for manager/specific steps', () => {
    const step = {
      step: VacancyApprovalStep.DIRECT_MANAGER,
      approverEmployeeId: 'mgr-1',
      requiredRoleCode: null,
    };
    expect(canDecideStep(step, managerActor)).toBe(true);
    expect(canDecideStep(step, adminActor)).toBe(false);
  });

  it('authorizes role steps by membership role, not by employee id', () => {
    const step = {
      step: VacancyApprovalStep.ROLE,
      approverEmployeeId: null,
      requiredRoleCode: 'CLIENT_ADMIN',
    };
    expect(canDecideStep(step, adminActor)).toBe(true);
    expect(canDecideStep(step, managerActor)).toBe(false);
  });

  it('maps config types onto snapshot step kinds', () => {
    expect(
      snapshotStepFromApproverType(VacancyApproverType.MANAGER_OF_REQUESTER),
    ).toBe(VacancyApprovalStep.DIRECT_MANAGER);
    expect(
      snapshotStepFromApproverType(VacancyApproverType.SPECIFIC_EMPLOYEE),
    ).toBe(VacancyApprovalStep.SPECIFIC_EMPLOYEE);
    expect(snapshotStepFromApproverType(VacancyApproverType.ROLE)).toBe(
      VacancyApprovalStep.ROLE,
    );
  });
});
