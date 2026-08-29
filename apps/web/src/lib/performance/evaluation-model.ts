export type PerformanceEvaluationModel =
  | "DEGREE_90"
  | "DEGREE_180"
  | "DEGREE_270"
  | "DEGREE_360";

export const EVALUATION_MODEL_OPTIONS: Array<{
  value: PerformanceEvaluationModel;
  label: string;
}> = [
  { value: "DEGREE_90", label: "90°" },
  { value: "DEGREE_180", label: "180°" },
  { value: "DEGREE_270", label: "270°" },
  { value: "DEGREE_360", label: "360°" },
];

export type ExtraEvaluatorRole = "peer" | "report" | "client";

export function extraEvaluatorRoles(
  model: PerformanceEvaluationModel,
): ExtraEvaluatorRole[] {
  switch (model) {
    case "DEGREE_180":
      return ["peer"];
    case "DEGREE_270":
      return ["peer", "report"];
    case "DEGREE_360":
      return ["peer", "report", "client"];
    default:
      return [];
  }
}

export const EXTRA_EVALUATOR_LABELS: Record<ExtraEvaluatorRole, string> = {
  peer: "Pares",
  report: "Colaboradores",
  client: "Clientes",
};
