'use client';

import { apiGetList, apiPost } from '@/lib/api';
import type { Appeal, AppealStatus } from '@/lib/types';
import { useAsync } from './useAsync';

export function useAppeals(
  params: { userId?: string; status?: AppealStatus } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Appeal>('/appeals', {
        userId: params.userId,
        status: params.status,
      }),
    [params.userId, params.status],
    options,
  );
}

export const appealCommands = {
  // 결과 통보 후 7일 이내만 접수.
  create: (body: { resultId: string; reason: string }) =>
    apiPost<Appeal>('/appeals', body),
  // 팀장 1차 답변.
  respond: (id: string, response: string) =>
    apiPost<Appeal>(`/appeals/${id}/respond`, { response }),
  // HR 최종 결정.
  decide: (id: string, decision: string) =>
    apiPost<Appeal>(`/appeals/${id}/decide`, { decision }),
};
