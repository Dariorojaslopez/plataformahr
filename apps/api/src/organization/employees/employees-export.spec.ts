import ExcelJS from 'exceljs';
import { buildEmployeesWorkbook } from './employees-export';

async function readWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0],
  );
  return workbook;
}

describe('employees excel export', () => {
  it('writes Spanish headers and the collaborator row', async () => {
    const buffer = await buildEmployeesWorkbook([
      {
        firstName: 'María',
        lastName: 'Duarte',
        sex: 'Femenino',
        documentType: 'CC',
        documentNumber: '123',
        birthDate: new Date('1990-05-04T00:00:00.000Z'),
        maritalStatus: 'Soltero/a',
        email: 'maria@example.com',
        phone: '300',
        country: 'Colombia',
        state: 'Bogotá D.C.',
        city: 'Bogotá',
        childrenCount: 1,
        housingType: 'Propia',
        businessUnitName: 'Financiera',
        areaName: 'Seguridad',
        positionName: 'Coordinadora SST',
        accessRoleCode: 'COLLABORATOR',
        status: 'ACTIVE',
        hireDate: new Date('2026-02-01T00:00:00.000Z'),
        terminationDate: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
      },
    ]);

    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet('Colaboradores');
    expect(sheet?.getRow(1).getCell(3).value).toBe('Sexo');
    expect(sheet?.getRow(2).getCell(1).value).toBe('María');
    expect(sheet?.getRow(2).getCell(3).value).toBe('Femenino');
    expect(sheet?.getRow(2).getCell(4).value).toBe('Cédula');
    expect(sheet?.getRow(2).getCell(18).value).toBe('Colaborador');
    expect(sheet?.getRow(2).getCell(19).value).toBe('Activo');
    expect(sheet?.getRow(2).getCell(20).value).toBe('01/02/2026');
  });
});
