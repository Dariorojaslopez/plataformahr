import { validateSecurityEnv } from './security.config';

describe('validateSecurityEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    CORS_ORIGINS: 'https://app.example.com',
    JWT_REFRESH_TTL: '7d',
    COMPANY_UPLOADS_DIR: '/data/company-uploads',
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
    expect(cfg.refreshCookie.sameSite).toBe('none');
  });

  it('defaults cookie path to /auth when COOKIE_PATH is unset', () => {
    const cfg = validateSecurityEnv({
      ...base,
      NODE_ENV: 'development',
    });
    expect(cfg.refreshCookie.path).toBe('/auth');
  });

  it('uses COOKIE_PATH=/api/auth for same-origin reverse proxy', () => {
    const cfg = validateSecurityEnv({
      ...base,
      NODE_ENV: 'production',
      COOKIE_SAMESITE: 'lax',
      COOKIE_SECURE: 'true',
      COOKIE_PATH: '/api/auth',
    });
    expect(cfg.refreshCookie.path).toBe('/api/auth');
    expect(cfg.refreshCookie.httpOnly).toBe(true);
    expect(cfg.refreshCookie.secure).toBe(true);
    expect(cfg.refreshCookie.sameSite).toBe('lax');
  });

  it('trims a trailing slash on COOKIE_PATH', () => {
    const cfg = validateSecurityEnv({
      ...base,
      COOKIE_PATH: '/api/auth/',
    });
    expect(cfg.refreshCookie.path).toBe('/api/auth');
  });

  it('rejects overly broad or invalid COOKIE_PATH values', () => {
    expect(() => validateSecurityEnv({ ...base, COOKIE_PATH: '/' })).toThrow(
      /must not be \//,
    );
    expect(() => validateSecurityEnv({ ...base, COOKIE_PATH: 'auth' })).toThrow(
      /must start with \//,
    );
    expect(() =>
      validateSecurityEnv({ ...base, COOKIE_PATH: '/api/auth/../x' }),
    ).toThrow(/not a valid URL path/);
    expect(() =>
      validateSecurityEnv({ ...base, COOKIE_PATH: '/auth?x=1' }),
    ).toThrow(/not a valid URL path/);
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

  it('requires COMPANY_UPLOADS_DIR in production', () => {
    expect(() =>
      validateSecurityEnv({
        ...base,
        NODE_ENV: 'production',
        COMPANY_UPLOADS_DIR: '',
      }),
    ).toThrow(/COMPANY_UPLOADS_DIR/);
  });
});
