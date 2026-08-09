import type { Paginated } from "@/types/ats";

export type { Paginated };

export type GoalCycleStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
export type GoalStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type GoalType = "INDIVIDUAL" | "AREA" | "COMPANY";
export type GoalMetricType = "NUMBER" | "PERCENTAGE" | "CURRENCY" | "BOOLEAN";
export type GoalMetricDirection = "INCREASE" | "DECREASE";

export type GoalCycle = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: GoalCycleStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  goalCount: number;
};

export type GoalKeyResult = {
  id: string;
  companyId: string;
  goalId: string;
  title: string;
  description: string | null;
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  startValue: string | null;
  targetValue: string | null;
  targetBoolean: boolean | null;
  unit: string | null;
  currencyCode: string | null;
  weight: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalAssignment = {
  id: string;
  employeeId: string;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    areaId: string;
  };
};

export type GoalKeyResultProgress = {
  keyResultId: string;
  title: string;
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  unit: string | null;
  currencyCode: string | null;
  startValue: string | null;
  targetValue: string | null;
  targetBoolean: boolean | null;
  weight: string | null;
  currentNumericValue: string | null;
  currentBooleanValue: boolean | null;
  progressPercentage: number;
  lastCheckInAt: string | null;
  lastCheckInSequence: number | null;
};

export type GoalProgress = {
  goalId: string;
  progressPercentage: number;
  keyResults: GoalKeyResultProgress[];
};

export type GoalCheckIn = {
  id: string;
  companyId: string;
  goalId: string;
  keyResultId: string;
  sequence: number;
  createdByUserId: string;
  createdByEmployeeId: string | null;
  numericValue: string | null;
  booleanValue: boolean | null;
  comment: string | null;
  evidenceReference: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdByEmployee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type GoalCompletionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type GoalCompletionRequest = {
  id: string;
  companyId: string;
  goalId: string;
  status: GoalCompletionRequestStatus;
  requestedByUserId: string;
  requestedByEmployeeId: string | null;
  requestedAt: string;
  requestComment: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  goal?: {
    id: string;
    title: string;
    type: GoalType;
    status: GoalStatus;
    cycle: { id: string; name: string; status: GoalCycleStatus };
    area: { id: string; name: string } | null;
    assignees: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    }>;
  };
  estimatedAchievement?: {
    label: string;
    achievementPercentage: number;
    keyResults: Array<{
      keyResultId: string;
      achievementPercentage: number;
      configuredWeight: number | null;
    }>;
  };
};

export type GoalResultKeyResult = {
  id: string;
  sourceKeyResultId: string | null;
  title: string;
  description: string | null;
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  startNumericValue: string | null;
  targetNumericValue: string | null;
  targetBoolean: boolean | null;
  finalNumericValue: string | null;
  finalBooleanValue: boolean | null;
  unit: string | null;
  currencyCode: string | null;
  configuredWeight: string | null;
  effectiveWeight: string | null;
  achievementPercentage: string | null;
  order: number;
};

export type GoalResult = {
  id: string;
  companyId: string;
  goalId: string;
  completionRequestId: string;
  achievementPercentage: string;
  goalConfiguredWeight: string | null;
  calculatedAt: string;
  completedAt: string;
  requestedByUserId: string;
  approvedByUserId: string;
  createdAt: string;
  requestedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  completionRequest?: {
    id: string;
    requestedAt: string;
    reviewedAt: string | null;
    requestComment: string | null;
    reviewComment: string | null;
  };
  keyResults: GoalResultKeyResult[];
};

export type Goal = {
  id: string;
  companyId: string;
  cycleId: string;
  title: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  areaId: string | null;
  weight: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  cycle: {
    id: string;
    name: string;
    status: GoalCycleStatus;
    startDate: string;
    endDate: string;
  };
  area: { id: string; name: string } | null;
  keyResults: GoalKeyResult[];
  assignments: GoalAssignment[];
  progress?: GoalProgress | null;
  canCheckIn?: boolean;
  canRequestCompletion?: boolean;
  pendingCompletionRequest?: {
    id: string;
    requestedAt: string;
    status: string;
  } | null;
  latestRejection?: {
    id: string;
    reviewComment: string | null;
    reviewedAt: string | null;
  } | null;
  achievementPercentage?: string | null;
  completedAt?: string | null;
};

export type TeamGoalsResponse = {
  employees: Array<{
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      areaId: string;
      area: { id: string; name: string } | null;
      position: { id: string; name: string } | null;
    };
    goals: Array<{
      id: string;
      title: string;
      type: GoalType;
      status: GoalStatus;
      cycle: {
        id: string;
        name: string;
        status: GoalCycleStatus;
        startDate: string;
        endDate: string;
      };
      area: { id: string; name: string } | null;
      progressPercentage: number | null;
      achievementPercentage: string | null;
      keyResults: GoalKeyResultProgress[];
    }>;
  }>;
};

export type GoalListItem = {
  id: string;
  companyId: string;
  cycleId: string;
  title: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  areaId: string | null;
  weight: string | null;
  cycle: { id: string; name: string; status: GoalCycleStatus };
  area: { id: string; name: string } | null;
  assignees: Array<{ id: string; firstName: string; lastName: string }>;
  keyResultCount: number;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ListGoalCyclesParams = {
  status?: GoalCycleStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListGoalsParams = {
  cycleId?: string;
  status?: GoalStatus;
  type?: GoalType;
  areaId?: string;
  employeeId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateGoalCycleInput = {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
};

export type UpdateGoalCycleInput = Partial<CreateGoalCycleInput>;

export type CreateGoalInput = {
  cycleId: string;
  title: string;
  description?: string | null;
  type: GoalType;
  areaId?: string | null;
  weight?: number | null;
};

export type UpdateGoalInput = {
  title?: string;
  description?: string | null;
  type?: GoalType;
  areaId?: string | null;
  weight?: number | null;
};

export type CreateKeyResultInput = {
  title: string;
  description?: string | null;
  metricType: GoalMetricType;
  direction?: GoalMetricDirection | null;
  startValue?: number | null;
  targetValue?: number | null;
  targetBoolean?: boolean | null;
  unit?: string | null;
  currencyCode?: string | null;
  weight?: number | null;
  order?: number;
};

export type UpdateKeyResultInput = Partial<CreateKeyResultInput>;
