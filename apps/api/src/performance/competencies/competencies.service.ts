import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntityStatus,
  Prisma,
  type Competency,
} from '@prisma/client';
import { duplicateCompanyCodeMessage } from '../../common/prisma/duplicate-company-code';
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
  CreateCompetencyDto,
  ListCompetenciesQueryDto,
  UpdateCompetencyDto,
} from './dto/competency.dto';

const COMPETENCY_INCLUDE = {
  defaultScale: {
    select: { id: true, name: true, status: true },
  },
} as const;

@Injectable()
export class CompetenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListCompetenciesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.CompetencyWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.competency.findMany({
        where,
        include: COMPETENCY_INCLUDE,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.competency.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string) {
    const row = await this.prisma.competency.findFirst({
      where: { id, companyId, deletedAt: null },
      include: COMPETENCY_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Competency not found');
    }
    return row;
  }

  async create(companyId: string, userId: string, dto: CreateCompetencyDto) {
    if (dto.defaultScaleId) {
      await this.requireScale(companyId, dto.defaultScaleId);
    }

    try {
      const created = await this.prisma.competency.create({
        data: {
          companyId,
          name: dto.name.trim(),
          code: emptyToNull(dto.code) ?? null,
          description: emptyToNull(dto.description) ?? null,
          status: dto.status ?? OrganizationEntityStatus.ACTIVE,
          defaultScaleId: dto.defaultScaleId ?? null,
        },
        include: COMPETENCY_INCLUDE,
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_CREATED,
        entity: 'Competency',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: created.id },
      });

      return created;
    } catch (error) {
      this.rethrowUnique(error, dto.code);
    }
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateCompetencyDto,
  ) {
    await this.requireCompetency(companyId, id);

    if (dto.defaultScaleId) {
      await this.requireScale(companyId, dto.defaultScaleId);
    }

    try {
      const updated = await this.prisma.competency.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.defaultScaleId !== undefined
            ? { defaultScaleId: dto.defaultScaleId }
            : {}),
        },
        include: COMPETENCY_INCLUDE,
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.COMPETENCY_UPDATED,
        entity: 'Competency',
        entityId: updated.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: updated.id },
      });

      return updated;
    } catch (error) {
      this.rethrowUnique(error, dto.code);
    }
  }

  private async requireCompetency(
    companyId: string,
    id: string,
  ): Promise<Competency> {
    const row = await this.prisma.competency.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Competency not found');
    }
    return row;
  }

  private async requireScale(companyId: string, id: string) {
    const row = await this.prisma.competencyScale.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Competency scale not found');
    }
    return row;
  }

  private rethrowUnique(error: unknown, attemptedCode?: string | null): never {
    const codeMessage = duplicateCompanyCodeMessage(error, attemptedCode);
    if (codeMessage) {
      throw new ConflictException(codeMessage);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Competency name or code already exists in this company',
      );
    }
    throw error;
  }
}
