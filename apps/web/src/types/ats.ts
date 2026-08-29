export type VacancyRequestType = "EXISTING_POSITION" | "NEW_POSITION";

export type VacancyRequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type VacancyApprovalStep =
  | "DIRECT_MANAGER"
  | "HR"
  | "GENERAL_MANAGER"
  | "ROLE"
  | "SPECIFIC_EMPLOYEE"
  | "POSITION";

export type VacancyApproverType =
  | "MANAGER_OF_REQUESTER"
  | "SPECIFIC_EMPLOYEE"
  | "ROLE"
  | "POSITION";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export type VacancyStatus = "OPEN" | "PAUSED" | "CLOSED" | "CANCELLED";

export type CandidateStatus = "ACTIVE" | "INACTIVE" | "HIRED";

export type ApplicationStage =
  | "PENDING_REVIEW"
  | "CONTACTED"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationStatus = "ACTIVE" | "CLOSED";

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmployeeRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type PositionRef = {
  id: string;
  name: string;
  areaId?: string;
  mission?: string | null;
  responsibilities?: string | null;
  requiredExperience?: string | null;
};

export type AreaRef = {
  id: string;
  name: string;
};

export type JobLevelRef = {
  id: string;
  name: string;
  rank?: number;
};

export type VacancyApproval = {
  id: string;
  companyId: string;
  vacancyRequestId: string;
  step: VacancyApprovalStep;
  sequence: number;
  label: string | null;
  positionId: string | null;
  approverEmployeeId: string | null;
  requiredRoleCode: string | null;
  status: ApprovalStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  approverEmployee?: EmployeeRef | null;
  position?: PositionRef | null;
  decidedByUser?: { id: string; firstName: string; lastName: string } | null;
};

export type VacancyRequest = {
  id: string;
  companyId: string;
  type: VacancyRequestType;
  status: VacancyRequestStatus;
  requestedByEmployeeId: string;
  existingPositionId: string | null;
  requestedPositionName: string | null;
  requestedAreaId: string | null;
  requestedJobLevelId: string | null;
  requestedHeadcount: number;
  justification: string;
  generalManagerApprovalRequired: boolean;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  existingPosition?: PositionRef | null;
  requestedArea?: AreaRef | null;
  requestedJobLevel?: JobLevelRef | null;
  requestedByEmployee?: EmployeeRef | null;
  approvals?: VacancyApproval[];
  approvalPlanSteps?: VacancyRequestApprovalPlanStep[];
  vacancy?: { id: string; title: string; status: VacancyStatus } | null;
  currentUserCanDecide?: boolean;
};

export type Vacancy = {
  id: string;
  companyId: string;
  vacancyRequestId: string | null;
  positionId: string;
  areaId: string;
  assignedRecruiterEmployeeId: string | null;
  title: string;
  description: string | null;
  headcount: number;
  filledCount: number;
  status: VacancyStatus;
  publicId: string | null;
  publishedAt: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  position?: PositionRef | null;
  area?: AreaRef | null;
  assignedRecruiter?: EmployeeRef | null;
  salaryAmount: string | null;
  salaryCurrency: string;
  showSalaryPublic: boolean;
  interviewFormTemplateId?: string | null;
  vacancyRequest?: {
    id: string;
    type: VacancyRequestType;
    status: VacancyRequestStatus;
  } | null;
};

export type PublicJob = {
  publicId: string | null;
  title: string;
  description: string | null;
  positionName?: string | null;
  mission?: string | null;
  responsibilities?: string | null;
  requiredExperience?: string | null;
  areaName: string;
  companyName: string;
  brandPrimaryColor: string;
  hasLogo: boolean;
  publishedAt: string | null;
  salaryAmount: string | null;
  salaryCurrency: string | null;
};

export type PublicJobApplicationInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
};

export type ParsedPublicCv = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
};

export type Candidate = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  source: string | null;
  status: CandidateStatus;
  cvFileName?: string | null;
  cvOriginalName?: string | null;
  cvMimeType?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Application = {
  id: string;
  companyId: string;
  candidateId: string;
  vacancyId: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
  appliedAt: string;
  lastStageChangedAt: string;
  createdAt: string;
  updatedAt: string;
  candidate?: Candidate | null;
  vacancy?: Pick<Vacancy, "id" | "title" | "status" | "areaId" | "positionId"> | null;
};

export type ApplicationStageHistory = {
  id: string;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  changedByUserId: string | null;
  comment: string | null;
  createdAt: string;
};

export type PipelineCard = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  hasCv?: boolean;
  stage: ApplicationStage;
  lastStageChangedAt: string;
  fitLevel?: "green" | "yellow" | "red" | "gray";
};

export type PipelineColumn = {
  stage: ApplicationStage;
  count: number;
  applications: PipelineCard[];
};

export type PipelineResponse = {
  vacancy: { id: string; title: string; status: VacancyStatus };
  columns: PipelineColumn[];
};

export type ListVacancyRequestsParams = {
  status?: VacancyRequestStatus;
  type?: VacancyRequestType;
  requestedByEmployeeId?: string;
  pendingMyApproval?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

export type VacancyApprovalPlanOrigin = "DEFAULT" | "CUSTOM";

export type VacancyRequestApprovalPlanStep = {
  id: string;
  sequence: number;
  origin: VacancyApprovalPlanOrigin;
  approverType: VacancyApproverType;
  label: string | null;
  positionId: string | null;
  specificEmployeeId: string | null;
  requiredRoleCode: string | null;
  position?: PositionRef | null;
  specificEmployee?: EmployeeRef | null;
};

export type VacancyApprovalWorkflowStep = {
  id: string;
  sequence: number;
  approverType: VacancyApproverType;
  label: string | null;
  positionId: string | null;
  specificEmployeeId: string | null;
  requiredRoleCode: string | null;
  position?: PositionRef | null;
  specificEmployee?: EmployeeRef | null;
};

export type VacancyApprovalWorkflow = {
  enabled: boolean;
  steps: VacancyApprovalWorkflowStep[];
  allowedRoles: Array<{ code: string; name: string }>;
};

export type UpdateVacancyApprovalWorkflowInput = {
  enabled: boolean;
  steps: Array<{
    approverType: VacancyApproverType;
    label?: string | null;
    positionId?: string | null;
    specificEmployeeId?: string | null;
    requiredRoleCode?: string | null;
  }>;
};

export type PositionOccupant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userId: string | null;
};

export type PositionOccupantStep = {
  id: string;
  sequence: number;
  positionId: string;
  employeeId: string | null;
  position?: PositionRef | null;
  employee?: EmployeeRef | null;
};

export type EvaluatorDefaults = {
  steps: PositionOccupantStep[];
};

export type ReplacePositionOccupantStepsInput = {
  steps: Array<{
    positionId: string;
    employeeId?: string | null;
  }>;
};

export type ActiveSelectionProcess = {
  id: string;
  status: VacancyRequestStatus;
  title: string;
  vacancyId: string | null;
  vacancyStatus: VacancyStatus | null;
  requestedByEmployee: EmployeeRef;
};

export type ActiveProcessApprovalStep = VacancyApproval & {
  locked: boolean;
  position?: PositionRef | null;
};

export type ActiveProcessEvaluatorStep = PositionOccupantStep & {
  locked: boolean;
  employeeId: string;
};

export type ActiveProcessApprovals = {
  requestId: string;
  status: VacancyRequestStatus;
  steps: ActiveProcessApprovalStep[];
};

export type ActiveProcessEvaluators = {
  requestId: string;
  status: VacancyRequestStatus;
  steps: ActiveProcessEvaluatorStep[];
};

export type ListVacanciesParams = {
  status?: VacancyStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListCandidatesParams = {
  status?: CandidateStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type ListApplicationsParams = {
  vacancyId?: string;
  candidateId?: string;
  stage?: ApplicationStage;
  status?: ApplicationStatus;
  areaId?: string;
  positionId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateVacancyRequestInput = {
  type: VacancyRequestType;
  requestedByEmployeeId?: string;
  existingPositionId?: string;
  requestedPositionName?: string;
  requestedAreaId?: string;
  requestedJobLevelId?: string;
  requestedHeadcount: number;
  justification: string;
  generalManagerApprovalRequired?: boolean;
  extraApprovalSteps?: Array<{
    positionId: string;
    employeeId?: string | null;
  }>;
};

export type UpdateVacancyRequestInput = {
  type?: VacancyRequestType;
  requestedByEmployeeId?: string;
  existingPositionId?: string | null;
  requestedPositionName?: string | null;
  requestedAreaId?: string | null;
  requestedJobLevelId?: string | null;
  requestedHeadcount?: number;
  justification?: string;
  generalManagerApprovalRequired?: boolean;
  extraApprovalSteps?: Array<{
    positionId: string;
    employeeId?: string | null;
  }>;
};

export type ApprovalDecisionInput = {
  comment?: string;
};

export type RejectDecisionInput = {
  comment: string;
};

export type UpdateVacancyInput = {
  description?: string;
  status?: VacancyStatus;
  assignedRecruiterEmployeeId?: string | null;
  salaryAmount?: string | null;
  salaryCurrency?: string;
  showSalaryPublic?: boolean;
};

export type CreateCandidateInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  source?: string;
};

export type UpdateCandidateInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  source?: string;
  status?: CandidateStatus;
};

export type CreateApplicationInput = {
  candidateId: string;
  vacancyId: string;
};

export type CreateApplicationForCandidateInput = {
  vacancyId: string;
};

export type MoveApplicationInput = {
  stage: ApplicationStage;
  comment?: string;
};
