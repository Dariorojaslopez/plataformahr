export const DEFAULT_VACANCY_HIRING_SLA_DAYS = 14;

export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function minExpectedHiringDate(
  slaDays: number,
  now: Date = new Date(),
): Date {
  const days =
    Number.isFinite(slaDays) && slaDays >= 0 ? Math.floor(slaDays) : 0;
  return addLocalDays(startOfLocalDay(now), days);
}

export function toDateOnlyIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
