/**
 * 보상 현황 표 컬럼 정의.
 * CompensationView / CompensationRow / handlePrint 에서 공동 참조.
 *
 * buildColumns(currentCycleYear) 로 연봉 3개 컬럼 헤더를 동적 연도로 렌더.
 * currentCycleYear 가 null 이면 정적 폴백("전년도"/"25년도") 사용.
 *
 * ─ 최종 컬럼 순서 (좌→우) ─────────────────────────────────────────
 * [sticky 0] 이름/본부·팀
 * [sticky 1] 직급
 * ── 경력 그룹 ───────────────────────────────────────────────────────
 * [2]  입사일
 * [3]  근속력(월)
 * [4]  전경력(월)
 * [5]  총경력(월)
 * [6]  총경력(연월)
 * [7]  연차(년) ← totalCareerMonths 파생: Math.floor(totalCareerMonths / 12)
 * [8]  고려대상 열외
 * ── 연봉 그룹 ───────────────────────────────────────────────────────
 * [9]  전년도 연봉
 * [10] 금년도(이전제외A)
 * [11] 금년도(이전포함B)
 * [12] 증감(B-A)
 * ── 보상조정 그룹 ────────────────────────────────────────────────────
 * [13] 조정분(만원)          ← 편집
 * [14] 제안연봉
 * [15] 등급(작년→올해)      ← 신규
 * [16] 인상률
 * [17] 승격                  ← 편집
 * [18] 인센티브(만원)        ← 편집
 * [19] 비고                  ← 편집
 */

export interface ColDef {
  /** 헤더 텍스트 */
  label: string;
  /** 헤더 sub-label (2행) */
  sub?: string;
  /** px 단위 최소 너비 */
  width: number;
  /** 수치 컬럼(tabular-nums + 우측 정렬) */
  numeric?: boolean;
  /** sticky-left 고정 컬럼 여부 */
  sticky?: boolean;
  /** 편집 컬럼 (hr_admin canEdit) */
  editable?: boolean;
  /**
   * 컬럼 그룹 구분선 — 해당 컬럼 왼쪽에 옅은 세로 보더.
   * 'career' | 'salary' | 'compensation'
   */
  groupStart?: 'career' | 'salary' | 'compensation';
}

/** 좌측 고정 2컬럼 누적 left 오프셋(px) */
export const STICKY_OFFSETS = {
  name: 0,
  position: 152,
} as const;

/**
 * 조회 사이클 연도 기반으로 동적 헤더 라벨을 포함한 컬럼 배열 반환.
 * - col 9:  `{currentCycleYear - 1}년도` (전년도 연봉)
 * - col 10: `{currentCycleYear}년도` / sub "이전제외A"
 * - col 11: `{currentCycleYear}년도` / sub "이전포함B"
 * - col 14: `{currentCycleYear + 1}년도(제안)` (차기 제안연봉)
 * currentCycleYear null 이면 폴백 라벨.
 */
export function buildColumns(currentCycleYear: number | null | undefined): ColDef[] {
  const cur = currentCycleYear ?? null;
  const prevLabel = cur != null ? `${cur - 1}년도` : '전년도';
  const curLabel  = cur != null ? `${cur}년도`     : '25년도';
  const nextLabel = cur != null ? `${cur + 1}년도(제안)` : '제안연봉';

  return [
    // ── 좌측 고정 ───────────────────────────────────────────────────
    { label: '이름', sub: '본부 · 팀', width: 152, sticky: true },  // 0
    { label: '직급',                   width: 72,  sticky: true },  // 1
    // ── 경력 그룹 ───────────────────────────────────────────────────
    { label: '입사일',                  width: 92,  groupStart: 'career' },       // 2
    { label: '근속력',  sub: '(월)',    width: 64,  numeric: true },              // 3
    { label: '전경력',  sub: '(월)',    width: 64,  numeric: true },              // 4
    { label: '총경력',  sub: '(월)',    width: 64,  numeric: true },              // 5
    { label: '총경력',  sub: '(연월)',  width: 84 },                              // 6
    { label: '연차',    sub: '(년)',    width: 54,  numeric: true },              // 7
    { label: '고려대상', sub: '열외',   width: 88 },                             // 8
    // ── 연봉 그룹 ───────────────────────────────────────────────────
    { label: prevLabel, sub: '연봉',     width: 100, numeric: true, groupStart: 'salary' },  // 9
    { label: curLabel,  sub: '이전제외A', width: 100, numeric: true },                        // 10
    { label: curLabel,  sub: '이전포함B', width: 100, numeric: true },                        // 11
    { label: '증감',    sub: '(B-A)',     width: 84,  numeric: true },                        // 12
    // ── 보상조정 그룹 ────────────────────────────────────────────────
    { label: '조정분', sub: '(만원)',    width: 80,  numeric: true, editable: true, groupStart: 'compensation' },  // 13
    { label: nextLabel,                  width: 108, numeric: true },                                               // 14
    { label: '등급',   sub: '작년→올해', width: 110 },                                                             // 15 — 등급 전환 셀
    { label: '인상률',                   width: 76,  numeric: true },                                               // 16
    { label: '승격',                     width: 96,  editable: true },                                              // 17
    { label: '인센티브', sub: '(만원)',  width: 84,  numeric: true, editable: true },                               // 18
    { label: '비고',                     width: 100, editable: true },                                              // 19
  ];
}

/** 정적 폴백 컬럼 배열 (currentCycleYear 미확정 초기 렌더용). */
export const COLUMNS: ColDef[] = buildColumns(null);

/** sticky-left 컬럼의 left 값(px). 인덱스 0~1만 의미 있음. */
export function stickyLeft(colIndex: number): number {
  if (colIndex === 0) return STICKY_OFFSETS.name;
  if (colIndex === 1) return STICKY_OFFSETS.position;
  return 0;
}

/** 컬럼 그룹 구분선 색 */
export const GROUP_DIVIDER = 'rgba(63,44,128,0.1)';

/** 표 전체 최소 너비(px). */
export const TABLE_MIN_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);
