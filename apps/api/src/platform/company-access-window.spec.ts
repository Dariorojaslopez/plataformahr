import {
  isCompanyAccessWindowOpen,
  parseAccessDateInput,
} from './company-access-window';

describe('company access window', () => {
  it('parses start and end of day in UTC', () => {
    expect(parseAccessDateInput('2026-10-01', 'start')?.toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(parseAccessDateInput('2026-10-01', 'end')?.toISOString()).toBe(
      '2026-10-01T23:59:59.999Z',
    );
    expect(parseAccessDateInput('', 'end')).toBeNull();
  });

  it('allows open-ended access when end is null', () => {
    const start = parseAccessDateInput('2026-09-01', 'start');
    expect(
      isCompanyAccessWindowOpen(
        { accessStartsAt: start, accessEndsAt: null },
        new Date('2026-12-01T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('blocks before start and after inclusive end day', () => {
    const start = parseAccessDateInput('2026-09-01', 'start');
    const end = parseAccessDateInput('2026-09-30', 'end');
    expect(
      isCompanyAccessWindowOpen(
        { accessStartsAt: start, accessEndsAt: end },
        new Date('2026-08-31T23:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      isCompanyAccessWindowOpen(
        { accessStartsAt: start, accessEndsAt: end },
        new Date('2026-09-30T20:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isCompanyAccessWindowOpen(
        { accessStartsAt: start, accessEndsAt: end },
        new Date('2026-10-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
