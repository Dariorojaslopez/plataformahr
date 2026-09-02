export const ORG_IMPORT_MAX_BYTES = 6 * 1024 * 1024;
export const ORG_IMPORT_MAX_ROWS = 4_000;
export const ORG_IMPORT_TEMPLATE_FILENAME = 'plantilla-organizacion.csv';
export const ORG_IMPORT_TEMPLATE_XLSX_FILENAME = 'plantilla-organizacion.xlsx';
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const ORG_IMPORT_HEADERS = [
  'recordType',
  'name',
  'description',
  'status',
  'rank',
  'headcount',
  'businessUnitName',
  'areaName',
  'parentAreaName',
  'jobLevelName',
  'positionName',
  'parentPositionName',
  'email',
  'firstName',
  'lastName',
  'managerEmail',
] as const;

export type OrgImportHeader = (typeof ORG_IMPORT_HEADERS)[number];

/** Old code columns are ignored so leftover templates do not fail as unknown headers. */
export const ORG_IMPORT_IGNORED_HEADERS = new Set([
  'code',
  'businessUnitCode',
  'areaCode',
  'parentAreaCode',
  'jobLevelCode',
  'positionCode',
]);

export const ORG_IMPORT_RECORD_TYPES = [
  'businessUnit',
  'area',
  'jobLevel',
  'position',
  'employee',
] as const;

export type OrgImportRecordType = (typeof ORG_IMPORT_RECORD_TYPES)[number];

export const ORG_IMPORT_AUDIT = 'ORGANIZATION_IMPORTED';
