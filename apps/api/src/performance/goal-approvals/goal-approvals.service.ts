import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GoalDefinitionReviewStatus,
  GoalModificationRequestStatus,
  GoalType,
  PerformanceParticipantStatus,
  ReportingLineType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import { createPerformanceNotification } from '../inbox/notify';
import type { ReviewCommentDto } from '../goal-definition/dto/goal-definition.dto';

const EMPLOYEE_NAME = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class GoalApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, userId: string, cycleId: string) {
    const actor = await this.requireEmployee(companyId, userId);
    await this.requireCycle(companyId, cycleId);
    const reports = await this.directReports(companyId, actor.id);
    if (reports.length === 0) return { items: [] };

    const reportIds = reports.map((row) => row.id);
    const [participants, definitions, editRequests] = await Promise.all([
      this.prisma.performanceCycleParticipant.findMany({
        where: {
          companyId,
          cycleId,
          employeeId: { in: reportIds },
          status: { not: PerformanceParticipantStatus.EXCLUDED },
        },
        select: { employeeId: true },
      }),
      this.prisma.performanceGoalDefinition.findMany({
        where: { companyId, cycleId, employeeId: { in: reportIds } },
      }),
      this.prisma.performanceGoalModificationRequest.findMany({
        where: {
          companyId,
          cycleId,
          employeeId: { in: reportIds },
          status: GoalModificationRequestStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const invited = new Set(participants.map((row) => row.employeeId));
    const definitionByEmployee = new Map(
      definitions.map((row) => [row.employeeId, row]),
    );
    const editByEmployee = new Map(
      editRequests.map((row) => [row.employeeId, row]),
    );

    return {
      items: reports
        .filter((row) => invited.has(row.id))
        .map((employee) => {
          const definition = definitionByEmployee.get(employee.id);
          const edit = editByEmployee.get(employee.id);
          return {
            employee,
            submittedAt: definition?.submittedAt ?? null,
            reviewStatus: definition?.reviewStatus ?? null,
            reviewComment: definition?.reviewComment ?? null,
            structureUnlocked: Boolean(definition?.structureUnlocked),
            pendingEditRequest: edit
              ? { id: edit.id, comment: edit.comment, createdAt: edit.createdAt }
              : null,
          };
        }),
    };
  }

  async get(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    await this.assertManages(companyId, actor.id, employeeId);
    const cycle = await this.requireCycle(companyId, cycleId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: EMPLOYEE_NAME,
    });
    if (!employee) throw new NotFoundException('Colaborador no encontrado');

    const [definition, pdi, goals] = await Promise.all([
      this.prisma.performanceGoalDefinition.findUnique({
        where: { cycleId_employeeId: { cycleId, employeeId } },
      }),
      this.prisma.performanceIndividualDevelopmentPlan.findUnique({
        where: { cycleId_employeeId: { cycleId, employeeId } },
        include: { competency: { select: { id: true, name: true } } },
      }),
      cycle.goalCycleId
        ? this.prisma.goal.findMany({
            where: {
              companyId,
              cycleId: cycle.goalCycleId,
              type: GoalType.INDIVIDUAL,
              assignments: { some: { employeeId } },
            },
            include: {
              scale: { select: { id: true, name: true, kind: true } },
              parentGoal: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
      employee,
      submittedAt: definition?.submittedAt ?? null,
      reviewStatus: definition?.reviewStatus ?? null,
      reviewComment: definition?.reviewComment ?? null,
      structureUnlocked: Boolean(definition?.structureUnlocked),
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        progressStatus: goal.progressStatus,
        scale: goal.scale,
        parentGoalTitle: goal.parentGoal?.title ?? null,
      })),
      pdi: pdi
        ? {
            name: pdi.name,
            competencyName: pdi.competency?.name ?? null,
            actions70: pdi.actions70,
            actions20: pdi.actions20,
            actions10: pdi.actions10,
            observations: pdi.observations,
            progressPercent: pdi.progressPercent,
          }
        : null,
    };
  }

  async approve(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
    dto: ReviewCommentDto,
  ) {
    return this.reviewDefinition(
      companyId,
      userId,
      cycleId,
      employeeId,
      GoalDefinitionReviewStatus.APPROVED,
      dto.comment ?? null,
    );
  }

  async reject(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
    dto: ReviewCommentDto,
  ) {
    return this.reviewDefinition(
      companyId,
      userId,
      cycleId,
      employeeId,
      GoalDefinitionReviewStatus.REJECTED,
      dto.comment ?? null,
    );
  }

  async requestEdit(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: ReviewCommentDto,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    await this.requireCycle(companyId, cycleId);
    const definition = await this.prisma.performanceGoalDefinition.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId: actor.id } },
    });
    if (!definition?.submittedAt) {
      throw new BadRequestException(
        'Solo puedes pedir edición después de enviar la definición',
      );
    }
    if (definition.structureUnlocked) {
      throw new BadRequestException('La edición ya está habilitada');
    }
    const existing = await this.prisma.performanceGoalModificationRequest.findFirst({
      where: {
        companyId,
        cycleId,
        employeeId: actor.id,
        status: GoalModificationRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException('Ya tienes una solicitud de edición pendiente');
    }

    const manager = await this.managerOf(companyId, actor.id);
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.performanceGoalModificationRequest.create({
        data: {
          companyId,
          cycleId,
          employeeId: actor.id,
          comment: dto.comment?.trim() || null,
        },
      });
      if (manager) {
        await createPerformanceNotification(tx, {
          companyId,
          employeeId: manager,
          cycleId,
          type: 'GOAL_EDIT_REQUESTED',
          title: 'Solicitud de edición de objetivos',
          body: 'Un colaborador pide habilitar la edición de sus objetivos.',
        });
      }
      return created;
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.GOAL_EDIT_REQUESTED,
      entity: 'PerformanceGoalModificationRequest',
      entityId: request.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return { id: request.id, status: request.status };
  }

  async reviewEditRequest(
    companyId: string,
    userId: string,
    cycleId: string,
    requestId: string,
    approve: boolean,
    dto: ReviewCommentDto,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    const request = await this.prisma.performanceGoalModificationRequest.findFirst({
      where: { id: requestId, companyId, cycleId },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== GoalModificationRequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }
    await this.assertManages(companyId, actor.id, request.employeeId);

    await this.prisma.$transaction(async (tx) => {
      await tx.performanceGoalModificationRequest.update({
        where: { id: request.id },
        data: {
          status: approve
            ? GoalModificationRequestStatus.APPROVED
            : GoalModificationRequestStatus.REJECTED,
          reviewComment: dto.comment?.trim() || null,
          reviewedAt: new Date(),
          reviewedByEmployeeId: actor.id,
        },
      });
      if (approve) {
        await tx.performanceGoalDefinition.updateMany({
          where: {
            cycleId,
            employeeId: request.employeeId,
            companyId,
          },
          data: { structureUnlocked: true },
        });
      }
      await createPerformanceNotification(tx, {
        companyId,
        employeeId: request.employeeId,
        cycleId,
        type: approve ? 'GOAL_EDIT_APPROVED' : 'GOAL_EDIT_REJECTED',
        title: approve
          ? 'Edición de objetivos habilitada'
          : 'Solicitud de edición rechazada',
        body: approve
          ? 'Tu líder habilitó la edición de objetivos. Recuerda guardar para volver a bloquearlos.'
          : dto.comment?.trim() || 'Tu líder no habilitó la edición.',
      });
    });

    await this.audit.create({
      action: approve
        ? PERFORMANCE_AUDIT.GOAL_EDIT_APPROVED
        : PERFORMANCE_AUDIT.GOAL_EDIT_REJECTED,
      entity: 'PerformanceGoalModificationRequest',
      entityId: request.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return this.list(companyId, userId, cycleId);
  }

  private async reviewDefinition(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId: string,
    status: GoalDefinitionReviewStatus,
    comment: string | null,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    await this.assertManages(companyId, actor.id, employeeId);
    const definition = await this.prisma.performanceGoalDefinition.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
    });
    if (!definition?.submittedAt) {
      throw new BadRequestException(
        'El colaborador aún no envió su definición',
      );
    }
    if (definition.reviewStatus === GoalDefinitionReviewStatus.APPROVED) {
      throw new BadRequestException('La definición ya está aprobada');
    }

    const approved = status === GoalDefinitionReviewStatus.APPROVED;
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceGoalDefinition.update({
        where: { id: definition.id },
        data: {
          reviewStatus: status,
          reviewComment: comment?.trim() || null,
          reviewedAt: new Date(),
          reviewedByEmployeeId: actor.id,
          submittedAt: approved ? definition.submittedAt : null,
          structureUnlocked: false,
        },
      });
      await createPerformanceNotification(tx, {
        companyId,
        employeeId,
        cycleId,
        type: approved
          ? 'GOAL_DEFINITION_APPROVED'
          : 'GOAL_DEFINITION_REJECTED',
        title: approved
          ? 'Objetivos aprobados'
          : 'Objetivos rechazados',
        body: approved
          ? 'Tu líder aprobó y bloqueó tus objetivos.'
          : comment?.trim() || 'Tu líder rechazó la definición. Puedes editarla de nuevo.',
      });
    });

    await this.audit.create({
      action: approved
        ? PERFORMANCE_AUDIT.GOAL_DEFINITION_APPROVED
        : PERFORMANCE_AUDIT.GOAL_DEFINITION_REJECTED,
      entity: 'PerformanceGoalDefinition',
      entityId: definition.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return this.get(companyId, userId, cycleId, employeeId);
  }

  private async requireEmployee(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }
    return employee;
  }

  private async requireCycle(companyId: string, cycleId: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      select: { id: true, name: true, status: true, goalCycleId: true },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    return cycle;
  }

  private async directReports(companyId: string, managerId: string) {
    const rows = await this.prisma.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: managerId,
        type: ReportingLineType.DIRECT,
        employee: { deletedAt: null },
      },
      include: { employee: { select: EMPLOYEE_NAME } },
    });
    return rows.map((row) => row.employee);
  }

  private async assertManages(
    companyId: string,
    managerId: string,
    employeeId: string,
  ) {
    const row = await this.prisma.employeeReportingLine.findFirst({
      where: {
        companyId,
        managerEmployeeId: managerId,
        employeeId,
        type: ReportingLineType.DIRECT,
      },
      select: { id: true },
    });
    if (!row) {
      throw new ForbiddenException(
        'Solo puedes revisar a tus reportes directos',
      );
    }
  }

  private async managerOf(companyId: string, employeeId: string) {
    const row = await this.prisma.employeeReportingLine.findFirst({
      where: {
        companyId,
        employeeId,
        type: ReportingLineType.DIRECT,
      },
      select: { managerEmployeeId: true },
    });
    return row?.managerEmployeeId ?? null;
  }
}
