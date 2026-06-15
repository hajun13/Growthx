'use client';

// 월별 실적 데이터 입력 — 데이터 훅.
// 생성 클라이언트(@growthx/contracts) 기반. 봉투 unwrap 은 api.ts 가 수행.
import { useAsync } from '@/hooks/useAsync';
import {
  fetchMonthlyPerformance,
  fetchMonthlyPerformanceSummary,
  createMonthlyPerformance,
  updateMonthlyPerformance,
  type MonthlyPerformance,
  type MonthlyPerformanceSummary,
  type MonthlyPerformanceInput,
} from './api';

/** 부서·연도별 월별 실적 목록(이미 unwrap 된 배열). */
export function useMonthlyPerformance(
  params: { cycleId?: string; departmentId?: string; year?: number } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<MonthlyPerformance[]>(
    () =>
      fetchMonthlyPerformance({
        cycleId: params.cycleId,
        departmentId: params.departmentId,
        year: params.year,
      }),
    [params.cycleId, params.departmentId, params.year],
    options,
  );
}

/** 누적 달성률 + 현재 등급(달성률→등급은 백엔드 산정). */
export function useMonthlyPerformanceSummary(
  params: { cycleId?: string; departmentId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<MonthlyPerformanceSummary>(
    () =>
      fetchMonthlyPerformanceSummary(params.cycleId!, params.departmentId!),
    [params.cycleId, params.departmentId],
    {
      enabled:
        !!params.cycleId && !!params.departmentId && (options.enabled ?? true),
    },
  );
}

export const monthlyPerformanceCommands = {
  // upsert(연/월/부서/카테고리 키). id 있으면 PATCH(목표/실적만), 없으면 신규.
  create: (body: MonthlyPerformanceInput) => createMonthlyPerformance(body),
  update: (id: string, body: MonthlyPerformanceInput) =>
    updateMonthlyPerformance(id, {
      targetAmount: body.targetAmount,
      actualAmount: body.actualAmount,
    }),
};
