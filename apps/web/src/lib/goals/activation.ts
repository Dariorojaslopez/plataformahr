import type { Goal, GoalCycleStatus } from "@/types/goals";

export type ActivationCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export function buildActivationChecklist(params: {
  goal: Goal;
  cycleStatus: GoalCycleStatus;
}): ActivationCheck[] {
  const { goal, cycleStatus } = params;
  const weights = goal.keyResults.map((kr) => kr.weight);
  const anyWeighted = weights.some((w) => w != null);
  const allWeighted = weights.every((w) => w != null);
  const sum = weights.reduce((acc, w) => acc + (w == null ? 0 : Number(w)), 0);
  const weightsOk =
    goal.keyResults.length > 0 &&
    (!anyWeighted || (allWeighted && Number(sum.toFixed(2)) === 100));

  return [
    {
      key: "cycle",
      label: "El periodo está activo",
      ok: cycleStatus === "ACTIVE",
    },
    {
      key: "kr",
      label: "Al menos un Key Result",
      ok: goal.keyResults.length >= 1,
    },
    {
      key: "weights",
      label: "Pesos de KR válidos (todos vacíos o suman 100)",
      ok: weightsOk,
    },
    {
      key: "individual",
      label: "Asignación (si es individual)",
      ok:
        goal.type !== "INDIVIDUAL" || goal.assignments.length >= 1,
    },
    {
      key: "area",
      label: "Área definida (si es de área)",
      ok: goal.type !== "AREA" || Boolean(goal.areaId),
    },
  ];
}

export function canActivateFromChecklist(checks: ActivationCheck[]): boolean {
  return checks.every((c) => c.ok);
}
