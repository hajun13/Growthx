'use client';

import {
  apiGet,
  apiGetList,
  apiPost,
  apiPatch,
  apiDelete,
  apiUpload,
  apiDownloadBlob,
} from '@/lib/api';
import type {
  Evaluation,
  EvaluationDetail,
  EvaluationEvidence,
  EvalType,
  EvalStatus,
  Comment,
  GradeDistributionRow,
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
  /**
   * 부서장 평가 자동 배정(HR). reset=true 면 스마트 재배정 —
   * 아직 시작 안 한 배정을 초기화하고 현재 권한 기준으로 다시 계산(진행중·제출은 보존).
   */
  autoAssignDownward: (cycleId: string, reset = false) =>
    apiPost<{ created: number; skipped: number; evaluatees: number; deleted: number }>(
      '/evaluations/auto-assign',
      { cycleId, reset },
    ),
};

// 평가 문항별 증빙 첨부 목록(메타데이터). 본인평가 화면에서 kpiId별로 묶어 표시.
export function useEvaluationEvidence(
  evaluationId: string | null,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () => apiGetList<EvaluationEvidence>(`/evaluations/${evaluationId}/evidence`),
    [evaluationId],
    { enabled: !!evaluationId && (options.enabled ?? true) },
  );
}

export const evidenceCommands = {
  // multipart 업로드 — field: file, query: kpiId.
  upload: (evaluationId: string, kpiId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<EvaluationEvidence>(
      `/evaluations/${evaluationId}/evidence`,
      form,
      { kpiId },
    );
  },
  remove: (evaluationId: string, evidenceId: string) =>
    apiDelete<{ id: string; deleted: boolean }>(
      `/evaluations/${evaluationId}/evidence/${evidenceId}`,
    ),
};

// 증빙 파일을 인증 헤더로 받아 새 탭으로 연다(Bearer 토큰이라 단순 링크로는 불가).
export async function openEvidence(
  evaluationId: string,
  evidenceId: string,
): Promise<void> {
  const blob = await apiDownloadBlob(
    `/evaluations/${evaluationId}/evidence/${evidenceId}/download`,
  );
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // 새 탭이 로드된 뒤 해제(즉시 revoke 시 일부 브라우저에서 빈 탭).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// 부서별 등급 현황 — 그룹실적/등급풀 화면 하단 테이블.
export function useGradeDistribution(
  params: { cycleId?: string; groupId?: string },
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<GradeDistributionRow>('/evaluations/grade-distribution', {
        cycleId: params.cycleId,
        groupId: params.groupId,
      }),
    [params.cycleId, params.groupId],
    options,
  );
}
