import { GoalType } from '@prisma/client';
import {
  companyGoalAppliesToEmployee,
  companyGoalWhereClause,
  isGoalsCascadeEnabled,
} from './goals.cascade';

describe('goals cascade', () => {
  it('defaults to off', () => {
    expect(isGoalsCascadeEnabled(null)).toBe(false);
    expect(isGoalsCascadeEnabled({})).toBe(false);
    expect(isGoalsCascadeEnabled({ goalsCascadeEnabled: false })).toBe(false);
    expect(isGoalsCascadeEnabled({ goalsCascadeEnabled: true })).toBe(true);
  });

  it('only includes COMPANY goals in live filters when cascade is on', () => {
    expect(companyGoalWhereClause(false)).toEqual([]);
    expect(companyGoalWhereClause(true)).toEqual([{ type: GoalType.COMPANY }]);
  });

  it('does not treat COMPANY goals as personal when cascade is off', () => {
    expect(companyGoalAppliesToEmployee(false, GoalType.COMPANY)).toBe(false);
    expect(companyGoalAppliesToEmployee(true, GoalType.COMPANY)).toBe(true);
    expect(companyGoalAppliesToEmployee(true, GoalType.AREA)).toBe(false);
  });
});
