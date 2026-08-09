import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  PerformanceCycleStatus,
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
  Prisma,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NO_DIRECT_MANAGER,
  canExcludeParticipant,
  type SnapshotCompetencyInput,
} from '../evaluation-access';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PERFORMANCE_AUDIT,
} from '../performance.constants';
import { decimalToString } from '../performance.helpers';
import type {
  AssignParticipantDto,
  BulkAssignParticipantsDto,
  ListParticipantsQueryDto,
} from './dto/participant.dto';

const EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  areaId: true,
  positionId: true,
  area: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} as const;

const EVAL_SUMMARY_SELECT = {
  id: true,
  type: true,
  status: true,
  evaluatorEmployeeId: true,
  employeeId: true,
  scorePercentage: true,
  startedAt: true,
  submittedAt: true,
} as const;

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    companyId: string,
    cycleId: string,
    query: ListParticipantsQueryDto,
  ) {
    await this.requireCycle(companyId, cycleId);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.PerformanceCycleParticipantWhereInput = {
      companyId,
      cycleId,
      ...(query.status ? { status: query.status } : {}),
      employee: {
        ...(query.areaId ? { areaId: query.areaId } : {}),
        ...(query.positionId ? { positionId: query.positionId } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.performanceCycleParticipant.findMany({
        where,
        include: {
          employee: { select: EMPLOYEE_SELECT },
          evaluations: { select: EVAL_SUMMARY_SELECT },
          result: {
            select: {
              id: true,
              status: true,
              overallScore: true,
              selfScore: true,
              managerScore: true,
              calculatedAt: true,
              releasedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.performanceCycleParticipant.count({ where }),
    ]);

    const managerIds = new Set<string>();
    for (const row of rows) {
      for (const evaluation of row.evaluations) {
        if (
          evaluation.type === PerformanceEvaluationType.MANAGER &&
          evaluation.evaluatorEmployeeId
        ) {
          managerIds.add(evaluation.evaluatorEmployeeId);
        }
      }
    }

    const managers = managerIds.size
      ? await this.prisma.employee.findMany({
          where: { companyId, id: { in: [...managerIds] } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        })
      : [];
    const managersById = new Map(managers.map((m) => [m.id, m]));

    return {
      items: rows.map((row) =>
        this.serializeParticipantListItem(row, managersById),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getById(companyId: string, cycleId: string, participantId: string) {
    await this.requireCycle(companyId, cycleId);
    const row = await this.prisma.performanceCycleParticipant.findFirst({
      where: { id: participantId, companyId, cycleId },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        evaluations: {
          include: {
            evaluatorEmployee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            competencies: {
              include: {
                levels: { orderBy: { order: 'asc' } },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { type: 'asc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Participant not found');
    }
    return this.serializeParticipantDetail(row);
  }

  async assign(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: AssignParticipantDto,
  ) {
    await this.requireActiveCycle(companyId, cycleId);
    const employee = await this.requireActiveEmployee(
      companyId,
      dto.employeeId,
    );

    const existing = await this.prisma.performanceCycleParticipant.findUnique({
      where: {
        cycleId_employeeId: { cycleId, employeeId: employee.id },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Employee already participates in this cycle',
      );
    }

    try {
      const result = await this.materializeParticipant(
        companyId,
        userId,
        cycleId,
        employee.id,
      );
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Employee already participates in this cycle',
        );
      }
      throw error;
    }
  }

  /**
   * Bulk semantics:
   * - Duplicate IDs in payload are deduped.
   * - Any ID not found / inactive / wrong tenant → entire request 400 (failed list).
   * - Already assigned → alreadyAssigned (idempotent, no error).
   * - Creates run in one transaction.
   */
  async bulkAssign(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: BulkAssignParticipantsDto,
  ) {
    await this.requireActiveCycle(companyId, cycleId);
    const uniqueIds = [...new Set(dto.employeeIds)];

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        id: { in: uniqueIds },
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    const found = new Set(employees.map((e) => e.id));
    const failed = uniqueIds
      .filter((id) => !found.has(id))
      .map((employeeId) => ({
        employeeId,
        reason: 'EMPLOYEE_NOT_FOUND_OR_INACTIVE',
      }));

    if (failed.length > 0) {
      throw new BadRequestException({
        message: 'One or more employees are invalid for this company',
        failed,
      });
    }

    const existing = await this.prisma.performanceCycleParticipant.findMany({
      where: { companyId, cycleId, employeeId: { in: uniqueIds } },
      select: { employeeId: true },
    });
    const already = new Set(existing.map((e) => e.employeeId));
    const toCreate = uniqueIds.filter((id) => !already.has(id));

    const created: unknown[] = [];
    if (toCreate.length > 0) {
      const batch = await this.prisma.$transaction(async (tx) => {
        const results = [];
        for (const employeeId of toCreate) {
          results.push(
            await this.materializeParticipantTx(
              tx,
              companyId,
              cycleId,
              employeeId,
            ),
          );
        }
        return results;
      });

      for (const item of batch) {
        await this.auditAssignment({
          companyId,
          userId,
          cycleId,
          employeeId: item.detail.employeeId,
          participantId: item.detail.id,
          selfEvalId: item.selfEvalId,
          managerEvalId: item.managerEvalId,
          managerEvaluatorEmployeeId: item.managerEvaluatorEmployeeId,
          managerEvaluationCreated: item.managerEvaluationCreated,
          managerSkipReason: item.managerSkipReason,
        });
        created.push({
          ...this.serializeParticipantDetail(item.detail),
          managerEvaluationCreated: item.managerEvaluationCreated,
          ...(item.managerSkipReason ? { reason: item.managerSkipReason } : {}),
        });
      }
    }

    return {
      created,
      alreadyAssigned: uniqueIds.filter((id) => already.has(id)),
      failed: [],
    };
  }

  async exclude(
    companyId: string,
    userId: string,
    cycleId: string,
    participantId: string,
  ) {
    await this.requireActiveCycle(companyId, cycleId);
    const participant = await this.prisma.performanceCycleParticipant.findFirst(
      {
        where: { id: participantId, companyId, cycleId },
        include: { evaluations: { select: { status: true } } },
      },
    );
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.status === PerformanceParticipantStatus.EXCLUDED) {
      throw new ConflictException('Participant is already excluded');
    }

    if (
      !canExcludeParticipant({
        participantStatus: participant.status,
        evaluationStatuses: participant.evaluations.map((e) => e.status),
      })
    ) {
      throw new BadRequestException(
        'Participant cannot be excluded while evaluations are SUBMITTED',
      );
    }

    const updated = await this.prisma.performanceCycleParticipant.update({
      where: { id: participantId },
      data: { status: PerformanceParticipantStatus.EXCLUDED },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        evaluations: { select: EVAL_SUMMARY_SELECT },
      },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_PARTICIPANT_EXCLUDED,
      entity: 'PerformanceCycleParticipant',
      entityId: participantId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id: participantId,
        cycleId,
        employeeId: participant.employeeId,
      },
    });

    return this.serializeParticipantListItem(updated, new Map());
  }

  private async materializeParticipant(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const materialized = await this.prisma.$transaction((tx) =>
      this.materializeParticipantTx(tx, companyId, cycleId, employeeId),
    );
    await this.auditAssignment({
      companyId,
      userId,
      cycleId,
      employeeId,
      participantId: materialized.detail.id,
      selfEvalId: materialized.selfEvalId,
      managerEvalId: materialized.managerEvalId,
      managerEvaluatorEmployeeId: materialized.managerEvaluatorEmployeeId,
      managerEvaluationCreated: materialized.managerEvaluationCreated,
      managerSkipReason: materialized.managerSkipReason,
    });
    return {
      ...this.serializeParticipantDetail(materialized.detail),
      managerEvaluationCreated: materialized.managerEvaluationCreated,
      ...(materialized.managerSkipReason
        ? { reason: materialized.managerSkipReason }
        : {}),
    };
  }

  private async materializeParticipantTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const cycleComps = await tx.performanceCycleCompetency.findMany({
      where: { companyId, cycleId },
      include: {
        competency: true,
        scale: {
          include: {
            levels: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    if (cycleComps.length === 0) {
      throw new BadRequestException(
        'Cycle has no competencies configured; cannot assign participants',
      );
    }

    const snapshot = this.buildSnapshotInputs(cycleComps);

    const participant = await tx.performanceCycleParticipant.create({
      data: {
        companyId,
        cycleId,
        employeeId,
        status: PerformanceParticipantStatus.ACTIVE,
      },
    });

    const selfEval = await this.createEvaluationWithSnapshot(tx, {
      companyId,
      cycleId,
      participantId: participant.id,
      employeeId,
      evaluatorEmployeeId: employeeId,
      type: PerformanceEvaluationType.SELF,
      snapshot,
    });

    const directManager = await tx.employeeReportingLine.findFirst({
      where: {
        companyId,
        employeeId,
        type: ReportingLineType.DIRECT,
        manager: {
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      },
      select: { managerEmployeeId: true },
    });

    let managerEvaluation: {
      id: string;
      type: PerformanceEvaluationType;
      status: PerformanceEvaluationStatus;
      evaluatorEmployeeId: string | null;
    } | null = null;
    let managerEvaluationCreated = false;
    let managerSkipReason: typeof NO_DIRECT_MANAGER | null = null;

    if (directManager) {
      managerEvaluation = await this.createEvaluationWithSnapshot(tx, {
        companyId,
        cycleId,
        participantId: participant.id,
        employeeId,
        evaluatorEmployeeId: directManager.managerEmployeeId,
        type: PerformanceEvaluationType.MANAGER,
        snapshot,
      });
      managerEvaluationCreated = true;
    } else {
      managerSkipReason = NO_DIRECT_MANAGER;
    }

    const detail = await tx.performanceCycleParticipant.findFirstOrThrow({
      where: { id: participant.id },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        evaluations: {
          include: {
            evaluatorEmployee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            competencies: {
              include: { levels: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { type: 'asc' },
        },
      },
    });

    return {
      detail,
      selfEvalId: selfEval.id,
      managerEvalId: managerEvaluation?.id ?? null,
      managerEvaluatorEmployeeId:
        managerEvaluation?.evaluatorEmployeeId ?? null,
      managerEvaluationCreated,
      managerSkipReason,
    };
  }

  private async auditAssignment(params: {
    companyId: string;
    userId: string;
    cycleId: string;
    employeeId: string;
    participantId: string;
    selfEvalId: string;
    managerEvalId: string | null;
    managerEvaluatorEmployeeId: string | null;
    managerEvaluationCreated: boolean;
    managerSkipReason: typeof NO_DIRECT_MANAGER | null;
  }) {
    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_PARTICIPANT_ADDED,
      entity: 'PerformanceCycleParticipant',
      entityId: params.participantId,
      company: { connect: { id: params.companyId } },
      user: { connect: { id: params.userId } },
      metadata: {
        id: params.participantId,
        cycleId: params.cycleId,
        employeeId: params.employeeId,
        managerEvaluationCreated: params.managerEvaluationCreated,
        ...(params.managerSkipReason
          ? { reason: params.managerSkipReason }
          : {}),
      },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_CREATED,
      entity: 'PerformanceEvaluation',
      entityId: params.selfEvalId,
      company: { connect: { id: params.companyId } },
      user: { connect: { id: params.userId } },
      metadata: {
        id: params.selfEvalId,
        participantId: params.participantId,
        type: PerformanceEvaluationType.SELF,
      },
    });

    if (params.managerEvalId) {
      await this.audit.create({
        action: PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_CREATED,
        entity: 'PerformanceEvaluation',
        entityId: params.managerEvalId,
        company: { connect: { id: params.companyId } },
        user: { connect: { id: params.userId } },
        metadata: {
          id: params.managerEvalId,
          participantId: params.participantId,
          type: PerformanceEvaluationType.MANAGER,
          evaluatorEmployeeId: params.managerEvaluatorEmployeeId,
        },
      });
    }
  }

  private buildSnapshotInputs(
    cycleComps: Array<{
      competencyId: string;
      scaleId: string;
      weight: Prisma.Decimal | null;
      required: boolean;
      order: number;
      competency: {
        name: string;
        code: string | null;
        description: string | null;
      };
      scale: {
        name: string;
        levels: Array<{
          id: string;
          value: number;
          label: string;
          description: string | null;
          order: number;
        }>;
      };
    }>,
  ): SnapshotCompetencyInput[] {
    return cycleComps.map((row) => ({
      sourceCompetencyId: row.competencyId,
      sourceScaleId: row.scaleId,
      name: row.competency.name,
      code: row.competency.code,
      description: row.competency.description,
      scaleName: row.scale.name,
      weight: row.weight,
      required: row.required,
      order: row.order,
      levels: row.scale.levels.map((level) => ({
        sourceScaleLevelId: level.id,
        value: level.value,
        label: level.label,
        description: level.description,
        order: level.order,
      })),
    }));
  }

  private async createEvaluationWithSnapshot(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      cycleId: string;
      participantId: string;
      employeeId: string;
      evaluatorEmployeeId: string;
      type: PerformanceEvaluationType;
      snapshot: SnapshotCompetencyInput[];
    },
  ) {
    const evaluation = await tx.performanceEvaluation.create({
      data: {
        companyId: params.companyId,
        cycleId: params.cycleId,
        participantId: params.participantId,
        employeeId: params.employeeId,
        evaluatorEmployeeId: params.evaluatorEmployeeId,
        type: params.type,
        status: PerformanceEvaluationStatus.PENDING,
        competencies: {
          create: params.snapshot.map((comp) => ({
            companyId: params.companyId,
            sourceCompetencyId: comp.sourceCompetencyId,
            sourceScaleId: comp.sourceScaleId,
            name: comp.name,
            code: comp.code,
            description: comp.description,
            scaleName: comp.scaleName,
            weight:
              comp.weight == null
                ? null
                : new Prisma.Decimal(comp.weight as Prisma.Decimal),
            required: comp.required,
            order: comp.order,
            levels: {
              create: comp.levels.map((level) => ({
                companyId: params.companyId,
                sourceScaleLevelId: level.sourceScaleLevelId,
                value: level.value,
                label: level.label,
                description: level.description,
                order: level.order,
              })),
            },
          })),
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        evaluatorEmployeeId: true,
      },
    });
    return evaluation;
  }

  private async requireCycle(companyId: string, cycleId: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }
    return cycle;
  }

  private async requireActiveCycle(companyId: string, cycleId: string) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (cycle.status !== PerformanceCycleStatus.ACTIVE) {
      throw new BadRequestException(
        'Participants can only be assigned when the cycle is ACTIVE',
      );
    }
    return cycle;
  }

  private async requireActiveEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  private serializeParticipantListItem(
    row: {
      id: string;
      companyId: string;
      cycleId: string;
      employeeId: string;
      status: PerformanceParticipantStatus;
      createdAt: Date;
      updatedAt: Date;
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        status: EmployeeStatus;
        areaId: string;
        positionId: string;
        area: { id: string; name: string };
        position: { id: string; name: string };
      };
      evaluations: Array<{
        id: string;
        type: PerformanceEvaluationType;
        status: PerformanceEvaluationStatus;
        evaluatorEmployeeId: string | null;
        employeeId: string;
        scorePercentage?: Prisma.Decimal | null;
      }>;
      result?: {
        id: string;
        status: string;
        overallScore: Prisma.Decimal;
        selfScore: Prisma.Decimal | null;
        managerScore: Prisma.Decimal | null;
        calculatedAt: Date;
        releasedAt: Date | null;
      } | null;
    },
    managersById: Map<
      string,
      { id: string; firstName: string; lastName: string; email: string }
    >,
  ) {
    const managerEval = row.evaluations.find(
      (e) => e.type === PerformanceEvaluationType.MANAGER,
    );
    const selfEval = row.evaluations.find(
      (e) => e.type === PerformanceEvaluationType.SELF,
    );
    const manager = managerEval?.evaluatorEmployeeId
      ? (managersById.get(managerEval.evaluatorEmployeeId) ?? null)
      : null;

    return {
      id: row.id,
      companyId: row.companyId,
      cycleId: row.cycleId,
      employeeId: row.employeeId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      employee: row.employee,
      manager,
      evaluations: {
        self: selfEval
          ? {
              id: selfEval.id,
              status: selfEval.status,
              scorePercentage: decimalToString(
                selfEval.scorePercentage ?? null,
              ),
            }
          : null,
        manager: managerEval
          ? {
              id: managerEval.id,
              status: managerEval.status,
              evaluatorEmployeeId: managerEval.evaluatorEmployeeId,
              scorePercentage: decimalToString(
                managerEval.scorePercentage ?? null,
              ),
            }
          : null,
      },
      result: row.result
        ? {
            id: row.result.id,
            status: row.result.status,
            overallScore: decimalToString(row.result.overallScore),
            selfScore: decimalToString(row.result.selfScore),
            managerScore: decimalToString(row.result.managerScore),
            calculatedAt: row.result.calculatedAt,
            releasedAt: row.result.releasedAt,
          }
        : null,
    };
  }

  private serializeParticipantDetail(row: {
    id: string;
    companyId: string;
    cycleId: string;
    employeeId: string;
    status: PerformanceParticipantStatus;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: EmployeeStatus;
      areaId: string;
      positionId: string;
      area: { id: string; name: string };
      position: { id: string; name: string };
    };
    evaluations: Array<{
      id: string;
      type: PerformanceEvaluationType;
      status: PerformanceEvaluationStatus;
      evaluatorEmployeeId: string | null;
      employeeId: string;
      startedAt: Date | null;
      submittedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      evaluatorEmployee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
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
      }>;
    }>;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      cycleId: row.cycleId,
      employeeId: row.employeeId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      employee: row.employee,
      evaluations: row.evaluations.map((evaluation) => ({
        id: evaluation.id,
        type: evaluation.type,
        status: evaluation.status,
        employeeId: evaluation.employeeId,
        evaluatorEmployeeId: evaluation.evaluatorEmployeeId,
        startedAt: evaluation.startedAt,
        submittedAt: evaluation.submittedAt,
        createdAt: evaluation.createdAt,
        updatedAt: evaluation.updatedAt,
        evaluatorEmployee: evaluation.evaluatorEmployee,
        competencies: evaluation.competencies.map((c) => ({
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
        })),
      })),
    };
  }
}
