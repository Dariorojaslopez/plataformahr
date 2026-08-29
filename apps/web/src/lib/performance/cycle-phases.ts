export type CyclePhaseKind =
  | "GOAL_DEFINITION"
  | "FOLLOW_UP"
  | "SELF_EVALUATION"
  | "EVALUATION"
  | "COMPETENCY_EVALUATION"
  | "CALIBRATION"
  | "CLOSING";

export type PhaseVisibility = "past" | "current" | "future";

export type CyclePhase = {
  id: string;
  kind: CyclePhaseKind;
  label: string;
  startDate: string;
  endDate: string;
  visibility: PhaseVisibility;
};

export type CyclePhaseFollowUp = {
  id?: string;
  order: number;
  startDate: string;
  endDate: string;
};

export type CyclePhaseSource = {
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
  startDate: string;
  endDate: string;
  evaluationStartDate?: string | null;
  evaluationEndDate?: string | null;
  goalDefinitionStartDate?: string | null;
  goalDefinitionEndDate?: string | null;
  managerEvaluationStartDate?: string | null;
  managerEvaluationEndDate?: string | null;
  calibrationStartDate?: string | null;
  calibrationEndDate?: string | null;
  closingStartDate?: string | null;
  closingEndDate?: string | null;
  followUps?: CyclePhaseFollowUp[];
};

export const CYCLE_PHASE_LABELS: Record<CyclePhaseKind, string> = {
  GOAL_DEFINITION: "Definición de objetivos",
  FOLLOW_UP: "Seguimiento",
  SELF_EVALUATION: "Autoevaluación",
  EVALUATION: "Evaluación",
  COMPETENCY_EVALUATION: "Evaluación",
  CALIBRATION: "Calibración",
  CLOSING: "Sesión de cierre",
};

function dateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function pair(
  start: string | null | undefined,
  end: string | null | undefined,
): { startDate: string; endDate: string } | null {
  if (!start || !end) return null;
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

function contains(startDate: string, endDate: string, today: string): boolean {
  return startDate <= today && today <= endDate;
}

/**
 * Ordered cycle phases that have both dates configured.
 * If only the autoevaluación window exists, leader/peer evals share it
 * (legacy COMPETENCY_EVALUATION).
 */
export function buildCyclePhases(
  cycle: CyclePhaseSource,
  todayInput: Date | string = new Date(),
): CyclePhase[] {
  const today = dateOnly(todayInput);
  const raw: Array<Omit<CyclePhase, "visibility">> = [];

  const goalDef = pair(
    cycle.goalDefinitionStartDate,
    cycle.goalDefinitionEndDate,
  );
  if (goalDef) {
    raw.push({
      id: "goal-definition",
      kind: "GOAL_DEFINITION",
      label: CYCLE_PHASE_LABELS.GOAL_DEFINITION,
      ...goalDef,
    });
  }

  const followUps = [...(cycle.followUps ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  followUps.forEach((row, index) => {
    const window = pair(row.startDate, row.endDate);
    if (!window) return;
    raw.push({
      id: row.id ?? `follow-up-${index}`,
      kind: "FOLLOW_UP",
      label: `Seguimiento ${index + 1}`,
      ...window,
    });
  });

  const selfWindow = pair(cycle.evaluationStartDate, cycle.evaluationEndDate);
  const otherWindow = pair(
    cycle.managerEvaluationStartDate,
    cycle.managerEvaluationEndDate,
  );
  if (selfWindow && otherWindow) {
    raw.push({
      id: "self-evaluation",
      kind: "SELF_EVALUATION",
      label: CYCLE_PHASE_LABELS.SELF_EVALUATION,
      ...selfWindow,
    });
    raw.push({
      id: "evaluation",
      kind: "EVALUATION",
      label: CYCLE_PHASE_LABELS.EVALUATION,
      ...otherWindow,
    });
  } else if (selfWindow) {
    raw.push({
      id: "competency-evaluation",
      kind: "COMPETENCY_EVALUATION",
      label: CYCLE_PHASE_LABELS.COMPETENCY_EVALUATION,
      ...selfWindow,
    });
  } else if (otherWindow) {
    raw.push({
      id: "evaluation",
      kind: "EVALUATION",
      label: CYCLE_PHASE_LABELS.EVALUATION,
      ...otherWindow,
    });
  }

  const calibration = pair(
    cycle.calibrationStartDate,
    cycle.calibrationEndDate,
  );
  if (calibration) {
    raw.push({
      id: "calibration",
      kind: "CALIBRATION",
      label: CYCLE_PHASE_LABELS.CALIBRATION,
      ...calibration,
    });
  }

  const closing = pair(cycle.closingStartDate, cycle.closingEndDate);
  if (closing) {
    raw.push({
      id: "closing",
      kind: "CLOSING",
      label: CYCLE_PHASE_LABELS.CLOSING,
      ...closing,
    });
  }

  const containing = raw.filter((phase) =>
    contains(phase.startDate, phase.endDate, today),
  );
  const currentId = containing.at(-1)?.id ?? null;
  const currentIndex = currentId
    ? raw.findIndex((phase) => phase.id === currentId)
    : -1;

  return raw.map((phase, index) => {
    if (phase.id === currentId) {
      return { ...phase, visibility: "current" };
    }
    if (currentIndex >= 0) {
      return {
        ...phase,
        visibility: index < currentIndex ? "past" : "future",
      };
    }
    return {
      ...phase,
      visibility: phase.endDate < today ? "past" : "future",
    };
  });
}

export function visibleCyclePhases(phases: CyclePhase[]): CyclePhase[] {
  return phases.filter((phase) => phase.visibility !== "future");
}

export function currentCyclePhase(phases: CyclePhase[]): CyclePhase | null {
  return phases.find((phase) => phase.visibility === "current") ?? null;
}

export function isCycleActiveForEditing(
  status: CyclePhaseSource["status"],
): boolean {
  return status === "ACTIVE";
}

const COMPETENCY_PHASES: CyclePhaseKind[] = [
  "SELF_EVALUATION",
  "EVALUATION",
  "COMPETENCY_EVALUATION",
];

export function canEditEvaluationInCyclePhase(params: {
  cycleStatus: CyclePhaseSource["status"];
  evaluationType: "SELF" | "MANAGER" | "PEER" | "REPORT" | "CLIENT";
  phases: CyclePhase[];
}): boolean {
  if (!isCycleActiveForEditing(params.cycleStatus)) return false;
  const hasCompetencyPhases = params.phases.some((phase) =>
    COMPETENCY_PHASES.includes(phase.kind),
  );
  if (!hasCompetencyPhases) return true;

  const current = currentCyclePhase(params.phases);
  if (!current) return false;
  if (current.kind === "COMPETENCY_EVALUATION") return true;
  if (params.evaluationType === "SELF") {
    return current.kind === "SELF_EVALUATION";
  }
  if (params.evaluationType === "MANAGER") {
    return current.kind === "EVALUATION";
  }
  return (
    current.kind === "SELF_EVALUATION" || current.kind === "EVALUATION"
  );
}

export function canEditGoalsInCyclePhase(params: {
  cycleStatus: CyclePhaseSource["status"];
  phases: CyclePhase[];
  kind: "GOAL_DEFINITION" | "FOLLOW_UP";
}): boolean {
  if (!isCycleActiveForEditing(params.cycleStatus)) return false;
  const current = currentCyclePhase(params.phases);
  return current?.kind === params.kind;
}
