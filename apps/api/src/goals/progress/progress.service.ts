import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalCompletionRequestStatus,
  GoalCycleStatus,
  GoalMetricType,
  GoalStatus,
  GoalType,
  Prisma,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calculateGoalProgress,
  calculateKeyResultProgress,
} from '../goal-progress';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  GOALS_AUDIT,
  MAX_LIMIT,
} from '../goals.constants';
import { decimalToString, emptyToNull } from '../goals.helpers';
import type {
  CreateCheckInDto,
  ListCheckInsQueryDto,
} from './dto/check-in.dto';

type KrRow = {
  id: string;
  goalId: string;
  metricType: GoalMetricType;
  direction: 'INCREASE' | 'DECREASE' | null;
  startValue: Prisma.Decimal | null;
  targetValue: Prisma.Decimal | null;
  targetBoolean: boolean | null;
  weight: Prisma.Decimal | null;
  currencyCode: string | null;
  unit: string | null;
  title: string;
  order: number;
};

type CheckInRow = {
  id: string;
  keyResultId: string;
  goalId: string;
  sequence: number;
  numericValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  createdAt: Date;
  comment: string | null;
  evidenceReference: string | null;
  createdByUserId: string;
  createdByEmployeeId: string | null;
};

@Injectable()
export class GoalProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async getGoalProgress(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    const goal = await this.requireAccessibleGoal(
      companyId,
      userId,
      membershipId,
      goalId,
    );
    return this.buildProgressPayload(companyId, goal.id, goal.keyResults);
  }

  async listCheckIns(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
    keyResultId: string,
    query: ListCheckInsQueryDto,
  ) {
    await this.requireAccessibleGoal(companyId, userId, membershipId, goalId);
    await this.requireKeyResult(companyId, goalId, keyResultId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = { companyId, goalId, keyResultId };
    const [items, total] = await Promise.all([
      this.prisma.goalCheckIn.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.goalCheckIn.count({ where }),
    ]);

    return {
      items: items.map((c) => this.serializeCheckIn(c)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createCheckIn(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
    keyResultId: string,
    dto: CreateCheckInDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (!granted.has('goals.progress.update')) {
      throw new ForbiddenException('Missing permission: goals.progress.update');
    }

    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, companyId },
      include: {
        cycle: { select: { status: true } },
        assignments: { select: { employeeId: true } },
        keyResults: true,
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException(
        'Check-ins are only allowed on ACTIVE goals',
      );
    }
    if (goal.cycle.status !== GoalCycleStatus.ACTIVE) {
      throw new BadRequestException(
        'Check-ins are only allowed while the goal cycle is ACTIVE',
      );
    }

    const kr = goal.keyResults.find((k) => k.id === keyResultId);
    if (!kr) throw new NotFoundException('Key result not found');

    const employee = await this.findEmployeeForUser(companyId, userId);
    const isAdminWriter = granted.has('goals.goal.manage');
    const isResponsible =
      !!employee && goal.assignments.some((a) => a.employeeId === employee.id);

    if (!isAdminWriter && !isResponsible) {
      throw new ForbiddenException(
        'Only assigned responsible employees or goal managers can register check-ins',
      );
    }

    const values = this.resolveCheckInValues(kr.metricType, dto);
    const comment = emptyToNull(dto.comment) ?? null;
    const evidenceReference = emptyToNull(dto.evidenceReference) ?? null;

    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          // Lock order: Goal first (compatible with completion request), then KR.
          await tx.$queryRaw`
            SELECT id FROM goals
            WHERE id = ${goalId}::uuid AND "companyId" = ${companyId}::uuid
            FOR UPDATE
          `;

          const pending = await tx.goalCompletionRequest.findFirst({
            where: {
              companyId,
              goalId,
              status: GoalCompletionRequestStatus.PENDING,
            },
            select: { id: true },
          });
          if (pending) {
            throw new ConflictException(
              'El objetivo está en revisión de cierre',
            );
          }

          await tx.$queryRaw`
            SELECT id FROM goal_key_results
            WHERE id = ${keyResultId}::uuid
              AND "goalId" = ${goalId}::uuid
              AND "companyId" = ${companyId}::uuid
            FOR UPDATE
          `;

          const agg = await tx.goalCheckIn.aggregate({
            where: { keyResultId, companyId },
            _max: { sequence: true },
          });
          const sequence = (agg._max.sequence ?? 0) + 1;

          return tx.goalCheckIn.create({
            data: {
              companyId,
              goalId,
              keyResultId,
              sequence,
              createdByUserId: userId,
              createdByEmployeeId: employee?.id ?? null,
              numericValue: values.numericValue,
              booleanValue: values.booleanValue,
              comment,
              evidenceReference,
            },
            include: {
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              createdByEmployee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });
        });

        await this.audit.create({
          action: GOALS_AUDIT.GOAL_CHECK_IN_CREATED,
          entity: 'GoalCheckIn',
          entityId: created.id,
          company: { connect: { id: companyId } },
          user: { connect: { id: userId } },
          metadata: {
            goalId,
            keyResultId,
            checkInId: created.id,
            sequence: created.sequence,
          },
        });

        const progress = await this.buildProgressPayload(
          companyId,
          goalId,
          goal.keyResults,
        );
        const krProgress = progress.keyResults.find(
          (k) => k.keyResultId === keyResultId,
        );

        return {
          checkIn: this.serializeCheckIn(created),
          keyResultProgress: krProgress ?? null,
          goalProgressPercentage: progress.progressPercentage,
        };
      } catch (error: unknown) {
        lastError = error;
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        ) {
          throw error;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictException('Could not allocate check-in sequence');
  }

  async listTeam(companyId: string, userId: string) {
    const manager = await this.findEmployeeForUser(companyId, userId);
    if (!manager) {
      return { employees: [] as const };
    }

    const lines = await this.prisma.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: manager.id,
        type: ReportingLineType.DIRECT,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            areaId: true,
            deletedAt: true,
            area: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
      },
    });

    const reports = lines
      .map((l) => l.employee)
      .filter((e) => e.deletedAt == null)
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          'es',
        ),
      );

    if (reports.length === 0) {
      return { employees: [] as const };
    }

    const areaIds = [...new Set(reports.map((r) => r.areaId))];
    const reportIds = reports.map((r) => r.id);

    const goals = await this.prisma.goal.findMany({
      where: {
        companyId,
        status: { in: [GoalStatus.ACTIVE, GoalStatus.COMPLETED] },
        OR: [
          {
            type: GoalType.INDIVIDUAL,
            assignments: { some: { employeeId: { in: reportIds } } },
          },
          { type: GoalType.AREA, areaId: { in: areaIds } },
          { type: GoalType.COMPANY },
        ],
      },
      include: {
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
        keyResults: { orderBy: { order: 'asc' } },
        assignments: { select: { employeeId: true } },
      },
      orderBy: { title: 'asc' },
    });

    const allKrIds = goals.flatMap((g) => g.keyResults.map((kr) => kr.id));
    const latestByKr = await this.loadLatestCheckIns(companyId, allKrIds);
    const completedIds = goals
      .filter((g) => g.status === GoalStatus.COMPLETED)
      .map((g) => g.id);
    const results = await this.prisma.goalResult.findMany({
      where: { companyId, goalId: { in: completedIds } },
      select: { goalId: true, achievementPercentage: true },
    });
    const resultByGoal = new Map(results.map((r) => [r.goalId, r] as const));

    const employees = reports.map((employee) => {
      const applicable = goals.filter((g) =>
        this.isApplicableToEmployee(g, employee),
      );
      return {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          areaId: employee.areaId,
          area: employee.area,
          position: employee.position,
        },
        goals: applicable.map((g) => {
          const progress = this.computeProgressFromMaps(
            g.id,
            g.keyResults,
            latestByKr,
          );
          const result = resultByGoal.get(g.id);
          return {
            id: g.id,
            title: g.title,
            type: g.type,
            status: g.status,
            cycle: {
              ...g.cycle,
              startDate: g.cycle.startDate.toISOString().slice(0, 10),
              endDate: g.cycle.endDate.toISOString().slice(0, 10),
            },
            area: g.area,
            progressPercentage:
              g.status === GoalStatus.COMPLETED
                ? null
                : progress.progressPercentage,
            achievementPercentage: result
              ? decimalToString(result.achievementPercentage)
              : null,
            keyResults: progress.keyResults,
          };
        }),
      };
    });

    return { employees };
  }

  /**
   * Progress + canCheckIn for prisma goal rows (batch, one DISTINCT ON).
   */
  async progressMetaForGoals(
    companyId: string,
    userId: string,
    membershipId: string,
    goals: Array<{
      id: string;
      keyResults: KrRow[];
      assignments: Array<{ employeeId: string }>;
    }>,
  ): Promise<
    Map<
      string,
      {
        progress: ReturnType<GoalProgressService['computeProgressFromMaps']>;
        canCheckIn: boolean;
      }
    >
  > {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const employee = await this.findEmployeeForUser(companyId, userId);
    const isAdminWriter =
      granted.has('goals.progress.update') && granted.has('goals.goal.manage');
    const canUpdatePerm = granted.has('goals.progress.update');

    const krIds = goals.flatMap((g) => g.keyResults.map((kr) => kr.id));
    const latestByKr = await this.loadLatestCheckIns(companyId, krIds);

    const map = new Map<
      string,
      {
        progress: ReturnType<GoalProgressService['computeProgressFromMaps']>;
        canCheckIn: boolean;
      }
    >();

    for (const goal of goals) {
      const progress = this.computeProgressFromMaps(
        goal.id,
        goal.keyResults,
        latestByKr,
      );
      const isResponsible =
        !!employee &&
        goal.assignments.some((a) => a.employeeId === employee.id);
      map.set(goal.id, {
        progress,
        canCheckIn: canUpdatePerm && (isAdminWriter || isResponsible),
      });
    }
    return map;
  }

  async assertCanAccessGoal(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ): Promise<void> {
    await this.requireAccessibleGoal(companyId, userId, membershipId, goalId);
  }

  async canAccessGoalAsLeaderOrMine(
    companyId: string,
    userId: string,
    membershipId: string,
    goal: {
      id: string;
      status: GoalStatus;
      type: GoalType;
      areaId: string | null;
      assignments: Array<{ employeeId: string }>;
    },
  ): Promise<boolean> {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (granted.has('goals.goal.manage')) return true;

    const employee = await this.findEmployeeForUser(companyId, userId);
    if (employee && this.isApplicableToEmployee(goal, employee)) {
      return (
        goal.status === GoalStatus.ACTIVE ||
        goal.status === GoalStatus.COMPLETED
      );
    }

    return this.isVisibleViaDirectReport(companyId, userId, goal);
  }

  private async requireAccessibleGoal(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, companyId },
      include: {
        keyResults: { orderBy: { order: 'asc' } },
        assignments: { select: { employeeId: true } },
        cycle: { select: { status: true } },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const allowed = await this.canAccessGoalAsLeaderOrMine(
      companyId,
      userId,
      membershipId,
      goal,
    );
    if (!allowed) throw new NotFoundException('Goal not found');
    return goal;
  }

  private async isVisibleViaDirectReport(
    companyId: string,
    userId: string,
    goal: {
      status: GoalStatus;
      type: GoalType;
      areaId: string | null;
      assignments: Array<{ employeeId: string }>;
    },
  ): Promise<boolean> {
    if (
      goal.status !== GoalStatus.ACTIVE &&
      goal.status !== GoalStatus.COMPLETED
    ) {
      return false;
    }
    const manager = await this.findEmployeeForUser(companyId, userId);
    if (!manager) return false;

    const reports = await this.prisma.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: manager.id,
        type: ReportingLineType.DIRECT,
      },
      include: {
        employee: {
          select: { id: true, areaId: true, deletedAt: true },
        },
      },
    });

    return reports.some(
      (r) =>
        r.employee.deletedAt == null &&
        this.isApplicableToEmployee(goal, r.employee),
    );
  }

  private isApplicableToEmployee(
    goal: {
      type: GoalType;
      areaId: string | null;
      assignments: Array<{ employeeId: string }>;
      status?: GoalStatus;
    },
    employee: { id: string; areaId: string },
  ): boolean {
    if (
      goal.status != null &&
      goal.status !== GoalStatus.ACTIVE &&
      goal.status !== GoalStatus.COMPLETED
    ) {
      return false;
    }
    if (goal.type === GoalType.COMPANY) return true;
    if (goal.type === GoalType.AREA) return goal.areaId === employee.areaId;
    return goal.assignments.some((a) => a.employeeId === employee.id);
  }

  private async requireKeyResult(
    companyId: string,
    goalId: string,
    keyResultId: string,
  ) {
    const kr = await this.prisma.goalKeyResult.findFirst({
      where: { id: keyResultId, goalId, companyId },
    });
    if (!kr) throw new NotFoundException('Key result not found');
    return kr;
  }

  private resolveCheckInValues(
    metricType: GoalMetricType,
    dto: CreateCheckInDto,
  ): {
    numericValue: Prisma.Decimal | null;
    booleanValue: boolean | null;
  } {
    if (metricType === GoalMetricType.BOOLEAN) {
      if (dto.booleanValue === undefined) {
        throw new BadRequestException(
          'BOOLEAN key results require booleanValue',
        );
      }
      if (dto.numericValue !== undefined) {
        throw new BadRequestException(
          'BOOLEAN key results must not set numericValue',
        );
      }
      return { numericValue: null, booleanValue: dto.booleanValue };
    }

    if (dto.numericValue === undefined || dto.numericValue === null) {
      throw new BadRequestException(
        `${metricType} key results require numericValue`,
      );
    }
    if (dto.booleanValue !== undefined) {
      throw new BadRequestException(
        `${metricType} key results must not set booleanValue`,
      );
    }
    return {
      numericValue: new Prisma.Decimal(Number(dto.numericValue).toFixed(4)),
      booleanValue: null,
    };
  }

  private async buildProgressPayload(
    companyId: string,
    goalId: string,
    keyResults: KrRow[],
  ) {
    const latestByKr = await this.loadLatestCheckIns(
      companyId,
      keyResults.map((kr) => kr.id),
    );
    return this.computeProgressFromMaps(goalId, keyResults, latestByKr);
  }

  private computeProgressFromMaps(
    goalId: string,
    keyResults: KrRow[],
    latestByKr: Map<string, CheckInRow>,
  ) {
    const krProgress = keyResults.map((kr) => {
      const latest = latestByKr.get(kr.id) ?? null;
      const hasCheckIn = latest != null;
      const currentNumeric =
        hasCheckIn && latest.numericValue != null
          ? Number(latest.numericValue.toString())
          : null;
      const currentBoolean =
        hasCheckIn && latest.booleanValue != null ? latest.booleanValue : null;

      const progressPercentage = calculateKeyResultProgress({
        metricType: kr.metricType,
        direction: kr.direction,
        startValue:
          kr.startValue != null ? Number(kr.startValue.toString()) : null,
        targetValue:
          kr.targetValue != null ? Number(kr.targetValue.toString()) : null,
        currentNumericValue: currentNumeric,
        currentBooleanValue: currentBoolean,
        hasCheckIn,
      });

      let currentNumericValue: string | null = null;
      if (kr.metricType !== GoalMetricType.BOOLEAN) {
        if (hasCheckIn && latest.numericValue != null) {
          currentNumericValue = decimalToString(latest.numericValue);
        } else {
          currentNumericValue = decimalToString(kr.startValue) ?? '0';
        }
      }

      return {
        keyResultId: kr.id,
        title: kr.title,
        metricType: kr.metricType,
        direction: kr.direction,
        unit: kr.unit,
        currencyCode: kr.currencyCode,
        startValue: decimalToString(kr.startValue),
        targetValue: decimalToString(kr.targetValue),
        targetBoolean: kr.targetBoolean,
        weight: decimalToString(kr.weight),
        currentNumericValue,
        currentBooleanValue:
          kr.metricType === GoalMetricType.BOOLEAN
            ? hasCheckIn
              ? (latest.booleanValue ?? false)
              : false
            : null,
        progressPercentage,
        lastCheckInAt: latest?.createdAt ?? null,
        lastCheckInSequence: latest?.sequence ?? null,
      };
    });

    return {
      goalId,
      progressPercentage: calculateGoalProgress(
        krProgress.map((kr) => ({
          progressPercentage: kr.progressPercentage,
          weight: kr.weight == null ? null : Number(kr.weight),
        })),
      ),
      keyResults: krProgress,
    };
  }

  /**
   * Latest check-in per KR = max(sequence).
   * Strategy: one findMany ordered by sequence DESC, keep first per KR.
   * Avoids N+1 (no query per KR). DISTINCT ON alternative documented in docs.
   */
  private async loadLatestCheckIns(
    companyId: string,
    keyResultIds: string[],
  ): Promise<Map<string, CheckInRow>> {
    const map = new Map<string, CheckInRow>();
    if (keyResultIds.length === 0) return map;

    const rows = await this.prisma.goalCheckIn.findMany({
      where: { companyId, keyResultId: { in: keyResultIds } },
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        keyResultId: true,
        goalId: true,
        sequence: true,
        numericValue: true,
        booleanValue: true,
        createdAt: true,
        comment: true,
        evidenceReference: true,
        createdByUserId: true,
        createdByEmployeeId: true,
      },
    });

    for (const row of rows) {
      if (!map.has(row.keyResultId)) {
        map.set(row.keyResultId, row);
      }
    }
    return map;
  }

  private serializeCheckIn(c: {
    id: string;
    companyId: string;
    goalId: string;
    keyResultId: string;
    sequence: number;
    createdByUserId: string;
    createdByEmployeeId: string | null;
    numericValue: Prisma.Decimal | null;
    booleanValue: boolean | null;
    comment: string | null;
    evidenceReference: string | null;
    createdAt: Date;
    createdBy?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    createdByEmployee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }) {
    return {
      id: c.id,
      companyId: c.companyId,
      goalId: c.goalId,
      keyResultId: c.keyResultId,
      sequence: c.sequence,
      createdByUserId: c.createdByUserId,
      createdByEmployeeId: c.createdByEmployeeId,
      numericValue: decimalToString(c.numericValue),
      booleanValue: c.booleanValue,
      comment: c.comment,
      evidenceReference: c.evidenceReference,
      createdAt: c.createdAt,
      createdBy: c.createdBy ?? null,
      createdByEmployee: c.createdByEmployee ?? null,
    };
  }

  private async findEmployeeForUser(companyId: string, userId: string) {
    return this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, areaId: true },
    });
  }
}
