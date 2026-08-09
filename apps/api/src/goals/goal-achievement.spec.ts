import { GoalMetricDirection, GoalMetricType } from '@prisma/client';
import {
  calculateGoalAchievement,
  calculateKeyResultAchievement,
  computeEffectiveWeights,
} from './goal-achievement';

describe('calculateKeyResultAchievement', () => {
  const inc = {
    metricType: GoalMetricType.NUMBER,
    direction: GoalMetricDirection.INCREASE,
    startValue: 0,
    targetValue: 100,
    finalBooleanValue: null as boolean | null,
  };

  it('1. increase 0', () => {
    expect(
      calculateKeyResultAchievement({ ...inc, finalNumericValue: 0 }),
    ).toBe(0);
  });
  it('2. increase 50', () => {
    expect(
      calculateKeyResultAchievement({ ...inc, finalNumericValue: 50 }),
    ).toBe(50);
  });
  it('3. increase 100', () => {
    expect(
      calculateKeyResultAchievement({ ...inc, finalNumericValue: 100 }),
    ).toBe(100);
  });
  it('4. increase overshoot → 100', () => {
    expect(
      calculateKeyResultAchievement({ ...inc, finalNumericValue: 120 }),
    ).toBe(100);
  });
  it('5. increase below start → 0', () => {
    expect(
      calculateKeyResultAchievement({ ...inc, finalNumericValue: -5 }),
    ).toBe(0);
  });
  it('6. decrease 0', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        finalNumericValue: 10,
        finalBooleanValue: null,
      }),
    ).toBe(0);
  });
  it('7. decrease 50', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        finalNumericValue: 6,
        finalBooleanValue: null,
      }),
    ).toBe(50);
  });
  it('8. decrease 100', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        finalNumericValue: 2,
        finalBooleanValue: null,
      }),
    ).toBe(100);
  });
  it('9. decrease overshoot → 100', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        finalNumericValue: 1,
        finalBooleanValue: null,
      }),
    ).toBe(100);
  });
  it('10. boolean false', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.BOOLEAN,
        direction: null,
        startValue: null,
        targetValue: null,
        finalNumericValue: null,
        finalBooleanValue: false,
      }),
    ).toBe(0);
  });
  it('11. boolean true', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.BOOLEAN,
        direction: null,
        startValue: null,
        targetValue: null,
        finalNumericValue: null,
        finalBooleanValue: true,
      }),
    ).toBe(100);
  });
  it('12. start==target fulfilled', () => {
    expect(
      calculateKeyResultAchievement({
        ...inc,
        startValue: 5,
        targetValue: 5,
        finalNumericValue: 5,
      }),
    ).toBe(100);
  });
  it('13. start==target unfulfilled', () => {
    expect(
      calculateKeyResultAchievement({
        ...inc,
        startValue: 5,
        targetValue: 5,
        finalNumericValue: 4,
      }),
    ).toBe(0);
  });
});

describe('calculateGoalAchievement + weights', () => {
  it('14. weighted goal', () => {
    expect(
      calculateGoalAchievement([
        { achievementPercentage: 100, configuredWeight: 70 },
        { achievementPercentage: 50, configuredWeight: 30 },
      ]),
    ).toBe(85);
  });
  it('15. unweighted goal', () => {
    expect(
      calculateGoalAchievement([
        { achievementPercentage: 100, configuredWeight: null },
        { achievementPercentage: 50, configuredWeight: null },
      ]),
    ).toBe(75);
  });
  it('16. decimal rounding', () => {
    expect(
      calculateKeyResultAchievement({
        metricType: GoalMetricType.PERCENTAGE,
        direction: GoalMetricDirection.INCREASE,
        startValue: 0,
        targetValue: 3,
        finalNumericValue: 1,
        finalBooleanValue: null,
      }),
    ).toBe(33.33);
  });
  it('17. effective weights unweighted sum 100', () => {
    const rows = computeEffectiveWeights([null, null, null, null]);
    expect(rows.every((r) => r.configuredWeight == null)).toBe(true);
    const sum = rows.reduce((a, r) => a + r.effectiveWeight, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
  });
  it('18. result clamp via overshoot', () => {
    expect(
      calculateGoalAchievement([
        { achievementPercentage: 100, configuredWeight: null },
      ]),
    ).toBe(100);
  });
});
