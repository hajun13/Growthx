/**
 * reports feature — 데이터 계층(분포 모니터링 + 월별 실적).
 * @growthx/contracts 생성 클라이언트(타입 안전) 호출 + 봉투 unwrap(res.data.data).
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 생성 DTO는 등급/카테고리를 string 으로 느슨하게 주므로, 여기서 앱 도메인 타입(@/lib/types)으로
 * 좁혀 컴포넌트엔 기존과 동일한 타입을 넘긴다(시각/동작 보존).
 */
import {
  resultsControllerList,
  monthlyPerformanceControllerSummary,
  monthlyPerformanceControllerCreate,
} from '@growthx/contracts';
import type {
  EvaluationResult,
  MonthlyPerformanceSummary,
  MonthlyPerformanceSummaryCategory,
  MonthlyTrendPoint,
  MonthlyPerformanceInput,
  Grade,
} from '@/lib/types';

// 생성 DTO(string 등급/카테고리) → 도메인 타입으로 좁히는 헬퍼.
// 백엔드는 S~D 만 발행 — 캐스트는 계약 보장 범위 내.
function asGrade(g: string | null): Grade | null {
  return (g as Grade | null) ?? null;
}

export async function fetchResults(
  cycleId: string,
): Promise<EvaluationResult[]> {
  const res = await resultsControllerList({ cycleId });
  // 생성 DTO와 도메인 EvaluationResult 는 구조가 동일(필드 일치) — 등급 string 만 좁힘.
  return (res.data.data ?? []) as unknown as EvaluationResult[];
}

export async function fetchMonthlyPerformanceSummary(
  cycleId: string,
  departmentId: string,
): Promise<MonthlyPerformanceSummary> {
  const res = await monthlyPerformanceControllerSummary({
    cycleId,
    departmentId,
  });
  const d = res.data.data;
  return {
    cycleId: d.cycleId,
    departmentId: d.departmentId,
    departmentName: d.departmentName,
    targetAmount: d.targetAmount,
    actualAmount: d.actualAmount,
    achievementRate: d.achievementRate,
    currentGrade: asGrade(d.currentGrade),
    byCategory: d.byCategory.map(
      (c): MonthlyPerformanceSummaryCategory => ({
        category: c.category as MonthlyPerformanceSummaryCategory['category'],
        targetAmount: c.targetAmount,
        actualAmount: c.actualAmount,
        achievementRate: c.achievementRate,
        currentGrade: asGrade(c.currentGrade),
      }),
    ),
    monthlyTrend: d.monthlyTrend.map(
      (p): MonthlyTrendPoint => ({
        month: p.month,
        achievementRate: p.achievementRate,
        grade: asGrade(p.grade),
      }),
    ),
  };
}

export async function createMonthlyPerformance(
  body: MonthlyPerformanceInput,
): Promise<void> {
  await monthlyPerformanceControllerCreate({
    cycleId: body.cycleId,
    departmentId: body.departmentId,
    year: body.year,
    month: body.month,
    // 생성 DTO category 는 { [key: string]: unknown } 으로 발행 — 도메인 KpiCategory 를 그대로 전송.
    category: body.category as unknown as Record<string, unknown>,
    targetAmount: body.targetAmount,
    actualAmount: body.actualAmount,
  });
}
