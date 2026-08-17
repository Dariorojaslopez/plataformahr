import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationEntityStatus, type BusinessUnit } from '@prisma/client';
import { withDuplicateCompanyCodeConflict } from '../../common/prisma/duplicate-company-code';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { emptyToNull } from '../organization.helpers';
import type {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from './dto/business-unit.dto';

@Injectable()
export class BusinessUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string): Promise<BusinessUnit[]> {
    return this.prisma.businessUnit.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateBusinessUnitDto,
  ): Promise<BusinessUnit> {
    const created = await withDuplicateCompanyCodeConflict(dto.code, () =>
      this.prisma.businessUnit.create({
        data: {
          companyId,
          name: dto.name.trim(),
          code: emptyToNull(dto.code) ?? null,
          description: emptyToNull(dto.description) ?? null,
          status: dto.status ?? OrganizationEntityStatus.ACTIVE,
        },
      }),
    );

    await this.audit.create({
      action: ORG_AUDIT.BUSINESS_UNIT_CREATED,
      entity: 'BusinessUnit',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: created.id },
    });

    return created;
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateBusinessUnitDto,
  ): Promise<BusinessUnit> {
    await this.requireInCompany(companyId, id);

    const updated = await withDuplicateCompanyCodeConflict(dto.code, () =>
      this.prisma.businessUnit.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      }),
    );

    await this.audit.create({
      action: ORG_AUDIT.BUSINESS_UNIT_UPDATED,
      entity: 'BusinessUnit',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: updated.id },
    });

    return updated;
  }

  private async requireInCompany(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.businessUnit.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Business unit not found');
    }
  }
}
