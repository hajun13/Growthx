// 사이드바 메뉴 정의 + 역할별 가시성 (wireframes.md G 표).
// v2: 다면(multi) 라우트 삭제. 부서장 평가(downward)·M2 화면 추가.
import type { Role } from './types';

// 사이드바 시각 그룹(Toss 디자인 — collapsible 섹션). undefined = 그룹 없음(최상단).
export type NavGroupLabel = '인사평가' | '실적관리' | '모니터링' | '기타';

// 아이콘 색상 규칙(레퍼런스 Sidebar): core=거의검정, eval=파랑, alert=빨강, admin=회색.
export type NavTone = 'core' | 'eval' | 'admin' | 'alert';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  // 이 역할들에게만 노출. 비어있으면 전체.
  roles?: Role[];
  // 시각 그룹(사이드바 collapsible 섹션). 없으면 최상단 그룹.
  group?: NavGroupLabel;
  // 아이콘 타일 색상 톤.
  tone: NavTone;
}

export const NAV_ITEMS: NavItem[] = [
  // ── 최상단(그룹 없음) ──
  {
    key: 'dashboard',
    label: '대시보드',
    href: '/dashboard',
    roles: ['hr_admin'],
    tone: 'core',
  },
  // 사용자 관리(hr_admin 전용 — 계정·조직 배치).
  {
    key: 'user-mgmt',
    label: '사용자 관리',
    href: '/admin/users',
    roles: ['hr_admin'],
    tone: 'core',
  },
  // 권한 관리(hr_admin 전용 — RBAC).
  {
    key: 'perm-mgmt',
    label: '권한 관리',
    href: '/admin/permissions',
    roles: ['hr_admin'],
    tone: 'alert',
  },
  // 조직도(org) nav 항목 제거 — 라우트 /org 는 유지(직접 접근 가능).

  // ── 인사평가 ──
  { key: 'eval', label: '인사평가 메인', href: '/eval', group: '인사평가', tone: 'eval' },
  // 내 평가표 — 본인 평가결과 요약(전 역할). 라우트 /eval/my.
  { key: 'my-eval', label: '내 평가표', href: '/eval/my', group: '인사평가', tone: 'core' },
  { key: 'kpi', label: 'KPI 작성', href: '/kpi', group: '인사평가', tone: 'eval' },
  {
    key: 'kpi-review',
    label: 'KPI 검토',
    href: '/kpi/review',
    roles: ['hr_admin', 'division_head', 'team_lead'],
    group: '인사평가',
    tone: 'eval',
  },
  // 역량평가 문항 관리(hr_admin 전용).
  {
    key: 'competency-items',
    label: '역량평가 문항',
    href: '/admin/competency/items',
    roles: ['hr_admin'],
    group: '인사평가',
    tone: 'eval',
  },
  // 역량평가(임직원).
  {
    key: 'competency-eval',
    label: '역량평가',
    href: '/competency/eval',
    group: '인사평가',
    tone: 'eval',
  },
  { key: 'self', label: '본인평가', href: '/eval/self', group: '인사평가', tone: 'eval' },
  {
    key: 'dept-head',
    label: '부서장 평가',
    href: '/eval/dept-head',
    roles: ['hr_admin', 'division_head', 'team_lead'],
    group: '인사평가',
    tone: 'eval',
  },
  { key: 'result', label: '평가결과', href: '/eval/result', group: '인사평가', tone: 'eval' },

  // ── 실적관리 ──
  {
    key: 'group-performance',
    label: '그룹실적/등급풀',
    href: '/admin/group-performance',
    roles: ['hr_admin', 'division_head'],
    group: '실적관리',
    tone: 'eval',
  },
  {
    key: 'monthly-performance',
    label: '월별 실적',
    href: '/admin/monthly-performance',
    roles: ['hr_admin', 'division_head', 'team_lead'],
    group: '실적관리',
    tone: 'eval',
  },
  {
    key: 'reports',
    label: '분포 모니터링',
    href: '/reports',
    roles: ['hr_admin', 'division_head', 'team_lead'],
    group: '실적관리',
    tone: 'eval',
  },

  // ── 모니터링 ──
  { key: 'appeals', label: '이의제기', href: '/appeals', group: '모니터링', tone: 'alert' },

  // ── 기타 ──
  {
    key: 'compensation',
    label: '보상 시뮬',
    href: '/admin/compensation',
    roles: ['hr_admin'],
    group: '기타',
    tone: 'admin',
  },
  {
    key: 'settings',
    label: '설정',
    href: '/admin/settings',
    roles: ['hr_admin'],
    group: '기타',
    tone: 'admin',
  },
  {
    key: 'audit',
    label: '감사 로그',
    href: '/admin/audit',
    roles: ['hr_admin'],
    group: '기타',
    tone: 'admin',
  },
];

// 사이드바 그룹 표시 순서.
export const NAV_GROUP_ORDER: NavGroupLabel[] = ['인사평가', '실적관리', '모니터링', '기타'];

// hr_admin 로그인 시 기본 랜딩, 그 외는 인사평가 메인.
export function landingPath(role: Role): string {
  return role === 'hr_admin' ? '/dashboard' : '/eval';
}

// 시스템은 역할로 메뉴를 막지 않는다 — 모든 메뉴를 노출하고, 가시성 통제는 오직
// 관리자 설정(permConfig.getNavConfig)으로만 한다. (NAV_ITEMS[].roles 는 참고용 메타.)
export function visibleNav(_role: Role): NavItem[] {
  return NAV_ITEMS;
}

// 라우트 → 메뉴 키 (활성 표시용)
export function activeKeyForPath(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/admin/users')) return 'user-mgmt';
  if (pathname.startsWith('/admin/permissions')) return 'perm-mgmt';
  // /org 라우트는 직접 접근만 가능(가시 nav 항목 없음) → 활성 키 매핑 제거(없는 키 'org' 방지).
  if (pathname.startsWith('/admin/audit')) return 'audit';
  if (pathname.startsWith('/admin/competency')) return 'competency-items';
  if (pathname.startsWith('/competency/eval')) return 'competency-eval';
  if (pathname.startsWith('/kpi/review')) return 'kpi-review';
  if (pathname.startsWith('/kpi')) return 'kpi';
  if (pathname.startsWith('/eval/my')) return 'my-eval';
  if (pathname.startsWith('/eval/self')) return 'self';
  if (pathname.startsWith('/eval/dept-head')) return 'dept-head';
  if (pathname.startsWith('/eval/result')) return 'result';
  if (pathname.startsWith('/admin/group-performance')) return 'group-performance';
  if (pathname.startsWith('/admin/monthly-performance')) return 'monthly-performance';
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
