'use client';

/**
 * eval-midterm feature — 데이터 훅.
 * @growthx/contracts 생성 클라이언트 기반(api.ts). 봉투 unwrap 은 api.ts 한 곳.
 * 기존 @/hooks/useMidterm 의 진척·리뷰·보완조치 훅과 동일 시그니처를 제공해
 * 이동된 ui/* 컴포넌트가 데이터 소스만 바꿔 그대로 동작하게 한다.
 *
 * ⚠ 재조정(rebaseline) 훅·커맨드는 이 슬라이스 범위 밖(배정 함수 목록 외) →
 *    ui/* 의 재조정 컴포넌트는 @/hooks/useMidterm 의 rebaseline 부분을 계속 사용한다.
 */
import { useAsync } from '@/hooks/useAsync';
import {
  fetchMidtermProgress,
  fetchMidtermReviews,
  submitMidtermSelf,
  confirmMidtermReview,
  fetchActionItems,
  createActionItem,
  updateActionItem,
  transitionActionItem,
} from './api';
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
} from '@/lib/types';
import type { ListEnvelope } from './api';

// GET /midterm/progress — KPI별 진척 + 조직 진척(단건 봉투).
export function useMidtermProgress(
  params: { cycleId?: string | null; userId?: string | null } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<MidtermProgress>(
    () =>
      fetchMidtermProgress({
        cycleId: params.cycleId ?? undefined,
        userId: params.userId ?? undefined,
      }),
    [params.cycleId, params.userId],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

// GET /midterm/reviews — 자가점검/부서장 확인 목록(목록 봉투).
export function useMidtermReviews(
  params: { cycleId?: string | null; evaluateeId?: string | null } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<ListEnvelope<MidtermReview>>(
    () =>
      fetchMidtermReviews({
        cycleId: params.cycleId ?? undefined,
        evaluateeId: params.evaluateeId ?? undefined,
      }),
    [params.cycleId, params.evaluateeId],
    { enabled: !!params.cycleId && (options.enabled ?? true) },
  );
}

export const midtermReviewCommands = {
  // 본인 자가점검 제출(upsert → self_done). evaluatee=현재 사용자(서버 강제).
  submitSelf: (body: SubmitMidtermSelfReviewRequest) => submitMidtermSelf(body),
  // 부서장 확인(상위 장/HR) → confirmed.
  confirm: (id: string, body: ConfirmMidtermReviewRequest) =>
    confirmMidtermReview(id, body),
};

// GET /action-items — 보완 조치 목록(목록 봉투).
export function useActionItems(
  params: {
    cycleId?: string | null;
    evaluateeId?: string | null;
    assigneeId?: string | null;
    status?: ActionItemStatus;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync<ListEnvelope<ActionItem>>(
    () =>
      fetchActionItems({
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
  create: (body: CreateActionItemRequest) => createActionItem(body),
  update: (id: string, body: UpdateActionItemRequest) => updateActionItem(id, body),
  // 상태 전이(planned→in_progress→done, +canceled). done 시 completionNote.
  transition: (id: string, body: TransitionActionItemRequest) =>
    transitionActionItem(id, body),
};
