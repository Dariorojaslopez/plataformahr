import ExcelJS from 'exceljs';
import { emptyCatalog } from './import.types';
import { buildOrgImportPlanFromTable } from './import.plan';
import {
  buildOrgImportTemplateXlsx,
  parseOrgImportXlsx,
  XlsxParseError,
} from './xlsx-workbook';
import { ORG_IMPORT_HEADERS } from './import.constants';

describe('org import xlsx', () => {
  it('builds a structured template that round-trips headers', async () => {
    const buffer = await buildOrgImportTemplateXlsx();
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const table = await parseOrgImportXlsx(buffer);
    expect(table[0]?.slice(0, ORG_IMPORT_HEADERS.length)).toEqual([
      ...ORG_IMPORT_HEADERS,
    ]);
  });

  it('reads data rows from the Datos sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Datos');
    sheet.addRow([...ORG_IMPORT_HEADERS]);
    sheet.addRow([
      'area',
      'Talento',
      '',
      'ACTIVE',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const table = await parseOrgImportXlsx(buffer);
    const plan = buildOrgImportPlanFromTable(table, emptyCatalog());
    expect(plan.canApply).toBe(true);
    expect(plan.summary.areas.create).toBe(1);
  });

  it('rejects a non-xlsx buffer', async () => {
    await expect(
      parseOrgImportXlsx(Buffer.from('recordType,code')),
    ).rejects.toBeInstanceOf(XlsxParseError);
  });
});
