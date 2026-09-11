export const SESSION_IDLE_MS = 3 * 60 * 60 * 1000;

export function isSessionIdle(
  session: { lastUsedAt: Date | null; createdAt: Date },
  now = Date.now(),
  idleTtlMs: number = SESSION_IDLE_MS,
): boolean {
  const lastActivity = session.lastUsedAt ?? session.createdAt;
  return now - lastActivity.getTime() >= idleTtlMs;
}
