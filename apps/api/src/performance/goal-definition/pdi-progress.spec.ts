import {
  clampProgressPercent,
  exceedsMaxObjectives,
  pdiStatusFromPercent,
  progressStatusFromPercent,
} from './pdi-progress';

describe('pdi progress helpers', () => {
  it('maps slider extremes to PDI and goal statuses', () => {
    expect(pdiStatusFromPercent(0)).toBe('NOT_STARTED');
    expect(pdiStatusFromPercent(1)).toBe('IN_PROGRESS');
    expect(pdiStatusFromPercent(99)).toBe('IN_PROGRESS');
    expect(pdiStatusFromPercent(100)).toBe('COMPLETED');
    expect(progressStatusFromPercent(0)).toBe('NOT_STARTED');
    expect(progressStatusFromPercent(50)).toBe('IN_PROGRESS');
    expect(progressStatusFromPercent(100)).toBe('FINISHED');
  });

  it('clamps invalid percents', () => {
    expect(clampProgressPercent(-10)).toBe(0);
    expect(clampProgressPercent(140)).toBe(100);
    expect(clampProgressPercent(33.4)).toBe(33);
  });

  it('detects max objective overflow', () => {
    expect(exceedsMaxObjectives(3, null)).toBe(false);
    expect(exceedsMaxObjectives(3, 3)).toBe(false);
    expect(exceedsMaxObjectives(4, 3)).toBe(true);
  });
});
