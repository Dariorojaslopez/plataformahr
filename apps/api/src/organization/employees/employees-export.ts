import { EmployeeStatus } from '@prisma/client';
import { employeeDocumentTypeLabel } from '@talento/shared';
import ExcelJS from 'exceljs';

export const EMPLOYEES_EXPORT_FILENAME = 'colaboradores.xlsx';
export const EMPLOYEES_EXPORT_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HEADERS = [
  'Nombre',
  'Apellido',
  'Sexo',
  'Identificación (tipo)',
  'Identificación (número)',
  'Fecha de nacimiento',
  'Estado civil',
  'Email',
  'Teléfono',
  'País',
  'Estado/Depto',
  'Ciudad',
  'Hijos',
  'Tipo de vivienda',
  'Unidad de negocio',
  'Área',
  'Cargo',
  'Rol de sistema',
  'Estado',
  'Fecha de ingreso',
  'Fecha de terminación',
  'Contacto de emergencia',
  'Teléfono de emergencia',
] as const;

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  TERMINATED: 'Terminado',
};

const ROLE_LABEL: Record<string, string> = {
  CLIENT_ADMIN: 'Administrador de compañía',
  ADMINISTRATOR: 'Administrador',
  LEADER: 'Líder',
  RECRUITER: 'Reclutador',
  RECRUITMENT_LEADER: 'Líder de reclutamiento',
  PERFORMANCE_MANAGER: 'Gestor de performance',
  COLLABORATOR: 'Colaborador',
};

export type EmployeeExportRow = {
  firstName: string;
  lastName: string;
  sex: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: Date | null;
  maritalStatus: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  childrenCount: number | null;
  housingType: string | null;
  businessUnitName: string | null;
  areaName: string;
  positionName: string;
  accessRoleCode: string;
  status: EmployeeStatus;
  hireDate: Date | null;
  terminationDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
};

function formatDate(value: Date | null): string {
  if (!value) return '';
  const iso = value.toISOString().slice(0, 10);
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function cell(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return '';
  return value;
}

export async function buildEmployeesWorkbook(
  rows: EmployeeExportRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Talento';
  const sheet = workbook.addWorksheet('Colaboradores', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.addRow([...HEADERS]);
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };

  for (const row of rows) {
    sheet.addRow([
      row.firstName,
      row.lastName,
      cell(row.sex),
      cell(employeeDocumentTypeLabel(row.documentType)),
      cell(row.documentNumber),
      formatDate(row.birthDate),
      cell(row.maritalStatus),
      row.email,
      cell(row.phone),
      cell(row.country),
      cell(row.state),
      cell(row.city),
      row.childrenCount === null ? '' : row.childrenCount,
      cell(row.housingType),
      cell(row.businessUnitName),
      row.areaName,
      row.positionName,
      ROLE_LABEL[row.accessRoleCode] ?? row.accessRoleCode,
      STATUS_LABEL[row.status] ?? row.status,
      formatDate(row.hireDate),
      formatDate(row.terminationDate),
      cell(row.emergencyContactName),
      cell(row.emergencyContactPhone),
    ]);
  }

  HEADERS.forEach((name, index) => {
    sheet.getColumn(index + 1).width = Math.max(16, name.length + 2);
  });

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
