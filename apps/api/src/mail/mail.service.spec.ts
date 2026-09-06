import { MailService } from './mail.service';

describe('MailService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('skips send when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    delete process.env.SMTP_FROM;
    const mail = new MailService();
    expect(mail.isConfigured()).toBe(false);
    const result = await mail.sendText({
      to: 'candidate@example.com',
      subject: 'Gracias',
      text: 'Hola',
    });
    expect(result).toEqual({
      status: 'SKIPPED',
      reason: 'SMTP_NOT_CONFIGURED',
    });
  });

  it('rejects invalid recipients', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    const mail = new MailService();
    const result = await mail.sendText({
      to: 'not-an-email',
      subject: 'x',
      text: 'y',
    });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toBe('INVALID_RECIPIENT');
  });
});
