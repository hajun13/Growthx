'use client';

/**
 * eval-dept-head feature — 데이터 훅.
 * api.ts(생성 클라이언트 + 봉투 unwrap)를 useAsync 로 감싼다.
 * 반환 shape 는 기존 페이지 소비 형태를 그대로 유지한다(목록은 { data }, 상세는 도메인 객체)
 * — 시각/동작 보존을 위해 호출부 접근 패턴(evals?.data, detail?.kpiScores 등)을 바꾸지 않는다.
 */
import { useAsync } from '@/hooks/useAsync';
import type {
  Evaluation,
  EvaluationDetail,
  EvaluationEvidence,
  EvalType,
  EvalStatus,
} from '@/lib/types';
import {
  fetchEvaluations,
  fetchEvaluationDetail,
  fetchEvaluationEvidence,
} from './api';

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
  return useAsync<{ data: Evaluation[] }>(
    async () => ({ data: await fetchEvaluations(params) }),
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
  return useAsync<EvaluationDetail>(
    () => fetchEvaluationDetail(evaluationId as string),
    [evaluationId],
    { enabled: !!evaluationId },
  );
}

export function useEvaluationEvidence(
  evaluationId: string | null,
  options: { enabled?: boolean } = {},
) {
  return useAsync<{ data: EvaluationEvidence[] }>(
    async () => ({ data: await fetchEvaluationEvidence(evaluationId as string) }),
    [evaluationId],
    { enabled: !!evaluationId && (options.enabled ?? true) },
  );
}
