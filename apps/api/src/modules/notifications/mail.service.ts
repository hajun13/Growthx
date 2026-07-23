import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * 이메일 발송 (C-2).
 * SMTP_* env 가 설정되면 nodemailer 로 실제 발송.
 * 미설정 시 개발모드 = 콘솔 로그 폴백(시크릿은 .env 에 키만, 안전).
 *
 * 안전장치(MAIL_ALLOWLIST): SMTP 를 켜는 순간 크론·업무 트리거가 전 임직원에게 실발송된다.
 * `MAIL_ALLOWLIST`(쉼표 구분 주소)를 설정하면 그 주소로만 나가고 나머지는 건너뛴다(리허설용).
 * 미설정(빈 값)이면 제한 없음 = 전체 발송(기존 동작).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  readonly enabled: boolean;
  /** null = 제한 없음(전체 발송). 배열이면 그 주소로만 실발송. */
  private readonly allowlist: string[] | null;

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
    const rawAllow = process.env.MAIL_ALLOWLIST?.trim();
    this.allowlist = rawAllow
      ? rawAllow.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : null;
    if (this.allowlist && this.allowlist.length > 0) {
      this.logger.log(
        `MAIL_ALLOWLIST 활성 — ${this.allowlist.length}개 주소로만 발송(나머지 수신자는 건너뜀).`,
      );
    }
  }

  /** allowlist 미설정이면 항상 허용. 설정 시 목록에 있는 주소만 허용(대소문자 무시). */
  private isAllowed(to: string): boolean {
    if (!this.allowlist) return true;
    return this.allowlist.includes(to.trim().toLowerCase());
  }

  /** 이메일 발송. 미설정/실패/allowlist 제외 시 폴백 → 항상 안전하게 반환. */
  async send(to: string, subject: string, text: string): Promise<{ sent: boolean; mode: string }> {
    if (!this.isAllowed(to)) {
      this.logger.log(`[MAIL:allowlist-skip] to=${to} — MAIL_ALLOWLIST 에 없어 발송 생략`);
      return { sent: false, mode: 'allowlist-skip' };
    }
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
