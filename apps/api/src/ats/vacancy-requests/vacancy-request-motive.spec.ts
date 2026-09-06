import { VacancyRequestMotive, VacancyRequestType } from '@prisma/client';
import {
  defaultMotiveFromType,
  isReplacementMotive,
  minExpectedHiringDate,
  parseDateOnlyUtc,
  typeFromMotive,
  toDateOnlyIso,
} from './vacancy-request-motive';

describe('vacancy-request-motive helpers', () => {
  it('maps motive to type and back', () => {
    expect(typeFromMotive(VacancyRequestMotive.NEW_POSITION)).toBe(
      VacancyRequestType.NEW_POSITION,
    );
    expect(typeFromMotive(VacancyRequestMotive.REPLACEMENT_RESIGNATION)).toBe(
      VacancyRequestType.EXISTING_POSITION,
    );
    expect(defaultMotiveFromType(VacancyRequestType.NEW_POSITION)).toBe(
      VacancyRequestMotive.NEW_POSITION,
    );
    expect(defaultMotiveFromType(VacancyRequestType.EXISTING_POSITION)).toBe(
      VacancyRequestMotive.REPLACEMENT_RESIGNATION,
    );
  });

  it('detects replacement motives', () => {
    expect(
      isReplacementMotive(VacancyRequestMotive.REPLACEMENT_RESIGNATION),
    ).toBe(true);
    expect(isReplacementMotive(VacancyRequestMotive.NEW_POSITION)).toBe(false);
  });

  it('parses date-only and computes SLA min date', () => {
    expect(parseDateOnlyUtc('2099-06-15')?.toISOString()).toBe(
      '2099-06-15T00:00:00.000Z',
    );
    expect(parseDateOnlyUtc('not-a-date')).toBeNull();
    const min = minExpectedHiringDate(14, new Date('2026-09-05T15:00:00Z'));
    expect(toDateOnlyIso(min)).toBe('2026-09-19');
  });
});
