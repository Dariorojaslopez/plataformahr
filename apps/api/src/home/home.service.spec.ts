import { HomeService } from './home.service';

const tenant = {
  userId: 'user-1',
  companyId: 'company-1',
  membershipId: 'membership-1',
  viaPlatformOwner: false,
};

const employeeRow = {
  id: 'emp-1',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@acme.test',
  phone: '3001234567',
  documentType: 'CC',
  documentNumber: '123',
  birthDate: new Date('1990-01-15'),
  country: 'CO',
  state: null,
  city: null,
  maritalStatus: null,
  childrenCount: null,
  housingType: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  area: { name: 'Operaciones' },
  position: { name: 'Analista' },
};

describe('HomeService', () => {
  function build(overrides?: {
    employee?: typeof employeeRow | null;
    vacancies?: Array<{
      id: string;
      title: string;
      description: string | null;
      publishedAt: Date | null;
      area: { name: string };
    }>;
    assignedVacancies?: Array<{
      id: string;
      title: string;
      status: string;
      headcount: number;
      filledCount: number;
      area: { name: string };
    }>;
    applicationCounts?: Array<{ vacancyId: string; _count: { _all: number } }>;
    activeApplicationCount?: number;
    hiredCount?: number;
    pendingInterviewCount?: number;
    requests?: unknown[];
    interviews?: unknown[];
    roleCodes?: string[];
  }) {
    const openVacancies = overrides?.vacancies ?? [
      {
        id: 'vac-1',
        title: 'Desarrollador',
        description: 'Backend',
        publishedAt: new Date(),
        area: { name: 'Tecnología' },
      },
    ];
    const prisma = {
      employee: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            overrides?.employee === undefined
              ? employeeRow
              : overrides.employee,
          ),
        update: jest.fn().mockResolvedValue({
          ...employeeRow,
          phone: '3009990000',
        }),
      },
      vacancy: {
        findMany: jest
          .fn()
          .mockImplementation(
            (args?: { where?: { assignedRecruiterEmployeeId?: string } }) => {
              if (args?.where?.assignedRecruiterEmployeeId) {
                return Promise.resolve(overrides?.assignedVacancies ?? []);
              }
              return Promise.resolve(openVacancies);
            },
          ),
      },
      vacancyRequest: {
        findMany: jest.fn().mockResolvedValue(overrides?.requests ?? []),
      },
      interview: {
        findMany: jest.fn().mockResolvedValue(overrides?.interviews ?? []),
        count: jest
          .fn()
          .mockResolvedValue(overrides?.pendingInterviewCount ?? 0),
      },
      application: {
        groupBy: jest
          .fn()
          .mockResolvedValue(overrides?.applicationCounts ?? []),
        count: jest
          .fn()
          .mockResolvedValueOnce(overrides?.activeApplicationCount ?? 0)
          .mockResolvedValueOnce(overrides?.hiredCount ?? 0),
      },
    };
    const rbac = {
      getRoleCodesForMembership: jest
        .fn()
        .mockResolvedValue(new Set(overrides?.roleCodes ?? ['COLLABORATOR'])),
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const service = new HomeService(
      prisma as never,
      rbac as never,
      audit as never,
    );
    return { service, prisma, audit };
  }

  it('returns profile, open vacancies and omits empty conditionals', async () => {
    const { service } = build();
    const feed = await service.getFeed(tenant);
    expect(feed.profile?.firstName).toBe('Ana');
    expect(feed.profile?.documentNumber).toBe('123');
    expect(feed.openVacancies).toEqual([
      {
        id: 'vac-1',
        title: 'Desarrollador',
        description: 'Backend',
        areaName: 'Tecnología',
        published: true,
      },
    ]);
    expect(feed.pendingApprovals).toEqual([]);
    expect(feed.pendingEvaluations).toEqual([]);
    expect(feed.assignedVacancies).toEqual([]);
    expect(feed.assignedMetrics.vacancyCount).toBe(0);
  });

  it('scopes assigned processes and metrics to the recruiter employee', async () => {
    const { service } = build({
      assignedVacancies: [
        {
          id: 'vac-assigned',
          title: 'Soporte N2',
          status: 'OPEN',
          headcount: 2,
          filledCount: 1,
          area: { name: 'Servicio' },
        },
      ],
      applicationCounts: [{ vacancyId: 'vac-assigned', _count: { _all: 4 } }],
      activeApplicationCount: 3,
      hiredCount: 1,
      pendingInterviewCount: 2,
    });
    const feed = await service.getFeed(tenant);
    expect(feed.assignedVacancies).toEqual([
      {
        id: 'vac-assigned',
        title: 'Soporte N2',
        status: 'OPEN',
        areaName: 'Servicio',
        headcount: 2,
        filledCount: 1,
        applicationCount: 4,
      },
    ]);
    expect(feed.assignedMetrics).toEqual({
      vacancyCount: 1,
      openCount: 1,
      applicationCount: 4,
      activeApplicationCount: 3,
      hiredCount: 1,
      pendingInterviewCount: 2,
      filledHeadcount: 1,
      requestedHeadcount: 2,
    });
  });

  it('does not write locked identity fields on profile update', async () => {
    const { service, prisma, audit } = build();
    await service.updateProfile(tenant, { phone: '3009990000' });
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          firstName: expect.anything(),
          lastName: expect.anything(),
          documentNumber: expect.anything(),
          birthDate: expect.anything(),
        }),
      }),
    );
    expect(audit.create).toHaveBeenCalled();
  });

  it('lists an approval only when the actor is the current step', async () => {
    const { service } = build({
      requests: [
        {
          id: 'req-1',
          requestedPositionName: 'Líder de turno',
          existingPosition: null,
          requestedByEmployee: { firstName: 'Luis', lastName: 'Díaz' },
          approvals: [
            {
              step: 'SPECIFIC_EMPLOYEE',
              sequence: 1,
              status: 'PENDING',
              approverEmployeeId: 'emp-1',
              requiredRoleCode: null,
            },
          ],
        },
        {
          id: 'req-other',
          requestedPositionName: 'Otra',
          existingPosition: null,
          requestedByEmployee: { firstName: 'Marta', lastName: 'Gil' },
          approvals: [
            {
              step: 'SPECIFIC_EMPLOYEE',
              sequence: 1,
              status: 'PENDING',
              approverEmployeeId: 'emp-other',
              requiredRoleCode: null,
            },
          ],
        },
      ],
    });
    const feed = await service.getFeed(tenant);
    expect(feed.pendingApprovals).toEqual([
      { id: 'req-1', title: 'Líder de turno', requesterName: 'Luis Díaz' },
    ]);
  });
});
