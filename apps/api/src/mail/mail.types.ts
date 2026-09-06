export type MailDeliveryStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type SendMailResult = {
  status: MailDeliveryStatus;
  messageId?: string;
  reason?: string;
  error?: string;
};

export type MailSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export function resolveMailSmtpConfig(
  env: NodeJS.ProcessEnv = process.env,
): MailSmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.MAIL_FROM?.trim() || env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(env.SMTP_PORT ?? '587');
  if (!Number.isFinite(port) || port <= 0) return null;

  const secure =
    env.SMTP_SECURE === 'true' || env.SMTP_SECURE === '1' || port === 465;

  return {
    host,
    port,
    secure,
    user: env.SMTP_USER?.trim() || undefined,
    pass: env.SMTP_PASS?.trim() || undefined,
    from,
  };
}
