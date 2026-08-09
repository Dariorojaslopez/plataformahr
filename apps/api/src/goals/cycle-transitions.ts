import {
  GoalCycleStatus,
  type GoalCycleStatus as GoalCycleStatusType,
} from '@prisma/client';

export const GOAL_CYCLE_ALLOWED_TRANSITIONS: Record<
  GoalCycleStatus,
  GoalCycleStatus[]
> = {
  [GoalCycleStatus.DRAFT]: [GoalCycleStatus.ACTIVE, GoalCycleStatus.CANCELLED],
  [GoalCycleStatus.ACTIVE]: [GoalCycleStatus.CLOSED, GoalCycleStatus.CANCELLED],
  [GoalCycleStatus.CLOSED]: [],
  [GoalCycleStatus.CANCELLED]: [],
};

export function canTransitionGoalCycle(
  from: GoalCycleStatusType,
  to: GoalCycleStatusType,
): boolean {
  return GOAL_CYCLE_ALLOWED_TRANSITIONS[from].includes(to);
}

export function isGoalCycleEditable(status: GoalCycleStatusType): boolean {
  return status === GoalCycleStatus.DRAFT;
}
