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
  SaveGoalDefinitionInput,
  GoalDefinitionWorkspace,
  UpdateCompetencyInput,
  UpdateCompetencyScaleInput,
  UpdateCycleCompetencyInput,
  UpdatePerformanceCycleInput,
  UpdateScaleLevelInput,
} from "@/types/performance";
import type {
  CalibrationConfig,
  CalibrationPlacement,
  CalibrationSession,
  CreateCalibrationSessionInput,
  NineBoxCell,
  UpdateCalibrationSessionInput,
} from "@/types/calibration";

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
        kind: params.kind,
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

  getGoalDefinition: (cycleId: string) =>
    apiRequest<GoalDefinitionWorkspace>(
      `/performance/my-evaluations/${cycleId}/goal-definition`,
    ),

  saveGoalDefinition: (cycleId: string, body: SaveGoalDefinitionInput) =>
    apiRequest<GoalDefinitionWorkspace>(
      `/performance/my-evaluations/${cycleId}/goal-definition`,
      { method: "PUT", body },
    ),

  submitGoalDefinition: (cycleId: string, body: SaveGoalDefinitionInput) =>
    apiRequest<GoalDefinitionWorkspace>(
      `/performance/my-evaluations/${cycleId}/goal-definition/submit`,
      { method: "POST", body },
    ),

  requestGoalEdit: (cycleId: string, comment?: string) =>
    apiRequest<{ id: string; status: string }>(
      `/performance/my-evaluations/${cycleId}/goal-definition/edit-request`,
      { method: "POST", body: { comment: comment ?? null } },
    ),

  listGoalApprovals: (cycleId: string) =>
    apiRequest<{
      items: Array<{
        employee: { id: string; firstName: string; lastName: string; email: string };
        submittedAt: string | null;
        reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
        reviewComment: string | null;
        structureUnlocked: boolean;
        pendingEditRequest: { id: string; comment: string | null; createdAt: string } | null;
      }>;
    }>(`/performance/my-evaluations/${cycleId}/goal-approvals`),

  getGoalApproval: (cycleId: string, employeeId: string) =>
    apiRequest<{
      employee: { id: string; firstName: string; lastName: string };
      submittedAt: string | null;
      reviewStatus: string | null;
      reviewComment: string | null;
      goals: Array<{
        id: string;
        title: string;
        description: string | null;
        progressStatus: string;
        scale: { name: string } | null;
        parentGoalTitle: string | null;
      }>;
      pdi: {
        name: string;
        competencyName: string | null;
        actions70: string | null;
        actions20: string | null;
        actions10: string | null;
        observations: string | null;
        progressPercent: number;
      } | null;
    }>(`/performance/my-evaluations/${cycleId}/goal-approvals/${employeeId}`),

  approveGoalDefinition: (cycleId: string, employeeId: string, comment?: string) =>
    apiRequest<unknown>(
      `/performance/my-evaluations/${cycleId}/goal-approvals/${employeeId}/approve`,
      { method: "POST", body: { comment: comment ?? null } },
    ),

  rejectGoalDefinition: (cycleId: string, employeeId: string, comment?: string) =>
    apiRequest<unknown>(
      `/performance/my-evaluations/${cycleId}/goal-approvals/${employeeId}/reject`,
      { method: "POST", body: { comment: comment ?? null } },
    ),

  approveGoalEditRequest: (cycleId: string, requestId: string, comment?: string) =>
    apiRequest<unknown>(
      `/performance/my-evaluations/${cycleId}/edit-requests/${requestId}/approve`,
      { method: "POST", body: { comment: comment ?? null } },
    ),

  rejectGoalEditRequest: (cycleId: string, requestId: string, comment?: string) =>
    apiRequest<unknown>(
      `/performance/my-evaluations/${cycleId}/edit-requests/${requestId}/reject`,
      { method: "POST", body: { comment: comment ?? null } },
    ),

  listPerformanceNotifications: () =>
    apiRequest<{
      unreadCount: number;
      items: Array<{
        id: string;
        type: string;
        title: string;
        body: string;
        cycleId: string | null;
        cycleName: string | null;
        readAt: string | null;
        createdAt: string;
      }>;
    }>("/performance/my-evaluations/notifications"),

  markPerformanceNotificationRead: (id: string) =>
    apiRequest<unknown>(`/performance/my-evaluations/notifications/${id}/read`, {
      method: "POST",
    }),

  getClosingSession: (cycleId: string, employeeId?: string) =>
    apiRequest<{
      employee: { id: string; firstName: string; lastName: string };
      isSubject: boolean;
      acceptedAt: string | null;
      collaboratorObservations: string | null;
      leaderObservations: string | null;
      canEditPdi: boolean;
      canEditObservations: boolean;
      canAccept: boolean;
      result: {
        overallScore: string | null;
        competencyScore: string | null;
        goalsAchievement: string | null;
      } | null;
      goals: Array<{
        id: string;
        title: string;
        progressStatus: string;
        ratings: Array<{ type: string; label: string | null; value: number | null }>;
      }>;
      pdi: {
        name: string;
        competencyName: string | null;
        actions70: string | null;
        actions20: string | null;
        actions10: string | null;
        observations: string | null;
        progressPercent: number;
        progressNotes: string | null;
        strengths: string | null;
        improvements: string | null;
      } | null;
    }>(
      `/performance/my-evaluations/${cycleId}/closing${toQuery({ employeeId })}`,
    ),

  saveClosingSession: (
    cycleId: string,
    body: {
      employeeId?: string;
      collaboratorObservations?: string | null;
      leaderObservations?: string | null;
      pdiProgressPercent?: number;
      pdiProgressNotes?: string | null;
      pdiStrengths?: string | null;
      pdiImprovements?: string | null;
    },
  ) =>
    apiRequest<unknown>(`/performance/my-evaluations/${cycleId}/closing`, {
      method: "PUT",
      body,
    }),

  acceptClosingSession: (cycleId: string) =>
    apiRequest<unknown>(`/performance/my-evaluations/${cycleId}/closing/accept`, {
      method: "POST",
    }),

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

  saveGoalRating: (
    evaluationId: string,
    goalId: string,
    body: SaveEvaluationResponseInput,
  ) =>
    apiRequest<SaveEvaluationResponseResult>(
      `/performance/evaluations/${evaluationId}/goals/${goalId}/response`,
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

  getCalibrationConfig: () =>
    apiRequest<CalibrationConfig>("/performance/calibration/config"),

  listCalibrationSessions: () =>
    apiRequest<{ items: CalibrationSession[] }>(
      "/performance/calibration/sessions",
    ),

  getCalibrationSession: (id: string) =>
    apiRequest<CalibrationSession>(`/performance/calibration/sessions/${id}`),

  createCalibrationSession: (body: CreateCalibrationSessionInput) =>
    apiRequest<CalibrationSession>("/performance/calibration/sessions", {
      method: "POST",
      body,
    }),

  updateCalibrationSession: (
    id: string,
    body: UpdateCalibrationSessionInput,
  ) =>
    apiRequest<CalibrationSession>(`/performance/calibration/sessions/${id}`, {
      method: "PATCH",
      body,
    }),

  listCalibrationPlacements: (id: string, cycleId?: string) =>
    apiRequest<{ items: CalibrationPlacement[]; cells: NineBoxCell[] }>(
      `/performance/calibration/sessions/${id}/placements${toQuery({
        cycleId,
      })}`,
    ),

  saveCalibrationPlacement: (
    id: string,
    body: {
      employeeId: string;
      row: number;
      col: number;
      justification: string;
      cycleId?: string;
    },
  ) =>
    apiRequest<{ items: CalibrationPlacement[]; cells: NineBoxCell[] }>(
      `/performance/calibration/sessions/${id}/placements`,
      { method: "POST", body },
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
  goalDefinition: (companyId: string, cycleId: string) =>
    [...performanceKeys.all(companyId), "goal-definition", cycleId] as const,
  goalApprovals: (companyId: string, cycleId: string) =>
    [...performanceKeys.all(companyId), "goal-approvals", cycleId] as const,
  closing: (companyId: string, cycleId: string, employeeId?: string) =>
    [...performanceKeys.all(companyId), "closing", cycleId, employeeId] as const,
  notifications: (companyId: string) =>
    [...performanceKeys.all(companyId), "notifications"] as const,
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
  calibrationConfig: (companyId: string) =>
    [...performanceKeys.all(companyId), "calibration-config"] as const,
  calibrationSessions: (companyId: string) =>
    [...performanceKeys.all(companyId), "calibration-sessions"] as const,
  calibrationSession: (companyId: string, id: string) =>
    [...performanceKeys.all(companyId), "calibration-session", id] as const,
  calibrationPlacements: (
    companyId: string,
    id: string,
    cycleId?: string,
  ) =>
    [
      ...performanceKeys.all(companyId),
      "calibration-placements",
      id,
      cycleId,
    ] as const,
};
