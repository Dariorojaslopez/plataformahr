import { EmployeeStatus } from '@prisma/client';
import { CompaniesService } from './companies.service';

const tenant = {
  userId: 'user-1',
  companyId: 'company-1',
  membershipId: 'membership-1',
  viaPlatformOwner: false,
};

function chartRows(managerId: string, reportCount: number) {
  const manager = {
    id: managerId,
    firstName: 'Oscar',
    lastName: 'Agudelo',
    status: EmployeeStatus.ACTIVE,
    businessUnit: null,
    area: { id: 'area-1', name: 'Gestión' },
    position: {
      id: 'pos-mgr',
      name: 'Vicepresidente',
      headcount: 1,
      parentPositionId: null,
      jobLevel: null,
    },
    reportingTo: [],
  };
  const reports = Array.from({ length: reportCount }, (_, index) => ({
    id: `rep-${index}`,
    firstName: `Persona${index}`,
    lastName: 'Equipo',
    status: EmployeeStatus.ACTIVE,
    businessUnit: null,
    area: { id: 'area-1', name: 'Gestión' },
    position: {
      id: `pos-${index}`,
      name: 'Analista',
      headcount: 1,
      parentPositionId: 'pos-mgr',
      jobLevel: null,
    },
    reportingTo: [],
  }));
  return [manager, ...reports];
}

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
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options.employeeId ? { id: options.employeeId } : null,
          ),
        findMany: jest
          .fn()
          .mockResolvedValue(
            options.employeeId
              ? chartRows(options.employeeId, options.directReportCount ?? 0)
              : [],
          ),
      },
    };
    const rbac = {
      getRoleCodesForMembership: jest
        .fn()
        .mockResolvedValue(new Set(options.roleCodes)),
    };
    const roleMenus = {
      listOverrides: jest.fn().mockResolvedValue({}),
    };
    const service = new CompaniesService(
      prisma as never,
      rbac as never,
      roleMenus as never,
    );
    return { service, prisma, rbac };
  }

  it('returns CLIENT_ADMIN home even when the admin has people reporting', async () => {
    const { service, prisma } = buildService({
      roleCodes: ['CLIENT_ADMIN', 'LEADER'],
      employeeId: 'emp-admin',
      directReportCount: 3,
    });

    await expect(
      service.getCurrentAccessContext(tenant),
    ).resolves.toMatchObject({
      enabledModules: ['ATS'],
      enabledFeatures: ['ats.vacancies'],
      roleCodes: ['CLIENT_ADMIN', 'LEADER'],
      hasDirectReports: true,
      homeRole: 'CLIENT_ADMIN',
    });
    const adminAccess = await service.getCurrentAccessContext(tenant);
    expect(adminAccess.allowedNavHrefs).toEqual(
      expect.arrayContaining([
        '/dashboard',
        '/settings/roles',
        '/ats/vacancies',
      ]),
    );
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: tenant.companyId,
        userId: tenant.userId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(prisma.employee.findMany).toHaveBeenCalled();
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

    await expect(
      service.getCurrentAccessContext(tenant),
    ).resolves.toMatchObject({
      enabledModules: ['ATS'],
      enabledFeatures: ['ats.vacancies'],
      roleCodes: [],
      hasDirectReports: false,
      homeRole: 'COLLABORATOR',
    });
    const collaboratorAccess = await service.getCurrentAccessContext(tenant);
    expect(collaboratorAccess.allowedNavHrefs).toEqual(
      expect.arrayContaining(['/dashboard', '/performance/my-evaluations']),
    );
    expect(collaboratorAccess.allowedNavHrefs).not.toContain(
      '/organization/employees',
    );
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });
});
