import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalType,
  PerformanceCycleStatus,
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
  Prisma,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildCyclePhases,
  canEditEvaluationInCyclePhase,
  type CyclePhaseSource,
} from '../cycle-phases';
import {
  canAccessEvaluation,
  canRespondToEvaluation,
} from '../evaluation-access';
import {
  calculateEvaluationScore,
  ScoreCalculationError,
} from '../evaluation-score';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import { decimalToString } from '../performance.helpers';
import type { UpsertEvaluationResponseDto } from './dto/evaluation-response.dto';

const CYCLE_WINDOWS_SELECT = {
  status: true,
  startDate: true,
  endDate: true,
  evaluationStartDate: true,
  evaluationEndDate: true,
  goalDefinitionStartDate: true,
  goalDefinitionEndDate: true,
  managerEvaluationStartDate: true,
  managerEvaluationEndDate: true,
  calibrationStartDate: true,
  calibrationEndDate: true,
  closingStartDate: true,
  closingEndDate: true,
  followUps: {
    select: {
      id: true,
      order: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { order: 'asc' as const },
  },
} as const;

const CYCLE_MINE_SELECT = {
  id: true,
  name: true,
  goalCycleId: true,
  ...CYCLE_WINDOWS_SELECT,
} as const;

const EVALUATION_INCLUDE = {
  cycle: {
    select: CYCLE_MINE_SELECT,
  },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      area: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  },
  evaluatorEmployee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  participant: {
    select: { id: true, status: true },
  },
  competencies: {
    include: {
      levels: { orderBy: { order: 'asc' as const } },
      response: {
        select: {
          id: true,
          selectedScaleLevelId: true,
          ratingValue: true,
          comment: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { order: 'asc' as const },
  },
} as const;

type LockedEvaluation = {
  id: string;
  companyId: string;
  cycleId: string;
  participantId: string;
  employeeId: string;
  evaluatorEmployeeId: string | null;
  type: PerformanceEvaluationType;
  status: PerformanceEvaluationStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  scorePercentage: Prisma.Decimal | null;
};

type MineCycleFollowUpRecord = {
  id: string;
  order: number;
  startDate: Date;
  endDate: Date;
};

type MineCycleRecord = {
  id: string;
  name: string;
  status: PerformanceCycleStatus;
  startDate: Date;
  endDate: Date;
  evaluationStartDate: Date | null;
  evaluationEndDate: Date | null;
  goalDefinitionStartDate: Date | null;
  goalDefinitionEndDate: Date | null;
  managerEvaluationStartDate: Date | null;
  managerEvaluationEndDate: Date | null;
  calibrationStartDate: Date | null;
  calibrationEndDate: Date | null;
  closingStartDate: Date | null;
  closingEndDate: Date | null;
  goalCycleId: string | null;
  followUps: MineCycleFollowUpRecord[];
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateOnlyOrNull(value: Date | null | undefined): string | null {
  return value ? dateOnly(value) : null;
}

function serializeMineCycle(cycle: MineCycleRecord) {
  return {
    id: cycle.id,
    name: cycle.name,
    status: cycle.status,
    startDate: dateOnly(cycle.startDate),
    endDate: dateOnly(cycle.endDate),
    evaluationStartDate: dateOnlyOrNull(cycle.evaluationStartDate),
    evaluationEndDate: dateOnlyOrNull(cycle.evaluationEndDate),
    goalDefinitionStartDate: dateOnlyOrNull(cycle.goalDefinitionStartDate),
    goalDefinitionEndDate: dateOnlyOrNull(cycle.goalDefinitionEndDate),
    managerEvaluationStartDate: dateOnlyOrNull(
      cycle.managerEvaluationStartDate,
    ),
    managerEvaluationEndDate: dateOnlyOrNull(cycle.managerEvaluationEndDate),
    calibrationStartDate: dateOnlyOrNull(cycle.calibrationStartDate),
    calibrationEndDate: dateOnlyOrNull(cycle.calibrationEndDate),
    closingStartDate: dateOnlyOrNull(cycle.closingStartDate),
    closingEndDate: dateOnlyOrNull(cycle.closingEndDate),
    goalCycleId: cycle.goalCycleId,
    followUps: cycle.followUps.map((row) => ({
      id: row.id,
      order: row.order,
      startDate: dateOnly(row.startDate),
      endDate: dateOnly(row.endDate),
    })),
  };
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async listMine(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!employee) {
      return { self: [], asManager: [], leaderCycles: [] };
    }

    const evaluations = await this.prisma.performanceEvaluation.findMany({
      where: {
        companyId,
        participant: {
          status: { not: PerformanceParticipantStatus.EXCLUDED },
        },
        OR: [
          {
            type: PerformanceEvaluationType.SELF,
            employeeId: employee.id,
          },
          {
            type: { not: PerformanceEvaluationType.SELF },
            evaluatorEmployeeId: employee.id,
          },
        ],
      },
      include: {
        cycle: {
          select: CYCLE_MINE_SELECT,
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        evaluatorEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            competencies: true,
            responses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const self = evaluations
      .filter((e) => e.type === PerformanceEvaluationType.SELF)
      .map((e) => this.serializeMineItem(e));
    const asManager = evaluations
      .filter((e) => e.type !== PerformanceEvaluationType.SELF)
      .map((e) => this.serializeMineItem(e));

    const knownCycleIds = new Set(evaluations.map((e) => e.cycleId));
    const reportIds = (
      await this.prisma.employeeReportingLine.findMany({
        where: {
          companyId,
          managerEmployeeId: employee.id,
          type: ReportingLineType.DIRECT,
        },
        select: { employeeId: true },
      })
    ).map((row) => row.employeeId);
    const leaderCycles =
      reportIds.length === 0
        ? []
        : (
            await this.prisma.performanceCycle.findMany({
              where: {
                companyId,
                id: { notIn: [...knownCycleIds] },
                participants: {
                  some: {
                    employeeId: { in: reportIds },
                    status: { not: PerformanceParticipantStatus.EXCLUDED },
                  },
                },
              },
              select: CYCLE_MINE_SELECT,
              orderBy: { startDate: 'desc' },
            })
          ).map((cycle) => serializeMineCycle(cycle));

    return { self, asManager, leaderCycles };
  }

  async getById(
    companyId: string,
    userId: string,
    membershipId: string,
    evaluationId: string,
  ) {
    const evaluation = await this.prisma.performanceEvaluation.findFirst({
      where: { id: evaluationId, companyId },
      include: EVALUATION_INCLUDE,
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const hasManage = granted.has('performance.evaluation.manage');

    const actorEmployee = await this.resolveActorEmployee(companyId, userId);

    const allowed = canAccessEvaluation({
      hasManagePermission: hasManage,
      actorEmployeeId: actorEmployee?.id ?? null,
      evaluation: {
        employeeId: evaluation.employeeId,
        evaluatorEmployeeId: evaluation.evaluatorEmployeeId,
        type: evaluation.type,
      },
    });

    if (!allowed) {
      throw new ForbiddenException(
        'No tienes permiso para ver esta evaluación',
      );
    }

    const canRespond = canRespondToEvaluation({
      hasRespondPermission: granted.has('performance.evaluation.respond'),
      actorEmployeeId: actorEmployee?.id ?? null,
      evaluatorEmployeeId: evaluation.evaluatorEmployeeId,
    });

    return this.serializeEvaluationWorkspace(evaluation, {
      canRespond,
      actorEmployeeId: actorEmployee?.id ?? null,
    });
  }

  async upsertResponse(
    companyId: string,
    userId: string,
    membershipId: string,
    evaluationId: string,
    evaluationCompetencyId: string,
    dto: UpsertEvaluationResponseDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const hasRespond = granted.has('performance.evaluation.respond');
    const actorEmployee = await this.resolveActorEmployee(companyId, userId);
    if (!actorEmployee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockEvaluation(tx, companyId, evaluationId);
      this.assertWritableEvaluation(locked);

      if (
        !canRespondToEvaluation({
          hasRespondPermission: hasRespond,
          actorEmployeeId: actorEmployee.id,
          evaluatorEmployeeId: locked.evaluatorEmployeeId,
        })
      ) {
        throw new ForbiddenException(
          'Only the assigned evaluator can save responses',
        );
      }

      const cycle = await tx.performanceCycle.findFirst({
        where: { id: locked.cycleId, companyId },
        select: CYCLE_WINDOWS_SELECT,
      });
      if (!cycle || cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Responses can only be saved while the cycle is ACTIVE',
        );
      }
      this.assertWritableInCurrentPhase(locked.type, cycle);

      const participant = await tx.performanceCycleParticipant.findFirst({
        where: { id: locked.participantId, companyId },
        select: { status: true },
      });
      if (
        !participant ||
        participant.status !== PerformanceParticipantStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Responses cannot be saved for an excluded participant',
        );
      }

      const competency = await tx.performanceEvaluationCompetency.findFirst({
        where: {
          id: evaluationCompetencyId,
          evaluationId,
          companyId,
        },
        include: { levels: true },
      });
      if (!competency) {
        throw new NotFoundException('Evaluation competency not found');
      }

      const level = competency.levels.find((l) => l.id === dto.scaleLevelId);
      if (!level) {
        throw new BadRequestException(
          'scaleLevelId must belong to this competency snapshot',
        );
      }

      const comment =
        dto.comment === undefined
          ? undefined
          : dto.comment == null || dto.comment.trim() === ''
            ? null
            : dto.comment.trim();

      const response = await tx.performanceEvaluationResponse.upsert({
        where: {
          evaluationId_evaluationCompetencyId: {
            evaluationId,
            evaluationCompetencyId,
          },
        },
        create: {
          companyId,
          evaluationId,
          evaluationCompetencyId,
          selectedScaleLevelId: level.id,
          ratingValue: level.value,
          comment: comment ?? null,
        },
        update: {
          selectedScaleLevelId: level.id,
          ratingValue: level.value,
          ...(comment !== undefined ? { comment } : {}),
        },
      });

      if (locked.status === PerformanceEvaluationStatus.PENDING) {
        await tx.performanceEvaluation.update({
          where: { id: evaluationId },
          data: {
            status: PerformanceEvaluationStatus.IN_PROGRESS,
            startedAt: locked.startedAt ?? new Date(),
          },
        });
      }

      return {
        response,
        type: locked.type,
      };
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_RESPONSE_SAVED,
      entity: 'PerformanceEvaluationResponse',
      entityId: result.response.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        evaluationId,
        evaluationCompetencyId,
        selectedScaleLevelId: result.response.selectedScaleLevelId,
        type: result.type,
      },
    });

    return {
      id: result.response.id,
      evaluationId: result.response.evaluationId,
      evaluationCompetencyId: result.response.evaluationCompetencyId,
      selectedScaleLevelId: result.response.selectedScaleLevelId,
      ratingValue: result.response.ratingValue,
      comment: result.response.comment,
      createdAt: result.response.createdAt,
      updatedAt: result.response.updatedAt,
    };
  }

  async upsertGoalRating(
    companyId: string,
    userId: string,
    membershipId: string,
    evaluationId: string,
    goalId: string,
    dto: UpsertEvaluationResponseDto,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const hasRespond = granted.has('performance.evaluation.respond');
    const actorEmployee = await this.resolveActorEmployee(companyId, userId);
    if (!actorEmployee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockEvaluation(tx, companyId, evaluationId);
      this.assertWritableEvaluation(locked);
      if (
        !canRespondToEvaluation({
          hasRespondPermission: hasRespond,
          actorEmployeeId: actorEmployee.id,
          evaluatorEmployeeId: locked.evaluatorEmployeeId,
        })
      ) {
        throw new ForbiddenException(
          'Only the assigned evaluator can save responses',
        );
      }
      const cycle = await tx.performanceCycle.findFirst({
        where: { id: locked.cycleId, companyId },
        select: CYCLE_WINDOWS_SELECT,
      });
      if (!cycle || cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Responses can only be saved while the cycle is ACTIVE',
        );
      }
      this.assertWritableInCurrentPhase(locked.type, cycle);

      const goals = await this.assignedIndividualGoals(
        tx,
        companyId,
        locked.cycleId,
        locked.employeeId,
      );
      const goal = goals.find((row) => row.id === goalId);
      if (!goal) throw new NotFoundException('Objetivo no encontrado');
      if (!goal.scaleId) {
        throw new BadRequestException('El objetivo no tiene escala');
      }
      const level = await tx.competencyScaleLevel.findFirst({
        where: {
          id: dto.scaleLevelId,
          scaleId: goal.scaleId,
          companyId,
        },
      });
      if (!level) {
        throw new BadRequestException(
          'El nivel no pertenece a la escala del objetivo',
        );
      }
      const comment =
        dto.comment === undefined
          ? undefined
          : dto.comment == null || dto.comment.trim() === ''
            ? null
            : dto.comment.trim();
      const rating = await tx.performanceGoalRating.upsert({
        where: { evaluationId_goalId: { evaluationId, goalId } },
        create: {
          companyId,
          evaluationId,
          goalId,
          selectedScaleLevelId: level.id,
          ratingValue: level.value,
          comment: comment ?? null,
        },
        update: {
          selectedScaleLevelId: level.id,
          ratingValue: level.value,
          ...(comment !== undefined ? { comment } : {}),
        },
      });
      if (locked.status === PerformanceEvaluationStatus.PENDING) {
        await tx.performanceEvaluation.update({
          where: { id: evaluationId },
          data: {
            status: PerformanceEvaluationStatus.IN_PROGRESS,
            startedAt: locked.startedAt ?? new Date(),
          },
        });
      }
      return rating;
    });

    return {
      id: result.id,
      evaluationId: result.evaluationId,
      goalId: result.goalId,
      selectedScaleLevelId: result.selectedScaleLevelId,
      ratingValue: result.ratingValue,
      comment: result.comment,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async submit(
    companyId: string,
    userId: string,
    membershipId: string,
    evaluationId: string,
  ) {
    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const hasRespond = granted.has('performance.evaluation.respond');
    const actorEmployee = await this.resolveActorEmployee(companyId, userId);
    if (!actorEmployee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }

    const submitted = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockEvaluation(tx, companyId, evaluationId);

      if (locked.status === PerformanceEvaluationStatus.SUBMITTED) {
        throw new ConflictException('Evaluation is already submitted');
      }
      // Only PENDING / IN_PROGRESS remain for submit.

      if (
        !canRespondToEvaluation({
          hasRespondPermission: hasRespond,
          actorEmployeeId: actorEmployee.id,
          evaluatorEmployeeId: locked.evaluatorEmployeeId,
        })
      ) {
        throw new ForbiddenException(
          'Only the assigned evaluator can submit this evaluation',
        );
      }

      const cycle = await tx.performanceCycle.findFirst({
        where: { id: locked.cycleId, companyId },
        select: CYCLE_WINDOWS_SELECT,
      });
      if (!cycle || cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Evaluations can only be submitted while the cycle is ACTIVE',
        );
      }
      this.assertWritableInCurrentPhase(locked.type, cycle);

      const participant = await tx.performanceCycleParticipant.findFirst({
        where: { id: locked.participantId, companyId },
        select: { status: true },
      });
      if (
        !participant ||
        participant.status !== PerformanceParticipantStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Cannot submit evaluation for an excluded participant',
        );
      }

      const competencies = await tx.performanceEvaluationCompetency.findMany({
        where: { evaluationId, companyId },
        include: {
          levels: { orderBy: { order: 'asc' } },
          response: true,
        },
        orderBy: { order: 'asc' },
      });

      const missingRequired = competencies
        .filter((c) => c.required && !c.response)
        .map((c) => ({ id: c.id, name: c.name }));
      if (missingRequired.length > 0) {
        throw new BadRequestException({
          message: 'Required competencies are missing responses',
          missingRequired,
        });
      }

      const assignedGoals = await this.assignedIndividualGoals(
        tx,
        companyId,
        locked.cycleId,
        locked.employeeId,
      );
      const rateableGoals = assignedGoals.filter((goal) => goal.scaleId);
      if (rateableGoals.length > 0) {
        const ratings = await tx.performanceGoalRating.findMany({
          where: { evaluationId, companyId },
          select: { goalId: true, selectedScaleLevelId: true },
        });
        const rated = new Set(
          ratings
            .filter((row) => row.selectedScaleLevelId)
            .map((row) => row.goalId),
        );
        const missingGoals = rateableGoals.filter((goal) => !rated.has(goal.id));
        if (missingGoals.length > 0) {
          throw new BadRequestException({
            message: 'Debes calificar todos los objetivos',
            missingGoals: missingGoals.map((goal) => ({
              id: goal.id,
              title: goal.title,
            })),
          });
        }
      }

      const answered = competencies.filter((c) => c.response != null);
      if (answered.length === 0 && assignedGoals.length === 0) {
        throw new BadRequestException(
          'La evaluación debe tener al menos una respuesta.',
        );
      }

      let score;
      try {
        score = calculateEvaluationScore(
          competencies.map((c) => ({
            id: c.id,
            required: c.required,
            weight: c.weight == null ? null : Number(c.weight.toString()),
            levels: c.levels.map((l) => ({ value: l.value })),
            response: c.response
              ? { ratingValue: c.response.ratingValue }
              : null,
          })),
        );
      } catch (error) {
        if (error instanceof ScoreCalculationError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const now = new Date();
      const updated = await tx.performanceEvaluation.update({
        where: { id: evaluationId },
        data: {
          status: PerformanceEvaluationStatus.SUBMITTED,
          submittedAt: now,
          startedAt: locked.startedAt ?? now,
          scorePercentage: new Prisma.Decimal(score.scorePercentage.toFixed(2)),
        },
        include: EVALUATION_INCLUDE,
      });

      return {
        updated,
        scorePercentage: score.scorePercentage,
        type: locked.type,
      };
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_SUBMITTED,
      entity: 'PerformanceEvaluation',
      entityId: evaluationId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        evaluationId,
        type: submitted.type,
        scorePercentage: submitted.scorePercentage,
      },
    });

    return this.serializeEvaluationWorkspace(submitted.updated, {
      canRespond: false,
      actorEmployeeId: actorEmployee.id,
    });
  }

  private async resolveActorEmployee(companyId: string, userId: string) {
    return this.prisma.employee.findFirst({
      where: {
        companyId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  private async lockEvaluation(
    tx: Prisma.TransactionClient,
    companyId: string,
    evaluationId: string,
  ): Promise<LockedEvaluation> {
    const rows = await tx.$queryRaw<LockedEvaluation[]>`
      SELECT
        id,
        "companyId",
        "cycleId",
        "participantId",
        "employeeId",
        "evaluatorEmployeeId",
        type,
        status,
        "startedAt",
        "submittedAt",
        "scorePercentage"
      FROM performance_evaluations
      WHERE id = ${evaluationId}::uuid
        AND "companyId" = ${companyId}::uuid
      FOR UPDATE
    `;
    const evaluation = rows[0];
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }
    return evaluation;
  }

  private assertWritableEvaluation(evaluation: LockedEvaluation) {
    if (evaluation.status === PerformanceEvaluationStatus.SUBMITTED) {
      throw new ConflictException('Submitted evaluations cannot be modified');
    }
  }

  private assertWritableInCurrentPhase(
    evaluationType: PerformanceEvaluationType,
    cycle: CyclePhaseSource,
  ) {
    const phases = buildCyclePhases(cycle);
    if (
      !canEditEvaluationInCyclePhase({
        cycleStatus: cycle.status,
        evaluationType,
        phases,
      })
    ) {
      throw new BadRequestException(
        'Solo puedes editar evaluaciones en la fase actual del ciclo',
      );
    }
  }

  private serializeMineItem(evaluation: {
    id: string;
    companyId: string;
    cycleId: string;
    participantId: string;
    employeeId: string;
    evaluatorEmployeeId: string | null;
    type: PerformanceEvaluationType;
    status: string;
    scorePercentage?: Prisma.Decimal | null;
    createdAt: Date;
    updatedAt: Date;
    cycle: MineCycleRecord;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    evaluatorEmployee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    _count?: { competencies: number; responses: number };
  }) {
    return {
      id: evaluation.id,
      companyId: evaluation.companyId,
      cycleId: evaluation.cycleId,
      participantId: evaluation.participantId,
      employeeId: evaluation.employeeId,
      evaluatorEmployeeId: evaluation.evaluatorEmployeeId,
      type: evaluation.type,
      status: evaluation.status,
      scorePercentage: decimalToString(evaluation.scorePercentage ?? null),
      respondedCount: evaluation._count?.responses ?? 0,
      competencyCount: evaluation._count?.competencies ?? 0,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
      cycle: serializeMineCycle(evaluation.cycle),
      employee: evaluation.employee,
      evaluatorEmployee: evaluation.evaluatorEmployee,
    };
  }

  private serializeEvaluationDetail(
    evaluation: {
      id: string;
      companyId: string;
      cycleId: string;
      participantId: string;
      employeeId: string;
      evaluatorEmployeeId: string | null;
      type: PerformanceEvaluationType;
      status: string;
      startedAt: Date | null;
      submittedAt: Date | null;
      scorePercentage?: Prisma.Decimal | null;
      createdAt: Date;
      updatedAt: Date;
      cycle: MineCycleRecord;
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        area: { id: string; name: string };
        position: { id: string; name: string };
      };
      evaluatorEmployee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
      participant: { id: string; status: string };
      competencies: Array<{
        id: string;
        sourceCompetencyId: string | null;
        sourceScaleId: string | null;
        name: string;
        code: string | null;
        description: string | null;
        scaleName: string;
        weight: Prisma.Decimal | null;
        required: boolean;
        order: number;
        levels: Array<{
          id: string;
          sourceScaleLevelId: string | null;
          value: number;
          label: string;
          description: string | null;
          order: number;
        }>;
        response?: {
          id: string;
          selectedScaleLevelId: string;
          ratingValue: number;
          comment: string | null;
          updatedAt: Date;
        } | null;
      }>;
    },
    meta: { canRespond: boolean; actorEmployeeId: string | null },
  ) {
    const cycleActive =
      evaluation.cycle.status === PerformanceCycleStatus.ACTIVE;
    const participantActive =
      evaluation.participant.status === PerformanceParticipantStatus.ACTIVE;
    const notSubmitted =
      evaluation.status !== PerformanceEvaluationStatus.SUBMITTED;
    const phaseEditable = canEditEvaluationInCyclePhase({
      cycleStatus: evaluation.cycle.status,
      evaluationType: evaluation.type,
      phases: buildCyclePhases(evaluation.cycle),
    });
    const editable =
      meta.canRespond &&
      cycleActive &&
      participantActive &&
      notSubmitted &&
      phaseEditable;

    let scoreBreakdown:
      ReturnType<typeof calculateEvaluationScore>['breakdown'] | null = null;
    if (
      evaluation.status === PerformanceEvaluationStatus.SUBMITTED &&
      evaluation.competencies.some((c) => c.response)
    ) {
      try {
        scoreBreakdown = calculateEvaluationScore(
          evaluation.competencies.map((c) => ({
            id: c.id,
            required: c.required,
            weight: c.weight == null ? null : Number(c.weight.toString()),
            levels: c.levels.map((l) => ({ value: l.value })),
            response: c.response
              ? { ratingValue: c.response.ratingValue }
              : null,
          })),
        ).breakdown;
      } catch {
        scoreBreakdown = null;
      }
    }

    const respondedCount = evaluation.competencies.filter(
      (c) => c.response != null,
    ).length;

    return {
      id: evaluation.id,
      companyId: evaluation.companyId,
      cycleId: evaluation.cycleId,
      participantId: evaluation.participantId,
      employeeId: evaluation.employeeId,
      evaluatorEmployeeId: evaluation.evaluatorEmployeeId,
      type: evaluation.type,
      status: evaluation.status,
      startedAt: evaluation.startedAt,
      submittedAt: evaluation.submittedAt,
      scorePercentage: decimalToString(evaluation.scorePercentage ?? null),
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
      participant: evaluation.participant,
      canRespond: meta.canRespond,
      editable,
      respondedCount,
      competencyCount: evaluation.competencies.length,
      cycle: serializeMineCycle(evaluation.cycle),
      employee: evaluation.employee,
      evaluatorEmployee: evaluation.evaluatorEmployee,
      competencies: evaluation.competencies.map((c) => {
        const breakdown = scoreBreakdown?.find(
          (b) => b.evaluationCompetencyId === c.id,
        );
        return {
          id: c.id,
          sourceCompetencyId: c.sourceCompetencyId,
          sourceScaleId: c.sourceScaleId,
          name: c.name,
          code: c.code,
          description: c.description,
          scaleName: c.scaleName,
          weight: decimalToString(c.weight),
          required: c.required,
          order: c.order,
          levels: c.levels,
          response: c.response
            ? {
                selectedScaleLevelId: c.response.selectedScaleLevelId,
                ratingValue: c.response.ratingValue,
                comment: c.response.comment,
                updatedAt: c.response.updatedAt,
              }
            : null,
          scoreBreakdown: breakdown
            ? {
                ratingValue: breakdown.ratingValue,
                normalizedPercentage: breakdown.normalizedPercentage,
                weight: breakdown.weight,
                weightedContribution: breakdown.weightedContribution,
              }
            : null,
        };
      }),
    };
  }

  private async serializeEvaluationWorkspace(
    evaluation: Parameters<EvaluationsService['serializeEvaluationDetail']>[0],
    meta: { canRespond: boolean; actorEmployeeId: string | null },
  ) {
    const detail = this.serializeEvaluationDetail(evaluation, meta);
    const extras = await this.evaluationExtras(evaluation);
    return { ...detail, ...extras };
  }

  private async evaluationExtras(evaluation: {
    id: string;
    companyId: string;
    cycleId: string;
    employeeId: string;
    type: PerformanceEvaluationType;
    cycle: MineCycleRecord;
  }) {
    const goals = await this.assignedIndividualGoals(
      this.prisma,
      evaluation.companyId,
      evaluation.cycleId,
      evaluation.employeeId,
    );
    const ratings = await this.prisma.performanceGoalRating.findMany({
      where: { evaluationId: evaluation.id },
    });
    const ratingByGoal = new Map(ratings.map((row) => [row.goalId, row]));
    const goalItems = goals.map((goal) => {
      const rating = ratingByGoal.get(goal.id);
      return {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        progressStatus: goal.progressStatus,
        scale: goal.scale
          ? {
              id: goal.scale.id,
              name: goal.scale.name,
              levels: goal.scale.levels.map((level) => ({
                id: level.id,
                value: level.value,
                label: level.label,
                description: level.description,
                order: level.order,
              })),
            }
          : null,
        response: rating
          ? {
              selectedScaleLevelId: rating.selectedScaleLevelId,
              ratingValue: rating.ratingValue,
              comment: rating.comment,
            }
          : null,
      };
    });

    let selfEvaluation: {
      competencies: Array<{
        name: string;
        ratingValue: number | null;
        label: string | null;
        comment: string | null;
      }>;
      goals: Array<{
        title: string;
        ratingValue: number | null;
        label: string | null;
        comment: string | null;
      }>;
    } | null = null;

    if (evaluation.type === PerformanceEvaluationType.MANAGER) {
      const self = await this.prisma.performanceEvaluation.findFirst({
        where: {
          companyId: evaluation.companyId,
          cycleId: evaluation.cycleId,
          employeeId: evaluation.employeeId,
          type: PerformanceEvaluationType.SELF,
        },
        include: {
          competencies: {
            include: {
              response: true,
              levels: true,
            },
            orderBy: { order: 'asc' },
          },
          goalRatings: {
            include: {
              goal: { select: { title: true } },
              scaleLevel: { select: { label: true } },
            },
          },
        },
      });
      if (self) {
        selfEvaluation = {
          competencies: self.competencies.map((comp) => {
            const level = comp.levels.find(
              (item) => item.id === comp.response?.selectedScaleLevelId,
            );
            return {
              name: comp.name,
              ratingValue: comp.response?.ratingValue ?? null,
              label: level?.label ?? null,
              comment: comp.response?.comment ?? null,
            };
          }),
          goals: self.goalRatings.map((rating) => ({
            title: rating.goal.title,
            ratingValue: rating.ratingValue,
            label: rating.scaleLevel?.label ?? null,
            comment: rating.comment,
          })),
        };
      }
    }

    return { goals: goalItems, selfEvaluation };
  }

  private async assignedIndividualGoals(
    db: Prisma.TransactionClient | PrismaService,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const cycle = await db.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      select: { goalCycleId: true },
    });
    if (!cycle?.goalCycleId) return [];
    return db.goal.findMany({
      where: {
        companyId,
        cycleId: cycle.goalCycleId,
        type: GoalType.INDIVIDUAL,
        assignments: { some: { employeeId } },
      },
      include: {
        scale: {
          include: { levels: { orderBy: { order: 'asc' as const } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
