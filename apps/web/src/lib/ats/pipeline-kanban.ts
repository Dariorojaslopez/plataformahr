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
    label: "Aplicantes",
    stages: ["PENDING_REVIEW", "CONTACTED"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "ATTRACTION",
    label: "Evaluación",
    stages: ["INTERVIEW"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "EVALUATORS",
    label: "Finalistas",
    stages: ["OFFER"],
    dropHint: "Arrastra candidatos aquí",
  },
  {
    id: "HIRED",
    label: "A Contratar",
    stages: ["TO_HIRE", "HIRED"],
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
  green: "Ajuste adecuado",
  yellow: "Ajuste parcial",
  red: "No se ajusta",
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

export function interviewPhaseDecisionOptions(): InterviewPhaseDecision[] {
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
  | "VACANCY_CAPACITY"
  | "CV"
  | "SECURITY_STUDY_DOC"
  | "MEDICAL_EXAM_DOC"
  | "SIGNED_OFFER_LETTER";

export const FINALIST_HIRE_DOCUMENT_LABELS = {
  CV: "Hoja de vida",
  SECURITY_STUDY: "Estudio de seguridad",
  MEDICAL_EXAM: "Exámenes médicos",
  OFFER_LETTER: "Carta oferta",
} as const;

export function missingFinalistHireDocuments(card: {
  hasCv?: boolean;
  hasSecurityStudyDoc?: boolean;
  hasMedicalExamDoc?: boolean;
  hasCompanyOfferLetterTemplate?: boolean | null;
  hasSignedOfferLetter?: boolean | null;
}): string[] {
  const missing: string[] = [];
  if (!card.hasCv) missing.push(FINALIST_HIRE_DOCUMENT_LABELS.CV);
  if (!card.hasSecurityStudyDoc) {
    missing.push(FINALIST_HIRE_DOCUMENT_LABELS.SECURITY_STUDY);
  }
  if (!card.hasMedicalExamDoc) {
    missing.push(FINALIST_HIRE_DOCUMENT_LABELS.MEDICAL_EXAM);
  }
  if (card.hasCompanyOfferLetterTemplate && !card.hasSignedOfferLetter) {
    missing.push(FINALIST_HIRE_DOCUMENT_LABELS.OFFER_LETTER);
  }
  return missing;
}

export function finalistHireDocumentsBlockedMessage(missing: string[]): string {
  return `Para pasar a Contratar carga: ${missing.join(", ")}. El candidato permanece en Finalistas.`;
}

export type HireRequirementCheck = {
  id: HireRequirementId;
  label: string;
  met: boolean;
};

export function isContractApprovalClear(
  status: string | null | undefined,
): boolean {
  return status === "APPROVED" || status === "NOT_REQUIRED" || !status;
}

export function isReadyToCreateCollaborator(card: {
  stage?: string;
  hasCompanyContractTemplate?: boolean | null;
  hasSignedContract?: boolean | null;
  contractApprovalStatus?: string | null;
}): boolean {
  if (card.stage !== "TO_HIRE") return false;
  if (!card.hasCompanyContractTemplate) return true;
  if (!card.hasSignedContract) return false;
  return isContractApprovalClear(card.contractApprovalStatus);
}

export function isSignedOfferLetterClear(input: {
  hasCompanyOfferLetterTemplate?: boolean | null;
  hasSignedOfferLetter?: boolean | null;
}): boolean {
  return !input.hasCompanyOfferLetterTemplate || Boolean(input.hasSignedOfferLetter);
}

export function isOfferAcceptedForHire(input: {
  offerStatus: string | null;
  hasCompanyOfferLetterTemplate?: boolean | null;
  hasSignedOfferLetter?: boolean | null;
  offerLetterApprovalStatus?: string | null;
  offerLetterSentAt?: string | null;
  offerLetterSendMode?: string | null;
  offerLetterCandidateSignedAt?: string | null;
}): boolean {
  if (input.offerStatus === "ACCEPTED") return true;
  if (!input.hasSignedOfferLetter) return false;
  const approval = input.offerLetterApprovalStatus;
  if (approval !== "APPROVED" && approval !== "NOT_REQUIRED") return false;
  if (approval === "NOT_REQUIRED") return true;
  if (!input.offerLetterSentAt) return false;
  if (input.offerLetterSendMode === "DIGITAL_SIGNATURE") {
    return Boolean(input.offerLetterCandidateSignedAt);
  }
  return true;
}

/** Finalistas (OFFER) for recruiter docs table. */
export function finalistCardsForDocs(cards: PipelineCard[]): PipelineCard[] {
  return cards.filter((card) => card.stage === "OFFER");
}

export function hireRequirementChecks(input: {
  stage: ApplicationStage | string;
  offerStatus: string | null;
  headcount: number;
  filledCount: number;
  hasCv?: boolean | null;
  hasSecurityStudyDoc?: boolean | null;
  hasMedicalExamDoc?: boolean | null;
  contractApprovalStatus?: string | null;
  hasCompanyOfferLetterTemplate?: boolean | null;
  hasSignedOfferLetter?: boolean | null;
  offerLetterApprovalStatus?: string | null;
  offerLetterSentAt?: string | null;
  offerLetterSendMode?: string | null;
  offerLetterCandidateSignedAt?: string | null;
}): HireRequirementCheck[] {
  return [
    {
      id: "OFFER_STAGE",
      label: "El candidato está en Finalistas",
      met: input.stage === "OFFER",
    },
    {
      id: "OFFER_ACCEPTED",
      label: "Oferta aceptada o carta oferta enviada al candidato",
      met: isOfferAcceptedForHire(input),
    },
    {
      id: "VACANCY_CAPACITY",
      label: "Hay cupo disponible en la vacante",
      met: input.headcount - input.filledCount > 0,
    },
    {
      id: "CV",
      label: "Hoja de vida cargada",
      met: Boolean(input.hasCv),
    },
    {
      id: "SECURITY_STUDY_DOC",
      label: "Estudio de seguridad cargado",
      met: Boolean(input.hasSecurityStudyDoc),
    },
    {
      id: "MEDICAL_EXAM_DOC",
      label: "Exámenes médicos cargados",
      met: Boolean(input.hasMedicalExamDoc),
    },
    {
      id: "SIGNED_OFFER_LETTER",
      label: "Carta oferta diligenciada cargada (si hay plantilla)",
      met: isSignedOfferLetterClear({
        hasCompanyOfferLetterTemplate: input.hasCompanyOfferLetterTemplate,
        hasSignedOfferLetter: input.hasSignedOfferLetter,
      }),
    },
  ];
}
