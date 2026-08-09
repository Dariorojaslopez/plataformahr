import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntityStatus,
  PerformanceCycleStatus,
  Prisma,
  type CompetencyScale,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PERFORMANCE_AUDIT,
} from '../performance.constants';
import { emptyToNull } from '../performance.helpers';
import type {
  CreateCompetencyScaleDto,
  CreateScaleLevelDto,
  ListScalesQueryDto,
  UpdateCompetencyScaleDto,
  UpdateScaleLevelDto,
} from './dto/scale.dto';

const SCALE_INCLUDE = {
  levels: {
    orderBy: { order: 'asc' as const },
  },
} as const;

@Injectable()
export class ScalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListScalesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.CompetencyScaleWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.competencyScale.findMany({
        where,
        include: {
          levels: {
            select: { id: true },
          },
          _count: { select: { levels: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.competencyScale.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        companyId: item.companyId,
        name: item.name,
        description: item.description,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        deletedAt: item.deletedAt,
        levelCount: item._count.levels,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string) {
    const row = await this.prisma.competencyScale.findFirst({
      where: { id, companyId, deletedAt: null },
      include: SCALE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Competency scale not found');
    }
    return row;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateCompetencyScaleDto,
  ) {
    try {
      const created = await this.prisma.competencyScale.create({
        data: {
          companyId,
          name: dto.name.trim(),
          description: emptyToNull(dto.description) ?? null,
          status: dto.status ?? OrganizationEntityStatus.ACTIVE,
        },
        include: SCALE_INCLUDE,
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_SCALE_CREATED,
        entity: 'CompetencyScale',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: created.id },
      });

      return created;
    } catch (error) {
      this.rethrowScaleUnique(error);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateCompetencyScaleDto,
  ) {
    await this.requireScale(companyId, id);

    try {
      const updated = await this.prisma.competencyScale.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: SCALE_INCLUDE,
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_SCALE_UPDATED,
        entity: 'CompetencyScale',
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: updated.id },
      });

      return updated;
    } catch (error) {
      this.rethrowScaleUnique(error);
    }
  }

  async addLevel(
    companyId: string,
    userId: string,
    scaleId: string,
    dto: CreateScaleLevelDto,
  ) {
    await this.requireScale(companyId, scaleId);

    try {
      const created = await this.prisma.competencyScaleLevel.create({
        data: {
          companyId,
          scaleId,
          value: dto.value,
          label: dto.label.trim(),
          description: emptyToNull(dto.description) ?? null,
          order: dto.order,
        },
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_SCALE_LEVEL_CREATED,
        entity: 'CompetencyScaleLevel',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: created.id, scaleId },
      });

      return created;
    } catch (error) {
      this.rethrowLevelUnique(error);
    }
  }

  async updateLevel(
    companyId: string,
    userId: string,
    scaleId: string,
    levelId: string,
    dto: UpdateScaleLevelDto,
  ) {
    await this.requireScale(companyId, scaleId);
    const existing = await this.prisma.competencyScaleLevel.findFirst({
      where: { id: levelId, scaleId, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Scale level not found');
    }

    try {
      const updated = await this.prisma.competencyScaleLevel.update({
        where: { id: levelId },
        data: {
          ...(dto.value !== undefined ? { value: dto.value } : {}),
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) }
            : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_SCALE_LEVEL_UPDATED,
        entity: 'CompetencyScaleLevel',
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: updated.id, scaleId },
      });

      return updated;
    } catch (error) {
      this.rethrowLevelUnique(error);
    }
  }

  /**
   * Delete level only when the scale is not referenced by ACTIVE/CLOSED cycles.
   */
  async removeLevel(
    companyId: string,
    userId: string,
    scaleId: string,
    levelId: string,
  ) {
    await this.requireScale(companyId, scaleId);
    const existing = await this.prisma.competencyScaleLevel.findFirst({
      where: { id: levelId, scaleId, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Scale level not found');
    }

    const locked = await this.prisma.performanceCycleCompetency.count({
      where: {
        companyId,
        scaleId,
        cycle: {
          status: {
            in: [PerformanceCycleStatus.ACTIVE, PerformanceCycleStatus.CLOSED],
          },
        },
      },
    });
    if (locked > 0) {
      throw new BadRequestException(
        'No se puede eliminar un nivel de una escala usada en ciclos ACTIVE o CLOSED',
      );
    }

    await this.prisma.competencyScaleLevel.delete({ where: { id: levelId } });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.COMPETENCY_SCALE_LEVEL_REMOVED,
      entity: 'CompetencyScaleLevel',
      entityId: levelId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: levelId, scaleId },
    });

    return { success: true };
  }

  private async requireScale(
    companyId: string,
    id: string,
  ): Promise<CompetencyScale> {
    const row = await this.prisma.competencyScale.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Competency scale not found');
    }
    return row;
  }

  private rethrowScaleUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Scale name already exists in this company');
    }
    throw error;
  }

  private rethrowLevelUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Scale level value or order already exists on this scale',
      );
    }
    throw error;
  }
}
