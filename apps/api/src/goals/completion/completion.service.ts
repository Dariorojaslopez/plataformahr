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
  calculateGoalAchievement,
  calculateKeyResultAchievement,
  computeEffectiveWeights,
} from '../goal-achievement';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  GOALS_AUDIT,
  MAX_LIMIT,
} from '../goals.constants';
import { decimalToString, emptyToNull } from '../goals.helpers';
import type {
  ApproveCompletionDto,
  CreateCompletionRequestDto,
  ListCompletionRequestsQueryDto,
  RejectCompletionDto,
} from './dto/completion.dto';

@Injectable()
export class GoalCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
  ) {}

  async requestCompletion(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
    dto: CreateCompletionRequestDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (!granted.has('goals.completion.request')) {
      throw new ForbiddenException(
        'Missing permission: goals.completion.request',
      );
    }

    const employee = await this.findEmployeeForUser(companyId, userId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Lock order: Goal first (shared with check-in path).
        await tx.$queryRaw`
          SELECT id FROM goals
          WHERE id = ${goalId}::uuid AND "companyId" = ${companyId}::uuid
          FOR UPDATE
        `;

        const goal = await tx.goal.findFirst({
          where: { id: goalId, companyId },
          include: {
            cycle: { select: { status: true } },
            assignments: { select: { employeeId: true } },
            keyResults: { orderBy: { order: 'asc' } },
          },
        });
        if (!goal) throw new NotFoundException('Goal not found');
        if (goal.status !== GoalStatus.ACTIVE) {
          throw new BadRequestException(
            'Solo se puede solicitar cierre de un objetivo ACTIVE',
          );
        }
        if (goal.cycle.status !== GoalCycleStatus.ACTIVE) {
          throw new BadRequestException(
            'Solo se puede solicitar cierre mientras el periodo está ACTIVE',
          );
        }
        if (goal.keyResults.length < 1) {
          throw new BadRequestException(
            'El objetivo debe tener al menos un Key Result',
          );
        }

        const isAdmin = granted.has('goals.goal.manage');
        const isResponsible =
          !!employee &&
          goal.assignments.some((a) => a.employeeId === employee.id);
        if (!isAdmin && !isResponsible) {
          throw new ForbiddenException(
            'Solo responsables asignados o administradores pueden solicitar el cierre',
          );
        }

        const pending = await tx.goalCompletionRequest.findFirst({
          where: {
            companyId,
            goalId,
            status: GoalCompletionRequestStatus.PENDING,
          },
        });
        if (pending) {
          throw new ConflictException(
            'Ya existe una solicitud de cierre en revisión para este objetivo',
          );
        }

        const checkInCounts = await tx.goalCheckIn.groupBy({
          by: ['keyResultId'],
          where: {
            companyId,
            goalId,
            keyResultId: { in: goal.keyResults.map((kr) => kr.id) },
          },
          _count: { _all: true },
        });
        const withCheckIn = new Set(checkInCounts.map((c) => c.keyResultId));
        const missing = goal.keyResults.filter((kr) => !withCheckIn.has(kr.id));
        if (missing.length > 0) {
          throw new BadRequestException(
            'Cada Key Result debe tener al menos un avance (check-in) antes de solicitar el cierre',
          );
        }

        return tx.goalCompletionRequest.create({
          data: {
            companyId,
            goalId,
            status: GoalCompletionRequestStatus.PENDING,
            requestedByUserId: userId,
            requestedByEmployeeId: employee?.id ?? null,
            requestComment: emptyToNull(dto.requestComment) ?? null,
          },
          include: this.requestInclude(),
        });
      });

      await this.audit.create({
        action: GOALS_AUDIT.GOAL_COMPLETION_REQUESTED,
        entity: 'GoalCompletionRequest',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { goalId, requestId: created.id },
      });

      return this.serializeRequest(created, { includeComments: true });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una solicitud de cierre en revisión para este objetivo',
        );
      }
      throw error;
    }
  }

  async listForGoal(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    await this.assertCanAccessGoal(companyId, userId, membershipId, goalId);
    const privacy = await this.commentPrivacy(
      companyId,
      userId,
      membershipId,
      goalId,
    );
    const items = await this.prisma.goalCompletionRequest.findMany({
      where: { companyId, goalId },
      include: this.requestInclude(),
      orderBy: { requestedAt: 'desc' },
    });
    return {
      items: items.map((r) =>
        this.serializeRequest(r, { includeComments: privacy.showComments }),
      ),
    };
  }

  async listPendingReviews(
    companyId: string,
    userId: string,
    membershipId: string,
    query: ListCompletionRequestsQueryDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (!granted.has('goals.completion.review')) {
      throw new ForbiddenException(
        'Missing permission: goals.completion.review',
      );
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const status = query.status ?? GoalCompletionRequestStatus.PENDING;

    const where: Prisma.GoalCompletionRequestWhereInput = {
      companyId,
      status: status,
      ...(query.goalId ? { goalId: query.goalId } : {}),
    };

    const [raw, total] = await Promise.all([
      this.prisma.goalCompletionRequest.findMany({
        where,
        include: {
          ...this.requestInclude(),
          goal: {
            include: {
              cycle: { select: { id: true, name: true, status: true } },
              area: { select: { id: true, name: true } },
              assignments: {
                include: {
                  employee: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
              keyResults: { orderBy: { order: 'asc' } },
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.goalCompletionRequest.count({ where }),
    ]);

    const isAdmin = granted.has('goals.goal.manage');
    const items = [];
    for (const row of raw) {
      if (
        isAdmin ||
        (await this.canLeaderReviewGoal(companyId, userId, row.goal))
      ) {
        items.push({
          ...this.serializeRequest(row, { includeComments: true }),
          goal: {
            id: row.goal.id,
            title: row.goal.title,
            type: row.goal.type,
            status: row.goal.status,
            cycle: row.goal.cycle,
            area: row.goal.area,
            assignees: row.goal.assignments.map((a) => a.employee),
          },
          estimatedAchievement: await this.previewAchievement(
            companyId,
            row.goal.keyResults,
          ),
        });
      }
    }

    return {
      items,
      page,
      limit,
      total: isAdmin ? total : items.length,
      totalPages: Math.ceil((isAdmin ? total : items.length) / limit) || 1,
    };
  }

  async approve(
    companyId: string,
    userId: string,
    membershipId: string,
    requestId: string,
    dto: ApproveCompletionDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (!granted.has('goals.completion.review')) {
      throw new ForbiddenException(
        'Missing permission: goals.completion.review',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.goalCompletionRequest.findFirst({
        where: { id: requestId, companyId },
      });
      if (!existing)
        throw new NotFoundException('Completion request not found');

      // Lock order: Goal → CompletionRequest
      await tx.$queryRaw`
        SELECT id FROM goals
        WHERE id = ${existing.goalId}::uuid AND "companyId" = ${companyId}::uuid
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT id FROM goal_completion_requests
        WHERE id = ${requestId}::uuid AND "companyId" = ${companyId}::uuid
        FOR UPDATE
      `;

      const request = await tx.goalCompletionRequest.findFirst({
        where: { id: requestId, companyId },
      });
      if (!request) throw new NotFoundException('Completion request not found');
      if (request.status !== GoalCompletionRequestStatus.PENDING) {
        throw new ConflictException('La solicitud ya fue resuelta');
      }
      if (request.requestedByUserId === userId) {
        throw new ForbiddenException(
          'No puedes aprobar una solicitud de cierre que tú mismo creaste',
        );
      }

      const goal = await tx.goal.findFirst({
        where: { id: request.goalId, companyId },
        include: {
          cycle: { select: { status: true } },
          area: { select: { id: true, name: true } },
          assignments: { select: { employeeId: true } },
          keyResults: { orderBy: { order: 'asc' } },
        },
      });
      if (!goal) throw new NotFoundException('Goal not found');
      if (goal.status !== GoalStatus.ACTIVE) {
        throw new BadRequestException('El objetivo debe estar ACTIVE');
      }
      if (goal.cycle.status !== GoalCycleStatus.ACTIVE) {
        throw new BadRequestException('El periodo debe estar ACTIVE');
      }

      const isAdmin = granted.has('goals.goal.manage');
      if (
        !isAdmin &&
        !(await this.canLeaderReviewGoal(companyId, userId, goal))
      ) {
        throw new ForbiddenException(
          'No tienes autoridad para revisar el cierre de este objetivo',
        );
      }

      const latestByKr = await this.loadLatestCheckIns(
        tx,
        companyId,
        goal.keyResults.map((kr) => kr.id),
      );
      for (const kr of goal.keyResults) {
        if (!latestByKr.has(kr.id)) {
          throw new BadRequestException(
            'Cada Key Result debe tener al menos un avance al aprobar el cierre',
          );
        }
      }

      const configuredWeights = goal.keyResults.map((kr) =>
        kr.weight == null ? null : Number(kr.weight.toString()),
      );
      const effectiveRows = computeEffectiveWeights(configuredWeights);

      const krSnapshots = goal.keyResults.map((kr, idx) => {
        const latest = latestByKr.get(kr.id)!;
        const finalNumeric =
          latest.numericValue != null
            ? Number(latest.numericValue.toString())
            : null;
        const finalBoolean = latest.booleanValue;
        const achievementPercentage = calculateKeyResultAchievement({
          metricType: kr.metricType,
          direction: kr.direction,
          startValue:
            kr.startValue != null ? Number(kr.startValue.toString()) : null,
          targetValue:
            kr.targetValue != null ? Number(kr.targetValue.toString()) : null,
          finalNumericValue: finalNumeric,
          finalBooleanValue: finalBoolean,
        });
        return {
          companyId,
          sourceKeyResultId: kr.id,
          title: kr.title,
          description: kr.description,
          metricType: kr.metricType,
          direction: kr.direction,
          startNumericValue: kr.startValue,
          targetNumericValue: kr.targetValue,
          targetBoolean: kr.targetBoolean,
          finalNumericValue: latest.numericValue,
          finalBooleanValue: latest.booleanValue,
          unit: kr.unit,
          currencyCode: kr.currencyCode,
          configuredWeight:
            effectiveRows[idx].configuredWeight == null
              ? null
              : new Prisma.Decimal(
                  effectiveRows[idx].configuredWeight.toFixed(2),
                ),
          effectiveWeight: new Prisma.Decimal(
            effectiveRows[idx].effectiveWeight.toFixed(2),
          ),
          achievementPercentage: new Prisma.Decimal(
            achievementPercentage.toFixed(2),
          ),
          order: kr.order,
        };
      });

      const achievementPercentage = calculateGoalAchievement(
        krSnapshots.map((kr, idx) => ({
          achievementPercentage: Number(kr.achievementPercentage.toString()),
          configuredWeight: configuredWeights[idx],
        })),
      );

      const now = new Date();
      const updatedReq = await tx.goalCompletionRequest.updateMany({
        where: {
          id: requestId,
          companyId,
          status: GoalCompletionRequestStatus.PENDING,
        },
        data: {
          status: GoalCompletionRequestStatus.APPROVED,
          reviewedByUserId: userId,
          reviewedAt: now,
          reviewComment: emptyToNull(dto.reviewComment) ?? null,
        },
      });
      if (updatedReq.count !== 1) {
        throw new ConflictException('La solicitud ya fue resuelta');
      }

      const goalUpdated = await tx.goal.updateMany({
        where: { id: goal.id, companyId, status: GoalStatus.ACTIVE },
        data: { status: GoalStatus.COMPLETED },
      });
      if (goalUpdated.count !== 1) {
        throw new ConflictException(
          'El estado del objetivo cambió concurrentemente',
        );
      }

      // Audience snapshot at approval (09D): freeze who this GoalResult applies to.
      let applicableEmployeeRows: Array<{
        companyId: string;
        employeeId: string;
        areaIdSnapshot: string | null;
        areaNameSnapshot: string | null;
      }> = [];
      if (goal.type === GoalType.INDIVIDUAL) {
        const assignees = await tx.employee.findMany({
          where: {
            companyId,
            id: { in: goal.assignments.map((a) => a.employeeId) },
            deletedAt: null,
          },
          select: {
            id: true,
            areaId: true,
            area: { select: { name: true } },
          },
        });
        applicableEmployeeRows = assignees.map((e) => ({
          companyId,
          employeeId: e.id,
          areaIdSnapshot: e.areaId,
          areaNameSnapshot: e.area.name,
        }));
      } else if (goal.type === GoalType.AREA && goal.areaId) {
        const inArea = await tx.employee.findMany({
          where: {
            companyId,
            areaId: goal.areaId,
            deletedAt: null,
          },
          select: {
            id: true,
            areaId: true,
            area: { select: { name: true } },
          },
        });
        applicableEmployeeRows = inArea.map((e) => ({
          companyId,
          employeeId: e.id,
          areaIdSnapshot: e.areaId,
          areaNameSnapshot: e.area.name,
        }));
      }

      const goalResult = await tx.goalResult.create({
        data: {
          companyId,
          goalId: goal.id,
          completionRequestId: requestId,
          achievementPercentage: new Prisma.Decimal(
            achievementPercentage.toFixed(2),
          ),
          goalConfiguredWeight: goal.weight,
          goalTitleSnapshot: goal.title,
          goalTypeSnapshot: goal.type,
          areaIdSnapshot: goal.areaId,
          areaNameSnapshot: goal.area?.name ?? null,
          appliesCompanyWide: goal.type === GoalType.COMPANY,
          calculatedAt: now,
          completedAt: now,
          requestedByUserId: request.requestedByUserId,
          approvedByUserId: userId,
          keyResults: { create: krSnapshots },
          ...(applicableEmployeeRows.length > 0
            ? { applicableEmployees: { create: applicableEmployeeRows } }
            : {}),
        },
        include: {
          keyResults: { orderBy: { order: 'asc' } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      return { goalResult, goalId: goal.id, achievementPercentage };
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_COMPLETION_APPROVED,
      entity: 'GoalCompletionRequest',
      entityId: requestId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        goalId: result.goalId,
        requestId,
        resultId: result.goalResult.id,
        achievementPercentage: result.achievementPercentage,
      },
    });
    await this.audit.create({
      action: GOALS_AUDIT.GOAL_COMPLETED,
      entity: 'Goal',
      entityId: result.goalId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        goalId: result.goalId,
        requestId,
        resultId: result.goalResult.id,
        achievementPercentage: result.achievementPercentage,
      },
    });
    await this.audit.create({
      action: GOALS_AUDIT.GOAL_RESULT_CREATED,
      entity: 'GoalResult',
      entityId: result.goalResult.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        goalId: result.goalId,
        requestId,
        resultId: result.goalResult.id,
        achievementPercentage: result.achievementPercentage,
      },
    });

    return this.serializeResult(result.goalResult, { includeActors: true });
  }

  async reject(
    companyId: string,
    userId: string,
    membershipId: string,
    requestId: string,
    dto: RejectCompletionDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (!granted.has('goals.completion.review')) {
      throw new ForbiddenException(
        'Missing permission: goals.completion.review',
      );
    }

    const reviewComment = emptyToNull(dto.reviewComment);
    if (!reviewComment) {
      throw new BadRequestException('El comentario de rechazo es obligatorio');
    }

    const rejected = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.goalCompletionRequest.findFirst({
        where: { id: requestId, companyId },
      });
      if (!existing)
        throw new NotFoundException('Completion request not found');

      await tx.$queryRaw`
        SELECT id FROM goals
        WHERE id = ${existing.goalId}::uuid AND "companyId" = ${companyId}::uuid
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT id FROM goal_completion_requests
        WHERE id = ${requestId}::uuid AND "companyId" = ${companyId}::uuid
        FOR UPDATE
      `;

      const request = await tx.goalCompletionRequest.findFirst({
        where: { id: requestId, companyId },
        include: {
          goal: {
            include: {
              assignments: { select: { employeeId: true } },
            },
          },
        },
      });
      if (!request) throw new NotFoundException('Completion request not found');
      if (request.status !== GoalCompletionRequestStatus.PENDING) {
        throw new ConflictException('La solicitud ya fue resuelta');
      }
      if (request.requestedByUserId === userId) {
        throw new ForbiddenException(
          'No puedes rechazar una solicitud de cierre que tú mismo creaste',
        );
      }

      const isAdmin = granted.has('goals.goal.manage');
      if (
        !isAdmin &&
        !(await this.canLeaderReviewGoal(companyId, userId, request.goal))
      ) {
        throw new ForbiddenException(
          'No tienes autoridad para revisar el cierre de este objetivo',
        );
      }

      const updated = await tx.goalCompletionRequest.updateMany({
        where: {
          id: requestId,
          companyId,
          status: GoalCompletionRequestStatus.PENDING,
        },
        data: {
          status: GoalCompletionRequestStatus.REJECTED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          reviewComment,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('La solicitud ya fue resuelta');
      }

      return tx.goalCompletionRequest.findFirstOrThrow({
        where: { id: requestId, companyId },
        include: this.requestInclude(),
      });
    });

    await this.audit.create({
      action: GOALS_AUDIT.GOAL_COMPLETION_REJECTED,
      entity: 'GoalCompletionRequest',
      entityId: requestId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalId: rejected.goalId, requestId },
    });

    return this.serializeRequest(rejected, { includeComments: true });
  }

  async getResult(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    await this.assertCanAccessGoal(companyId, userId, membershipId, goalId);
    const result = await this.prisma.goalResult.findFirst({
      where: { companyId, goalId },
      include: {
        keyResults: { orderBy: { order: 'asc' } },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        completionRequest: {
          select: {
            id: true,
            requestComment: true,
            reviewComment: true,
            requestedAt: true,
            reviewedAt: true,
          },
        },
      },
    });
    if (!result) throw new NotFoundException('Goal result not found');

    const privacy = await this.commentPrivacy(
      companyId,
      userId,
      membershipId,
      goalId,
    );
    return this.serializeResult(result, {
      includeActors: privacy.showActors,
      includeComments: privacy.showComments,
      completionRequest: result.completionRequest,
    });
  }

  async getPendingForGoals(
    companyId: string,
    goalIds: string[],
  ): Promise<Map<string, { id: string; requestedAt: Date; status: string }>> {
    const map = new Map<
      string,
      { id: string; requestedAt: Date; status: string }
    >();
    if (goalIds.length === 0) return map;
    const rows = await this.prisma.goalCompletionRequest.findMany({
      where: {
        companyId,
        goalId: { in: goalIds },
        status: GoalCompletionRequestStatus.PENDING,
      },
      select: { id: true, goalId: true, requestedAt: true, status: true },
    });
    for (const r of rows) {
      map.set(r.goalId, {
        id: r.id,
        requestedAt: r.requestedAt,
        status: r.status,
      });
    }
    return map;
  }

  async getLatestRejectedForGoals(
    companyId: string,
    goalIds: string[],
  ): Promise<
    Map<
      string,
      { id: string; reviewComment: string | null; reviewedAt: Date | null }
    >
  > {
    const map = new Map<
      string,
      { id: string; reviewComment: string | null; reviewedAt: Date | null }
    >();
    if (goalIds.length === 0) return map;
    const rows = await this.prisma.goalCompletionRequest.findMany({
      where: {
        companyId,
        goalId: { in: goalIds },
        status: GoalCompletionRequestStatus.REJECTED,
      },
      orderBy: { reviewedAt: 'desc' },
      select: {
        id: true,
        goalId: true,
        reviewComment: true,
        reviewedAt: true,
      },
    });
    for (const r of rows) {
      if (!map.has(r.goalId)) {
        map.set(r.goalId, {
          id: r.id,
          reviewComment: r.reviewComment,
          reviewedAt: r.reviewedAt,
        });
      }
    }
    return map;
  }

  async getResultsForGoals(companyId: string, goalIds: string[]) {
    const map = new Map<
      string,
      { achievementPercentage: string; completedAt: Date }
    >();
    if (goalIds.length === 0) return map;
    const rows = await this.prisma.goalResult.findMany({
      where: { companyId, goalId: { in: goalIds } },
      select: {
        goalId: true,
        achievementPercentage: true,
        completedAt: true,
      },
    });
    for (const r of rows) {
      map.set(r.goalId, {
        achievementPercentage: decimalToString(r.achievementPercentage)!,
        completedAt: r.completedAt,
      });
    }
    return map;
  }

  private async previewAchievement(
    companyId: string,
    keyResults: Array<{
      id: string;
      metricType: GoalMetricType;
      direction: 'INCREASE' | 'DECREASE' | null;
      startValue: Prisma.Decimal | null;
      targetValue: Prisma.Decimal | null;
      weight: Prisma.Decimal | null;
    }>,
  ) {
    const latest = await this.loadLatestCheckIns(
      this.prisma,
      companyId,
      keyResults.map((kr) => kr.id),
    );
    const rows = keyResults.map((kr) => {
      const checkIn = latest.get(kr.id);
      const achievementPercentage = checkIn
        ? calculateKeyResultAchievement({
            metricType: kr.metricType,
            direction: kr.direction,
            startValue:
              kr.startValue != null ? Number(kr.startValue.toString()) : null,
            targetValue:
              kr.targetValue != null ? Number(kr.targetValue.toString()) : null,
            finalNumericValue:
              checkIn.numericValue != null
                ? Number(checkIn.numericValue.toString())
                : null,
            finalBooleanValue: checkIn.booleanValue,
          })
        : 0;
      return {
        keyResultId: kr.id,
        achievementPercentage,
        configuredWeight:
          kr.weight == null ? null : Number(kr.weight.toString()),
      };
    });
    return {
      label: 'Cumplimiento estimado',
      achievementPercentage: calculateGoalAchievement(rows),
      keyResults: rows,
    };
  }

  private async canLeaderReviewGoal(
    companyId: string,
    userId: string,
    goal: {
      type: GoalType;
      assignments: Array<{ employeeId: string }>;
    },
  ): Promise<boolean> {
    if (goal.type !== GoalType.INDIVIDUAL) return false;
    if (goal.assignments.length === 0) return false;

    const manager = await this.findEmployeeForUser(companyId, userId);
    if (!manager) return false;

    const lines = await this.prisma.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: manager.id,
        type: ReportingLineType.DIRECT,
        employeeId: { in: goal.assignments.map((a) => a.employeeId) },
      },
      select: { employeeId: true },
    });
    const managed = new Set(lines.map((l) => l.employeeId));
    return goal.assignments.every((a) => managed.has(a.employeeId));
  }

  private async commentPrivacy(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (granted.has('goals.goal.manage')) {
      return { showComments: true, showActors: true };
    }

    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, companyId },
      include: { assignments: { select: { employeeId: true } } },
    });
    if (!goal) return { showComments: false, showActors: false };

    const employee = await this.findEmployeeForUser(companyId, userId);
    if (employee) {
      const assignment = await this.prisma.goalAssignment.findFirst({
        where: { companyId, goalId, employeeId: employee.id },
      });
      if (assignment) return { showComments: true, showActors: true };
    }

    // Review permission alone is not enough: only DIRECT INDIVIDUAL reviewers.
    if (
      granted.has('goals.completion.review') &&
      (await this.canLeaderReviewGoal(companyId, userId, goal))
    ) {
      return { showComments: true, showActors: true };
    }

    return { showComments: false, showActors: false };
  }

  /**
   * Redact rejection reviewComment for list/mine enrichments.
   * Viewers of AREA/COMPANY (non-assignee, non-authorized reviewer) must not see comments.
   */
  async redactRejectionCommentsForViewer(
    companyId: string,
    userId: string,
    membershipId: string,
    goals: Array<{
      id: string;
      type: GoalType;
      assignments: Array<{ employeeId: string }>;
    }>,
    rejected: Map<
      string,
      { id: string; reviewComment: string | null; reviewedAt: Date | null }
    >,
  ): Promise<
    Map<
      string,
      { id: string; reviewComment: string | null; reviewedAt: Date | null }
    >
  > {
    if (rejected.size === 0) return rejected;

    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (granted.has('goals.goal.manage')) return rejected;

    const employee = await this.findEmployeeForUser(companyId, userId);
    const assignedGoalIds = new Set<string>();
    if (employee) {
      const rows = await this.prisma.goalAssignment.findMany({
        where: {
          companyId,
          employeeId: employee.id,
          goalId: { in: goals.map((g) => g.id) },
        },
        select: { goalId: true },
      });
      for (const r of rows) assignedGoalIds.add(r.goalId);
    }

    let directReportIds = new Set<string>();
    if (employee && granted.has('goals.completion.review')) {
      const lines = await this.prisma.employeeReportingLine.findMany({
        where: {
          companyId,
          managerEmployeeId: employee.id,
          type: ReportingLineType.DIRECT,
        },
        select: { employeeId: true },
      });
      directReportIds = new Set(lines.map((l) => l.employeeId));
    }

    const out = new Map<
      string,
      { id: string; reviewComment: string | null; reviewedAt: Date | null }
    >();
    for (const [goalId, row] of rejected) {
      const goal = goals.find((g) => g.id === goalId);
      let show = assignedGoalIds.has(goalId);
      if (
        !show &&
        goal &&
        goal.type === GoalType.INDIVIDUAL &&
        granted.has('goals.completion.review') &&
        goal.assignments.length > 0 &&
        goal.assignments.every((a) => directReportIds.has(a.employeeId))
      ) {
        show = true;
      }
      out.set(goalId, {
        ...row,
        reviewComment: show ? row.reviewComment : null,
      });
    }
    return out;
  }

  private async assertCanAccessGoal(
    companyId: string,
    userId: string,
    membershipId: string,
    goalId: string,
  ) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, companyId },
      include: { assignments: { select: { employeeId: true } } },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    if (granted.has('goals.goal.manage')) return goal;

    const employee = await this.findEmployeeForUser(companyId, userId);
    if (
      employee &&
      this.isApplicable(goal, employee) &&
      (goal.status === GoalStatus.ACTIVE ||
        goal.status === GoalStatus.COMPLETED)
    ) {
      return goal;
    }

    // Leader DIRECT visibility for ACTIVE/COMPLETED
    if (employee) {
      const reports = await this.prisma.employeeReportingLine.findMany({
        where: {
          companyId,
          managerEmployeeId: employee.id,
          type: ReportingLineType.DIRECT,
        },
        include: {
          employee: { select: { id: true, areaId: true, deletedAt: true } },
        },
      });
      const ok = reports.some(
        (r) =>
          r.employee.deletedAt == null &&
          this.isApplicable(goal, r.employee) &&
          (goal.status === GoalStatus.ACTIVE ||
            goal.status === GoalStatus.COMPLETED),
      );
      if (ok) return goal;
    }

    throw new NotFoundException('Goal not found');
  }

  private isApplicable(
    goal: {
      type: GoalType;
      areaId: string | null;
      assignments: Array<{ employeeId: string }>;
    },
    employee: { id: string; areaId: string },
  ): boolean {
    if (goal.type === GoalType.COMPANY) return true;
    if (goal.type === GoalType.AREA) return goal.areaId === employee.areaId;
    return goal.assignments.some((a) => a.employeeId === employee.id);
  }

  private async loadLatestCheckIns(
    db: Prisma.TransactionClient | PrismaService,
    companyId: string,
    keyResultIds: string[],
  ) {
    const map = new Map<
      string,
      {
        numericValue: Prisma.Decimal | null;
        booleanValue: boolean | null;
        sequence: number;
      }
    >();
    if (keyResultIds.length === 0) return map;
    const rows = await db.goalCheckIn.findMany({
      where: { companyId, keyResultId: { in: keyResultIds } },
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      select: {
        keyResultId: true,
        numericValue: true,
        booleanValue: true,
        sequence: true,
      },
    });
    for (const row of rows) {
      if (!map.has(row.keyResultId)) map.set(row.keyResultId, row);
    }
    return map;
  }

  private requestInclude() {
    return {
      requestedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      requestedByEmployee: {
        select: { id: true, firstName: true, lastName: true },
      },
      reviewedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    } as const;
  }

  private serializeRequest(
    r: {
      id: string;
      companyId: string;
      goalId: string;
      status: GoalCompletionRequestStatus;
      requestedByUserId: string;
      requestedByEmployeeId: string | null;
      requestedAt: Date;
      requestComment: string | null;
      reviewedByUserId: string | null;
      reviewedAt: Date | null;
      reviewComment: string | null;
      createdAt: Date;
      updatedAt: Date;
      requestedBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      requestedByEmployee?: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
      reviewedBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    },
    opts: { includeComments: boolean },
  ) {
    return {
      id: r.id,
      companyId: r.companyId,
      goalId: r.goalId,
      status: r.status,
      requestedByUserId: r.requestedByUserId,
      requestedByEmployeeId: r.requestedByEmployeeId,
      requestedAt: r.requestedAt,
      requestComment: opts.includeComments ? r.requestComment : null,
      reviewedByUserId: r.reviewedByUserId,
      reviewedAt: r.reviewedAt,
      reviewComment: opts.includeComments ? r.reviewComment : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      requestedBy: r.requestedBy ?? null,
      requestedByEmployee: r.requestedByEmployee ?? null,
      reviewedBy: opts.includeComments ? (r.reviewedBy ?? null) : null,
    };
  }

  private serializeResult(
    result: {
      id: string;
      companyId: string;
      goalId: string;
      completionRequestId: string;
      achievementPercentage: Prisma.Decimal;
      goalConfiguredWeight: Prisma.Decimal | null;
      calculatedAt: Date;
      completedAt: Date;
      requestedByUserId: string;
      approvedByUserId: string;
      createdAt: Date;
      keyResults: Array<{
        id: string;
        sourceKeyResultId: string | null;
        title: string;
        description: string | null;
        metricType: GoalMetricType;
        direction: 'INCREASE' | 'DECREASE' | null;
        startNumericValue: Prisma.Decimal | null;
        targetNumericValue: Prisma.Decimal | null;
        targetBoolean: boolean | null;
        finalNumericValue: Prisma.Decimal | null;
        finalBooleanValue: boolean | null;
        unit: string | null;
        currencyCode: string | null;
        configuredWeight: Prisma.Decimal | null;
        effectiveWeight: Prisma.Decimal | null;
        achievementPercentage: Prisma.Decimal;
        order: number;
      }>;
      requestedBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      approvedBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    },
    opts: {
      includeActors: boolean;
      includeComments?: boolean;
      completionRequest?: {
        id: string;
        requestComment: string | null;
        reviewComment: string | null;
        requestedAt: Date;
        reviewedAt: Date | null;
      };
    },
  ) {
    return {
      id: result.id,
      companyId: result.companyId,
      goalId: result.goalId,
      completionRequestId: result.completionRequestId,
      achievementPercentage: decimalToString(result.achievementPercentage),
      goalConfiguredWeight: decimalToString(result.goalConfiguredWeight),
      calculatedAt: result.calculatedAt,
      completedAt: result.completedAt,
      requestedByUserId: result.requestedByUserId,
      approvedByUserId: result.approvedByUserId,
      createdAt: result.createdAt,
      requestedBy: opts.includeActors ? (result.requestedBy ?? null) : null,
      approvedBy: opts.includeActors ? (result.approvedBy ?? null) : null,
      completionRequest: opts.completionRequest
        ? {
            id: opts.completionRequest.id,
            requestedAt: opts.completionRequest.requestedAt,
            reviewedAt: opts.completionRequest.reviewedAt,
            requestComment: opts.includeComments
              ? opts.completionRequest.requestComment
              : null,
            reviewComment: opts.includeComments
              ? opts.completionRequest.reviewComment
              : null,
          }
        : undefined,
      keyResults: result.keyResults.map((kr) => ({
        id: kr.id,
        sourceKeyResultId: kr.sourceKeyResultId,
        title: kr.title,
        description: kr.description,
        metricType: kr.metricType,
        direction: kr.direction,
        startNumericValue: decimalToString(kr.startNumericValue),
        targetNumericValue: decimalToString(kr.targetNumericValue),
        targetBoolean: kr.targetBoolean,
        finalNumericValue: decimalToString(kr.finalNumericValue),
        finalBooleanValue: kr.finalBooleanValue,
        unit: kr.unit,
        currencyCode: kr.currencyCode,
        configuredWeight: decimalToString(kr.configuredWeight),
        effectiveWeight: decimalToString(kr.effectiveWeight),
        achievementPercentage: decimalToString(kr.achievementPercentage),
        order: kr.order,
      })),
    };
  }

  private async findEmployeeForUser(companyId: string, userId: string) {
    return this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, areaId: true },
    });
  }
}
