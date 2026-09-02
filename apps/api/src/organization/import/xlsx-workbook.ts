import ExcelJS from 'exceljs';
import {
  ORG_IMPORT_HEADERS,
  ORG_IMPORT_MAX_ROWS,
  ORG_IMPORT_RECORD_TYPES,
} from './import.constants';

export const ORG_IMPORT_DATA_SHEET = 'Datos';
export const ORG_IMPORT_HELP_SHEET = 'Instrucciones';

export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxParseError';
  }
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  validation: ExcelJS.DataValidation,
): void {
  const validations = sheet.dataValidations as {
    add: (addr: string, item: ExcelJS.DataValidation) => void;
  };
  validations.add(range, validation);
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      return cellToString(value.result);
    }
    if ('formula' in value) {
      return '';
    }
    if ('error' in value) {
      return '';
    }
  }
  return '';
}

function rowToStrings(row: ExcelJS.Row, columnCount: number): string[] {
  const cells: string[] = [];
  for (let column = 1; column <= columnCount; column += 1) {
    cells.push(cellToString(row.getCell(column).value));
  }
  return cells;
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim().length === 0);
}

function findDataSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const named = workbook.getWorksheet(ORG_IMPORT_DATA_SHEET);
  if (named) return named;
  for (const sheet of workbook.worksheets) {
    if (sheet.name === ORG_IMPORT_HELP_SHEET) continue;
    const header = rowToStrings(sheet.getRow(1), ORG_IMPORT_HEADERS.length);
    if (header.some((cell) => cell.trim() === 'recordType')) {
      return sheet;
    }
  }
  return workbook.worksheets[0] ?? null;
}

export async function parseOrgImportXlsx(buffer: Buffer): Promise<string[][]> {
  if (!isZip(buffer)) {
    throw new XlsxParseError('El archivo no es un Excel (.xlsx) válido.');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new XlsxParseError(
      'No se pudo leer el Excel. Use la plantilla o un .xlsx sin macros.',
    );
  }

  const sheet = findDataSheet(workbook);
  if (!sheet) {
    throw new XlsxParseError('El Excel no tiene hojas.');
  }

  const columnCount = Math.max(sheet.columnCount, ORG_IMPORT_HEADERS.length);
  const lastRow = Math.max(sheet.actualRowCount, 1);
  const table: string[][] = [];
  let trailingEmpty = 0;

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const cells = rowToStrings(sheet.getRow(rowNumber), columnCount);
    if (isEmptyRow(cells)) {
      if (table.length === 0) continue;
      trailingEmpty += 1;
      if (trailingEmpty > 5) break;
      table.push(cells);
      continue;
    }
    trailingEmpty = 0;
    table.push(cells);
    if (table.length - 1 > ORG_IMPORT_MAX_ROWS) {
      break;
    }
  }

  while (table.length > 1 && isEmptyRow(table[table.length - 1])) {
    table.pop();
  }

  if (table.length === 0) {
    throw new XlsxParseError('La hoja Datos está vacía.');
  }

  return table;
}

export async function buildOrgImportTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plataforma HR';
  workbook.created = new Date();

  const data = workbook.addWorksheet(ORG_IMPORT_DATA_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ORG_IMPORT_HEADERS.forEach((header, index) => {
    data.getColumn(index + 1).width = Math.max(16, header.length + 4);
  });

  const emptyRow = ORG_IMPORT_HEADERS.map(() => '');
  data.addTable({
    name: 'Organizacion',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: ORG_IMPORT_HEADERS.map((name) => ({
      name,
      filterButton: true,
    })),
    rows: [emptyRow],
  });

  addListValidation(data, `A2:A${ORG_IMPORT_MAX_ROWS + 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${ORG_IMPORT_RECORD_TYPES.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'recordType',
    error: `Use: ${ORG_IMPORT_RECORD_TYPES.join(', ')}`,
  });
  addListValidation(data, `D2:D${ORG_IMPORT_MAX_ROWS + 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"ACTIVE,INACTIVE,TERMINATED"'],
    showErrorMessage: true,
    errorTitle: 'status',
    error: 'Use ACTIVE, INACTIVE o TERMINATED (colaboradores).',
  });

  const help = workbook.addWorksheet(ORG_IMPORT_HELP_SHEET);
  help.getColumn(1).width = 28;
  help.getColumn(2).width = 88;
  const helpRows: Array<[string, string]> = [
    [
      'Importación masiva',
      'Complete la tabla de la hoja Datos. No copie esta hoja.',
    ],
    [
      'Cómo usar',
      'Elija recordType en cada fila y llene solo las columnas de ese tipo. Las demás pueden quedar vacías.',
    ],
    ['businessUnit', 'Obligatorio: name. Opcional: description, status.'],
    [
      'area',
      'Obligatorio: name. Opcional: description, status, businessUnitName, parentAreaName.',
    ],
    ['jobLevel', 'Obligatorio: name, rank. Opcional: status.'],
    [
      'position',
      'Obligatorio: name, areaName. Opcional: jobLevelName, parentPositionName, headcount, status.',
    ],
    [
      'employee',
      'Obligatorio: email, firstName, lastName, areaName, positionName. Opcional: businessUnitName, managerEmail, status.',
    ],
    [
      'Identificación',
      'Unidad, área, nivel y cargo se identifican por nombre. El código (001, 002, …) lo asigna el sistema al crear. El colaborador se identifica por email.',
    ],
    ['Prohibido', 'No agregue la columna companyId ni macros o fórmulas.'],
    ['CSV', 'También se admite un CSV UTF-8 con los mismos encabezados.'],
  ];
  helpRows.forEach((row, index) => {
    help.getCell(index + 1, 1).value = row[0];
    help.getCell(index + 1, 1).font = { bold: true };
    help.getCell(index + 1, 2).value = row[1];
    help.getCell(index + 1, 2).alignment = { wrapText: true };
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
