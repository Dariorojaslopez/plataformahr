import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntityStatus,
  PerformanceCycleStatus,
  PerformanceEvaluationModel,
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
  parseOptionalDateOnly,
  parseWeight,
  resolveGoalsCompositionConfig,
  sameUtcDay,
} from '../performance.helpers';
import {
  modelIncludesClient,
  modelIncludesPeer,
  modelIncludesReport,
} from '../evaluation-model';
import { assertQualitativeCompetencyScale } from '../scales/scale-kind';
import type {
  AddCycleCompetencyDto,
  CreatePerformanceCycleDto,
  ListPerformanceCyclesQueryDto,
  UpdateCycleCompetencyDto,
  UpdatePerformanceCycleDto,
} from './dto/cycle.dto';

const CYCLE_INCLUDE = {
  followUps: {
    orderBy: { order: 'asc' as const },
  },
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
        include: { followUps: { orderBy: { order: 'asc' as const } } },
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
    const dates = this.parseCycleWindows(dto);
    const followUps = this.parseFollowUps(dto.followUps);

    assertCycleDates({
      startDate,
      endDate,
      ...dates,
      followUps,
    });

    const evaluationModel =
      dto.evaluationModel ?? PerformanceEvaluationModel.DEGREE_90;
    const selfEvaluationWeight =
      parseEvaluatorWeight(dto.selfEvaluationWeight, 'selfEvaluationWeight') ??
      new Prisma.Decimal(30);
    const managerEvaluationWeight =
      parseEvaluatorWeight(
        dto.managerEvaluationWeight,
        'managerEvaluationWeight',
      ) ?? new Prisma.Decimal(70);
    const extraWeights = this.resolveExtraEvaluatorWeights(
      evaluationModel,
      dto,
      null,
    );
    assertEvaluatorWeights({
      evaluationModel,
      selfEvaluationWeight,
      managerEvaluationWeight,
      ...extraWeights,
    });

    const goalsComposition = resolveGoalsCompositionConfig({
      includeCompetencies: dto.includeCompetencies,
      goalCycleId: dto.goalCycleId,
      competencyResultWeight: dto.competencyResultWeight,
      goalsResultWeight: dto.goalsResultWeight,
      organizationalGoalsWeight: dto.organizationalGoalsWeight,
      individualGoalsWeight: dto.individualGoalsWeight,
      evaluationRange: dto.evaluationRange,
      maxObjectives: dto.maxObjectives,
    });
    if (goalsComposition.goalCycleId) {
      await this.requireGoalCycle(companyId, goalsComposition.goalCycleId);
    }

    const created = await this.prisma.performanceCycle.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: emptyToNull(dto.description) ?? null,
        startDate,
        endDate,
        ...dates,
        evaluationModel,
        selfEvaluationWeight,
        managerEvaluationWeight,
        ...extraWeights,
        includeCompetencies: goalsComposition.includeCompetencies,
        goalCycleId: goalsComposition.goalCycleId,
        competencyResultWeight: goalsComposition.competencyResultWeight,
        goalsResultWeight: goalsComposition.goalsResultWeight,
        organizationalGoalsWeight: goalsComposition.organizationalGoalsWeight,
        individualGoalsWeight: goalsComposition.individualGoalsWeight,
        maxObjectives: goalsComposition.maxObjectives,
        evaluationRange: goalsComposition.evaluationRange,
        status: PerformanceCycleStatus.DRAFT,
        createdByUserId: userId,
        followUps: followUps
          ? {
              create: followUps.map((row) => ({
                companyId,
                order: row.order,
                startDate: row.startDate,
                endDate: row.endDate,
              })),
            }
          : undefined,
      },
      include: { followUps: { orderBy: { order: 'asc' } } },
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

    if (dto.startDate !== undefined) {
      const nextStart = parseDateOnly(dto.startDate, 'startDate');
      if (!sameUtcDay(nextStart, existing.startDate)) {
        throw new BadRequestException(
          'La apertura del ciclo no se puede modificar.',
        );
      }
    }
    const startDate = existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? parseDateOnly(dto.endDate, 'endDate')
        : existing.endDate;

    const dates = this.mergeCycleWindows(dto, existing);
    const followUps =
      dto.followUps !== undefined ? this.parseFollowUps(dto.followUps) : undefined;

    assertCycleDates({
      startDate,
      endDate,
      ...dates,
      followUps:
        followUps ??
        (
          await this.prisma.performanceCycleFollowUp.findMany({
            where: { cycleId: id },
            orderBy: { order: 'asc' },
          })
        ).map((row) => ({ startDate: row.startDate, endDate: row.endDate })),
    });

    const evaluationModel = dto.evaluationModel ?? existing.evaluationModel;
    const selfEvaluationWeight =
      parseEvaluatorWeight(dto.selfEvaluationWeight, 'selfEvaluationWeight') ??
      existing.selfEvaluationWeight;
    const managerEvaluationWeight =
      parseEvaluatorWeight(
        dto.managerEvaluationWeight,
        'managerEvaluationWeight',
      ) ?? existing.managerEvaluationWeight;
    const extraWeights = this.resolveExtraEvaluatorWeights(
      evaluationModel,
      dto,
      existing,
    );
    assertEvaluatorWeights({
      evaluationModel,
      selfEvaluationWeight,
      managerEvaluationWeight,
      ...extraWeights,
    });

    const goalsCompositionTouched =
      dto.goalCycleId !== undefined ||
      dto.competencyResultWeight !== undefined ||
      dto.goalsResultWeight !== undefined ||
      dto.includeCompetencies !== undefined ||
      dto.organizationalGoalsWeight !== undefined ||
      dto.individualGoalsWeight !== undefined ||
      dto.evaluationRange !== undefined ||
      dto.maxObjectives !== undefined;

    let goalsComposition: ReturnType<
      typeof resolveGoalsCompositionConfig
    > | null = null;
    if (goalsCompositionTouched) {
      goalsComposition = resolveGoalsCompositionConfig({
        includeCompetencies:
          dto.includeCompetencies !== undefined
            ? dto.includeCompetencies
            : existing.includeCompetencies,
        goalCycleId:
          dto.goalCycleId !== undefined ? dto.goalCycleId : existing.goalCycleId,
        competencyResultWeight: this.existingOptionalWeight(
          dto.competencyResultWeight,
          existing.competencyResultWeight,
        ),
        goalsResultWeight: this.existingOptionalWeight(
          dto.goalsResultWeight,
          existing.goalsResultWeight,
        ),
        organizationalGoalsWeight: this.existingOptionalWeight(
          dto.organizationalGoalsWeight,
          existing.organizationalGoalsWeight,
        ),
        individualGoalsWeight: this.existingOptionalWeight(
          dto.individualGoalsWeight,
          existing.individualGoalsWeight,
        ),
        evaluationRange:
          dto.evaluationRange !== undefined
            ? dto.evaluationRange
            : existing.evaluationRange,
        maxObjectives:
          dto.maxObjectives !== undefined
            ? dto.maxObjectives
            : existing.maxObjectives,
      });
      if (goalsComposition.goalCycleId) {
        await this.requireGoalCycle(companyId, goalsComposition.goalCycleId);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (followUps) {
        await tx.performanceCycleFollowUp.deleteMany({ where: { cycleId: id } });
        if (followUps.length > 0) {
          await tx.performanceCycleFollowUp.createMany({
            data: followUps.map((row) => ({
              companyId,
              cycleId: id,
              order: row.order,
              startDate: row.startDate,
              endDate: row.endDate,
            })),
          });
        }
      }

      return tx.performanceCycle.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) ?? null }
            : {}),
          evaluationModel,
          selfEvaluationWeight,
          managerEvaluationWeight,
          ...extraWeights,
          endDate,
          ...dates,
          ...(goalsComposition
            ? {
                includeCompetencies: goalsComposition.includeCompetencies,
                goalCycleId: goalsComposition.goalCycleId,
                competencyResultWeight: goalsComposition.competencyResultWeight,
                goalsResultWeight: goalsComposition.goalsResultWeight,
                organizationalGoalsWeight:
                  goalsComposition.organizationalGoalsWeight,
                individualGoalsWeight: goalsComposition.individualGoalsWeight,
                maxObjectives: goalsComposition.maxObjectives,
                evaluationRange: goalsComposition.evaluationRange,
              }
            : {}),
        },
        include: { followUps: { orderBy: { order: 'asc' } } },
      });
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
            kind: true,
            levels: { select: { id: true } },
          },
        },
      },
    });

    if (cycle.includeCompetencies && assignments.length === 0) {
      throw new BadRequestException(
        'No puedes activar un ciclo sin competencias.',
      );
    }

    if (cycle.includeCompetencies) {
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
        assertQualitativeCompetencyScale(row.scale.kind);
      }

      assertActivationWeights(assignments.map((a) => a.weight));
    }

    assertEvaluatorWeights({
      evaluationModel: cycle.evaluationModel,
      selfEvaluationWeight: cycle.selfEvaluationWeight,
      managerEvaluationWeight: cycle.managerEvaluationWeight,
      peerEvaluationWeight: cycle.peerEvaluationWeight,
      reportEvaluationWeight: cycle.reportEvaluationWeight,
      clientEvaluationWeight: cycle.clientEvaluationWeight,
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
    await this.requireActiveQualitativeScale(companyId, dto.scaleId);

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
      await this.requireActiveQualitativeScale(companyId, dto.scaleId);
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

  private async requireActiveQualitativeScale(companyId: string, id: string) {
    const row = await this.requireActiveScale(companyId, id);
    assertQualitativeCompetencyScale(row.kind);
    return row;
  }

  private async requireGoalCycle(companyId: string, goalCycleId: string) {
    const row = await this.prisma.goalCycle.findFirst({
      where: { id: goalCycleId, companyId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Goal cycle not found');
    }
    return row;
  }

  private serializeCycle(
    cycle: PerformanceCycle & {
      followUps?: Array<{
        id: string;
        order: number;
        startDate: Date;
        endDate: Date;
      }>;
    },
  ) {
    return {
      ...cycle,
      evaluationModel: cycle.evaluationModel,
      includeCompetencies: cycle.includeCompetencies,
      evaluationRange: cycle.evaluationRange,
      maxObjectives: cycle.maxObjectives,
      selfEvaluationWeight: decimalToString(cycle.selfEvaluationWeight),
      managerEvaluationWeight: decimalToString(cycle.managerEvaluationWeight),
      peerEvaluationWeight: decimalToString(cycle.peerEvaluationWeight),
      reportEvaluationWeight: decimalToString(cycle.reportEvaluationWeight),
      clientEvaluationWeight: decimalToString(cycle.clientEvaluationWeight),
      competencyResultWeight: decimalToString(cycle.competencyResultWeight),
      goalsResultWeight: decimalToString(cycle.goalsResultWeight),
      organizationalGoalsWeight: decimalToString(
        cycle.organizationalGoalsWeight,
      ),
      individualGoalsWeight: decimalToString(cycle.individualGoalsWeight),
      startDate: this.dateOnly(cycle.startDate),
      endDate: this.dateOnly(cycle.endDate),
      evaluationStartDate: this.dateOnlyOrNull(cycle.evaluationStartDate),
      evaluationEndDate: this.dateOnlyOrNull(cycle.evaluationEndDate),
      goalDefinitionStartDate: this.dateOnlyOrNull(
        cycle.goalDefinitionStartDate,
      ),
      goalDefinitionEndDate: this.dateOnlyOrNull(cycle.goalDefinitionEndDate),
      managerEvaluationStartDate: this.dateOnlyOrNull(
        cycle.managerEvaluationStartDate,
      ),
      managerEvaluationEndDate: this.dateOnlyOrNull(
        cycle.managerEvaluationEndDate,
      ),
      calibrationStartDate: this.dateOnlyOrNull(cycle.calibrationStartDate),
      calibrationEndDate: this.dateOnlyOrNull(cycle.calibrationEndDate),
      closingStartDate: this.dateOnlyOrNull(cycle.closingStartDate),
      closingEndDate: this.dateOnlyOrNull(cycle.closingEndDate),
      followUps: (cycle.followUps ?? []).map((row) => ({
        id: row.id,
        order: row.order,
        startDate: this.dateOnly(row.startDate),
        endDate: this.dateOnly(row.endDate),
      })),
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

  private dateOnlyOrNull(value: Date | null | undefined): string | null {
    return value ? this.dateOnly(value) : null;
  }

  private parseCycleWindows(dto: {
    evaluationStartDate?: string | null;
    evaluationEndDate?: string | null;
    goalDefinitionStartDate?: string | null;
    goalDefinitionEndDate?: string | null;
    managerEvaluationStartDate?: string | null;
    managerEvaluationEndDate?: string | null;
    calibrationStartDate?: string | null;
    calibrationEndDate?: string | null;
    closingStartDate?: string | null;
    closingEndDate?: string | null;
  }) {
    return {
      evaluationStartDate:
        parseOptionalDateOnly(dto.evaluationStartDate, 'evaluationStartDate') ??
        null,
      evaluationEndDate:
        parseOptionalDateOnly(dto.evaluationEndDate, 'evaluationEndDate') ??
        null,
      goalDefinitionStartDate:
        parseOptionalDateOnly(
          dto.goalDefinitionStartDate,
          'goalDefinitionStartDate',
        ) ?? null,
      goalDefinitionEndDate:
        parseOptionalDateOnly(
          dto.goalDefinitionEndDate,
          'goalDefinitionEndDate',
        ) ?? null,
      managerEvaluationStartDate:
        parseOptionalDateOnly(
          dto.managerEvaluationStartDate,
          'managerEvaluationStartDate',
        ) ?? null,
      managerEvaluationEndDate:
        parseOptionalDateOnly(
          dto.managerEvaluationEndDate,
          'managerEvaluationEndDate',
        ) ?? null,
      calibrationStartDate:
        parseOptionalDateOnly(
          dto.calibrationStartDate,
          'calibrationStartDate',
        ) ?? null,
      calibrationEndDate:
        parseOptionalDateOnly(dto.calibrationEndDate, 'calibrationEndDate') ??
        null,
      closingStartDate:
        parseOptionalDateOnly(dto.closingStartDate, 'closingStartDate') ?? null,
      closingEndDate:
        parseOptionalDateOnly(dto.closingEndDate, 'closingEndDate') ?? null,
    };
  }

  private mergeCycleWindows(
    dto: UpdatePerformanceCycleDto,
    existing: PerformanceCycle,
  ) {
    const pick = (
      next: string | null | undefined,
      current: Date | null,
      field: string,
    ): Date | null => {
      if (next === undefined) return current;
      return parseOptionalDateOnly(next, field) ?? null;
    };
    return {
      evaluationStartDate: pick(
        dto.evaluationStartDate,
        existing.evaluationStartDate,
        'evaluationStartDate',
      ),
      evaluationEndDate: pick(
        dto.evaluationEndDate,
        existing.evaluationEndDate,
        'evaluationEndDate',
      ),
      goalDefinitionStartDate: pick(
        dto.goalDefinitionStartDate,
        existing.goalDefinitionStartDate,
        'goalDefinitionStartDate',
      ),
      goalDefinitionEndDate: pick(
        dto.goalDefinitionEndDate,
        existing.goalDefinitionEndDate,
        'goalDefinitionEndDate',
      ),
      managerEvaluationStartDate: pick(
        dto.managerEvaluationStartDate,
        existing.managerEvaluationStartDate,
        'managerEvaluationStartDate',
      ),
      managerEvaluationEndDate: pick(
        dto.managerEvaluationEndDate,
        existing.managerEvaluationEndDate,
        'managerEvaluationEndDate',
      ),
      calibrationStartDate: pick(
        dto.calibrationStartDate,
        existing.calibrationStartDate,
        'calibrationStartDate',
      ),
      calibrationEndDate: pick(
        dto.calibrationEndDate,
        existing.calibrationEndDate,
        'calibrationEndDate',
      ),
      closingStartDate: pick(
        dto.closingStartDate,
        existing.closingStartDate,
        'closingStartDate',
      ),
      closingEndDate: pick(
        dto.closingEndDate,
        existing.closingEndDate,
        'closingEndDate',
      ),
    };
  }

  private parseFollowUps(
    items: Array<{ startDate: string; endDate: string }> | undefined,
  ): Array<{ order: number; startDate: Date; endDate: Date }> | undefined {
    if (items === undefined) return undefined;
    return items.map((item, index) => ({
      order: index,
      startDate: parseDateOnly(item.startDate, `followUps[${index}].startDate`),
      endDate: parseDateOnly(item.endDate, `followUps[${index}].endDate`),
    }));
  }

  private resolveExtraEvaluatorWeights(
    model: PerformanceEvaluationModel,
    dto: {
      peerEvaluationWeight?: number | null;
      reportEvaluationWeight?: number | null;
      clientEvaluationWeight?: number | null;
    },
    existing: PerformanceCycle | null,
  ) {
    const pick = (
      enabled: boolean,
      next: number | null | undefined,
      current: Prisma.Decimal | null | undefined,
      field: string,
    ): Prisma.Decimal | null => {
      if (!enabled) return null;
      if (next !== undefined) {
        return parseEvaluatorWeight(next ?? 0, field) ?? new Prisma.Decimal(0);
      }
      return current ?? new Prisma.Decimal(0);
    };
    return {
      peerEvaluationWeight: pick(
        modelIncludesPeer(model),
        dto.peerEvaluationWeight,
        existing?.peerEvaluationWeight,
        'peerEvaluationWeight',
      ),
      reportEvaluationWeight: pick(
        modelIncludesReport(model),
        dto.reportEvaluationWeight,
        existing?.reportEvaluationWeight,
        'reportEvaluationWeight',
      ),
      clientEvaluationWeight: pick(
        modelIncludesClient(model),
        dto.clientEvaluationWeight,
        existing?.clientEvaluationWeight,
        'clientEvaluationWeight',
      ),
    };
  }

  private existingOptionalWeight(
    dtoValue: number | null | undefined,
    existing: Prisma.Decimal | null,
  ): number | null | undefined {
    if (dtoValue !== undefined) return dtoValue;
    return existing == null ? undefined : Number(existing.toString());
  }
}
