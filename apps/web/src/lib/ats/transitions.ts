import type { ApplicationStage, VacancyStatus } from "@/types/ats";

/** Mirrors apps/api applications.service ALLOWED_STAGE_TRANSITIONS. */
export const ALLOWED_STAGE_TRANSITIONS: Record<
  ApplicationStage,
  ApplicationStage[]
> = {
  PENDING_REVIEW: ["CONTACTED", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  CONTACTED: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFER", "REJECTED", "WITHDRAWN"],
  OFFER: ["REJECTED", "WITHDRAWN"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const TERMINAL_STAGES = new Set<ApplicationStage>([
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
]);

export function getValidMoveTargets(
  stage: ApplicationStage,
): ApplicationStage[] {
  return ALLOWED_STAGE_TRANSITIONS[stage];
}

export function canMoveApplication(stage: ApplicationStage): boolean {
  return getValidMoveTargets(stage).length > 0;
}

export function isTerminalStage(stage: ApplicationStage): boolean {
  return TERMINAL_STAGES.has(stage);
}

export function moveRequiresComment(stage: ApplicationStage): boolean {
  return stage === "REJECTED" || stage === "WITHDRAWN";
}

/** Mirrors apps/api vacancies.service status matrix. */
export const ALLOWED_VACANCY_STATUS_TRANSITIONS: Record<
  VacancyStatus,
  VacancyStatus[]
> = {
  OPEN: ["PAUSED", "CLOSED", "CANCELLED"],
  PAUSED: ["OPEN", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export function getVacancyStatusActions(
  status: VacancyStatus,
): VacancyStatus[] {
  return ALLOWED_VACANCY_STATUS_TRANSITIONS[status];
}

export const VACANCY_STATUS_ACTION_LABELS: Record<VacancyStatus, string> = {
  OPEN: "Reabrir",
  PAUSED: "Pausar",
  CLOSED: "Cerrar",
  CANCELLED: "Cancelar",
};
