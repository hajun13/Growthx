'use client';

import { apiGet, apiGetList, apiPost } from '@/lib/api';
import type {
  EvaluationResult,
  EvaluationResultDetail,
} from '@/lib/types';
import { useAsync } from './useAsync';

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
