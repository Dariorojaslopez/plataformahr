import type { CompetencyScaleKind } from "@/types/performance";

export const COMPETENCY_SCALE_KIND_LABELS: Record<
  CompetencyScaleKind,
  string
> = {
  QUALITATIVE: "Cualitativa",
  QUANTITATIVE: "Cuantitativa",
};

export const COMPETENCY_SCALE_KIND_OPTIONS = [
  { value: "QUALITATIVE", label: COMPETENCY_SCALE_KIND_LABELS.QUALITATIVE },
  { value: "QUANTITATIVE", label: COMPETENCY_SCALE_KIND_LABELS.QUANTITATIVE },
] as const;

export function isQualitativeCompetencyScale(
  kind: CompetencyScaleKind | undefined,
): boolean {
  return kind !== "QUANTITATIVE";
}

export function qualitativeScalesForRating<
  T extends { kind?: CompetencyScaleKind },
>(scales: T[]): T[] {
  return scales.filter((scale) => isQualitativeCompetencyScale(scale.kind));
}

export function autoQualitativeScaleId(
  scales: Array<{ id: string }>,
): string {
  return scales.length === 1 ? scales[0].id : "";
}
