import type { MineEvaluationsResponse } from "@/types/performance";

export type MineEvaluationCounts = {
  self: number;
  asManager: number;
  total: number;
};

/** API already groups by role; this only counts for display. */
export function countMineEvaluations(
  data: MineEvaluationsResponse | null | undefined,
): MineEvaluationCounts {
  const self = data?.self.length ?? 0;
  const asManager = data?.asManager.length ?? 0;
  return { self, asManager, total: self + asManager };
}

export function formatMineSectionTitle(
  kind: "self" | "asManager",
  count: number,
): string {
  if (kind === "self") {
    return count === 1
      ? "1 autoevaluación"
      : `${count} autoevaluaciones`;
  }
  return count === 1
    ? "1 evaluación a realizar"
    : `${count} evaluaciones a realizar`;
}
