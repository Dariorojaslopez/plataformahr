import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PerformanceCycleStatus,
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
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

const EVALUATION_INCLUDE = {
  cycle: {
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      evaluationStartDate: true,
      evaluationEndDate: true,
    },
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
      return { self: [], asManager: [] };
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
            type: PerformanceEvaluationType.MANAGER,
            evaluatorEmployeeId: employee.id,
          },
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
      .filter((e) => e.type === PerformanceEvaluationType.MANAGER)
      .map((e) => this.serializeMineItem(e));

    return { self, asManager };
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

    return this.serializeEvaluationDetail(evaluation, {
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
        select: { status: true },
      });
      if (!cycle || cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Responses can only be saved while the cycle is ACTIVE',
        );
      }

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
        select: { status: true },
      });
      if (!cycle || cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Evaluations can only be submitted while the cycle is ACTIVE',
        );
      }

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

      const answered = competencies.filter((c) => c.response != null);
      if (answered.length === 0) {
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

    return this.serializeEvaluationDetail(submitted.updated, {
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
    cycle: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
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
      cycle: {
        ...evaluation.cycle,
        startDate: evaluation.cycle.startDate.toISOString().slice(0, 10),
        endDate: evaluation.cycle.endDate.toISOString().slice(0, 10),
      },
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
      cycle: {
        id: string;
        name: string;
        status: string;
        startDate: Date;
        endDate: Date;
        evaluationStartDate: Date | null;
        evaluationEndDate: Date | null;
      };
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
    const editable =
      meta.canRespond && cycleActive && participantActive && notSubmitted;

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
      cycle: {
        ...evaluation.cycle,
        startDate: evaluation.cycle.startDate.toISOString().slice(0, 10),
        endDate: evaluation.cycle.endDate.toISOString().slice(0, 10),
        evaluationStartDate: evaluation.cycle.evaluationStartDate
          ? evaluation.cycle.evaluationStartDate.toISOString().slice(0, 10)
          : null,
        evaluationEndDate: evaluation.cycle.evaluationEndDate
          ? evaluation.cycle.evaluationEndDate.toISOString().slice(0, 10)
          : null,
      },
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
}
