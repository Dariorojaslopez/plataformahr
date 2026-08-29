import {
  buildCyclePhases,
  currentCyclePhase,
  isCycleActiveForEditing,
  visibleCyclePhases,
  type CyclePhase,
  type CyclePhaseKind,
  type CyclePhaseSource,
} from "@/lib/performance/cycle-phases";
import type {
  MineEvaluation,
  MineEvaluationsResponse,
  PerformanceCycleStatus,
} from "@/types/performance";

export type MineCycleGroup = {
  cycleId: string;
  name: string;
  status: PerformanceCycleStatus;
  startDate: string;
  endDate: string;
  goalCycleId: string | null;
  phaseSource: CyclePhaseSource;
  phases: CyclePhase[];
  currentPhase: CyclePhase | null;
  self: MineEvaluation[];
  others: MineEvaluation[];
  editable: boolean;
};

function phaseSourceFromMineCycle(
  cycle: MineEvaluation["cycle"],
): CyclePhaseSource {
  return {
    status: cycle.status,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    evaluationStartDate: cycle.evaluationStartDate,
    evaluationEndDate: cycle.evaluationEndDate,
    goalDefinitionStartDate: cycle.goalDefinitionStartDate,
    goalDefinitionEndDate: cycle.goalDefinitionEndDate,
    managerEvaluationStartDate: cycle.managerEvaluationStartDate,
    managerEvaluationEndDate: cycle.managerEvaluationEndDate,
    calibrationStartDate: cycle.calibrationStartDate,
    calibrationEndDate: cycle.calibrationEndDate,
    closingStartDate: cycle.closingStartDate,
    closingEndDate: cycle.closingEndDate,
    followUps: cycle.followUps ?? [],
  };
}

export function groupMineEvaluationsByCycle(
  data: MineEvaluationsResponse | null | undefined,
  today?: Date | string,
): MineCycleGroup[] {
  const items = [...(data?.self ?? []), ...(data?.asManager ?? [])];
  const byCycle = new Map<string, MineCycleGroup>();

  for (const item of items) {
    const existing = byCycle.get(item.cycleId);
    if (existing) {
      if (item.type === "SELF") existing.self.push(item);
      else existing.others.push(item);
      continue;
    }
    const phaseSource = phaseSourceFromMineCycle(item.cycle);
    const phases = buildCyclePhases(phaseSource, today);
    byCycle.set(item.cycleId, {
      cycleId: item.cycleId,
      name: item.cycle.name,
      status: item.cycle.status,
      startDate: item.cycle.startDate,
      endDate: item.cycle.endDate,
      goalCycleId: item.cycle.goalCycleId ?? null,
      phaseSource,
      phases,
      currentPhase: currentCyclePhase(phases),
      self: item.type === "SELF" ? [item] : [],
      others: item.type === "SELF" ? [] : [item],
      editable: isCycleActiveForEditing(item.cycle.status),
    });
  }

  for (const cycle of data?.leaderCycles ?? []) {
    if (byCycle.has(cycle.id)) continue;
    const phaseSource = phaseSourceFromMineCycle(cycle);
    const phases = buildCyclePhases(phaseSource, today);
    byCycle.set(cycle.id, {
      cycleId: cycle.id,
      name: cycle.name,
      status: cycle.status,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      goalCycleId: cycle.goalCycleId ?? null,
      phaseSource,
      phases,
      currentPhase: currentCyclePhase(phases),
      self: [],
      others: [],
      editable: isCycleActiveForEditing(cycle.status),
    });
  }

  return [...byCycle.values()].sort((a, b) => {
    if (a.editable !== b.editable) return a.editable ? -1 : 1;
    return b.startDate.localeCompare(a.startDate);
  });
}

/** Phases the participant may open: past + current. Legacy cycles without windows get a synthetic evaluation phase. */
export function workspacePhases(group: MineCycleGroup): CyclePhase[] {
  const visible = visibleCyclePhases(group.phases);
  if (visible.length > 0) return visible;
  if (group.phases.length > 0) return [];
  return [
    {
      id: "competency-evaluation",
      kind: "COMPETENCY_EVALUATION",
      label: "Evaluación",
      startDate: group.startDate,
      endDate: group.endDate,
      visibility: group.editable ? "current" : "past",
    },
  ];
}

export function evaluationsForPhase(
  group: MineCycleGroup,
  kind: CyclePhaseKind,
): { self: MineEvaluation[]; others: MineEvaluation[] } {
  if (kind === "SELF_EVALUATION") {
    return {
      self: group.self,
      others: group.others.filter((item) => item.type !== "MANAGER"),
    };
  }
  if (kind === "EVALUATION") {
    return {
      self: [],
      others: group.others.filter((item) => item.type === "MANAGER"),
    };
  }
  if (kind === "COMPETENCY_EVALUATION") {
    return { self: group.self, others: group.others };
  }
  return { self: [], others: [] };
}

export function mineCycleHref(cycleId: string): string {
  return `/performance/my-evaluations/${cycleId}`;
}

export function mineCycleCta(group: MineCycleGroup): {
  label: string;
  intent: "continue" | "view";
} {
  if (group.editable && group.currentPhase) {
    return { label: "Continuar", intent: "continue" };
  }
  return { label: "Ver", intent: "view" };
}
