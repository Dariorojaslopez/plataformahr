import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalCompletionRequestStatus,
  GoalCycleStatus,
  GoalMetricDirection,
  GoalMetricType,
  GoalStatus,
  GoalType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GoalCompletionService } from '../completion/completion.service';
import { isGoalStructurallyEditable } from '../goal-transitions';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  GOALS_AUDIT,
  MAX_LIMIT,
} from '../goals.constants';
import {
  assertGoalActivationReady,
  assertGoalTypeShape,
  assertMetricPayload,
  decimalToString,
  emptyToNull,
  parseOptionalWeight,
} from '../goals.helpers';
import { GoalProgressService } from '../progress/progress.service';
import type {
  CreateAssignmentDto,
  CreateGoalDto,
  CreateKeyResultDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
  UpdateKeyResultDto,
} from './dto/goal.dto';

const GOAL_DETAIL_INCLUDE = {
  cycle: {
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  },
  area: { select: { id: true, name: true } },
  keyResults: { orderBy: { order: 'asc' as const } },
  assignments: {
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          areaId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly progressService: GoalProgressService,
    private readonly completionService: GoalCompletionService,
  ) {}

  async list(companyId: string, query: ListGoalsQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.GoalWhereInput = {
      companyId,
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.employeeId
        ? { assignments: { some: { employeeId: query.employeeId } } }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        include: {
          cycle: { select: { id: true, name: true, status: true } },
          area: { select: { id: true, name: true } },
          assignments: {
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            take: 5,
          },
          _count: { select: { keyResults: true, assignments: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.goal.count({ where }),
    ]);

    return {
      items: items.map((g) => ({
        id: g.id,
        companyId: g.companyId,
        cycleId: g.cycleId,
        title: g.title,
        description: g.description,
        type: g.type,
        status: g.status,
        areaId: g.areaId,
        weight: decimalToString(g.weight),
        cycle: g.cycle,
        area: g.area,
        assignees: g.assignments.map((a) => a.employee),
        keyResultCount: g._count.keyResults,
        assignmentCount: g._count.assignments,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(
    companyId: string,
    userId: string,
    membershipId: string,
    id: string,
  ) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, companyId },
      include: GOAL_DETAIL_INCLUDE,
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const allowed = await this.progressService.canAccessGoalAsLeaderOrMine(
      companyId,
      userId,
      membershipId,
      goal,
    );
    if (!allowed) throw new NotFoundException('Goal not found');

    const [enriched] = await this.enrichWithCompletionMeta(
      companyId,
      userId,
      membershipId,
      [goal],
    );
    return enriched;
  }

  async listMine(companyId: string, userId: string, membershipId: string) {
    const employee = await this.findEmployeeForUser(companyId, userId);
    if (!employee) return { items: [] };

    const goals = await this.prisma.goal.findMany({
      where: {
        companyId,
        status: { in: [GoalStatus.ACTIVE, GoalStatus.COMPLETED] },
        OR: [
          {
            type: GoalType.INDIVIDUAL,
            assignments: { some: { employeeId: employee.id } },
          },
          { type: GoalType.AREA, areaId: employee.areaId },
          { type: GoalType.COMPANY },
        ],
      },
      include: GOAL_DETAIL_INCLUDE,
      orderBy: { title: 'asc' },
    });

    const items = await this.enrichWithCompletionMeta(
      companyId,
      userId,
      membershipId,
      goals,
    );
    return { items };
  }

  private async enrichWithCompletionMeta(
    companyId: string,
    userId: string,
    membershipId: string,
    // Prisma goal rows with GOAL_DETAIL_INCLUDE
    goals: Array<{
      id: string;
      status: GoalStatus;
      keyResults: Array<{
        id: string;
        goalId: string;
        metricType: GoalMetricType;
        direction: GoalMetricDirection | null;
        startValue: Prisma.Decimal | null;
        targetValue: Prisma.Decimal | null;
        targetBoolean: boolean | null;
        weight: Prisma.Decimal | null;
        currencyCode: string | null;
        unit: string | null;
        title: string;
        order: number;
      }>;
      assignments: Array<{ employeeId: string }>;
      [key: string]: unknown;
    }>,
  ) {
    const meta = await this.progressService.progressMetaForGoals(
      companyId,
      userId,
      membershipId,
      goals,
    );
    const goalIds = goals.map((g) => g.id);
    const [pending, rejected, results] = await Promise.all([
      this.completionService.getPendingForGoals(companyId, goalIds),
      this.completionService.getLatestRejectedForGoals(companyId, goalIds),
      this.completionService.getResultsForGoals(companyId, goalIds),
    ]);

    return goals.map((g) => {
      const m = meta.get(g.id)!;
      const pendingReq = pending.get(g.id) ?? null;
      const lastRejected = rejected.get(g.id) ?? null;
      const result = results.get(g.id) ?? null;
      const canCheckIn =
        m.canCheckIn && g.status === GoalStatus.ACTIVE && pendingReq == null;
      return {
        ...this.serializeDetail(
          g as Parameters<GoalsService['serializeDetail']>[0],
        ),
        progress: g.status === GoalStatus.COMPLETED ? null : m.progress,
        canCheckIn,
        canRequestCompletion: canCheckIn,
        pendingCompletionRequest: pendingReq,
        latestRejection: lastRejected,
        achievementPercentage: result?.achievementPercentage ?? null,
        completedAt: result?.completedAt ?? null,
      };
    });
  }

  async create(companyId: string, userId: string, dto: CreateGoalDto) {
    const cycle = await this.prisma.goalCycle.findFirst({
      where: { id: dto.cycleId, companyId },
    });
    if (!cycle) throw new NotFoundException('Goal cycle not found');

    assertGoalTypeShape({ type: dto.type, areaId: dto.areaId ?? null });
    if (dto.type === GoalType.AREA) {
      await this.requireArea(companyId, dto.areaId!);
    }

    const created = await this.prisma.goal.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        title: dto.title.trim(),
        description: emptyToNull(dto.description) ?? null,
        type: dto.type,
        areaId: dto.type === GoalType.AREA ? dto.areaId! : null,
        weight: parseOptionalWeight(dto.weight) ?? null,
        createdByUserId: userId,
      },
      include: GOAL_DETAIL_INCLUDE,
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_CREATED,
      entity: 'Goal',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId: created.id, cycleId: dto.cycleId, type: dto.type },
    });

    return this.serializeDetail(created);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateGoalDto,
  ) {
    const existing = await this.requireDraftGoal(companyId, id);
    const type = dto.type ?? existing.type;
    const areaId = dto.areaId !== undefined ? dto.areaId : existing.areaId;

    assertGoalTypeShape({ type, areaId: areaId ?? null });
    if (type === GoalType.AREA && areaId) {
      await this.requireArea(companyId, areaId);
    }

    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: emptyToNull(dto.description) ?? null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        areaId: type === GoalType.AREA ? areaId! : null,
        ...(dto.weight !== undefined
          ? { weight: parseOptionalWeight(dto.weight) ?? null }
          : {}),
      },
      include: GOAL_DETAIL_INCLUDE,
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_UPDATED,
      entity: 'Goal',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId: id },
    });

    return this.serializeDetail(updated);
  }

  async activate(companyId: string, userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, companyId },
      include: {
        cycle: true,
        keyResults: true,
        _count: { select: { assignments: true } },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.status !== GoalStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT goals can be activated');
    }
    if (goal.cycle.status !== GoalCycleStatus.ACTIVE) {
      throw new BadRequestException(
        'Goal can only be activated while its cycle is ACTIVE',
      );
    }

    assertGoalActivationReady({
      type: goal.type,
      areaId: goal.areaId,
      assignmentCount: goal._count.assignments,
      keyResults: goal.keyResults.map((kr) => ({
        weight: kr.weight?.toString() ?? null,
      })),
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.goal.updateMany({
        where: { id, companyId, status: GoalStatus.DRAFT },
        data: { status: GoalStatus.ACTIVE },
      });
      if (result.count !== 1) {
        throw new ConflictException('Goal status changed concurrently; retry');
      }
      return tx.goal.findFirstOrThrow({
        where: { id, companyId },
        include: GOAL_DETAIL_INCLUDE,
      });
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_ACTIVATED,
      entity: 'Goal',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId: id },
    });

    return this.serializeDetail(updated);
  }

  async cancel(companyId: string, userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, companyId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.status !== GoalStatus.DRAFT && goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot cancel goal from status ${goal.status}`,
      );
    }

    const pending = await this.prisma.goalCompletionRequest.findFirst({
      where: {
        companyId,
        goalId: id,
        status: GoalCompletionRequestStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException(
        'No se puede cancelar un objetivo con solicitud de cierre en revisión',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.goal.updateMany({
        where: {
          id,
          companyId,
          status: { in: [GoalStatus.DRAFT, GoalStatus.ACTIVE] },
        },
        data: { status: GoalStatus.CANCELLED },
      });
      if (result.count !== 1) {
        throw new ConflictException('Goal status changed concurrently; retry');
      }
      return tx.goal.findFirstOrThrow({
        where: { id, companyId },
        include: GOAL_DETAIL_INCLUDE,
      });
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_CANCELLED,
      entity: 'Goal',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId: id, from: goal.status },
    });

    return this.serializeDetail(updated);
  }

  async listKeyResults(companyId: string, goalId: string) {
    await this.requireGoal(companyId, goalId);
    const items = await this.prisma.goalKeyResult.findMany({
      where: { companyId, goalId },
      orderBy: { order: 'asc' },
    });
    return items.map((kr) => this.serializeKr(kr));
  }

  async createKeyResult(
    companyId: string,
    userId: string,
    goalId: string,
    dto: CreateKeyResultDto,
  ) {
    await this.requireDraftGoal(companyId, goalId);
    assertMetricPayload(dto);

    const order = dto.order ?? (await this.nextKrOrder(companyId, goalId));

    try {
      const created = await this.prisma.goalKeyResult.create({
        data: this.krCreateData(companyId, goalId, dto, order),
      });
      await this.audit.create({
        action: GOALS_AUDIT.GOAL_KEY_RESULT_CREATED,
        entity: 'GoalKeyResult',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { goalId, keyResultId: created.id },
      });
      return this.serializeKr(created);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Key result order already exists for this goal',
      );
      throw error;
    }
  }

  async updateKeyResult(
    companyId: string,
    userId: string,
    goalId: string,
    krId: string,
    dto: UpdateKeyResultDto,
  ) {
    await this.requireDraftGoal(companyId, goalId);
    const existing = await this.prisma.goalKeyResult.findFirst({
      where: { id: krId, goalId, companyId },
    });
    if (!existing) throw new NotFoundException('Key result not found');

    const merged = {
      metricType: dto.metricType ?? existing.metricType,
      direction:
        dto.direction !== undefined ? dto.direction : existing.direction,
      startValue:
        dto.startValue !== undefined
          ? dto.startValue
          : existing.startValue == null
            ? null
            : Number(existing.startValue.toString()),
      targetValue:
        dto.targetValue !== undefined
          ? dto.targetValue
          : existing.targetValue == null
            ? null
            : Number(existing.targetValue.toString()),
      targetBoolean:
        dto.targetBoolean !== undefined
          ? dto.targetBoolean
          : existing.targetBoolean,
      unit: dto.unit !== undefined ? dto.unit : existing.unit,
      currencyCode:
        dto.currencyCode !== undefined
          ? dto.currencyCode
          : existing.currencyCode,
    };
    assertMetricPayload(merged);

    try {
      const updated = await this.prisma.goalKeyResult.update({
        where: { id: krId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: emptyToNull(dto.description) ?? null }
            : {}),
          metricType: merged.metricType,
          ...this.metricFields(merged),
          ...(dto.weight !== undefined
            ? { weight: parseOptionalWeight(dto.weight) ?? null }
            : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });
      await this.audit.create({
        action: GOALS_AUDIT.GOAL_KEY_RESULT_UPDATED,
        entity: 'GoalKeyResult',
        entityId: krId,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { goalId, keyResultId: krId },
      });
      return this.serializeKr(updated);
    } catch (error) {
      this.rethrowUnique(
        error,
        'Key result order already exists for this goal',
      );
      throw error;
    }
  }

  async deleteKeyResult(
    companyId: string,
    userId: string,
    goalId: string,
    krId: string,
  ) {
    await this.requireDraftGoal(companyId, goalId);
    const existing = await this.prisma.goalKeyResult.findFirst({
      where: { id: krId, goalId, companyId },
    });
    if (!existing) throw new NotFoundException('Key result not found');

    await this.prisma.goalKeyResult.delete({ where: { id: krId } });
    await this.audit.create({
      action: GOALS_AUDIT.GOAL_KEY_RESULT_DELETED,
      entity: 'GoalKeyResult',
      entityId: krId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId, keyResultId: krId },
    });
    return { ok: true };
  }

  async listAssignments(companyId: string, goalId: string) {
    await this.requireGoal(companyId, goalId);
    const items = await this.prisma.goalAssignment.findMany({
      where: { companyId, goalId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            areaId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((a) => ({
      id: a.id,
      goalId: a.goalId,
      employeeId: a.employeeId,
      createdAt: a.createdAt,
      employee: a.employee,
    }));
  }

  async addAssignment(
    companyId: string,
    userId: string,
    goalId: string,
    dto: CreateAssignmentDto,
  ) {
    await this.requireDraftGoal(companyId, goalId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    try {
      const created = await this.prisma.goalAssignment.create({
        data: {
          companyId,
          goalId,
          employeeId: dto.employeeId,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              areaId: true,
            },
          },
        },
      });
      await this.audit.create({
        action: GOALS_AUDIT.GOAL_ASSIGNMENT_ADDED,
        entity: 'GoalAssignment',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          goalId,
          assignmentId: created.id,
          employeeId: dto.employeeId,
        },
      });
      return {
        id: created.id,
        goalId: created.goalId,
        employeeId: created.employeeId,
        createdAt: created.createdAt,
        employee: created.employee,
      };
    } catch (error) {
      this.rethrowUnique(error, 'Employee already assigned to this goal');
      throw error;
    }
  }

  async removeAssignment(
    companyId: string,
    userId: string,
    goalId: string,
    assignmentId: string,
  ) {
    await this.requireDraftGoal(companyId, goalId);
    const existing = await this.prisma.goalAssignment.findFirst({
      where: { id: assignmentId, goalId, companyId },
    });
    if (!existing) throw new NotFoundException('Assignment not found');

    await this.prisma.goalAssignment.delete({ where: { id: assignmentId } });
    await this.audit.create({
      action: GOALS_AUDIT.GOAL_ASSIGNMENT_REMOVED,
      entity: 'GoalAssignment',
      entityId: assignmentId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        goalId,
        assignmentId,
        employeeId: existing.employeeId,
      },
    });
    return { ok: true };
  }

  private async findEmployeeForUser(companyId: string, userId: string) {
    return this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, areaId: true },
    });
  }

  private async requireGoal(companyId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, companyId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  private async requireDraftGoal(companyId: string, id: string) {
    const goal = await this.requireGoal(companyId, id);
    if (!isGoalStructurallyEditable(goal.status)) {
      throw new BadRequestException(
        'Only DRAFT goals allow structural changes',
      );
    }
    return goal;
  }

  private async requireArea(companyId: string, areaId: string) {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, companyId, deletedAt: null },
    });
    if (!area) throw new NotFoundException('Area not found');
    return area;
  }

  private async nextKrOrder(companyId: string, goalId: string) {
    const last = await this.prisma.goalKeyResult.findFirst({
      where: { companyId, goalId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (last?.order ?? -1) + 1;
  }

  private krCreateData(
    companyId: string,
    goalId: string,
    dto: CreateKeyResultDto,
    order: number,
  ): Prisma.GoalKeyResultCreateInput {
    return {
      company: { connect: { id: companyId } },
      goal: { connect: { id: goalId } },
      title: dto.title.trim(),
      description: emptyToNull(dto.description) ?? null,
      metricType: dto.metricType,
      ...this.metricFields(dto),
      weight: parseOptionalWeight(dto.weight) ?? null,
      order,
    };
  }

  private metricFields(payload: {
    metricType: GoalMetricType;
    direction?: GoalMetricDirection | null;
    startValue?: number | null;
    targetValue?: number | null;
    targetBoolean?: boolean | null;
    unit?: string | null;
    currencyCode?: string | null;
  }): {
    direction: GoalMetricDirection | null;
    startValue: Prisma.Decimal | null;
    targetValue: Prisma.Decimal | null;
    targetBoolean: boolean | null;
    unit: string | null;
    currencyCode: string | null;
  } {
    if (payload.metricType === GoalMetricType.BOOLEAN) {
      return {
        direction: null,
        startValue: null,
        targetValue: null,
        targetBoolean: payload.targetBoolean ?? true,
        unit: emptyToNull(payload.unit) ?? null,
        currencyCode: null,
      };
    }
    return {
      direction: (payload.direction as GoalMetricDirection | null) ?? null,
      startValue:
        payload.startValue == null
          ? null
          : new Prisma.Decimal(payload.startValue.toFixed(4)),
      targetValue:
        payload.targetValue == null
          ? null
          : new Prisma.Decimal(payload.targetValue.toFixed(4)),
      targetBoolean: null,
      unit: emptyToNull(payload.unit) ?? null,
      currencyCode:
        payload.metricType === GoalMetricType.CURRENCY
          ? payload.currencyCode!.trim().toUpperCase()
          : null,
    };
  }

  private serializeKr(kr: {
    id: string;
    companyId: string;
    goalId: string;
    title: string;
    description: string | null;
    metricType: GoalMetricType;
    direction: string | null;
    startValue: Prisma.Decimal | null;
    targetValue: Prisma.Decimal | null;
    targetBoolean: boolean | null;
    unit: string | null;
    currencyCode: string | null;
    weight: Prisma.Decimal | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: kr.id,
      companyId: kr.companyId,
      goalId: kr.goalId,
      title: kr.title,
      description: kr.description,
      metricType: kr.metricType,
      direction: kr.direction,
      startValue: decimalToString(kr.startValue),
      targetValue: decimalToString(kr.targetValue),
      targetBoolean: kr.targetBoolean,
      unit: kr.unit,
      currencyCode: kr.currencyCode,
      weight: decimalToString(kr.weight),
      order: kr.order,
      createdAt: kr.createdAt,
      updatedAt: kr.updatedAt,
    };
  }

  private serializeDetail(goal: {
    id: string;
    companyId: string;
    cycleId: string;
    title: string;
    description: string | null;
    type: GoalType;
    status: GoalStatus;
    areaId: string | null;
    weight: Prisma.Decimal | null;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    cycle: {
      id: string;
      name: string;
      status: GoalCycleStatus;
      startDate: Date;
      endDate: Date;
    };
    area: { id: string; name: string } | null;
    keyResults: Array<Parameters<GoalsService['serializeKr']>[0]>;
    assignments: Array<{
      id: string;
      employeeId: string;
      createdAt: Date;
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        areaId: string;
      };
    }>;
  }) {
    return {
      id: goal.id,
      companyId: goal.companyId,
      cycleId: goal.cycleId,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      status: goal.status,
      areaId: goal.areaId,
      weight: decimalToString(goal.weight),
      createdByUserId: goal.createdByUserId,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      cycle: {
        ...goal.cycle,
        startDate: goal.cycle.startDate.toISOString().slice(0, 10),
        endDate: goal.cycle.endDate.toISOString().slice(0, 10),
      },
      area: goal.area,
      keyResults: goal.keyResults.map((kr) => this.serializeKr(kr)),
      assignments: goal.assignments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        createdAt: a.createdAt,
        employee: a.employee,
      })),
    };
  }

  private rethrowUnique(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }
}
