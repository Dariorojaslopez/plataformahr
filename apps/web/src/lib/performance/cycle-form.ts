import {
  DEFAULT_MANAGER_EVALUATION_WEIGHT,
  DEFAULT_SELF_EVALUATION_WEIGHT,
  parseEvaluatorWeightInput,
} from "@/lib/performance/evaluator-weights";
import type {
  CreatePerformanceCycleInput,
  UpdatePerformanceCycleInput,
} from "@/types/performance";

export type CycleFormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  selfEvaluationWeight: string;
  managerEvaluationWeight: string;
};

export function emptyCycleForm(): CycleFormState {
  return {
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    evaluationStartDate: "",
    evaluationEndDate: "",
    selfEvaluationWeight: String(DEFAULT_SELF_EVALUATION_WEIGHT),
    managerEvaluationWeight: String(DEFAULT_MANAGER_EVALUATION_WEIGHT),
  };
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requireWeight(value: string, field: string): number {
  const n = parseEvaluatorWeightInput(value);
  if (n == null) {
    throw new Error(`${field} es obligatorio.`);
  }
  return n;
}

export function buildCreateCyclePayload(
  form: CycleFormState,
): CreatePerformanceCycleInput {
  const payload: CreatePerformanceCycleInput = {
    name: form.name.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    selfEvaluationWeight: requireWeight(
      form.selfEvaluationWeight,
      "Peso de autoevaluación",
    ),
    managerEvaluationWeight: requireWeight(
      form.managerEvaluationWeight,
      "Peso de evaluación de líder",
    ),
  };

  const description = emptyToUndefined(form.description);
  if (description !== undefined) payload.description = description;

  const evalStart = emptyToUndefined(form.evaluationStartDate);
  const evalEnd = emptyToUndefined(form.evaluationEndDate);
  if (evalStart !== undefined) payload.evaluationStartDate = evalStart;
  if (evalEnd !== undefined) payload.evaluationEndDate = evalEnd;

  return payload;
}

export function buildUpdateCyclePayload(
  form: CycleFormState,
): UpdatePerformanceCycleInput {
  return {
    name: form.name.trim(),
    description: emptyToNull(form.description),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    evaluationStartDate: emptyToNull(form.evaluationStartDate),
    evaluationEndDate: emptyToNull(form.evaluationEndDate),
    selfEvaluationWeight: requireWeight(
      form.selfEvaluationWeight,
      "Peso de autoevaluación",
    ),
    managerEvaluationWeight: requireWeight(
      form.managerEvaluationWeight,
      "Peso de evaluación de líder",
    ),
  };
}
