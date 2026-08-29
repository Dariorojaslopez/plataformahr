import { BadRequestException } from '@nestjs/common';
import { VacanciesService } from './vacancies.service';

const tenant = {
  companyId: 'company-1',
  membershipId: 'm1',
  userId: 'user-1',
  viaPlatformOwner: false,
} as const;

describe('VacanciesService', () => {
  const existing = {
    id: 'vac-1',
    companyId: 'company-1',
    status: 'OPEN',
    assignedRecruiterEmployeeId: null,
    closedAt: null,
    salaryAmount: null,
    salaryCurrency: 'COP',
    showSalaryPublic: false,
  };

  function build(roleCode = 'RECRUITER') {
    const prisma = {
      vacancy: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest
          .fn()
          .mockImplementation((args: { data: Partial<typeof existing> }) =>
            Promise.resolve({
              ...existing,
              ...args.data,
              assignedRecruiter: args.data.assignedRecruiterEmployeeId
                ? {
                    id: 'emp-rec',
                    firstName: 'Marta',
                    lastName: 'Gil',
                    email: 'marta@acme.test',
                  }
                : null,
            }),
          ),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-rec',
          userId: 'user-rec',
        }),
      },
      companyMembership: {
        findFirst: jest.fn().mockResolvedValue({
          roles: [{ role: { code: roleCode } }],
        }),
      },
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const rbac = {
      getRoleCodesForMembership: jest
        .fn()
        .mockResolvedValue(new Set(['CLIENT_ADMIN'])),
    };
    return {
      service: new VacanciesService(
        prisma as never,
        audit as never,
        rbac as never,
      ),
      prisma,
      audit,
      rbac,
    };
  }

  it('assigns a recruiter with RECRUITER role', async () => {
    const { service, prisma, audit } = build('RECRUITER');
    const updated = await service.update(tenant, 'user-1', 'vac-1', {
      assignedRecruiterEmployeeId: 'emp-rec',
    });
    expect(updated.assignedRecruiterEmployeeId).toBe('emp-rec');
    const [updateArg] = prisma.vacancy.update.mock.calls[0] as [
      { data: { assignedRecruiterEmployeeId?: string } },
    ];
    expect(updateArg.data.assignedRecruiterEmployeeId).toBe('emp-rec');
    expect(audit.create).toHaveBeenCalled();
  });

  it('rejects a collaborator that is not a recruiter', async () => {
    const { service } = build('COLLABORATOR');
    await expect(
      service.update(tenant, 'user-1', 'vac-1', {
        assignedRecruiterEmployeeId: 'emp-rec',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists employees that hold the RECRUITER role', async () => {
    const { service, prisma } = build();
    prisma.companyMembership.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: 'user-rec' }]);
    prisma.employee.findMany = jest.fn().mockResolvedValue([
      {
        id: 'emp-rec',
        firstName: 'Marta',
        lastName: 'Gil',
        email: 'marta@acme.test',
      },
    ]);
    await expect(service.listRecruiters('company-1')).resolves.toEqual([
      {
        id: 'emp-rec',
        firstName: 'Marta',
        lastName: 'Gil',
        email: 'marta@acme.test',
      },
    ]);
  });

  it('rejects publishing salary without an amount', async () => {
    const { service } = build();
    await expect(
      service.update(tenant, 'user-1', 'vac-1', {
        showSalaryPublic: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only vacancies assigned to the recruiter', async () => {
    const { service, prisma, rbac } = build('RECRUITER');
    rbac.getRoleCodesForMembership.mockResolvedValue(new Set(['RECRUITER']));
    const findMany = jest.fn().mockResolvedValue([]);
    prisma.vacancy.findMany = findMany;
    prisma.vacancy.count = jest.fn().mockResolvedValue(0);
    prisma.$transaction = jest.fn((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );

    await service.list(tenant, { page: 1, limit: 20 });

    const [listArg] = findMany.mock.calls[0] as [
      { where: { assignedRecruiterEmployeeId?: string } },
    ];
    expect(listArg.where.assignedRecruiterEmployeeId).toBe('emp-rec');
  });
});
