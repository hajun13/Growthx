// 권한 설정 SSOT (백엔드) — 프론트 apps/web/lib/permConfig.ts 와 정확히 일치해야 한다.
// PermLevel(5) × FeatureKey(6) 매트릭스 + PermLevel × navKey 가시성 기본값.
// FeatureGuard·permissions 모듈이 이 기본값을 fail-to-default 폴백으로 사용한다.
import { Role, VisibilityScope } from '@prisma/client';

/* ── 권한 레벨 (프론트 PermLevel 과 동일) ── */
export type PermLevel = 'hr' | 'group' | 'division' | 'team' | 'member';

export const LEVEL_KEYS: PermLevel[] = [
  'hr',
  'group',
  'division',
  'team',
  'member',
];

/* ── 기능 키 (프론트 FeatureKey 와 문자열 그대로 동일) ── */
export type FeatureKey =
  | '평가결과 전체열람'
  | 'KPI 승인/반려'
  | '등급풀 수정'
  | '권한 부여·수정'
  | '시스템 설정'
  | '감사로그';

export const FEATURE_KEYS: FeatureKey[] = [
  '평가결과 전체열람',
  'KPI 승인/반려',
  '등급풀 수정',
  '권한 부여·수정',
  '시스템 설정',
  '감사로그',
];

/**
 * (role, scope) → PermLevel.
 * 프론트 levelOf() 와 동일: hr_admin→hr, team_lead→team, employee→member,
 * division_head→(scope==='group' ? 'group' : 'division').
 */
export function levelOf(role: Role, scope: VisibilityScope): PermLevel {
  if (role === Role.hr_admin) return 'hr';
  if (role === Role.team_lead) return 'team';
  if (role === Role.employee) return 'member';
  // division_head — scope 로 그룹대표(group)/본부장(그 외) 구분.
  return scope === VisibilityScope.group ? 'group' : 'division';
}

/* ── 기본 매트릭스 (프론트 DEFAULT_MATRIX 와 값까지 정확히 동일) ── */
export const DEFAULT_MATRIX: Record<PermLevel, Record<FeatureKey, boolean>> = {
  hr: {
    '평가결과 전체열람': true,
    'KPI 승인/반려': true,
    '등급풀 수정': true,
    '권한 부여·수정': true,
    '시스템 설정': true,
    감사로그: true,
  },
  // 그룹 대표 — 그룹 전체 열람. 등급풀은 그룹 단위이므로 수정 허용.
  group: {
    '평가결과 전체열람': true,
    'KPI 승인/반려': true,
    '등급풀 수정': true,
    '권한 부여·수정': false,
    '시스템 설정': false,
    감사로그: false,
  },
  // 본부장 — 소속 본부 한정.
  division: {
    '평가결과 전체열람': true,
    'KPI 승인/반려': true,
    '등급풀 수정': false,
    '권한 부여·수정': false,
    '시스템 설정': false,
    감사로그: false,
  },
  team: {
    '평가결과 전체열람': false,
    'KPI 승인/반려': true,
    '등급풀 수정': false,
    '권한 부여·수정': false,
    '시스템 설정': false,
    감사로그: false,
  },
  member: {
    '평가결과 전체열람': false,
    'KPI 승인/반려': false,
    '등급풀 수정': false,
    '권한 부여·수정': false,
    '시스템 설정': false,
    감사로그: false,
  },
};

/* ── nav 키 (프론트 lib/nav.ts NAV_ITEMS 의 key 집합과 동일) ── */
export const NAV_KEYS: string[] = [
  'dashboard',
  'user-mgmt',
  'perm-mgmt',
  'eval',
  'my-eval',
  'kpi',
  'kpi-review',
  'competency-items',
  'competency-eval',
  'self',
  'dept-head',
  'result',
  'group-performance',
  'monthly-performance',
  'reports',
  'appeals',
  'yoy',
  'cycle-ops',
  'kpi-import',
  'rules',
  'compensation',
  'settings',
  'audit',
];

const allNavVisible = (): Record<string, boolean> =>
  Object.fromEntries(NAV_KEYS.map((k) => [k, true]));

/* ── 기본 nav 가시성 — 모든 레벨·모든 메뉴 노출(프론트와 동일). ── */
export const DEFAULT_NAV_VISIBILITY: Record<
  PermLevel,
  Record<string, boolean>
> = {
  hr: allNavVisible(),
  group: allNavVisible(),
  division: allNavVisible(),
  team: allNavVisible(),
  member: allNavVisible(),
};

export type PermMatrix = Record<PermLevel, Record<FeatureKey, boolean>>;
export type NavVisibility = Record<PermLevel, Record<string, boolean>>;

/* ── 병합 헬퍼 — 부분 저장/누락 키를 기본값으로 보강(부분 저장 안전). ── */
export function mergeMatrix(stored: unknown): PermMatrix {
  const rec = (stored ?? {}) as Partial<
    Record<PermLevel, Partial<Record<FeatureKey, boolean>>>
  >;
  const out = {} as PermMatrix;
  for (const lv of LEVEL_KEYS) {
    out[lv] = { ...DEFAULT_MATRIX[lv], ...(rec[lv] ?? {}) } as Record<
      FeatureKey,
      boolean
    >;
  }
  return out;
}

export function mergeNav(stored: unknown): NavVisibility {
  const rec = (stored ?? {}) as Partial<
    Record<PermLevel, Record<string, boolean>>
  >;
  const out = {} as NavVisibility;
  for (const lv of LEVEL_KEYS) {
    out[lv] = { ...DEFAULT_NAV_VISIBILITY[lv], ...(rec[lv] ?? {}) };
  }
  return out;
}
