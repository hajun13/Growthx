'use client';

// M3 Item 4: 월별 실적 데이터 입력.
// API(requirements-m3.md): GET/POST/PATCH /monthly-performance, GET /monthly-performance/summary.
// 백엔드 구현 중 — 경로/봉투는 명세 선반영. 봉투는 api.ts 가 unwrap.

import { apiGetList, apiGet, apiPost, apiPatch } from '@/lib/api';
import type {
  MonthlyPerformance,
  MonthlyPerformanceSummary,
  MonthlyPerformanceInput,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function useMonthlyPerformance(
  params: { cycleId?: string; departmentId?: string; year?: number } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<MonthlyPerformance>('/monthly-performance', {
        cycleId: params.cycleId,
        departmentId: params.departmentId,
        year: params.year,
      }),
    [params.cycleId, params.departmentId, params.year],
    options,
  );
}

// 누적 달성률 + 현재 등급(달성률→등급은 백엔드 산정).
export function useMonthlyPerformanceSummary(
  params: { cycleId?: string; departmentId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<MonthlyPerformanceSummary>('/monthly-performance/summary', {
        cycleId: params.cycleId,
        departmentId: params.departmentId,
      }),
    [params.cycleId, params.departmentId],
    {
      enabled:
        !!params.cycleId && !!params.departmentId && (options.enabled ?? true),
    },
  );
}

export const monthlyPerformanceCommands = {
  // upsert(연/월/부서/카테고리 키). 백엔드가 신규/갱신 분기 — id 있으면 PATCH.
  create: (body: MonthlyPerformanceInput) =>
    apiPost<MonthlyPerformance>('/monthly-performance', body),
  update: (id: string, body: Partial<MonthlyPerformanceInput>) =>
    apiPatch<MonthlyPerformance>(`/monthly-performance/${id}`, body),
};
