// 권한 설정 저장소 (localStorage 기반 — 브라우저 전용).
// 권한 매트릭스 + 역할별 사이드바 nav 가시성을 클라이언트에 영속.
// ⚠️ 'use client' 컴포넌트에서만 호출 (SSR에서 localStorage 접근 금지).
import type { Role } from './types';
import { NAV_ITEMS } from './nav';

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

export const ROLES: Role[] = ['hr_admin', 'division_head', 'team_lead', 'employee'];

// 기본 권한 매트릭스 (현재 permissions 페이지의 permMatrix 그대로).
export const DEFAULT_MATRIX: Record<Role, Record<FeatureKey, boolean>> = {
  hr_admin:      { '평가결과 전체열람': true,  'KPI 승인/반려': true,  '등급풀 수정': true,  '권한 부여·수정': true,  '시스템 설정': true,  '감사로그': true  },
  division_head: { '평가결과 전체열람': true,  'KPI 승인/반려': true,  '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
  team_lead:     { '평가결과 전체열람': false, 'KPI 승인/반려': true,  '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
  employee:      { '평가결과 전체열람': false, 'KPI 승인/반려': false, '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
};

// 기본 사이드바 nav 가시성 — 시스템은 막지 않는다. 모든 역할이 모든 메뉴를 기본 노출(true).
// 관리자가 권한 관리 → '사이드바 메뉴' 탭에서 역할별로 끄면 그때만 숨겨진다.
const allNavVisible = (): Record<string, boolean> =>
  Object.fromEntries(NAV_ITEMS.map((i) => [i.key, true]));
export const DEFAULT_NAV_VISIBILITY: Record<Role, Record<string, boolean>> = {
  hr_admin: allNavVisible(),
  division_head: allNavVisible(),
  team_lead: allNavVisible(),
  employee: allNavVisible(),
};

const MATRIX_KEY = 'energyx_perm_matrix';
const NAV_KEY = 'energyx_nav_visibility';

function safeGet<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/private-mode 등 — 무시 */
  }
}

export function getMatrixConfig(): Record<Role, Record<FeatureKey, boolean>> {
  return safeGet(MATRIX_KEY, DEFAULT_MATRIX);
}

export function setMatrixConfig(config: Record<Role, Record<FeatureKey, boolean>>): void {
  safeSet(MATRIX_KEY, config);
}

export function getNavConfig(): Record<Role, Record<string, boolean>> {
  return safeGet(NAV_KEY, DEFAULT_NAV_VISIBILITY);
}

export function setNavConfig(config: Record<Role, Record<string, boolean>>): void {
  safeSet(NAV_KEY, config);
}
