import { GoalMetricDirection, GoalMetricType } from '@prisma/client';
import {
  calculateGoalProgress,
  calculateKeyResultProgress,
} from './goal-progress';

describe('calculateKeyResultProgress', () => {
  const baseNum = {
    metricType: GoalMetricType.NUMBER,
    direction: GoalMetricDirection.INCREASE,
    startValue: 0,
    targetValue: 100,
    currentBooleanValue: null as boolean | null,
  };

  it('1. increase 0→100 current 0 = 0', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: 0,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('2. current 50 = 50', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: 50,
        hasCheckIn: true,
      }),
    ).toBe(50);
  });

  it('3. current 100 = 100', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: 100,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('4. current 120 = 100 (overshoot clamp)', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: 120,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('5. current -10 = 0', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: -10,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('6. decrease 10→2 current 10 = 0', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 10,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('7. decrease current 6 = 50', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 6,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(50);
  });

  it('8. decrease current 2 = 100', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 2,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('9. decrease current 1 = 100 (overshoot)', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 1,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('10. decrease current 12 = 0 (regression past start)', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.NUMBER,
        direction: GoalMetricDirection.DECREASE,
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 12,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('11. start == target + fulfilled → 100', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        startValue: 5,
        targetValue: 5,
        currentNumericValue: 5,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('12. start == target + not fulfilled → 0', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        startValue: 5,
        targetValue: 5,
        currentNumericValue: 4,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('13. boolean false → 0', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.BOOLEAN,
        direction: null,
        startValue: null,
        targetValue: null,
        currentNumericValue: null,
        currentBooleanValue: false,
        hasCheckIn: true,
      }),
    ).toBe(0);
  });

  it('14. boolean true → 100', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.BOOLEAN,
        direction: null,
        startValue: null,
        targetValue: null,
        currentNumericValue: null,
        currentBooleanValue: true,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it('15. decimal precision rounded to 2 places', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.PERCENTAGE,
        direction: GoalMetricDirection.INCREASE,
        startValue: 0,
        targetValue: 3,
        currentNumericValue: 1,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(33.33);
  });

  it('no check-in uses start (typically 0%)', () => {
    expect(
      calculateKeyResultProgress({
        ...baseNum,
        currentNumericValue: null,
        hasCheckIn: false,
      }),
    ).toBe(0);
  });

  it('boolean without check-in → 0', () => {
    expect(
      calculateKeyResultProgress({
        metricType: GoalMetricType.BOOLEAN,
        direction: null,
        startValue: null,
        targetValue: null,
        currentNumericValue: null,
        currentBooleanValue: null,
        hasCheckIn: false,
      }),
    ).toBe(0);
  });
});

describe('calculateGoalProgress', () => {
  it('16. unweighted average', () => {
    expect(
      calculateGoalProgress([
        { progressPercentage: 100, weight: null },
        { progressPercentage: 50, weight: null },
      ]),
    ).toBe(75);
  });

  it('17. weighted average', () => {
    expect(
      calculateGoalProgress([
        { progressPercentage: 100, weight: 60 },
        { progressPercentage: 50, weight: 40 },
      ]),
    ).toBe(80);
  });

  it('18. 0 KRs → 0', () => {
    expect(calculateGoalProgress([])).toBe(0);
  });

  it('19. rounding 2 decimals', () => {
    expect(
      calculateGoalProgress([
        { progressPercentage: 33.33, weight: null },
        { progressPercentage: 33.33, weight: null },
        { progressPercentage: 33.33, weight: null },
      ]),
    ).toBe(33.33);
  });
});
