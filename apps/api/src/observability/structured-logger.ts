export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type StructuredLogFields = {
  level: LogLevel;
  message: string;
  service?: string;
  environment?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  errorName?: string;
  context?: string;
  [key: string]: unknown;
};

const REDACT_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordhash',
  'refreshtoken',
  'accesstoken',
  'token',
  'jwt',
  'secret',
]);

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

function useJsonFormat(): boolean {
  const fmt = (process.env.LOG_FORMAT ?? '').trim().toLowerCase();
  if (fmt === 'json') return true;
  if (fmt === 'pretty') return false;
  return process.env.NODE_ENV === 'production';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

/** Deep-ish redact for accidental sensitive keys in context objects. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]';
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = '[Redacted]';
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function writeStructuredLog(fields: StructuredLogFields): void {
  if (!shouldLog(fields.level)) return;

  try {
    const payload = redactSensitive({
      timestamp: new Date().toISOString(),
      service: fields.service ?? 'api',
      environment: fields.environment ?? process.env.NODE_ENV ?? 'development',
      ...fields,
    }) as Record<string, unknown>;

    const line = useJsonFormat()
      ? JSON.stringify(payload)
      : `[${String(payload.level).toUpperCase()}] ${String(payload.message)}${
          typeof payload.requestId === 'string'
            ? ` requestId=${payload.requestId}`
            : ''
        }`;

    if (fields.level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  } catch {
    // Never let logging/serialization failures take down the process.
    try {
      process.stderr.write(
        '{"level":"error","message":"structured_log_failed","service":"api"}\n',
      );
    } catch {
      // ignore
    }
  }
}

export function getSlowRequestMs(): number {
  const raw = Number(process.env.SLOW_REQUEST_MS ?? '1000');
  return Number.isFinite(raw) && raw > 0 ? raw : 1000;
}

export function isMetricsEnabled(): boolean {
  const raw = (process.env.METRICS_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0';
}
