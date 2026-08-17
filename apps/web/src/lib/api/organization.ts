import { apiRequest } from "@/lib/api/client";
import type {
  Area,
  AreaTreeNode,
  BusinessUnit,
  CreateAreaInput,
  CreateBusinessUnitInput,
  CreateEmployeeInput,
  CreateJobLevelInput,
  CreatePositionCustomFieldDefinitionInput,
  CreatePositionInput,
  CreateReportingLineInput,
  Employee,
  JobLevel,
  JobLevelCompetencies,
  ListEmployeesParams,
  OrganizationProfile,
  PaginatedEmployees,
  Position,
  PositionCustomFieldDefinition,
  ReplaceJobLevelCompetenciesInput,
  ReportingLine,
  UpdateAreaInput,
  UpdateBusinessUnitInput,
  UpdateEmployeeInput,
  UpdateJobLevelInput,
  UpdatePositionCustomFieldDefinitionInput,
  UpdatePositionInput,
} from "@/types/organization";

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const organizationApi = {
  listBusinessUnits: () =>
    apiRequest<BusinessUnit[]>("/organization/business-units"),

  createBusinessUnit: (body: CreateBusinessUnitInput) =>
    apiRequest<BusinessUnit>("/organization/business-units", {
      method: "POST",
      body,
    }),

  updateBusinessUnit: (id: string, body: UpdateBusinessUnitInput) =>
    apiRequest<BusinessUnit>(`/organization/business-units/${id}`, {
      method: "PATCH",
      body,
    }),

  listAreas: () => apiRequest<Area[]>("/organization/areas"),

  getAreaTree: () => apiRequest<AreaTreeNode[]>("/organization/areas/tree"),

  createArea: (body: CreateAreaInput) =>
    apiRequest<Area>("/organization/areas", { method: "POST", body }),

  updateArea: (id: string, body: UpdateAreaInput) =>
    apiRequest<Area>(`/organization/areas/${id}`, { method: "PATCH", body }),

  listJobLevels: () => apiRequest<JobLevel[]>("/organization/job-levels"),

  createJobLevel: (body: CreateJobLevelInput) =>
    apiRequest<JobLevel>("/organization/job-levels", { method: "POST", body }),

  updateJobLevel: (id: string, body: UpdateJobLevelInput) =>
    apiRequest<JobLevel>(`/organization/job-levels/${id}`, {
      method: "PATCH",
      body,
    }),

  getJobLevelCompetencies: (id: string) =>
    apiRequest<JobLevelCompetencies>(
      `/organization/job-levels/${id}/competencies`,
    ),

  replaceJobLevelCompetencies: (
    id: string,
    body: ReplaceJobLevelCompetenciesInput,
  ) =>
    apiRequest<JobLevelCompetencies>(
      `/organization/job-levels/${id}/competencies`,
      { method: "PUT", body },
    ),

  listPositions: () => apiRequest<Position[]>("/organization/positions"),

  getPosition: (id: string) =>
    apiRequest<Position>(`/organization/positions/${id}`),

  createPosition: (body: CreatePositionInput) =>
    apiRequest<Position>("/organization/positions", { method: "POST", body }),

  updatePosition: (id: string, body: UpdatePositionInput) =>
    apiRequest<Position>(`/organization/positions/${id}`, {
      method: "PATCH",
      body,
    }),

  listPositionCustomFields: () =>
    apiRequest<PositionCustomFieldDefinition[]>(
      "/organization/position-custom-fields",
    ),

  createPositionCustomField: (body: CreatePositionCustomFieldDefinitionInput) =>
    apiRequest<PositionCustomFieldDefinition>(
      "/organization/position-custom-fields",
      { method: "POST", body },
    ),

  updatePositionCustomField: (
    id: string,
    body: UpdatePositionCustomFieldDefinitionInput,
  ) =>
    apiRequest<PositionCustomFieldDefinition>(
      `/organization/position-custom-fields/${id}`,
      { method: "PATCH", body },
    ),

  listEmployees: (params: ListEmployeesParams = {}) =>
    apiRequest<PaginatedEmployees>(
      `/organization/employees${toQuery({
        status: params.status,
        areaId: params.areaId,
        positionId: params.positionId,
        businessUnitId: params.businessUnitId,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  getEmployee: (id: string) =>
    apiRequest<Employee>(`/organization/employees/${id}`),

  getOrganizationProfile: (id: string) =>
    apiRequest<OrganizationProfile>(
      `/organization/employees/${id}/organization-profile`,
    ),

  createEmployee: (body: CreateEmployeeInput) =>
    apiRequest<Employee>("/organization/employees", { method: "POST", body }),

  updateEmployee: (id: string, body: UpdateEmployeeInput) =>
    apiRequest<Employee>(`/organization/employees/${id}`, {
      method: "PATCH",
      body,
    }),

  listReportingLines: (employeeId: string) =>
    apiRequest<ReportingLine[]>(
      `/organization/employees/${employeeId}/reporting-lines`,
    ),

  createReportingLine: (employeeId: string, body: CreateReportingLineInput) =>
    apiRequest<ReportingLine>(
      `/organization/employees/${employeeId}/reporting-lines`,
      { method: "POST", body },
    ),

  deleteReportingLine: (employeeId: string, reportingLineId: string) =>
    apiRequest<{ success: boolean }>(
      `/organization/employees/${employeeId}/reporting-lines/${reportingLineId}`,
      { method: "DELETE" },
    ),
};

export const orgKeys = {
  all: (companyId: string) => ["organization", companyId] as const,
  businessUnits: (companyId: string) =>
    [...orgKeys.all(companyId), "business-units"] as const,
  areas: (companyId: string) => [...orgKeys.all(companyId), "areas"] as const,
  areaTree: (companyId: string) =>
    [...orgKeys.all(companyId), "area-tree"] as const,
  jobLevels: (companyId: string) =>
    [...orgKeys.all(companyId), "job-levels"] as const,
  jobLevelCompetencies: (companyId: string, id: string) =>
    [...orgKeys.all(companyId), "job-level-competencies", id] as const,
  positions: (companyId: string) =>
    [...orgKeys.all(companyId), "positions"] as const,
  positionCustomFields: (companyId: string) =>
    [...orgKeys.all(companyId), "position-custom-fields"] as const,
  employees: (companyId: string, params: ListEmployeesParams) =>
    [...orgKeys.all(companyId), "employees", params] as const,
  employee: (companyId: string, id: string) =>
    [...orgKeys.all(companyId), "employee", id] as const,
  employeeProfile: (companyId: string, id: string) =>
    [...orgKeys.all(companyId), "employee-profile", id] as const,
  reportingLines: (companyId: string, id: string) =>
    [...orgKeys.all(companyId), "reporting-lines", id] as const,
};
