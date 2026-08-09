import { apiRequest, apiRequestBlob } from "@/lib/api/client";
import type {
  AddCycleCompetencyInput,
  AssignParticipantInput,
  AssignParticipantResult,
  BulkAssignParticipantsInput,
  BulkAssignParticipantsResult,
  Competency,
  CompetencyScale,
  CompetencyScaleLevel,
  CreateCompetencyInput,
  CreateCompetencyScaleInput,
  CreatePerformanceCycleInput,
  CreateScaleLevelInput,
  CycleAnalytics,
  CycleCompetency,
  CycleParticipantDetail,
  CycleParticipantListItem,
  ListCompetenciesParams,
  ListParticipantsParams,
  ListPerformanceCyclesParams,
  ListPerformanceResultsParams,
  ListScalesParams,
  MineEvaluationsResponse,
  MineResultsResponse,
  Paginated,
  PerformanceCycle,
  PerformanceCycleDetail,
  PerformanceEvaluationDetail,
  PerformanceResultAdminDetail,
  PerformanceResultAdminListItem,
  PerformanceResultEmployeeDetail,
  SaveEvaluationResponseInput,
  SaveEvaluationResponseResult,
  UpdateCompetencyInput,
  UpdateCompetencyScaleInput,
  UpdateCycleCompetencyInput,
  UpdatePerformanceCycleInput,
  UpdateScaleLevelInput,
} from "@/types/performance";

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const performanceApi = {
  listCycles: (params: ListPerformanceCyclesParams = {}) =>
    apiRequest<Paginated<PerformanceCycle>>(
      `/performance/cycles${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getCycle: (id: string) =>
    apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}`),

  createCycle: (body: CreatePerformanceCycleInput) =>
    apiRequest<PerformanceCycle>("/performance/cycles", {
      method: "POST",
      body,
    }),

  updateCycle: (id: string, body: UpdatePerformanceCycleInput) =>
    apiRequest<PerformanceCycle>(`/performance/cycles/${id}`, {
      method: "PATCH",
      body,
    }),

  activateCycle: (id: string) =>
    apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}/activate`, {
      method: "POST",
    }),

  closeCycle: (id: string) =>
    apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}/close`, {
      method: "POST",
    }),

  cancelCycle: (id: string) =>
    apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}/cancel`, {
      method: "POST",
    }),

  listCycleCompetencies: (cycleId: string) =>
    apiRequest<CycleCompetency[]>(
      `/performance/cycles/${cycleId}/competencies`,
    ),

  addCycleCompetency: (cycleId: string, body: AddCycleCompetencyInput) =>
    apiRequest<CycleCompetency>(
      `/performance/cycles/${cycleId}/competencies`,
      { method: "POST", body },
    ),

  updateCycleCompetency: (
    cycleId: string,
    competencyId: string,
    body: UpdateCycleCompetencyInput,
  ) =>
    apiRequest<CycleCompetency>(
      `/performance/cycles/${cycleId}/competencies/${competencyId}`,
      { method: "PATCH", body },
    ),

  removeCycleCompetency: (cycleId: string, competencyId: string) =>
    apiRequest<void>(
      `/performance/cycles/${cycleId}/competencies/${competencyId}`,
      { method: "DELETE" },
    ),

  listCompetencies: (params: ListCompetenciesParams = {}) =>
    apiRequest<Paginated<Competency>>(
      `/performance/competencies${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getCompetency: (id: string) =>
    apiRequest<Competency>(`/performance/competencies/${id}`),

  createCompetency: (body: CreateCompetencyInput) =>
    apiRequest<Competency>("/performance/competencies", {
      method: "POST",
      body,
    }),

  updateCompetency: (id: string, body: UpdateCompetencyInput) =>
    apiRequest<Competency>(`/performance/competencies/${id}`, {
      method: "PATCH",
      body,
    }),

  listScales: (params: ListScalesParams = {}) =>
    apiRequest<Paginated<CompetencyScale>>(
      `/performance/scales${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getScale: (id: string) =>
    apiRequest<CompetencyScale>(`/performance/scales/${id}`),

  createScale: (body: CreateCompetencyScaleInput) =>
    apiRequest<CompetencyScale>("/performance/scales", {
      method: "POST",
      body,
    }),

  updateScale: (id: string, body: UpdateCompetencyScaleInput) =>
    apiRequest<CompetencyScale>(`/performance/scales/${id}`, {
      method: "PATCH",
      body,
    }),

  addScaleLevel: (scaleId: string, body: CreateScaleLevelInput) =>
    apiRequest<CompetencyScaleLevel>(`/performance/scales/${scaleId}/levels`, {
      method: "POST",
      body,
    }),

  updateScaleLevel: (
    scaleId: string,
    levelId: string,
    body: UpdateScaleLevelInput,
  ) =>
    apiRequest<CompetencyScaleLevel>(
      `/performance/scales/${scaleId}/levels/${levelId}`,
      { method: "PATCH", body },
    ),

  removeScaleLevel: (scaleId: string, levelId: string) =>
    apiRequest<void>(`/performance/scales/${scaleId}/levels/${levelId}`, {
      method: "DELETE",
    }),

  listParticipants: (cycleId: string, params: ListParticipantsParams = {}) =>
    apiRequest<Paginated<CycleParticipantListItem>>(
      `/performance/cycles/${cycleId}/participants${toQuery({
        status: params.status,
        search: params.search,
        areaId: params.areaId,
        positionId: params.positionId,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getParticipant: (cycleId: string, participantId: string) =>
    apiRequest<CycleParticipantDetail>(
      `/performance/cycles/${cycleId}/participants/${participantId}`,
    ),

  assignParticipant: (cycleId: string, body: AssignParticipantInput) =>
    apiRequest<AssignParticipantResult>(
      `/performance/cycles/${cycleId}/participants`,
      { method: "POST", body },
    ),

  bulkAssignParticipants: (
    cycleId: string,
    body: BulkAssignParticipantsInput,
  ) =>
    apiRequest<BulkAssignParticipantsResult>(
      `/performance/cycles/${cycleId}/participants/bulk`,
      { method: "POST", body },
    ),

  excludeParticipant: (cycleId: string, participantId: string) =>
    apiRequest<CycleParticipantListItem>(
      `/performance/cycles/${cycleId}/participants/${participantId}/exclude`,
      { method: "POST" },
    ),

  calculateParticipantResult: (cycleId: string, participantId: string) =>
    apiRequest<PerformanceResultAdminDetail>(
      `/performance/cycles/${cycleId}/participants/${participantId}/result/calculate`,
      { method: "POST" },
    ),

  releaseParticipantResult: (cycleId: string, participantId: string) =>
    apiRequest<PerformanceResultAdminDetail>(
      `/performance/cycles/${cycleId}/participants/${participantId}/result/release`,
      { method: "POST" },
    ),

  /** Pages through participants to collect employeeIds (UI “already assigned”). */
  listAllParticipantEmployeeIds: async (cycleId: string) => {
    const ids: string[] = [];
    let page = 1;
    const limit = 100;
    for (;;) {
      const res = await performanceApi.listParticipants(cycleId, {
        page,
        limit,
      });
      for (const item of res.items) {
        ids.push(item.employeeId);
      }
      if (res.items.length === 0 || page * limit >= res.total) break;
      page += 1;
    }
    return ids;
  },

  listMineEvaluations: () =>
    apiRequest<MineEvaluationsResponse>("/performance/evaluations/mine"),

  getEvaluation: (id: string) =>
    apiRequest<PerformanceEvaluationDetail>(
      `/performance/evaluations/${id}`,
    ),

  saveEvaluationResponse: (
    evaluationId: string,
    competencyId: string,
    body: SaveEvaluationResponseInput,
  ) =>
    apiRequest<SaveEvaluationResponseResult>(
      `/performance/evaluations/${evaluationId}/competencies/${competencyId}/response`,
      { method: "PUT", body },
    ),

  submitEvaluation: (evaluationId: string) =>
    apiRequest<PerformanceEvaluationDetail>(
      `/performance/evaluations/${evaluationId}/submit`,
      { method: "POST" },
    ),

  getCycleAnalytics: (cycleId: string) =>
    apiRequest<CycleAnalytics>(`/performance/cycles/${cycleId}/analytics`),

  listResults: (params: ListPerformanceResultsParams = {}) =>
    apiRequest<Paginated<PerformanceResultAdminListItem>>(
      `/performance/results${toQuery({
        cycleId: params.cycleId,
        status: params.status,
        areaId: params.areaId,
        positionId: params.positionId,
        businessUnitId: params.businessUnitId,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  exportResultsCsv: (params: ListPerformanceResultsParams = {}) =>
    apiRequestBlob(
      `/performance/results/export${toQuery({
        cycleId: params.cycleId,
        status: params.status,
        areaId: params.areaId,
        positionId: params.positionId,
        businessUnitId: params.businessUnitId,
        search: params.search,
      })}`,
    ),

  listMineResults: () =>
    apiRequest<MineResultsResponse>("/performance/results/mine"),

  getResult: (id: string) =>
    apiRequest<PerformanceResultAdminDetail | PerformanceResultEmployeeDetail>(
      `/performance/results/${id}`,
    ),
};

export const performanceKeys = {
  all: (companyId: string) => ["performance", companyId] as const,
  cycles: (companyId: string, params: ListPerformanceCyclesParams = {}) =>
    [...performanceKeys.all(companyId), "cycles", params] as const,
  cycle: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "cycle", id] as const,
  cycleCompetencies: (companyId: string, cycleId: string) =>
    [
      ...performanceKeys.all(companyId),
      "cycle-competencies",
      cycleId,
    ] as const,
  participants: (
    companyId: string,
    cycleId: string,
    params: ListParticipantsParams = {},
  ) =>
    [
      ...performanceKeys.all(companyId),
      "participants",
      cycleId,
      params,
    ] as const,
  participant: (companyId: string, cycleId: string, participantId: string) =>
    [
      ...performanceKeys.all(companyId),
      "participant",
      cycleId,
      participantId,
    ] as const,
  assignedEmployeeIds: (companyId: string, cycleId: string) =>
    [
      ...performanceKeys.all(companyId),
      "participants",
      cycleId,
      "assigned-ids",
    ] as const,
  evaluationsMine: (companyId: string) =>
    [...performanceKeys.all(companyId), "evaluations-mine"] as const,
  evaluation: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "evaluation", id] as const,
  analytics: (companyId: string, cycleId: string) =>
    [...performanceKeys.all(companyId), "analytics", cycleId] as const,
  results: (companyId: string, params: ListPerformanceResultsParams = {}) =>
    [...performanceKeys.all(companyId), "results", params] as const,
  result: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "result", id] as const,
  resultsMine: (companyId: string) =>
    [...performanceKeys.all(companyId), "results-mine"] as const,
  competencies: (companyId: string, params: ListCompetenciesParams = {}) =>
    [...performanceKeys.all(companyId), "competencies", params] as const,
  competency: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "competency", id] as const,
  scales: (companyId: string, params: ListScalesParams = {}) =>
    [...performanceKeys.all(companyId), "scales", params] as const,
  scale: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "scale", id] as const,
};
