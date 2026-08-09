import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
  PerformanceResultStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  averageScores,
  buildEvaluationTypeMetrics,
  buildOrgBreakdown,
  buildParticipantMetrics,
  buildScoreDistribution,
  minMaxScores,
  releaseRate,
} from '../analytics-metrics';
import { decimalToString } from '../performance.helpers';

const EMPTY_AREA = 'Sin área';
const EMPTY_POSITION = 'Sin cargo';
const EMPTY_BU = 'Sin unidad de negocio';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCycleAnalytics(companyId: string, cycleId: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        selfEvaluationWeight: true,
        managerEvaluationWeight: true,
      },
    });
    if (!cycle) {
      throw new NotFoundException('Performance cycle not found');
    }

    const [
      participantGroups,
      evaluationGroups,
      resultStatusGroups,
      resultScores,
    ] = await Promise.all([
      this.prisma.performanceCycleParticipant.groupBy({
        by: ['status'],
        where: { companyId, cycleId },
        _count: { _all: true },
      }),
      this.prisma.performanceEvaluation.groupBy({
        by: ['type', 'status'],
        where: { companyId, cycleId },
        _count: { _all: true },
      }),
      this.prisma.performanceResult.groupBy({
        by: ['status'],
        where: { companyId, cycleId },
        _count: { _all: true },
      }),
      this.prisma.performanceResult.findMany({
        where: {
          companyId,
          cycleId,
          status: {
            in: [
              PerformanceResultStatus.CALCULATED,
              PerformanceResultStatus.RELEASED,
            ],
          },
        },
        select: {
          overallScore: true,
          areaIdSnapshot: true,
          areaNameSnapshot: true,
          positionIdSnapshot: true,
          positionNameSnapshot: true,
          businessUnitIdSnapshot: true,
          businessUnitNameSnapshot: true,
        },
      }),
    ]);

    const participantCounts = {
      ACTIVE: 0,
      COMPLETED: 0,
      EXCLUDED: 0,
    } satisfies Record<PerformanceParticipantStatus, number>;
    for (const row of participantGroups) {
      participantCounts[row.status] = row._count._all;
    }
    const participants = buildParticipantMetrics(participantCounts);

    const countEval = (
      type: PerformanceEvaluationType,
      status: PerformanceEvaluationStatus,
    ) =>
      evaluationGroups.find((g) => g.type === type && g.status === status)
        ?._count._all ?? 0;

    const self = buildEvaluationTypeMetrics({
      pending: countEval(
        PerformanceEvaluationType.SELF,
        PerformanceEvaluationStatus.PENDING,
      ),
      inProgress: countEval(
        PerformanceEvaluationType.SELF,
        PerformanceEvaluationStatus.IN_PROGRESS,
      ),
      submitted: countEval(
        PerformanceEvaluationType.SELF,
        PerformanceEvaluationStatus.SUBMITTED,
      ),
    });
    const manager = buildEvaluationTypeMetrics({
      pending: countEval(
        PerformanceEvaluationType.MANAGER,
        PerformanceEvaluationStatus.PENDING,
      ),
      inProgress: countEval(
        PerformanceEvaluationType.MANAGER,
        PerformanceEvaluationStatus.IN_PROGRESS,
      ),
      submitted: countEval(
        PerformanceEvaluationType.MANAGER,
        PerformanceEvaluationStatus.SUBMITTED,
      ),
    });

    let calculatedResults = 0;
    let releasedResults = 0;
    for (const row of resultStatusGroups) {
      if (row.status === PerformanceResultStatus.CALCULATED) {
        calculatedResults = row._count._all;
      }
      if (row.status === PerformanceResultStatus.RELEASED) {
        releasedResults = row._count._all;
      }
    }
    const totalResults = calculatedResults + releasedResults;

    const scores = resultScores.map((r) => Number(r.overallScore.toString()));
    const { minScore, maxScore } = minMaxScores(scores);

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        startDate: cycle.startDate.toISOString().slice(0, 10),
        endDate: cycle.endDate.toISOString().slice(0, 10),
        selfEvaluationWeight: decimalToString(cycle.selfEvaluationWeight),
        managerEvaluationWeight: decimalToString(cycle.managerEvaluationWeight),
      },
      participants,
      evaluations: { self, manager },
      results: {
        calculatedResults,
        releasedResults,
        totalResults,
        releasedRate: releaseRate(releasedResults, totalResults),
        averageScore: averageScores(scores),
        minScore,
        maxScore,
        /** Admin analytics include CALCULATED + RELEASED consolidated results. */
        scorePopulation: 'CALCULATED_AND_RELEASED' as const,
      },
      distribution: buildScoreDistribution(scores),
      byArea: buildOrgBreakdown(
        resultScores.map((r) => ({
          id: r.areaIdSnapshot,
          name: r.areaNameSnapshot,
          score: Number(r.overallScore.toString()),
        })),
        EMPTY_AREA,
      ),
      byPosition: buildOrgBreakdown(
        resultScores.map((r) => ({
          id: r.positionIdSnapshot,
          name: r.positionNameSnapshot,
          score: Number(r.overallScore.toString()),
        })),
        EMPTY_POSITION,
      ),
      byBusinessUnit: buildOrgBreakdown(
        resultScores.map((r) => ({
          id: r.businessUnitIdSnapshot,
          name: r.businessUnitNameSnapshot,
          score: Number(r.overallScore.toString()),
        })),
        EMPTY_BU,
      ),
    };
  }
}
