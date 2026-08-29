import { apiRequest } from "@/lib/api/client";
import type {
  CreateGoalCycleInput,
  CreateGoalInput,
  CreateKeyResultInput,
  Goal,
  GoalAssignment,
  GoalCheckIn,
  GoalCompletionRequest,
  GoalCycle,
  GoalKeyResult,
  GoalKeyResultProgress,
  GoalListItem,
  GoalProgress,
  GoalResult,
  ListGoalCyclesParams,
  ListGoalsParams,
  Paginated,
  TeamGoalsResponse,
  UpdateGoalCycleInput,
  UpdateGoalInput,
  UpdateKeyResultInput,
} from "@/types/goals";

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const goalsApi = {
  listCycles: (params: ListGoalCyclesParams = {}) =>
    apiRequest<Paginated<GoalCycle>>(
      `/goals/cycles${toQuery({
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getCycle: (id: string) => apiRequest<GoalCycle>(`/goals/cycles/${id}`),

  createCycle: (body: CreateGoalCycleInput) =>
    apiRequest<GoalCycle>("/goals/cycles", { method: "POST", body }),

  updateCycle: (id: string, body: UpdateGoalCycleInput) =>
    apiRequest<GoalCycle>(`/goals/cycles/${id}`, { method: "PATCH", body }),

  activateCycle: (id: string) =>
    apiRequest<GoalCycle>(`/goals/cycles/${id}/activate`, { method: "POST" }),

  closeCycle: (id: string) =>
    apiRequest<GoalCycle>(`/goals/cycles/${id}/close`, { method: "POST" }),

  cancelCycle: (id: string) =>
    apiRequest<GoalCycle>(`/goals/cycles/${id}/cancel`, { method: "POST" }),

  listOrganizationalGoals: (params: ListGoalsParams = {}) =>
    apiRequest<Paginated<GoalListItem>>(
      `/goals/organizational${toQuery({
        cycleId: params.cycleId,
        status: params.status,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  listGoals: (params: ListGoalsParams = {}) =>
    apiRequest<Paginated<GoalListItem>>(
      `/goals${toQuery({
        cycleId: params.cycleId,
        status: params.status,
        type: params.type,
        areaId: params.areaId,
        employeeId: params.employeeId,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  listMine: () => apiRequest<{ items: Goal[] }>("/goals/mine"),

  listTeam: () => apiRequest<TeamGoalsResponse>("/goals/team"),

  getGoal: (id: string) => apiRequest<Goal>(`/goals/${id}`),

  getGoalProgress: (goalId: string) =>
    apiRequest<GoalProgress>(`/goals/${goalId}/progress`),

  getKeyResultCheckIns: (
    goalId: string,
    keyResultId: string,
    params: { page?: number; limit?: number } = {},
  ) =>
    apiRequest<Paginated<GoalCheckIn>>(
      `/goals/${goalId}/key-results/${keyResultId}/check-ins${toQuery({
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  createKeyResultCheckIn: (
    goalId: string,
    keyResultId: string,
    body: {
      numericValue?: number;
      booleanValue?: boolean;
      comment?: string | null;
      evidenceReference?: string | null;
    },
  ) =>
    apiRequest<{
      checkIn: GoalCheckIn;
      keyResultProgress: GoalKeyResultProgress | null;
      goalProgressPercentage: number;
    }>(`/goals/${goalId}/key-results/${keyResultId}/check-ins`, {
      method: "POST",
      body,
    }),

  requestGoalCompletion: (
    goalId: string,
    body: { requestComment?: string | null } = {},
  ) =>
    apiRequest<GoalCompletionRequest>(
      `/goals/${goalId}/completion-requests`,
      { method: "POST", body },
    ),

  getGoalCompletionRequests: (goalId: string) =>
    apiRequest<{ items: GoalCompletionRequest[] }>(
      `/goals/${goalId}/completion-requests`,
    ),

  listCompletionReviews: (params: {
    status?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    apiRequest<Paginated<GoalCompletionRequest>>(
      `/goals/completion-requests${toQuery({
        status: params.status,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  approveGoalCompletion: (
    requestId: string,
    body: { reviewComment?: string | null } = {},
  ) =>
    apiRequest<GoalResult>(
      `/goals/completion-requests/${requestId}/approve`,
      { method: "POST", body },
    ),

  rejectGoalCompletion: (requestId: string, body: { reviewComment: string }) =>
    apiRequest<GoalCompletionRequest>(
      `/goals/completion-requests/${requestId}/reject`,
      { method: "POST", body },
    ),

  getGoalResult: (goalId: string) =>
    apiRequest<GoalResult>(`/goals/${goalId}/result`),

  createGoal: (body: CreateGoalInput) =>
    apiRequest<Goal>("/goals", { method: "POST", body }),

  updateGoal: (id: string, body: UpdateGoalInput) =>
    apiRequest<Goal>(`/goals/${id}`, { method: "PATCH", body }),

  activateGoal: (id: string) =>
    apiRequest<Goal>(`/goals/${id}/activate`, { method: "POST" }),

  cancelGoal: (id: string) =>
    apiRequest<Goal>(`/goals/${id}/cancel`, { method: "POST" }),

  createKeyResult: (goalId: string, body: CreateKeyResultInput) =>
    apiRequest<GoalKeyResult>(`/goals/${goalId}/key-results`, {
      method: "POST",
      body,
    }),

  updateKeyResult: (
    goalId: string,
    krId: string,
    body: UpdateKeyResultInput,
  ) =>
    apiRequest<GoalKeyResult>(`/goals/${goalId}/key-results/${krId}`, {
      method: "PATCH",
      body,
    }),

  deleteKeyResult: (goalId: string, krId: string) =>
    apiRequest<{ ok: boolean }>(`/goals/${goalId}/key-results/${krId}`, {
      method: "DELETE",
    }),

  addAssignment: (goalId: string, employeeId: string) =>
    apiRequest<GoalAssignment>(`/goals/${goalId}/assignments`, {
      method: "POST",
      body: { employeeId },
    }),

  removeAssignment: (goalId: string, assignmentId: string) =>
    apiRequest<{ ok: boolean }>(
      `/goals/${goalId}/assignments/${assignmentId}`,
      { method: "DELETE" },
    ),
};

export const goalKeys = {
  all: (companyId: string) => ["goals", companyId] as const,
  cycles: (companyId: string, params: ListGoalCyclesParams = {}) =>
    [...goalKeys.all(companyId), "cycles", params] as const,
  cycle: (companyId: string, id: string) =>
    [...goalKeys.all(companyId), "cycle", id] as const,
  goals: (companyId: string, params: ListGoalsParams = {}) =>
    [...goalKeys.all(companyId), "list", params] as const,
  goal: (companyId: string, id: string) =>
    [...goalKeys.all(companyId), "goal", id] as const,
  mine: (companyId: string) => [...goalKeys.all(companyId), "mine"] as const,
  progress: (companyId: string, goalId: string) =>
    [...goalKeys.all(companyId), "progress", goalId] as const,
  checkIns: (
    companyId: string,
    goalId: string,
    keyResultId: string,
    params: { page?: number; limit?: number } = {},
  ) =>
    [
      ...goalKeys.all(companyId),
      "checkIns",
      goalId,
      keyResultId,
      params,
    ] as const,
  team: (companyId: string) => [...goalKeys.all(companyId), "team"] as const,
  completionRequests: (companyId: string, goalId: string) =>
    [...goalKeys.all(companyId), "completionRequests", goalId] as const,
  completionReviews: (
    companyId: string,
    params: { status?: string; page?: number; limit?: number } = {},
  ) => [...goalKeys.all(companyId), "completionReviews", params] as const,
  result: (companyId: string, goalId: string) =>
    [...goalKeys.all(companyId), "result", goalId] as const,
};
