import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma, ReportingLineType, type PrismaClient } from '@prisma/client';
import { duplicateCompanyCodeMessage } from '../../common/prisma/duplicate-company-code';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_IMPORT_AUDIT,
  ORG_IMPORT_MAX_BYTES,
  ORG_IMPORT_TEMPLATE_FILENAME,
} from './import.constants';
import {
  buildOrgImportPlan,
  buildOrgImportTemplateCsv,
  toPreviewDto,
} from './import.plan';
import type {
  OrgImportApplyResponse,
  OrgImportCatalog,
  OrgImportPlan,
  PlannedArea,
} from './import.types';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class OrgImportService {
  constructor(private readonly prisma: PrismaService) {}

  template(): { csv: string; filename: string } {
    return {
      csv: buildOrgImportTemplateCsv(),
      filename: ORG_IMPORT_TEMPLATE_FILENAME,
    };
  }

  async preview(companyId: string, csvText: string) {
    this.assertCsvSize(csvText);
    const catalog = await this.loadCatalog(this.prisma, companyId);
    return toPreviewDto(buildOrgImportPlan(csvText, catalog));
  }

  async apply(
    companyId: string,
    actorUserId: string,
    csvText: string,
  ): Promise<OrgImportApplyResponse> {
    this.assertCsvSize(csvText);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const catalog = await this.loadCatalog(tx, companyId);
          const plan = buildOrgImportPlan(csvText, catalog);
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
      const duplicate = duplicateCompanyCodeMessage(error);
      if (duplicate) {
        throw new ConflictException(duplicate);
      }
      throw error;
    }
  }

  private assertCsvSize(csvText: string): void {
    if (Buffer.byteLength(csvText, 'utf8') > ORG_IMPORT_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo de ${ORG_IMPORT_MAX_BYTES} bytes.`,
      );
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

    for (const item of catalog.businessUnits) {
      if (item.code && !item.deletedAt) buIds.set(item.code, item.id);
    }
    for (const item of catalog.areas) {
      if (item.code && !item.deletedAt) areaIds.set(item.code, item.id);
    }
    for (const item of catalog.jobLevels) {
      if (item.code && !item.deletedAt) levelIds.set(item.code, item.id);
    }
    for (const item of catalog.positions) {
      if (item.code && !item.deletedAt) positionIds.set(item.code, item.id);
    }
    for (const item of catalog.employees) {
      if (!item.deletedAt) employeeIds.set(item.email.toLowerCase(), item.id);
    }

    for (const item of plan.businessUnits) {
      if (item.action === 'omit' && item.existingId) {
        buIds.set(item.code, item.existingId);
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
        buIds.set(item.code, item.existingId);
        continue;
      }
      const created = await tx.businessUnit.create({
        data: {
          companyId,
          code: item.code,
          name: item.name,
          description: item.description,
          status: item.status,
        },
      });
      buIds.set(item.code, created.id);
    }

    for (const item of plan.jobLevels) {
      if (item.action === 'omit' && item.existingId) {
        levelIds.set(item.code, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.jobLevel.update({
          where: { id: item.existingId },
          data: { name: item.name, rank: item.rank, status: item.status },
        });
        levelIds.set(item.code, item.existingId);
        continue;
      }
      const created = await tx.jobLevel.create({
        data: {
          companyId,
          code: item.code,
          name: item.name,
          rank: item.rank,
          status: item.status,
        },
      });
      levelIds.set(item.code, created.id);
    }

    for (const item of sortAreas(plan.areas)) {
      const businessUnitId = item.businessUnitCode
        ? (buIds.get(item.businessUnitCode) ?? null)
        : null;
      const parentAreaId = item.parentAreaCode
        ? (areaIds.get(item.parentAreaCode) ?? null)
        : null;
      if (item.action === 'omit' && item.existingId) {
        areaIds.set(item.code, item.existingId);
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
        areaIds.set(item.code, item.existingId);
        continue;
      }
      const created = await tx.area.create({
        data: {
          companyId,
          code: item.code,
          name: item.name,
          description: item.description,
          status: item.status,
          businessUnitId,
          parentAreaId,
        },
      });
      areaIds.set(item.code, created.id);
    }

    for (const item of plan.positions) {
      const areaId = areaIds.get(item.areaCode);
      if (!areaId) {
        throw new BadRequestException(`No existe el área ${item.areaCode}.`);
      }
      const jobLevelId = item.jobLevelCode
        ? (levelIds.get(item.jobLevelCode) ?? null)
        : null;
      if (item.action === 'omit' && item.existingId) {
        positionIds.set(item.code, item.existingId);
        continue;
      }
      if (item.action === 'update' && item.existingId) {
        await tx.position.update({
          where: { id: item.existingId },
          data: {
            name: item.name,
            areaId,
            jobLevelId,
            headcount: item.headcount,
            status: item.status,
          },
        });
        positionIds.set(item.code, item.existingId);
        continue;
      }
      const created = await tx.position.create({
        data: {
          companyId,
          code: item.code,
          name: item.name,
          areaId,
          jobLevelId,
          headcount: item.headcount,
          status: item.status,
        },
      });
      positionIds.set(item.code, created.id);
    }

    for (const item of plan.employees) {
      const areaId = areaIds.get(item.areaCode);
      const positionId = positionIds.get(item.positionCode);
      if (!areaId || !positionId) {
        throw new BadRequestException(
          `No se pudo resolver área/cargo para ${item.email}.`,
        );
      }
      const businessUnitId = item.businessUnitCode
        ? (buIds.get(item.businessUnitCode) ?? null)
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
  const byCode = new Map(areas.map((area) => [area.code, area]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PlannedArea[] = [];

  function visit(code: string) {
    if (visited.has(code) || !byCode.has(code)) return;
    if (visiting.has(code)) return;
    visiting.add(code);
    const node = byCode.get(code);
    if (node?.parentAreaCode) {
      visit(node.parentAreaCode);
    }
    visiting.delete(code);
    visited.add(code);
    if (node) ordered.push(node);
  }

  for (const area of areas) {
    visit(area.code);
  }
  return ordered;
}
