export type GoalProgressStatusCode =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'FINISHED';

export type PdiDerivedStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function pdiStatusFromPercent(percent: number): PdiDerivedStatus {
  const value = clampProgressPercent(percent);
  if (value <= 0) return 'NOT_STARTED';
  if (value >= 100) return 'COMPLETED';
  return 'IN_PROGRESS';
}

export function progressStatusFromPercent(
  percent: number,
): GoalProgressStatusCode {
  const status = pdiStatusFromPercent(percent);
  if (status === 'COMPLETED') return 'FINISHED';
  return status;
}

export function exceedsMaxObjectives(
  count: number,
  maxObjectives: number | null | undefined,
): boolean {
  return maxObjectives != null && count > maxObjectives;
}
