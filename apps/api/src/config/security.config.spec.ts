import { validateSecurityEnv } from './security.config';

describe('validateSecurityEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    CORS_ORIGINS: 'https://app.example.com',
    JWT_REFRESH_TTL: '7d',
  };

  it('accepts strong distinct secrets and CORS in production', () => {
    const cfg = validateSecurityEnv({
      ...base,
      NODE_ENV: 'production',
    });
    expect(cfg.corsOrigins).toEqual(['https://app.example.com']);
    expect(cfg.refreshCookie.httpOnly).toBe(true);
    expect(cfg.refreshCookie.secure).toBe(true);
    expect(cfg.refreshCookie.path).toBe('/auth');
  });

  it('rejects equal access/refresh secrets', () => {
    expect(() =>
      validateSecurityEnv({
        ...base,
        JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/must differ/);
  });

  it('rejects weak secrets in production', () => {
    expect(() =>
      validateSecurityEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'secret',
        JWT_REFRESH_SECRET: 'changeme-but-long-enough-xxxxxxxx',
      }),
    ).toThrow(/too weak/);
  });

  it('rejects empty CORS in production', () => {
    expect(() =>
      validateSecurityEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: '',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      validateSecurityEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/wildcard/);
  });

  it('defaults localhost CORS in development', () => {
    const cfg = validateSecurityEnv({
      ...base,
      NODE_ENV: 'development',
      CORS_ORIGINS: '',
    });
    expect(cfg.corsOrigins).toContain('http://localhost:3000');
  });
});
