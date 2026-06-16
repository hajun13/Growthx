/**
 * 경영실적 그리드 로컬 상태·계산 헬퍼.
 * 프론트 라이브 계산(매출총이익·율·년계)은 여기서만 수행.
 * 저장값 = 매출/원가 목표·실적뿐 — 파생값은 백엔드 응답을 표시.
 */

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1) as number[];

/** 행 식별자 */
export type RowKey = 'revenueTarget' | 'revenueActual' | 'costTarget' | 'costActual';

/** 편집 가능한 4개 행(붙여넣기 세로 채움 순서·그리드 표시 순서 공유) */
export const EDIT_ROWS: RowKey[] = ['revenueTarget', 'revenueActual', 'costTarget', 'costActual'];

/** 엑셀 양식의 입력 가능한 상위 행(위→아래): 매출, 원가. (이익·이익율은 자동) */
export type TopRow = 'revenue' | 'cost';
export const EDIT_TOP_ROWS: TopRow[] = ['revenue', 'cost'];

/**
 * 한 입력 행(매출 또는 원가)의 편집 가능한 셀을 **엑셀 시각 순서**로 나열.
 * [전년 실적] → [1월 목표][1월 실적] → … → [12월 목표][12월 실적].
 * 붙여넣기(handlePaste)가 시작 셀 인덱스 기준으로 오른쪽·아래로 채울 때 사용.
 */
export function editableCellsFor(top: TopRow): { col: string; rk: RowKey }[] {
  const T: RowKey = top === 'revenue' ? 'revenueTarget' : 'costTarget';
  const A: RowKey = top === 'revenue' ? 'revenueActual' : 'costActual';
  const cells: { col: string; rk: RowKey }[] = [{ col: 'prevYear', rk: A }];
  for (const m of MONTHS) {
    cells.push({ col: String(m), rk: T });
    cells.push({ col: String(m), rk: A });
  }
  return cells;
}

/** 셀 키보드 이동 방향 */
export type NavDir = 'up' | 'down' | 'left' | 'right';

/**
 * 엑셀식 셀 이동 — 편집 가능 격자(2행[매출·원가] × 25열[전년·1~12월 목표/실적])에서
 * 현재 셀 기준 인접 셀을 반환. 격자 밖이면 null.
 */
export function navTarget(
  currentCol: string,
  currentRk: RowKey,
  dir: NavDir,
): { col: string; rk: RowKey } | null {
  const top: TopRow = currentRk.startsWith('revenue') ? 'revenue' : 'cost';
  const rowIdx = EDIT_TOP_ROWS.indexOf(top);
  const cells = editableCellsFor(top);
  const colIdx = cells.findIndex((c) => c.col === currentCol && c.rk === currentRk);
  if (colIdx === -1) return null;
  if (dir === 'up' || dir === 'down') {
    const nr = dir === 'up' ? rowIdx - 1 : rowIdx + 1;
    if (nr < 0 || nr >= EDIT_TOP_ROWS.length) return null;
    return editableCellsFor(EDIT_TOP_ROWS[nr])[colIdx] ?? null;
  }
  const nc = dir === 'left' ? colIdx - 1 : colIdx + 1;
  if (nc < 0 || nc >= cells.length) return null;
  return cells[nc];
}

/** 편집 격자 좌표 {r:0|1 행, c:0~24 열}. 매출=0·원가=1, 열은 editableCellsFor 순서. */
export interface Coord {
  r: number;
  c: number;
}

/** (col,rk) → 격자 좌표. 편집 불가 셀이면 null. */
export function coordOf(col: string, rk: RowKey): Coord | null {
  const top: TopRow = rk.startsWith('revenue') ? 'revenue' : 'cost';
  const r = EDIT_TOP_ROWS.indexOf(top);
  const c = editableCellsFor(top).findIndex((x) => x.col === col && x.rk === rk);
  return c === -1 ? null : { r, c };
}

/** 격자 좌표 → (col,rk). 범위 밖이면 null. */
export function cellAtCoord(r: number, c: number): { col: string; rk: RowKey } | null {
  const top = EDIT_TOP_ROWS[r];
  if (!top) return null;
  return editableCellsFor(top)[c] ?? null;
}

/** 두 좌표가 이루는 사각형 안의 모든 편집 셀(드래그 선택 일괄 삭제용). */
export function rangeCells(a: Coord, b: Coord): { col: string; rk: RowKey }[] {
  const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
  const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
  const out: { col: string; rk: RowKey }[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = cellAtCoord(r, c);
      if (cell) out.push(cell);
    }
  }
  return out;
}

/** 좌표가 두 좌표 사각형 안에 있는지(선택 하이라이트). */
export function coordInRange(p: Coord, a: Coord, b: Coord): boolean {
  return (
    p.r >= Math.min(a.r, b.r) && p.r <= Math.max(a.r, b.r) &&
    p.c >= Math.min(a.c, b.c) && p.c <= Math.max(a.c, b.c)
  );
}

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

/** 열 key 문자열 */
export type ColKey = 'prevYear' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | 'yearTotal';

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

/**
 * TSV 문자열(엑셀 복붙) → [행][열] 2D 배열.
 * \r\n 또는 \n 행구분, \t 열구분.
 */
export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd()
    .split('\n')
    .map((row) => row.split('\t'));
}

// ── 라이브 파생 계산(draft 우선, 서버 columns 폴백) ─────────────────
// 그리드 행 컴포넌트가 공유하는 순수 함수. draft(미저장 입력)를 즉시 반영한다.

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

/**
 * 숫자 문자열에서 천단위 쉼표, 한글(억/만), '%' 제거 후 숫자 string 반환.
 * 엑셀 붙여넣기 값(예: "1,200,000" "120만") 대응.
 */
export function normalizePasteNum(raw: string): string {
  const s = raw.trim();
  if (s === '' || s === '-') return '';
  // 백분율 제거
  const noPercent = s.replace(/%/g, '');
  // 쉼표 제거
  const noComma = noPercent.replace(/,/g, '');
  // 억/만 단위 변환
  if (/억/.test(noComma)) {
    const n = parseFloat(noComma.replace(/억.*/, ''));
    if (!Number.isNaN(n)) return String(Math.round(n * 100_000_000));
  }
  if (/만/.test(noComma)) {
    const n = parseFloat(noComma.replace(/만.*/, ''));
    if (!Number.isNaN(n)) return String(Math.round(n * 10_000));
  }
  const n = parseFloat(noComma);
  return Number.isNaN(n) ? '' : String(n);
}
