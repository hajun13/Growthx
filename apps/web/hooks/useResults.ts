'use client';

import { apiGet, apiGetList, apiPost } from '@/lib/api';
import type {
  EvaluationResult,
  EvaluationResultDetail,
  EvaluationSummaryRow,
} from '@/lib/types';
import { useAsync } from './useAsync';

// GET /results/summary?cycleId= — 평가자정리 표(다단계 × 실적/역량 + 합산 + 최종).
export function useEvaluationSummary(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () => apiGetList<EvaluationSummaryRow>('/results/summary', { cycleId }),
    [cycleId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}

export function useResults(
  params: { cycleId?: string; userId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<EvaluationResult>('/results', {
        cycleId: params.cycleId,
        userId: params.userId,
      }),
    [params.cycleId, params.userId],
    options,
  );
}

// GET /results/:userId?cycleId=... — self/d1/d2 유형별 비교 상세
export function useResultDetail(
  userId: string | null,
  cycleId: string | null,
) {
  return useAsync(
    () =>
      apiGet<EvaluationResultDetail>(`/results/${userId}`, { cycleId }),
    [userId, cycleId],
    { enabled: !!userId && !!cycleId },
  );
}

export const resultCommands = {
  aggregate: (body: { cycleId: string; userId: string }) =>
    apiPost<EvaluationResultDetail>('/results/aggregate', body),
};
