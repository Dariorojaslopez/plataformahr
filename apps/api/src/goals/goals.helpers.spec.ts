import { GoalMetricDirection, GoalMetricType, GoalType } from '@prisma/client';
import {
  assertGoalActivationReady,
  assertGoalCycleDates,
  assertGoalTypeShape,
  assertKeyResultWeights,
  assertMetricPayload,
} from './goals.helpers';
import { canTransitionGoalCycle } from './cycle-transitions';
import { canTransitionGoal } from './goal-transitions';
import { GoalCycleStatus, GoalStatus } from '@prisma/client';

describe('goals helpers', () => {
  it('validates cycle dates strictly before', () => {
    expect(() =>
      assertGoalCycleDates(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toThrow(/before endDate/);
    expect(() =>
      assertGoalCycleDates(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-12-31T00:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('validates cycle and goal transitions', () => {
    expect(
      canTransitionGoalCycle(GoalCycleStatus.DRAFT, GoalCycleStatus.ACTIVE),
    ).toBe(true);
    expect(
      canTransitionGoalCycle(GoalCycleStatus.ACTIVE, GoalCycleStatus.DRAFT),
    ).toBe(false);
    expect(canTransitionGoal(GoalStatus.DRAFT, GoalStatus.ACTIVE)).toBe(true);
    expect(canTransitionGoal(GoalStatus.ACTIVE, GoalStatus.COMPLETED)).toBe(
      true,
    );
    expect(canTransitionGoal(GoalStatus.COMPLETED, GoalStatus.ACTIVE)).toBe(
      false,
    );
  });

  it('validates KR weights', () => {
    expect(() =>
      assertKeyResultWeights([{ weight: null }, { weight: null }]),
    ).not.toThrow();
    expect(() =>
      assertKeyResultWeights([{ weight: 40 }, { weight: 60 }]),
    ).not.toThrow();
    expect(() =>
      assertKeyResultWeights([{ weight: 40 }, { weight: null }]),
    ).toThrow(/all key results/);
    expect(() =>
      assertKeyResultWeights([{ weight: 40 }, { weight: 40 }]),
    ).toThrow(/sum to 100/);
  });

  it('validates metric payloads', () => {
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.INCREASE,
        targetValue: 100,
        startValue: 0,
        unit: 'clientes',
      }),
    ).not.toThrow();
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.PERCENTAGE,
        direction: GoalMetricDirection.DECREASE,
        targetValue: 2,
        startValue: 5,
      }),
    ).not.toThrow();
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.CURRENCY,
        direction: GoalMetricDirection.INCREASE,
        targetValue: 50000000,
        currencyCode: 'COP',
      }),
    ).not.toThrow();
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.BOOLEAN,
        targetBoolean: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.NUMBER,
        targetValue: 10,
      }),
    ).toThrow(/direction/);
    expect(() =>
      assertMetricPayload({
        metricType: GoalMetricType.CURRENCY,
        direction: GoalMetricDirection.INCREASE,
        targetValue: 1,
      }),
    ).toThrow(/currencyCode/);
  });

  it('validates activation readiness by type', () => {
    expect(() =>
      assertGoalActivationReady({
        type: GoalType.INDIVIDUAL,
        areaId: null,
        assignmentCount: 0,
        keyResults: [{ weight: null }],
      }),
    ).toThrow(/assignment/);
    expect(() =>
      assertGoalActivationReady({
        type: GoalType.AREA,
        areaId: null,
        assignmentCount: 0,
        keyResults: [{ weight: null }],
      }),
    ).toThrow(/areaId/);
    expect(() =>
      assertGoalActivationReady({
        type: GoalType.COMPANY,
        areaId: 'x',
        assignmentCount: 0,
        keyResults: [{ weight: null }],
      }),
    ).toThrow(/must not have areaId/);
    expect(() =>
      assertGoalActivationReady({
        type: GoalType.INDIVIDUAL,
        areaId: null,
        assignmentCount: 1,
        keyResults: [],
      }),
    ).toThrow(/key result/);
    expect(() =>
      assertGoalTypeShape({ type: GoalType.AREA, areaId: null }),
    ).toThrow(/areaId/);
  });
});
