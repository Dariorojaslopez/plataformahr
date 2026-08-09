import {
  PerformanceCycleStatus,
  type PerformanceCycleStatus as PerformanceCycleStatusType,
} from '@prisma/client';

export const CYCLE_ALLOWED_TRANSITIONS: Record<
  PerformanceCycleStatus,
  PerformanceCycleStatus[]
> = {
  [PerformanceCycleStatus.DRAFT]: [
    PerformanceCycleStatus.ACTIVE,
    PerformanceCycleStatus.CANCELLED,
  ],
  [PerformanceCycleStatus.ACTIVE]: [
    PerformanceCycleStatus.CLOSED,
    PerformanceCycleStatus.CANCELLED,
  ],
  [PerformanceCycleStatus.CLOSED]: [],
  [PerformanceCycleStatus.CANCELLED]: [],
};

export const CYCLE_TERMINAL_STATUSES = new Set<PerformanceCycleStatus>([
  PerformanceCycleStatus.CLOSED,
  PerformanceCycleStatus.CANCELLED,
]);

export function canTransitionCycle(
  from: PerformanceCycleStatusType,
  to: PerformanceCycleStatusType,
): boolean {
  return CYCLE_ALLOWED_TRANSITIONS[from].includes(to);
}

export function isCycleStructurallyEditable(
  status: PerformanceCycleStatusType,
): boolean {
  return status === PerformanceCycleStatus.DRAFT;
}

export function isCycleMetadataEditable(
  status: PerformanceCycleStatusType,
): boolean {
  return status === PerformanceCycleStatus.DRAFT;
}
