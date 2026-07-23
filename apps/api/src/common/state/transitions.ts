import {
  ActionItemStatus,
  AppealStatus,
  CycleStatus,
  EvaluationStatus,
  KpiStatus,
  MidtermReviewStatus,
  RebaselineRequestStatus,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';

/**
 * 상태 전이 명시 맵 (domain-model §5). 허용 외 전이는 거부.
 * 죽은 전이/무단 전이 금지.
 */

export const CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  draft: [CycleStatus.active],
  active: [CycleStatus.mid_review],
  mid_review: [CycleStatus.calibration],
  calibration: [CycleStatus.closed],
  closed: [],
};

// 순차 결재선(2026-07-07): 체인=1차 팀장→2차 본부장→최종 그룹대표(압축, Kpi.approvalStage 로 단계 추적).
export const KPI_TRANSITIONS: Record<KpiStatus, KpiStatus[]> = {
  draft: [KpiStatus.submitted],
  // 1차 승인(다음 단계 대기) | 단일 단계 체인 즉시 확정 | 반려
  submitted: [KpiStatus.approved, KpiStatus.confirmed, KpiStatus.draft],
  // 중간 단계 승인(self) | 최종 승인 | 상위 단계 반려
  approved: [KpiStatus.approved, KpiStatus.confirmed, KpiStatus.draft],
  // 전 단계 결재 완료. 되돌림은 hr_admin 전용(서비스 가드).
  confirmed: [KpiStatus.draft],
};

export const EVALUATION_TRANSITIONS: Record<EvaluationStatus, EvaluationStatus[]> = {
  not_started: [EvaluationStatus.in_progress],
  in_progress: [EvaluationStatus.submitted],
  submitted: [
    EvaluationStatus.finalized,
    EvaluationStatus.revision_requested,
    EvaluationStatus.rejected,
  ],
  revision_requested: [EvaluationStatus.in_progress], // 피평가자/하위 재작성
  rejected: [EvaluationStatus.in_progress], // 재작성
  finalized: [],
};

export const APPEAL_TRANSITIONS: Record<AppealStatus, AppealStatus[]> = {
  submitted: [AppealStatus.under_review],
  under_review: [AppealStatus.answered],
  answered: [AppealStatus.closed],
  closed: [],
};

// 6월 중간평가 보완 조치(ActionItem). 진행은 양방향(되돌리기 허용),
// canceled 는 종료(planned/in_progress 에서만). done 은 완료 후 다시 진행으로 재개 가능.
export const ACTION_ITEM_TRANSITIONS: Record<ActionItemStatus, ActionItemStatus[]> = {
  planned: [ActionItemStatus.in_progress, ActionItemStatus.done, ActionItemStatus.canceled],
  in_progress: [ActionItemStatus.done, ActionItemStatus.planned, ActionItemStatus.canceled],
  done: [ActionItemStatus.in_progress], // 완료 취소(재개)
  canceled: [ActionItemStatus.planned], // 취소 철회(재개)
};

// ④ 중간 KPI 목표 재조정 요청. 본인 제안 → 부서장 검토.
// submitted → approved(승인·반영, 종단) | rejected(반려).
// rejected → submitted(본인 수정 후 재제출). approved 는 종단(되돌리기 없음).
export const REBASELINE_REQUEST_TRANSITIONS: Record<
  RebaselineRequestStatus,
  RebaselineRequestStatus[]
> = {
  submitted: [RebaselineRequestStatus.approved, RebaselineRequestStatus.rejected],
  rejected: [RebaselineRequestStatus.submitted], // 본인 수정·재제출
  approved: [], // 종단
};

// 중간점검(2026-07-23 재편): 신규 2단계 흐름 + 레거시 자가점검 흐름 공존.
export const MIDTERM_REVIEW_TRANSITIONS: Record<MidtermReviewStatus, MidtermReviewStatus[]> = {
  // 신규: 1차 코멘트. (self_done 은 레거시 자가점검 제출 호환)
  pending: [MidtermReviewStatus.commented, MidtermReviewStatus.self_done],
  commented: [MidtermReviewStatus.revised],
  revised: [MidtermReviewStatus.returned, MidtermReviewStatus.closed],
  returned: [MidtermReviewStatus.revised],
  // HR reopen 전용 — 역할 검증은 서비스(evaluateMidtermTurn)에서.
  closed: [MidtermReviewStatus.revised],
  // ── 레거시 ──
  self_done: [
    MidtermReviewStatus.confirmed,
    MidtermReviewStatus.revision_requested,
    MidtermReviewStatus.rejected,
  ],
  confirmed: [MidtermReviewStatus.revision_requested],
  revision_requested: [MidtermReviewStatus.self_done],
  rejected: [MidtermReviewStatus.self_done],
};

export function assertTransition<T extends string>(
  map: Record<string, T[]>,
  from: T,
  to: T,
): void {
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictException({
      code: 'INVALID_STATE_TRANSITION',
      message: `'${from}' → '${to}' 전이는 허용되지 않아요.`,
    });
  }
}
