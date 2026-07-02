'use client';

// 경영실적(월별 손익) 데이터 훅.
// fetchFinancialGrid / bulkSaveFinancialGrid ↔ 계약 1:1. 봉투 unwrap은 api.ts 가 수행.
import { useAsync } from '@/hooks/useAsync';
import {
  fetchFinancialGrid,
  bulkSaveFinancialGrid,
  finalizeMonthlyPerformance,
  type FinancialGridData,
  type BulkSaveBody,
  type BulkSaveResult,
  type FinalizeMonthlyBody,
  type FinalizeMonthlyResult,
} from './api';

/** financial-grid 조회(columns[15] 그리드 렌더 소스). */
export function useFinancialGrid(
  params: { cycleId?: string; departmentId?: string; year?: number } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<FinancialGridData>(
    () =>
      fetchFinancialGrid({
        cycleId: params.cycleId!,
        departmentId: params.departmentId!,
        year: params.year!,
      }),
    [params.cycleId, params.departmentId, params.year],
    {
      enabled:
        !!params.cycleId &&
        !!params.departmentId &&
        params.year !== undefined &&
        (options.enabled ?? true),
    },
  );
}

/** 커맨드 — bulk 임시저장(draft) + finalize 최종저장. */
export const financialGridCommands = {
  bulk: (body: BulkSaveBody): Promise<BulkSaveResult> =>
    bulkSaveFinancialGrid(body),
  finalize: (body: FinalizeMonthlyBody): Promise<FinalizeMonthlyResult> =>
    finalizeMonthlyPerformance(body),
};
