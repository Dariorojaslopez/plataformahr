import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCyclePhases, currentCyclePhase } from '../cycle-phases';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import type {
  ReassignLeaderDto,
  ResetParticipantPhaseDto,
  UnlockGoalsDto,
} from './dto/flow-controls.dto';

@Injectable()
export class FlowControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async resetPhase(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: ResetParticipantPhaseDto,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    const phases = buildCyclePhases(cycle);
    const current = currentCyclePhase(phases);
    const currentIndex = current
      ? phases.findIndex((phase) => phase.id === current.id)
      : phases.length - 1;
    const targetIndex = phases.findIndex((phase) => phase.kind === dto.phase);
    if (targetIndex < 0 || targetIndex > currentIndex) {
      throw new BadRequestException(
        'Solo puedes devolver a una fase anterior del ciclo.',
      );
    }
    const participants = await this.requireParticipants(
      companyId,
      cycleId,
      dto.participantIds,
    );
    await this.prisma.performanceCycleParticipant.updateMany({
      where: { id: { in: participants.map((row) => row.id) } },
      data: { forcedPhase: dto.phase },
    });
    await this.audit.create({
      action: PERFORMANCE_AUDIT.PARTICIPANT_PHASE_RESET,
      entity: 'PerformanceCycle',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { phase: dto.phase, participantIds: dto.participantIds },
    });
    return { updated: participants.length, phase: dto.phase };
  }

  async reassignLeader(
    companyId: string,
    userId: string,
    cycleId: string,
    dto: ReassignLeaderDto,
  ) {
    await this.requireCycle(companyId, cycleId);
    const participants = await this.requireParticipants(
      companyId,
      cycleId,
      dto.participantIds,
    );
    const employeeIds = [...new Set(participants.map((row) => row.employeeId))];
    if (employeeIds.length < 2) {
      throw new BadRequestException(
        'Selecciona un grupo de al menos dos colaboradores.',
      );
    }
    if (employeeIds.includes(dto.managerEmployeeId)) {
      throw new BadRequestException(
        'El nuevo líder no puede ser uno de los colaboradores del grupo.',
      );
    }
    const manager = await this.prisma.employee.findFirst({
      where: {
        id: dto.managerEmployeeId,
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!manager) throw new NotFoundException('Líder no encontrado');

    await this.prisma.$transaction(async (tx) => {
      for (const employeeId of employeeIds) {
        await tx.employeeReportingLine.deleteMany({
          where: { companyId, employeeId, type: ReportingLineType.DIRECT },
        });
        await tx.employeeReportingLine.create({
          data: {
            companyId,
            employeeId,
            managerEmployeeId: dto.managerEmployeeId,
            type: ReportingLineType.DIRECT,
          },
        });
      }
      await tx.performanceEvaluation.updateMany({
        where: {
          companyId,
          cycleId,
          employeeId: { in: employeeIds },
          type: PerformanceEvaluationType.MANAGER,
          status: { not: PerformanceEvaluationStatus.SUBMITTED },
        },
        data: { evaluatorEmployeeId: dto.managerEmployeeId },
      });
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PARTICIPANT_LEADER_REASSIGNED,
      entity: 'PerformanceCycle',
      entityId: cycleId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        managerEmployeeId: dto.managerEmployeeId,
        employeeIds,
      },
    });
    return { updated: employeeIds.length, managerEmployeeId: dto.managerEmployeeId };
  }

  async listGoals(companyId: string, cycleId: string, participantId: string) {
    const cycle = await this.requireCycle(companyId, cycleId);
    const participant = await this.prisma.performanceCycleParticipant.findFirst({
      where: { id: participantId, companyId, cycleId },
      select: { employeeId: true },
    });
    if (!participant || !cycle.goalCycleId) return { items: [] };
    const goals = await this.prisma.goal.findMany({
      where: {
        companyId,
        cycleId: cycle.goalCycleId,
        assignments: { some: { employeeId: participant.employeeId } },
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
    return { items: goals };
  }

  async unlockGoals(
    companyId: string,
    userId: string,
    cycleId: string,
    participantId: string,
    dto: UnlockGoalsDto,
  ) {
    const cycle = await this.requireCycle(companyId, cycleId);
    const participant = await this.prisma.performanceCycleParticipant.findFirst({
      where: { id: participantId, companyId, cycleId },
      select: { employeeId: true },
    });
    if (!participant) throw new NotFoundException('Participante no encontrado');
    const goalIds = [...new Set(dto.goalIds)];
    if (goalIds.length > 0) {
      if (!cycle.goalCycleId) {
        throw new BadRequestException('El ciclo no tiene objetivos.');
      }
      const goals = await this.prisma.goal.findMany({
        where: {
          id: { in: goalIds },
          companyId,
          cycleId: cycle.goalCycleId,
          assignments: { some: { employeeId: participant.employeeId } },
        },
        select: { id: true },
      });
      if (goals.length !== goalIds.length) {
        throw new BadRequestException(
          'Solo puedes desbloquear objetivos de ese colaborador.',
        );
      }
    }
    await this.prisma.performanceGoalDefinition.upsert({
      where: {
        cycleId_employeeId: { cycleId, employeeId: participant.employeeId },
      },
      create: {
        companyId,
        cycleId,
        employeeId: participant.employeeId,
        unlockedGoalIds: goalIds,
      },
      update: { unlockedGoalIds: goalIds },
    });
    await this.audit.create({
      action: PERFORMANCE_AUDIT.GOAL_EDIT_GRANTED,
      entity: 'PerformanceGoalDefinition',
      entityId: participantId,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { goalIds, employeeId: participant.employeeId },
    });
    return { goalIds };
  }

  private async requireCycle(companyId: string, cycleId: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      include: { followUps: { orderBy: { order: 'asc' } } },
    });
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');
    return cycle;
  }

  private async requireParticipants(
    companyId: string,
    cycleId: string,
    participantIds: string[],
  ) {
    const unique = [...new Set(participantIds)];
    const rows = await this.prisma.performanceCycleParticipant.findMany({
      where: { companyId, cycleId, id: { in: unique } },
      select: { id: true, employeeId: true },
    });
    if (rows.length !== unique.length) {
      throw new NotFoundException('Uno o más participantes no existen.');
    }
    return rows;
  }
}
