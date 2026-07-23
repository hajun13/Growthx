/**
 * eval-midterm feature — 데이터 계층(6월 중간점검: 진척·자가점검·보완조치).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * (목록 봉투는 { data: T[], meta? } → 여기선 { data, meta } 형태로 그대로 넘겨 기존 훅 소비부와 동일 shape 유지.)
 *
 * 반환 타입은 앱 도메인 타입(@/lib/types)으로 노출한다 — 소비 컴포넌트(이동된 ui/*)가 그대로 컴파일되도록.
 * 생성 DTO 와 lib/types 는 구조 동일(필드·리터럴 일치)이므로 경계에서 캐스팅한다.
 */
import {
  midtermControllerGetProgress,
  midtermControllerListReviews,
  midtermControllerSubmitSelf,
  midtermControllerConfirm,
  midtermControllerDetail,
  midtermControllerComment,
  midtermControllerSaveRevisionDraft,
  midtermControllerSubmitRevision,
  midtermControllerApprove,
  midtermControllerReturnToMember,
  midtermControllerOpen,
  midtermControllerReassign,
  kpisControllerApprovalChain,
  actionItemsControllerList,
  actionItemsControllerGetOne,
  actionItemsControllerCreate,
  actionItemsControllerUpdate,
  actionItemsControllerTransition,
  ApiError as ContractsApiError,
} from '@growthx/contracts';
import { ApiError, apiPost } from '@/lib/api';
import type {
  KpiApprovalStage,
  MidtermProgress,
  MidtermReview,
  MidtermDetail,
  MidtermRevisionItem,
  ActionItem,
  ActionItemStatus,
  SubmitMidtermSelfReviewRequest,
  ConfirmMidtermReviewRequest,
  SendBackMidtermReviewRequest,
  CreateActionItemRequest,
  UpdateActionItemRequest,
  TransitionActionItemRequest,
} from '@/lib/types';

// 목록 봉투 shape(기존 useAsync 소비부가 res?.data / res?.meta 로 접근).
export interface ListEnvelope<T> {
  data: T[];
  meta?: { page?: number; pageSize?: number; total?: number };
}

/**
 * 생성 클라이언트(customFetch)는 contracts runtime 의 ApiError 를 throw 한다.
 * 이동된 ui/* 컴포넌트는 `@/lib/api` 의 ApiError 로 `instanceof`·`err.code`(예: INVALID_STATE_TRANSITION)
 * 분기를 한다 — 두 클래스는 형태(code/status/message)는 같으나 별개라 instanceof 가 어긋난다.
 * 그래서 경계에서 `@/lib/api` ApiError 로 변환해 다시 throw, 컴포넌트 에러 분기를 보존한다.
 */
async function translateErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ContractsApiError) {
      throw new ApiError(e.status, {
        code: e.code,
        message: e.message,
        details: e.details,
      });
    }
    throw e;
  }
}

// ── 진척(단건 봉투) ──
export async function fetchMidtermProgress(params: {
  cycleId?: string;
  userId?: string;
}): Promise<MidtermProgress> {
  return translateErrors(async () => {
    // cycleId 는 호출측(hook)이 enabled 가드로 보장. 생성 param 은 cycleId 필수라 캐스팅.
    const res = await midtermControllerGetProgress({
      cycleId: params.cycleId,
      userId: params.userId,
    } as never);
    return res.data.data as unknown as MidtermProgress;
  });
}

// ── 자가점검/부서장 확인 목록(목록 봉투) ──
export async function fetchMidtermReviews(params: {
  cycleId?: string;
  evaluateeId?: string;
}): Promise<ListEnvelope<MidtermReview>> {
  return translateErrors(async () => {
    const res = await midtermControllerListReviews({
      cycleId: params.cycleId,
      evaluateeId: params.evaluateeId,
    } as never);
    const body = res.data;
    return {
      data: (body.data ?? []) as unknown as MidtermReview[],
      meta: body.meta,
    };
  });
}

// 본인 자가점검 제출(upsert → self_done).
export async function submitMidtermSelf(
  body: SubmitMidtermSelfReviewRequest,
): Promise<MidtermReview | null> {
  return translateErrors(async () => {
    const res = await midtermControllerSubmitSelf(body as never);
    // 200 → { data }, 201 → void
    const payload = res.data as { data?: MidtermReview } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// 부서장 확인 → confirmed.
export async function confirmMidtermReview(
  id: string,
  body: ConfirmMidtermReviewRequest,
): Promise<MidtermReview> {
  return translateErrors(async () => {
    const res = await midtermControllerConfirm(id, body as never);
    return res.data.data as unknown as MidtermReview;
  });
}

// 수정요청 → revision_requested. reviewerNote 필수(사유).
// 백엔드 엔드포인트 구현됨; orval codegen 재생성 전까지 lib/api.ts 수동 래퍼 사용.
export async function requestRevisionMidterm(
  id: string,
  body: SendBackMidtermReviewRequest,
): Promise<MidtermReview> {
  return apiPost<MidtermReview>(`/midterm/reviews/${id}/request-revision`, body);
}

// 반려 → rejected. reviewerNote 필수(사유).
export async function rejectMidterm(
  id: string,
  body: SendBackMidtermReviewRequest,
): Promise<MidtermReview> {
  return apiPost<MidtermReview>(`/midterm/reviews/${id}/reject`, body);
}

// ── 중간점검 2단계 흐름(2026-07-23) — 부서장(1차) 코멘트 → 본인 회신 → 그룹대표(최종) 승인/반려 ──
// 위 submitMidtermSelf/confirmMidtermReview(자가점검·단일 확인)와 별개 리소스.

export async function fetchMidtermDetail(id: string): Promise<MidtermDetail> {
  return translateErrors(async () => {
    const res = await midtermControllerDetail(id);
    return res.data.data as unknown as MidtermDetail;
  });
}

// 1차(부서장) 코멘트: 총평 + KPI별 판정(수용/재조정 필요).
// NestJS POST 기본 상태코드가 201 이라 orval 응답 타입이 200(data)|201(void) 유니언 →
// submitMidtermSelf 와 동일하게 런타임에서 payload 를 분기(실제 바디엔 항상 data 가 온다).
export async function commentMidterm(
  id: string,
  body: {
    overallComment?: string;
    kpiComments?: Array<{ kpiId: string; note?: string; decision?: 'accepted' | 'rebaseline' }>;
  },
): Promise<MidtermDetail | null> {
  return translateErrors(async () => {
    const res = await midtermControllerComment(id, body as never);
    const payload = res.data as { data?: MidtermDetail } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// 본인 회신 임시저장(제출 아님) — 상태는 그대로 두고 작업본만 서버에 보관한다.
// PUT 이라 orval 응답은 200 단일(제출과 달리 201(void) 유니언이 없다).
export async function saveMidtermRevisionDraft(
  id: string,
  body: { items?: MidtermRevisionItem[]; memberNote?: string },
): Promise<MidtermDetail> {
  return translateErrors(async () => {
    const res = await midtermControllerSaveRevisionDraft(id, body as never);
    return res.data.data as unknown as MidtermDetail;
  });
}

// 본인 회신: KPI 목표(수치/서술/가중치) 수정 제출 → revised.
export async function submitMidtermRevision(
  id: string,
  body: { items?: MidtermRevisionItem[]; memberNote?: string },
): Promise<MidtermDetail | null> {
  return translateErrors(async () => {
    const res = await midtermControllerSubmitRevision(id, body as never);
    const payload = res.data as { data?: MidtermDetail } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// 최종(그룹대표) 승인 → closed.
export async function approveMidterm(id: string, comment?: string): Promise<MidtermDetail | null> {
  return translateErrors(async () => {
    const res = await midtermControllerApprove(id, { comment } as never);
    const payload = res.data as { data?: MidtermDetail } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// 최종(그룹대표) 반려 → 본인 재작성(returned). comment 사유 필수.
export async function returnMidterm(id: string, comment: string): Promise<MidtermDetail | null> {
  return translateErrors(async () => {
    const res = await midtermControllerReturnToMember(id, { comment } as never);
    const payload = res.data as { data?: MidtermDetail } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// ── HR 개시·재배정(2026-07-23) ──
// 사이클 전체 대상 일괄 작업 — 미리보기(dryRun)/실개시, 평가자 재배정.

export interface MidtermOpenTarget {
  userId: string;
  firstReviewerId: string;
  finalReviewerId: string;
}

export interface MidtermOpenWarning {
  userId: string;
  name: string;
  reason: string;
}

export interface MidtermOpenResult {
  targets: MidtermOpenTarget[];
  warnings: MidtermOpenWarning[];
  /**
   * 이번 개시로 실제로 만들어지거나(신규) 초기화되는(이전 방식 잔재) 건수.
   * 미리보기(dryRun)에서도 같은 계획으로 계산돼 실행 결과와 어긋나지 않는다.
   */
  created: number;
  /** 이미 개시돼 있어 손대지 않는 건수(재개시해도 그대로 유지). */
  skipped?: number;
}

export interface MidtermReassignResult {
  scanned: number;
  changed: number;
}

// 사이클 전체 개시(dryRun=true 면 생성 없이 대상·경고만 반환).
export async function openMidtermReviews(
  cycleId: string,
  dryRun: boolean,
): Promise<MidtermOpenResult | null> {
  return translateErrors(async () => {
    const res = await midtermControllerOpen({ cycleId, dryRun } as never);
    const payload = res.data as { data?: MidtermOpenResult } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// 진행 중(closed 아닌) 리뷰의 평가자를 조직 변경사항 기준으로 재배정.
export async function reassignMidtermReviewers(
  cycleId: string,
): Promise<MidtermReassignResult | null> {
  return translateErrors(async () => {
    const res = await midtermControllerReassign({ cycleId } as never);
    const payload = res.data as { data?: MidtermReassignResult } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

// ── 보완 조치 목록(목록 봉투) ──
export async function fetchActionItems(params: {
  cycleId?: string;
  evaluateeId?: string;
  assigneeId?: string;
  status?: ActionItemStatus;
}): Promise<ListEnvelope<ActionItem>> {
  return translateErrors(async () => {
    const res = await actionItemsControllerList({
      cycleId: params.cycleId,
      evaluateeId: params.evaluateeId,
      assigneeId: params.assigneeId,
      status: params.status,
    } as never);
    const body = res.data;
    return {
      data: (body.data ?? []) as unknown as ActionItem[],
      meta: body.meta,
    };
  });
}

export async function fetchActionItem(id: string): Promise<ActionItem> {
  return translateErrors(async () => {
    const res = await actionItemsControllerGetOne(id);
    return res.data.data as unknown as ActionItem;
  });
}

export async function createActionItem(
  body: CreateActionItemRequest,
): Promise<ActionItem | null> {
  return translateErrors(async () => {
    const res = await actionItemsControllerCreate(body as never);
    const payload = res.data as { data?: ActionItem } | void;
    return (payload && 'data' in payload ? payload.data : null) ?? null;
  });
}

export async function updateActionItem(
  id: string,
  body: UpdateActionItemRequest,
): Promise<ActionItem> {
  return translateErrors(async () => {
    const res = await actionItemsControllerUpdate(id, body as never);
    return res.data.data as unknown as ActionItem;
  });
}

export async function transitionActionItem(
  id: string,
  body: TransitionActionItemRequest,
): Promise<ActionItem> {
  return translateErrors(async () => {
    const res = await actionItemsControllerTransition(id, body as never);
    return res.data.data as unknown as ActionItem;
  });
}

/** 피평가자의 순차 확인 결재선(KPI 결재선과 동일 원천 — 1차 팀장→2차 본부장→최종 그룹대표). */
export async function fetchReviewChain(userId: string): Promise<KpiApprovalStage[]> {
  return translateErrors(async () => {
    const res = await kpisControllerApprovalChain(userId);
    const data = res.data.data as unknown as { stages: KpiApprovalStage[] };
    return data?.stages ?? [];
  });
}
