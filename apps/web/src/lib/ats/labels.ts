import type {
  ApplicationStage,
  ApplicationStatus,
  ApprovalStatus,
  CandidateStatus,
  VacancyApprovalStep,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
} from "@/types/ats";

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
