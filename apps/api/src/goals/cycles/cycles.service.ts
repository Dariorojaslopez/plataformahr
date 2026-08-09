import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalCompletionRequestStatus,
  GoalCycleStatus,
  GoalStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canTransitionGoalCycle,
  isGoalCycleEditable,
} from '../cycle-transitions';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  GOALS_AUDIT,
  MAX_LIMIT,
} from '../goals.constants';
import {
  assertGoalCycleDates,
  emptyToNull,
  parseDateOnly,
} from '../goals.helpers';
import type {
  CreateGoalCycleDto,
  ListGoalCyclesQueryDto,
  UpdateGoalCycleDto,
} from './dto/cycle.dto';

@Injectable()
export class GoalCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListGoalCyclesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.GoalCycleWhereInput = {
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
      this.prisma.goalCycle.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { goals: true } } },
      }),
      this.prisma.goalCycle.count({ where }),
    ]);

    return {
      items: items.map((c) => this.serialize(c)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, id: string) {
    const cycle = await this.prisma.goalCycle.findFirst({
      where: { id, companyId },
      include: { _count: { select: { goals: true } } },
    });
    if (!cycle) throw new NotFoundException('Goal cycle not found');
    return this.serialize(cycle);
  }

  async create(companyId: string, userId: string, dto: CreateGoalCycleDto) {
    const startDate = parseDateOnly(dto.startDate, 'startDate');
    const endDate = parseDateOnly(dto.endDate, 'endDate');
    assertGoalCycleDates(startDate, endDate);

    const created = await this.prisma.goalCycle.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: emptyToNull(dto.description) ?? null,
        startDate,
        endDate,
        createdByUserId: userId,
      },
      include: { _count: { select: { goals: true } } },
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_CYCLE_CREATED,
      entity: 'GoalCycle',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { cycleId: created.id },
    });

    return this.serialize(created);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateGoalCycleDto,
  ) {
    const existing = await this.requireCycle(companyId, id);
    if (!isGoalCycleEditable(existing.status)) {
      throw new BadRequestException('Only DRAFT goal cycles can be edited');
    }

    const startDate =
      dto.startDate !== undefined
        ? parseDateOnly(dto.startDate, 'startDate')
        : existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? parseDateOnly(dto.endDate, 'endDate')
        : existing.endDate;
    assertGoalCycleDates(startDate, endDate);

    const updated = await this.prisma.goalCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: emptyToNull(dto.description) ?? null }
          : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
      },
      include: { _count: { select: { goals: true } } },
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_CYCLE_UPDATED,
      entity: 'GoalCycle',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { cycleId: id },
    });

    return this.serialize(updated);
  }

  async activate(companyId: string, userId: string, id: string) {
    await this.requireCycle(companyId, id);
    return this.transition(
      companyId,
      userId,
      id,
      GoalCycleStatus.DRAFT,
      GoalCycleStatus.ACTIVE,
      GOALS_AUDIT.GOAL_CYCLE_ACTIVATED,
    );
  }

  async close(companyId: string, userId: string, id: string) {
    await this.requireCycle(companyId, id);
    const unresolvedGoals = await this.prisma.goal.count({
      where: {
        companyId,
        cycleId: id,
        status: { in: [GoalStatus.ACTIVE, GoalStatus.DRAFT] },
      },
    });
    if (unresolvedGoals > 0) {
      throw new BadRequestException(
        'Cannot close cycle while ACTIVE or DRAFT goals remain (all goals must be COMPLETED or CANCELLED)',
      );
    }
    return this.transition(
      companyId,
      userId,
      id,
      GoalCycleStatus.ACTIVE,
      GoalCycleStatus.CLOSED,
      GOALS_AUDIT.GOAL_CYCLE_CLOSED,
    );
  }

  async cancel(companyId: string, userId: string, id: string) {
    const cycle = await this.requireCycle(companyId, id);
    if (!canTransitionGoalCycle(cycle.status, GoalCycleStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel goal cycle from status ${cycle.status}`,
      );
    }
    const pendingRequests = await this.prisma.goalCompletionRequest.count({
      where: {
        companyId,
        status: GoalCompletionRequestStatus.PENDING,
        goal: { cycleId: id },
      },
    });
    if (pendingRequests > 0) {
      throw new BadRequestException(
        'Cannot cancel cycle while goal completion requests are PENDING',
      );
    }
    return this.transition(
      companyId,
      userId,
      id,
      cycle.status,
      GoalCycleStatus.CANCELLED,
      GOALS_AUDIT.GOAL_CYCLE_CANCELLED,
    );
  }

  private async transition(
    companyId: string,
    userId: string,
    id: string,
    from: GoalCycleStatus,
    to: GoalCycleStatus,
    action: string,
  ) {
    if (!canTransitionGoalCycle(from, to)) {
      throw new BadRequestException(
        `Invalid goal cycle transition ${from} → ${to}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.goalCycle.updateMany({
        where: { id, companyId, status: from },
        data: { status: to },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Goal cycle status changed concurrently; retry',
        );
      }
      return tx.goalCycle.findFirstOrThrow({
        where: { id, companyId },
        include: { _count: { select: { goals: true } } },
      });
    });

    await this.audit.create({
      action,
      entity: 'GoalCycle',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { cycleId: id, from, to },
    });

    return this.serialize(updated);
  }

  private async requireCycle(companyId: string, id: string) {
    const cycle = await this.prisma.goalCycle.findFirst({
      where: { id, companyId },
    });
    if (!cycle) throw new NotFoundException('Goal cycle not found');
    return cycle;
  }

  private serialize(cycle: {
    id: string;
    companyId: string;
    name: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    status: GoalCycleStatus;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { goals: number };
  }) {
    return {
      id: cycle.id,
      companyId: cycle.companyId,
      name: cycle.name,
      description: cycle.description,
      startDate: cycle.startDate.toISOString().slice(0, 10),
      endDate: cycle.endDate.toISOString().slice(0, 10),
      status: cycle.status,
      createdByUserId: cycle.createdByUserId,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
      goalCount: cycle._count?.goals ?? 0,
    };
  }
}
