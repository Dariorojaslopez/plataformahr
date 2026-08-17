import { EmployeeStatus, OrganizationEntityStatus } from '@prisma/client';
import { buildCsvDocument } from '../../performance/csv-export';
import { isCsvRowEmpty, parseCsv } from './csv-parse';
import {
  ORG_IMPORT_HEADERS,
  ORG_IMPORT_MAX_BYTES,
  ORG_IMPORT_MAX_ROWS,
  ORG_IMPORT_RECORD_TYPES,
  type OrgImportHeader,
  type OrgImportRecordType,
} from './import.constants';
import {
  normalizeEmail,
  wouldCreateParentCycle,
  wouldCreateReportingCycle,
} from '../organization.helpers';
import {
  emptyImportSummary,
  formatImportIssue,
  type CatalogArea,
  type CatalogBusinessUnit,
  type CatalogEmployee,
  type CatalogJobLevel,
  type CatalogPosition,
  type ImportAction,
  type ImportIssue,
  type OrgImportCatalog,
  type OrgImportPlan,
  type PlannedArea,
  type PlannedBusinessUnit,
  type PlannedEmployee,
  type PlannedJobLevel,
  type PlannedPosition,
} from './import.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECORD_TYPE_SET = new Set<string>(ORG_IMPORT_RECORD_TYPES);
const HEADER_SET = new Set<string>(ORG_IMPORT_HEADERS);

type CellMap = Record<OrgImportHeader, string>;

function issue(
  issues: ImportIssue[],
  row: number,
  field: string,
  message: string,
  level: ImportIssue['level'] = 'error',
): void {
  issues.push({ row, field, message, level });
}

function cell(map: CellMap, key: OrgImportHeader): string {
  return map[key]?.trim() ?? '';
}

function parseOrgStatus(
  raw: string,
  row: number,
  field: string,
  issues: ImportIssue[],
  fallback: OrganizationEntityStatus | null,
): OrganizationEntityStatus | null {
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  if (upper === OrganizationEntityStatus.ACTIVE) {
    return OrganizationEntityStatus.ACTIVE;
  }
  if (upper === OrganizationEntityStatus.INACTIVE) {
    return OrganizationEntityStatus.INACTIVE;
  }
  issue(issues, row, field, `Estado inválido (${raw}). Use ACTIVE o INACTIVE.`);
  return null;
}

function parseEmployeeStatus(
  raw: string,
  row: number,
  field: string,
  issues: ImportIssue[],
  fallback: EmployeeStatus | null,
): EmployeeStatus | null {
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  if (
    upper === EmployeeStatus.ACTIVE ||
    upper === EmployeeStatus.INACTIVE ||
    upper === EmployeeStatus.TERMINATED
  ) {
    return upper;
  }
  issue(
    issues,
    row,
    field,
    `Estado inválido (${raw}). Use ACTIVE, INACTIVE o TERMINATED.`,
  );
  return null;
}

function parseNonNegInt(
  raw: string,
  row: number,
  field: string,
  issues: ImportIssue[],
  required: boolean,
): number | null {
  if (!raw) {
    if (required) {
      issue(issues, row, field, 'Valor obligatorio.');
    }
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    issue(issues, row, field, `Debe ser un entero mayor o igual a 0 (${raw}).`);
    return null;
  }
  return Number(raw);
}

function requireLen(
  value: string,
  row: number,
  field: string,
  max: number,
  issues: ImportIssue[],
  required: boolean,
): string | null {
  if (!value) {
    if (required) {
      issue(issues, row, field, 'Valor obligatorio.');
    }
    return required ? null : '';
  }
  if (value.length > max) {
    issue(issues, row, field, `Supera el máximo de ${max} caracteres.`);
    return null;
  }
  return value;
}

function mapByCode<T extends { code: string | null }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row.code) map.set(row.code, row);
  }
  return map;
}

function live<T extends { deletedAt: Date | null }>(
  row: T | undefined,
): T | undefined {
  if (!row || row.deletedAt) return undefined;
  return row;
}

function deletedCodeMessage(label: string, code: string): string {
  return `El código ${code} pertenece a ${label} eliminada y no se puede reutilizar.`;
}

function bump(
  summary: OrgImportPlan['summary'],
  key: keyof OrgImportPlan['summary'],
  action: ImportAction,
): void {
  summary[key][action] += 1;
}

function sameText(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? '') === (b ?? '');
}

export function buildOrgImportTemplateCsv(): string {
  return buildCsvDocument({
    headers: [...ORG_IMPORT_HEADERS],
    rows: [],
  });
}

export function buildOrgImportPlan(
  csvText: string,
  catalog: OrgImportCatalog,
): OrgImportPlan {
  const issues: ImportIssue[] = [];
  const plan: OrgImportPlan = {
    issues,
    rowsTotal: 0,
    rowsValid: 0,
    rowsInvalid: 0,
    rowsEmpty: 0,
    canApply: false,
    summary: emptyImportSummary(),
    businessUnits: [],
    areas: [],
    jobLevels: [],
    positions: [],
    employees: [],
    reportingLines: [],
  };

  const bytes = Buffer.byteLength(csvText, 'utf8');
  if (bytes > ORG_IMPORT_MAX_BYTES) {
    issue(
      issues,
      1,
      'archivo',
      `El archivo supera el máximo de ${ORG_IMPORT_MAX_BYTES} bytes.`,
    );
    return plan;
  }

  let table: string[][];
  try {
    table = parseCsv(csvText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo leer el CSV.';
    issue(issues, 1, 'archivo', message);
    return plan;
  }

  if (table.length === 0) {
    issue(issues, 1, 'archivo', 'El archivo está vacío.');
    return plan;
  }

  const headerCells = table[0].map((h) => h.trim());
  if (headerCells.some((h) => h.toLowerCase() === 'companyid')) {
    issue(issues, 1, 'companyId', 'El archivo no puede especificar companyId.');
    return plan;
  }

  const unknown = headerCells.filter((h) => h.length > 0 && !HEADER_SET.has(h));
  for (const header of unknown) {
    issue(issues, 1, header, `Encabezado desconocido (${header}).`);
  }
  for (const required of ORG_IMPORT_HEADERS) {
    if (!headerCells.includes(required)) {
      issue(
        issues,
        1,
        required,
        `Falta el encabezado obligatorio ${required}.`,
      );
    }
  }
  if (issues.some((item) => item.level === 'error')) {
    return plan;
  }

  const indexByHeader = new Map<string, number>();
  headerCells.forEach((header, idx) => {
    if (header) indexByHeader.set(header, idx);
  });

  const dataRows = table.slice(1);
  if (dataRows.length > ORG_IMPORT_MAX_ROWS) {
    issue(
      issues,
      1,
      'archivo',
      `El archivo supera el máximo de ${ORG_IMPORT_MAX_ROWS} filas.`,
    );
    return plan;
  }

  const buByCode = mapByCode(catalog.businessUnits);
  const areaByCode = mapByCode(catalog.areas);
  const levelByCode = mapByCode(catalog.jobLevels);
  const positionByCode = mapByCode(catalog.positions);
  const employeeByEmail = new Map(
    catalog.employees.map((row) => [row.email.toLowerCase(), row]),
  );
  const nameBu = new Map(
    catalog.businessUnits.filter((r) => !r.deletedAt).map((r) => [r.name, r]),
  );
  const nameArea = new Map(
    catalog.areas.filter((r) => !r.deletedAt).map((r) => [r.name, r]),
  );
  const nameLevel = new Map(
    catalog.jobLevels.filter((r) => !r.deletedAt).map((r) => [r.name, r]),
  );
  const namePosition = new Map(
    catalog.positions.filter((r) => !r.deletedAt).map((r) => [r.name, r]),
  );
  const rankLevel = new Map(
    catalog.jobLevels.filter((r) => !r.deletedAt).map((r) => [r.rank, r]),
  );

  const fileBuCodes = new Map<string, number>();
  const fileAreaCodes = new Map<string, number>();
  const fileLevelCodes = new Map<string, number>();
  const filePositionCodes = new Map<string, number>();
  const fileEmails = new Map<string, number>();
  const fileBuNames = new Map<string, number>();
  const fileAreaNames = new Map<string, number>();
  const fileLevelNames = new Map<string, number>();
  const filePositionNames = new Map<string, number>();
  const fileRanks = new Map<number, number>();

  function rowMap(cells: string[]): CellMap {
    const map = {} as CellMap;
    for (const header of ORG_IMPORT_HEADERS) {
      const idx = indexByHeader.get(header) ?? -1;
      map[header] = idx >= 0 ? (cells[idx] ?? '') : '';
    }
    return map;
  }

  for (let i = 0; i < dataRows.length; i += 1) {
    const rowNumber = i + 2;
    const cells = dataRows[i];
    if (isCsvRowEmpty(cells)) {
      plan.rowsEmpty += 1;
      issue(issues, rowNumber, 'recordType', 'Fila vacía omitida.', 'warning');
      continue;
    }
    plan.rowsTotal += 1;
    const mapped = rowMap(cells);
    const typeRaw = cell(mapped, 'recordType');
    if (!RECORD_TYPE_SET.has(typeRaw)) {
      issue(
        issues,
        rowNumber,
        'recordType',
        `Tipo inválido (${typeRaw || 'vacío'}). Use ${ORG_IMPORT_RECORD_TYPES.join(', ')}.`,
      );
      continue;
    }
    const type = typeRaw as OrgImportRecordType;
    const before = issues.length;

    if (type === 'businessUnit') {
      plan.businessUnits.push(
        planBusinessUnit(rowNumber, mapped, issues, {
          buByCode,
          nameBu,
          fileBuCodes,
          fileBuNames,
        }),
      );
    } else if (type === 'area') {
      plan.areas.push(
        planArea(rowNumber, mapped, issues, {
          areaByCode,
          nameArea,
          fileAreaCodes,
          fileAreaNames,
        }),
      );
    } else if (type === 'jobLevel') {
      plan.jobLevels.push(
        planJobLevel(rowNumber, mapped, issues, {
          levelByCode,
          nameLevel,
          rankLevel,
          fileLevelCodes,
          fileLevelNames,
          fileRanks,
        }),
      );
    } else if (type === 'position') {
      plan.positions.push(
        planPosition(rowNumber, mapped, issues, {
          positionByCode,
          namePosition,
          filePositionCodes,
          filePositionNames,
        }),
      );
    } else {
      plan.employees.push(
        planEmployee(rowNumber, mapped, issues, {
          employeeByEmail,
          fileEmails,
        }),
      );
    }

    if (issues.slice(before).some((item) => item.level === 'error')) {
      continue;
    }
  }

  resolveReferences(plan, catalog, issues, {
    buByCode,
    areaByCode,
    levelByCode,
    positionByCode,
    employeeByEmail,
  });
  planReporting(plan, catalog, issues, employeeByEmail);

  const errorRows = new Set(
    issues.filter((item) => item.level === 'error').map((item) => item.row),
  );
  plan.businessUnits = plan.businessUnits.filter(
    (item) => !errorRows.has(item.row),
  );
  plan.areas = plan.areas.filter((item) => !errorRows.has(item.row));
  plan.jobLevels = plan.jobLevels.filter((item) => !errorRows.has(item.row));
  plan.positions = plan.positions.filter((item) => !errorRows.has(item.row));
  plan.employees = plan.employees.filter((item) => !errorRows.has(item.row));
  plan.reportingLines = plan.reportingLines.filter(
    (item) => !errorRows.has(item.row),
  );

  for (const item of plan.businessUnits)
    bump(plan.summary, 'businessUnits', item.action);
  for (const item of plan.areas) bump(plan.summary, 'areas', item.action);
  for (const item of plan.jobLevels)
    bump(plan.summary, 'jobLevels', item.action);
  for (const item of plan.positions)
    bump(plan.summary, 'positions', item.action);
  for (const item of plan.employees)
    bump(plan.summary, 'employees', item.action);
  for (const item of plan.reportingLines) {
    bump(plan.summary, 'reportingLines', item.action);
  }

  plan.rowsInvalid = [...errorRows].filter((row) => row > 1).length;
  plan.rowsValid = Math.max(0, plan.rowsTotal - plan.rowsInvalid);
  plan.canApply =
    issues.every((item) => item.level !== 'error') && plan.rowsTotal > 0;
  return plan;
}

function planBusinessUnit(
  row: number,
  mapped: CellMap,
  issues: ImportIssue[],
  ctx: {
    buByCode: Map<string, CatalogBusinessUnit>;
    nameBu: Map<string, CatalogBusinessUnit>;
    fileBuCodes: Map<string, number>;
    fileBuNames: Map<string, number>;
  },
): PlannedBusinessUnit {
  const code =
    requireLen(cell(mapped, 'code'), row, 'code', 50, issues, true) ?? '';
  const name =
    requireLen(cell(mapped, 'name'), row, 'name', 120, issues, true) ?? '';
  const descriptionRaw = requireLen(
    cell(mapped, 'description'),
    row,
    'description',
    500,
    issues,
    false,
  );
  const existing = code ? ctx.buByCode.get(code) : undefined;
  if (existing?.deletedAt) {
    issue(
      issues,
      row,
      'code',
      deletedCodeMessage('una unidad de negocio', code),
    );
  }
  const liveExisting = live(existing);
  const status = parseOrgStatus(
    cell(mapped, 'status'),
    row,
    'status',
    issues,
    liveExisting?.status ?? OrganizationEntityStatus.ACTIVE,
  );
  if (code) {
    const dup = ctx.fileBuCodes.get(code);
    if (dup) {
      issue(
        issues,
        row,
        'code',
        `Código duplicado en el archivo (también en fila ${dup}).`,
      );
    } else {
      ctx.fileBuCodes.set(code, row);
    }
  }
  if (name) {
    const dupName = ctx.fileBuNames.get(name);
    if (dupName) {
      issue(
        issues,
        row,
        'name',
        `Nombre duplicado en el archivo (también en fila ${dupName}).`,
      );
    } else {
      ctx.fileBuNames.set(name, row);
    }
    const named = ctx.nameBu.get(name);
    if (named && named.code !== code) {
      issue(
        issues,
        row,
        'name',
        `Ya existe una unidad de negocio con el nombre ${name}.`,
      );
    }
  }
  const description =
    descriptionRaw === ''
      ? (liveExisting?.description ?? null)
      : (descriptionRaw ?? null);
  let action: ImportAction = liveExisting ? 'update' : 'create';
  if (
    liveExisting &&
    liveExisting.name === name &&
    sameText(liveExisting.description, description) &&
    liveExisting.status === status
  ) {
    action = 'omit';
  }
  return {
    row,
    action,
    existingId: liveExisting?.id ?? null,
    code,
    name,
    description,
    status: status ?? OrganizationEntityStatus.ACTIVE,
  };
}

function planArea(
  row: number,
  mapped: CellMap,
  issues: ImportIssue[],
  ctx: {
    areaByCode: Map<string, CatalogArea>;
    nameArea: Map<string, CatalogArea>;
    fileAreaCodes: Map<string, number>;
    fileAreaNames: Map<string, number>;
  },
): PlannedArea {
  const code =
    requireLen(cell(mapped, 'code'), row, 'code', 50, issues, true) ?? '';
  const name =
    requireLen(cell(mapped, 'name'), row, 'name', 120, issues, true) ?? '';
  const descriptionRaw = requireLen(
    cell(mapped, 'description'),
    row,
    'description',
    500,
    issues,
    false,
  );
  const existing = code ? ctx.areaByCode.get(code) : undefined;
  if (existing?.deletedAt) {
    issue(issues, row, 'code', deletedCodeMessage('un área', code));
  }
  const liveExisting = live(existing);
  const status = parseOrgStatus(
    cell(mapped, 'status'),
    row,
    'status',
    issues,
    liveExisting?.status ?? OrganizationEntityStatus.ACTIVE,
  );
  if (code) {
    const dup = ctx.fileAreaCodes.get(code);
    if (dup) {
      issue(
        issues,
        row,
        'code',
        `Código duplicado en el archivo (también en fila ${dup}).`,
      );
    } else {
      ctx.fileAreaCodes.set(code, row);
    }
  }
  if (name) {
    const dupName = ctx.fileAreaNames.get(name);
    if (dupName) {
      issue(
        issues,
        row,
        'name',
        `Nombre duplicado en el archivo (también en fila ${dupName}).`,
      );
    } else {
      ctx.fileAreaNames.set(name, row);
    }
    const named = ctx.nameArea.get(name);
    if (named && named.code !== code) {
      issue(issues, row, 'name', `Ya existe un área con el nombre ${name}.`);
    }
  }
  const parentAreaCode = cell(mapped, 'parentAreaCode') || null;
  if (parentAreaCode && parentAreaCode === code) {
    issue(
      issues,
      row,
      'parentAreaCode',
      'Un área no puede ser su propio padre.',
    );
  }
  const description =
    descriptionRaw === ''
      ? (liveExisting?.description ?? null)
      : (descriptionRaw ?? null);
  const businessUnitCode = cell(mapped, 'businessUnitCode') || null;
  const action: ImportAction = liveExisting ? 'update' : 'create';
  return {
    row,
    action,
    existingId: liveExisting?.id ?? null,
    code,
    name,
    description,
    status: status ?? OrganizationEntityStatus.ACTIVE,
    businessUnitCode,
    parentAreaCode,
  };
}

function planJobLevel(
  row: number,
  mapped: CellMap,
  issues: ImportIssue[],
  ctx: {
    levelByCode: Map<string, CatalogJobLevel>;
    nameLevel: Map<string, CatalogJobLevel>;
    rankLevel: Map<number, CatalogJobLevel>;
    fileLevelCodes: Map<string, number>;
    fileLevelNames: Map<string, number>;
    fileRanks: Map<number, number>;
  },
): PlannedJobLevel {
  const code =
    requireLen(cell(mapped, 'code'), row, 'code', 50, issues, true) ?? '';
  const name =
    requireLen(cell(mapped, 'name'), row, 'name', 120, issues, true) ?? '';
  const existing = code ? ctx.levelByCode.get(code) : undefined;
  if (existing?.deletedAt) {
    issue(issues, row, 'code', deletedCodeMessage('un nivel', code));
  }
  const liveExisting = live(existing);
  const rank = parseNonNegInt(
    cell(mapped, 'rank'),
    row,
    'rank',
    issues,
    !liveExisting,
  );
  const resolvedRank = rank ?? liveExisting?.rank ?? 0;
  const status = parseOrgStatus(
    cell(mapped, 'status'),
    row,
    'status',
    issues,
    liveExisting?.status ?? OrganizationEntityStatus.ACTIVE,
  );
  if (code) {
    const dup = ctx.fileLevelCodes.get(code);
    if (dup) {
      issue(
        issues,
        row,
        'code',
        `Código duplicado en el archivo (también en fila ${dup}).`,
      );
    } else {
      ctx.fileLevelCodes.set(code, row);
    }
  }
  if (name) {
    const dupName = ctx.fileLevelNames.get(name);
    if (dupName) {
      issue(
        issues,
        row,
        'name',
        `Nombre duplicado en el archivo (también en fila ${dupName}).`,
      );
    } else {
      ctx.fileLevelNames.set(name, row);
    }
    const named = ctx.nameLevel.get(name);
    if (named && named.code !== code) {
      issue(issues, row, 'name', `Ya existe un nivel con el nombre ${name}.`);
    }
  }
  const dupRank = ctx.fileRanks.get(resolvedRank);
  if (dupRank) {
    issue(
      issues,
      row,
      'rank',
      `El rango ${resolvedRank} está duplicado en el archivo (fila ${dupRank}).`,
    );
  } else {
    ctx.fileRanks.set(resolvedRank, row);
  }
  const ranked = ctx.rankLevel.get(resolvedRank);
  if (ranked && ranked.code !== code) {
    issue(
      issues,
      row,
      'rank',
      `Ya existe un nivel con el rango ${resolvedRank}.`,
    );
  }
  let action: ImportAction = liveExisting ? 'update' : 'create';
  if (
    liveExisting &&
    liveExisting.name === name &&
    liveExisting.rank === resolvedRank &&
    liveExisting.status === status
  ) {
    action = 'omit';
  }
  return {
    row,
    action,
    existingId: liveExisting?.id ?? null,
    code,
    name,
    rank: resolvedRank,
    status: status ?? OrganizationEntityStatus.ACTIVE,
  };
}

function planPosition(
  row: number,
  mapped: CellMap,
  issues: ImportIssue[],
  ctx: {
    positionByCode: Map<string, CatalogPosition>;
    namePosition: Map<string, CatalogPosition>;
    filePositionCodes: Map<string, number>;
    filePositionNames: Map<string, number>;
  },
): PlannedPosition {
  const code =
    requireLen(cell(mapped, 'code'), row, 'code', 50, issues, true) ?? '';
  const name =
    requireLen(cell(mapped, 'name'), row, 'name', 120, issues, true) ?? '';
  const areaCode =
    requireLen(cell(mapped, 'areaCode'), row, 'areaCode', 50, issues, true) ??
    '';
  const jobLevelCode = cell(mapped, 'jobLevelCode') || null;
  const existing = code ? ctx.positionByCode.get(code) : undefined;
  if (existing?.deletedAt) {
    issue(issues, row, 'code', deletedCodeMessage('un cargo', code));
  }
  const liveExisting = live(existing);
  const headcount = parseNonNegInt(
    cell(mapped, 'headcount'),
    row,
    'headcount',
    issues,
    false,
  );
  const resolvedHeadcount = headcount ?? liveExisting?.headcount ?? 1;
  const status = parseOrgStatus(
    cell(mapped, 'status'),
    row,
    'status',
    issues,
    liveExisting?.status ?? OrganizationEntityStatus.ACTIVE,
  );
  if (code) {
    const dup = ctx.filePositionCodes.get(code);
    if (dup) {
      issue(
        issues,
        row,
        'code',
        `Código duplicado en el archivo (también en fila ${dup}).`,
      );
    } else {
      ctx.filePositionCodes.set(code, row);
    }
  }
  if (name) {
    const dupName = ctx.filePositionNames.get(name);
    if (dupName) {
      issue(
        issues,
        row,
        'name',
        `Nombre duplicado en el archivo (también en fila ${dupName}).`,
      );
    } else {
      ctx.filePositionNames.set(name, row);
    }
    const named = ctx.namePosition.get(name);
    if (named && named.code !== code) {
      issue(issues, row, 'name', `Ya existe un cargo con el nombre ${name}.`);
    }
  }
  return {
    row,
    action: liveExisting ? 'update' : 'create',
    existingId: liveExisting?.id ?? null,
    code,
    name,
    areaCode,
    jobLevelCode,
    headcount: resolvedHeadcount,
    status: status ?? OrganizationEntityStatus.ACTIVE,
  };
}

function planEmployee(
  row: number,
  mapped: CellMap,
  issues: ImportIssue[],
  ctx: {
    employeeByEmail: Map<string, CatalogEmployee>;
    fileEmails: Map<string, number>;
  },
): PlannedEmployee {
  const emailRaw = cell(mapped, 'email');
  if (!emailRaw) {
    issue(
      issues,
      row,
      'email',
      'Valor obligatorio. El email identifica al colaborador.',
    );
  } else if (!EMAIL_RE.test(emailRaw) || emailRaw.length > 255) {
    issue(issues, row, 'email', `Email inválido (${emailRaw}).`);
  }
  const email = emailRaw ? normalizeEmail(emailRaw) : '';
  const firstName =
    requireLen(
      cell(mapped, 'firstName'),
      row,
      'firstName',
      100,
      issues,
      true,
    ) ?? '';
  const lastName =
    requireLen(cell(mapped, 'lastName'), row, 'lastName', 100, issues, true) ??
    '';
  const areaCode =
    requireLen(cell(mapped, 'areaCode'), row, 'areaCode', 50, issues, true) ??
    '';
  const positionCode =
    requireLen(
      cell(mapped, 'positionCode'),
      row,
      'positionCode',
      50,
      issues,
      true,
    ) ?? '';
  const businessUnitCode = cell(mapped, 'businessUnitCode') || null;
  const managerEmailRaw = cell(mapped, 'managerEmail');
  if (
    managerEmailRaw &&
    (!EMAIL_RE.test(managerEmailRaw) || managerEmailRaw.length > 255)
  ) {
    issue(issues, row, 'managerEmail', `Email inválido (${managerEmailRaw}).`);
  }
  const managerEmail = managerEmailRaw ? normalizeEmail(managerEmailRaw) : null;
  if (email && managerEmail && email === managerEmail) {
    issue(
      issues,
      row,
      'managerEmail',
      'Un colaborador no puede ser su propio manager.',
    );
  }
  const existing = email ? ctx.employeeByEmail.get(email) : undefined;
  if (existing?.deletedAt) {
    issue(
      issues,
      row,
      'email',
      `El email ${email} pertenece a un colaborador eliminado y no se puede reutilizar.`,
    );
  }
  const liveExisting = live(existing);
  const status = parseEmployeeStatus(
    cell(mapped, 'status'),
    row,
    'status',
    issues,
    liveExisting?.status ?? EmployeeStatus.ACTIVE,
  );
  if (email) {
    const dup = ctx.fileEmails.get(email);
    if (dup) {
      issue(
        issues,
        row,
        'email',
        `Email duplicado en el archivo (también en fila ${dup}).`,
      );
    } else {
      ctx.fileEmails.set(email, row);
    }
  }
  return {
    row,
    action: liveExisting ? 'update' : 'create',
    existingId: liveExisting?.id ?? null,
    email,
    firstName,
    lastName,
    areaCode,
    positionCode,
    businessUnitCode,
    status: status ?? EmployeeStatus.ACTIVE,
    managerEmail,
  };
}

function resolveReferences(
  plan: OrgImportPlan,
  catalog: OrgImportCatalog,
  issues: ImportIssue[],
  maps: {
    buByCode: Map<string, CatalogBusinessUnit>;
    areaByCode: Map<string, CatalogArea>;
    levelByCode: Map<string, CatalogJobLevel>;
    positionByCode: Map<string, CatalogPosition>;
    employeeByEmail: Map<string, CatalogEmployee>;
  },
): void {
  const fileBu = new Set(plan.businessUnits.map((item) => item.code));
  const fileArea = new Set(plan.areas.map((item) => item.code));
  const fileLevel = new Set(plan.jobLevels.map((item) => item.code));
  const filePosition = new Set(plan.positions.map((item) => item.code));

  function hasBu(code: string): boolean {
    return fileBu.has(code) || Boolean(live(maps.buByCode.get(code)));
  }
  function hasArea(code: string): boolean {
    return fileArea.has(code) || Boolean(live(maps.areaByCode.get(code)));
  }
  function hasLevel(code: string): boolean {
    return fileLevel.has(code) || Boolean(live(maps.levelByCode.get(code)));
  }
  function hasPosition(code: string): boolean {
    return (
      filePosition.has(code) || Boolean(live(maps.positionByCode.get(code)))
    );
  }

  for (const area of plan.areas) {
    if (area.businessUnitCode && !hasBu(area.businessUnitCode)) {
      issue(
        issues,
        area.row,
        'businessUnitCode',
        `No existe la unidad de negocio ${area.businessUnitCode}.`,
      );
    }
    if (area.parentAreaCode && !hasArea(area.parentAreaCode)) {
      issue(
        issues,
        area.row,
        'parentAreaCode',
        `No existe el área padre ${area.parentAreaCode}.`,
      );
    }
    const existing = live(maps.areaByCode.get(area.code));
    const parentIdByCode = new Map<string, string | null>();
    for (const current of catalog.areas.filter(
      (item) => !item.deletedAt && item.code,
    )) {
      const parent = current.parentAreaId
        ? catalog.areas.find((item) => item.id === current.parentAreaId)
        : undefined;
      parentIdByCode.set(current.code as string, parent?.code ?? null);
    }
    for (const planned of plan.areas) {
      parentIdByCode.set(planned.code, planned.parentAreaCode);
    }
    if (area.parentAreaCode && area.code) {
      if (
        wouldCreateParentCycle(area.code, area.parentAreaCode, parentIdByCode)
      ) {
        issue(
          issues,
          area.row,
          'parentAreaCode',
          'La jerarquía de áreas formaría un ciclo.',
        );
      }
    }
    if (
      existing &&
      existing.name === area.name &&
      sameText(existing.description, area.description) &&
      existing.status === area.status
    ) {
      const existingBu = catalog.businessUnits.find(
        (item) => item.id === existing.businessUnitId,
      );
      const existingParent = catalog.areas.find(
        (item) => item.id === existing.parentAreaId,
      );
      if (
        (existingBu?.code ?? null) === area.businessUnitCode &&
        (existingParent?.code ?? null) === area.parentAreaCode
      ) {
        area.action = 'omit';
      }
    }
  }

  for (const position of plan.positions) {
    if (position.areaCode && !hasArea(position.areaCode)) {
      issue(
        issues,
        position.row,
        'areaCode',
        `No existe el área ${position.areaCode}.`,
      );
    }
    if (position.jobLevelCode && !hasLevel(position.jobLevelCode)) {
      issue(
        issues,
        position.row,
        'jobLevelCode',
        `No existe el nivel ${position.jobLevelCode}.`,
      );
    }
    const existing = live(maps.positionByCode.get(position.code));
    if (existing) {
      const existingArea = catalog.areas.find(
        (item) => item.id === existing.areaId,
      );
      const existingLevel = catalog.jobLevels.find(
        (item) => item.id === existing.jobLevelId,
      );
      if (
        existing.name === position.name &&
        existing.headcount === position.headcount &&
        existing.status === position.status &&
        (existingArea?.code ?? null) === position.areaCode &&
        (existingLevel?.code ?? null) === position.jobLevelCode
      ) {
        position.action = 'omit';
      }
    }
  }

  for (const employee of plan.employees) {
    if (employee.areaCode && !hasArea(employee.areaCode)) {
      issue(
        issues,
        employee.row,
        'areaCode',
        `No existe el área ${employee.areaCode}.`,
      );
    }
    if (employee.positionCode && !hasPosition(employee.positionCode)) {
      issue(
        issues,
        employee.row,
        'positionCode',
        `No existe el cargo ${employee.positionCode}.`,
      );
    }
    if (employee.businessUnitCode && !hasBu(employee.businessUnitCode)) {
      issue(
        issues,
        employee.row,
        'businessUnitCode',
        `No existe la unidad de negocio ${employee.businessUnitCode}.`,
      );
    }
    const existing = live(maps.employeeByEmail.get(employee.email));
    if (existing) {
      const existingArea = catalog.areas.find(
        (item) => item.id === existing.areaId,
      );
      const existingPosition = catalog.positions.find(
        (item) => item.id === existing.positionId,
      );
      const existingBu = catalog.businessUnits.find(
        (item) => item.id === existing.businessUnitId,
      );
      if (
        existing.firstName === employee.firstName &&
        existing.lastName === employee.lastName &&
        existing.status === employee.status &&
        (existingArea?.code ?? null) === employee.areaCode &&
        (existingPosition?.code ?? null) === employee.positionCode &&
        (existingBu?.code ?? null) === employee.businessUnitCode
      ) {
        employee.action = 'omit';
      }
    }
  }
}

function planReporting(
  plan: OrgImportPlan,
  catalog: OrgImportCatalog,
  issues: ImportIssue[],
  employeeByEmail: Map<string, CatalogEmployee>,
): void {
  const fileEmails = new Set(plan.employees.map((item) => item.email));
  const emailById = new Map(
    catalog.employees
      .filter((item) => !item.deletedAt)
      .map((item) => [item.id, item.email]),
  );
  const existingDirect = new Map<string, string>();
  for (const line of catalog.directReports) {
    const emp = emailById.get(line.employeeId);
    const mgr = emailById.get(line.managerEmployeeId);
    if (emp && mgr) existingDirect.set(emp, mgr);
  }

  const proposed = new Map(existingDirect);
  for (const employee of plan.employees) {
    if (employee.managerEmail) {
      proposed.set(employee.email, employee.managerEmail);
    }
  }

  const reportsTo = new Map<string, string[]>();
  for (const [emp, mgr] of proposed) {
    const list = reportsTo.get(emp) ?? [];
    list.push(mgr);
    reportsTo.set(emp, list);
  }

  for (const employee of plan.employees) {
    if (!employee.managerEmail) continue;
    const existsInFile = fileEmails.has(employee.managerEmail);
    const existsInDb = Boolean(
      live(employeeByEmail.get(employee.managerEmail)),
    );
    if (!existsInFile && !existsInDb) {
      issue(
        issues,
        employee.row,
        'managerEmail',
        `No existe el manager ${employee.managerEmail}.`,
      );
      continue;
    }
    if (
      wouldCreateReportingCycle(
        employee.email,
        employee.managerEmail,
        reportsTo,
      )
    ) {
      issue(
        issues,
        employee.row,
        'managerEmail',
        'La línea de reporte formaría un ciclo.',
      );
      continue;
    }
    const current = existingDirect.get(employee.email);
    const action: ImportAction = !current
      ? 'create'
      : current === employee.managerEmail
        ? 'omit'
        : 'update';
    plan.reportingLines.push({
      row: employee.row,
      action,
      employeeEmail: employee.email,
      managerEmail: employee.managerEmail,
    });
  }
}

export function toPreviewDto(plan: OrgImportPlan) {
  return {
    rowsTotal: plan.rowsTotal,
    rowsValid: plan.rowsValid,
    rowsInvalid: plan.rowsInvalid,
    rowsEmpty: plan.rowsEmpty,
    canApply: plan.canApply,
    summary: plan.summary,
    issues: plan.issues.map((item) => ({
      ...item,
      message: formatImportIssue(item),
    })),
  };
}
