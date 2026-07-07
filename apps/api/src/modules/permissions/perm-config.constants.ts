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

/* ── nav 키 (프론트 lib/nav.ts NAV_ITEMS 의 key 집합과 정확히 일치) ──
 * 하나라도 어긋나면 mergeNav 기본값에 그 키가 없어, 해당 메뉴의 숨김 설정 저장이
 * 조용히 풀린다(matrix 화이트리스트 정렬 시엔 아예 드랍). 프론트와 동일 집합 유지 필수. */
export const NAV_KEYS: string[] = [
  'dashboard',
  'user-mgmt',
  'perm-mgmt',
  'kpi',
  'my-eval',
  'kpi-review',
  'competency-items',
  'competency-eval',
  'midterm',
  'self',
  'dept-head',
  'result',
  'group-performance',
  'monthly-performance',
  'eval-summary',
  'appeals',
  'reports',
  'cycle-ops',
  'kpi-import',
  'compensation-import',
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
    const merged = { ...DEFAULT_MATRIX[lv] } as Record<FeatureKey, boolean>;
    const storedLv = rec[lv];
    if (storedLv) {
      // 알려진 FeatureKey 만 반영 — 미등록 키(오타·주입)는 무시(설정 오염 방지).
      for (const key of FEATURE_KEYS) {
        if (typeof storedLv[key] === 'boolean') merged[key] = storedLv[key] as boolean;
      }
      // 진단: 전송된 키가 FEATURE_KEYS 와 하나도 안 맞으면(인코딩 손상·오타) 조용히 기본값으로
      // 치환되던 것을 로그로 드러낸다("저장했는데 풀림"의 무증상 원인 탐지용). 저장은 그대로 진행.
      const storedKeys = Object.keys(storedLv);
      if (storedKeys.length > 0 && !storedKeys.some((k) => (FEATURE_KEYS as string[]).includes(k))) {
        // eslint-disable-next-line no-console
        console.warn(
          `[permissions] mergeMatrix: 레벨 '${lv}' 의 전송 키가 FEATURE_KEYS 와 하나도 일치하지 않아 기본값으로 저장됨 (전송 키: ${storedKeys.join(', ')})`,
        );
      }
    }
    out[lv] = merged;
  }
  // 불변식: hr 레벨의 '권한 부여·수정'·'시스템 설정' 은 절대 끌 수 없다.
  // 이 두 기능이 PUT /permissions/config(권한 편집)와 관리 화면을 게이트하므로, false 로 저장되면
  // 어떤 hr_admin 도 API 로 복구할 수 없는 영구 잠금이 된다. 저장·조회 양쪽(mergeMatrix)에서
  // 강제 복원해 이미 오염된 DB row 도 다음 resolve 때 자동 치유된다.
  out.hr['권한 부여·수정'] = true;
  out.hr['시스템 설정'] = true;
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
