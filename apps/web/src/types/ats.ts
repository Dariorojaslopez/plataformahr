export type VacancyRequestType = "EXISTING_POSITION" | "NEW_POSITION";

export type VacancyRequestMotive =
  | "NEW_POSITION"
  | "REPLACEMENT_RESIGNATION"
  | "REPLACEMENT_MUTUAL_AGREEMENT"
  | "REPLACEMENT_TERMINATION_WITHOUT_CAUSE";

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

export type CandidateStatus = "ACTIVE" | "INACTIVE" | "HIRED" | "IN_POOL";

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
  headcount?: number;
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
  motive: VacancyRequestMotive;
  status: VacancyRequestStatus;
  requestedByEmployeeId: string;
  existingPositionId: string | null;
  requestedPositionName: string | null;
  requestedAreaId: string | null;
  requestedJobLevelId: string | null;
  replacedEmployeeId: string | null;
  requestedHeadcount: number;
  expectedHiringDate: string;
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
  replacedEmployee?: EmployeeRef | null;
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
  requiredEducation?: string | null;
  areaName: string;
  companyName: string;
  brandPrimaryColor: string;
  hasLogo: boolean;
  publishedAt: string | null;
  salaryAmount: string | null;
  salaryCurrency: string | null;
  screeningMinCorrect?: number | null;
  screeningQuestions?: PublicScreeningQuestion[];
};

export type PublicScreeningQuestion = {
  id: string;
  prompt: string;
  sortOrder: number;
};

export type EducationLevel =
  | "PRIMARY"
  | "HIGH_SCHOOL"
  | "TECHNICAL"
  | "TECHNOLOGICAL"
  | "PROFESSIONAL"
  | "SPECIALIZATION"
  | "MASTER"
  | "DOCTORATE"
  | "DIPLOMA"
  | "COURSE";

export type PublicWorkExperienceInput = {
  companyName: string;
  country: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  functions: string;
  achievements: string;
};

export type PublicEducationInput = {
  institution: string;
  program: string;
  educationLevel: EducationLevel | "";
  startDate: string;
  endDate: string;
  isStudying: boolean;
};

export type PublicJobApplicationInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  state: string;
  city: string;
  professionalProfile: string;
  linkedinUrl: string;
  workExperience: PublicWorkExperienceInput[];
  education: PublicEducationInput[];
  screeningAnswers: Array<{ questionId: string; answer: boolean | null }>;
};

export type VacancyScreeningConfig = {
  minCorrect: number | null;
  questions: Array<{
    id: string;
    prompt: string;
    correctAnswer: boolean;
    sortOrder: number;
  }>;
};

export type ParsedPublicCv = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  professionalProfile?: string | null;
  linkedinUrl?: string | null;
  workExperience?: PublicWorkExperienceInput[];
  education?: PublicEducationInput[];
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
  birthDate?: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  professionalProfile?: string | null;
  linkedinUrl?: string | null;
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
  professionalProfile?: string | null;
  screeningCorrectCount?: number | null;
  screeningPassed?: boolean | null;
  profileFitLevel?: "green" | "yellow" | "red" | "gray" | null;
  profileFitSummary?: string | null;
  securityStudyStatus?: PreHireCheckStatus;
  medicalExamStatus?: PreHireCheckStatus;
  appliedAt: string;
  lastStageChangedAt: string;
  createdAt: string;
  updatedAt: string;
  candidate?: Candidate | null;
  vacancy?: Pick<Vacancy, "id" | "title" | "status" | "areaId" | "positionId"> | null;
  workExperiences?: ApplicationWorkExperience[];
  educations?: ApplicationEducation[];
  screeningAnswers?: ApplicationScreeningAnswer[];
  preHireDocuments?: ApplicationPreHireDocument[];
};

export type PreHireCheckStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "NOT_REQUIRED";

export type PreHireDocumentKind = "SECURITY_STUDY" | "MEDICAL_EXAM";

export type ApplicationPreHireDocument = {
  id: string;
  kind: PreHireDocumentKind;
  originalName: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationWorkExperience = {
  id: string;
  companyName: string;
  country: string | null;
  positionTitle: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  functions: string | null;
  achievements: string | null;
  sortOrder: number;
};

export type ApplicationEducation = {
  id: string;
  institution: string;
  program: string;
  educationLevel: EducationLevel;
  startDate: string;
  endDate: string | null;
  isStudying: boolean;
  sortOrder: number;
};

export type ApplicationScreeningAnswer = {
  id: string;
  questionPrompt: string;
  correctAnswer: boolean;
  answer: boolean;
  isCorrect: boolean;
  sortOrder: number;
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
  hasSecurityStudyDoc?: boolean;
  hasMedicalExamDoc?: boolean;
  securityStudyStatus?: PreHireCheckStatus;
  medicalExamStatus?: PreHireCheckStatus;
  stage: ApplicationStage;
  lastStageChangedAt: string;
  fitLevel?: "green" | "yellow" | "red" | "gray";
  fitSummary?: string | null;
  evaluatorStatuses?: Array<{
    employeeId: string | null;
    name: string;
    status: "pending" | "approved" | "in_progress";
  }>;
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
  type?: VacancyRequestType;
  motive?: VacancyRequestMotive;
  requestedByEmployeeId?: string;
  existingPositionId?: string;
  requestedPositionName?: string;
  requestedAreaId?: string;
  requestedJobLevelId?: string;
  replacedEmployeeId?: string | null;
  requestedHeadcount: number;
  expectedHiringDate: string;
  justification?: string;
  generalManagerApprovalRequired?: boolean;
  extraApprovalSteps?: Array<{
    positionId: string;
    employeeId?: string | null;
  }>;
};

export type UpdateVacancyRequestInput = {
  type?: VacancyRequestType;
  motive?: VacancyRequestMotive;
  requestedByEmployeeId?: string;
  existingPositionId?: string | null;
  requestedPositionName?: string | null;
  requestedAreaId?: string | null;
  requestedJobLevelId?: string | null;
  replacedEmployeeId?: string | null;
  requestedHeadcount?: number;
  expectedHiringDate?: string;
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
  linkedinUrl?: string;
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
  linkedinUrl?: string | null;
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
