// 권한 설정 저장소 (서버 연동).
// 권한 매트릭스 + 권한 레벨별 사이드바 nav 가시성을 백엔드에 영속한다.
//   GET /permissions/config  → { matrix, navVisibility }  (인증된 모든 사용자)
//   PUT /permissions/config  body { matrix, navVisibility } (hr_admin + '권한 부여·수정')
// 서버 row 가 없으면 백엔드가 DEFAULT_* 동등 기본값을 반환한다. 로딩/실패/SSR 시
// 프론트는 아래 DEFAULT_* 로 폴백한다(무회귀).
//
// SSOT: 권한 레벨(PermLevel) = Role + visibilityScope 조합. 조직 그룹→본부→팀에
// 맞춰 division_head Role 을 scope(group/division)로 나눠 5단계로 분리한다.
//   전체관리자→hr_admin·company / 그룹 대표→division_head·group /
//   본부장→division_head·division / 팀장→team_lead·team / 일반사용자→employee·self
import type { Role, VisibilityScope } from './types';
import { NAV_ITEMS } from './nav';
import { apiGet, apiPut } from './api';

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

/* ──────────────────────────────────────────────────────────────
 * 권한 레벨(PermLevel) — 부여·설정 단위 SSOT
 * ────────────────────────────────────────────────────────────── */
export type PermLevel = 'hr' | 'group' | 'division' | 'team' | 'member';

export interface LevelDef {
  key: PermLevel;
  label: string;
  bg: string;
  color: string;
  desc: string;
  role: Role;
  scope: VisibilityScope;
}

// 색상(EnergyX 권한관리 — 퍼플/인포/성공/뉴트럴 토큰 인라인).
const C = {
  grey700: '#3F3F47',   // neutral-700
  grey900: '#18181C',   // neutral-900
  blue500: '#2563EB',   // info-500 (본부장 — 블루 유지, grade-a 동일)
  green500: '#16A34A',  // success-500
  purple: '#7A37D8',    // primary-500
};

// 표시·정렬 순서(넓은 권한 → 좁은 권한).
export const LEVEL_DEFS: LevelDef[] = [
  { key: 'hr',       label: '전체관리자 (HR)', bg: C.grey900, color: '#fff', desc: '전 조직 열람·수정',          role: 'hr_admin',      scope: 'company' },
  { key: 'group',    label: '그룹 대표',       bg: C.purple,  color: '#fff', desc: '소속 그룹 전체 열람',         role: 'division_head', scope: 'group' },
  { key: 'division', label: '본부장',          bg: C.blue500, color: '#fff', desc: '소속 본부만(타 본부 차단)',   role: 'division_head', scope: 'division' },
  { key: 'team',     label: '팀장',            bg: C.green500, color: '#fff', desc: '소속 팀만 열람',             role: 'team_lead',     scope: 'team' },
  { key: 'member',   label: '일반사용자',      bg: C.grey700, color: '#fff', desc: '본인 데이터만',               role: 'employee',      scope: 'self' },
];

export const LEVEL_KEYS: PermLevel[] = LEVEL_DEFS.map((d) => d.key);

export const LEVEL_BY_KEY = Object.fromEntries(
  LEVEL_DEFS.map((d) => [d.key, d]),
) as Record<PermLevel, LevelDef>;

// (role, visibilityScope) → 권한 레벨. division_head 는 scope 로 그룹대표/본부장 구분.
export function levelOf(role: Role, scope: VisibilityScope): PermLevel {
  if (role === 'hr_admin') return 'hr';
  if (role === 'team_lead') return 'team';
  if (role === 'employee') return 'member';
  // division_head — scope 로 그룹대표(group)/본부장(그 외) 구분.
  return scope === 'group' ? 'group' : 'division';
}

/* ──────────────────────────────────────────────────────────────
 * 기본 권한 매트릭스 (PermLevel 키)
 *   그룹 대표/본부장 분리 — 기존 division_head 값을 본부장에 유지하고,
 *   그룹 대표는 소속 그룹 전체를 열람하므로 '평가결과 전체열람'을 추가 허용.
 * ────────────────────────────────────────────────────────────── */
export const DEFAULT_MATRIX: Record<PermLevel, Record<FeatureKey, boolean>> = {
  hr:       { '평가결과 전체열람': true,  'KPI 승인/반려': true,  '등급풀 수정': true,  '권한 부여·수정': true,  '시스템 설정': true,  '감사로그': true  },
  // 그룹 대표 — 그룹 전체 열람. 등급풀은 그룹 단위이므로 수정 허용.
  group:    { '평가결과 전체열람': true,  'KPI 승인/반려': true,  '등급풀 수정': true,  '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
  // 본부장 — 소속 본부 한정(기존 division_head 기본값 유지).
  division: { '평가결과 전체열람': true,  'KPI 승인/반려': true,  '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
  team:     { '평가결과 전체열람': false, 'KPI 승인/반려': true,  '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
  member:   { '평가결과 전체열람': false, 'KPI 승인/반려': false, '등급풀 수정': false, '권한 부여·수정': false, '시스템 설정': false, '감사로그': false },
};

/* ──────────────────────────────────────────────────────────────
 * 기본 사이드바 nav 가시성 — 시스템은 막지 않는다.
 *   모든 권한 레벨이 모든 메뉴를 기본 노출(true). 관리자가 권한 관리 →
 *   '사이드바 메뉴' 탭에서 레벨별로 끄면 그때만 숨겨진다.
 * ────────────────────────────────────────────────────────────── */
const allNavVisible = (): Record<string, boolean> =>
  Object.fromEntries(NAV_ITEMS.map((i) => [i.key, true]));

export const DEFAULT_NAV_VISIBILITY: Record<PermLevel, Record<string, boolean>> = {
  hr: allNavVisible(),
  group: allNavVisible(),
  division: allNavVisible(),
  team: allNavVisible(),
  member: allNavVisible(),
};

export type MatrixConfig = Record<PermLevel, Record<FeatureKey, boolean>>;
export type NavConfig = Record<PermLevel, Record<string, boolean>>;

// GET/PUT /permissions/config 의 응답·요청 봉투 안 shape(1:1).
export interface PermissionsConfig {
  matrix: MatrixConfig;
  navVisibility: NavConfig;
}

const CONFIG_PATH = '/permissions/config';

// 서버가 부분/구버전 row 를 줄 수 있어 DEFAULT_* 위에 머지한다(런타임 에러·undefined 방지).
export function mergeMatrix(partial: unknown): MatrixConfig {
  const src = (partial && typeof partial === 'object' ? partial : {}) as Record<
    string,
    Record<string, boolean> | undefined
  >;
  const merged = {} as MatrixConfig;
  for (const lv of LEVEL_KEYS) {
    merged[lv] = { ...DEFAULT_MATRIX[lv], ...(src[lv] ?? {}) };
  }
  return merged;
}

export function mergeNav(partial: unknown): NavConfig {
  const src = (partial && typeof partial === 'object' ? partial : {}) as Record<
    string,
    Record<string, boolean> | undefined
  >;
  const merged = {} as NavConfig;
  for (const lv of LEVEL_KEYS) {
    merged[lv] = { ...DEFAULT_NAV_VISIBILITY[lv], ...(src[lv] ?? {}) };
  }
  return merged;
}

// GET /permissions/config — 봉투 unwrap 후 DEFAULT_* 위에 머지해 반환.
export async function fetchPermissionsConfig(): Promise<PermissionsConfig> {
  const data = await apiGet<Partial<PermissionsConfig>>(CONFIG_PATH);
  return {
    matrix: mergeMatrix(data?.matrix),
    navVisibility: mergeNav(data?.navVisibility),
  };
}

// PUT /permissions/config — 전체 매트릭스+nav 를 저장(hr_admin + 권한 부여·수정).
export async function savePermissionsConfig(
  config: PermissionsConfig,
): Promise<PermissionsConfig> {
  const data = await apiPut<Partial<PermissionsConfig>>(CONFIG_PATH, {
    matrix: config.matrix,
    navVisibility: config.navVisibility,
  });
  return {
    matrix: mergeMatrix(data?.matrix ?? config.matrix),
    navVisibility: mergeNav(data?.navVisibility ?? config.navVisibility),
  };
}
