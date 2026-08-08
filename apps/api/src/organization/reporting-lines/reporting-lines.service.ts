import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportingLineType, type EmployeeReportingLine } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import {
  assertNoCycle,
  wouldCreateReportingCycle,
} from '../organization.helpers';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreateReportingLineDto } from './dto/reporting-line.dto';

@Injectable()
export class ReportingLinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  async listForEmployee(companyId: string, employeeId: string) {
    await this.integrity.requireEmployee(companyId, employeeId);
    return this.prisma.employeeReportingLine.findMany({
      where: { companyId, employeeId },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    companyId: string,
    actorUserId: string,
    employeeId: string,
    dto: CreateReportingLineDto,
  ): Promise<EmployeeReportingLine> {
    await this.integrity.requireEmployee(companyId, employeeId);
    await this.integrity.requireEmployee(companyId, dto.managerEmployeeId);

    if (employeeId === dto.managerEmployeeId) {
      throw new BadRequestException('Employee cannot report to themselves');
    }

    if (dto.type === ReportingLineType.DIRECT) {
      const existingDirect = await this.prisma.employeeReportingLine.findFirst({
        where: {
          companyId,
          employeeId,
          type: ReportingLineType.DIRECT,
        },
      });
      if (existingDirect) {
        throw new ConflictException('Employee already has a direct manager');
      }
    }

    await this.assertNoReportingCycle(
      companyId,
      employeeId,
      dto.managerEmployeeId,
    );

    try {
      const created = await this.prisma.employeeReportingLine.create({
        data: {
          companyId,
          employeeId,
          managerEmployeeId: dto.managerEmployeeId,
          type: dto.type,
        },
      });

      await this.audit.create({
        action: ORG_AUDIT.REPORTING_LINE_CREATED,
        entity: 'EmployeeReportingLine',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: actorUserId } },
        metadata: {
          id: created.id,
          employeeId,
          managerEmployeeId: dto.managerEmployeeId,
          type: dto.type,
        },
      });

      return created;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Reporting line already exists');
      }
      throw error;
    }
  }

  async remove(
    companyId: string,
    actorUserId: string,
    employeeId: string,
    reportingLineId: string,
  ): Promise<void> {
    await this.integrity.requireEmployee(companyId, employeeId);

    const line = await this.prisma.employeeReportingLine.findFirst({
      where: {
        id: reportingLineId,
        companyId,
        employeeId,
      },
    });
    if (!line) {
      throw new NotFoundException('Reporting line not found');
    }

    await this.prisma.employeeReportingLine.delete({
      where: { id: reportingLineId },
    });

    await this.audit.create({
      action: ORG_AUDIT.REPORTING_LINE_REMOVED,
      entity: 'EmployeeReportingLine',
      entityId: reportingLineId,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        id: reportingLineId,
        employeeId,
        managerEmployeeId: line.managerEmployeeId,
        type: line.type,
      },
    });
  }

  private async assertNoReportingCycle(
    companyId: string,
    employeeId: string,
    managerEmployeeId: string,
  ): Promise<void> {
    const lines = await this.prisma.employeeReportingLine.findMany({
      where: { companyId },
      select: {
        employeeId: true,
        managerEmployeeId: true,
      },
    });

    const reportsToByEmployee = new Map<string, string[]>();
    for (const line of lines) {
      const current = reportsToByEmployee.get(line.employeeId) ?? [];
      current.push(line.managerEmployeeId);
      reportsToByEmployee.set(line.employeeId, current);
    }

    assertNoCycle(
      wouldCreateReportingCycle(
        employeeId,
        managerEmployeeId,
        reportsToByEmployee,
      ),
      'Reporting line cycle detected',
    );
  }
}
