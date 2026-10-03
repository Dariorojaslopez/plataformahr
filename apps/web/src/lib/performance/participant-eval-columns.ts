import {
  extraEvaluatorRoles,
  type ExtraEvaluatorRole,
  type PerformanceEvaluationModel,
} from "@/lib/performance/evaluation-model";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import type { ParticipantEvaluationGroupSummary } from "@/types/performance";

export const NOT_APPLICABLE_EVAL_LABEL = "No aplica";

export const EXTRA_EVAL_COLUMNS: Array<{
  role: ExtraEvaluatorRole;
  label: string;
}> = [
  { role: "peer", label: "Pares" },
  { role: "report", label: "Colaboradores" },
  { role: "client", label: "Clientes" },
];

export function extraEvalColumnApplies(
  model: PerformanceEvaluationModel,
  role: ExtraEvaluatorRole,
): boolean {
  return extraEvaluatorRoles(model).includes(role);
}

export function formatExtraEvalColumn(
  summary: ParticipantEvaluationGroupSummary | null | undefined,
): string {
  if (!summary || summary.total === 0) return "—";
  if (summary.submitted === summary.total) {
    if (summary.averageScore) {
      return `Enviada (${formatScorePercentage(summary.averageScore)})`;
    }
    return "Enviada";
  }
  if (summary.submitted > 0 || summary.inProgress > 0) {
    return `${summary.submitted}/${summary.total} enviadas`;
  }
  return "Pendiente";
}
