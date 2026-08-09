import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntityStatus,
  PerformanceCycleStatus,
  PerformanceParticipantStatus,
  Prisma,
  type PerformanceCycle,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isCycleMetadataEditable,
  isCycleStructurallyEditable,
} from '../cycle-transitions';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MIN_SCALE_LEVELS_FOR_ACTIVATION,
  PERFORMANCE_AUDIT,
} from '../performance.constants';
import {
  assertActivationWeights,
  assertCycleDates,
  assertEvaluatorWeights,
  decimalToString,
  emptyToNull,
  parseDateOnly,
  parseEvaluatorWeight,
  parseWeight,
} from '../performance.helpers';
import type {
  AddCycleCompetencyDto,
  CreatePerformanceCycleDto,
  ListPerformanceCyclesQueryDto,
  UpdateCycleCompetencyDto,
  UpdatePerformanceCycleDto,
} from './dto/cycle.dto';

const CYCLE_INCLUDE = {
  competencies: {
    include: {
      competency: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
      },
      scale: {
        select: {
          id: true,
          name: true,
          status: true,
          levels: {
            select: { id: true, value: true, label: true, order: true },
            orderBy: { order: 'asc' as const },
          },
        },
      },
    },
    orderBy: { order: 'asc' as const },
  },
} as const;

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListPerformanceCyclesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.PerformanceCycleWhereInput = {
      companyId,
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
      this.prisma.performanceCycle.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.performanceCycle.count({ where }),
    ]);

    return {
      items: items.map((c) => this.serializeCycle(c)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id, companyId },
      include: CYCLE_INCLUDE,
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }
    return this.serializeCycleDetail(cycle);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePerformanceCycleDto,
  ) {
    const startDate = parseDateOnly(dto.startDate, 'startDate');
    const endDate = parseDateOnly(dto.endDate, 'endDate');
    const evaluationStartDate = dto.evaluationStartDate
      ? parseDateOnly(dto.evaluationStartDate, 'evaluationStartDate')
      : null;
    const evaluationEndDate = dto.evaluationEndDate
      ? parseDateOnly(dto.evaluationEndDate, 'evaluationEndDate')
      : null;

    assertCycleDates({
      startDate,
      endDate,
      evaluationStartDate,
      evaluationEndDate,
    });

    const selfEvaluationWeight =
      parseEvaluatorWeight(dto.selfEvaluationWeight, 'selfEvaluationWeight') ??
      new Prisma.Decimal(30);
    const managerEvaluationWeight =
      parseEvaluatorWeight(
        dto.managerEvaluationWeight,
        'managerEvaluationWeight',
      ) ?? new Prisma.Decimal(70);
    assertEvaluatorWeights({ selfEvaluationWeight, managerEvaluationWeight });

    const created = await this.prisma.performanceCycle.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: emptyToNull(dto.description) ?? null,
        startDate,
        endDate,
        evaluationStartDate,
        evaluationEndDate,
        selfEvaluationWeight,
        managerEvaluationWeight,
        status: PerformanceCycleStatus.DRAFT,
        createdByUserId: userId,
      },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_CREATED,
      entity: 'PerformanceCycle',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: created.id },
    });

    return this.serializeCycle(created);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdatePerformanceCycleDto,
  ) {
    const existing = await this.requireCycle(companyId, id);
    if (!isCycleMetadataEditable(existing.status)) {
      throw new BadRequestException('El ciclo ya no puede modificarse.');
    }

    const startDate =
      dto.startDate !== undefined
        ? parseDateOnly(dto.startDate, 'startDate')
        : existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? parseDateOnly(dto.endDate, 'endDate')
        : existing.endDate;

    let evaluationStartDate = existing.evaluationStartDate;
    let evaluationEndDate = existing.evaluationEndDate;
    if (dto.evaluationStartDate !== undefined) {
      evaluationStartDate =
        dto.evaluationStartDate === null
          ? null
          : parseDateOnly(dto.evaluationStartDate, 'evaluationStartDate');
    }
    if (dto.evaluationEndDate !== undefined) {
      evaluationEndDate =
        dto.evaluationEndDate === null
          ? null
          : parseDateOnly(dto.evaluationEndDate, 'evaluationEndDate');
    }

    assertCycleDates({
      startDate,
      endDate,
      evaluationStartDate,
      evaluationEndDate,
    });

    const selfEvaluationWeight =
      parseEvaluatorWeight(dto.selfEvaluationWeight, 'selfEvaluationWeight') ??
      existing.selfEvaluationWeight;
    const managerEvaluationWeight =
      parseEvaluatorWeight(
        dto.managerEvaluationWeight,
        'managerEvaluationWeight',
      ) ?? existing.managerEvaluationWeight;
    assertEvaluatorWeights({ selfEvaluationWeight, managerEvaluationWeight });

    const updated = await this.prisma.performanceCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: emptyToNull(dto.description) ?? null }
          : {}),
        selfEvaluationWeight,
        managerEvaluationWeight,
        startDate,
        endDate,
        evaluationStartDate,
        evaluationEndDate,
      },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_UPDATED,
      entity: 'PerformanceCycle',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id: updated.id },
    });

    return this.serializeCycle(updated);
  }

  async activate(companyId: string, userId: string, id: string) {
    const cycle = await this.requireCycle(companyId, id);
    if (cycle.status !== PerformanceCycleStatus.DRAFT) {
      throw new BadRequestException('Solo un ciclo en DRAFT puede activarse');
    }

    const assignments = await this.prisma.performanceCycleCompetency.findMany({
      where: { companyId, cycleId: id },
      include: {
        competency: { select: { id: true, status: true, deletedAt: true } },
        scale: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            levels: { select: { id: true } },
          },
        },
      },
    });

    if (assignments.length === 0) {
      throw new BadRequestException(
        'No puedes activar un ciclo sin competencias.',
      );
    }

    for (const row of assignments) {
      if (
        row.competency.deletedAt ||
        row.competency.status !== OrganizationEntityStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Todas las competencias del ciclo deben estar ACTIVE',
        );
      }
      if (
        row.scale.deletedAt ||
        row.scale.status !== OrganizationEntityStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Cada competencia del ciclo debe tener una escala ACTIVE válida',
        );
      }
      if (row.scale.levels.length < MIN_SCALE_LEVELS_FOR_ACTIVATION) {
        throw new BadRequestException(
          'La escala debe tener al menos dos niveles.',
        );
      }
    }

    assertActivationWeights(assignments.map((a) => a.weight));
    assertEvaluatorWeights({
      selfEvaluationWeight: cycle.selfEvaluationWeight,
      managerEvaluationWeight: cycle.managerEvaluationWeight,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.performanceCycle.updateMany({
        where: {
          id,
          companyId,
          status: PerformanceCycleStatus.DRAFT,
        },
        data: { status: PerformanceCycleStatus.ACTIVE },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Cycle status changed concurrently; retry');
      }
      return tx.performanceCycle.findFirstOrThrow({
        where: { id, companyId },
        include: CYCLE_INCLUDE,
      });
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_ACTIVATED,
      entity: 'PerformanceCycle',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id, from: 'DRAFT', to: 'ACTIVE' },
    });

    return this.serializeCycleDetail(result);
  }

  async close(companyId: string, userId: string, id: string) {
    await this.requireCycle(companyId, id);
    const activeParticipants =
      await this.prisma.performanceCycleParticipant.count({
        where: {
          companyId,
          cycleId: id,
          status: PerformanceParticipantStatus.ACTIVE,
        },
      });
    if (activeParticipants > 0) {
      throw new BadRequestException(
        `Cannot close cycle while ${activeParticipants} participant(s) are still ACTIVE. Calculate results or exclude them first.`,
      );
    }

    return this.transitionStatus(
      companyId,
      userId,
      id,
      PerformanceCycleStatus.ACTIVE,
      PerformanceCycleStatus.CLOSED,
      PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_CLOSED,
    );
  }

  async cancel(companyId: string, userId: string, id: string) {
    const cycle = await this.requireCycle(companyId, id);
    if (
      cycle.status !== PerformanceCycleStatus.DRAFT &&
      cycle.status !== PerformanceCycleStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Solo ciclos DRAFT o ACTIVE pueden cancelarse',
      );
    }

    const from = cycle.status;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.performanceCycle.updateMany({
        where: { id, companyId, status: from },
        data: { status: PerformanceCycleStatus.CANCELLED },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Cycle status changed concurrently; retry');
      }
      return tx.performanceCycle.findFirstOrThrow({
        where: { id, companyId },
        include: CYCLE_INCLUDE,
      });
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_CANCELLED,
      entity: 'PerformanceCycle',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id, from, to: 'CANCELLED' },
    });

    return this.serializeCycleDetail(result);
  }

  async listCompetencies(companyId: string, cycleId: string) {
    await this.requireCycle(companyId, cycleId);
    const rows = await this.prisma.performanceCycleCompetency.findMany({
      where: { companyId, cycleId },
      include: CYCLE_INCLUDE.competencies.include,
      orderBy: { order: 'asc' },
    });
    return rows.map((r) => this.serializeAssignment(r));
  }

  async addCompetency(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: AddCycleCompetencyDto,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (!isCycleStructurallyEditable(cycle.status)) {
      throw new BadRequestException('El ciclo ya no puede modificarse.');
    }

    await this.requireActiveCompetency(companyId, dto.competencyId);
    await this.requireActiveScale(companyId, dto.scaleId);

    const weight = parseWeight(dto.weight ?? null);
    try {
      const created = await this.prisma.performanceCycleCompetency.create({
        data: {
          companyId,
          cycleId,
          competencyId: dto.competencyId,
          scaleId: dto.scaleId,
          weight: weight ?? null,
          order: dto.order ?? 0,
          required: dto.required ?? true,
        },
        include: CYCLE_INCLUDE.competencies.include,
      });

      await this.audit.create({
        action: PERFORMANCE_AUDIT.CYCLE_COMPETENCY_ADDED,
        entity: 'PerformanceCycleCompetency',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id: created.id,
          cycleId,
          competencyId: dto.competencyId,
          scaleId: dto.scaleId,
        },
      });

      return this.serializeAssignment(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Competency already configured on this cycle',
        );
      }
      throw error;
    }
  }

  async updateCompetency(
    companyId: string,
    userId: string,
    cycleId: string,
    competencyId: string,
    dto: UpdateCycleCompetencyDto,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (!isCycleStructurallyEditable(cycle.status)) {
      throw new BadRequestException('El ciclo ya no puede modificarse.');
    }

    const existing = await this.prisma.performanceCycleCompetency.findFirst({
      where: { companyId, cycleId, competencyId },
    });
    if (!existing) {
      throw new NotFoundException('Cycle competency not found');
    }

    if (dto.scaleId !== undefined) {
      await this.requireActiveScale(companyId, dto.scaleId);
    }

    const weight =
      dto.weight !== undefined ? parseWeight(dto.weight) : undefined;

    const updated = await this.prisma.performanceCycleCompetency.update({
      where: { id: existing.id },
      data: {
        ...(dto.scaleId !== undefined ? { scaleId: dto.scaleId } : {}),
        ...(weight !== undefined ? { weight } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
      },
      include: CYCLE_INCLUDE.competencies.include,
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CYCLE_COMPETENCY_UPDATED,
      entity: 'PerformanceCycleCompetency',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id: updated.id,
        cycleId,
        competencyId,
      },
    });

    return this.serializeAssignment(updated);
  }

  async removeCompetency(
    companyId: string,
    userId: string,
    cycleId: string,
    competencyId: string,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (!isCycleStructurallyEditable(cycle.status)) {
      throw new BadRequestException('El ciclo ya no puede modificarse.');
    }

    const existing = await this.prisma.performanceCycleCompetency.findFirst({
      where: { companyId, cycleId, competencyId },
    });
    if (!existing) {
      throw new NotFoundException('Cycle competency not found');
    }

    await this.prisma.performanceCycleCompetency.delete({
      where: { id: existing.id },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CYCLE_COMPETENCY_REMOVED,
      entity: 'PerformanceCycleCompetency',
      entityId: existing.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id: existing.id,
        cycleId,
        competencyId,
      },
    });

    return { success: true };
  }

  private async transitionStatus(
    companyId: string,
    userId: string,
    id: string,
    from: PerformanceCycleStatus,
    to: PerformanceCycleStatus,
    auditAction: string,
  ) {
    const cycle = await this.requireCycle(companyId, id);
    if (cycle.status !== from) {
      throw new BadRequestException(
        `Cycle must be ${from} to transition to ${to}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.performanceCycle.updateMany({
        where: { id, companyId, status: from },
        data: { status: to },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Cycle status changed concurrently; retry');
      }
      return tx.performanceCycle.findFirstOrThrow({
        where: { id, companyId },
        include: CYCLE_INCLUDE,
      });
    });

    await this.audit.create({
      action: auditAction,
      entity: 'PerformanceCycle',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { id, from, to },
    });

    return this.serializeCycleDetail(result);
  }

  private async requireCycle(companyId: string, id: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }
    return cycle;
  }

  private async requireActiveCompetency(companyId: string, id: string) {
    const row = await this.prisma.competency.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
        status: OrganizationEntityStatus.ACTIVE,
      },
    });
    if (!row) {
      throw new NotFoundException('Competency not found');
    }
    return row;
  }

  private async requireActiveScale(companyId: string, id: string) {
    const row = await this.prisma.competencyScale.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
        status: OrganizationEntityStatus.ACTIVE,
      },
    });
    if (!row) {
      throw new NotFoundException('Competency scale not found');
    }
    return row;
  }

  private serializeCycle(cycle: PerformanceCycle) {
    return {
      ...cycle,
      selfEvaluationWeight: decimalToString(cycle.selfEvaluationWeight),
      managerEvaluationWeight: decimalToString(cycle.managerEvaluationWeight),
      startDate: this.dateOnly(cycle.startDate),
      endDate: this.dateOnly(cycle.endDate),
      evaluationStartDate: cycle.evaluationStartDate
        ? this.dateOnly(cycle.evaluationStartDate)
        : null,
      evaluationEndDate: cycle.evaluationEndDate
        ? this.dateOnly(cycle.evaluationEndDate)
        : null,
    };
  }

  private serializeCycleDetail(
    cycle: PerformanceCycle & {
      competencies: Array<{
        id: string;
        companyId: string;
        cycleId: string;
        competencyId: string;
        scaleId: string;
        weight: Prisma.Decimal | null;
        order: number;
        required: boolean;
        createdAt: Date;
        updatedAt: Date;
        competency: {
          id: string;
          name: string;
          code: string | null;
          status: OrganizationEntityStatus;
        };
        scale: {
          id: string;
          name: string;
          status: OrganizationEntityStatus;
          levels: Array<{
            id: string;
            value: number;
            label: string;
            order: number;
          }>;
        };
      }>;
    },
  ) {
    return {
      ...this.serializeCycle(cycle),
      competencies: cycle.competencies.map((c) => this.serializeAssignment(c)),
    };
  }

  private serializeAssignment(row: {
    id: string;
    companyId: string;
    cycleId: string;
    competencyId: string;
    scaleId: string;
    weight: Prisma.Decimal | null;
    order: number;
    required: boolean;
    createdAt: Date;
    updatedAt: Date;
    competency?: {
      id: string;
      name: string;
      code: string | null;
      status: OrganizationEntityStatus;
    };
    scale?: {
      id: string;
      name: string;
      status: OrganizationEntityStatus;
      levels?: Array<{
        id: string;
        value: number;
        label: string;
        order: number;
      }>;
    };
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      cycleId: row.cycleId,
      competencyId: row.competencyId,
      scaleId: row.scaleId,
      weight: decimalToString(row.weight),
      order: row.order,
      required: row.required,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      competency: row.competency,
      scale: row.scale,
    };
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
