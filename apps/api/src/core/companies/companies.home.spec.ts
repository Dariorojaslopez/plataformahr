import { EmployeeStatus, ReportingLineType } from '@prisma/client';
import { CompaniesService } from './companies.service';

const tenant = {
  userId: 'user-1',
  companyId: 'company-1',
  membershipId: 'membership-1',
  viaPlatformOwner: false,
};

describe('CompaniesService.getCurrentAccessContext', () => {
  function buildService(options: {
    roleCodes: string[];
    employeeId?: string | null;
    directReportCount?: number;
  }) {
    const prisma = {
      companyModule: {
        findMany: jest.fn().mockResolvedValue([{ module: 'ATS' }]),
      },
      companyFeature: {
        findMany: jest.fn().mockResolvedValue([{ feature: 'ats.vacancies' }]),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(
          options.employeeId ? { id: options.employeeId } : null,
        ),
      },
      employeeReportingLine: {
        count: jest.fn().mockResolvedValue(options.directReportCount ?? 0),
      },
    };
    const rbac = {
      getRoleCodesForMembership: jest
        .fn()
        .mockResolvedValue(new Set(options.roleCodes)),
    };
    const service = new CompaniesService(prisma as never, rbac as never);
    return { service, prisma, rbac };
  }

  it('returns CLIENT_ADMIN home even when the admin has people reporting', async () => {
    const { service, prisma } = buildService({
      roleCodes: ['CLIENT_ADMIN', 'LEADER'],
      employeeId: 'emp-admin',
      directReportCount: 3,
    });

    await expect(service.getCurrentAccessContext(tenant)).resolves.toEqual({
      enabledModules: ['ATS'],
      enabledFeatures: ['ats.vacancies'],
      roleCodes: ['CLIENT_ADMIN', 'LEADER'],
      hasDirectReports: true,
      homeRole: 'CLIENT_ADMIN',
    });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(prisma.employeeReportingLine.count).toHaveBeenCalledWith({
      where: {
        companyId: tenant.companyId,
        managerEmployeeId: 'emp-admin',
        type: ReportingLineType.DIRECT,
        employee: {
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      },
    });
  });

  it('treats a collaborator with people in charge as LEADER home', async () => {
    const { service } = buildService({
      roleCodes: ['COLLABORATOR'],
      employeeId: 'emp-lead',
      directReportCount: 1,
    });

    await expect(
      service.getCurrentAccessContext(tenant),
    ).resolves.toMatchObject({
      hasDirectReports: true,
      homeRole: 'LEADER',
    });
  });

  it('keeps RECRUITER home above leader reports', async () => {
    const { service } = buildService({
      roleCodes: ['RECRUITER', 'LEADER'],
      employeeId: 'emp-rec',
      directReportCount: 2,
    });

    await expect(
      service.getCurrentAccessContext(tenant),
    ).resolves.toMatchObject({
      hasDirectReports: true,
      homeRole: 'RECRUITER',
    });
  });

  it('defaults to COLLABORATOR when there is no role and no reports', async () => {
    const { service, prisma } = buildService({
      roleCodes: [],
      employeeId: null,
    });

    await expect(service.getCurrentAccessContext(tenant)).resolves.toEqual({
      enabledModules: ['ATS'],
      enabledFeatures: ['ats.vacancies'],
      roleCodes: [],
      hasDirectReports: false,
      homeRole: 'COLLABORATOR',
    });
    expect(prisma.employeeReportingLine.count).not.toHaveBeenCalled();
  });
});
