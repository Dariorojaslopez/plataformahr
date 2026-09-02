import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PerformanceCycleStatus } from '@prisma/client';
import {
  canTransitionCycle,
  isCycleStructurallyEditable,
} from './cycle-transitions';
import {
  assertActivationWeights,
  assertCycleDates,
  assertEvaluatorWeights,
  parseDateOnly,
  resolveGoalsCompositionConfig,
  sumWeights,
} from './performance.helpers';
import { PerformanceEvaluationModel } from '@prisma/client';

describe('performance helpers', () => {
  describe('assertCycleDates', () => {
    it('accepts valid period and evaluation window', () => {
      expect(() =>
        assertCycleDates({
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          evaluationStartDate: new Date('2026-11-01T00:00:00.000Z'),
          evaluationEndDate: new Date('2026-12-15T00:00:00.000Z'),
        }),
      ).not.toThrow();
    });

    it('rejects start after end', () => {
      expect(() =>
        assertCycleDates({
          startDate: new Date('2026-12-31T00:00:00.000Z'),
          endDate: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects evaluation outside period', () => {
      expect(() =>
        assertCycleDates({
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-06-30T00:00:00.000Z'),
          evaluationStartDate: new Date('2026-01-01T00:00:00.000Z'),
          evaluationEndDate: new Date('2026-12-31T00:00:00.000Z'),
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects incomplete extra windows and follow-ups outside the cycle', () => {
      expect(() =>
        assertCycleDates({
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          calibrationStartDate: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        assertCycleDates({
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-06-30T00:00:00.000Z'),
          followUps: [
            {
              startDate: new Date('2026-03-01T00:00:00.000Z'),
              endDate: new Date('2026-08-01T00:00:00.000Z'),
            },
          ],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertActivationWeights', () => {
    it('allows all-null weights', () => {
      expect(() => assertActivationWeights([null, null])).not.toThrow();
    });

    it('requires sum 100 when any weight is set', () => {
      expect(() =>
        assertActivationWeights([
          new Prisma.Decimal(25),
          new Prisma.Decimal(25),
          new Prisma.Decimal(25),
          new Prisma.Decimal(25),
        ]),
      ).not.toThrow();

      expect(() =>
        assertActivationWeights([
          new Prisma.Decimal(50),
          new Prisma.Decimal(40),
        ]),
      ).toThrow(BadRequestException);

      expect(() =>
        assertActivationWeights([new Prisma.Decimal(100), null]),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertEvaluatorWeights', () => {
    it('accepts 90° self+manager and 180° with peers', () => {
      expect(() =>
        assertEvaluatorWeights({
          selfEvaluationWeight: 30,
          managerEvaluationWeight: 70,
        }),
      ).not.toThrow();

      expect(() =>
        assertEvaluatorWeights({
          evaluationModel: PerformanceEvaluationModel.DEGREE_180,
          selfEvaluationWeight: 20,
          managerEvaluationWeight: 50,
          peerEvaluationWeight: 30,
        }),
      ).not.toThrow();

      expect(() =>
        assertEvaluatorWeights({
          evaluationModel: PerformanceEvaluationModel.DEGREE_180,
          selfEvaluationWeight: 30,
          managerEvaluationWeight: 70,
          peerEvaluationWeight: 10,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('sumWeights', () => {
    it('returns null when unweighted', () => {
      expect(sumWeights([null, null])).toBeNull();
    });

    it('sums present weights', () => {
      expect(sumWeights([25, 25, 50])).toBe(100);
    });
  });

  describe('parseDateOnly', () => {
    it('parses YYYY-MM-DD', () => {
      expect(parseDateOnly('2026-01-15', 'startDate').toISOString()).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });
  });

  describe('cycle transitions', () => {
    it('allows DRAFT → ACTIVE and rejects ACTIVE → DRAFT', () => {
      expect(
        canTransitionCycle(
          PerformanceCycleStatus.DRAFT,
          PerformanceCycleStatus.ACTIVE,
        ),
      ).toBe(true);
      expect(
        canTransitionCycle(
          PerformanceCycleStatus.ACTIVE,
          PerformanceCycleStatus.DRAFT,
        ),
      ).toBe(false);
      expect(isCycleStructurallyEditable(PerformanceCycleStatus.DRAFT)).toBe(
        true,
      );
      expect(isCycleStructurallyEditable(PerformanceCycleStatus.ACTIVE)).toBe(
        false,
      );
    });
  });

  describe('resolveGoalsCompositionConfig', () => {
    const goalCycleId = '11111111-1111-4111-8111-111111111111';

    it('uses legacy goalsResultWeight when split weights are null', () => {
      const config = resolveGoalsCompositionConfig({
        goalCycleId,
        competencyResultWeight: 70,
        goalsResultWeight: 30,
        organizationalGoalsWeight: null,
        individualGoalsWeight: null,
      });
      expect(config.goalCycleId).toBe(goalCycleId);
      expect(config.competencyResultWeight?.toString()).toBe('70');
      expect(config.goalsResultWeight?.toString()).toBe('30');
      expect(config.individualGoalsWeight?.toString()).toBe('30');
    });

    it('rejects goalCycleId when goals weight is 0', () => {
      expect(() =>
        resolveGoalsCompositionConfig({
          goalCycleId,
          competencyResultWeight: 100,
          goalsResultWeight: 0,
        }),
      ).toThrow(BadRequestException);
    });

    it('allows missing goalCycleId when goal weights are set', () => {
      const config = resolveGoalsCompositionConfig({
        competencyResultWeight: 50,
        organizationalGoalsWeight: 24.99,
        individualGoalsWeight: 25,
      });
      expect(config.goalCycleId).toBeNull();
      expect(config.goalsResultWeight?.toString()).toBe('49.99');
    });
  });
});
