import { MonthlyPerformance } from '@prisma/client';

/**
 * 경영실적 그리드 파생 계산(순수 함수 — 서비스에서 분리, 테스트 용이).
 * 입력 = revenue 카테고리 행들(매출 target/actual + cost target/actual).
 * 출력 컬럼 = [prevYear(2024), 1~12월, yearTotal(년계)].
 * 파생: 매출총이익 = 매출 − 원가, 매출총이익율(%) = 이익/매출×100 (매출 0/누락이면 null='-').
 *       년계 = Σ월(목표/실적 각각). 전년은 합산 제외.
 */

export interface Cell {
  target: number | null;
  actual: number | null;
}

export interface Column {
  key: string;
  label: string;
  isPrevYear: boolean;
  isYearTotal: boolean;
  revenue: Cell;
  cost: Cell;
  grossProfit: Cell;
  grossProfitMarginTarget: number | null;
  grossProfitMarginActual: number | null;
  /** 행별 비고(매출/원가, 월 컬럼만 — prevYear/yearTotal 은 null). */
  revenueNote: string | null;
  costNote: string | null;
}

/** 매출총이익율(%) = 이익/매출×100. 매출 0/null 이면 null('-'). 소수1자리 반올림. */
function margin(grossProfit: number | null, revenue: number | null): number | null {
  if (grossProfit == null || revenue == null || revenue === 0) return null;
  return Math.round((grossProfit / revenue) * 1000) / 10;
}

/** 매출총이익 = 매출 − 원가. 둘 다 null 이면 null. 한쪽 null 은 0 으로 취급. */
function grossProfit(revenue: number | null, cost: number | null): number | null {
  if (revenue == null && cost == null) return null;
  return (revenue ?? 0) - (cost ?? 0);
}

function buildColumn(
  key: string,
  label: string,
  opts: { isPrevYear?: boolean; isYearTotal?: boolean },
  revenue: Cell,
  cost: Cell,
  notes?: { revenueNote: string | null; costNote: string | null },
): Column {
  const gp: Cell = {
    target: grossProfit(revenue.target, cost.target),
    actual: grossProfit(revenue.actual, cost.actual),
  };
  return {
    key,
    label,
    isPrevYear: !!opts.isPrevYear,
    isYearTotal: !!opts.isYearTotal,
    revenue,
    cost,
    grossProfit: gp,
    grossProfitMarginTarget: margin(gp.target, revenue.target),
    grossProfitMarginActual: margin(gp.actual, revenue.actual),
    revenueNote: notes?.revenueNote ?? null,
    costNote: notes?.costNote ?? null,
  };
}

/** Σ 누적(null 안전 — 값이 하나라도 있으면 합산, 전부 없으면 null 유지). */
function addInto(acc: { v: number | null }, x: number | null): void {
  if (x == null) return;
  acc.v = (acc.v ?? 0) + x;
}

export function buildFinancialGrid(input: {
  cycleId: string;
  departmentId: string;
  departmentName: string | null;
  year: number;
  rows: MonthlyPerformance[];
}) {
  const { year, rows } = input;
  const prevYearNo = year - 1;

  const byMonth = new Map<number, MonthlyPerformance>();
  let prevRow: MonthlyPerformance | undefined;
  for (const r of rows) {
    if (r.month === 0 && r.year === prevYearNo) prevRow = r;
    else if (r.year === year && r.month >= 1 && r.month <= 12) byMonth.set(r.month, r);
  }

  const columns: Column[] = [];

  // 전년(2024) 컬럼 — 연간 단일(목표 없을 수 있음).
  columns.push(
    buildColumn(
      'prevYear',
      `${prevYearNo}년`,
      { isPrevYear: true },
      { target: prevRow?.targetAmount ?? null, actual: prevRow?.actualAmount ?? null },
      { target: prevRow?.costTarget ?? null, actual: prevRow?.costActual ?? null },
    ),
  );

  // 1~12월 컬럼 + 년계 누적.
  const sum = {
    rt: { v: null as number | null },
    ra: { v: null as number | null },
    ct: { v: null as number | null },
    ca: { v: null as number | null },
  };
  for (let m = 1; m <= 12; m++) {
    const row = byMonth.get(m);
    const revenue: Cell = {
      target: row ? row.targetAmount : null,
      actual: row ? row.actualAmount : null,
    };
    const cost: Cell = {
      target: row?.costTarget ?? null,
      actual: row?.costActual ?? null,
    };
    addInto(sum.rt, revenue.target);
    addInto(sum.ra, revenue.actual);
    addInto(sum.ct, cost.target);
    addInto(sum.ca, cost.actual);
    columns.push(
      buildColumn(String(m), `${m}월`, {}, revenue, cost, {
        revenueNote: row?.revenueNote ?? null,
        costNote: row?.costNote ?? null,
      }),
    );
  }

  // 년계 컬럼 = Σ월.
  columns.push(
    buildColumn(
      'yearTotal',
      '년계',
      { isYearTotal: true },
      { target: sum.rt.v, actual: sum.ra.v },
      { target: sum.ct.v, actual: sum.ca.v },
    ),
  );

  return {
    cycleId: input.cycleId,
    departmentId: input.departmentId,
    departmentName: input.departmentName,
    year,
    prevYear: prevYearNo,
    columns,
  };
}
