// 사이드바 메뉴 정의 + 역할별 가시성 (wireframes.md G 표).
// v2: 다면(multi) 라우트 삭제. 부서장 평가(downward)·M2 화면 추가.
import type { Role } from './types';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  // 이 역할들에게만 노출. 비어있으면 전체.
  roles?: Role[];
  // 구분선(이 항목 위에 구분선 표시)
  divider?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // ── M2: HR 대시보드 (hr_admin 기본 랜딩, 최상단) ──
  {
    key: 'dashboard',
    label: '대시보드',
    href: '/dashboard',
    roles: ['hr_admin'],
  },
  // M3 Items1-3: 조직도(전 역할 열람, 편집은 hr_admin — 화면에서 분기).
  { key: 'org', label: '조직도', href: '/org' },
  { key: 'eval', label: '인사평가 메인', href: '/eval' },
  { key: 'kpi', label: 'KPI 작성', href: '/kpi' },
  {
    key: 'kpi-review',
    label: 'KPI 검토',
    href: '/kpi/review',
    roles: ['hr_admin', 'division_head', 'team_lead'],
  },
  { key: 'self', label: '본인평가', href: '/eval/self' },
  {
    key: 'dept-head',
    label: '부서장 평가',
    href: '/eval/dept-head',
    roles: ['hr_admin', 'division_head', 'team_lead'],
  },
  { key: 'result', label: '평가결과', href: '/eval/result' },
  // ── M2 ──
  {
    key: 'group-performance',
    label: '그룹실적/등급풀',
    href: '/admin/group-performance',
    roles: ['hr_admin', 'division_head'],
    divider: true,
  },
  {
    key: 'monthly-performance',
    label: '월별 실적',
    href: '/admin/monthly-performance',
    roles: ['hr_admin', 'division_head', 'team_lead'],
  },
  {
    key: 'competency-admin',
    label: '역량평가 문항',
    href: '/admin/competency',
    roles: ['hr_admin'],
  },
  {
    key: 'competency',
    label: '역량평가',
    href: '/eval/competency',
  },
  {
    key: 'reports',
    label: '분포 모니터링',
    href: '/reports',
    roles: ['hr_admin', 'division_head', 'team_lead'],
  },
  { key: 'appeals', label: '이의제기', href: '/appeals' },
  {
    key: 'compensation',
    label: '보상 시뮬',
    href: '/admin/compensation',
    roles: ['hr_admin'],
  },
  {
    key: 'settings',
    label: '설정',
    href: '/admin/settings',
    roles: ['hr_admin'],
  },
  {
    key: 'audit',
    label: '감사 로그',
    href: '/admin/audit',
    roles: ['hr_admin'],
  },
];

// hr_admin 로그인 시 기본 랜딩, 그 외는 인사평가 메인.
export function landingPath(role: Role): string {
  return role === 'hr_admin' ? '/dashboard' : '/eval';
}

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}

// 라우트 → 메뉴 키 (활성 표시용)
export function activeKeyForPath(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/org')) return 'org';
  if (pathname.startsWith('/admin/audit')) return 'audit';
  if (pathname.startsWith('/kpi/review')) return 'kpi-review';
  if (pathname.startsWith('/kpi')) return 'kpi';
  if (pathname.startsWith('/eval/self')) return 'self';
  if (pathname.startsWith('/eval/dept-head')) return 'dept-head';
  if (pathname.startsWith('/eval/result')) return 'result';
  if (pathname.startsWith('/admin/group-performance')) return 'group-performance';
  if (pathname.startsWith('/admin/monthly-performance')) return 'monthly-performance';
  if (pathname.startsWith('/admin/competency')) return 'competency-admin';
  if (pathname.startsWith('/eval/competency')) return 'competency';
  if (pathname.startsWith('/admin/compensation')) return 'compensation';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/appeals')) return 'appeals';
  if (pathname.startsWith('/eval')) return 'eval';
  return 'eval';
}

// employee 가 접근 불가한 라우트(프론트 UX 가드 — 보안은 백엔드)
export function canReview(role: Role): boolean {
  return role !== 'employee';
}
// 부서장 평가(downward) 가능: 팀장(1차)·본부장(2차)·hr_admin(열람)
export function canEvaluateDownward(role: Role): boolean {
  return role === 'team_lead' || role === 'division_head' || role === 'hr_admin';
}
export function isHrAdmin(role: Role): boolean {
  return role === 'hr_admin';
}
