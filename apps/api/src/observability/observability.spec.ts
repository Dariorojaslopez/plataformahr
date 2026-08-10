import { isValidRequestId, resolveRequestId } from './request-id';
import { normalizeHttpRoute } from './metrics.service';
import { redactSensitive } from './structured-logger';

describe('request-id', () => {
  it('accepts valid ids', () => {
    expect(isValidRequestId('abcd1234-valid')).toBe(true);
    expect(isValidRequestId('a'.repeat(8))).toBe(true);
  });

  it('rejects invalid ids', () => {
    expect(isValidRequestId('short')).toBe(false);
    expect(isValidRequestId('has space!!')).toBe(false);
    expect(isValidRequestId('a'.repeat(200))).toBe(false);
    expect(isValidRequestId('bad\nid')).toBe(false);
  });

  it('preserves valid incoming and replaces invalid', () => {
    expect(resolveRequestId('client-request-001')).toBe('client-request-001');
    const generated = resolveRequestId('nope');
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('normalizeHttpRoute', () => {
  it('prefers route templates', () => {
    expect(normalizeHttpRoute('/:id', '/employees/123', '/employees')).toBe(
      '/employees/:id',
    );
  });

  it('collapses uuid and numeric ids in pathname fallback', () => {
    expect(
      normalizeHttpRoute(
        undefined,
        '/employees/11111111-1111-4111-8111-111111111111',
      ),
    ).toBe('/employees/:id');
    expect(normalizeHttpRoute(undefined, '/offers/42/accept')).toBe(
      '/offers/:id/accept',
    );
  });
});

describe('redactSensitive', () => {
  it('redacts auth headers and tokens', () => {
    const out = redactSensitive({
      Authorization: 'Bearer secret',
      cookie: 'tsc_refresh=abc',
      nested: { password: 'x', ok: 1 },
    }) as Record<string, unknown>;
    expect(out.Authorization).toBe('[Redacted]');
    expect(out.cookie).toBe('[Redacted]');
    expect((out.nested as Record<string, unknown>).password).toBe('[Redacted]');
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});

describe('writeStructuredLog safety', () => {
  const prevFormat = process.env.LOG_FORMAT;

  afterEach(() => {
    if (prevFormat === undefined) {
      delete process.env.LOG_FORMAT;
    } else {
      process.env.LOG_FORMAT = prevFormat;
    }
  });

  it('does not throw when JSON serialization fails on circular refs', () => {
    process.env.LOG_FORMAT = 'json';
    // Re-require not needed: useJsonFormat reads env per call.
    const { writeStructuredLog } = require('./structured-logger') as {
      writeStructuredLog: (fields: Record<string, unknown>) => void;
    };
    const circular: Record<string, unknown> = { level: 'info', message: 'circ' };
    circular.self = circular;
    expect(() => writeStructuredLog(circular as never)).not.toThrow();
  });
});
