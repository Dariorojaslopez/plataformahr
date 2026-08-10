export const APP_NAME = 'talento-sin-clave' as const;

export type HealthStatus = {
  status: 'ok';
};

export type ReadyStatus = {
  status: 'ready' | 'not_ready';
};

export function createHealthResponse(): HealthStatus {
  return { status: 'ok' };
}

export function createReadyResponse(ready: boolean): ReadyStatus {
  return { status: ready ? 'ready' : 'not_ready' };
}
