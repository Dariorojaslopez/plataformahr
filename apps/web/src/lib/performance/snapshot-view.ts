import type {
  EvaluationCompetencyResponse,
  EvaluationCompetencyScoreBreakdown,
  EvaluationSnapshotCompetency,
} from "@/types/performance";

export type SnapshotCompetencyView = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  scaleName: string;
  weight: string | null;
  weightLabel: string;
  required: boolean;
  order: number;
  levels: Array<{
    id: string;
    value: number;
    label: string;
    description: string | null;
    order: number;
  }>;
  response: EvaluationCompetencyResponse | null;
  scoreBreakdown: EvaluationCompetencyScoreBreakdown | null;
};

/**
 * Maps evaluation competency snapshots for display.
 * Must use evaluation.competencies only — never the live catalog.
 */
export function mapSnapshotCompetenciesForDisplay(
  competencies: EvaluationSnapshotCompetency[],
): SnapshotCompetencyView[] {
  return [...competencies]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      scaleName: c.scaleName,
      weight: c.weight,
      weightLabel: c.weight != null ? `${c.weight}%` : "—",
      required: c.required,
      order: c.order,
      levels: [...c.levels]
        .sort((a, b) => a.order - b.order)
        .map((level) => ({
          id: level.id,
          value: level.value,
          label: level.label,
          description: level.description,
          order: level.order,
        })),
      response: c.response ?? null,
      scoreBreakdown: c.scoreBreakdown ?? null,
    }));
}
