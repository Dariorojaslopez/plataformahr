import { EmployeeStatus, type Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type VacancyCapacityFields = {
  headcount: number;
  filledCount: number;
};

type Db = Prisma.TransactionClient | PrismaService;

export function remainingPositionPlazas(
  positionHeadcount: number,
  occupantCount: number,
): number {
  return Math.max(0, positionHeadcount - occupantCount);
}

export function remainingVacancyPlazas(input: VacancyCapacityFields): number {
  return Math.max(0, input.headcount - input.filledCount);
}

/** Open cargo boxes plus unused process slots both count as capacity. */
export function remainingHirePlazas(
  vacancy: VacancyCapacityFields,
  positionHeadcount: number,
  occupantCount: number,
): number {
  return Math.max(
    remainingVacancyPlazas(vacancy),
    remainingPositionPlazas(positionHeadcount, occupantCount),
  );
}

export function effectiveVacancyHeadcount(
  vacancy: VacancyCapacityFields,
  positionHeadcount: number,
  occupantCount: number,
): number {
  return (
    vacancy.filledCount +
    remainingHirePlazas(vacancy, positionHeadcount, occupantCount)
  );
}

export function hasHireCapacity(
  vacancy: VacancyCapacityFields,
  positionHeadcount: number,
  occupantCount: number,
): boolean {
  return remainingHirePlazas(vacancy, positionHeadcount, occupantCount) > 0;
}

export async function loadPositionOccupantCount(
  db: Db,
  companyId: string,
  positionId: string,
): Promise<number> {
  return db.employee.count({
    where: {
      companyId,
      positionId,
      deletedAt: null,
      status: EmployeeStatus.ACTIVE,
    },
  });
}

export async function absorbPositionPlazasIntoVacancy<
  T extends VacancyCapacityFields & { id: string; positionId: string },
>(tx: Prisma.TransactionClient, companyId: string, vacancy: T): Promise<T> {
  const position = await tx.position.findFirst({
    where: { id: vacancy.positionId, companyId, deletedAt: null },
    select: { headcount: true },
  });
  const occupantCount = await loadPositionOccupantCount(
    tx,
    companyId,
    vacancy.positionId,
  );
  const nextHeadcount = effectiveVacancyHeadcount(
    vacancy,
    position?.headcount ?? vacancy.headcount,
    occupantCount,
  );
  if (nextHeadcount <= vacancy.headcount) {
    return vacancy;
  }
  await tx.vacancy.update({
    where: { id: vacancy.id },
    data: { headcount: nextHeadcount },
  });
  return { ...vacancy, headcount: nextHeadcount };
}
