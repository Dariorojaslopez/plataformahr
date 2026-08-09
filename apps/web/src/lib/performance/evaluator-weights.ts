/**
 * Evaluator weights (SELF / MANAGER) for a cycle.
 * Must each be 0–100 and sum exactly 100 (aligned with API).
 */

export const DEFAULT_SELF_EVALUATION_WEIGHT = 30;
export const DEFAULT_MANAGER_EVALUATION_WEIGHT = 70;

export function parseEvaluatorWeightInput(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function sumEvaluatorWeights(
  selfWeight: string | number | null | undefined,
  managerWeight: string | number | null | undefined,
): number | null {
  const self = parseEvaluatorWeightInput(selfWeight);
  const manager = parseEvaluatorWeightInput(managerWeight);
  if (self == null || manager == null) return null;
  return self + manager;
}

export function evaluatorWeightsAreValid(
  selfWeight: string | number | null | undefined,
  managerWeight: string | number | null | undefined,
): boolean {
  const self = parseEvaluatorWeightInput(selfWeight);
  const manager = parseEvaluatorWeightInput(managerWeight);
  if (self == null || manager == null) return false;
  if (self < 0 || self > 100 || manager < 0 || manager > 100) return false;
  return Math.abs(self + manager - 100) < 0.001;
}

export function formatEvaluatorWeightLabel(
  selfWeight: string | number,
  managerWeight: string | number,
): string {
  const self = parseEvaluatorWeightInput(selfWeight);
  const manager = parseEvaluatorWeightInput(managerWeight);
  if (self == null || manager == null) return "—";
  return `Auto ${self.toFixed(2)}% · Líder ${manager.toFixed(2)}%`;
}
