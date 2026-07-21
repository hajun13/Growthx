import { describe, it, expect, vi } from 'vitest';

// 생성 맵을 테스트용으로 대체 — 실제 URL 없이 매칭 규칙만 검증한다.
vi.mock('./manualLinks.generated', () => ({
  MANUAL_LINKS: {
    employee: {
      '/kpi': 'https://n.site/emp-kpi',
      '/eval/result': 'https://n.site/emp-result',
    },
    team_lead: {
      '/kpi': 'https://n.site/lead-kpi',
      '/kpi/review': 'https://n.site/lead-review',
    },
  },
}));

import { resolveManualLink } from './manualLink';

describe('resolveManualLink', () => {
  it('정확히 일치하는 경로의 URL 을 돌려준다', () => {
    expect(resolveManualLink('employee', '/kpi')).toBe('https://n.site/emp-kpi');
  });

  it('동적 하위 경로는 가장 긴 상위 경로로 매칭한다', () => {
    expect(resolveManualLink('employee', '/eval/result/abc-123')).toBe('https://n.site/emp-result');
  });

  it('매핑에 없는 경로는 null (버튼 숨김)', () => {
    expect(resolveManualLink('employee', '/dashboard')).toBeNull();
  });

  it('부분 문자열이지만 세그먼트 경계가 아니면 매칭하지 않는다', () => {
    // '/kpi-import' 가 '/kpi' 로 잘못 매칭되면 안 된다.
    expect(resolveManualLink('employee', '/kpi-import')).toBeNull();
  });

  it('본부장(division_head)은 팀장 매뉴얼로 폴백한다', () => {
    expect(resolveManualLink('division_head', '/kpi')).toBe('https://n.site/lead-kpi');
    expect(resolveManualLink('division_head', '/kpi/review')).toBe('https://n.site/lead-review');
  });

  it('대표이사(hr_admin)도 공유 화면에선 팀장 매뉴얼로 폴백한다', () => {
    expect(resolveManualLink('hr_admin', '/kpi')).toBe('https://n.site/lead-kpi');
  });

  it('팀장 매뉴얼에 없는 관리 전용 경로는 폴백해도 null (버튼 숨김)', () => {
    expect(resolveManualLink('hr_admin', '/admin/rules')).toBeNull();
    expect(resolveManualLink('division_head', '/admin/users')).toBeNull();
  });
});
