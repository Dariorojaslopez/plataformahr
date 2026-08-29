import type {
  ApplicationStage,
  ApplicationStatus,
  ApprovalStatus,
  CandidateStatus,
  VacancyApprovalStep,
  VacancyApproverType,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
} from "@/types/ats";
import type {
  InterviewFormStatus,
  InterviewQuestionType,
  InterviewStatus,
  InterviewType,
  TranscriptSegmentKind,
} from "@/types/interviews";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

export const APPLICATION_STAGES: ApplicationStage[] = [
  "PENDING_REVIEW",
  "CONTACTED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

export const VACANCY_REQUEST_STATUS_LABELS: Record<
  VacancyRequestStatus,
  string
> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "En aprobación",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export const VACANCY_REQUEST_TYPE_LABELS: Record<VacancyRequestType, string> = {
  EXISTING_POSITION: "Cargo existente",
  NEW_POSITION: "Cargo nuevo",
};

export const APPROVAL_STEP_LABELS: Record<VacancyApprovalStep, string> = {
  DIRECT_MANAGER: "Líder directo",
  HR: "RRHH",
  GENERAL_MANAGER: "Gerencia General",
  ROLE: "Rol",
  SPECIFIC_EMPLOYEE: "Colaborador",
  POSITION: "Cargo",
};

export const VACANCY_APPROVER_TYPE_LABELS: Record<VacancyApproverType, string> = {
  MANAGER_OF_REQUESTER: "Jefe directo del solicitante",
  SPECIFIC_EMPLOYEE: "Colaborador específico",
  ROLE: "Rol de la compañía",
  POSITION: "Cargo",
};

export const COMPANY_ROLE_LABELS: Record<string, string> = {
  CLIENT_ADMIN: "Administrador de compañía",
  LEADER: "Líder",
  RECRUITER: "Reclutador",
  PERFORMANCE_MANAGER: "Gestor de performance",
  COLLABORATOR: "Colaborador",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  SKIPPED: "Omitido",
};

export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = {
  OPEN: "Abierta",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  HIRED: "Contratado",
};

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  PENDING_REVIEW: "Pendiente de revisión",
  CONTACTED: "Contactado",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  HIRED: "Contratado",
  REJECTED: "Rechazado",
  WITHDRAWN: "Retirado",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
};

export function vacancyRequestStatusVariant(
  status: VacancyRequestStatus,
): BadgeVariant {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "destructive";
    case "PENDING_APPROVAL":
      return "warning";
    default:
      return "secondary";
  }
}

export function approvalStatusVariant(status: ApprovalStatus): BadgeVariant {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "SKIPPED":
      return "outline";
    default:
      return "warning";
  }
}

export function vacancyStatusVariant(status: VacancyStatus): BadgeVariant {
  switch (status) {
    case "OPEN":
      return "success";
    case "PAUSED":
      return "warning";
    case "CLOSED":
      return "secondary";
    case "CANCELLED":
      return "destructive";
    default:
      return "secondary";
  }
}

export function candidateStatusVariant(status: CandidateStatus): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "HIRED":
      return "default";
    case "INACTIVE":
      return "secondary";
    default:
      return "secondary";
  }
}

export function applicationStageVariant(
  stage: ApplicationStage,
): BadgeVariant {
  switch (stage) {
    case "HIRED":
      return "success";
    case "REJECTED":
    case "WITHDRAWN":
      return "destructive";
    case "OFFER":
    case "INTERVIEW":
      return "warning";
    default:
      return "secondary";
  }
}

export function formatEmployeeName(
  employee:
    | { firstName: string; lastName: string; email?: string }
    | null
    | undefined,
): string {
  if (!employee) return "—";
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
}

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  HR: "RRHH",
  TECHNICAL: "Técnica",
  MANAGER: "Gerencial",
  GENERAL: "General",
  OTHER: "Otra",
};

export const INTERVIEW_FORM_STATUS_LABELS: Record<InterviewFormStatus, string> =
  {
    ACTIVE: "Activa",
    INACTIVE: "Inactiva",
  };

export const INTERVIEW_QUESTION_TYPE_LABELS: Record<
  InterviewQuestionType,
  string
> = {
  TEXT: "Texto corto",
  TEXTAREA: "Texto largo",
  RATING: "Calificación 1–5",
  YES_NO: "Sí / No",
};

export const TRANSCRIPT_KIND_LABELS: Record<TranscriptSegmentKind, string> = {
  QUESTION: "Pregunta",
  ANSWER: "Respuesta",
  NOTE: "Nota",
  UNCLASSIFIED: "Sin clasificar",
};

export function interviewStatusVariant(status: InterviewStatus): BadgeVariant {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "CANCELLED":
      return "destructive";
    case "SCHEDULED":
      return "default";
    default:
      return "secondary";
  }
}

export function transcriptKindVariant(
  kind: TranscriptSegmentKind,
): BadgeVariant {
  switch (kind) {
    case "QUESTION":
      return "default";
    case "ANSWER":
      return "success";
    case "NOTE":
      return "warning";
    default:
      return "outline";
  }
}

/** Application stages that allow creating an interview (backend rule). */
export function canScheduleInterviewForStage(
  stage: ApplicationStage,
): boolean {
  return (
    stage !== "REJECTED" && stage !== "WITHDRAWN" && stage !== "HIRED"
  );
}
