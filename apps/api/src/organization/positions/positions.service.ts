import { Injectable } from '@nestjs/common';
import { OrganizationEntityStatus, type Position } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { emptyToNull } from '../organization.helpers';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  list(companyId: string): Promise<Position[]> {
    return this.prisma.position.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  getById(companyId: string, id: string): Promise<Position> {
    return this.integrity.requirePosition(companyId, id);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePositionDto,
  ): Promise<Position> {
    await this.integrity.requireArea(companyId, dto.areaId);
    if (dto.jobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
    }

    const created = await this.prisma.position.create({
      data: {
        companyId,
        areaId: dto.areaId,
        jobLevelId: dto.jobLevelId ?? null,
        name: dto.name.trim(),
        code: emptyToNull(dto.code) ?? null,
        mission: emptyToNull(dto.mission) ?? null,
        responsibilities: emptyToNull(dto.responsibilities) ?? null,
        requiredExperience: emptyToNull(dto.requiredExperience) ?? null,
        requiredEducation: emptyToNull(dto.requiredEducation) ?? null,
        headcount: dto.headcount ?? 1,
        status: dto.status ?? OrganizationEntityStatus.ACTIVE,
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.POSITION_CREATED,
      entity: 'Position',
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
    dto: UpdatePositionDto,
  ): Promise<Position> {
    await this.integrity.requirePosition(companyId, id);

    if (dto.areaId) {
      await this.integrity.requireArea(companyId, dto.areaId);
    }
    if (dto.jobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
    }

    const updated = await this.prisma.position.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
        ...(dto.jobLevelId !== undefined ? { jobLevelId: dto.jobLevelId } : {}),
        ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
        ...(dto.mission !== undefined
          ? { mission: emptyToNull(dto.mission) }
          : {}),
        ...(dto.responsibilities !== undefined
          ? { responsibilities: emptyToNull(dto.responsibilities) }
          : {}),
        ...(dto.requiredExperience !== undefined
          ? { requiredExperience: emptyToNull(dto.requiredExperience) }
          : {}),
        ...(dto.requiredEducation !== undefined
          ? { requiredEducation: emptyToNull(dto.requiredEducation) }
          : {}),
        ...(dto.headcount !== undefined ? { headcount: dto.headcount } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.create({
      action: ORG_AUDIT.POSITION_UPDATED,
      entity: 'Position',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: updated.id },
    });

    return updated;
  }
}
