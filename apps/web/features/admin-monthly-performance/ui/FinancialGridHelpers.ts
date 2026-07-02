/**
 * 경영실적(월별 손익) 로컬 상태·계산 헬퍼.
 * 프론트 라이브 계산(매출총이익·율·년계)은 여기서만 수행.
 * 저장값 = 매출/원가 목표·실적뿐 — 파생값은 백엔드 응답을 표시.
 */

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1) as number[];

/** 행 식별자 */
export type RowKey = 'revenueTarget' | 'revenueActual' | 'costTarget' | 'costActual';

/** 천단위 콤마 표시: "1000000" → "1,000,000". 빈/'-'·소수·음수 보존. */
export function formatComma(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split('.');
  const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + withComma + (decPart !== undefined ? '.' + decPart : '');
}

/** 입력값 정규화: 콤마·비숫자 제거, 선두 음수 1개·소수점 1개만 허용. draft 에는 콤마 없이 저장. */
export function sanitizeNumInput(v: string): string {
  const neg = v.trim().startsWith('-');
  const digits = v.replace(/[^0-9.]/g, '');
  const parts = digits.split('.');
  const normalized = parts.length > 1 ? `${parts.shift()}.${parts.join('')}` : digits;
  return (neg ? '-' : '') + normalized;
}

/** 드래프트 셀 단위. 열 key × 행 key → 입력 문자열 */
export type GridDraft = Record<string, string>;

export function cellKey(colKey: string, rowKey: RowKey): string {
  return `${colKey}:${rowKey}`;
}

/** 문자열 → 숫자 or null(빈 문자열·NaN) */
export function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

/** 매출총이익 = 매출 − 원가. 한쪽 null → 0 취급 */
export function grossProfit(
  rev: number | null,
  cost: number | null,
): number | null {
  if (rev === null && cost === null) return null;
  return (rev ?? 0) - (cost ?? 0);
}

/**
 * 매출총이익율(%) = grossProfit / 매출 × 100, 소수1자리.
 * 매출 0 또는 null → null(프론트는 '-' 렌더).
 */
export function grossProfitMargin(
  rev: number | null,
  gp: number | null,
): number | null {
  if (rev === null || rev === 0 || gp === null) return null;
  return Math.round((gp / rev) * 1000) / 10;
}

/** 년계 = 1~12월 합. 모두 null이면 null. */
export function yearTotal(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

// ── 라이브 파생 계산(draft 우선) ─────────────────
// 월 입력 표·차트·요약 카드가 공유하는 순수 함수. draft(미저장 입력)를 즉시 반영한다.

/** draft 셀 → 숫자 or null. 미입력이면 null. */
export function liveCell(draft: GridDraft, colKey: string, rowKey: RowKey): number | null {
  const raw = draft[cellKey(colKey, rowKey)];
  return raw !== undefined ? parseNum(raw) : null;
}

/** 해당 열의 라이브 매출총이익(목표/실적). */
export function liveGross(draft: GridDraft, colKey: string, isTarget: boolean): number | null {
  const rev = liveCell(draft, colKey, isTarget ? 'revenueTarget' : 'revenueActual');
  const cost = liveCell(draft, colKey, isTarget ? 'costTarget' : 'costActual');
  return grossProfit(rev, cost);
}

/** 해당 열의 라이브 매출총이익율(목표/실적). */
export function liveMargin(draft: GridDraft, colKey: string, isTarget: boolean): number | null {
  const rev = liveCell(draft, colKey, isTarget ? 'revenueTarget' : 'revenueActual');
  return grossProfitMargin(rev, liveGross(draft, colKey, isTarget));
}

/** 1~12월 입력행의 년계(라이브). */
export function liveYearTotal(draft: GridDraft, rowKey: RowKey): number | null {
  return yearTotal(MONTHS.map((m) => liveCell(draft, String(m), rowKey)));
}

/** 1~12월 매출총이익(목표/실적)의 년계 합. */
export function liveGrossYearTotal(draft: GridDraft, isTarget: boolean): number | null {
  return yearTotal(MONTHS.map((m) => liveGross(draft, String(m), isTarget)));
}
