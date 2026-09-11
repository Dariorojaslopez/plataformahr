import { SESSION_IDLE_MS, isSessionIdle } from './session-idle';

describe('isSessionIdle', () => {
  const createdAt = new Date('2026-09-10T12:00:00.000Z');
  const now = createdAt.getTime() + SESSION_IDLE_MS + 1;

  it('is idle when lastUsedAt is older than three hours', () => {
    expect(
      isSessionIdle(
        {
          createdAt,
          lastUsedAt: new Date(now - SESSION_IDLE_MS - 1),
        },
        now,
      ),
    ).toBe(true);
  });

  it('is not idle inside the three-hour window', () => {
    expect(
      isSessionIdle(
        {
          createdAt,
          lastUsedAt: new Date(now - SESSION_IDLE_MS + 1_000),
        },
        now,
      ),
    ).toBe(false);
  });

  it('falls back to createdAt when lastUsedAt is missing', () => {
    expect(isSessionIdle({ createdAt, lastUsedAt: null }, now)).toBe(true);
    expect(
      isSessionIdle(
        { createdAt, lastUsedAt: null },
        createdAt.getTime() + SESSION_IDLE_MS - 1,
      ),
    ).toBe(false);
  });
});
