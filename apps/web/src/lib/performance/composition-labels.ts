import type { PerformanceResultComposition } from "@/types/performance";

export const COMPOSITION_LABELS: Record<PerformanceResultComposition, string> =
  {
    COMPETENCY_ONLY: "Solo competencias",
    COMPETENCY_AND_GOALS: "Competencias + objetivos",
  };

export function isIntegratedComposition(
  composition: PerformanceResultComposition | null | undefined,
): boolean {
  return composition === "COMPETENCY_AND_GOALS";
}

export function compositionSummaryLabel(
  composition: PerformanceResultComposition | null | undefined,
): string {
  if (!composition) return COMPOSITION_LABELS.COMPETENCY_ONLY;
  return COMPOSITION_LABELS[composition];
}
