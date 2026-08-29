import type { ApplicationStage, PipelineCard } from "@/types/ats";

export type KanbanColumnId = "NEW" | "ATTRACTION" | "EVALUATORS" | "HIRED";

export type FitLevel = "green" | "yellow" | "red" | "gray";

export const KANBAN_COLUMNS: Array<{
  id: KanbanColumnId;
  label: string;
  stages: ApplicationStage[];
  dropHint: string;
}> = [
  {
    id: "NEW",
    label: "Nuevo",
    stages: ["PENDING_REVIEW", "CONTACTED"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "ATTRACTION",
    label: "Entrevista Equipo de Atracción",
    stages: ["INTERVIEW"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "EVALUATORS",
    label: "Entrevista Evaluadores",
    stages: ["OFFER"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "HIRED",
    label: "Contratado",
    stages: ["HIRED"],
    dropHint: "Arrastra candidatos aquí",
  },
];

export function kanbanColumnForStage(
  stage: ApplicationStage,
): KanbanColumnId | null {
  const column = KANBAN_COLUMNS.find((item) => item.stages.includes(stage));
  return column?.id ?? null;
}

export function stageForKanbanColumn(
  columnId: KanbanColumnId,
): ApplicationStage {
  if (columnId === "NEW") return "PENDING_REVIEW";
  if (columnId === "ATTRACTION") return "INTERVIEW";
  if (columnId === "EVALUATORS") return "OFFER";
  return "HIRED";
}

/** Kanban drop targets a recruiter can use from the current stage. */
export function getValidKanbanTargets(stage: ApplicationStage): KanbanColumnId[] {
  if (stage === "PENDING_REVIEW" || stage === "CONTACTED") {
    return ["ATTRACTION"];
  }
  if (stage === "INTERVIEW") {
    return ["EVALUATORS"];
  }
  if (stage === "OFFER") {
    return ["HIRED"];
  }
  return [];
}

export function fitLevelFromRatings(
  ratings: Array<number | null | undefined>,
): FitLevel {
  const values = ratings.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (values.length === 0) return "gray";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 4) return "green";
  if (average >= 3) return "yellow";
  return "red";
}

export const FIT_LEVEL_LABELS: Record<FitLevel, string> = {
  green: "Alto ajuste al cargo",
  yellow: "Ajuste medio al cargo",
  red: "Bajo ajuste al cargo",
  gray: "Sin evaluación de ajuste",
};

export type InterviewPhaseDecision = "DISCARDED" | "STANDBY" | "ADVANCE";

export const INTERVIEW_PHASE_DECISION_LABELS: Record<
  InterviewPhaseDecision,
  string
> = {
  DISCARDED: "Descartado",
  STANDBY: "Se queda en standby",
  ADVANCE: "Pasa a la siguiente fase",
};

export function nextStageForInterviewAdvance(
  stage: ApplicationStage,
): ApplicationStage | null {
  if (stage === "CONTACTED" || stage === "PENDING_REVIEW") return "INTERVIEW";
  if (stage === "INTERVIEW") return "OFFER";
  return null;
}

export function interviewPhaseDecisionOptions(
  _stage?: ApplicationStage,
): InterviewPhaseDecision[] {
  return ["DISCARDED", "STANDBY", "ADVANCE"];
}

export function groupCardsByKanbanColumn(
  cards: PipelineCard[],
): Record<KanbanColumnId, PipelineCard[]> {
  const grouped: Record<KanbanColumnId, PipelineCard[]> = {
    NEW: [],
    ATTRACTION: [],
    EVALUATORS: [],
    HIRED: [],
  };
  for (const card of cards) {
    const column = kanbanColumnForStage(card.stage);
    if (column) grouped[column].push(card);
  }
  return grouped;
}

export type HireRequirementId =
  | "OFFER_STAGE"
  | "OFFER_ACCEPTED"
  | "VACANCY_CAPACITY";

export type HireRequirementCheck = {
  id: HireRequirementId;
  label: string;
  met: boolean;
};

export function hireRequirementChecks(input: {
  stage: ApplicationStage | string;
  offerStatus: string | null;
  headcount: number;
  filledCount: number;
}): HireRequirementCheck[] {
  return [
    {
      id: "OFFER_STAGE",
      label: "El candidato está en Entrevista Evaluadores",
      met: input.stage === "OFFER",
    },
    {
      id: "OFFER_ACCEPTED",
      label: "La oferta laboral está aceptada",
      met: input.offerStatus === "ACCEPTED",
    },
    {
      id: "VACANCY_CAPACITY",
      label: "Hay cupo disponible en la vacante",
      met: input.headcount - input.filledCount > 0,
    },
  ];
}
