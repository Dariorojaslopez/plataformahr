import type {
  CreateGoalInput,
  CreateKeyResultInput,
  GoalMetricDirection,
  GoalMetricType,
} from "@/types/goals";

export type OrganizationalGoalForm = {
  cycleId: string;
  newCycleName: string;
  newCycleStartDate: string;
  newCycleEndDate: string;
  title: string;
  description: string;
  metricType: GoalMetricType;
  direction: GoalMetricDirection | "";
  startValue: string;
  targetValue: string;
  targetBoolean: boolean;
  unit: string;
  currencyCode: string;
};

export function emptyOrganizationalGoalForm(): OrganizationalGoalForm {
  return {
    cycleId: "",
    newCycleName: "",
    newCycleStartDate: "",
    newCycleEndDate: "",
    title: "",
    description: "",
    metricType: "PERCENTAGE",
    direction: "INCREASE",
    startValue: "0",
    targetValue: "100",
    targetBoolean: true,
    unit: "",
    currencyCode: "COP",
  };
}

export function canManageOrganizationalGoals(
  roleCodes: readonly string[] | null | undefined,
): boolean {
  const codes = roleCodes ?? [];
  return (
    codes.includes("CLIENT_ADMIN") || codes.includes("PERFORMANCE_MANAGER")
  );
}

function parseOptionalNumber(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} no es un número válido.`);
  }
  return n;
}

export function buildOrganizationalGoalCreate(
  form: OrganizationalGoalForm,
): {
  cycle:
    | { id: string }
    | { name: string; startDate: string; endDate: string };
  goal: Omit<CreateGoalInput, "cycleId">;
  keyResult: CreateKeyResultInput;
} {
  const title = form.title.trim();
  if (!title) {
    throw new Error("El título es obligatorio.");
  }

  const cycleId = form.cycleId.trim();
  const cycle = cycleId
    ? { id: cycleId }
    : (() => {
        const name = form.newCycleName.trim();
        if (!name || !form.newCycleStartDate || !form.newCycleEndDate) {
          throw new Error(
            "Selecciona un periodo o crea uno con nombre y fechas.",
          );
        }
        if (form.newCycleStartDate >= form.newCycleEndDate) {
          throw new Error("La fecha de inicio debe ser anterior al cierre.");
        }
        return {
          name,
          startDate: form.newCycleStartDate,
          endDate: form.newCycleEndDate,
        };
      })();

  const metricType = form.metricType;
  const keyResult: CreateKeyResultInput = {
    title: "Meta",
    metricType,
  };

  if (metricType === "BOOLEAN") {
    keyResult.targetBoolean = form.targetBoolean;
  } else {
    const targetValue = parseOptionalNumber(form.targetValue, "La meta");
    if (targetValue == null) {
      throw new Error("Indica la meta.");
    }
    if (form.direction !== "INCREASE" && form.direction !== "DECREASE") {
      throw new Error("Selecciona si la meta es aumentar o reducir.");
    }
    keyResult.direction = form.direction;
    keyResult.targetValue = targetValue;
    keyResult.startValue = parseOptionalNumber(
      form.startValue,
      "El valor inicial",
    );
    if (metricType === "CURRENCY") {
      const code = form.currencyCode.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        throw new Error("La moneda debe ser un código de 3 letras (ej. COP).");
      }
      keyResult.currencyCode = code;
    } else if (form.unit.trim()) {
      keyResult.unit = form.unit.trim();
    }
  }

  return {
    cycle,
    goal: {
      title,
      description: form.description.trim() || null,
      type: "COMPANY",
    },
    keyResult,
  };
}
