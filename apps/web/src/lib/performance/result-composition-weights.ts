/**
 * Result composition weights (competencies / goals) for integrated cycles (09D).
 * Must each be 0–100 and sum exactly 100 when Goals integration is enabled.
 */

export const DEFAULT_COMPETENCY_RESULT_WEIGHT = 70;
export const DEFAULT_GOALS_RESULT_WEIGHT = 30;

export function parseResultCompositionWeightInput(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function sumResultCompositionWeights(
  competencyWeight: string | number | null | undefined,
  goalsWeight: string | number | null | undefined,
): number | null {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  const goals = parseResultCompositionWeightInput(goalsWeight);
  if (competency == null || goals == null) return null;
  return competency + goals;
}

export function resultCompositionWeightsAreValid(
  competencyWeight: string | number | null | undefined,
  goalsWeight: string | number | null | undefined,
): boolean {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  const goals = parseResultCompositionWeightInput(goalsWeight);
  if (competency == null || goals == null) return false;
  if (competency < 0 || competency > 100 || goals < 0 || goals > 100) {
    return false;
  }
  return Math.abs(competency + goals - 100) < 0.001;
}

export function formatResultCompositionWeightLabel(
  competencyWeight: string | number | null | undefined,
  goalsWeight: string | number | null | undefined,
): string {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  const goals = parseResultCompositionWeightInput(goalsWeight);
  if (competency == null || goals == null) return "—";
  return `Competencias ${competency.toFixed(2)}% · Objetivos ${goals.toFixed(2)}%`;
}
