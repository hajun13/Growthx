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
  /** 행별 비고(매출/원가) — 월 컬럼만 값, prevYear/yearTotal 은 null. */
  revenueNote: string | null;
  costNote: string | null;
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
  /** 행별 비고 — 빈 문자열은 백엔드에서 null 정규화. */
  revenueNote?: string | null;
  costNote?: string | null;
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

// ── finalize 타입 ────────────────────────────────────────────────

/** POST /monthly-performance/finalize 요청 body */
export interface FinalizeMonthlyBody {
  cycleId: string;
  departmentId: string;
  year: number;
  /** 미지정 시 해당 부서·연도 전월 전체 확정 */
  month?: number;
}

/** POST /monthly-performance/finalize 응답 data */
export interface FinalizeMonthlyResult {
  ok: boolean;
  cycleId: string;
  departmentId: string;
  year: number;
  month: number | null;
  finalizedCount: number;
}

/** MonthlyPerformance status */
export type MonthlyPerformanceStatus = 'draft' | 'final';

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

export async function finalizeMonthlyPerformance(
  body: FinalizeMonthlyBody,
): Promise<FinalizeMonthlyResult> {
  return apiPost<FinalizeMonthlyResult>('/monthly-performance/finalize', body);
}
