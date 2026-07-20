import { describe, it, expect, vi } from 'vitest';

// 생성 맵을 테스트용으로 대체 — 실제 URL 없이 매칭 규칙만 검증한다.
vi.mock('./manualLinks.generated', () => ({
  MANUAL_LINKS: {
    employee: {
      '/kpi': 'https://n.site/kpi',
      '/eval/result': 'https://n.site/result',
    },
  },
}));

import { resolveManualLink } from './manualLink';

describe('resolveManualLink', () => {
  it('정확히 일치하는 경로의 URL 을 돌려준다', () => {
    expect(resolveManualLink('employee', '/kpi')).toBe('https://n.site/kpi');
  });

  it('동적 하위 경로는 가장 긴 상위 경로로 매칭한다', () => {
    expect(resolveManualLink('employee', '/eval/result/abc-123')).toBe('https://n.site/result');
  });

  it('매핑에 없는 경로는 null (버튼 숨김)', () => {
    expect(resolveManualLink('employee', '/dashboard')).toBeNull();
  });

  it('부분 문자열이지만 세그먼트 경계가 아니면 매칭하지 않는다', () => {
    // '/kpi-import' 가 '/kpi' 로 잘못 매칭되면 안 된다.
    expect(resolveManualLink('employee', '/kpi-import')).toBeNull();
  });

  it('맵에 없는 역할은 null', () => {
    expect(resolveManualLink('team_lead', '/kpi')).toBeNull();
    expect(resolveManualLink('hr_admin', '/kpi')).toBeNull();
  });
});
