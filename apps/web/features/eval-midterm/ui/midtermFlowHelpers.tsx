'use client';

// 중간점검 2단계 흐름(2026-07-23) 표시용 소형 헬퍼 — 상태 칩·차례 안내 문구·읽기 전용 보기.
// MidtermView 파일 상한 분리(architecture.md 파일당 ~200줄).
import { Card } from '@/components/Card';
import { ErrorState, Skeleton } from '@/components/States';
import { useMidtermDetail } from '../hooks';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import type { MidtermReview, MidtermReviewStatus } from '@/lib/types';

/** 목록 칩 라벨 — 현행 흐름 상태만 다룬다(레거시 행은 '이전 방식'으로 뭉갠다). */
const FLOW_CHIP: Partial<Record<MidtermReviewStatus, { label: string; className: string }>> = {
  pending: { label: '1차 대기', className: 'bg-muted text-muted-foreground' },
  commented: { label: '본인 수정 대기', className: 'bg-warning-100 text-warning-700' },
  returned: { label: '반려 · 재수정 대기', className: 'bg-warning-100 text-warning-700' },
  revised: { label: '2차 검토 대기', className: 'bg-info-100 text-info-700' },
  closed: { label: '마감', className: 'bg-success-100 text-success-700' },
};

export function FlowStatusChip({ status }: { status: MidtermReviewStatus }) {
  const chip = FLOW_CHIP[status] ?? {
    label: '이전 방식',
    className: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

/** 좌측 목록 상태 필터 키 — 화면-로컬 UI 상태(URL·스토리지에 저장하지 않는다). */
export type ReviewerQueueFilter = 'all' | 'mine' | 'inprog' | 'done';

/**
 * "내 차례" 판정 — 검토 건의 상태와 **내 자리(배정)** 가 맞아떨어져 지금 처리할 수 있는지.
 *   pending + 내가 1차 검토자 → 코멘트 차례 / revised + 내가 2차 검토자 → 판정 차례
 * ⚠ 계정 role 로 판정하지 않는다 — 부서장은 Department.headUserId 로 지정되므로 role 이
 *   employee 인 부서장이 실제로 존재한다. ReviewerQueue.panelFor 의 라우팅 조건과 동일하게
 *   두어, 이 판정으로 고른 건은 언제나 그 자리에 맞는 쓰기 패널로만 열린다(1차가 판정 화면에,
 *   2차가 코멘트 화면에 도달하는 경로를 만들지 않는다).
 */
export function isReviewerTurn(review: MidtermReview, meId: string): boolean {
  if (review.status === 'pending') return review.firstReviewerId === meId;
  if (review.status === 'revised') return review.finalReviewerId === meId;
  return false;
}

/** 끝난 것으로 볼 상태 — 현행 흐름의 closed + 레거시 종결 행(이전 방식 아카이브). */
const DONE_STATUSES = new Set<MidtermReviewStatus>(['closed', 'confirmed']);

/**
 * 목록 필터 판정. 진행 중 = 아직 끝나지 않았고 내 차례도 아닌 건(= 다른 사람 처리 대기).
 * 세 갈래가 겹치지 않게 나눠, 칩을 옮겨 다녀도 같은 건이 두 번 세지지 않는다.
 */
export function matchesQueueFilter(
  review: MidtermReview,
  meId: string,
  filter: ReviewerQueueFilter,
): boolean {
  switch (filter) {
    case 'mine':
      return isReviewerTurn(review, meId);
    case 'done':
      return DONE_STATUSES.has(review.status);
    case 'inprog':
      return !DONE_STATUSES.has(review.status) && !isReviewerTurn(review, meId);
    default:
      return true;
  }
}

/** 검토자 관점 — 지금 누구 차례인지 한 줄로. */
export function reviewerTurnLine(review: MidtermReview): string {
  switch (review.status) {
    case 'pending':
      return '1차 검토자(부서장)의 코멘트를 기다리고 있어요.';
    case 'commented':
    case 'returned':
      return `${review.evaluateeName ?? '대상자'} 님의 목표 수정 제출을 기다리고 있어요.`;
    case 'revised':
      return '2차 검토자(그룹대표)의 최종 판정을 기다리고 있어요.';
    case 'closed':
      return '최종 승인되어 마감됐어요.';
    default:
      return '이전 방식으로 진행된 점검이에요 — 진행 이력만 확인할 수 있어요.';
  }
}

/** 피평가자 관점 — 내 중간점검이 지금 어느 단계인지. */
export function memberTurnLine(review: MidtermReview): string {
  switch (review.status) {
    case 'pending':
      return '부서장이 상반기 진척을 검토하고 있어요. 코멘트가 등록되면 수정할 수 있어요.';
    // 내 차례지만 중간점검 기간이 아니라 읽기 전용으로 내려온 경우.
    case 'commented':
      return '부서장 코멘트가 등록됐어요. 중간점검 기간에 목표를 수정해 제출할 수 있어요.';
    case 'returned':
      return '그룹대표가 반려했어요. 중간점검 기간에 다시 수정해 제출할 수 있어요.';
    case 'revised':
      return '수정 내용을 제출했어요. 그룹대표의 최종 검토를 기다리고 있어요.';
    case 'closed':
      return '중간점검이 마감됐어요.';
    default:
      return '이전 방식으로 진행된 점검이에요 — 진행 이력만 확인할 수 있어요.';
  }
}

/**
 * 읽기 전용 보기 — 차례가 아니거나 기간이 아닐 때. 쓰기 액션을 일절 렌더하지 않는다.
 * 상세(이력)는 여기서 조회한다 — 호출부가 reviewId 로 key 를 주어 대상 전환 시 리마운트되게 한다
 * (이전 대상의 이력이 잠시 남는 것 방지).
 */
export function MidtermReadOnlyView({
  reviewId,
  turnLine,
}: {
  reviewId: string;
  turnLine: string;
}) {
  const detail = useMidtermDetail(reviewId);
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-muted-foreground">{turnLine}</p>
      </Card>

      {detail.data?.firstComment && (
        <Card>
          <h4 className="text-sm font-semibold text-foreground">부서장 총평</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {detail.data.firstComment}
          </p>
        </Card>
      )}

      {detail.loading && !detail.data ? (
        <Skeleton className="h-40 w-full" />
      ) : detail.error ? (
        <ErrorState onRetry={detail.reload} />
      ) : detail.data ? (
        <MidtermTrailTimeline entries={detail.data.trail} />
      ) : null}
    </div>
  );
}
