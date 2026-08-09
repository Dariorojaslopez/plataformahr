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
  parseDateOnly,
  sumWeights,
} from './performance.helpers';

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
});
