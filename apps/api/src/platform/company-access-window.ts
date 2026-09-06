export type CompanyAccessWindow = {
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
};

/** Parse YYYY-MM-DD into UTC start (00:00) or end (23:59:59.999) of that day. */
export function parseAccessDateInput(
  value: string | null | undefined,
  bound: 'start' | 'end',
): Date | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw new Error('Invalid access date');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (bound === 'end') {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function isCompanyAccessWindowOpen(
  company: CompanyAccessWindow,
  now: Date = new Date(),
): boolean {
  if (company.accessStartsAt && now < company.accessStartsAt) {
    return false;
  }
  if (company.accessEndsAt && now > company.accessEndsAt) {
    return false;
  }
  return true;
}

export function toAccessDateInput(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
