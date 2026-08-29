import type { OrganizationEntityStatus } from "@/types/organization";
import type { Paginated } from "@/types/ats";

export type { OrganizationEntityStatus, Paginated };

export type PerformanceCycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "CLOSED"
  | "CANCELLED";

export type PerformanceEvaluationModel =
  | "DEGREE_90"
  | "DEGREE_180"
  | "DEGREE_270"
  | "DEGREE_360";

export type PerformanceCycleFollowUp = {
  id: string;
  order: number;
  startDate: string;
  endDate: string;
};

export type PerformanceResultComposition =
  | "COMPETENCY_ONLY"
  | "COMPETENCY_AND_GOALS";

export type PerformanceCycle = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  evaluationStartDate: string | null;
  evaluationEndDate: string | null;
  goalDefinitionStartDate: string | null;
  goalDefinitionEndDate: string | null;
  managerEvaluationStartDate: string | null;
  managerEvaluationEndDate: string | null;
  calibrationStartDate: string | null;
  calibrationEndDate: string | null;
  closingStartDate: string | null;
  closingEndDate: string | null;
  evaluationModel: PerformanceEvaluationModel;
  /** Decimal from API as fixed string, e.g. "30.00" */
  selfEvaluationWeight: string;
  /** Decimal from API as fixed string, e.g. "70.00" */
  managerEvaluationWeight: string;
  peerEvaluationWeight: string | null;
  reportEvaluationWeight: string | null;
  clientEvaluationWeight: string | null;
  /** Linked GoalCycle when integrated (09D); null = competency-only. */
  goalCycleId: string | null;
  includeCompetencies: boolean;
  /** Weight of competencyScore in overall; required when goalCycleId is set. */
  competencyResultWeight: string | null;
  /** Weight of goalsAchievement in overall; required when goalCycleId is set. */
  goalsResultWeight: string | null;
  organizationalGoalsWeight: string | null;
  individualGoalsWeight: string | null;
  maxObjectives: number | null;
  evaluationRange: number;
  followUps: PerformanceCycleFollowUp[];
  status: PerformanceCycleStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PerformanceResultStatus = "CALCULATED" | "RELEASED";

export type CompetencyScaleKind = "QUALITATIVE" | "QUANTITATIVE";

export type CompetencyScaleFormat =
  | "NUMERIC"
  | "DESCRIPTIVE"
  | "LIKERT"
  | "PERCENTAGE"
  | "CURRENCY";

export type LikertIcon = "STARS" | "HEARTS" | "THUMBS" | "FACES";

export type CompetencyScaleLevel = {
  id: string;
  companyId: string;
  scaleId: string;
  value: number;
  label: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type CompetencyScale = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  kind: CompetencyScaleKind;
  format?: CompetencyScaleFormat;
  minValue?: string | null;
  maxValue?: string | null;
  likertIcon?: string | null;
  currencyCode?: string | null;
  decimalPlaces?: number | null;
  status: OrganizationEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  levels?: CompetencyScaleLevel[];
  levelCount?: number;
};

export type CompetencyScaleRef = {
  id: string;
  name: string;
  status: OrganizationEntityStatus;
};

export type CompetencyJobLevelRef = {
  id: string;
  name: string;
  rank: number;
  status: OrganizationEntityStatus;
};

export type Competency = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: OrganizationEntityStatus;
  defaultScaleId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  defaultScale?: CompetencyScaleRef | null;
  jobLevels?: CompetencyJobLevelRef[];
};

export type CompetencyRef = {
  id: string;
  name: string;
  code: string | null;
  status: OrganizationEntityStatus;
};

export type CycleCompetencyScaleRef = {
  id: string;
  name: string;
  status: OrganizationEntityStatus;
  levels?: Array<{
    id: string;
    value: number;
    label: string;
    order: number;
  }>;
};

export type CycleCompetency = {
  id: string;
  companyId: string;
  cycleId: string;
  competencyId: string;
  scaleId: string;
  /** Decimal from API as fixed string, e.g. "25.00", or null when unweighted */
  weight: string | null;
  order: number;
  required: boolean;
  createdAt: string;
  updatedAt: string;
  competency?: CompetencyRef;
  scale?: CycleCompetencyScaleRef;
};

export type PerformanceCycleDetail = PerformanceCycle & {
  competencies: CycleCompetency[];
};

export type ListPerformanceCyclesParams = {
  status?: PerformanceCycleStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListCompetenciesParams = {
  status?: OrganizationEntityStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListScalesParams = {
  status?: OrganizationEntityStatus;
  kind?: CompetencyScaleKind;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreatePerformanceCycleInput = {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  evaluationStartDate?: string;
  evaluationEndDate?: string;
  goalDefinitionStartDate?: string;
  goalDefinitionEndDate?: string;
  managerEvaluationStartDate?: string;
  managerEvaluationEndDate?: string;
  calibrationStartDate?: string;
  calibrationEndDate?: string;
  closingStartDate?: string;
  closingEndDate?: string;
  followUps?: Array<{ startDate: string; endDate: string }>;
  evaluationModel?: PerformanceEvaluationModel;
  selfEvaluationWeight?: number;
  managerEvaluationWeight?: number;
  peerEvaluationWeight?: number | null;
  reportEvaluationWeight?: number | null;
  clientEvaluationWeight?: number | null;
  goalCycleId?: string | null;
  includeCompetencies?: boolean;
  competencyResultWeight?: number | null;
  goalsResultWeight?: number | null;
  organizationalGoalsWeight?: number | null;
  individualGoalsWeight?: number | null;
  maxObjectives?: number | null;
  evaluationRange?: number;
};

export type UpdatePerformanceCycleInput = {
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  evaluationStartDate?: string | null;
  evaluationEndDate?: string | null;
  goalDefinitionStartDate?: string | null;
  goalDefinitionEndDate?: string | null;
  managerEvaluationStartDate?: string | null;
  managerEvaluationEndDate?: string | null;
  calibrationStartDate?: string | null;
  calibrationEndDate?: string | null;
  closingStartDate?: string | null;
  closingEndDate?: string | null;
  followUps?: Array<{ startDate: string; endDate: string }>;
  evaluationModel?: PerformanceEvaluationModel;
  selfEvaluationWeight?: number;
  managerEvaluationWeight?: number;
  peerEvaluationWeight?: number | null;
  reportEvaluationWeight?: number | null;
  clientEvaluationWeight?: number | null;
  goalCycleId?: string | null;
  includeCompetencies?: boolean;
  competencyResultWeight?: number | null;
  goalsResultWeight?: number | null;
  organizationalGoalsWeight?: number | null;
  individualGoalsWeight?: number | null;
  maxObjectives?: number | null;
  evaluationRange?: number;
};

export type AddCycleCompetencyInput = {
  competencyId: string;
  scaleId: string;
  weight?: number | null;
  order?: number;
  required?: boolean;
};

export type UpdateCycleCompetencyInput = {
  scaleId?: string;
  weight?: number | null;
  order?: number;
  required?: boolean;
};

export type CreateCompetencyInput = {
  name: string;
  code?: string;
  description?: string;
  status?: OrganizationEntityStatus;
  defaultScaleId?: string;
  jobLevelId?: string;
};

export type UpdateCompetencyInput = {
  name?: string;
  code?: string | null;
  description?: string | null;
  status?: OrganizationEntityStatus;
  defaultScaleId?: string | null;
  jobLevelId?: string | null;
};

export type CreateCompetencyScaleInput = {
  name: string;
  description?: string;
  status?: OrganizationEntityStatus;
  kind?: CompetencyScaleKind;
  format?: CompetencyScaleFormat;
  minValue?: number;
  maxValue?: number;
  likertIcon?: string;
  currencyCode?: string;
  decimalPlaces?: number;
  descriptiveLabels?: string[];
};

export type UpdateCompetencyScaleInput = {
  name?: string;
  description?: string | null;
  status?: OrganizationEntityStatus;
  kind?: CompetencyScaleKind;
  format?: CompetencyScaleFormat;
  minValue?: number;
  maxValue?: number;
  likertIcon?: string | null;
  currencyCode?: string | null;
  decimalPlaces?: number | null;
};

export type CreateScaleLevelInput = {
  value: number;
  label: string;
  description?: string;
  order: number;
};

export type UpdateScaleLevelInput = {
  value?: number;
  label?: string;
  description?: string | null;
  order?: number;
};

export type PerformanceParticipantStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "EXCLUDED";

export type PerformanceEvaluationType =
  | "SELF"
  | "MANAGER"
  | "PEER"
  | "REPORT"
  | "CLIENT";

export type PerformanceEvaluationStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED";

export type ParticipantEmployeeSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  areaId: string;
  positionId: string;
  area: { id: string; name: string };
  position: { id: string; name: string };
};

export type ParticipantManagerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ParticipantEvaluationSelfSummary = {
  id: string;
  status: PerformanceEvaluationStatus;
  scorePercentage?: string | null;
};

export type ParticipantEvaluationManagerSummary = {
  id: string;
  status: PerformanceEvaluationStatus;
  evaluatorEmployeeId: string | null;
  scorePercentage?: string | null;
};

export type ParticipantResultSummary = {
  id: string;
  status: PerformanceResultStatus;
  overallScore: string;
  selfScore: string | null;
  managerScore: string | null;
  calculatedAt: string;
  releasedAt: string | null;
};

export type CycleParticipantListItem = {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  status: PerformanceParticipantStatus;
  createdAt: string;
  updatedAt: string;
  employee: ParticipantEmployeeSummary;
  manager: ParticipantManagerSummary | null;
  evaluations: {
    self: ParticipantEvaluationSelfSummary | null;
    manager: ParticipantEvaluationManagerSummary | null;
  };
  result?: ParticipantResultSummary | null;
};

export type EvaluationSnapshotLevel = {
  id: string;
  sourceScaleLevelId: string | null;
  value: number;
  label: string;
  description: string | null;
  order: number;
};

export type EvaluationCompetencyResponse = {
  selectedScaleLevelId: string;
  ratingValue: number;
  comment: string | null;
  updatedAt?: string;
};

export type EvaluationCompetencyScoreBreakdown = {
  ratingValue: number;
  normalizedPercentage: number;
  weight: number | null;
  weightedContribution: number | null;
};

export type EvaluationSnapshotCompetency = {
  id: string;
  sourceCompetencyId: string | null;
  sourceScaleId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  scaleName: string;
  weight: string | null;
  required: boolean;
  order: number;
  levels: EvaluationSnapshotLevel[];
  response?: EvaluationCompetencyResponse | null;
  scoreBreakdown?: EvaluationCompetencyScoreBreakdown | null;
};

export type CycleParticipantEvaluationDetail = {
  id: string;
  type: PerformanceEvaluationType;
  status: PerformanceEvaluationStatus;
  employeeId: string;
  evaluatorEmployeeId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evaluatorEmployee: ParticipantManagerSummary | null;
  competencies: EvaluationSnapshotCompetency[];
};

export type CycleParticipantDetail = {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  status: PerformanceParticipantStatus;
  createdAt: string;
  updatedAt: string;
  employee: ParticipantEmployeeSummary;
  evaluations: CycleParticipantEvaluationDetail[];
};

export type AssignParticipantResult = CycleParticipantDetail & {
  managerEvaluationCreated: boolean;
  reason?: "NO_DIRECT_MANAGER";
};

export type BulkAssignParticipantsResult = {
  created: AssignParticipantResult[];
  alreadyAssigned: string[];
  failed: Array<{ employeeId: string; reason: string }>;
};

export type ListParticipantsParams = {
  status?: PerformanceParticipantStatus;
  search?: string;
  areaId?: string;
  positionId?: string;
  page?: number;
  limit?: number;
};

export type AssignParticipantInput = {
  employeeId: string;
};

export type BulkAssignParticipantsInput = {
  employeeIds: string[];
};

export type SaveEvaluationResponseInput = {
  scaleLevelId: string;
  comment?: string | null;
};

export type SaveEvaluationResponseResult = {
  id: string;
  evaluationId: string;
  evaluationCompetencyId: string;
  selectedScaleLevelId: string;
  ratingValue: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MineEvaluation = {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  evaluatorEmployeeId: string | null;
  type: PerformanceEvaluationType;
  status: PerformanceEvaluationStatus;
  scorePercentage?: string | null;
  respondedCount?: number;
  competencyCount?: number;
  createdAt: string;
  updatedAt: string;
  cycle: {
    id: string;
    name: string;
    status: PerformanceCycleStatus;
    startDate: string;
    endDate: string;
    evaluationStartDate: string | null;
    evaluationEndDate: string | null;
    goalDefinitionStartDate: string | null;
    goalDefinitionEndDate: string | null;
    managerEvaluationStartDate: string | null;
    managerEvaluationEndDate: string | null;
    calibrationStartDate: string | null;
    calibrationEndDate: string | null;
    closingStartDate: string | null;
    closingEndDate: string | null;
    goalCycleId: string | null;
    followUps: PerformanceCycleFollowUp[];
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  evaluatorEmployee: ParticipantManagerSummary | null;
};

export type MineEvaluationsResponse = {
  self: MineEvaluation[];
  asManager: MineEvaluation[];
  leaderCycles?: Array<MineEvaluation["cycle"]>;
};

export type PerformanceEvaluationDetail = {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  evaluatorEmployeeId: string | null;
  type: PerformanceEvaluationType;
  status: PerformanceEvaluationStatus;
  startedAt: string | null;
  submittedAt: string | null;
  scorePercentage: string | null;
  createdAt: string;
  updatedAt: string;
  canRespond: boolean;
  editable: boolean;
  respondedCount: number;
  competencyCount: number;
  participant: {
    id: string;
    status: PerformanceParticipantStatus;
  };
  cycle: {
    id: string;
    name: string;
    status: PerformanceCycleStatus;
    startDate: string;
    endDate: string;
    evaluationStartDate: string | null;
    evaluationEndDate: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    area: { id: string; name: string };
    position: { id: string; name: string };
  };
  evaluatorEmployee: ParticipantManagerSummary | null;
  competencies: EvaluationSnapshotCompetency[];
  goals?: EvaluationGoalItem[];
  selfEvaluation?: {
    competencies: Array<{
      name: string;
      ratingValue: number | null;
      label: string | null;
      comment: string | null;
    }>;
    goals: Array<{
      title: string;
      ratingValue: number | null;
      label: string | null;
      comment: string | null;
    }>;
  } | null;
};

export type ResultCycleSummary = {
  id: string;
  name: string;
  status: PerformanceCycleStatus;
  startDate: string;
  endDate: string;
};

export type ResultEmployeeSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  area?: { id: string; name: string };
  position?: { id: string; name: string };
};

export type OrgSnapshotRef = {
  id: string | null;
  name: string | null;
};

export type PerformanceResultGoalSnapshot = {
  id?: string;
  sourceGoalId?: string | null;
  sourceGoalResultId?: string | null;
  goalTitle: string;
  goalType: string;
  achievementPercentage: string;
  configuredWeight?: string | null;
  effectiveWeight: string;
  contribution: string;
  order: number;
};

export type PerformanceResultAdminListItem = {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  selfScore: string | null;
  managerScore: string | null;
  competencyScore?: string | null;
  goalsAchievement?: string | null;
  overallScore: string;
  composition?: PerformanceResultComposition;
  goals?: PerformanceResultGoalSnapshot[];
  status: PerformanceResultStatus;
  areaSnapshot: OrgSnapshotRef;
  positionSnapshot: OrgSnapshotRef;
  businessUnitSnapshot: OrgSnapshotRef;
  calculatedAt: string;
  releasedAt: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  participant: { id: string; status: PerformanceParticipantStatus };
  cycle: ResultCycleSummary;
};

export type EvaluationTypeAnalytics = {
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  submittedRate: number;
};

export type ScoreDistributionBucket = {
  key: string;
  label: string;
  from: number;
  to: number;
  count: number;
  percentage: number;
};

export type OrgBreakdownRow = {
  id: string | null;
  name: string;
  resultCount: number;
  averageScore: number | null;
};

export type CycleAnalytics = {
  cycle: {
    id: string;
    name: string;
    status: PerformanceCycleStatus;
    startDate: string;
    endDate: string;
    selfEvaluationWeight: string;
    managerEvaluationWeight: string;
  };
  participants: {
    totalParticipants: number;
    activeParticipants: number;
    completedParticipants: number;
    excludedParticipants: number;
    eligibleParticipants: number;
    completionRate: number;
  };
  evaluations: {
    self: EvaluationTypeAnalytics;
    manager: EvaluationTypeAnalytics;
  };
  results: {
    calculatedResults: number;
    releasedResults: number;
    totalResults: number;
    releasedRate: number;
    averageScore: number | null;
    minScore: number | null;
    maxScore: number | null;
    scorePopulation: "CALCULATED_AND_RELEASED";
  };
  distribution: ScoreDistributionBucket[];
  byArea: OrgBreakdownRow[];
  byPosition: OrgBreakdownRow[];
  byBusinessUnit: OrgBreakdownRow[];
};

export type PerformanceResultAdminDetail = {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  selfScore: string | null;
  managerScore: string | null;
  competencyScore: string | null;
  goalsAchievement: string | null;
  overallScore: string;
  configuredSelfWeight: string;
  configuredManagerWeight: string;
  effectiveSelfWeight: string;
  effectiveManagerWeight: string;
  configuredCompetencyResultWeight: string | null;
  configuredGoalsResultWeight: string | null;
  composition: PerformanceResultComposition;
  sourceGoalCycleId: string | null;
  goals: PerformanceResultGoalSnapshot[];
  status: PerformanceResultStatus;
  calculatedAt: string;
  releasedAt: string | null;
  releasedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  employee: ResultEmployeeSummary;
  participant: { id: string; status: PerformanceParticipantStatus };
  releasedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  cycle: ResultCycleSummary;
  view: "admin";
};

export type PerformanceResultEmployeeListItem = {
  id: string;
  overallScore: string;
  selfScore: string | null;
  competencyScore?: string | null;
  goalsAchievement?: string | null;
  composition?: PerformanceResultComposition;
  configuredCompetencyResultWeight?: string | null;
  configuredGoalsResultWeight?: string | null;
  goals?: PerformanceResultGoalSnapshot[];
  status: PerformanceResultStatus;
  releasedAt: string | null;
  calculatedAt: string;
  cycle: ResultCycleSummary;
};

export type PerformanceResultEmployeeGoalSnapshot = Pick<
  PerformanceResultGoalSnapshot,
  | "goalTitle"
  | "goalType"
  | "achievementPercentage"
  | "effectiveWeight"
  | "contribution"
  | "order"
>;

export type PerformanceResultEmployeeDetail = {
  id: string;
  overallScore: string;
  selfScore: string | null;
  competencyScore: string | null;
  goalsAchievement: string | null;
  composition: PerformanceResultComposition;
  configuredCompetencyResultWeight: string | null;
  configuredGoalsResultWeight: string | null;
  goals: PerformanceResultEmployeeGoalSnapshot[];
  managerIncluded: boolean;
  effectiveSelfWeight: string;
  effectiveManagerWeight: string;
  status: PerformanceResultStatus;
  releasedAt: string | null;
  calculatedAt: string;
  cycle: ResultCycleSummary;
  view: "employee";
};

export type MineResultsResponse = {
  items: PerformanceResultEmployeeListItem[];
};

export type ListPerformanceResultsParams = {
  cycleId?: string;
  status?: PerformanceResultStatus;
  areaId?: string;
  positionId?: string;
  businessUnitId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type GoalProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "FINISHED";

export type PdiDerivedStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type GoalDefinitionGoal = {
  id: string;
  title: string;
  description: string | null;
  progressStatus: GoalProgressStatus;
  scaleId: string | null;
  scale: { id: string; name: string; kind: CompetencyScaleKind } | null;
  parentGoalId: string | null;
  parentGoalTitle: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  areaName: string | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
};

export type GoalDefinitionPdi = {
  id: string;
  name: string;
  competencyId: string | null;
  competencyName: string | null;
  actions70: string | null;
  actions20: string | null;
  actions10: string | null;
  observations: string | null;
  progressNotes?: string | null;
  strengths?: string | null;
  improvements?: string | null;
  progressPercent: number;
  status: PdiDerivedStatus;
};

export type EvaluationGoalItem = {
  id: string;
  title: string;
  description: string | null;
  progressStatus: GoalProgressStatus;
  scale: {
    id: string;
    name: string;
    levels: Array<{
      id: string;
      value: number;
      label: string;
      description: string | null;
      order: number;
    }>;
  } | null;
  response: {
    selectedScaleLevelId: string | null;
    ratingValue: number | null;
    comment: string | null;
  } | null;
};

export type GoalDefinitionWorkspace = {
  cycle: {
    id: string;
    name: string;
    status: PerformanceCycleStatus;
    goalCycleId: string | null;
    maxObjectives: number | null;
  };
  cascadeEnabled: boolean;
  submittedAt: string | null;
  reviewStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  reviewComment?: string | null;
  structureUnlocked?: boolean;
  pendingEditRequest?: { id: string; comment: string | null; createdAt: string } | null;
  canRequestEdit?: boolean;
  canAddFinishedGoal?: boolean;
  editable: boolean;
  progressEditable: boolean;
  organizationalGoals: GoalDefinitionGoal[];
  assignedFromCascade: GoalDefinitionGoal[];
  individualGoals: GoalDefinitionGoal[];
  cascadedGoals: GoalDefinitionGoal[];
  pdi: GoalDefinitionPdi | null;
  scales: Array<{ id: string; name: string; kind: CompetencyScaleKind }>;
  competencies: Array<{ id: string; name: string }>;
  directReports: Array<{ id: string; firstName: string; lastName: string }>;
};

export type SaveGoalDefinitionInput = {
  individualGoals: Array<{
    id?: string;
    title: string;
    description?: string | null;
    scaleId: string;
    progressStatus: GoalProgressStatus;
  }>;
  cascadedGoals: Array<{
    id?: string;
    title: string;
    description?: string | null;
    scaleId: string;
    progressStatus: GoalProgressStatus;
    parentGoalId: string;
    assigneeEmployeeId: string;
  }>;
  pdi?: {
    name: string;
    competencyId?: string | null;
    actions70?: string | null;
    actions20?: string | null;
    actions10?: string | null;
    observations?: string | null;
    progressNotes?: string | null;
    strengths?: string | null;
    improvements?: string | null;
    progressPercent: number;
  } | null;
};
