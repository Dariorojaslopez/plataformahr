export type OrganizationEntityStatus = "ACTIVE" | "INACTIVE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type ReportingLineType = "DIRECT" | "INDIRECT";

export type BusinessUnit = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: OrganizationEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Area = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  description: string | null;
  businessUnitId: string | null;
  parentAreaId: string | null;
  status: OrganizationEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AreaTreeNode = {
  id: string;
  name: string;
  code: string | null;
  status: OrganizationEntityStatus;
  businessUnitId: string | null;
  parentAreaId: string | null;
  children: AreaTreeNode[];
};

export type JobLevel = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  rank: number;
  status: OrganizationEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PositionCustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "SELECT";

export type CustomFieldAppliesTo = "POSITION" | "EMPLOYEE";

export type PositionCustomFieldOption = {
  id: string;
  companyId: string;
  definitionId: string;
  label: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PositionCustomFieldDefinition = {
  id: string;
  companyId: string;
  key: string;
  label: string;
  type: PositionCustomFieldType;
  appliesTo: CustomFieldAppliesTo;
  required: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  options: PositionCustomFieldOption[];
  _count?: { values: number };
};

export type PositionCustomFieldValue = {
  definitionId: string;
  key: string;
  label: string;
  type: PositionCustomFieldType;
  required: boolean;
  active: boolean;
  value: string | number | boolean | null;
  optionId: string | null;
  optionLabel: string | null;
};

export type PositionCustomFieldInput = {
  definitionId: string;
  value: string | number | boolean | null;
};

export type CreatePositionCustomFieldDefinitionInput = {
  key: string;
  label: string;
  type: PositionCustomFieldType;
  appliesTo?: CustomFieldAppliesTo;
  required?: boolean;
  active?: boolean;
  sortOrder?: number;
  options?: Array<{ label: string; sortOrder?: number }>;
};

export type UpdatePositionCustomFieldDefinitionInput = {
  label?: string;
  type?: PositionCustomFieldType;
  required?: boolean;
  active?: boolean;
  sortOrder?: number;
  options?: Array<{
    id?: string;
    label: string;
    sortOrder?: number;
    active?: boolean;
  }>;
};

export type Position = {
  id: string;
  companyId: string;
  areaId: string;
  jobLevelId: string | null;
  name: string;
  code: string | null;
  mission: string | null;
  responsibilities: string | null;
  requiredExperience: string | null;
  requiredEducation: string | null;
  headcount: number;
  status: OrganizationEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  customFields?: PositionCustomFieldValue[];
};

export type Employee = {
  id: string;
  companyId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  documentType: string | null;
  documentNumber: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  housingType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  businessUnitId: string | null;
  areaId: string;
  positionId: string;
  status: EmployeeStatus;
  hireDate: string | null;
  terminationDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  customFields?: PositionCustomFieldValue[];
};

export type PaginatedEmployees = {
  items: Employee[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListEmployeesParams = {
  status?: EmployeeStatus;
  areaId?: string;
  positionId?: string;
  businessUnitId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type ManagerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: EmployeeStatus;
};

export type OrganizationProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: EmployeeStatus;
  hireDate: string | null;
  businessUnit: { id: string; name: string; code: string | null } | null;
  area: { id: string; name: string; code: string | null };
  position: { id: string; name: string; code: string | null };
  jobLevel: { id: string; name: string; rank: number } | null;
  directManager: ManagerSummary | null;
  indirectManagers: ManagerSummary[];
};

export type OrgChartNode = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  managerId: string | null;
  position: { id: string; name: string };
  jobLevel: { id: string; name: string; rank: number } | null;
  area: { id: string; name: string };
  businessUnit: { id: string; name: string } | null;
  children: OrgChartNode[];
};

export type OrgChart = {
  company: { id: string; name: string };
  generatedAt: string;
  includeInactive: boolean;
  employeeCount: number;
  rootCount: number;
  roots: OrgChartNode[];
};

export type ReportingLine = {
  id: string;
  companyId: string;
  employeeId: string;
  managerEmployeeId: string;
  type: ReportingLineType;
  createdAt: string;
  updatedAt: string;
  manager: ManagerSummary;
};

export type CreateBusinessUnitInput = {
  name: string;
  code?: string;
  description?: string;
  status?: OrganizationEntityStatus;
};

export type UpdateBusinessUnitInput = Partial<CreateBusinessUnitInput>;

export type CreateAreaInput = {
  name: string;
  code?: string;
  description?: string;
  businessUnitId?: string;
  parentAreaId?: string;
  status?: OrganizationEntityStatus;
};

export type UpdateAreaInput = {
  name?: string;
  code?: string;
  description?: string;
  businessUnitId?: string | null;
  parentAreaId?: string | null;
  status?: OrganizationEntityStatus;
};

export type CreateJobLevelInput = {
  name: string;
  code?: string;
  rank: number;
  status?: OrganizationEntityStatus;
};

export type UpdateJobLevelInput = Partial<CreateJobLevelInput>;

export type JobLevelCompetencyItem = {
  id: string;
  name: string;
  code: string | null;
  status: OrganizationEntityStatus;
};

export type JobLevelCompetencies = {
  jobLevelId: string;
  jobLevel: {
    id: string;
    name: string;
    code: string | null;
    rank: number;
  };
  assigned: JobLevelCompetencyItem[];
  catalog: JobLevelCompetencyItem[];
};

export type ReplaceJobLevelCompetenciesInput = {
  competencyIds: string[];
};

export type CreatePositionInput = {
  name: string;
  areaId: string;
  jobLevelId?: string;
  code?: string;
  mission?: string;
  responsibilities?: string;
  requiredExperience?: string;
  requiredEducation?: string;
  headcount?: number;
  status?: OrganizationEntityStatus;
  customFields?: PositionCustomFieldInput[];
};

export type UpdatePositionInput = {
  name?: string;
  areaId?: string;
  jobLevelId?: string | null;
  code?: string;
  mission?: string;
  responsibilities?: string;
  requiredExperience?: string;
  requiredEducation?: string;
  headcount?: number;
  status?: OrganizationEntityStatus;
  customFields?: PositionCustomFieldInput[];
};

export type CreateEmployeeInput = {
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  birthDate?: string;
  country?: string;
  state?: string;
  city?: string;
  maritalStatus?: string;
  childrenCount?: number;
  housingType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  businessUnitId?: string;
  areaId: string;
  positionId: string;
  status?: EmployeeStatus;
  hireDate?: string;
  terminationDate?: string;
  customFields?: PositionCustomFieldInput[];
};

export type UpdateEmployeeInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  userId?: string | null;
  phone?: string;
  documentType?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null;
  country?: string;
  state?: string;
  city?: string;
  maritalStatus?: string;
  childrenCount?: number | null;
  housingType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  businessUnitId?: string | null;
  areaId?: string;
  positionId?: string;
  status?: EmployeeStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
  customFields?: PositionCustomFieldInput[];
};

export type CreateReportingLineInput = {
  managerEmployeeId: string;
  type: ReportingLineType;
};

export type OrgImportIssue = {
  row: number;
  field: string;
  message: string;
  level: "error" | "warning";
};

export type OrgImportEntityCounts = {
  create: number;
  update: number;
  omit: number;
};

export type OrgImportSummary = {
  businessUnits: OrgImportEntityCounts;
  areas: OrgImportEntityCounts;
  jobLevels: OrgImportEntityCounts;
  positions: OrgImportEntityCounts;
  employees: OrgImportEntityCounts;
  reportingLines: OrgImportEntityCounts;
};

export type OrgImportPreview = {
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  rowsEmpty: number;
  canApply: boolean;
  summary: OrgImportSummary;
  issues: OrgImportIssue[];
};

export type OrgImportApplyResult = OrgImportPreview & {
  applied: boolean;
};
