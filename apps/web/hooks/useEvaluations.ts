'use client';

import { apiGet, apiGetList, apiPost, apiPatch } from '@/lib/api';
import type {
  Evaluation,
  EvaluationDetail,
  EvalType,
  EvalStatus,
  Comment,
  PatchEvaluationRequest,
} from '@/lib/types';
import { useAsync } from './useAsync';

export function useEvaluations(
  params: {
    cycleId?: string;
    evaluatorId?: string;
    evaluateeId?: string;
    type?: EvalType;
    status?: EvalStatus;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Evaluation>('/evaluations', {
        cycleId: params.cycleId,
        evaluatorId: params.evaluatorId,
        evaluateeId: params.evaluateeId,
        type: params.type,
        status: params.status,
      }),
    [
      params.cycleId,
      params.evaluatorId,
      params.evaluateeId,
      params.type,
      params.status,
    ],
    options,
  );
}

export function useEvaluationDetail(evaluationId: string | null) {
  return useAsync(
    () => apiGet<EvaluationDetail>(`/evaluations/${evaluationId}`),
    [evaluationId],
    { enabled: !!evaluationId },
  );
}

export const evaluationCommands = {
  // downward 는 round(1=팀장·2=본부장) 필수.
  create: (body: {
    cycleId: string;
    evaluateeId: string;
    type: EvalType;
    round?: number;
  }) => apiPost<Evaluation>('/evaluations', body),
  patch: (id: string, body: PatchEvaluationRequest) =>
    apiPatch<EvaluationDetail>(`/evaluations/${id}`, body),
  addComment: (id: string, body: { quarter: number; content: string }) =>
    apiPost<Comment>(`/evaluations/${id}/comment`, body),
  submit: (id: string) => apiPost<Evaluation>(`/evaluations/${id}/submit`),
  finalize: (id: string) => apiPost<Evaluation>(`/evaluations/${id}/finalize`),
};
