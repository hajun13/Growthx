/**
 * admin-monthly-performance feature — 데이터 계층.
 * contract-financial-performance.md 기준.
 * 봉투 unwrap은 lib/api.ts (apiGet/apiPost) 가 수행.
 * 기존 monthlyPerformanceControllerList 소비처 보존: getMonthlyPerformanceList export 유지.
 */
import { apiGet, apiPost } from '@/lib/api';

// ── 그리드 조회(financial-grid) 타입 ─────────────────────────────

export interface FinancialGridCell {
  target: number | null;
  actual: number | null;
}

/** columns[15] 의 단일 열 */
export interface FinancialGridColumn {
  key: string;          // "prevYear" | "1".."12" | "yearTotal"
  label: string;        // "2024년" | "1월" .. "12월" | "년계"
  isPrevYear: boolean;
  isYearTotal: boolean;
  revenue: FinancialGridCell;
  cost: FinancialGridCell;
  grossProfit: FinancialGridCell;
  /** 매출 0/null → null(프론트는 '-'로 렌더) */
  grossProfitMarginTarget: number | null;
  grossProfitMarginActual: number | null;
}

/** GET /monthly-performance/financial-grid 응답 data */
export interface FinancialGridData {
  cycleId: string;
  departmentId: string;
  departmentName: string | null;
  year: number;
  prevYear: number;
  /** 고정 15개: [prevYear, 1~12, yearTotal] */
  columns: FinancialGridColumn[];
}

// ── bulk 저장 타입 ───────────────────────────────────────────────

export interface BulkMonthEntry {
  month: number;
  revenueTarget: number | null;
  revenueActual: number | null;
  costTarget: number | null;
  costActual: number | null;
}

export interface BulkPrevYear {
  revenueActual: number | null;
  costActual: number | null;
  revenueTarget?: number | null;
  costTarget?: number | null;
}

/** POST /monthly-performance/bulk 요청 body */
export interface BulkSaveBody {
  cycleId: string;
  departmentId: string;
  year: number;
  prevYear?: BulkPrevYear;
  /** 입력된 월만. 미입력 셀은 null */
  months: BulkMonthEntry[];
}

/** POST /monthly-performance/bulk 응답 data */
export interface BulkSaveResult {
  ok: boolean;
  cycleId: string;
  departmentId: string;
  year: number;
  upsertedMonths: number;
  prevYearSaved: boolean;
}

// ── API 함수 ─────────────────────────────────────────────────────

export async function fetchFinancialGrid(params: {
  cycleId: string;
  departmentId: string;
  year: number;
}): Promise<FinancialGridData> {
  return apiGet<FinancialGridData>('/monthly-performance/financial-grid', {
    cycleId: params.cycleId,
    departmentId: params.departmentId,
    year: params.year,
  });
}

export async function bulkSaveFinancialGrid(
  body: BulkSaveBody,
): Promise<BulkSaveResult> {
  return apiPost<BulkSaveResult>('/monthly-performance/bulk', body);
}
