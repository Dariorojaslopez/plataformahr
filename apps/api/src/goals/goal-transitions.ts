import { GoalStatus, type GoalStatus as GoalStatusType } from '@prisma/client';

/**
 * DRAFT → ACTIVE | CANCELLED
 * ACTIVE → CANCELLED | COMPLETED (COMPLETED only via approved completion request 09C)
 * COMPLETED / CANCELLED terminal
 */
export const GOAL_ALLOWED_TRANSITIONS: Record<GoalStatus, GoalStatus[]> = {
  [GoalStatus.DRAFT]: [GoalStatus.ACTIVE, GoalStatus.CANCELLED],
  [GoalStatus.ACTIVE]: [GoalStatus.CANCELLED, GoalStatus.COMPLETED],
  [GoalStatus.COMPLETED]: [],
  [GoalStatus.CANCELLED]: [],
};

export function canTransitionGoal(
  from: GoalStatusType,
  to: GoalStatusType,
): boolean {
  return GOAL_ALLOWED_TRANSITIONS[from].includes(to);
}

export function isGoalStructurallyEditable(status: GoalStatusType): boolean {
  return status === GoalStatus.DRAFT;
}
