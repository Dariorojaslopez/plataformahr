import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { TenantContext } from '../../auth/auth.types';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ATS_AUDIT } from '../ats.constants';
import { PositionOccupantsService } from '../position-occupants/position-occupants.service';
import type { ReplacePositionOccupantStepsDto } from './dto/position-occupant-step.dto';

const APPROVER_INCLUDE = {
  position: { select: { id: true, name: true } },
  employee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class ContractTemplateApproversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly occupants: PositionOccupantsService,
  ) {}

  async get(companyId: string) {
    const steps = await this.prisma.contractTemplateApprover.findMany({
      where: { companyId },
      orderBy: { sequence: 'asc' },
      include: APPROVER_INCLUDE,
    });
    return { steps };
  }

  async update(tenant: TenantContext, dto: ReplacePositionOccupantStepsDto) {
    const normalized: Prisma.ContractTemplateApproverCreateManyInput[] = [];
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
      await tx.contractTemplateApprover.deleteMany({
        where: { companyId: tenant.companyId },
      });
      if (normalized.length > 0) {
        await tx.contractTemplateApprover.createMany({ data: normalized });
      }
      return tx.contractTemplateApprover.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { sequence: 'asc' },
        include: APPROVER_INCLUDE,
      });
    });

    await this.audit.create({
      action: ATS_AUDIT.CONTRACT_TEMPLATE_APPROVERS_UPDATED,
      entity: 'ContractTemplateApprover',
      entityId: tenant.companyId,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { stepCount: steps.length },
    });

    return { steps };
  }
}
