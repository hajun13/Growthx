import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * 이메일 발송 (C-2).
 * SMTP_* env 가 설정되면 nodemailer 로 실제 발송.
 * 미설정 시 개발모드 = 콘솔 로그 폴백(시크릿은 .env 에 키만, 안전).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  readonly enabled: boolean;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.enabled = Boolean(host && port);
    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  /** 이메일 발송. 미설정/실패 시 콘솔 폴백 → 항상 안전하게 반환. */
  async send(to: string, subject: string, text: string): Promise<{ sent: boolean; mode: string }> {
    if (!this.enabled || !this.transporter) {
      this.logger.log(`[MAIL:dev-fallback] to=${to} subject="${subject}" body="${text}"`);
      return { sent: false, mode: 'console' };
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@energyx.co.kr',
        to,
        subject,
        text,
      });
      return { sent: true, mode: 'smtp' };
    } catch (err) {
      this.logger.warn(`mail send failed to ${to}: ${(err as Error).message}`);
      return { sent: false, mode: 'error' };
    }
  }
}
