import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PerformanceParticipantStatus,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildCyclePhases,
  currentCyclePhase,
  isCycleActiveForEditing,
} from '../cycle-phases';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import { emptyToNull } from '../performance.helpers';
import { clampProgressPercent } from '../goal-definition/pdi-progress';
import type { SaveClosingSessionDto } from './dto/closing.dto';

@Injectable()
export class ClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(
    companyId: string,
    userId: string,
    cycleId: string,
    employeeId?: string,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    const cycle = await this.requireCycle(companyId, cycleId);
    const subjectId = employeeId ?? actor.id;
    if (subjectId !== actor.id) {
      await this.assertManages(companyId, actor.id, subjectId);
    }
    await this.assertParticipant(companyId, cycleId, subjectId);

    const [employee, session, pdi, result, goals] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: subjectId, companyId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.performanceClosingSession.findUnique({
        where: { cycleId_employeeId: { cycleId, employeeId: subjectId } },
      }),
      this.prisma.performanceIndividualDevelopmentPlan.findUnique({
        where: { cycleId_employeeId: { cycleId, employeeId: subjectId } },
        include: { competency: { select: { name: true } } },
      }),
      this.prisma.performanceResult.findFirst({
        where: { companyId, cycleId, employeeId: subjectId },
        orderBy: { updatedAt: 'desc' },
      }),
      cycle.goalCycleId
        ? this.prisma.goal.findMany({
            where: {
              companyId,
              cycleId: cycle.goalCycleId,
              assignments: { some: { employeeId: subjectId } },
            },
            select: {
              id: true,
              title: true,
              progressStatus: true,
              ratings: {
                where: {
                  evaluation: { cycleId, employeeId: subjectId },
                },
                include: {
                  evaluation: { select: { type: true } },
                  scaleLevel: { select: { label: true, value: true } },
                },
              },
            },
            orderBy: { title: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    if (!employee) throw new NotFoundException('Colaborador no encontrado');

    const phases = buildCyclePhases(cycle);
    const current = currentCyclePhase(phases);
    const closingCurrent = current?.kind === 'CLOSING';
    const isSubject = actor.id === subjectId;
    const accepted = Boolean(session?.acceptedAt);

    return {
      cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
      employee,
      isSubject,
      acceptedAt: session?.acceptedAt ?? null,
      collaboratorObservations: session?.collaboratorObservations ?? null,
      leaderObservations: session?.leaderObservations ?? null,
      canEditPdi:
        isCycleActiveForEditing(cycle.status) &&
        closingCurrent &&
        !accepted,
      canEditObservations:
        isCycleActiveForEditing(cycle.status) &&
        closingCurrent &&
        !accepted,
      canAccept:
        isSubject &&
        isCycleActiveForEditing(cycle.status) &&
        closingCurrent &&
        !accepted,
      result: result
        ? {
            overallScore: result.overallScore?.toString() ?? null,
            competencyScore: result.competencyScore?.toString() ?? null,
            goalsAchievement: result.goalsAchievement?.toString() ?? null,
          }
        : null,
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        progressStatus: goal.progressStatus,
        ratings: goal.ratings.map((rating) => ({
          type: rating.evaluation.type,
          label: rating.scaleLevel?.label ?? null,
          value: rating.ratingValue,
        })),
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
            progressNotes: pdi.progressNotes,
            strengths: pdi.strengths,
            improvements: pdi.improvements,
          }
        : null,
    };
  }

  async save(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: SaveClosingSessionDto,
  ) {
    const actor = await this.requireEmployee(companyId, userId);
    const subjectId = dto.employeeId ?? actor.id;
    const current = await this.get(companyId, userId, cycleId, subjectId);
    if (!current.canEditObservations && !current.canEditPdi) {
      throw new ForbiddenException(
        'La sesión de cierre no admite edición en este momento',
      );
    }
    if (current.acceptedAt) {
      throw new BadRequestException('La sesión de cierre ya fue aceptada');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.performanceClosingSession.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: subjectId } },
        create: {
          companyId,
          cycleId,
          employeeId: subjectId,
          collaboratorObservations: current.isSubject
            ? emptyToNull(dto.collaboratorObservations) ?? null
            : null,
          leaderObservations: current.isSubject
            ? null
            : emptyToNull(dto.leaderObservations) ?? null,
        },
        update: current.isSubject
          ? {
              collaboratorObservations:
                emptyToNull(dto.collaboratorObservations) ?? undefined,
            }
          : {
              leaderObservations:
                emptyToNull(dto.leaderObservations) ?? undefined,
            },
      });
      if (dto.pdiProgressPercent != null || dto.pdiProgressNotes != null) {
        const pdi = await tx.performanceIndividualDevelopmentPlan.findUnique({
          where: {
            cycleId_employeeId: { cycleId, employeeId: subjectId },
          },
        });
        if (pdi) {
          await tx.performanceIndividualDevelopmentPlan.update({
            where: { id: pdi.id },
            data: {
              ...(dto.pdiProgressPercent != null
                ? {
                    progressPercent: clampProgressPercent(dto.pdiProgressPercent),
                  }
                : {}),
              ...(dto.pdiProgressNotes !== undefined
                ? { progressNotes: emptyToNull(dto.pdiProgressNotes) }
                : {}),
              ...(dto.pdiStrengths !== undefined
                ? { strengths: emptyToNull(dto.pdiStrengths) }
                : {}),
              ...(dto.pdiImprovements !== undefined
                ? { improvements: emptyToNull(dto.pdiImprovements) }
                : {}),
            },
          });
        }
      }
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CLOSING_SESSION_SAVED,
      entity: 'PerformanceClosingSession',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { employeeId: subjectId },
    });
    return this.get(companyId, userId, cycleId, subjectId);
  }

  async accept(companyId: string, userId: string, cycleId: string) {
    const current = await this.get(companyId, userId, cycleId);
    if (!current.canAccept) {
      throw new ForbiddenException(
        'Solo el colaborador puede aceptar en la fase de cierre',
      );
    }
    const actor = await this.requireEmployee(companyId, userId);
    await this.prisma.performanceClosingSession.upsert({
      where: { cycleId_employeeId: { cycleId, employeeId: actor.id } },
      create: {
        companyId,
        cycleId,
        employeeId: actor.id,
        acceptedAt: new Date(),
      },
      update: { acceptedAt: new Date() },
    });
    await this.audit.create({
      action: PERFORMANCE_AUDIT.CLOSING_SESSION_ACCEPTED,
      entity: 'PerformanceClosingSession',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return this.get(companyId, userId, cycleId);
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
      include: { followUps: { orderBy: { order: 'asc' } } },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    return cycle;
  }

  private async assertParticipant(
    companyId: string,
    cycleId: string,
    employeeId: string,
  ) {
    const row = await this.prisma.performanceCycleParticipant.findFirst({
      where: {
        companyId,
        cycleId,
        employeeId,
        status: { not: PerformanceParticipantStatus.EXCLUDED },
      },
      select: { id: true },
    });
    if (!row) {
      throw new ForbiddenException('No estás invitado a este ciclo');
    }
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
        'Solo puedes ver el cierre de tus reportes directos',
      );
    }
  }
}
