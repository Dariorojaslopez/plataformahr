/**
 * Evaluator weights for a cycle.
 * Enabled groups (by evaluation model) must each be 0–100 and sum exactly 100.
 */

import {
  extraEvaluatorRoles,
  type ExtraEvaluatorRole,
  type PerformanceEvaluationModel,
} from "@/lib/performance/evaluation-model";

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

export type EvaluatorWeightFields = {
  self: string | number | null | undefined;
  manager: string | number | null | undefined;
  peer?: string | number | null | undefined;
  report?: string | number | null | undefined;
  client?: string | number | null | undefined;
};

function extraValue(
  fields: EvaluatorWeightFields,
  role: ExtraEvaluatorRole,
): string | number | null | undefined {
  if (role === "peer") return fields.peer;
  if (role === "report") return fields.report;
  return fields.client;
}

export function sumEvaluatorWeights(
  selfWeight: string | number | null | undefined,
  managerWeight: string | number | null | undefined,
  extra?: {
    model?: PerformanceEvaluationModel;
    peer?: string | number | null | undefined;
    report?: string | number | null | undefined;
    client?: string | number | null | undefined;
  },
): number | null {
  const fields: EvaluatorWeightFields = {
    self: selfWeight,
    manager: managerWeight,
    peer: extra?.peer,
    report: extra?.report,
    client: extra?.client,
  };
  const self = parseEvaluatorWeightInput(fields.self);
  const manager = parseEvaluatorWeightInput(fields.manager);
  if (self == null || manager == null) return null;
  let total = self + manager;
  for (const role of extraEvaluatorRoles(extra?.model ?? "DEGREE_90")) {
    const n = parseEvaluatorWeightInput(extraValue(fields, role));
    if (n == null) return null;
    total += n;
  }
  return total;
}

export function evaluatorWeightsAreValid(
  selfWeight: string | number | null | undefined,
  managerWeight: string | number | null | undefined,
  extra?: {
    model?: PerformanceEvaluationModel;
    peer?: string | number | null | undefined;
    report?: string | number | null | undefined;
    client?: string | number | null | undefined;
  },
): boolean {
  const model = extra?.model ?? "DEGREE_90";
  const self = parseEvaluatorWeightInput(selfWeight);
  const manager = parseEvaluatorWeightInput(managerWeight);
  if (self == null || manager == null) return false;
  if (self < 0 || self > 100 || manager < 0 || manager > 100) return false;

  const fields: EvaluatorWeightFields = {
    self,
    manager,
    peer: extra?.peer,
    report: extra?.report,
    client: extra?.client,
  };
  let total = self + manager;
  for (const role of extraEvaluatorRoles(model)) {
    const n = parseEvaluatorWeightInput(extraValue(fields, role));
    if (n == null || n < 0 || n > 100) return false;
    total += n;
  }
  return Math.abs(total - 100) < 0.001;
}

export function formatEvaluatorWeightLabel(
  selfWeight: string | number,
  managerWeight: string | number,
  extra?: {
    model?: PerformanceEvaluationModel;
    peer?: string | number | null | undefined;
    report?: string | number | null | undefined;
    client?: string | number | null | undefined;
  },
): string {
  const self = parseEvaluatorWeightInput(selfWeight);
  const manager = parseEvaluatorWeightInput(managerWeight);
  if (self == null || manager == null) return "—";
  const parts = [
    `Auto ${self.toFixed(2)}%`,
    `Líder ${manager.toFixed(2)}%`,
  ];
  const model = extra?.model ?? "DEGREE_90";
  const labels: Record<ExtraEvaluatorRole, string> = {
    peer: "Pares",
    report: "Colaboradores",
    client: "Clientes",
  };
  const fields: EvaluatorWeightFields = {
    self,
    manager,
    peer: extra?.peer,
    report: extra?.report,
    client: extra?.client,
  };
  for (const role of extraEvaluatorRoles(model)) {
    const n = parseEvaluatorWeightInput(extraValue(fields, role));
    if (n == null) continue;
    parts.push(`${labels[role]} ${n.toFixed(2)}%`);
  }
  return parts.join(" · ");
}
