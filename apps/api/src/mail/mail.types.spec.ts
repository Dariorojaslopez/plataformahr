import { resolveMailSmtpConfig } from './mail.types';

describe('resolveMailSmtpConfig', () => {
  it('returns null when host or from is missing', () => {
    expect(resolveMailSmtpConfig({})).toBeNull();
    expect(resolveMailSmtpConfig({ SMTP_HOST: 'smtp.example.com' })).toBeNull();
    expect(resolveMailSmtpConfig({ MAIL_FROM: 'hr@example.com' })).toBeNull();
  });

  it('resolves defaults for port and secure', () => {
    expect(
      resolveMailSmtpConfig({
        SMTP_HOST: 'smtp.example.com',
        MAIL_FROM: 'hr@example.com',
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
      }),
    ).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'user',
      pass: 'pass',
      from: 'hr@example.com',
    });
  });

  it('treats port 465 as secure', () => {
    const cfg = resolveMailSmtpConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_FROM: 'noreply@example.com',
      SMTP_PORT: '465',
    });
    expect(cfg?.secure).toBe(true);
    expect(cfg?.from).toBe('noreply@example.com');
  });
});
