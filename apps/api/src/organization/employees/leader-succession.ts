import {
  EmployeeStatus,
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  Prisma,
  PrismaClient,
  ReportingLineType,
} from '@prisma/client';

type SuccessionDb = PrismaClient | Prisma.TransactionClient;

/**
 * When a leader is inactive or deleted and nobody else occupies the same
 * position, move their direct reports to that leader's own manager.
 */
export async function reassignReportsIfLeaderVacant(
  db: SuccessionDb,
  companyId: string,
  leaderId: string,
): Promise<number> {
  const leader = await db.employee.findFirst({
    where: { id: leaderId, companyId },
    select: { id: true, positionId: true, status: true, deletedAt: true },
  });
  if (!leader) return 0;
  const vacant =
    leader.deletedAt != null || leader.status !== EmployeeStatus.ACTIVE;
  if (!vacant) return 0;

  if (leader.positionId) {
    const occupant = await db.employee.findFirst({
      where: {
        companyId,
        positionId: leader.positionId,
        id: { not: leaderId },
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (occupant) return 0;
  }

  const superior = await db.employeeReportingLine.findFirst({
    where: {
      companyId,
      employeeId: leaderId,
      type: ReportingLineType.DIRECT,
    },
    select: { managerEmployeeId: true },
  });
  if (!superior) return 0;

  const reports = await db.employeeReportingLine.findMany({
    where: {
      companyId,
      managerEmployeeId: leaderId,
      type: ReportingLineType.DIRECT,
    },
    select: { id: true, employeeId: true },
  });

  let moved = 0;
  for (const report of reports) {
    if (report.employeeId === superior.managerEmployeeId) continue;
    await db.employeeReportingLine.delete({ where: { id: report.id } });
    const exists = await db.employeeReportingLine.findFirst({
      where: {
        companyId,
        employeeId: report.employeeId,
        managerEmployeeId: superior.managerEmployeeId,
        type: ReportingLineType.DIRECT,
      },
      select: { id: true },
    });
    if (!exists) {
      await db.employeeReportingLine.create({
        data: {
          companyId,
          employeeId: report.employeeId,
          managerEmployeeId: superior.managerEmployeeId,
          type: ReportingLineType.DIRECT,
        },
      });
    }
    await db.performanceEvaluation.updateMany({
      where: {
        companyId,
        employeeId: report.employeeId,
        type: PerformanceEvaluationType.MANAGER,
        evaluatorEmployeeId: leaderId,
        status: { not: PerformanceEvaluationStatus.SUBMITTED },
      },
      data: { evaluatorEmployeeId: superior.managerEmployeeId },
    });
    moved += 1;
  }
  return moved;
}
