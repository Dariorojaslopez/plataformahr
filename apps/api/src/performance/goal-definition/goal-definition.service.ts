import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalDefinitionReviewStatus,
  GoalProgressStatus,
  GoalStatus,
  GoalType,
  OrganizationEntityStatus,
  PerformanceCycleStatus,
  PerformanceParticipantStatus,
  Prisma,
  ReportingLineType,
  GoalModificationRequestStatus,
} from '@prisma/client';
import { createPerformanceNotification } from '../inbox/notify';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { isGoalsCascadeEnabled } from '../../goals/goals.cascade';
import { emptyToNull } from '../performance.helpers';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import {
  buildCyclePhases,
  canEditGoalsInCyclePhase,
  type CyclePhaseSource,
} from '../cycle-phases';
import type {
  CascadedGoalItemDto,
  GoalDefinitionItemDto,
  GoalDefinitionPdiDto,
  SaveGoalDefinitionDto,
} from './dto/goal-definition.dto';
import {
  clampProgressPercent,
  exceedsMaxObjectives,
  pdiStatusFromPercent,
} from './pdi-progress';

const GOAL_INCLUDE = {
  scale: { select: { id: true, name: true, kind: true } },
  parentGoal: { select: { id: true, title: true } },
  assignments: {
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    take: 1,
  },
} as const;

type ActorContext = {
  cycle: CyclePhaseSource & {
    id: string;
    name: string;
    status: PerformanceCycleStatus;
    goalCycleId: string | null;
    maxObjectives: number | null;
  };
  employee: { id: string; areaId: string };
  userId: string;
};

@Injectable()
export class GoalDefinitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(companyId: string, userId: string, cycleId: string) {
    const ctx = await this.loadContext(companyId, userId, cycleId);
    return this.serializeWorkspace(companyId, ctx);
  }

  async save(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: SaveGoalDefinitionDto,
  ) {
    const ctx = await this.loadContext(companyId, userId, cycleId);
    await this.persist(companyId, ctx, dto, false);
    await this.audit.create({
      action: PERFORMANCE_AUDIT.GOAL_DEFINITION_SAVED,
      entity: 'PerformanceGoalDefinition',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { cycleId, employeeId: ctx.employee.id },
    });
    return this.serializeWorkspace(companyId, ctx);
  }

  async submit(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: SaveGoalDefinitionDto,
  ) {
    const ctx = await this.loadContext(companyId, userId, cycleId);
    await this.persist(companyId, ctx, dto, true);
    await this.audit.create({
      action: PERFORMANCE_AUDIT.GOAL_DEFINITION_SUBMITTED,
      entity: 'PerformanceGoalDefinition',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { cycleId, employeeId: ctx.employee.id },
    });
    return this.serializeWorkspace(companyId, ctx);
  }

  private async persist(
    companyId: string,
    ctx: ActorContext,
    dto: SaveGoalDefinitionDto,
    submit: boolean,
  ) {
    if (!ctx.cycle.goalCycleId) {
      throw new BadRequestException(
        'Este ciclo no tiene un periodo de objetivos vinculado',
      );
    }

    const definition = await this.prisma.performanceGoalDefinition.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId: ctx.cycle.id,
          employeeId: ctx.employee.id,
        },
      },
      select: { submittedAt: true, structureUnlocked: true, reviewStatus: true },
    });
    const phases = buildCyclePhases(ctx.cycle);
    const definitionEditable = canEditGoalsInCyclePhase({
      cycleStatus: ctx.cycle.status,
      phases,
      kind: 'GOAL_DEFINITION',
    });
    const followUpEditable = canEditGoalsInCyclePhase({
      cycleStatus: ctx.cycle.status,
      phases,
      kind: 'FOLLOW_UP',
    });

    if (definition?.submittedAt && !definition.structureUnlocked) {
      if (submit) {
        throw new BadRequestException(
          'La definición ya fue enviada a aprobación',
        );
      }
      if (!followUpEditable) {
        throw new ForbiddenException(
          'La definición está bloqueada. Solo el seguimiento permite actualizar el estado de avance.',
        );
      }
      await this.prisma.$transaction((tx) =>
        this.persistFollowUp(tx, companyId, ctx, dto),
      );
      return;
    }

    const unlockedInFollowUp =
      Boolean(definition?.structureUnlocked) && followUpEditable;

    if (!definitionEditable && !unlockedInFollowUp) {
      throw new ForbiddenException(
        'Solo puedes editar objetivos en la fase actual de definición',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { goalsCascadeEnabled: true },
    });
    const cascadeEnabled = isGoalsCascadeEnabled(company);
    if (!cascadeEnabled && dto.cascadedGoals.length > 0) {
      throw new BadRequestException(
        'El cascadeo de objetivos no está activo en la compañía',
      );
    }
    if (exceedsMaxObjectives(dto.individualGoals.length, ctx.cycle.maxObjectives)) {
      throw new BadRequestException(
        `No puedes definir más de ${ctx.cycle.maxObjectives} objetivos individuales`,
      );
    }

    await this.prisma.$transaction((tx) =>
      this.persistDefinition(tx, companyId, ctx, dto, submit, unlockedInFollowUp),
    );
  }

  private async persistDefinition(
    tx: Prisma.TransactionClient,
    companyId: string,
    ctx: ActorContext,
    dto: SaveGoalDefinitionDto,
    submit: boolean,
    unlockUsed: boolean,
  ) {
    const goalCycleId = ctx.cycle.goalCycleId!;
    const [reportIds, scaleIds, orgIds] = await Promise.all([
      this.directReportIds(tx, companyId, ctx.employee.id),
      this.activeScaleIds(tx, companyId),
      this.organizationalGoalIds(tx, companyId, goalCycleId),
    ]);

    for (const item of dto.individualGoals) {
      this.assertScale(item.scaleId, scaleIds);
      await this.upsertOwnedGoal(tx, {
        companyId,
        userId: ctx.userId,
        goalCycleId,
        item,
        assigneeId: ctx.employee.id,
        parentGoalId: null,
      });
    }

    for (const item of dto.cascadedGoals) {
      this.assertScale(item.scaleId, scaleIds);
      if (!reportIds.has(item.assigneeEmployeeId)) {
        throw new BadRequestException(
          'Solo puedes cascadear objetivos a tus reportes directos',
        );
      }
      if (!orgIds.has(item.parentGoalId)) {
        throw new BadRequestException(
          'El objetivo origen del cascadeo debe ser organizacional',
        );
      }
      await this.upsertOwnedGoal(tx, {
        companyId,
        userId: ctx.userId,
        goalCycleId,
        item,
        assigneeId: item.assigneeEmployeeId,
        parentGoalId: item.parentGoalId,
      });
    }

    const keepIds = [
      ...dto.individualGoals.map((g) => g.id).filter(Boolean),
      ...dto.cascadedGoals.map((g) => g.id).filter(Boolean),
    ] as string[];
    await this.removeDroppedDrafts(
      tx,
      companyId,
      ctx.userId,
      goalCycleId,
      keepIds,
    );

    if (dto.pdi) {
      await this.upsertPdi(tx, companyId, ctx, dto.pdi);
    }

    await tx.performanceGoalDefinition.upsert({
      where: {
        cycleId_employeeId: {
          cycleId: ctx.cycle.id,
          employeeId: ctx.employee.id,
        },
      },
      create: {
        companyId,
        cycleId: ctx.cycle.id,
        employeeId: ctx.employee.id,
        submittedAt: submit ? new Date() : null,
        reviewStatus: submit ? GoalDefinitionReviewStatus.PENDING : null,
        structureUnlocked: false,
      },
      update: submit
        ? {
            submittedAt: new Date(),
            reviewStatus: GoalDefinitionReviewStatus.PENDING,
            reviewComment: null,
            reviewedAt: null,
            reviewedByEmployeeId: null,
            structureUnlocked: false,
          }
        : unlockUsed
          ? { structureUnlocked: false }
          : {},
    });

    if (submit) {
      await tx.goal.updateMany({
        where: {
          companyId,
          cycleId: goalCycleId,
          createdByUserId: ctx.userId,
          type: GoalType.INDIVIDUAL,
          status: GoalStatus.DRAFT,
        },
        data: { status: GoalStatus.ACTIVE },
      });
      const manager = await tx.employeeReportingLine.findFirst({
        where: {
          companyId,
          employeeId: ctx.employee.id,
          type: ReportingLineType.DIRECT,
        },
        select: { managerEmployeeId: true },
      });
      if (manager) {
        await createPerformanceNotification(tx, {
          companyId,
          employeeId: manager.managerEmployeeId,
          cycleId: ctx.cycle.id,
          type: 'GOAL_DEFINITION_SUBMITTED',
          title: 'Definición de objetivos por aprobar',
          body: `Un colaborador envió su definición de objetivos en ${ctx.cycle.name}.`,
        });
      }
    }
  }

  private async persistFollowUp(
    tx: Prisma.TransactionClient,
    companyId: string,
    ctx: ActorContext,
    dto: SaveGoalDefinitionDto,
  ) {
    const items = [...dto.individualGoals, ...dto.cascadedGoals];
    for (const item of items) {
      if (!item.id) continue;
      await tx.goal.updateMany({
        where: {
          id: item.id,
          companyId,
          cycleId: ctx.cycle.goalCycleId!,
          type: GoalType.INDIVIDUAL,
          OR: [
            { assignments: { some: { employeeId: ctx.employee.id } } },
            {
              assignments: {
                some: {
                  employee: {
                    reportingTo: {
                      some: {
                        managerEmployeeId: ctx.employee.id,
                        type: ReportingLineType.DIRECT,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        data: { progressStatus: item.progressStatus },
      });
    }

    const newGoals = dto.individualGoals.filter((item) => !item.id);
    if (newGoals.length > 0) {
      const finished = await tx.goal.findFirst({
        where: {
          companyId,
          cycleId: ctx.cycle.goalCycleId!,
          type: GoalType.INDIVIDUAL,
          progressStatus: GoalProgressStatus.FINISHED,
          assignments: { some: { employeeId: ctx.employee.id } },
        },
        select: { id: true },
      });
      if (!finished) {
        throw new BadRequestException(
          'Solo puedes crear un objetivo nuevo cuando uno existente está finalizado',
        );
      }
      const scaleIds = await this.activeScaleIds(tx, companyId);
      const existingCount = dto.individualGoals.filter((item) => item.id).length;
      if (
        exceedsMaxObjectives(
          existingCount + newGoals.length,
          ctx.cycle.maxObjectives,
        )
      ) {
        throw new BadRequestException(
          `No puedes definir más de ${ctx.cycle.maxObjectives} objetivos individuales`,
        );
      }
      for (const item of newGoals) {
        this.assertScale(item.scaleId, scaleIds);
        await this.upsertOwnedGoal(tx, {
          companyId,
          userId: ctx.userId,
          goalCycleId: ctx.cycle.goalCycleId!,
          item: { ...item, progressStatus: GoalProgressStatus.NOT_STARTED },
          assigneeId: ctx.employee.id,
          parentGoalId: null,
          forceActive: true,
        });
      }
    }

    if (dto.pdi) {
      const existing = await tx.performanceIndividualDevelopmentPlan.findUnique({
        where: {
          cycleId_employeeId: {
            cycleId: ctx.cycle.id,
            employeeId: ctx.employee.id,
          },
        },
      });
      if (!existing) return;
      await tx.performanceIndividualDevelopmentPlan.update({
        where: { id: existing.id },
        data: {
          progressPercent: clampProgressPercent(dto.pdi.progressPercent),
          progressNotes:
            emptyToNull(dto.pdi.progressNotes) ?? existing.progressNotes,
          strengths: emptyToNull(dto.pdi.strengths) ?? existing.strengths,
          improvements:
            emptyToNull(dto.pdi.improvements) ?? existing.improvements,
        },
      });
    }
  }

  private async upsertOwnedGoal(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      userId: string;
      goalCycleId: string;
      item: GoalDefinitionItemDto | CascadedGoalItemDto;
      assigneeId: string;
      parentGoalId: string | null;
      forceActive?: boolean;
    },
  ) {
    const title = params.item.title.trim();
    if (!title) {
      throw new BadRequestException('El título del objetivo es obligatorio');
    }
    const data = {
      title,
      description: emptyToNull(params.item.description) ?? null,
      progressStatus: params.item.progressStatus,
      scaleId: params.item.scaleId,
      parentGoalId: params.parentGoalId,
    };

    if (params.item.id) {
      const existing = await tx.goal.findFirst({
        where: {
          id: params.item.id,
          companyId: params.companyId,
          cycleId: params.goalCycleId,
          createdByUserId: params.userId,
          type: GoalType.INDIVIDUAL,
        },
      });
      if (!existing) {
        throw new NotFoundException('Objetivo no encontrado');
      }
      if (
        existing.status !== GoalStatus.DRAFT &&
        existing.status !== GoalStatus.ACTIVE
      ) {
        throw new BadRequestException('Ese objetivo ya no se puede editar');
      }
      await tx.goal.update({ where: { id: existing.id }, data });
      return;
    }

    const created = await tx.goal.create({
      data: {
        companyId: params.companyId,
        cycleId: params.goalCycleId,
        createdByUserId: params.userId,
        type: GoalType.INDIVIDUAL,
        status: params.forceActive ? GoalStatus.ACTIVE : GoalStatus.DRAFT,
        ...data,
      },
    });
    await tx.goalAssignment.create({
      data: {
        companyId: params.companyId,
        goalId: created.id,
        employeeId: params.assigneeId,
      },
    });
  }

  private async removeDroppedDrafts(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    goalCycleId: string,
    keepIds: string[],
  ) {
    const dropped = await tx.goal.findMany({
      where: {
        companyId,
        cycleId: goalCycleId,
        createdByUserId: userId,
        type: GoalType.INDIVIDUAL,
        status: GoalStatus.DRAFT,
        ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
      },
      select: { id: true },
    });
    if (dropped.length === 0) return;
    const ids = dropped.map((row) => row.id);
    await tx.goalAssignment.deleteMany({
      where: { companyId, goalId: { in: ids } },
    });
    await tx.goal.deleteMany({ where: { companyId, id: { in: ids } } });
  }

  private async upsertPdi(
    tx: Prisma.TransactionClient,
    companyId: string,
    ctx: ActorContext,
    pdi: GoalDefinitionPdiDto,
  ) {
    const name = pdi.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del PDI es obligatorio');
    }
    if (pdi.competencyId) {
      const competency = await tx.competency.findFirst({
        where: {
          id: pdi.competencyId,
          companyId,
          deletedAt: null,
          status: OrganizationEntityStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!competency) {
        throw new BadRequestException('La competencia del PDI no es válida');
      }
    }
    const progressPercent = clampProgressPercent(pdi.progressPercent);
    await tx.performanceIndividualDevelopmentPlan.upsert({
      where: {
        cycleId_employeeId: {
          cycleId: ctx.cycle.id,
          employeeId: ctx.employee.id,
        },
      },
      create: {
        companyId,
        cycleId: ctx.cycle.id,
        employeeId: ctx.employee.id,
        name,
        competencyId: pdi.competencyId ?? null,
        actions70: emptyToNull(pdi.actions70) ?? null,
        actions20: emptyToNull(pdi.actions20) ?? null,
        actions10: emptyToNull(pdi.actions10) ?? null,
        observations: emptyToNull(pdi.observations) ?? null,
        progressPercent,
        progressNotes: emptyToNull(pdi.progressNotes) ?? null,
        strengths: emptyToNull(pdi.strengths) ?? null,
        improvements: emptyToNull(pdi.improvements) ?? null,
      },
      update: {
        name,
        competencyId: pdi.competencyId ?? null,
        actions70: emptyToNull(pdi.actions70) ?? null,
        actions20: emptyToNull(pdi.actions20) ?? null,
        actions10: emptyToNull(pdi.actions10) ?? null,
        observations: emptyToNull(pdi.observations) ?? null,
        progressPercent,
        ...(pdi.progressNotes !== undefined
          ? { progressNotes: emptyToNull(pdi.progressNotes) ?? null }
          : {}),
        ...(pdi.strengths !== undefined
          ? { strengths: emptyToNull(pdi.strengths) ?? null }
          : {}),
        ...(pdi.improvements !== undefined
          ? { improvements: emptyToNull(pdi.improvements) ?? null }
          : {}),
      },
    });
  }

  private assertScale(scaleId: string, activeIds: Set<string>) {
    if (!activeIds.has(scaleId)) {
      throw new BadRequestException(
        'Selecciona una escala cualitativa o cuantitativa activa',
      );
    }
  }

  private async activeScaleIds(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const rows = await tx.competencyScale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: OrganizationEntityStatus.ACTIVE,
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private async organizationalGoalIds(
    tx: Prisma.TransactionClient,
    companyId: string,
    goalCycleId: string,
  ) {
    const rows = await tx.goal.findMany({
      where: {
        companyId,
        cycleId: goalCycleId,
        type: { in: [GoalType.COMPANY, GoalType.AREA] },
        status: { not: GoalStatus.CANCELLED },
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private async directReportIds(
    tx: Prisma.TransactionClient,
    companyId: string,
    managerId: string,
  ) {
    const rows = await tx.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: managerId,
        type: ReportingLineType.DIRECT,
        employee: { deletedAt: null },
      },
      select: { employeeId: true },
    });
    return new Set(rows.map((row) => row.employeeId));
  }

  private async submittedAt(cycleId: string, employeeId: string) {
    const row = await this.prisma.performanceGoalDefinition.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      select: {
        submittedAt: true,
        reviewStatus: true,
        reviewComment: true,
        structureUnlocked: true,
      },
    });
    return row;
  }

  private async loadContext(
    companyId: string,
    userId: string,
    cycleId: string,
  ): Promise<ActorContext> {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, areaId: true },
    });
    if (!employee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }

    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      include: { followUps: { orderBy: { order: 'asc' } } },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const participant = await this.prisma.performanceCycleParticipant.findFirst({
      where: {
        companyId,
        cycleId,
        employeeId: employee.id,
        status: { not: PerformanceParticipantStatus.EXCLUDED },
      },
      select: { id: true },
    });
    if (!participant) {
      throw new ForbiddenException('No estás invitado a este ciclo');
    }

    return { cycle, employee, userId };
  }

  private async serializeWorkspace(companyId: string, ctx: ActorContext) {
    const goalCycleId = ctx.cycle.goalCycleId;
    const [definition, company, pendingEdit] = await Promise.all([
      this.submittedAt(ctx.cycle.id, ctx.employee.id),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { goalsCascadeEnabled: true },
      }),
      this.prisma.performanceGoalModificationRequest.findFirst({
        where: {
          cycleId: ctx.cycle.id,
          employeeId: ctx.employee.id,
          status: GoalModificationRequestStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const submittedAt = definition?.submittedAt ?? null;
    const phases = buildCyclePhases(ctx.cycle);
    const definitionEditable =
      (!submittedAt || Boolean(definition?.structureUnlocked)) &&
      (canEditGoalsInCyclePhase({
        cycleStatus: ctx.cycle.status,
        phases,
        kind: 'GOAL_DEFINITION',
      }) ||
        (Boolean(definition?.structureUnlocked) &&
          canEditGoalsInCyclePhase({
            cycleStatus: ctx.cycle.status,
            phases,
            kind: 'FOLLOW_UP',
          })));
    const followUpEditable = canEditGoalsInCyclePhase({
      cycleStatus: ctx.cycle.status,
      phases,
      kind: 'FOLLOW_UP',
    });

    const [
      orgGoals,
      ownedGoals,
      assignedGoals,
      pdi,
      scales,
      competencies,
      reports,
    ] = await Promise.all([
      goalCycleId
        ? this.prisma.goal.findMany({
            where: {
              companyId,
              cycleId: goalCycleId,
              type: { in: [GoalType.COMPANY, GoalType.AREA] },
              status: { not: GoalStatus.CANCELLED },
            },
            include: {
              scale: { select: { id: true, name: true, kind: true } },
              area: { select: { id: true, name: true } },
              parentGoal: { select: { id: true, title: true } },
              assignments: {
                include: {
                  employee: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
                take: 1,
              },
            },
            orderBy: { title: 'asc' },
          })
        : Promise.resolve([]),
      goalCycleId
        ? this.prisma.goal.findMany({
            where: {
              companyId,
              cycleId: goalCycleId,
              type: GoalType.INDIVIDUAL,
              createdByUserId: ctx.userId,
            },
            include: GOAL_INCLUDE,
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      goalCycleId
        ? this.prisma.goal.findMany({
            where: {
              companyId,
              cycleId: goalCycleId,
              type: GoalType.INDIVIDUAL,
              parentGoalId: { not: null },
              assignments: { some: { employeeId: ctx.employee.id } },
            },
            include: GOAL_INCLUDE,
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.performanceIndividualDevelopmentPlan.findUnique({
        where: {
          cycleId_employeeId: {
            cycleId: ctx.cycle.id,
            employeeId: ctx.employee.id,
          },
        },
        include: { competency: { select: { id: true, name: true } } },
      }),
      this.prisma.competencyScale.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: OrganizationEntityStatus.ACTIVE,
        },
        select: { id: true, name: true, kind: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.competency.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: OrganizationEntityStatus.ACTIVE,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employeeReportingLine.findMany({
        where: {
          companyId,
          managerEmployeeId: ctx.employee.id,
          type: ReportingLineType.DIRECT,
          employee: { deletedAt: null },
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const ownedIds = new Set(ownedGoals.map((goal) => goal.id));
    const individualGoals = ownedGoals.filter((goal) => goal.parentGoalId == null);
    const cascadedGoals = ownedGoals.filter((goal) => goal.parentGoalId != null);
    const assignedFromCascade = assignedGoals.filter(
      (goal) => !ownedIds.has(goal.id),
    );

    return {
      cycle: {
        id: ctx.cycle.id,
        name: ctx.cycle.name,
        status: ctx.cycle.status,
        goalCycleId,
        maxObjectives: ctx.cycle.maxObjectives,
      },
      cascadeEnabled: isGoalsCascadeEnabled(company),
      submittedAt,
      reviewStatus: definition?.reviewStatus ?? null,
      reviewComment: definition?.reviewComment ?? null,
      structureUnlocked: Boolean(definition?.structureUnlocked),
      pendingEditRequest: pendingEdit
        ? {
            id: pendingEdit.id,
            comment: pendingEdit.comment,
            createdAt: pendingEdit.createdAt,
          }
        : null,
      canRequestEdit:
        Boolean(submittedAt) &&
        followUpEditable &&
        !definition?.structureUnlocked &&
        !pendingEdit,
      canAddFinishedGoal:
        followUpEditable &&
        individualGoals.some(
          (goal) => goal.progressStatus === GoalProgressStatus.FINISHED,
        ),
      editable: definitionEditable,
      progressEditable: followUpEditable,
      organizationalGoals: orgGoals.map((goal) => this.serializeGoal(goal)),
      assignedFromCascade: assignedFromCascade.map((goal) =>
        this.serializeGoal(goal),
      ),
      individualGoals: individualGoals.map((goal) => this.serializeGoal(goal)),
      cascadedGoals: cascadedGoals.map((goal) => this.serializeGoal(goal)),
      pdi: pdi
        ? {
            id: pdi.id,
            name: pdi.name,
            competencyId: pdi.competencyId,
            competencyName: pdi.competency?.name ?? null,
            actions70: pdi.actions70,
            actions20: pdi.actions20,
            actions10: pdi.actions10,
            observations: pdi.observations,
            progressNotes: pdi.progressNotes,
            strengths: pdi.strengths,
            improvements: pdi.improvements,
            progressPercent: pdi.progressPercent,
            status: pdiStatusFromPercent(pdi.progressPercent),
          }
        : null,
      scales,
      competencies,
      directReports: reports
        .map((row) => row.employee)
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
            'es',
          ),
        ),
    };
  }

  private serializeGoal(goal: {
    id: string;
    title: string;
    description: string | null;
    progressStatus: GoalProgressStatus;
    scaleId: string | null;
    parentGoalId: string | null;
    status: GoalStatus;
    scale: { id: string; name: string; kind: string } | null;
    area?: { id: string; name: string } | null;
    assignments: Array<{
      employee: { id: string; firstName: string; lastName: string };
    }>;
    parentGoal?: { id: string; title: string } | null;
  }) {
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      progressStatus: goal.progressStatus,
      scaleId: goal.scaleId,
      scale: goal.scale,
      parentGoalId: goal.parentGoalId,
      parentGoalTitle: goal.parentGoal?.title ?? null,
      status: goal.status,
      areaName: goal.area?.name ?? null,
      assignee: goal.assignments[0]?.employee ?? null,
    };
  }
}
