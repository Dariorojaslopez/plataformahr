import { NotFoundException } from '@nestjs/common';
import { OrganizationEntityStatus } from '@prisma/client';
import {
  COMPETENCY_SELECT,
  resolveCompetenciesForEmployee,
} from './job-level-competencies';
import { resolveCompetenciesForEmployee as performanceResolve } from '../performance/job-level-competencies';

describe('resolveCompetenciesForEmployee', () => {
  const companyId = 'company-a';
  const employeeId = 'emp-1';
  const positionId = 'pos-1';
  const jobLevelId = 'level-1';

  function competency(name: string, id: string) {
    return {
      id,
      name,
      code: name.slice(0, 3).toUpperCase(),
      status: OrganizationEntityStatus.ACTIVE,
    };
  }

  it('returns empty competencies when the position has no job level', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: employeeId,
          positionId,
          position: { jobLevelId: null },
        }),
      },
      jobLevelCompetency: { findMany: jest.fn() },
    };

    await expect(
      resolveCompetenciesForEmployee(prisma, companyId, employeeId),
    ).resolves.toEqual({
      employeeId,
      positionId,
      jobLevelId: null,
      competencies: [],
    });
    expect(prisma.jobLevelCompetency.findMany).not.toHaveBeenCalled();
  });

  it('returns assigned competencies for the employee job level', async () => {
    const teamwork = competency('Trabajo en equipo', 'c1');
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: employeeId,
          positionId,
          position: { jobLevelId },
        }),
      },
      jobLevelCompetency: {
        findMany: jest.fn().mockResolvedValue([{ competency: teamwork }]),
      },
    };

    await expect(
      resolveCompetenciesForEmployee(prisma, companyId, employeeId),
    ).resolves.toEqual({
      employeeId,
      positionId,
      jobLevelId,
      competencies: [teamwork],
    });
    expect(prisma.jobLevelCompetency.findMany).toHaveBeenCalledWith({
      where: {
        companyId,
        jobLevelId,
        competency: { deletedAt: null },
      },
      select: { competency: { select: COMPETENCY_SELECT } },
      orderBy: { competency: { name: 'asc' } },
    });
  });

  it('rejects employees from another tenant', async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
      jobLevelCompetency: { findMany: jest.fn() },
    };

    await expect(
      resolveCompetenciesForEmployee(prisma, companyId, employeeId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is the function Performance will import', () => {
    expect(performanceResolve).toBe(resolveCompetenciesForEmployee);
  });
});
