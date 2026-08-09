import { GoalStatus, GoalType, Prisma } from '@prisma/client';
import type { ApplicableGoalResultInput } from './goals-performance-integration';

type Tx = Prisma.TransactionClient;

/**
 * Resolve GoalResults applicable to an employee for a GoalCycle.
 *
 * Authority:
 * - COMPANY: GoalResult.appliesCompanyWide
 * - INDIVIDUAL / AREA: GoalResultApplicableEmployee snapshot (frozen at approval)
 *
 * Never uses live Employee.areaId for scoring.
 */
export async function loadApplicableGoalResultsForEmployee(
  tx: Tx,
  params: {
    companyId: string;
    goalCycleId: string;
    employeeId: string;
  },
): Promise<ApplicableGoalResultInput[]> {
  const { companyId, goalCycleId, employeeId } = params;

  const results = await tx.goalResult.findMany({
    where: {
      companyId,
      goal: { cycleId: goalCycleId },
      OR: [
        { appliesCompanyWide: true },
        {
          applicableEmployees: {
            some: { employeeId, companyId },
          },
        },
      ],
    },
    select: {
      id: true,
      goalId: true,
      achievementPercentage: true,
      goalConfiguredWeight: true,
      goalTitleSnapshot: true,
      goalTypeSnapshot: true,
      goal: {
        select: {
          id: true,
          title: true,
          type: true,
          weight: true,
        },
      },
    },
    orderBy: { completedAt: 'asc' },
  });

  return results.map((r) => {
    const goalType = r.goalTypeSnapshot ?? r.goal.type;
    return {
      sourceGoalId: r.goalId,
      sourceGoalResultId: r.id,
      goalTitle: r.goalTitleSnapshot ?? r.goal.title,
      goalType,
      achievementPercentage: Number(r.achievementPercentage.toString()),
      configuredWeight:
        r.goalConfiguredWeight == null
          ? null
          : Number(r.goalConfiguredWeight.toString()),
    };
  });
}

/**
 * Detect Goals that should apply to the employee but lack a GoalResult.
 * Used only as a gate when goalsResultWeight > 0.
 *
 * Live org data is used solely for this incomplete-gate (not scoring):
 * - INDIVIDUAL: GoalAssignment
 * - AREA: Goal.areaId === employee.areaId (current)
 * - COMPANY: all non-cancelled in cycle
 *
 * DRAFT / CANCELLED goals do not block.
 * ACTIVE (or COMPLETED without result) that apply → incomplete.
 */
export async function findIncompleteApplicableGoals(
  tx: Tx,
  params: {
    companyId: string;
    goalCycleId: string;
    employeeId: string;
    employeeAreaId: string | null;
  },
): Promise<Array<{ id: string; title: string }>> {
  const { companyId, goalCycleId, employeeId, employeeAreaId } = params;

  const goals = await tx.goal.findMany({
    where: {
      companyId,
      cycleId: goalCycleId,
      status: { in: [GoalStatus.ACTIVE, GoalStatus.COMPLETED] },
      OR: [
        { type: GoalType.COMPANY },
        {
          type: GoalType.INDIVIDUAL,
          assignments: { some: { employeeId, companyId } },
        },
        ...(employeeAreaId
          ? [{ type: GoalType.AREA, areaId: employeeAreaId }]
          : []),
      ],
    },
    select: {
      id: true,
      title: true,
      result: { select: { id: true } },
    },
  });

  return goals
    .filter((g) => g.result == null)
    .map((g) => ({ id: g.id, title: g.title }));
}
