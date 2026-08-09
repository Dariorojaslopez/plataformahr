import {
  DEFAULT_MANAGER_EVALUATION_WEIGHT,
  DEFAULT_SELF_EVALUATION_WEIGHT,
  parseEvaluatorWeightInput,
} from "@/lib/performance/evaluator-weights";
import {
  DEFAULT_COMPETENCY_RESULT_WEIGHT,
  DEFAULT_GOALS_RESULT_WEIGHT,
  parseResultCompositionWeightInput,
  resultCompositionWeightsAreValid,
} from "@/lib/performance/result-composition-weights";
import type {
  CreatePerformanceCycleInput,
  PerformanceCycle,
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
  includeGoals: boolean;
  goalCycleId: string;
  competencyResultWeight: string;
  goalsResultWeight: string;
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
    includeGoals: false,
    goalCycleId: "",
    competencyResultWeight: String(DEFAULT_COMPETENCY_RESULT_WEIGHT),
    goalsResultWeight: String(DEFAULT_GOALS_RESULT_WEIGHT),
  };
}

export function cycleFormFromPerformanceCycle(
  cycle: PerformanceCycle,
): CycleFormState {
  const includeGoals = cycle.goalCycleId != null;
  return {
    name: cycle.name,
    description: cycle.description ?? "",
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    evaluationStartDate: cycle.evaluationStartDate ?? "",
    evaluationEndDate: cycle.evaluationEndDate ?? "",
    selfEvaluationWeight: cycle.selfEvaluationWeight ?? "30",
    managerEvaluationWeight: cycle.managerEvaluationWeight ?? "70",
    includeGoals,
    goalCycleId: cycle.goalCycleId ?? "",
    competencyResultWeight:
      cycle.competencyResultWeight ?? String(DEFAULT_COMPETENCY_RESULT_WEIGHT),
    goalsResultWeight:
      cycle.goalsResultWeight ?? String(DEFAULT_GOALS_RESULT_WEIGHT),
  };
}

export function cycleGoalsCompositionIsValid(form: CycleFormState): boolean {
  if (!form.includeGoals) return true;
  if (!form.goalCycleId.trim()) return false;
  return resultCompositionWeightsAreValid(
    form.competencyResultWeight,
    form.goalsResultWeight,
  );
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

function requireCompositionWeight(value: string, field: string): number {
  const n = parseResultCompositionWeightInput(value);
  if (n == null) {
    throw new Error(`${field} es obligatorio.`);
  }
  return n;
}

function applyGoalsCompositionToPayload<
  T extends {
    goalCycleId?: string | null;
    competencyResultWeight?: number | null;
    goalsResultWeight?: number | null;
  },
>(payload: T, form: CycleFormState, mode: "create" | "update"): T {
  if (!form.includeGoals) {
    if (mode === "update") {
      payload.goalCycleId = null;
      payload.competencyResultWeight = null;
      payload.goalsResultWeight = null;
    }
    return payload;
  }

  const goalCycleId = form.goalCycleId.trim();
  if (!goalCycleId) {
    throw new Error("Selecciona un ciclo de objetivos.");
  }
  if (
    !resultCompositionWeightsAreValid(
      form.competencyResultWeight,
      form.goalsResultWeight,
    )
  ) {
    throw new Error(
      "La ponderación de competencias y objetivos debe sumar exactamente 100%.",
    );
  }

  payload.goalCycleId = goalCycleId;
  payload.competencyResultWeight = requireCompositionWeight(
    form.competencyResultWeight,
    "Peso de competencias",
  );
  payload.goalsResultWeight = requireCompositionWeight(
    form.goalsResultWeight,
    "Peso de objetivos",
  );
  return payload;
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

  return applyGoalsCompositionToPayload(payload, form, "create");
}

export function buildUpdateCyclePayload(
  form: CycleFormState,
): UpdatePerformanceCycleInput {
  const payload: UpdatePerformanceCycleInput = {
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

  return applyGoalsCompositionToPayload(payload, form, "update");
}
