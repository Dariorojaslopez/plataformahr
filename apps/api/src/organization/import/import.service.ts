import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma, ReportingLineType, type PrismaClient } from '@prisma/client';
import { nextSequentialCode } from '../../common/sequential-code';
import { duplicateOrgUniqueMessage } from '../../common/prisma/duplicate-company-code';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_IMPORT_AUDIT,
  ORG_IMPORT_MAX_BYTES,
  ORG_IMPORT_TEMPLATE_FILENAME,
  ORG_IMPORT_TEMPLATE_XLSX_FILENAME,
} from './import.constants';
import {
  buildOrgImportPlan,
  buildOrgImportPlanFromTable,
  buildOrgImportTemplateCsv,
  orgImportFileError,
  toPreviewDto,
} from './import.plan';
import type {
  OrgImportApplyResponse,
  OrgImportCatalog,
  OrgImportPayload,
  OrgImportPlan,
  PlannedArea,
  PlannedPosition,
} from './import.types';
import {
  buildOrgImportTemplateXlsx,
  parseOrgImportXlsx,
  XlsxParseError,
} from './xlsx-workbook';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class OrgImportService {
  constructor(private readonly prisma: PrismaService) {}

  templateCsv(): { csv: string; filename: string } {
    return {
      csv: buildOrgImportTemplateCsv(),
      filename: ORG_IMPORT_TEMPLATE_FILENAME,
    };
  }

  async templateXlsx(): Promise<{ buffer: Buffer; filename: string }> {
    return {
      buffer: await buildOrgImportTemplateXlsx(),
      filename: ORG_IMPORT_TEMPLATE_XLSX_FILENAME,
    };
  }

  async preview(companyId: string, payload: OrgImportPayload) {
    this.assertPayloadSize(payload);
    const catalog = await this.loadCatalog(this.prisma, companyId);
    return toPreviewDto(await this.planFromPayload(payload, catalog));
  }

  async apply(
    companyId: string,
    actorUserId: string,
    payload: OrgImportPayload,
  ): Promise<OrgImportApplyResponse> {
    this.assertPayloadSize(payload);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const catalog = await this.loadCatalog(tx, companyId);
          const plan = await this.planFromPayload(payload, catalog);
          if (!plan.canApply) {
            return { ...toPreviewDto(plan), applied: false };
          }
          await this.persist(tx, companyId, plan, catalog);
          await tx.auditLog.create({
            data: {
              action: ORG_IMPORT_AUDIT,
              entity: 'OrganizationImport',
              entityId: companyId,
              companyId,
              userId: actorUserId,
              metadata: {
                result: 'applied',
                rowsTotal: plan.rowsTotal,
                summary: plan.summary,
              },
            },
          });
          return { ...toPreviewDto(plan), applied: true };
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (error) {
      const unique = duplicateOrgUniqueMessage(error);
      if (unique) {
        throw new ConflictException(unique);
      }
      throw error;
    }
  }

  private assertPayloadSize(payload: OrgImportPayload): void {
    const size =
      'xlsx' in payload
        ? payload.xlsx.length
        : Buffer.byteLength(payload.csv, 'utf8');
    if (size > ORG_IMPORT_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo de ${ORG_IMPORT_MAX_BYTES} bytes.`,
      );
    }
  }

  private async planFromPayload(
    payload: OrgImportPayload,
    catalog: OrgImportCatalog,
  ): Promise<OrgImportPlan> {
    if ('csv' in payload) {
      return buildOrgImportPlan(payload.csv, catalog);
    }
    try {
      const table = await parseOrgImportXlsx(payload.xlsx);
      return buildOrgImportPlanFromTable(table, catalog);
    } catch (error) {
      const message =
        error instanceof XlsxParseError || error instanceof Error
          ? error.message
          : 'No se pudo leer el Excel.';
      return orgImportFileError(message);
    }
  }

  private async loadCatalog(
    db: Tx,
    companyId: string,
  ): Promise<OrgImportCatalog> {
    const [
      businessUnits,
      areas,
      jobLevels,
      positions,
      employees,
      directReports,
    ] = await Promise.all([
      db.businessUnit.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          status: true,
          deletedAt: true,
        },
      }),
      db.area.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          status: true,
          businessUnitId: true,
          parentAreaId: true,
          deletedAt: true,
        },
      }),
      db.jobLevel.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          name: true,
          rank: true,
          status: true,
          deletedAt: true,
        },
      }),
      db.position.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          name: true,
          areaId: true,
          jobLevelId: true,
          parentPositionId: true,
          headcount: true,
          status: true,
          deletedAt: true,
        },
      }),
      db.employee.findMany({
        where: { companyId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          businessUnitId: true,
          areaId: true,
          positionId: true,
          deletedAt: true,
        },
      }),
      db.employeeReportingLine.findMany({
        where: { companyId, type: ReportingLineType.DIRECT },
        select: { employeeId: true, managerEmployeeId: true },
      }),
    ]);
    return {
      businessUnits,
      areas,
      jobLevels,
      positions,
      employees,
      directReports,
    };
  }

  private async persist(
    tx: Prisma.TransactionClient,
    companyId: string,
    plan: OrgImportPlan,
    catalog: OrgImportCatalog,
  ): Promise<void> {
    const buIds = new Map<string, string>();
    const areaIds = new Map<string, string>();
    const levelIds = new Map<string, string>();
    const positionIds = new Map<string, string>();
    const employeeIds = new Map<string, string>();
    const buCodes = catalog.businessUnits.map((item) => item.code);
    const areaCodes = catalog.areas.map((item) => item.code);
    const levelCodes = catalog.jobLevels.map((item) => item.code);
    const positionCodes = catalog.positions.map((item) => item.code);

    for (const item of catalog.businessUnits) {
      if (!item.deletedAt) buIds.set(item.name, item.id);
    }
    for (const item of catalog.areas) {
      if (!item.deletedAt) areaIds.set(item.name, item.id);
    }
    for (const item of catalog.jobLevels) {
      if (!item.deletedAt) levelIds.set(item.name, item.id);
    }
    for (const item of catalog.positions) {
      if (!item.deletedAt) positionIds.set(item.name, item.id);
    }
    for (const item of catalog.employees) {
      if (!item.deletedAt) employeeIds.set(item.email.toLowerCase(), item.id);
    }

    for (const item of plan.businessUnits) {
      if (item.action === 'omit' && item.existingId) {
        buIds.set(item.name, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.businessUnit.update({
          where: { id: item.existingId },
          data: {
            name: item.name,
            description: item.description,
            status: item.status,
          },
        });
        buIds.set(item.name, item.existingId);
        continue;
      }
      const code = nextSequentialCode(buCodes);
      buCodes.push(code);
      const created = await tx.businessUnit.create({
        data: {
          companyId,
          code,
          name: item.name,
          description: item.description,
          status: item.status,
        },
      });
      buIds.set(item.name, created.id);
    }

    for (const item of plan.jobLevels) {
      if (item.action === 'omit' && item.existingId) {
        levelIds.set(item.name, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.jobLevel.update({
          where: { id: item.existingId },
          data: { name: item.name, rank: item.rank, status: item.status },
        });
        levelIds.set(item.name, item.existingId);
        continue;
      }
      const code = nextSequentialCode(levelCodes);
      levelCodes.push(code);
      const created = await tx.jobLevel.create({
        data: {
          companyId,
          code,
          name: item.name,
          rank: item.rank,
          status: item.status,
        },
      });
      levelIds.set(item.name, created.id);
    }

    for (const item of sortAreas(plan.areas)) {
      const businessUnitId = item.businessUnitName
        ? (buIds.get(item.businessUnitName) ?? null)
        : null;
      const parentAreaId = item.parentAreaName
        ? (areaIds.get(item.parentAreaName) ?? null)
        : null;
      if (item.action === 'omit' && item.existingId) {
        areaIds.set(item.name, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.area.update({
          where: { id: item.existingId },
          data: {
            name: item.name,
            description: item.description,
            status: item.status,
            businessUnitId,
            parentAreaId,
          },
        });
        areaIds.set(item.name, item.existingId);
        continue;
      }
      const code = nextSequentialCode(areaCodes);
      areaCodes.push(code);
      const created = await tx.area.create({
        data: {
          companyId,
          code,
          name: item.name,
          description: item.description,
          status: item.status,
          businessUnitId,
          parentAreaId,
        },
      });
      areaIds.set(item.name, created.id);
    }

    for (const item of sortPositions(plan.positions)) {
      const areaId = areaIds.get(item.areaName);
      if (!areaId) {
        throw new BadRequestException(`No existe el área ${item.areaName}.`);
      }
      const jobLevelId = item.jobLevelName
        ? (levelIds.get(item.jobLevelName) ?? null)
        : null;
      const parentPositionId = item.parentPositionName
        ? (positionIds.get(item.parentPositionName) ?? null)
        : null;
      if (item.action === 'omit' && item.existingId) {
        positionIds.set(item.name, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.position.update({
          where: { id: item.existingId },
          data: {
            name: item.name,
            areaId,
            jobLevelId,
            parentPositionId,
            headcount: item.headcount,
            status: item.status,
          },
        });
        positionIds.set(item.name, item.existingId);
        continue;
      }
      const code = nextSequentialCode(positionCodes);
      positionCodes.push(code);
      const created = await tx.position.create({
        data: {
          companyId,
          code,
          name: item.name,
          areaId,
          jobLevelId,
          parentPositionId,
          headcount: item.headcount,
          status: item.status,
        },
      });
      positionIds.set(item.name, created.id);
    }

    for (const item of plan.employees) {
      const areaId = areaIds.get(item.areaName);
      const positionId = positionIds.get(item.positionName);
      if (!areaId || !positionId) {
        throw new BadRequestException(
          `No se pudo resolver área/cargo para ${item.email}.`,
        );
      }
      const businessUnitId = item.businessUnitName
        ? (buIds.get(item.businessUnitName) ?? null)
        : null;
      if (item.action === 'omit' && item.existingId) {
        employeeIds.set(item.email, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.employee.update({
          where: { id: item.existingId },
          data: {
            firstName: item.firstName,
            lastName: item.lastName,
            areaId,
            positionId,
            businessUnitId,
            status: item.status,
          },
        });
        employeeIds.set(item.email, item.existingId);
        continue;
      }
      const created = await tx.employee.create({
        data: {
          companyId,
          email: item.email,
          firstName: item.firstName,
          lastName: item.lastName,
          areaId,
          positionId,
          businessUnitId,
          status: item.status,
        },
      });
      employeeIds.set(item.email, created.id);
    }

    for (const item of plan.reportingLines) {
      if (item.action === 'omit') continue;
      const employeeId = employeeIds.get(item.employeeEmail);
      const managerEmployeeId = employeeIds.get(item.managerEmail);
      if (!employeeId || !managerEmployeeId) {
        throw new BadRequestException(
          `No existe el manager ${item.managerEmail}.`,
        );
      }
      const existing = await tx.employeeReportingLine.findFirst({
        where: { companyId, employeeId, type: ReportingLineType.DIRECT },
      });
      if (existing) {
        await tx.employeeReportingLine.update({
          where: { id: existing.id },
          data: { managerEmployeeId },
        });
      } else {
        await tx.employeeReportingLine.create({
          data: {
            companyId,
            employeeId,
            managerEmployeeId,
            type: ReportingLineType.DIRECT,
          },
        });
      }
    }
  }
}

function sortAreas(areas: PlannedArea[]): PlannedArea[] {
  const byName = new Map(areas.map((area) => [area.name, area]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PlannedArea[] = [];

  function visit(name: string) {
    if (visited.has(name) || !byName.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    const node = byName.get(name);
    if (node?.parentAreaName) {
      visit(node.parentAreaName);
    }
    visiting.delete(name);
    visited.add(name);
    if (node) ordered.push(node);
  }

  for (const area of areas) {
    visit(area.name);
  }
  return ordered;
}

function sortPositions(positions: PlannedPosition[]): PlannedPosition[] {
  const byName = new Map(positions.map((position) => [position.name, position]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PlannedPosition[] = [];

  function visit(name: string) {
    if (visited.has(name) || !byName.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    const node = byName.get(name);
    if (node?.parentPositionName) {
      visit(node.parentPositionName);
    }
    visiting.delete(name);
    visited.add(name);
    if (node) ordered.push(node);
  }

  for (const position of positions) {
    visit(position.name);
  }
  return ordered;
}
