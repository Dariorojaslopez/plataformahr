import type { EmployeeStatus, OrganizationEntityStatus } from '@prisma/client';
import type { OrgImportRecordType } from './import.constants';

export type ImportIssueLevel = 'error' | 'warning';

export type ImportIssue = {
  row: number;
  field: string;
  message: string;
  level: ImportIssueLevel;
};

export type ImportAction = 'create' | 'update' | 'omit';

export type EntityCounts = {
  create: number;
  update: number;
  omit: number;
};

export type ImportSummary = {
  businessUnits: EntityCounts;
  areas: EntityCounts;
  jobLevels: EntityCounts;
  positions: EntityCounts;
  employees: EntityCounts;
  reportingLines: EntityCounts;
};

export type CatalogBusinessUnit = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: OrganizationEntityStatus;
  deletedAt: Date | null;
};

export type CatalogArea = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: OrganizationEntityStatus;
  businessUnitId: string | null;
  parentAreaId: string | null;
  deletedAt: Date | null;
};

export type CatalogJobLevel = {
  id: string;
  code: string | null;
  name: string;
  rank: number;
  status: OrganizationEntityStatus;
  deletedAt: Date | null;
};

export type CatalogPosition = {
  id: string;
  code: string | null;
  name: string;
  areaId: string;
  jobLevelId: string | null;
  parentPositionId: string | null;
  headcount: number;
  status: OrganizationEntityStatus;
  deletedAt: Date | null;
};

export type CatalogEmployee = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  businessUnitId: string | null;
  areaId: string;
  positionId: string;
  deletedAt: Date | null;
};

export type CatalogDirectReport = {
  employeeId: string;
  managerEmployeeId: string;
};

export type OrgImportCatalog = {
  businessUnits: CatalogBusinessUnit[];
  areas: CatalogArea[];
  jobLevels: CatalogJobLevel[];
  positions: CatalogPosition[];
  employees: CatalogEmployee[];
  directReports: CatalogDirectReport[];
};

export type PlannedBusinessUnit = {
  row: number;
  action: ImportAction;
  existingId: string | null;
  name: string;
  description: string | null;
  status: OrganizationEntityStatus;
};

export type PlannedArea = {
  row: number;
  action: ImportAction;
  existingId: string | null;
  name: string;
  description: string | null;
  status: OrganizationEntityStatus;
  businessUnitName: string | null;
  parentAreaName: string | null;
};

export type PlannedJobLevel = {
  row: number;
  action: ImportAction;
  existingId: string | null;
  name: string;
  rank: number;
  status: OrganizationEntityStatus;
};

export type PlannedPosition = {
  row: number;
  action: ImportAction;
  existingId: string | null;
  name: string;
  areaName: string;
  jobLevelName: string | null;
  parentPositionName: string | null;
  headcount: number;
  status: OrganizationEntityStatus;
};

export type PlannedEmployee = {
  row: number;
  action: ImportAction;
  existingId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  areaName: string;
  positionName: string;
  businessUnitName: string | null;
  status: EmployeeStatus;
  managerEmail: string | null;
};

export type PlannedReportingLine = {
  row: number;
  action: ImportAction;
  employeeEmail: string;
  managerEmail: string;
};

export type OrgImportPlan = {
  issues: ImportIssue[];
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  rowsEmpty: number;
  canApply: boolean;
  summary: ImportSummary;
  businessUnits: PlannedBusinessUnit[];
  areas: PlannedArea[];
  jobLevels: PlannedJobLevel[];
  positions: PlannedPosition[];
  employees: PlannedEmployee[];
  reportingLines: PlannedReportingLine[];
};

export type OrgImportPreviewResponse = {
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  rowsEmpty: number;
  canApply: boolean;
  summary: ImportSummary;
  issues: ImportIssue[];
};

export type OrgImportApplyResponse = OrgImportPreviewResponse & {
  applied: boolean;
};

export function emptyEntityCounts(): EntityCounts {
  return { create: 0, update: 0, omit: 0 };
}

export function emptyImportSummary(): ImportSummary {
  return {
    businessUnits: emptyEntityCounts(),
    areas: emptyEntityCounts(),
    jobLevels: emptyEntityCounts(),
    positions: emptyEntityCounts(),
    employees: emptyEntityCounts(),
    reportingLines: emptyEntityCounts(),
  };
}

export type OrgImportPayload = { csv: string } | { xlsx: Buffer };

export function emptyCatalog(): OrgImportCatalog {
  return {
    businessUnits: [],
    areas: [],
    jobLevels: [],
    positions: [],
    employees: [],
    directReports: [],
  };
}

export function formatImportIssue(issue: ImportIssue): string {
  return `Fila ${issue.row} · ${issue.field}: ${issue.message}`;
}

export function recordTypeLabel(type: OrgImportRecordType): string {
  switch (type) {
    case 'businessUnit':
      return 'unidad de negocio';
    case 'area':
      return 'área';
    case 'jobLevel':
      return 'nivel';
    case 'position':
      return 'cargo';
    case 'employee':
      return 'colaborador';
    default:
      return type;
  }
}
