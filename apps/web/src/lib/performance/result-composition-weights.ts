/**
 * Result composition weights (competencies / organizational / individual goals).
 * Sum must be > 0 and must not exceed the cycle evaluation range (100 or 120).
 */

export const DEFAULT_COMPETENCY_RESULT_WEIGHT = 70;
export const DEFAULT_ORGANIZATIONAL_GOALS_WEIGHT = 0;
export const DEFAULT_INDIVIDUAL_GOALS_WEIGHT = 30;
export const DEFAULT_GOALS_RESULT_WEIGHT = 30;
export const DEFAULT_EVALUATION_RANGE = 100;

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
  organizationalWeight: string | number | null | undefined,
  individualWeight?: string | number | null | undefined,
): number | null {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  const organizational = parseResultCompositionWeightInput(
    organizationalWeight,
  );
  if (individualWeight === undefined) {
    // Legacy 2-arg: competencias + objetivos
    if (competency == null || organizational == null) return null;
    return competency + organizational;
  }
  const individual = parseResultCompositionWeightInput(individualWeight);
  if (competency == null || organizational == null || individual == null) {
    return null;
  }
  return competency + organizational + individual;
}

export function resultCompositionWeightsAreValid(
  competencyWeight: string | number | null | undefined,
  organizationalOrGoalsWeight: string | number | null | undefined,
  individualWeight?: string | number | null | undefined,
  evaluationRange: number = DEFAULT_EVALUATION_RANGE,
): boolean {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  const second = parseResultCompositionWeightInput(organizationalOrGoalsWeight);
  if (individualWeight === undefined) {
    if (competency == null || second == null) return false;
    if (competency < 0 || second < 0) return false;
    if (competency > evaluationRange || second > evaluationRange) return false;
    return Math.abs(competency + second - 100) < 0.001;
  }
  const individual = parseResultCompositionWeightInput(individualWeight);
  if (competency == null || second == null || individual == null) return false;
  if (competency < 0 || second < 0 || individual < 0) return false;
  if (
    competency > evaluationRange ||
    second > evaluationRange ||
    individual > evaluationRange
  ) {
    return false;
  }
  const sum = competency + second + individual;
  return sum > 0 && sum - evaluationRange < 0.001;
}

export function formatResultCompositionWeightLabel(
  competencyWeight: string | number | null | undefined,
  goalsWeight: string | number | null | undefined,
  extra?: {
    organizational?: string | number | null;
    individual?: string | number | null;
  },
): string {
  const competency = parseResultCompositionWeightInput(competencyWeight);
  if (extra) {
    const org = parseResultCompositionWeightInput(extra.organizational);
    const individual = parseResultCompositionWeightInput(extra.individual);
    if (competency == null || org == null || individual == null) return "—";
    return `Competencias ${competency.toFixed(2)}% · Org. ${org.toFixed(2)}% · Ind. ${individual.toFixed(2)}%`;
  }
  const goals = parseResultCompositionWeightInput(goalsWeight);
  if (competency == null || goals == null) return "—";
  return `Competencias ${competency.toFixed(2)}% · Objetivos ${goals.toFixed(2)}%`;
}
