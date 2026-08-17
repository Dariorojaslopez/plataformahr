import { ApiError } from "@/lib/api/errors";

export const VACANCY_REQUESTER_MESSAGES = {
  selectRequester: "Selecciona el colaborador que realiza la solicitud.",
  noLinkedEmployee:
    "Tu usuario no tiene un colaborador asociado. Contacta al administrador de la compañía.",
  cannotProxy: "No puedes crear solicitudes en nombre de otro colaborador.",
  proxyHint:
    "Puedes solicitar en tu nombre o elegir a otro colaborador si tu rol lo permite.",
  proxyRequiredHint:
    "Tu usuario no tiene un colaborador asociado. Selecciona quién realiza la solicitud. Si no eres administrador o reclutador, contacta al administrador de la compañía.",
} as const;

export type VacancyRequesterUiInput = {
  linkedEmployeeExists: boolean;
  canProxyRequester: boolean;
};

export type VacancyRequesterField = {
  showSelector: boolean;
  allowSelfOption: boolean;
  requesterRequired: boolean;
  blocked: boolean;
  emptyLabel: string | null;
  hint: string | null;
  blockedMessage: string | null;
};

export function findLinkedEmployeeId(
  employees: Array<{ id: string; userId: string | null }>,
  userId: string | null | undefined,
): string | null {
  if (!userId) return null;
  const match = employees.find((employee) => employee.userId === userId);
  return match?.id ?? null;
}

export function describeVacancyRequesterField(
  input: VacancyRequesterUiInput,
): VacancyRequesterField {
  const { linkedEmployeeExists, canProxyRequester } = input;

  if (!linkedEmployeeExists && !canProxyRequester) {
    return {
      showSelector: false,
      allowSelfOption: false,
      requesterRequired: false,
      blocked: true,
      emptyLabel: null,
      hint: null,
      blockedMessage: VACANCY_REQUESTER_MESSAGES.noLinkedEmployee,
    };
  }

  if (!canProxyRequester) {
    return {
      showSelector: false,
      allowSelfOption: false,
      requesterRequired: false,
      blocked: false,
      emptyLabel: null,
      hint: null,
      blockedMessage: null,
    };
  }

  if (linkedEmployeeExists) {
    return {
      showSelector: true,
      allowSelfOption: true,
      requesterRequired: false,
      blocked: false,
      emptyLabel: "Yo",
      hint: VACANCY_REQUESTER_MESSAGES.proxyHint,
      blockedMessage: null,
    };
  }

  return {
    showSelector: true,
    allowSelfOption: false,
    requesterRequired: true,
    blocked: false,
    emptyLabel: null,
    hint: VACANCY_REQUESTER_MESSAGES.proxyRequiredHint,
    blockedMessage: null,
  };
}

export function validateRequesterSelection(
  requestedByEmployeeId: string,
  field: VacancyRequesterField,
): string | null {
  if (field.blocked) {
    return field.blockedMessage;
  }
  if (field.requesterRequired && !requestedByEmployeeId) {
    return VACANCY_REQUESTER_MESSAGES.selectRequester;
  }
  return null;
}

export function vacancyRequestSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 422
    ) {
      return error.message || "No se pudo guardar la solicitud.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "No se pudo guardar la solicitud.";
}
