import { EmployeeStatus } from '@prisma/client';
import { OrgChartService } from './org-chart.service';

type EmployeeFindManyArgs = {
  where: {
    companyId?: string;
    deletedAt?: Date | null;
    status?: EmployeeStatus;
  };
};

function lastFindManyWhere(findMany: jest.Mock): EmployeeFindManyArgs['where'] {
  const [args] = findMany.mock.calls[0] as [EmployeeFindManyArgs];
  return args.where;
}

describe('OrgChartService', () => {
  it('loads the company once and employees in a single findMany (no N+1)', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'c1', name: 'Acme' });
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'e1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        status: EmployeeStatus.ACTIVE,
        businessUnit: null,
        area: { id: 'a1', name: 'Ops' },
        position: { id: 'p1', name: 'Analista', parentPositionId: null, jobLevel: null },
        reportingTo: [],
      },
    ]);
    const service = new OrgChartService({
      company: { findFirst },
      employee: { findMany },
    } as never);
    const result = await service.get('c1', false);

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(lastFindManyWhere(findMany)).toEqual({
      companyId: 'c1',
      deletedAt: null,
      status: EmployeeStatus.ACTIVE,
    });
    expect(result.roots).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(
      /email|phone|birthDate|salary|emergency/i,
    );
  });

  it('omits status filter when includeInactive is true', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrgChartService({
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Acme' }),
      },
      employee: { findMany },
    } as never);
    await service.get('c1', true);
    expect(lastFindManyWhere(findMany)).toEqual({
      companyId: 'c1',
      deletedAt: null,
    });
  });
});
