'use client';

// 중간점검 2단계 흐름(2026-07-23) 표시용 소형 헬퍼 — 상태 칩·차례 안내 문구·읽기 전용 보기.
// MidtermView 파일 상한 분리(architecture.md 파일당 ~200줄).
import { Card } from '@/components/Card';
import { ErrorState, Skeleton } from '@/components/States';
import { cn } from '@/lib/utils';
import { useMidtermDetail, useMidtermProgress } from '../hooks';
import { baselineDraft } from '../revisionDraft';
import { MidtermTrailTimeline, MIDTERM_FIELD_LABEL, formatMidtermValue } from './MidtermTrailTimeline';
import { KpiIndexBadge, ReviewerDecisionBadge } from './MemberRevisionPanel';
import type { MidtermReview, MidtermReviewStatus, MidtermTrailEntry } from '@/lib/types';

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
 * "내 차례" 판정 — **지금 실제로 처리할 수 있는지**. 세 조건을 모두 본다.
 *   ① 중간점검 기간(mid_review)일 것 ② 내 자리(배정)일 것 ③ 그 자리의 차례 상태일 것
 *   pending + 내가 1차 검토자 → 코멘트 차례 / revised + 내가 2차 검토자 → 판정 차례
 * ⚠ 기간(isMidReview)을 빼면 안 된다 — 기간이 지났는데 미처리 pending·revised 행이 남아
 *   있는 상태(대기열이 저절로 비지 않는다)에서 "내 차례 N건"이라고 세어 놓고, 정작 눌러 보면
 *   읽기 전용 패널이 열려 화면이 자기모순에 빠진다.
 * ⚠ 계정 role 로 판정하지 않는다 — 부서장은 Department.headUserId 로 지정되므로 role 이
 *   employee 인 부서장이 실제로 존재한다. ReviewerQueue.panelFor 의 라우팅 조건과 동일하게
 *   두어, 이 판정으로 고른 건은 언제나 그 자리에 맞는 쓰기 패널로만 열린다(1차가 판정 화면에,
 *   2차가 코멘트 화면에 도달하는 경로를 만들지 않는다).
 */
export function isReviewerTurn(
  review: MidtermReview,
  meId: string,
  isMidReview: boolean,
): boolean {
  if (!isMidReview) return false;
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
  isMidReview: boolean,
): boolean {
  switch (filter) {
    case 'mine':
      return isReviewerTurn(review, meId, isMidReview);
    case 'done':
      return DONE_STATUSES.has(review.status);
    // 기간 밖이면 내 차례가 성립하지 않으므로 미처리 건은 전부 여기로 모인다(대기 상태 그대로).
    case 'inprog':
      return !DONE_STATUSES.has(review.status) && !isReviewerTurn(review, meId, isMidReview);
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
 *
 * 2026-07-24: 본인 KPI 카드 추가 — MemberRevisionPanel 의 읽기 전용 카드(번호 배지·부서장 판정
 * 배지·코멘트·목표/목표값/가중치)를 그대로 재사용하되 입력칸만 없는 형태. cycleId·userId 가
 * 있어야 진척(KPI)을 조회할 수 있어 둘 다 optional — "구성원 점검" 탭(ReviewerQueue)처럼 아직
 * 넘겨주지 않는 호출부는 KPI 섹션 없이 기존 그대로(turnLine·총평·이력만) 동작한다.
 */
export function MidtermReadOnlyView({
  reviewId,
  turnLine,
  cycleId,
  userId,
}: {
  reviewId: string;
  turnLine: string;
  /** KPI 카드 섹션에 필요 — 둘 다 있을 때만 진척을 조회해 렌더한다. */
  cycleId?: string | null;
  userId?: string | null;
}) {
  const detail = useMidtermDetail(reviewId);
  const showKpis = Boolean(cycleId && userId);
  const progress = useMidtermProgress(
    { cycleId: cycleId ?? undefined, userId: userId ?? undefined },
    { enabled: showKpis },
  );

  const progressLoading = progress.loading && !progress.data;
  const progressFailed = Boolean(progress.error);
  const progressReady = Boolean(progress.data) && !progressFailed;

  const allKpis = progress.data?.kpis ?? [];
  const kpis = allKpis.filter((k) => k.status === 'confirmed');
  const lockedKpis = allKpis.filter((k) => k.status !== 'confirmed');

  const commentByKpi: Record<string, { note: string | null; decision: string | null }> = {};
  const memberNoteByKpi: Record<string, string | null> = {};
  for (const c of detail.data?.kpiCheckIns ?? []) {
    commentByKpi[c.kpiId] = { note: c.reviewerNote, decision: c.reviewerDecision };
    memberNoteByKpi[c.kpiId] = c.memberNote;
  }

  // 마지막 "수정 제출" 이력의 KPI별 전→후 변경 내역 — 조정 내역이 있으면 카드에서 바로 보여준다
  // (FinalReviewPanel 과 같은 원천: trail 'revised' 엔트리의 kpiChanges).
  const lastRevision: MidtermTrailEntry | undefined = [...(detail.data?.trail ?? [])]
    .reverse()
    .find((t) => t.action === 'revised');
  const changesByKpi = new Map<string, MidtermTrailEntry['kpiChanges']>();
  for (const c of lastRevision?.kpiChanges ?? []) {
    const arr = changesByKpi.get(c.kpiId) ?? [];
    arr.push(c);
    changesByKpi.set(c.kpiId, arr);
  }

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

      {detail.data?.memberNote && (
        <Card>
          <h4 className="text-sm font-semibold text-foreground">내 회신 사유</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {detail.data.memberNote}
          </p>
        </Card>
      )}

      {showKpis && (
        <>
          {progressLoading && <Skeleton className="h-40 w-full" />}
          {progressFailed && (
            <ErrorState
              message="KPI 진척을 불러오지 못했어요. 다시 시도해 주세요."
              onRetry={progress.reload}
            />
          )}
          {progressReady && allKpis.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">이번 주기에 등록된 KPI가 없어요.</p>
            </Card>
          )}

          {/* 확정 KPI — MemberRevisionPanel 읽기 전용 카드와 동일 스타일(입력칸만 제외).
              조정 필요였던 항목은 좌측 강조 보더로 눈에 띄게 한다(InfoBanner 의 톤 악센트와 동일 두께). */}
          {progressReady &&
            kpis.map((k, i) => {
              const c = commentByKpi[k.kpiId];
              const decision = c?.decision ?? null;
              const needsAdjust = decision === 'rebaseline';
              const base = baselineDraft(k);
              const showTargetValue = k.measureType !== 'qualitative';
              const memberNote = memberNoteByKpi[k.kpiId];
              const changes = changesByKpi.get(k.kpiId) ?? [];
              return (
                <div
                  key={k.kpiId}
                  className={cn(
                    'overflow-hidden rounded-lg border border-border bg-card shadow-elev-1',
                    needsAdjust && 'border-l-2 border-l-warning-500',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
                    <KpiIndexBadge index={i + 1} />
                    <h4 className="min-w-0 flex-1 break-keep text-[13.5px] font-bold leading-snug text-foreground">
                      {k.title}
                    </h4>
                    <ReviewerDecisionBadge decision={decision} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground">
                    <span>
                      목표{' '}
                      <b className="font-semibold text-foreground">
                        {base.targetText || (showTargetValue ? base.targetValue || '—' : '—')}
                      </b>
                    </span>
                    {showTargetValue && (
                      <span>
                        목표값{' '}
                        <b className="font-semibold tabular-nums text-foreground">{base.targetValue || '—'}</b>
                      </span>
                    )}
                    <span>
                      가중치 <b className="font-semibold tabular-nums text-foreground">{base.weight}%</b>
                    </span>
                  </div>
                  {c?.note && (
                    <p className="border-t border-border/60 bg-muted/30 px-4 py-2.5 text-[12.5px] text-foreground/90">
                      <span className="mr-1.5 font-semibold text-muted-foreground">부서장</span>
                      {c.note}
                    </p>
                  )}
                  {/* 조정 내역(전→후) — 마지막 수정 제출에서 이 KPI가 바뀌었으면 표시. */}
                  {changes.length > 0 && (
                    <ul className="border-t border-border/60 px-4 py-2.5 text-[12.5px] text-muted-foreground">
                      {changes.map((ch, idx) => (
                        <li key={`${ch.field}-${idx}`}>
                          <span className="mr-1.5 font-semibold text-foreground/70">조정 내역</span>
                          {MIDTERM_FIELD_LABEL[ch.field] ?? ch.field}{' '}
                          <span className="tabular-nums">{formatMidtermValue(ch.field, ch.before)}</span>
                          {' → '}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatMidtermValue(ch.field, ch.after)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* 본인 조정 코멘트 — 이 KPI를 어떻게·왜 조정했는지(kpiCheckIns[].memberNote). */}
                  {memberNote && (
                    <p className="border-t border-border/60 bg-primary/[0.04] px-4 py-2.5 text-[12.5px] text-foreground/90">
                      <span className="mr-1.5 font-semibold text-primary">내 조정 코멘트</span>
                      {memberNote}
                    </p>
                  )}
                </div>
              );
            })}

          {/* 미확정 KPI — MemberRevisionPanel 의 lockedKpis 카드와 동일. */}
          {progressReady &&
            lockedKpis.map((k) => {
              const c = commentByKpi[k.kpiId];
              const needsAdjust = c?.decision === 'rebaseline';
              return (
                <Card key={k.kpiId}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{k.title}</h4>
                    <div className="flex items-center gap-1.5">
                      {needsAdjust && (
                        <span className="rounded-sm bg-warning-100 px-2 py-0.5 text-[11.5px] font-semibold text-warning-700">
                          조정 필요
                        </span>
                      )}
                      <span className="rounded-sm bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                        미확정
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    목표: {k.targetText ?? k.targetValue ?? '-'} · 가중치 {k.weight}%
                  </p>
                  {c?.note && <p className="mt-1 text-sm text-muted-foreground">부서장: {c.note}</p>}
                </Card>
              );
            })}
        </>
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
