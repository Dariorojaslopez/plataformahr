import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetencyScaleKind,
  EmployeeStatus,
  OrganizationEntityStatus,
  PerformanceCycleStatus,
  PerformanceEvaluationModel,
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
  Prisma,
  ReportingLineType,
} from '@prisma/client';
import { modelIncludesPeer, modelIncludesReport } from '../evaluation-model';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NO_DIRECT_MANAGER,
  canExcludeParticipant,
  type SnapshotCompetencyInput,
} from '../evaluation-access';
import {
  buildCycleCompetencyImports,
  competencyIdsOnlyOnRemovedLevels,
} from '../cycle-competency-import';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MIN_SCALE_LEVELS_FOR_ACTIVATION,
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
    const cycle = await this.requireAssignableCycle(companyId, cycleId);
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
      if (cycle.status === PerformanceCycleStatus.DRAFT) {
        return this.assignDraftParticipant(
          companyId,
          userId,
          cycleId,
          employee.id,
        );
      }
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
    const cycle = await this.requireAssignableCycle(companyId, cycleId);
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
    if (toCreate.length > 0 && cycle.status === PerformanceCycleStatus.DRAFT) {
      const batch = await this.prisma.$transaction(async (tx) => {
        await this.importLevelCompetenciesTx(tx, companyId, cycleId, toCreate);
        const results = [];
        for (const employeeId of toCreate) {
          results.push(
            await this.createDraftParticipantTx(tx, companyId, cycleId, employeeId),
          );
        }
        return results;
      });
      for (const item of batch) {
        await this.auditDraftAssignment({
          companyId,
          userId,
          cycleId,
          employeeId: item.employeeId,
          participantId: item.id,
        });
        created.push({
          ...this.serializeParticipantDetail(item),
          managerEvaluationCreated: false,
        });
      }
    } else if (toCreate.length > 0) {
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

  async removeDraft(
    companyId: string,
    userId: string,
    cycleId: string,
    participantId: string,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (cycle.status !== PerformanceCycleStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se puede quitar un participante cuando el ciclo está en borrador.',
      );
    }

    const participant = await this.prisma.performanceCycleParticipant.findFirst({
      where: { id: participantId, companyId, cycleId },
      include: { evaluations: { select: { id: true } } },
    });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    if (participant.evaluations.length > 0) {
      throw new BadRequestException(
        'No se puede quitar un participante que ya tiene evaluaciones.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.performanceCycleParticipant.delete({
        where: { id: participantId },
      });
      await this.pruneUnusedLevelCompetenciesTx(tx, companyId, cycleId, [
        participant.employeeId,
      ]);
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
        draftRemoved: true,
      },
    });

    return { success: true };
  }

  async materializePendingEvaluationsTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
  ) {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }

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

    if (cycle.includeCompetencies && cycleComps.length === 0) {
      throw new BadRequestException(
        'Cycle has no competencies configured; cannot assign participants',
      );
    }

    const pending = await tx.performanceCycleParticipant.findMany({
      where: {
        companyId,
        cycleId,
        status: PerformanceParticipantStatus.ACTIVE,
        evaluations: { none: {} },
      },
    });

    const items = [];
    for (const participant of pending) {
      items.push(
        await this.attachEvaluationsTx(tx, {
          companyId,
          cycleId,
          cycle,
          cycleComps,
          participantId: participant.id,
          employeeId: participant.employeeId,
        }),
      );
    }
    return items;
  }

  private async assignDraftParticipant(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const detail = await this.prisma.$transaction(async (tx) => {
      await this.importLevelCompetenciesTx(tx, companyId, cycleId, [employeeId]);
      return this.createDraftParticipantTx(tx, companyId, cycleId, employeeId);
    });
    await this.auditDraftAssignment({
      companyId,
      userId,
      cycleId,
      employeeId,
      participantId: detail.id,
    });
    return {
      ...this.serializeParticipantDetail(detail),
      managerEvaluationCreated: false,
    };
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
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }

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

    if (cycle.includeCompetencies && cycleComps.length === 0) {
      throw new BadRequestException(
        'Cycle has no competencies configured; cannot assign participants',
      );
    }

    const participant = await tx.performanceCycleParticipant.create({
      data: {
        companyId,
        cycleId,
        employeeId,
        status: PerformanceParticipantStatus.ACTIVE,
      },
    });

    return this.attachEvaluationsTx(tx, {
      companyId,
      cycleId,
      cycle,
      cycleComps,
      participantId: participant.id,
      employeeId,
    });
  }

  private async attachEvaluationsTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      cycleId: string;
      cycle: {
        evaluationModel: PerformanceEvaluationModel;
        peerEvaluationWeight: Prisma.Decimal | null;
        reportEvaluationWeight: Prisma.Decimal | null;
      };
      cycleComps: Parameters<ParticipantsService['buildSnapshotInputs']>[0];
      participantId: string;
      employeeId: string;
    },
  ) {
    const snapshot = this.buildSnapshotInputs(params.cycleComps);

    const selfEval = await this.createEvaluationWithSnapshot(tx, {
      companyId: params.companyId,
      cycleId: params.cycleId,
      participantId: params.participantId,
      employeeId: params.employeeId,
      evaluatorEmployeeId: params.employeeId,
      type: PerformanceEvaluationType.SELF,
      snapshot,
    });

    const directManager = await tx.employeeReportingLine.findFirst({
      where: {
        companyId: params.companyId,
        employeeId: params.employeeId,
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
        companyId: params.companyId,
        cycleId: params.cycleId,
        participantId: params.participantId,
        employeeId: params.employeeId,
        evaluatorEmployeeId: directManager.managerEmployeeId,
        type: PerformanceEvaluationType.MANAGER,
        snapshot,
      });
      managerEvaluationCreated = true;
    } else {
      managerSkipReason = NO_DIRECT_MANAGER;
    }

    const extraSnapshot = await this.snapshotForEvaluateeLevel(
      tx,
      params.companyId,
      params.employeeId,
      params.cycleComps,
      snapshot,
    );
    await this.materializeExtraEvaluations(tx, {
      companyId: params.companyId,
      cycleId: params.cycleId,
      participantId: params.participantId,
      employeeId: params.employeeId,
      managerEmployeeId: directManager?.managerEmployeeId ?? null,
      cycle: params.cycle,
      snapshot: extraSnapshot,
    });

    const detail = await tx.performanceCycleParticipant.findFirstOrThrow({
      where: { id: params.participantId },
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

  private async snapshotForEvaluateeLevel(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
    cycleComps: Parameters<ParticipantsService['buildSnapshotInputs']>[0],
    fallback: SnapshotCompetencyInput[],
  ): Promise<SnapshotCompetencyInput[]> {
    if (cycleComps.length === 0) return fallback;

    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { position: { select: { jobLevelId: true } } },
    });
    const jobLevelId = employee?.position.jobLevelId;
    if (!jobLevelId) return fallback;

    const links = await tx.jobLevelCompetency.findMany({
      where: { companyId, jobLevelId },
      select: { competencyId: true },
    });
    const allowed = new Set(links.map((link) => link.competencyId));
    const filtered = cycleComps.filter((row) => allowed.has(row.competencyId));
    if (filtered.length === 0) return fallback;
    return this.buildSnapshotInputs(filtered);
  }

  private async materializeExtraEvaluations(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      cycleId: string;
      participantId: string;
      employeeId: string;
      managerEmployeeId: string | null;
      cycle: {
        evaluationModel: PerformanceEvaluationModel;
        peerEvaluationWeight: Prisma.Decimal | null;
        reportEvaluationWeight: Prisma.Decimal | null;
      };
      snapshot: SnapshotCompetencyInput[];
    },
  ) {
    const peerWeight = Number(params.cycle.peerEvaluationWeight ?? 0);
    const reportWeight = Number(params.cycle.reportEvaluationWeight ?? 0);

    if (modelIncludesPeer(params.cycle.evaluationModel) && peerWeight > 0) {
      const subject = await tx.employee.findFirst({
        where: { id: params.employeeId, companyId: params.companyId },
        select: {
          areaId: true,
          position: { select: { jobLevelId: true } },
        },
      });
      const jobLevelId = subject?.position.jobLevelId ?? null;
      if (subject && jobLevelId) {
        const excluded = [params.employeeId];
        if (params.managerEmployeeId) excluded.push(params.managerEmployeeId);
        const peers = await tx.employee.findMany({
          where: {
            companyId: params.companyId,
            deletedAt: null,
            status: EmployeeStatus.ACTIVE,
            areaId: subject.areaId,
            id: { notIn: excluded },
            position: { jobLevelId },
          },
          select: { id: true },
        });
        for (const peer of peers) {
          await this.createEvaluationWithSnapshot(tx, {
            companyId: params.companyId,
            cycleId: params.cycleId,
            participantId: params.participantId,
            employeeId: params.employeeId,
            evaluatorEmployeeId: peer.id,
            type: PerformanceEvaluationType.PEER,
            snapshot: params.snapshot,
          });
        }
      }
    }

    if (modelIncludesReport(params.cycle.evaluationModel) && reportWeight > 0) {
      const reports = await tx.employeeReportingLine.findMany({
        where: {
          companyId: params.companyId,
          managerEmployeeId: params.employeeId,
          type: ReportingLineType.DIRECT,
          employee: {
            deletedAt: null,
            status: EmployeeStatus.ACTIVE,
          },
        },
        select: { employeeId: true },
      });
      for (const report of reports) {
        await this.createEvaluationWithSnapshot(tx, {
          companyId: params.companyId,
          cycleId: params.cycleId,
          participantId: params.participantId,
          employeeId: params.employeeId,
          evaluatorEmployeeId: report.employeeId,
          type: PerformanceEvaluationType.REPORT,
          snapshot: params.snapshot,
        });
      }
    }
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

  private async createDraftParticipantTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const participant = await tx.performanceCycleParticipant.create({
      data: {
        companyId,
        cycleId,
        employeeId,
        status: PerformanceParticipantStatus.ACTIVE,
      },
    });
    return tx.performanceCycleParticipant.findFirstOrThrow({
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
  }

  private async importLevelCompetenciesTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
    employeeIds: string[],
  ) {
    const cycle = await tx.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      select: { includeCompetencies: true },
    });
    if (!cycle?.includeCompetencies) return 0;

    const incomingIds = await this.competencyIdsForEmployees(
      tx,
      companyId,
      employeeIds,
    );
    if (incomingIds.length === 0) return 0;

    const existing = await tx.performanceCycleCompetency.findMany({
      where: { companyId, cycleId },
      select: { competencyId: true, order: true },
      orderBy: { order: 'desc' },
    });
    const fallbackScaleId = await this.findFallbackQualitativeScaleId(
      tx,
      companyId,
    );
    const incoming = [];
    for (const competencyId of incomingIds) {
      incoming.push({
        competencyId,
        scaleId: await this.resolveScaleIdForCompetency(
          tx,
          companyId,
          competencyId,
          fallbackScaleId,
        ),
      });
    }

    const planned = buildCycleCompetencyImports({
      existingCompetencyIds: existing.map((row) => row.competencyId),
      incoming,
      startingOrder: existing[0] ? existing[0].order + 1 : 0,
    });
    if (planned.missingScaleIds.length > 0) {
      throw new BadRequestException(
        'Define una escala cualitativa activa para cargar las competencias del nivel.',
      );
    }

    for (const row of planned.rows) {
      await tx.performanceCycleCompetency.create({
        data: {
          companyId,
          cycleId,
          competencyId: row.competencyId,
          scaleId: row.scaleId,
          order: row.order,
          required: row.required,
        },
      });
    }
    return planned.rows.length;
  }

  private async pruneUnusedLevelCompetenciesTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
    removedEmployeeIds: string[],
  ) {
    const remaining = await tx.performanceCycleParticipant.findMany({
      where: {
        companyId,
        cycleId,
        status: { not: PerformanceParticipantStatus.EXCLUDED },
      },
      select: { employeeId: true },
    });
    const [removedIds, remainingIds] = await Promise.all([
      this.competencyIdsForEmployees(tx, companyId, removedEmployeeIds),
      this.competencyIdsForEmployees(
        tx,
        companyId,
        remaining.map((row) => row.employeeId),
      ),
    ]);
    const toRemove = competencyIdsOnlyOnRemovedLevels({
      removedCompetencyIds: removedIds,
      remainingCompetencyIds: remainingIds,
    });
    if (toRemove.length === 0) return;
    await tx.performanceCycleCompetency.deleteMany({
      where: { companyId, cycleId, competencyId: { in: toRemove } },
    });
  }

  private async competencyIdsForEmployees(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeIds: string[],
  ): Promise<string[]> {
    if (employeeIds.length === 0) return [];
    const employees = await tx.employee.findMany({
      where: { companyId, id: { in: employeeIds }, deletedAt: null },
      select: { position: { select: { jobLevelId: true } } },
    });
    const jobLevelIds = [
      ...new Set(
        employees
          .map((row) => row.position.jobLevelId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (jobLevelIds.length === 0) return [];
    const links = await tx.jobLevelCompetency.findMany({
      where: {
        companyId,
        jobLevelId: { in: jobLevelIds },
        competency: {
          deletedAt: null,
          status: OrganizationEntityStatus.ACTIVE,
        },
      },
      select: { competencyId: true },
    });
    return [...new Set(links.map((link) => link.competencyId))];
  }

  private async findFallbackQualitativeScaleId(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string | null> {
    const scales = await tx.competencyScale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: OrganizationEntityStatus.ACTIVE,
        kind: CompetencyScaleKind.QUALITATIVE,
      },
      select: {
        id: true,
        levels: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return (
      scales.find((scale) => scale.levels.length >= MIN_SCALE_LEVELS_FOR_ACTIVATION)
        ?.id ?? null
    );
  }

  private async resolveScaleIdForCompetency(
    tx: Prisma.TransactionClient,
    companyId: string,
    competencyId: string,
    fallbackScaleId: string | null,
  ): Promise<string | null> {
    const competency = await tx.competency.findFirst({
      where: { id: competencyId, companyId, deletedAt: null },
      select: {
        defaultScale: {
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
    const scale = competency?.defaultScale;
    if (
      scale &&
      !scale.deletedAt &&
      scale.status === OrganizationEntityStatus.ACTIVE &&
      scale.kind === CompetencyScaleKind.QUALITATIVE &&
      scale.levels.length >= MIN_SCALE_LEVELS_FOR_ACTIVATION
    ) {
      return scale.id;
    }
    return fallbackScaleId;
  }

  private async auditDraftAssignment(params: {
    companyId: string;
    userId: string;
    cycleId: string;
    employeeId: string;
    participantId: string;
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
        draft: true,
      },
    });
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

  private async requireAssignableCycle(companyId: string, cycleId: string) {
    const cycle = await this.requireCycle(companyId, cycleId);
    if (
      cycle.status !== PerformanceCycleStatus.DRAFT &&
      cycle.status !== PerformanceCycleStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Solo se pueden asignar participantes en un ciclo en borrador o activo.',
      );
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
