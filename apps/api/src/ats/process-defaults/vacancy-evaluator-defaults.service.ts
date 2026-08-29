import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { TenantContext } from '../../auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { PositionOccupantsService } from '../position-occupants/position-occupants.service';
import type { ReplacePositionOccupantStepsDto } from './dto/position-occupant-step.dto';

const EVALUATOR_INCLUDE = {
  position: { select: { id: true, name: true } },
  employee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class VacancyEvaluatorDefaultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly occupants: PositionOccupantsService,
  ) {}

  async get(companyId: string) {
    const steps = await this.prisma.vacancyEvaluatorDefault.findMany({
      where: { companyId },
      orderBy: { sequence: 'asc' },
      include: EVALUATOR_INCLUDE,
    });
    return { steps };
  }

  async update(tenant: TenantContext, dto: ReplacePositionOccupantStepsDto) {
    const normalized: Prisma.VacancyEvaluatorDefaultCreateManyInput[] = [];
    for (const [index, step] of dto.steps.entries()) {
      const occupant = await this.occupants.resolve(
        tenant.companyId,
        step.positionId,
        step.employeeId,
      );
      normalized.push({
        companyId: tenant.companyId,
        sequence: index + 1,
        positionId: step.positionId,
        employeeId: occupant.id,
        updatedAt: new Date(),
      });
    }

    const steps = await this.prisma.$transaction(async (tx) => {
      await tx.vacancyEvaluatorDefault.deleteMany({
        where: { companyId: tenant.companyId },
      });
      if (normalized.length > 0) {
        await tx.vacancyEvaluatorDefault.createMany({ data: normalized });
      }
      return tx.vacancyEvaluatorDefault.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { sequence: 'asc' },
        include: EVALUATOR_INCLUDE,
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.VACANCY_EVALUATOR_DEFAULTS_UPDATED,
      entity: 'VacancyEvaluatorDefault',
      entityId: tenant.companyId,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { stepCount: steps.length },
    });

    return { steps };
  }

  async buildSnapshot(companyId: string, vacancyRequestId: string) {
    const defaults = await this.prisma.vacancyEvaluatorDefault.findMany({
      where: { companyId },
      orderBy: { sequence: 'asc' },
    });
    const rows: Prisma.VacancyRequestEvaluatorCreateManyInput[] = [];
    for (const step of defaults) {
      const occupant = await this.occupants.resolve(
        companyId,
        step.positionId,
        step.employeeId,
      );
      rows.push({
        companyId,
        vacancyRequestId,
        sequence: step.sequence,
        positionId: step.positionId,
        employeeId: occupant.id,
        updatedAt: new Date(),
      });
    }
    return rows;
  }
}
