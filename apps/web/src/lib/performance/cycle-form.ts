import {
  DEFAULT_MANAGER_EVALUATION_WEIGHT,
  DEFAULT_SELF_EVALUATION_WEIGHT,
  evaluatorWeightsAreValid,
  parseEvaluatorWeightInput,
} from "@/lib/performance/evaluator-weights";
import {
  extraEvaluatorRoles,
  type PerformanceEvaluationModel,
} from "@/lib/performance/evaluation-model";
import {
  DEFAULT_COMPETENCY_RESULT_WEIGHT,
  DEFAULT_EVALUATION_RANGE,
  DEFAULT_ORGANIZATIONAL_GOALS_WEIGHT,
  parseResultCompositionWeightInput,
  resultCompositionWeightsAreValid,
} from "@/lib/performance/result-composition-weights";
import type {
  CreatePerformanceCycleInput,
  PerformanceCycle,
  UpdatePerformanceCycleInput,
} from "@/types/performance";

export type CycleFollowUpForm = {
  startDate: string;
  endDate: string;
};

export type CycleFormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  goalDefinitionStartDate: string;
  goalDefinitionEndDate: string;
  managerEvaluationStartDate: string;
  managerEvaluationEndDate: string;
  calibrationStartDate: string;
  calibrationEndDate: string;
  closingStartDate: string;
  closingEndDate: string;
  followUps: CycleFollowUpForm[];
  evaluationModel: PerformanceEvaluationModel;
  selfEvaluationWeight: string;
  managerEvaluationWeight: string;
  peerEvaluationWeight: string;
  reportEvaluationWeight: string;
  clientEvaluationWeight: string;
  includeCompetencies: boolean;
  goalCycleId: string;
  competencyResultWeight: string;
  organizationalGoalsWeight: string;
  individualGoalsWeight: string;
  maxObjectives: string;
  evaluationRange: "100" | "120";
};

export function emptyCycleForm(): CycleFormState {
  return {
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    evaluationStartDate: "",
    evaluationEndDate: "",
    goalDefinitionStartDate: "",
    goalDefinitionEndDate: "",
    managerEvaluationStartDate: "",
    managerEvaluationEndDate: "",
    calibrationStartDate: "",
    calibrationEndDate: "",
    closingStartDate: "",
    closingEndDate: "",
    followUps: [],
    evaluationModel: "DEGREE_90",
    selfEvaluationWeight: String(DEFAULT_SELF_EVALUATION_WEIGHT),
    managerEvaluationWeight: String(DEFAULT_MANAGER_EVALUATION_WEIGHT),
    peerEvaluationWeight: "0",
    reportEvaluationWeight: "0",
    clientEvaluationWeight: "0",
    includeCompetencies: true,
    goalCycleId: "",
    competencyResultWeight: String(DEFAULT_COMPETENCY_RESULT_WEIGHT),
    organizationalGoalsWeight: String(DEFAULT_ORGANIZATIONAL_GOALS_WEIGHT),
    individualGoalsWeight: "0",
    maxObjectives: "",
    evaluationRange: String(DEFAULT_EVALUATION_RANGE) as "100" | "120",
  };
}

export function cycleFormFromPerformanceCycle(
  cycle: PerformanceCycle,
): CycleFormState {
  const hasGoals =
    cycle.goalCycleId != null ||
    Number(cycle.organizationalGoalsWeight ?? 0) > 0 ||
    Number(cycle.individualGoalsWeight ?? 0) > 0 ||
    Number(cycle.goalsResultWeight ?? 0) > 0;
  return {
    name: cycle.name,
    description: cycle.description ?? "",
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    evaluationStartDate: cycle.evaluationStartDate ?? "",
    evaluationEndDate: cycle.evaluationEndDate ?? "",
    goalDefinitionStartDate: cycle.goalDefinitionStartDate ?? "",
    goalDefinitionEndDate: cycle.goalDefinitionEndDate ?? "",
    managerEvaluationStartDate: cycle.managerEvaluationStartDate ?? "",
    managerEvaluationEndDate: cycle.managerEvaluationEndDate ?? "",
    calibrationStartDate: cycle.calibrationStartDate ?? "",
    calibrationEndDate: cycle.calibrationEndDate ?? "",
    closingStartDate: cycle.closingStartDate ?? "",
    closingEndDate: cycle.closingEndDate ?? "",
    followUps: (cycle.followUps ?? []).map((row) => ({
      startDate: row.startDate,
      endDate: row.endDate,
    })),
    evaluationModel: cycle.evaluationModel ?? "DEGREE_90",
    selfEvaluationWeight: cycle.selfEvaluationWeight ?? "30",
    managerEvaluationWeight: cycle.managerEvaluationWeight ?? "70",
    peerEvaluationWeight: cycle.peerEvaluationWeight ?? "0",
    reportEvaluationWeight: cycle.reportEvaluationWeight ?? "0",
    clientEvaluationWeight: cycle.clientEvaluationWeight ?? "0",
    includeCompetencies: cycle.includeCompetencies !== false,
    goalCycleId: cycle.goalCycleId ?? "",
    competencyResultWeight:
      cycle.competencyResultWeight ?? String(DEFAULT_COMPETENCY_RESULT_WEIGHT),
    organizationalGoalsWeight:
      cycle.organizationalGoalsWeight ??
      String(DEFAULT_ORGANIZATIONAL_GOALS_WEIGHT),
    individualGoalsWeight:
      cycle.individualGoalsWeight ??
      (hasGoals ? (cycle.goalsResultWeight ?? "0") : "0"),
    maxObjectives: cycle.maxObjectives != null ? String(cycle.maxObjectives) : "",
    evaluationRange: cycle.evaluationRange === 120 ? "120" : "100",
  };
}

function hasGoalWeights(form: CycleFormState): boolean {
  const org = parseResultCompositionWeightInput(form.organizationalGoalsWeight) ?? 0;
  const individual =
    parseResultCompositionWeightInput(form.individualGoalsWeight) ?? 0;
  return org + individual > 0;
}

export function cycleEvaluatorWeightsAreValid(form: CycleFormState): boolean {
  return evaluatorWeightsAreValid(
    form.selfEvaluationWeight,
    form.managerEvaluationWeight,
    {
      model: form.evaluationModel,
      peer: form.peerEvaluationWeight,
      report: form.reportEvaluationWeight,
      client: form.clientEvaluationWeight,
    },
  );
}

export function cycleGoalsCompositionIsValid(form: CycleFormState): boolean {
  const range = form.evaluationRange === "120" ? 120 : 100;
  const competency = form.includeCompetencies
    ? parseResultCompositionWeightInput(form.competencyResultWeight)
    : 0;
  const org = parseResultCompositionWeightInput(form.organizationalGoalsWeight);
  const individual = parseResultCompositionWeightInput(
    form.individualGoalsWeight,
  );
  if (competency == null || org == null || individual == null) return false;
  if (!form.includeCompetencies && org + individual <= 0) return false;
  if (form.includeCompetencies && org + individual <= 0) return true;
  return resultCompositionWeightsAreValid(
    competency,
    org,
    individual,
    range,
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

function requireDatePair(
  start: string,
  end: string,
  startLabel: string,
  endLabel: string,
): { start?: string; end?: string } {
  const startTrim = start.trim();
  const endTrim = end.trim();
  if (!startTrim && !endTrim) return {};
  if (!startTrim || !endTrim) {
    throw new Error(`${startLabel} y ${endLabel} deben indicarse juntas.`);
  }
  return { start: startTrim, end: endTrim };
}

function applyCompositionToPayload<
  T extends {
    goalCycleId?: string | null;
    includeCompetencies?: boolean;
    competencyResultWeight?: number | null;
    goalsResultWeight?: number | null;
    organizationalGoalsWeight?: number | null;
    individualGoalsWeight?: number | null;
    maxObjectives?: number | null;
    evaluationRange?: number;
  },
>(payload: T, form: CycleFormState, mode: "create" | "update"): T {
  const range = form.evaluationRange === "120" ? 120 : 100;
  payload.includeCompetencies = form.includeCompetencies;
  payload.evaluationRange = range;

  const maxObjectives = form.maxObjectives.trim();
  if (maxObjectives) {
    const n = Number(maxObjectives);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("El máximo de objetivos debe ser un entero mayor a 0.");
    }
    payload.maxObjectives = n;
  } else if (mode === "update") {
    payload.maxObjectives = null;
  }

  const includeGoals = hasGoalWeights(form);
  if (!includeGoals) {
    if (!form.includeCompetencies) {
      throw new Error(
        "Activa competencias o indica ponderación de objetivos.",
      );
    }
    if (mode === "update") {
      payload.goalCycleId = null;
      payload.competencyResultWeight = null;
      payload.goalsResultWeight = null;
      payload.organizationalGoalsWeight = null;
      payload.individualGoalsWeight = null;
    }
    return payload;
  }

  const goalCycleId = form.goalCycleId.trim();
  const competency = form.includeCompetencies
    ? requireCompositionWeight(
        form.competencyResultWeight,
        "Peso de competencias",
      )
    : 0;
  const org = requireCompositionWeight(
    form.organizationalGoalsWeight,
    "Peso de objetivos organizacionales",
  );
  const individual = requireCompositionWeight(
    form.individualGoalsWeight,
    "Peso de objetivos individuales",
  );
  if (
    !resultCompositionWeightsAreValid(competency, org, individual, range)
  ) {
    throw new Error(
      `La ponderación de competencias y objetivos no puede superar ${range}%.`,
    );
  }

  if (goalCycleId) {
    payload.goalCycleId = goalCycleId;
  }
  payload.competencyResultWeight = competency;
  payload.organizationalGoalsWeight = org;
  payload.individualGoalsWeight = individual;
  payload.goalsResultWeight = Number((org + individual).toFixed(2));
  return payload;
}

function applyDatesToCreate(
  payload: CreatePerformanceCycleInput,
  form: CycleFormState,
) {
  const evalPair = requireDatePair(
    form.evaluationStartDate,
    form.evaluationEndDate,
    "Fecha de autoevaluación (inicio)",
    "Fecha de autoevaluación (fin)",
  );
  if (evalPair.start) payload.evaluationStartDate = evalPair.start;
  if (evalPair.end) payload.evaluationEndDate = evalPair.end;

  const goalPair = requireDatePair(
    form.goalDefinitionStartDate,
    form.goalDefinitionEndDate,
    "Definición de objetivos (inicio)",
    "Definición de objetivos (fin)",
  );
  if (goalPair.start) payload.goalDefinitionStartDate = goalPair.start;
  if (goalPair.end) payload.goalDefinitionEndDate = goalPair.end;

  const managerPair = requireDatePair(
    form.managerEvaluationStartDate,
    form.managerEvaluationEndDate,
    "Fecha de evaluación (inicio)",
    "Fecha de evaluación (fin)",
  );
  if (managerPair.start) payload.managerEvaluationStartDate = managerPair.start;
  if (managerPair.end) payload.managerEvaluationEndDate = managerPair.end;

  const calPair = requireDatePair(
    form.calibrationStartDate,
    form.calibrationEndDate,
    "Fecha de calibración (inicio)",
    "Fecha de calibración (fin)",
  );
  if (calPair.start) payload.calibrationStartDate = calPair.start;
  if (calPair.end) payload.calibrationEndDate = calPair.end;

  const closePair = requireDatePair(
    form.closingStartDate,
    form.closingEndDate,
    "Sesión de cierre (inicio)",
    "Sesión de cierre (fin)",
  );
  if (closePair.start) payload.closingStartDate = closePair.start;
  if (closePair.end) payload.closingEndDate = closePair.end;

  payload.followUps = form.followUps.map((row, index) => {
    const pair = requireDatePair(
      row.startDate,
      row.endDate,
      `Seguimiento ${index + 1} (inicio)`,
      `Seguimiento ${index + 1} (fin)`,
    );
    if (!pair.start || !pair.end) {
      throw new Error(`Completa las fechas del seguimiento ${index + 1}.`);
    }
    return { startDate: pair.start, endDate: pair.end };
  });
  if (payload.followUps.length === 0) delete payload.followUps;
}

function applyDatesToUpdate(
  payload: UpdatePerformanceCycleInput,
  form: CycleFormState,
) {
  const evalPair = requireDatePair(
    form.evaluationStartDate,
    form.evaluationEndDate,
    "Fecha de autoevaluación (inicio)",
    "Fecha de autoevaluación (fin)",
  );
  payload.evaluationStartDate = evalPair.start ?? null;
  payload.evaluationEndDate = evalPair.end ?? null;

  const goalPair = requireDatePair(
    form.goalDefinitionStartDate,
    form.goalDefinitionEndDate,
    "Definición de objetivos (inicio)",
    "Definición de objetivos (fin)",
  );
  payload.goalDefinitionStartDate = goalPair.start ?? null;
  payload.goalDefinitionEndDate = goalPair.end ?? null;

  const managerPair = requireDatePair(
    form.managerEvaluationStartDate,
    form.managerEvaluationEndDate,
    "Fecha de evaluación (inicio)",
    "Fecha de evaluación (fin)",
  );
  payload.managerEvaluationStartDate = managerPair.start ?? null;
  payload.managerEvaluationEndDate = managerPair.end ?? null;

  const calPair = requireDatePair(
    form.calibrationStartDate,
    form.calibrationEndDate,
    "Fecha de calibración (inicio)",
    "Fecha de calibración (fin)",
  );
  payload.calibrationStartDate = calPair.start ?? null;
  payload.calibrationEndDate = calPair.end ?? null;

  const closePair = requireDatePair(
    form.closingStartDate,
    form.closingEndDate,
    "Sesión de cierre (inicio)",
    "Sesión de cierre (fin)",
  );
  payload.closingStartDate = closePair.start ?? null;
  payload.closingEndDate = closePair.end ?? null;

  payload.followUps = form.followUps.map((row, index) => {
    const pair = requireDatePair(
      row.startDate,
      row.endDate,
      `Seguimiento ${index + 1} (inicio)`,
      `Seguimiento ${index + 1} (fin)`,
    );
    if (!pair.start || !pair.end) {
      throw new Error(`Completa las fechas del seguimiento ${index + 1}.`);
    }
    return { startDate: pair.start, endDate: pair.end };
  });
}

function extraWeightPayload(form: CycleFormState) {
  const roles = extraEvaluatorRoles(form.evaluationModel);
  return {
    peerEvaluationWeight: roles.includes("peer")
      ? requireWeight(form.peerEvaluationWeight, "Peso de pares")
      : null,
    reportEvaluationWeight: roles.includes("report")
      ? requireWeight(form.reportEvaluationWeight, "Peso de colaboradores")
      : null,
    clientEvaluationWeight: roles.includes("client")
      ? requireWeight(form.clientEvaluationWeight, "Peso de clientes")
      : null,
  };
}

export function buildCreateCyclePayload(
  form: CycleFormState,
): CreatePerformanceCycleInput {
  const payload: CreatePerformanceCycleInput = {
    name: form.name.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    evaluationModel: form.evaluationModel,
    selfEvaluationWeight: requireWeight(
      form.selfEvaluationWeight,
      "Peso de autoevaluación",
    ),
    managerEvaluationWeight: requireWeight(
      form.managerEvaluationWeight,
      "Peso de evaluación de líder",
    ),
    ...extraWeightPayload(form),
  };

  const description = emptyToUndefined(form.description);
  if (description !== undefined) payload.description = description;

  applyDatesToCreate(payload, form);
  return applyCompositionToPayload(payload, form, "create");
}

export function buildUpdateCyclePayload(
  form: CycleFormState,
): UpdatePerformanceCycleInput {
  const payload: UpdatePerformanceCycleInput = {
    name: form.name.trim(),
    description: emptyToNull(form.description),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    evaluationModel: form.evaluationModel,
    selfEvaluationWeight: requireWeight(
      form.selfEvaluationWeight,
      "Peso de autoevaluación",
    ),
    managerEvaluationWeight: requireWeight(
      form.managerEvaluationWeight,
      "Peso de evaluación de líder",
    ),
    ...extraWeightPayload(form),
  };

  applyDatesToUpdate(payload, form);
  return applyCompositionToPayload(payload, form, "update");
}
