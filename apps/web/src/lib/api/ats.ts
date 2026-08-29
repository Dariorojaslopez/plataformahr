import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type {
  Application,
  ApplicationStageHistory,
  ApprovalDecisionInput,
  Candidate,
  CreateApplicationForCandidateInput,
  CreateApplicationInput,
  CreateCandidateInput,
  CreateVacancyRequestInput,
  EvaluatorDefaults,
  ListApplicationsParams,
  ListCandidatesParams,
  ListVacanciesParams,
  ListVacancyRequestsParams,
  MoveApplicationInput,
  Paginated,
  PipelineResponse,
  PositionOccupant,
  PublicJob,
  PublicJobApplicationInput,
  ParsedPublicCv,
  RejectDecisionInput,
  ReplacePositionOccupantStepsInput,
  UpdateCandidateInput,
  UpdateVacancyApprovalWorkflowInput,
  UpdateVacancyInput,
  UpdateVacancyRequestInput,
  Vacancy,
  VacancyApprovalWorkflow,
  VacancyRequest,
  ActiveProcessApprovals,
  ActiveProcessEvaluators,
  ActiveSelectionProcess,
} from "@/types/ats";

function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const atsApi = {
  listVacancyRequests: (params: ListVacancyRequestsParams = {}) =>
    apiRequest<Paginated<VacancyRequest>>(
      `/ats/vacancy-requests${toQuery({
        status: params.status,
        type: params.type,
        requestedByEmployeeId: params.requestedByEmployeeId,
        pendingMyApproval: params.pendingMyApproval === true ? true : undefined,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getVacancyRequest: (id: string) =>
    apiRequest<VacancyRequest>(`/ats/vacancy-requests/${id}`),

  createVacancyRequest: (body: CreateVacancyRequestInput) =>
    apiRequest<VacancyRequest>("/ats/vacancy-requests", {
      method: "POST",
      body,
    }),

  updateVacancyRequest: (id: string, body: UpdateVacancyRequestInput) =>
    apiRequest<VacancyRequest>(`/ats/vacancy-requests/${id}`, {
      method: "PATCH",
      body,
    }),

  submitVacancyRequest: (id: string) =>
    apiRequest<VacancyRequest>(`/ats/vacancy-requests/${id}/submit`, {
      method: "POST",
    }),

  approveVacancyRequest: (id: string, body: ApprovalDecisionInput = {}) =>
    apiRequest<VacancyRequest>(`/ats/vacancy-requests/${id}/approve`, {
      method: "POST",
      body,
    }),

  rejectVacancyRequest: (id: string, body: RejectDecisionInput) =>
    apiRequest<VacancyRequest>(`/ats/vacancy-requests/${id}/reject`, {
      method: "POST",
      body,
    }),

  getVacancyApprovalWorkflow: () =>
    apiRequest<VacancyApprovalWorkflow>("/ats/vacancy-approval-workflow"),

  updateVacancyApprovalWorkflow: (body: UpdateVacancyApprovalWorkflowInput) =>
    apiRequest<VacancyApprovalWorkflow>("/ats/vacancy-approval-workflow", {
      method: "PUT",
      body,
    }),

  listPositionOccupants: (positionId: string) =>
    apiRequest<PositionOccupant[]>(
      `/ats/position-occupants${toQuery({ positionId })}`,
    ),

  getEvaluatorDefaults: () =>
    apiRequest<EvaluatorDefaults>("/ats/evaluator-defaults"),

  updateEvaluatorDefaults: (body: ReplacePositionOccupantStepsInput) =>
    apiRequest<EvaluatorDefaults>("/ats/evaluator-defaults", {
      method: "PUT",
      body,
    }),

  listActiveProcesses: () =>
    apiRequest<{ items: ActiveSelectionProcess[] }>("/ats/active-processes"),

  getActiveProcessApprovals: (id: string) =>
    apiRequest<ActiveProcessApprovals>(`/ats/active-processes/${id}/approvals`),

  updateActiveProcessApprovals: (
    id: string,
    body: ReplacePositionOccupantStepsInput,
  ) =>
    apiRequest<ActiveProcessApprovals>(
      `/ats/active-processes/${id}/approvals`,
      { method: "PUT", body },
    ),

  getActiveProcessEvaluators: (id: string) =>
    apiRequest<ActiveProcessEvaluators>(
      `/ats/active-processes/${id}/evaluators`,
    ),

  updateActiveProcessEvaluators: (
    id: string,
    body: ReplacePositionOccupantStepsInput,
  ) =>
    apiRequest<ActiveProcessEvaluators>(
      `/ats/active-processes/${id}/evaluators`,
      { method: "PUT", body },
    ),

  listVacancies: (params: ListVacanciesParams = {}) =>
    apiRequest<Paginated<Vacancy>>(
      `/ats/vacancies${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getVacancy: (id: string) => apiRequest<Vacancy>(`/ats/vacancies/${id}`),

  listRecruiters: () =>
    apiRequest<
      Array<{ id: string; firstName: string; lastName: string; email: string }>
    >("/ats/vacancies/recruiters"),

  updateVacancy: (id: string, body: UpdateVacancyInput) =>
    apiRequest<Vacancy>(`/ats/vacancies/${id}`, {
      method: "PATCH",
      body,
    }),

  publishVacancy: (id: string) =>
    apiRequest<Vacancy>(`/ats/vacancies/${id}/publish`, { method: "POST" }),

  unpublishVacancy: (id: string) =>
    apiRequest<Vacancy>(`/ats/vacancies/${id}/unpublish`, { method: "POST" }),

  previewVacancyPublic: (id: string) =>
    apiRequest<PublicJob>(`/ats/vacancies/${id}/public-preview`),

  getVacancyPipeline: (vacancyId: string) =>
    apiRequest<PipelineResponse>(`/ats/vacancies/${vacancyId}/pipeline`),

  listCandidates: (params: ListCandidatesParams = {}) =>
    apiRequest<Paginated<Candidate>>(
      `/ats/candidates${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getCandidate: (id: string) => apiRequest<Candidate>(`/ats/candidates/${id}`),

  downloadCandidateCv: (id: string) =>
    apiRequestBlob(`/ats/candidates/${id}/cv`, {
      headers: { Accept: "application/octet-stream, */*" },
    }),

  createCandidate: (body: CreateCandidateInput) =>
    apiRequest<Candidate>("/ats/candidates", { method: "POST", body }),

  updateCandidate: (id: string, body: UpdateCandidateInput) =>
    apiRequest<Candidate>(`/ats/candidates/${id}`, {
      method: "PATCH",
      body,
    }),

  createApplicationForCandidate: (
    candidateId: string,
    body: CreateApplicationForCandidateInput,
  ) =>
    apiRequest<Application>(`/ats/candidates/${candidateId}/applications`, {
      method: "POST",
      body,
    }),

  listApplications: (params: ListApplicationsParams = {}) =>
    apiRequest<Paginated<Application>>(
      `/ats/applications${toQuery({
        vacancyId: params.vacancyId,
        candidateId: params.candidateId,
        stage: params.stage,
        status: params.status,
        areaId: params.areaId,
        positionId: params.positionId,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getApplication: (id: string) =>
    apiRequest<Application>(`/ats/applications/${id}`),

  createApplication: (body: CreateApplicationInput) =>
    apiRequest<Application>("/ats/applications", { method: "POST", body }),

  moveApplication: (id: string, body: MoveApplicationInput) =>
    apiRequest<Application>(`/ats/applications/${id}/move`, {
      method: "POST",
      body,
    }),

  getApplicationHistory: (id: string) =>
    apiRequest<ApplicationStageHistory[]>(`/ats/applications/${id}/history`),
};

export const publicJobsApi = {
  get: (publicId: string) =>
    apiRequest<PublicJob>(`/public/jobs/${encodeURIComponent(publicId)}`, {
      auth: false,
      companyId: null,
    }),

  parseCv: (publicId: string, file: File) => {
    const formData = new FormData();
    formData.append("cv", file);
    return apiRequest<ParsedPublicCv>(
      `/public/jobs/${encodeURIComponent(publicId)}/parse-cv`,
      {
        method: "POST",
        formData,
        auth: false,
        companyId: null,
      },
    );
  },

  apply: (
    publicId: string,
    body: PublicJobApplicationInput,
    file?: File,
  ) => {
    if (!file) {
      return apiRequest<{ ok: true }>(
        `/public/jobs/${encodeURIComponent(publicId)}/apply`,
        {
          method: "POST",
          body,
          auth: false,
          companyId: null,
        },
      );
    }
    const formData = new FormData();
    formData.append("firstName", body.firstName);
    formData.append("lastName", body.lastName);
    formData.append("email", body.email);
    formData.append("phone", body.phone);
    formData.append("documentType", body.documentType);
    formData.append("documentNumber", body.documentNumber);
    formData.append("cv", file);
    return apiRequest<{ ok: true }>(
      `/public/jobs/${encodeURIComponent(publicId)}/apply`,
      {
        method: "POST",
        formData,
        auth: false,
        companyId: null,
      },
    );
  },
};

export const atsKeys = {
  all: (companyId: string) => ["ats", companyId] as const,
  vacancyRequests: (companyId: string, params: ListVacancyRequestsParams = {}) =>
    [...atsKeys.all(companyId), "vacancy-requests", params] as const,
  vacancyRequest: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "vacancy-request", id] as const,
  vacancyApprovalWorkflow: (companyId: string) =>
    [...atsKeys.all(companyId), "vacancy-approval-workflow"] as const,
  positionOccupants: (companyId: string, positionId: string) =>
    [...atsKeys.all(companyId), "position-occupants", positionId] as const,
  evaluatorDefaults: (companyId: string) =>
    [...atsKeys.all(companyId), "evaluator-defaults"] as const,
  activeProcesses: (companyId: string) =>
    [...atsKeys.all(companyId), "active-processes"] as const,
  activeProcessApprovals: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "active-process-approvals", id] as const,
  activeProcessEvaluators: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "active-process-evaluators", id] as const,
  vacancies: (companyId: string, params: ListVacanciesParams = {}) =>
    [...atsKeys.all(companyId), "vacancies", params] as const,
  vacancy: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "vacancy", id] as const,
  vacancyPublicPreview: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "vacancy-public-preview", id] as const,
  recruiters: (companyId: string) =>
    [...atsKeys.all(companyId), "recruiters"] as const,
  candidates: (companyId: string, params: ListCandidatesParams = {}) =>
    [...atsKeys.all(companyId), "candidates", params] as const,
  candidate: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "candidate", id] as const,
  applications: (companyId: string, params: ListApplicationsParams = {}) =>
    [...atsKeys.all(companyId), "applications", params] as const,
  application: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "application", id] as const,
  applicationHistory: (companyId: string, id: string) =>
    [...atsKeys.all(companyId), "application-history", id] as const,
  pipeline: (companyId: string, vacancyId: string) =>
    [...atsKeys.all(companyId), "pipeline", vacancyId] as const,
};
