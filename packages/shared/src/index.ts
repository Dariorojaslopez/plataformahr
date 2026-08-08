export const APP_NAME = 'talento-sin-clave' as const;

export type HealthStatus = {
  status: 'ok';
};

export function createHealthResponse(): HealthStatus {
  return { status: 'ok' };
}
