import {
  VacancyRequestMotive,
  VacancyRequestType,
} from '@prisma/client';

export const REPLACEMENT_MOTIVES: ReadonlySet<VacancyRequestMotive> = new Set([
  VacancyRequestMotive.REPLACEMENT_RESIGNATION,
  VacancyRequestMotive.REPLACEMENT_MUTUAL_AGREEMENT,
  VacancyRequestMotive.REPLACEMENT_TERMINATION_WITHOUT_CAUSE,
]);

export function isReplacementMotive(
  motive: VacancyRequestMotive,
): boolean {
  return REPLACEMENT_MOTIVES.has(motive);
}

export function typeFromMotive(motive: VacancyRequestMotive): VacancyRequestType {
  return motive === VacancyRequestMotive.NEW_POSITION
    ? VacancyRequestType.NEW_POSITION
    : VacancyRequestType.EXISTING_POSITION;
}

export function defaultMotiveFromType(
  type: VacancyRequestType,
): VacancyRequestMotive {
  return type === VacancyRequestType.NEW_POSITION
    ? VacancyRequestMotive.NEW_POSITION
    : VacancyRequestMotive.REPLACEMENT_RESIGNATION;
}

/** UTC calendar date at midnight for YYYY-MM-DD (or Date ISO date part). */
export function parseDateOnlyUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function minExpectedHiringDate(
  slaDays: number,
  now: Date = new Date(),
): Date {
  const days = Number.isFinite(slaDays) && slaDays >= 0 ? Math.floor(slaDays) : 0;
  return addUtcDays(startOfUtcDay(now), days);
}

export function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
