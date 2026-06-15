/**
 * admin-monthly-performance feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  monthlyPerformanceControllerList,
  monthlyPerformanceControllerSummary,
  monthlyPerformanceControllerCreate,
  monthlyPerformanceControllerUpdate,
  type MonthlyPerformanceDto,
  type MonthlyPerformanceSummaryDto,
  type MonthlyPerformanceSummaryCategoryDto,
  type CreateMonthlyPerformanceDto,
} from '@growthx/contracts';

export type MonthlyPerformance = MonthlyPerformanceDto;
export type MonthlyPerformanceSummary = MonthlyPerformanceSummaryDto;
export type MonthlyPerformanceSummaryCategory =
  MonthlyPerformanceSummaryCategoryDto;
export type MonthlyPerformanceInput = CreateMonthlyPerformanceDto;

export interface MonthlyPerformanceListParams {
  cycleId?: string;
  departmentId?: string;
  year?: number;
}

/** 부서·연도별 월별 실적 목록. */
export async function fetchMonthlyPerformance(
  params: MonthlyPerformanceListParams,
): Promise<MonthlyPerformance[]> {
  const res = await monthlyPerformanceControllerList({
    cycleId: params.cycleId,
    departmentId: params.departmentId,
    year: params.year !== undefined ? String(params.year) : undefined,
  });
  return res.data.data ?? [];
}

/** 누적 달성률 + 현재 등급(달성률→등급은 백엔드 산정). */
export async function fetchMonthlyPerformanceSummary(
  cycleId: string,
  departmentId: string,
): Promise<MonthlyPerformanceSummary> {
  const res = await monthlyPerformanceControllerSummary({
    cycleId,
    departmentId,
  });
  return res.data.data;
}

/** upsert(연/월/부서/카테고리 키) — 신규 적재. */
export async function createMonthlyPerformance(
  body: MonthlyPerformanceInput,
): Promise<void> {
  await monthlyPerformanceControllerCreate(body);
}

/** 기존 레코드 갱신(목표/실적). */
export async function updateMonthlyPerformance(
  id: string,
  body: { targetAmount?: number; actualAmount?: number },
): Promise<void> {
  await monthlyPerformanceControllerUpdate(id, body);
}
