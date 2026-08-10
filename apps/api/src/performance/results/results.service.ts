import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PerformanceCycleStatus,
  PerformanceParticipantStatus,
  PerformanceResultComposition,
  PerformanceResultStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  findIncompleteApplicableGoals,
  loadApplicableGoalResultsForEmployee,
} from '../applicable-goal-results';
import {
  buildCsvDocument,
  buildPerformanceResultsCsvFilename,
  CSV_EXPORT_MAX_ROWS,
  csvExportExceedsLimit,
  csvExportLimitMessage,
} from '../csv-export';
import {
  aggregateGoalsAchievement,
  calculateIntegratedOverallScore,
  GoalsPerformanceIntegrationError,
} from '../goals-performance-integration';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PERFORMANCE_AUDIT,
} from '../performance.constants';
import { decimalToString } from '../performance.helpers';
import {
  calculatePerformanceResult,
  ConsolidationError,
} from '../result-consolidation';
import type { ListPerformanceResultsQueryDto } from './dto/result.dto';

const RESULT_STATUS_CSV_LABEL: Record<PerformanceResultStatus, string> = {
  CALCULATED: 'Calculado',
  RELEASED: 'Publicado',
};

type LockedParticipant = {
  id: string;
  companyId: string;
  cycleId: string;
  employeeId: string;
  status: PerformanceParticipantStatus;
};

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: ListPerformanceResultsQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const where = this.buildAdminResultsWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.performanceResult.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          cycle: {
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
          participant: { select: { id: true, status: true } },
          goalSnapshots: { orderBy: { order: 'asc' } },
        },
        orderBy: { calculatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.performanceResult.count({ where }),
    ]);

    return {
      items: items.map((r) => this.serializeAdminListItem(r)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async exportCsv(companyId: string, query: ListPerformanceResultsQueryDto) {
    const where = this.buildAdminResultsWhere(companyId, query);
    const total = await this.prisma.performanceResult.count({ where });
    if (csvExportExceedsLimit(total)) {
      throw new BadRequestException(csvExportLimitMessage(total));
    }

    const items = await this.prisma.performanceResult.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        cycle: { select: { id: true, name: true } },
      },
      orderBy: { calculatedAt: 'desc' },
      take: CSV_EXPORT_MAX_ROWS,
    });

    const headers = [
      'Colaborador',
      'Correo',
      'Ciclo',
      'Área',
      'Cargo',
      'Unidad de negocio',
      'Autoevaluación',
      'Evaluación del líder',
      'Resultado general',
      'Competencias',
      'Objetivos',
      'Composición',
      'Estado',
      'Fecha de cálculo',
      'Fecha de publicación',
    ];

    const rows = items.map((r) => [
      `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      r.employee.email,
      r.cycle.name,
      r.areaNameSnapshot ?? 'Sin área',
      r.positionNameSnapshot ?? 'Sin cargo',
      r.businessUnitNameSnapshot ?? 'Sin unidad de negocio',
      r.selfScore == null ? '' : Number(r.selfScore.toString()),
      r.managerScore == null ? '' : Number(r.managerScore.toString()),
      Number(r.overallScore.toString()),
      r.competencyScore == null ? '' : Number(r.competencyScore.toString()),
      r.goalsAchievement == null ? '' : Number(r.goalsAchievement.toString()),
      r.composition,
      RESULT_STATUS_CSV_LABEL[r.status],
      r.calculatedAt.toISOString(),
      r.releasedAt ? r.releasedAt.toISOString() : '',
    ]);

    const csv = buildCsvDocument({ headers, rows });
    const filename = buildPerformanceResultsCsvFilename({
      cycleNameOrId: query.cycleId
        ? (items[0]?.cycle.name ?? query.cycleId)
        : 'todos',
    });

    return { csv, filename, rowCount: items.length };
  }

  private buildAdminResultsWhere(
    companyId: string,
    query: ListPerformanceResultsQueryDto,
  ): Prisma.PerformanceResultWhereInput {
    const search = query.search?.trim();
    return {
      companyId,
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.areaId ? { areaIdSnapshot: query.areaId } : {}),
      ...(query.positionId ? { positionIdSnapshot: query.positionId } : {}),
      ...(query.businessUnitId
        ? { businessUnitIdSnapshot: query.businessUnitId }
        : {}),
      ...(search
        ? {
            employee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
  }

  async listMine(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return { items: [] };

    const items = await this.prisma.performanceResult.findMany({
      where: {
        companyId,
        employeeId: employee.id,
        status: PerformanceResultStatus.RELEASED,
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
        goalSnapshots: { orderBy: { order: 'asc' } },
      },
      orderBy: { releasedAt: 'desc' },
    });

    return {
      items: items.map((r) => this.serializeEmployeeListItem(r)),
    };
  }

  async getById(
    companyId: string,
    userId: string,
    membershipId: string,
    resultId: string,
  ) {
    const result = await this.prisma.performanceResult.findFirst({
      where: { id: resultId, companyId },
      include: {
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
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        participant: { select: { id: true, status: true } },
        releasedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        goalSnapshots: { orderBy: { order: 'asc' } },
      },
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }

    const granted =
      await this.rbac.getPermissionCodesForMembership(membershipId);
    const isAdmin = granted.has('performance.result.read');

    if (isAdmin) {
      return this.serializeAdminDetail(result);
    }

    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (
      !employee ||
      employee.id !== result.employeeId ||
      result.status !== PerformanceResultStatus.RELEASED
    ) {
      // Hide existence of unreleased / foreign results.
      throw new NotFoundException('Result not found');
    }

    return this.serializeEmployeeDetail(result);
  }

  async calculate(
    companyId: string,
    userId: string,
    cycleId: string,
    participantId: string,
  ) {
    const created = await this.prisma.$transaction(async (tx) => {
      const participant = await this.lockParticipant(
        tx,
        companyId,
        cycleId,
        participantId,
      );

      if (participant.status === PerformanceParticipantStatus.EXCLUDED) {
        throw new BadRequestException(
          'Excluded participants cannot be consolidated',
        );
      }
      if (participant.status === PerformanceParticipantStatus.COMPLETED) {
        throw new ConflictException(
          'Participant already has a calculated result',
        );
      }
      // Remaining status is ACTIVE (only ACTIVE/COMPLETED/EXCLUDED exist).

      const cycle = await tx.performanceCycle.findFirst({
        where: { id: cycleId, companyId },
      });
      if (!cycle) {
        throw new NotFoundException('Performance cycle not found');
      }
      if (cycle.status !== PerformanceCycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Results can only be calculated while the cycle is ACTIVE',
        );
      }

      const existing = await tx.performanceResult.findUnique({
        where: { participantId },
      });
      if (existing) {
        throw new ConflictException(
          'Participant already has a calculated result',
        );
      }

      const evaluations = await tx.performanceEvaluation.findMany({
        where: { companyId, participantId },
        select: {
          type: true,
          status: true,
          scorePercentage: true,
        },
      });

      let consolidation;
      try {
        consolidation = calculatePerformanceResult({
          configuredSelfWeight: Number(cycle.selfEvaluationWeight.toString()),
          configuredManagerWeight: Number(
            cycle.managerEvaluationWeight.toString(),
          ),
          evaluations: evaluations.map((e) => ({
            type: e.type,
            status: e.status,
            scorePercentage:
              e.scorePercentage == null
                ? null
                : Number(e.scorePercentage.toString()),
          })),
        });
      } catch (error) {
        if (error instanceof ConsolidationError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const competencyScore = consolidation.overallScore;
      let overallScore = competencyScore;
      let goalsAchievement: number | null = null;
      let composition: PerformanceResultComposition =
        PerformanceResultComposition.COMPETENCY_ONLY;
      let configuredCompetencyResultWeight: number | null = null;
      let configuredGoalsResultWeight: number | null = null;
      let sourceGoalCycleId: string | null = null;
      let goalSnapshots: Array<{
        sourceGoalId: string;
        sourceGoalResultId: string;
        goalTitle: string;
        goalType: 'INDIVIDUAL' | 'AREA' | 'COMPANY';
        achievementPercentage: number;
        configuredWeight: number | null;
        effectiveWeight: number;
        contribution: number;
        order: number;
      }> = [];

      if (cycle.goalCycleId) {
        composition = PerformanceResultComposition.COMPETENCY_AND_GOALS;
        sourceGoalCycleId = cycle.goalCycleId;
        configuredCompetencyResultWeight = Number(
          cycle.competencyResultWeight!.toString(),
        );
        configuredGoalsResultWeight = Number(
          cycle.goalsResultWeight!.toString(),
        );

        const employeeForGoals = await tx.employee.findFirst({
          where: { id: participant.employeeId, companyId },
          select: { areaId: true },
        });
        if (!employeeForGoals) {
          throw new NotFoundException('Employee not found for participant');
        }

        if (configuredGoalsResultWeight > 0) {
          const incomplete = await findIncompleteApplicableGoals(tx, {
            companyId,
            goalCycleId: cycle.goalCycleId,
            employeeId: participant.employeeId,
            employeeAreaId: employeeForGoals.areaId,
          });
          if (incomplete.length > 0) {
            throw new BadRequestException(
              'Existen objetivos aplicables sin resultado formal aprobado para este colaborador.',
            );
          }

          const applicable = await loadApplicableGoalResultsForEmployee(tx, {
            companyId,
            goalCycleId: cycle.goalCycleId,
            employeeId: participant.employeeId,
          });

          try {
            const aggregated = aggregateGoalsAchievement(applicable);
            goalsAchievement = aggregated.goalsAchievement;
            goalSnapshots = aggregated.snapshots;
          } catch (error) {
            if (error instanceof GoalsPerformanceIntegrationError) {
              throw new BadRequestException(error.message);
            }
            throw error;
          }

          try {
            overallScore = calculateIntegratedOverallScore({
              competencyScore,
              goalsAchievement,
              competencyResultWeight: configuredCompetencyResultWeight,
              goalsResultWeight: configuredGoalsResultWeight,
            });
          } catch (error) {
            if (error instanceof GoalsPerformanceIntegrationError) {
              throw new BadRequestException(error.message);
            }
            throw error;
          }
        } else {
          // goalsResultWeight = 0 → Goals does not block; overall = competency.
          overallScore = competencyScore;
          goalsAchievement = null;
        }
      }

      const employee = await tx.employee.findFirst({
        where: { id: participant.employeeId, companyId },
        select: {
          areaId: true,
          positionId: true,
          businessUnitId: true,
          area: { select: { name: true } },
          position: { select: { name: true } },
          businessUnit: { select: { name: true } },
        },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found for participant');
      }

      const now = new Date();
      let result;
      try {
        result = await tx.performanceResult.create({
          data: {
            companyId,
            cycleId,
            participantId,
            employeeId: participant.employeeId,
            selfScore:
              consolidation.selfScore == null
                ? null
                : new Prisma.Decimal(consolidation.selfScore.toFixed(2)),
            managerScore:
              consolidation.managerScore == null
                ? null
                : new Prisma.Decimal(consolidation.managerScore.toFixed(2)),
            competencyScore: new Prisma.Decimal(competencyScore.toFixed(2)),
            goalsAchievement:
              goalsAchievement == null
                ? null
                : new Prisma.Decimal(goalsAchievement.toFixed(2)),
            overallScore: new Prisma.Decimal(overallScore.toFixed(2)),
            configuredSelfWeight: new Prisma.Decimal(
              consolidation.configuredSelfWeight.toFixed(2),
            ),
            configuredManagerWeight: new Prisma.Decimal(
              consolidation.configuredManagerWeight.toFixed(2),
            ),
            effectiveSelfWeight: new Prisma.Decimal(
              consolidation.effectiveSelfWeight.toFixed(2),
            ),
            effectiveManagerWeight: new Prisma.Decimal(
              consolidation.effectiveManagerWeight.toFixed(2),
            ),
            configuredCompetencyResultWeight:
              configuredCompetencyResultWeight == null
                ? null
                : new Prisma.Decimal(
                    configuredCompetencyResultWeight.toFixed(2),
                  ),
            configuredGoalsResultWeight:
              configuredGoalsResultWeight == null
                ? null
                : new Prisma.Decimal(configuredGoalsResultWeight.toFixed(2)),
            composition,
            sourceGoalCycleId,
            status: PerformanceResultStatus.CALCULATED,
            areaIdSnapshot: employee.areaId,
            areaNameSnapshot: employee.area.name,
            positionIdSnapshot: employee.positionId,
            positionNameSnapshot: employee.position.name,
            businessUnitIdSnapshot: employee.businessUnitId,
            businessUnitNameSnapshot: employee.businessUnit?.name ?? null,
            calculatedAt: now,
            ...(goalSnapshots.length > 0
              ? {
                  goalSnapshots: {
                    create: goalSnapshots.map((s) => ({
                      companyId,
                      sourceGoalId: s.sourceGoalId,
                      sourceGoalResultId: s.sourceGoalResultId,
                      goalTitle: s.goalTitle,
                      goalType: s.goalType,
                      achievementPercentage: new Prisma.Decimal(
                        s.achievementPercentage.toFixed(2),
                      ),
                      configuredWeight:
                        s.configuredWeight == null
                          ? null
                          : new Prisma.Decimal(s.configuredWeight.toFixed(2)),
                      effectiveWeight: new Prisma.Decimal(
                        s.effectiveWeight.toFixed(2),
                      ),
                      contribution: new Prisma.Decimal(
                        s.contribution.toFixed(2),
                      ),
                      order: s.order,
                    })),
                  },
                }
              : {}),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Participant already has a calculated result',
          );
        }
        throw error;
      }

      const completed = await tx.performanceCycleParticipant.updateMany({
        where: {
          id: participantId,
          companyId,
          status: PerformanceParticipantStatus.ACTIVE,
        },
        data: { status: PerformanceParticipantStatus.COMPLETED },
      });
      if (completed.count !== 1) {
        throw new ConflictException(
          'Participant status changed concurrently; retry',
        );
      }

      return {
        result,
        goalCycleId: sourceGoalCycleId,
        goalSnapshotCount: goalSnapshots.length,
      };
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_RESULT_CALCULATED,
      entity: 'PerformanceResult',
      entityId: created.result.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        performanceResultId: created.result.id,
        participantId,
        cycleId,
        goalCycleId: created.goalCycleId,
        goalResultCount: created.goalSnapshotCount,
        overallScore: Number(created.result.overallScore.toString()),
      },
    });

    return this.getByIdAdmin(companyId, created.result.id);
  }

  async release(
    companyId: string,
    userId: string,
    cycleId: string,
    participantId: string,
  ) {
    const released = await this.prisma.$transaction(async (tx) => {
      const participant = await this.lockParticipant(
        tx,
        companyId,
        cycleId,
        participantId,
      );
      if (participant.status !== PerformanceParticipantStatus.COMPLETED) {
        throw new BadRequestException(
          'Only COMPLETED participants can have results released',
        );
      }

      const cycle = await tx.performanceCycle.findFirst({
        where: { id: cycleId, companyId },
        select: { status: true },
      });
      if (!cycle) {
        throw new NotFoundException('Performance cycle not found');
      }
      if (cycle.status === PerformanceCycleStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot release results for a CANCELLED cycle',
        );
      }
      if (
        cycle.status !== PerformanceCycleStatus.ACTIVE &&
        cycle.status !== PerformanceCycleStatus.CLOSED
      ) {
        throw new BadRequestException(
          'Results can only be released for ACTIVE or CLOSED cycles',
        );
      }

      const result = await tx.performanceResult.findUnique({
        where: { participantId },
      });
      if (!result || result.companyId !== companyId) {
        throw new NotFoundException('Result not found');
      }
      if (result.status === PerformanceResultStatus.RELEASED) {
        throw new ConflictException('Result is already released');
      }
      // Remaining status is CALCULATED.

      const updated = await tx.performanceResult.updateMany({
        where: {
          id: result.id,
          companyId,
          status: PerformanceResultStatus.CALCULATED,
        },
        data: {
          status: PerformanceResultStatus.RELEASED,
          releasedAt: new Date(),
          releasedByUserId: userId,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Result status changed concurrently; retry',
        );
      }

      return result.id;
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.PERFORMANCE_RESULT_RELEASED,
      entity: 'PerformanceResult',
      entityId: released,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        resultId: released,
        participantId,
        cycleId,
      },
    });

    return this.getByIdAdmin(companyId, released);
  }

  private async getByIdAdmin(companyId: string, resultId: string) {
    const result = await this.prisma.performanceResult.findFirst({
      where: { id: resultId, companyId },
      include: {
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
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        participant: { select: { id: true, status: true } },
        releasedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        goalSnapshots: { orderBy: { order: 'asc' } },
      },
    });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    return this.serializeAdminDetail(result);
  }

  private serializeGoalSnapshots(
    snapshots:
      | Array<{
          id: string;
          sourceGoalId: string | null;
          sourceGoalResultId: string | null;
          goalTitle: string;
          goalType: string;
          achievementPercentage: Prisma.Decimal;
          configuredWeight: Prisma.Decimal | null;
          effectiveWeight: Prisma.Decimal;
          contribution: Prisma.Decimal;
          order: number;
        }>
      | undefined,
  ) {
    return (snapshots ?? []).map((s) => ({
      id: s.id,
      sourceGoalId: s.sourceGoalId,
      sourceGoalResultId: s.sourceGoalResultId,
      goalTitle: s.goalTitle,
      goalType: s.goalType,
      achievementPercentage: decimalToString(s.achievementPercentage),
      configuredWeight: decimalToString(s.configuredWeight),
      effectiveWeight: decimalToString(s.effectiveWeight),
      contribution: decimalToString(s.contribution),
      order: s.order,
    }));
  }

  private async lockParticipant(
    tx: Prisma.TransactionClient,
    companyId: string,
    cycleId: string,
    participantId: string,
  ): Promise<LockedParticipant> {
    const rows = await tx.$queryRaw<LockedParticipant[]>`
      SELECT id, "companyId", "cycleId", "employeeId", status
      FROM performance_cycle_participants
      WHERE id = ${participantId}::uuid
        AND "companyId" = ${companyId}::uuid
        AND "cycleId" = ${cycleId}::uuid
      FOR UPDATE
    `;
    const participant = rows[0];
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    return participant;
  }

  private serializeAdminListItem(result: {
    id: string;
    companyId: string;
    cycleId: string;
    participantId: string;
    employeeId: string;
    selfScore: Prisma.Decimal | null;
    managerScore: Prisma.Decimal | null;
    competencyScore?: Prisma.Decimal | null;
    goalsAchievement?: Prisma.Decimal | null;
    overallScore: Prisma.Decimal;
    composition?: PerformanceResultComposition;
    status: PerformanceResultStatus;
    areaIdSnapshot: string | null;
    areaNameSnapshot: string | null;
    positionIdSnapshot: string | null;
    positionNameSnapshot: string | null;
    businessUnitIdSnapshot: string | null;
    businessUnitNameSnapshot: string | null;
    calculatedAt: Date;
    releasedAt: Date | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    cycle: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
    participant: { id: string; status: string };
    goalSnapshots?: Array<{
      id: string;
      sourceGoalId: string | null;
      sourceGoalResultId: string | null;
      goalTitle: string;
      goalType: string;
      achievementPercentage: Prisma.Decimal;
      configuredWeight: Prisma.Decimal | null;
      effectiveWeight: Prisma.Decimal;
      contribution: Prisma.Decimal;
      order: number;
    }>;
  }) {
    return {
      id: result.id,
      companyId: result.companyId,
      cycleId: result.cycleId,
      participantId: result.participantId,
      employeeId: result.employeeId,
      selfScore: decimalToString(result.selfScore),
      managerScore: decimalToString(result.managerScore),
      competencyScore: decimalToString(result.competencyScore ?? null),
      goalsAchievement: decimalToString(result.goalsAchievement ?? null),
      overallScore: decimalToString(result.overallScore),
      composition:
        result.composition ?? PerformanceResultComposition.COMPETENCY_ONLY,
      status: result.status,
      areaSnapshot: {
        id: result.areaIdSnapshot,
        name: result.areaNameSnapshot,
      },
      positionSnapshot: {
        id: result.positionIdSnapshot,
        name: result.positionNameSnapshot,
      },
      businessUnitSnapshot: {
        id: result.businessUnitIdSnapshot,
        name: result.businessUnitNameSnapshot,
      },
      calculatedAt: result.calculatedAt,
      releasedAt: result.releasedAt,
      employee: result.employee,
      participant: result.participant,
      goals: this.serializeGoalSnapshots(result.goalSnapshots),
      cycle: {
        ...result.cycle,
        startDate: result.cycle.startDate.toISOString().slice(0, 10),
        endDate: result.cycle.endDate.toISOString().slice(0, 10),
      },
    };
  }

  private serializeAdminDetail(result: {
    id: string;
    companyId: string;
    cycleId: string;
    participantId: string;
    employeeId: string;
    selfScore: Prisma.Decimal | null;
    managerScore: Prisma.Decimal | null;
    competencyScore?: Prisma.Decimal | null;
    goalsAchievement?: Prisma.Decimal | null;
    overallScore: Prisma.Decimal;
    configuredSelfWeight: Prisma.Decimal;
    configuredManagerWeight: Prisma.Decimal;
    effectiveSelfWeight: Prisma.Decimal;
    effectiveManagerWeight: Prisma.Decimal;
    configuredCompetencyResultWeight?: Prisma.Decimal | null;
    configuredGoalsResultWeight?: Prisma.Decimal | null;
    composition?: PerformanceResultComposition;
    sourceGoalCycleId?: string | null;
    status: PerformanceResultStatus;
    calculatedAt: Date;
    releasedAt: Date | null;
    releasedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      area?: { id: string; name: string };
      position?: { id: string; name: string };
    };
    cycle: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
    participant: { id: string; status: string };
    releasedBy?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    goalSnapshots?: Array<{
      id: string;
      sourceGoalId: string | null;
      sourceGoalResultId: string | null;
      goalTitle: string;
      goalType: string;
      achievementPercentage: Prisma.Decimal;
      configuredWeight: Prisma.Decimal | null;
      effectiveWeight: Prisma.Decimal;
      contribution: Prisma.Decimal;
      order: number;
    }>;
  }) {
    return {
      id: result.id,
      companyId: result.companyId,
      cycleId: result.cycleId,
      participantId: result.participantId,
      employeeId: result.employeeId,
      selfScore: decimalToString(result.selfScore),
      managerScore: decimalToString(result.managerScore),
      competencyScore: decimalToString(result.competencyScore ?? null),
      goalsAchievement: decimalToString(result.goalsAchievement ?? null),
      overallScore: decimalToString(result.overallScore)!,
      configuredSelfWeight: decimalToString(result.configuredSelfWeight),
      configuredManagerWeight: decimalToString(result.configuredManagerWeight),
      effectiveSelfWeight: decimalToString(result.effectiveSelfWeight),
      effectiveManagerWeight: decimalToString(result.effectiveManagerWeight),
      configuredCompetencyResultWeight: decimalToString(
        result.configuredCompetencyResultWeight ?? null,
      ),
      configuredGoalsResultWeight: decimalToString(
        result.configuredGoalsResultWeight ?? null,
      ),
      composition:
        result.composition ?? PerformanceResultComposition.COMPETENCY_ONLY,
      sourceGoalCycleId: result.sourceGoalCycleId ?? null,
      status: result.status,
      calculatedAt: result.calculatedAt,
      releasedAt: result.releasedAt,
      releasedByUserId: result.releasedByUserId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      employee: result.employee,
      participant: result.participant,
      releasedBy: result.releasedBy ?? null,
      goals: this.serializeGoalSnapshots(result.goalSnapshots),
      cycle: {
        ...result.cycle,
        startDate: result.cycle.startDate.toISOString().slice(0, 10),
        endDate: result.cycle.endDate.toISOString().slice(0, 10),
      },
      view: 'admin' as const,
    };
  }

  private serializeEmployeeListItem(result: {
    id: string;
    overallScore: Prisma.Decimal;
    selfScore: Prisma.Decimal | null;
    competencyScore?: Prisma.Decimal | null;
    goalsAchievement?: Prisma.Decimal | null;
    composition?: PerformanceResultComposition;
    configuredCompetencyResultWeight?: Prisma.Decimal | null;
    configuredGoalsResultWeight?: Prisma.Decimal | null;
    status: PerformanceResultStatus;
    releasedAt: Date | null;
    calculatedAt: Date;
    cycle: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
    goalSnapshots?: Array<{
      id: string;
      sourceGoalId: string | null;
      sourceGoalResultId: string | null;
      goalTitle: string;
      goalType: string;
      achievementPercentage: Prisma.Decimal;
      configuredWeight: Prisma.Decimal | null;
      effectiveWeight: Prisma.Decimal;
      contribution: Prisma.Decimal;
      order: number;
    }>;
  }) {
    return {
      id: result.id,
      overallScore: decimalToString(result.overallScore),
      selfScore: decimalToString(result.selfScore),
      competencyScore: decimalToString(result.competencyScore ?? null),
      goalsAchievement: decimalToString(result.goalsAchievement ?? null),
      composition:
        result.composition ?? PerformanceResultComposition.COMPETENCY_ONLY,
      configuredCompetencyResultWeight: decimalToString(
        result.configuredCompetencyResultWeight ?? null,
      ),
      configuredGoalsResultWeight: decimalToString(
        result.configuredGoalsResultWeight ?? null,
      ),
      goals: this.serializeGoalSnapshots(result.goalSnapshots),
      status: result.status,
      releasedAt: result.releasedAt,
      calculatedAt: result.calculatedAt,
      cycle: {
        ...result.cycle,
        startDate: result.cycle.startDate.toISOString().slice(0, 10),
        endDate: result.cycle.endDate.toISOString().slice(0, 10),
      },
    };
  }

  private serializeEmployeeDetail(result: {
    id: string;
    overallScore: Prisma.Decimal;
    selfScore: Prisma.Decimal | null;
    managerScore: Prisma.Decimal | null;
    competencyScore?: Prisma.Decimal | null;
    goalsAchievement?: Prisma.Decimal | null;
    configuredSelfWeight: Prisma.Decimal;
    configuredManagerWeight: Prisma.Decimal;
    effectiveSelfWeight: Prisma.Decimal;
    effectiveManagerWeight: Prisma.Decimal;
    configuredCompetencyResultWeight?: Prisma.Decimal | null;
    configuredGoalsResultWeight?: Prisma.Decimal | null;
    composition?: PerformanceResultComposition;
    status: PerformanceResultStatus;
    releasedAt: Date | null;
    calculatedAt: Date;
    cycle: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
    goalSnapshots?: Array<{
      id: string;
      sourceGoalId: string | null;
      sourceGoalResultId: string | null;
      goalTitle: string;
      goalType: string;
      achievementPercentage: Prisma.Decimal;
      configuredWeight: Prisma.Decimal | null;
      effectiveWeight: Prisma.Decimal;
      contribution: Prisma.Decimal;
      order: number;
    }>;
  }) {
    const managerIncluded =
      Number(result.effectiveManagerWeight.toString()) > 0;
    return {
      id: result.id,
      overallScore: decimalToString(result.overallScore),
      selfScore: decimalToString(result.selfScore),
      competencyScore: decimalToString(result.competencyScore ?? null),
      goalsAchievement: decimalToString(result.goalsAchievement ?? null),
      composition:
        result.composition ?? PerformanceResultComposition.COMPETENCY_ONLY,
      configuredCompetencyResultWeight: decimalToString(
        result.configuredCompetencyResultWeight ?? null,
      ),
      configuredGoalsResultWeight: decimalToString(
        result.configuredGoalsResultWeight ?? null,
      ),
      goals: this.serializeGoalSnapshots(result.goalSnapshots).map((g) => ({
        goalTitle: g.goalTitle,
        goalType: g.goalType,
        achievementPercentage: g.achievementPercentage,
        effectiveWeight: g.effectiveWeight,
        contribution: g.contribution,
        order: g.order,
      })),
      // Privacy: never expose managerScore to employee in 08D.
      managerIncluded,
      effectiveSelfWeight: decimalToString(result.effectiveSelfWeight),
      effectiveManagerWeight: decimalToString(result.effectiveManagerWeight),
      status: result.status,
      releasedAt: result.releasedAt,
      calculatedAt: result.calculatedAt,
      cycle: {
        ...result.cycle,
        startDate: result.cycle.startDate.toISOString().slice(0, 10),
        endDate: result.cycle.endDate.toISOString().slice(0, 10),
      },
      view: 'employee' as const,
    };
  }
}
