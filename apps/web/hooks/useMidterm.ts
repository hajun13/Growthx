'use client';

// 6월 중간평가 · 피드백 보완 조치 데이터 훅.
// API: contract-midterm.md §2·3·4·7. 봉투({data}/{data,meta})는 api.ts 가 unwrap.
// 타입은 lib/types.ts 의 계약 1:1 타입 사용(추측 캐스팅 금지).
// ④ 재조정: 2026-06-08 재설계 — 구 apply(POST /midterm/rebaseline) 제거,
//   새 제안→검토→승인 워크플로우(POST/GET/PATCH /midterm/rebaseline-requests) 추가.

import { apiGet, apiGetList, apiPost, apiPatch } from '@/lib/api';
import type {
  MidtermProgress,
  MidtermReview,
  ActionItem,
  ActionItemStatus,
  SubmitMidtermSelfReviewRequest,
  ConfirmMidtermReviewRequest,
  CreateActionItemRequest,
  UpdateActionItemRequest,
  TransitionActionItemRequest,
  RebaselineHistoryEntry,
  RebaselineRequestView,
  RebaselineRequestDetail,
  CreateRebaselineRequestBody,
  UpdateRebaselineRequestBody,
  ReviewRebaselineRequestBody,
} from '@/lib/types';
import { useAsync } from './useAsync';

// GET /midterm/progress?cycleId=&userId= — KPI별 진척 + 조직 진척(단건 봉투).
export function useMidtermProgress(
  params: { cycleId?: string | null; userId?: string | null } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGet<MidtermProgress>('/midterm/progress', {
        cycleId: params.cycleId ?? undefined,
        userId: params.userId ?? undefined,
      }),
    [params.cycleId, params.userId],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

// GET /midterm/reviews?cycleId=&evaluateeId= — 자가점검/부서장 확인 목록(목록 봉투).
export function useMidtermReviews(
  params: { cycleId?: string | null; evaluateeId?: string | null } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<MidtermReview>('/midterm/reviews', {
        cycleId: params.cycleId ?? undefined,
        evaluateeId: params.evaluateeId ?? undefined,
      }),
    [params.cycleId, params.evaluateeId],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

export const midtermReviewCommands = {
  // 본인 자가점검 제출(upsert → self_done). evaluatee=현재 사용자(서버 강제).
  submitSelf: (body: SubmitMidtermSelfReviewRequest) =>
    apiPost<MidtermReview>('/midterm/reviews', body),
  // 부서장 확인(상위 장/HR) → confirmed.
  confirm: (id: string, body: ConfirmMidtermReviewRequest) =>
    apiPatch<MidtermReview>(`/midterm/reviews/${id}/confirm`, body),
};

// GET /action-items?cycleId=&evaluateeId=&assigneeId=&status= — 보완 조치 목록(목록 봉투).
export function useActionItems(
  params: {
    cycleId?: string | null;
    evaluateeId?: string | null;
    assigneeId?: string | null;
    status?: ActionItemStatus;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<ActionItem>('/action-items', {
        cycleId: params.cycleId ?? undefined,
        evaluateeId: params.evaluateeId ?? undefined,
        assigneeId: params.assigneeId ?? undefined,
        status: params.status,
      }),
    [params.cycleId, params.evaluateeId, params.assigneeId, params.status],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

export const actionItemCommands = {
  create: (body: CreateActionItemRequest) =>
    apiPost<ActionItem>('/action-items', body),
  update: (id: string, body: UpdateActionItemRequest) =>
    apiPatch<ActionItem>(`/action-items/${id}`, body),
  // 상태 전이(planned→in_progress→done, +canceled). done 시 completionNote.
  transition: (id: string, body: TransitionActionItemRequest) =>
    apiPatch<ActionItem>(`/action-items/${id}/status`, body),
};

// ── 중간 KPI 목표 재조정 워크플로우(④) — contract-midterm.md §7 재설계 2026-06-08 ──
// 구 POST /midterm/rebaseline(즉시 적용) + rebaselineCommands.apply 는 폐기됨.

// GET /midterm/rebaseline-requests?cycleId=&evaluateeId?=&status?=&forReview?= — 목록(목록 봉투).
// forReview=true → 부서장 검토 큐(내가 부서장인 구성원의 미결(submitted) 요청).
export function useRebaselineRequests(
  params: {
    cycleId?: string | null;
    evaluateeId?: string | null;
    status?: string | null;
    forReview?: boolean;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<RebaselineRequestView>('/midterm/rebaseline-requests', {
        cycleId: params.cycleId ?? undefined,
        evaluateeId: params.evaluateeId ?? undefined,
        status: params.status ?? undefined,
        forReview: params.forReview ? '1' : undefined,
      }),
    [params.cycleId, params.evaluateeId, params.status, params.forReview],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

// GET /midterm/rebaseline-requests/:id — 상세(proposedChanges·currentKpis·projectedWeightSum 포함).
export function useRebaselineRequestDetail(
  id: string | null,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () => apiGet<RebaselineRequestDetail>(`/midterm/rebaseline-requests/${id!}`),
    [id],
    { enabled: !!id && (options.enabled ?? true) },
  );
}

export const rebaselineRequestCommands = {
  // POST /midterm/rebaseline-requests — 본인 제안 제출.
  // evaluateeId 는 서버가 current.id 로 강제(body 불필요).
  create: (body: CreateRebaselineRequestBody) =>
    apiPost<RebaselineRequestDetail>('/midterm/rebaseline-requests', body),

  // PATCH /midterm/rebaseline-requests/:id — 본인 수정·재제출(rejected→submitted).
  update: (id: string, body: UpdateRebaselineRequestBody) =>
    apiPatch<RebaselineRequestDetail>(`/midterm/rebaseline-requests/${id}`, body),

  // PATCH /midterm/rebaseline-requests/:id/review — 부서장 검토(approve|reject).
  review: (id: string, body: ReviewRebaselineRequestBody) =>
    apiPatch<RebaselineRequestDetail>(`/midterm/rebaseline-requests/${id}/review`, body),
};

// GET /midterm/rebaseline/history?cycleId=&evaluateeId= — 전/후 diff + 사유·변경자·시각 타임라인(목록 봉투).
// 백엔드 전용 엔드포인트가 사유·변경자를 직접 반환(제네릭 KpiSnapshot diff 훅 대신 이 훅 사용).
// 승인 반영분만 포함(approved 시점에 스냅샷 캡처).
export function useRebaselineHistory(
  params: { cycleId?: string | null; evaluateeId?: string | null } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<RebaselineHistoryEntry>('/midterm/rebaseline/history', {
        cycleId: params.cycleId ?? undefined,
        evaluateeId: params.evaluateeId ?? undefined,
      }),
    [params.cycleId, params.evaluateeId],
    {
      enabled:
        !!params.cycleId &&
        !!params.evaluateeId &&
        (options.enabled ?? true),
    },
  );
}
