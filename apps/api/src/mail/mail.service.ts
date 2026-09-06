import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  resolveMailSmtpConfig,
  type MailSmtpConfig,
  type SendMailInput,
  type SendMailResult,
} from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private config: MailSmtpConfig | null = null;

  constructor() {
    this.config = resolveMailSmtpConfig();
    if (this.config) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth:
          this.config.user && this.config.pass
            ? { user: this.config.user, pass: this.config.pass }
            : undefined,
      });
      this.logger.log(
        `SMTP ready (${this.config.host}:${this.config.port}, from=${this.config.from})`,
      );
    } else {
      this.logger.warn(
        'SMTP not configured (set SMTP_HOST + MAIL_FROM). Outbound mail will be skipped.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config && this.transporter);
  }

  async sendText(input: SendMailInput): Promise<SendMailResult> {
    const to = input.to.trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return {
        status: 'FAILED',
        reason: 'INVALID_RECIPIENT',
        error: 'Invalid recipient email',
      };
    }

    if (!this.config || !this.transporter) {
      this.logger.log(
        `Mail skipped (no SMTP): to=${to} subject=${input.subject.slice(0, 80)}`,
      );
      return { status: 'SKIPPED', reason: 'SMTP_NOT_CONFIGURED' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
      });
      return {
        status: 'SENT',
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(`Mail failed to=${to}: ${message}`);
      return {
        status: 'FAILED',
        reason: 'SMTP_ERROR',
        error: message.slice(0, 500),
      };
    }
  }
}
