import { NotFoundException } from '@nestjs/common';
import { OrganizationEntityStatus, type PrismaClient } from '@prisma/client';

const COMPETENCY_SELECT = {
  id: true,
  name: true,
  code: true,
  status: true,
} as const;

export type JobLevelCompetencySummary = {
  id: string;
  name: string;
  code: string | null;
  status: OrganizationEntityStatus;
};

export type EmployeeJobLevelCompetencies = {
  employeeId: string;
  positionId: string | null;
  jobLevelId: string | null;
  competencies: JobLevelCompetencySummary[];
};

type JobLevelCompetencyPrisma = Pick<
  PrismaClient,
  'employee' | 'jobLevelCompetency'
>;

/**
 * Resolves live catalog competencies for an employee's current job level.
 *
 * Path: Employee → Position.jobLevelId → JobLevelCompetency → Competency.
 * Returns an empty list when the position has no level or the level has no
 * assignments. Does not read PerformanceCycleCompetency or evaluation snapshots.
 */
export async function resolveCompetenciesForEmployee(
  prisma: JobLevelCompetencyPrisma,
  companyId: string,
  employeeId: string,
): Promise<EmployeeJobLevelCompetencies> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
      positionId: true,
      position: { select: { jobLevelId: true } },
    },
  });
  if (!employee) {
    throw new NotFoundException('Employee not found');
  }

  const jobLevelId = employee.position.jobLevelId;
  if (!jobLevelId) {
    return {
      employeeId: employee.id,
      positionId: employee.positionId,
      jobLevelId: null,
      competencies: [],
    };
  }

  const links = await prisma.jobLevelCompetency.findMany({
    where: {
      companyId,
      jobLevelId,
      competency: { deletedAt: null },
    },
    select: { competency: { select: COMPETENCY_SELECT } },
    orderBy: { competency: { name: 'asc' } },
  });

  return {
    employeeId: employee.id,
    positionId: employee.positionId,
    jobLevelId,
    competencies: links.map((link) => link.competency),
  };
}

export { COMPETENCY_SELECT };
