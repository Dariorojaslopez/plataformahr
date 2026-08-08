import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationEntityStatus, type JobLevel } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { emptyToNull } from '../organization.helpers';
import type { CreateJobLevelDto, UpdateJobLevelDto } from './dto/job-level.dto';

@Injectable()
export class JobLevelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string): Promise<JobLevel[]> {
    return this.prisma.jobLevel.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { rank: 'asc' },
    });
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateJobLevelDto,
  ): Promise<JobLevel> {
    const created = await this.prisma.jobLevel.create({
      data: {
        companyId,
        name: dto.name.trim(),
        code: emptyToNull(dto.code) ?? null,
        rank: dto.rank,
        status: dto.status ?? OrganizationEntityStatus.ACTIVE,
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.JOB_LEVEL_CREATED,
      entity: 'JobLevel',
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
    dto: UpdateJobLevelDto,
  ): Promise<JobLevel> {
    const existing = await this.prisma.jobLevel.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Job level not found');
    }

    const updated = await this.prisma.jobLevel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
        ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.JOB_LEVEL_UPDATED,
      entity: 'JobLevel',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: updated.id },
    });

    return updated;
  }
}
