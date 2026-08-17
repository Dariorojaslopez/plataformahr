export const ORG_IMPORT_MAX_BYTES = 6 * 1024 * 1024;
export const ORG_IMPORT_MAX_ROWS = 4_000;
export const ORG_IMPORT_TEMPLATE_FILENAME = 'plantilla-organizacion.csv';

export const ORG_IMPORT_HEADERS = [
  'recordType',
  'code',
  'name',
  'description',
  'status',
  'rank',
  'headcount',
  'businessUnitCode',
  'areaCode',
  'parentAreaCode',
  'jobLevelCode',
  'positionCode',
  'email',
  'firstName',
  'lastName',
  'managerEmail',
] as const;

export type OrgImportHeader = (typeof ORG_IMPORT_HEADERS)[number];

export const ORG_IMPORT_RECORD_TYPES = [
  'businessUnit',
  'area',
  'jobLevel',
  'position',
  'employee',
] as const;

export type OrgImportRecordType = (typeof ORG_IMPORT_RECORD_TYPES)[number];

export const ORG_IMPORT_AUDIT = 'ORGANIZATION_IMPORTED';
