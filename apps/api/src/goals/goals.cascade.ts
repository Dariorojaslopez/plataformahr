import { GoalType, type Prisma } from '@prisma/client';

export function isGoalsCascadeEnabled(
  company: { goalsCascadeEnabled?: boolean } | null | undefined,
): boolean {
  return company?.goalsCascadeEnabled === true;
}

/** COMPANY goals only apply to every employee when cascade is on. */
export function companyGoalWhereClause(
  cascadeEnabled: boolean,
): Prisma.GoalWhereInput[] {
  return cascadeEnabled ? [{ type: GoalType.COMPANY }] : [];
}

export function companyGoalAppliesToEmployee(
  cascadeEnabled: boolean,
  goalType: GoalType,
): boolean {
  return goalType === GoalType.COMPANY && cascadeEnabled;
}
