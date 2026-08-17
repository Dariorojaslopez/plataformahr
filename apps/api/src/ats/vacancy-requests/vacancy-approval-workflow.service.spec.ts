import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VacancyApproverType } from '@prisma/client';
import { VACANCY_APPROVAL_ERRORS } from '../ats.constants';
import { VacancyApprovalWorkflowService } from './vacancy-approval-workflow.service';

describe('VacancyApprovalWorkflowService', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const tenant = {
    companyId,
    userId,
    membershipId: '33333333-3333-4333-8333-333333333333',
    viaPlatformOwner: false,
  };

  it('returns a disabled empty workflow when none is stored', async () => {
    const service = new VacancyApprovalWorkflowService(
      {
        vacancyApprovalWorkflow: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        role: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { code: 'CLIENT_ADMIN', name: 'Client Admin' },
            ]),
        },
      } as never,
      { create: jest.fn() } as never,
      {} as never,
    );

    const result = await service.get(companyId);
    expect(result).toEqual({
      enabled: false,
      steps: [],
      allowedRoles: [{ code: 'CLIENT_ADMIN', name: 'Client Admin' }],
    });
  });

  it('rejects enabling without steps', async () => {
    const service = new VacancyApprovalWorkflowService(
      {} as never,
      { create: jest.fn() } as never,
      {} as never,
    );
    await expect(
      service.update(tenant, { enabled: true, steps: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(tenant, { enabled: true, steps: [] }),
    ).rejects.toMatchObject({
      message: VACANCY_APPROVAL_ERRORS.ENABLED_WITHOUT_STEPS,
    });
  });

  it('rejects a specific employee from another tenant without leaking ids', async () => {
    const requireEmployee = jest
      .fn()
      .mockRejectedValue(new NotFoundException('Employee not found'));
    const service = new VacancyApprovalWorkflowService(
      {} as never,
      { create: jest.fn() } as never,
      { requireEmployee } as never,
    );

    await expect(
      service.update(tenant, {
        enabled: true,
        steps: [
          {
            approverType: VacancyApproverType.SPECIFIC_EMPLOYEE,
            specificEmployeeId: '44444444-4444-4444-8444-444444444444',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(requireEmployee).toHaveBeenCalledWith(
      companyId,
      '44444444-4444-4444-8444-444444444444',
    );
  });
});
