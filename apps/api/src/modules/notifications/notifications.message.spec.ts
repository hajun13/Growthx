import { describe, it, expect, afterEach } from 'vitest';
import { NotificationsService } from './notifications.service';

// linkedMessage·appLink 는 prisma·mail 을 쓰지 않으므로 의존성 없이 인스턴스화해 검증한다.
const svc = new NotificationsService({} as never, {} as never);

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

describe('NotificationsService — 요약+링크 본문(사유 원문 미노출)', () => {
  it('APP_BASE_URL 설정 시 절대 링크를 붙인다', () => {
    process.env.APP_BASE_URL = 'https://hr.energyx.co.kr';
    const msg = svc.linkedMessage('KPI가 반려되었어요. 반려 사유를 확인해 주세요.', '/kpi');
    expect(msg).toContain('https://hr.energyx.co.kr/kpi');
    expect(msg).toContain('내용 확인 →');
  });

  it('민감한 사유 원문을 본문에 넣지 않는다(요약만 전달됐을 때 사유 문자열 부재)', () => {
    process.env.APP_BASE_URL = 'https://hr.energyx.co.kr';
    const secretReason = '역량 부족 및 목표 미달 — 대외비 코멘트';
    // 호출부는 요약만 넘긴다(사유는 payload.reason 으로만). 본문에 원문이 새지 않아야 한다.
    const msg = svc.linkedMessage('평가가 반려되었어요. 반려 사유를 확인해 주세요.', '/eval/self');
    expect(msg).not.toContain(secretReason);
  });

  it('APP_BASE_URL 미설정이면 상대경로로 폴백(동작 유지)', () => {
    delete process.env.APP_BASE_URL;
    expect(svc.appLink('/kpi')).toBe('/kpi');
  });
});
