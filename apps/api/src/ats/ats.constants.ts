export const ATS_AUDIT = {
  VACANCY_REQUEST_CREATED: 'VACANCY_REQUEST_CREATED',
  VACANCY_REQUEST_UPDATED: 'VACANCY_REQUEST_UPDATED',
  VACANCY_REQUEST_SUBMITTED: 'VACANCY_REQUEST_SUBMITTED',
  VACANCY_REQUEST_APPROVED_STEP: 'VACANCY_REQUEST_APPROVED_STEP',
  VACANCY_REQUEST_REJECTED: 'VACANCY_REQUEST_REJECTED',
  VACANCY_REQUEST_APPROVED: 'VACANCY_REQUEST_APPROVED',
  VACANCY_APPROVAL_WORKFLOW_UPDATED: 'VACANCY_APPROVAL_WORKFLOW_UPDATED',
  VACANCY_EVALUATOR_DEFAULTS_UPDATED: 'VACANCY_EVALUATOR_DEFAULTS_UPDATED',
  VACANCY_PROCESS_APPROVALS_UPDATED: 'VACANCY_PROCESS_APPROVALS_UPDATED',
  VACANCY_PROCESS_EVALUATORS_UPDATED: 'VACANCY_PROCESS_EVALUATORS_UPDATED',
  VACANCY_CREATED: 'VACANCY_CREATED',
  VACANCY_STATUS_CHANGED: 'VACANCY_STATUS_CHANGED',
  VACANCY_RECRUITER_ASSIGNED: 'VACANCY_RECRUITER_ASSIGNED',
  VACANCY_SALARY_UPDATED: 'VACANCY_SALARY_UPDATED',
  VACANCY_PUBLISHED: 'VACANCY_PUBLISHED',
  VACANCY_UNPUBLISHED: 'VACANCY_UNPUBLISHED',
  CANDIDATE_CREATED: 'CANDIDATE_CREATED',
  CANDIDATE_UPDATED: 'CANDIDATE_UPDATED',
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  PUBLIC_APPLICATION_CREATED: 'PUBLIC_APPLICATION_CREATED',
  APPLICATION_STAGE_CHANGED: 'APPLICATION_STAGE_CHANGED',
  INTERVIEW_CREATED: 'INTERVIEW_CREATED',
  INTERVIEW_UPDATED: 'INTERVIEW_UPDATED',
  INTERVIEW_STARTED: 'INTERVIEW_STARTED',
  INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED',
  INTERVIEW_CANCELLED: 'INTERVIEW_CANCELLED',
  INTERVIEW_ANSWER_SAVED: 'INTERVIEW_ANSWER_SAVED',
  TRANSCRIPT_SEGMENT_CREATED: 'TRANSCRIPT_SEGMENT_CREATED',
  TRANSCRIPT_SEGMENT_UPDATED: 'TRANSCRIPT_SEGMENT_UPDATED',
  TRANSCRIPT_SEGMENT_REMOVED: 'TRANSCRIPT_SEGMENT_REMOVED',
  INTERVIEW_TEMPLATE_CREATED: 'INTERVIEW_TEMPLATE_CREATED',
  INTERVIEW_TEMPLATE_UPDATED: 'INTERVIEW_TEMPLATE_UPDATED',
  OFFER_CREATED: 'OFFER_CREATED',
  OFFER_UPDATED: 'OFFER_UPDATED',
  OFFER_SENT: 'OFFER_SENT',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_REJECTED: 'OFFER_REJECTED',
  OFFER_WITHDRAWN: 'OFFER_WITHDRAWN',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  HIRING_COMPLETED: 'HIRING_COMPLETED',
} as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Temporary role used for HR and General Manager approval steps. */
export const TEMP_APPROVER_ROLE_CODE = 'CLIENT_ADMIN';

export const MAX_VACANCY_APPROVAL_STEPS = 10;
export const MAX_VACANCY_EVALUATORS = 10;

export const PROXY_REQUESTER_ROLE_CODES = [
  'CLIENT_ADMIN',
  'RECRUITER',
] as const;

/** User-facing requester errors (Spanish). Do not include tenant or employee ids. */
export const VACANCY_REQUESTER_ERRORS = {
  SELECT_REQUESTER: 'Selecciona el colaborador que realiza la solicitud.',
  NO_LINKED_EMPLOYEE:
    'Tu usuario no tiene un colaborador asociado. Contacta al administrador de la compañía.',
  CANNOT_PROXY: 'No puedes crear solicitudes en nombre de otro colaborador.',
} as const;

export const VACANCY_APPROVAL_ERRORS = {
  NO_DIRECT_MANAGER:
    'Cannot submit: requester has no DIRECT manager reporting line',
  MANAGER_NO_USER:
    "Cannot submit: the requester's direct manager has no user account in this company",
  SPECIFIC_EMPLOYEE_NO_USER:
    'Cannot submit: the assigned approver has no user account in this company',
  EMPTY_WORKFLOW:
    'Cannot submit: the approval workflow is enabled but has no steps',
  ENABLED_WITHOUT_STEPS:
    'Enable the workflow only after adding at least one approval step',
  UNKNOWN_ROLE: 'Unknown company role',
  INVALID_ROLE_FIELDS: 'ROLE steps require requiredRoleCode and no employee',
  INVALID_EMPLOYEE_FIELDS:
    'SPECIFIC_EMPLOYEE steps require specificEmployeeId and no role',
  INVALID_MANAGER_FIELDS:
    'MANAGER_OF_REQUESTER steps cannot include an employee or role',
  INVALID_POSITION_FIELDS:
    'POSITION steps require a cargo and cannot include a role',
  STEP_ALREADY_DECIDED:
    'No se puede modificar un nivel que ya aprobó o rechazó.',
  CANNOT_REMOVE_DECIDED_STEP:
    'No se puede eliminar un nivel que ya aprobó o rechazó.',
  PENDING_STEP_REQUIRED:
    'El proceso debe conservar al menos un nivel pendiente de aprobación.',
  EVALUATOR_ALREADY_EVALUATED:
    'No se puede modificar un evaluador que ya calificó en este proceso.',
  CANNOT_REMOVE_EVALUATOR:
    'No se puede eliminar un evaluador que ya calificó en este proceso.',
  PROCESS_NOT_ACTIVE: 'El proceso de selección no está activo.',
  APPROVALS_NOT_EDITABLE:
    'Solo se pueden editar niveles de un proceso en aprobación.',
} as const;

export const POSITION_OCCUPANT_ERRORS = {
  POSITION_REQUIRED: 'Selecciona un cargo.',
  NO_OCCUPANTS: 'El cargo no tiene colaboradores activos en la compañía.',
  SELECT_OCCUPANT:
    'El cargo tiene más de un ocupante. Selecciona el nombre.',
  OCCUPANT_NOT_IN_POSITION:
    'El ocupante no pertenece al cargo seleccionado.',
} as const;

export const PIPELINE_STAGES = [
  'PENDING_REVIEW',
  'CONTACTED',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
] as const;
