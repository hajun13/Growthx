import { describe, it, expect, afterEach } from 'vitest';
import { MailService } from './mail.service';

// MailService 는 생성자에서 process.env 를 읽으므로, 각 케이스마다 env 를 세팅한 뒤 새 인스턴스를 만든다.
const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

describe('MailService — MAIL_ALLOWLIST 안전장치', () => {
  it('allowlist 미설정이면 전체 발송 대상(SMTP 미설정이라 콘솔 폴백)', async () => {
    delete process.env.MAIL_ALLOWLIST;
    delete process.env.SMTP_HOST;
    const mail = new MailService();
    const r = await mail.send('anyone@energyx.co.kr', '제목', '본문');
    expect(r.mode).toBe('console');
  });

  it('allowlist 에 없는 주소는 실발송/폴백 이전에 건너뛴다(allowlist-skip)', async () => {
    process.env.MAIL_ALLOWLIST = 'hgai@energyx.co.kr';
    const mail = new MailService();
    const r = await mail.send('other@energyx.co.kr', '제목', '본문');
    expect(r).toEqual({ sent: false, mode: 'allowlist-skip' });
  });

  it('allowlist 에 있는 주소는 통과(대소문자·공백 무시)', async () => {
    process.env.MAIL_ALLOWLIST = ' hgai@energyx.co.kr , boss@energyx.co.kr ';
    delete process.env.SMTP_HOST;
    const mail = new MailService();
    const r = await mail.send('HGAI@energyx.co.kr', '제목', '본문');
    expect(r.mode).toBe('console'); // 통과했으나 SMTP 미설정 → 콘솔 폴백
  });
});
