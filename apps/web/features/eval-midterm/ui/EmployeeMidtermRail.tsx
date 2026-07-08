'use client';

// 내 중간 점검 우측 요약 레일(sticky) — EmployeeMidterm 파일 상한 분리(2026-07-08).
//  ① 문항 제출 카운터(하단 카운터와 동일 지표 병기) ② 부서장 피드백 요약(순차 확인 단계·이력 포함)
//  ③ 목표 재조정 요약(상세·신청은 모달 — 부모가 소유).
import { Button } from '@/components/Button';
import type { MidtermReview, RebaselineRequestView } from '@/lib/types';

export function EmployeeMidtermRail({
  submittedCount,
  totalCount,
  myReview,
  selfDone,
  confirmed,
  sentBack,
  isMidReview,
  myRebaseline,
  onOpenRebaseline,
}: {
  submittedCount: number;
  totalCount: number;
  myReview: MidtermReview | null;
  selfDone: boolean;
  confirmed: boolean;
  sentBack: boolean;
  isMidReview: boolean;
  myRebaseline: RebaselineRequestView | null;
  onOpenRebaseline: () => void;
}) {
  const reviewStage = myReview?.reviewStage ?? 0;
  const reviewTrail = myReview?.reviewTrail ?? [];

  return (
    <aside className="mt-6 flex flex-col gap-3 lg:sticky lg:top-6 lg:mt-0">
      {/* 문항 제출 현황 — 스크롤 없이 확인 */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 shadow-elev-1">
        <span className="text-[12px] text-muted-foreground">문항 제출</span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {submittedCount}/{totalCount}
        </span>
      </div>

      {/* 부서장 피드백 요약 */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-elev-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">부서장 피드백</h3>
          {confirmed ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>승인</span>
          ) : myReview?.status === 'revision_requested' ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FFEEDD', color: '#C2570A' }}>재조정 요청</span>
          ) : myReview?.status === 'rejected' ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FDE8E8', color: '#C81E1E' }}>반려</span>
          ) : selfDone ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>
              {reviewStage > 0 ? `대기 중 · 확인 ${reviewStage}단계 완료` : '대기 중'}
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F4F5FA', color: '#6B6980' }}>제출 전</span>
          )}
        </div>
        {(confirmed || sentBack) && myReview?.reviewerNote ? (
          <>
            <p className="line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
              {myReview.reviewerNote}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {myReview.reviewerName ?? '부서장'}
              {myReview.confirmedAt
                ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                : ''}
            </p>
            {/* 순차 확인 이력 — 의견 귀속을 단계별로 구분(최종 의견 작성자와 확인자 구분) */}
            {reviewTrail.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                확인 이력: {reviewTrail.map((t) => `${t.stage}차 ${t.approverName}`).join(' → ')}
              </p>
            )}
            {myReview.status === 'revision_requested' && (
              <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-foreground/80">
                아래 <span className="font-semibold">목표 재조정</span>에서 조정을 신청하고, 자가점검을 보완해 재제출해 주세요.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[12px] text-muted-foreground">
              {selfDone ? '부서장이 확인하면 피드백이 여기에 표시돼요.' : '자가점검을 제출하면 피드백을 받을 수 있어요.'}
            </p>
            {/* 순차 확인 진행 상황 — 누가 어디까지 확인했는지 가시화 */}
            {selfDone && reviewTrail.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                확인 이력: {reviewTrail.map((t) => `${t.stage}차 ${t.approverName}`).join(' → ')}
              </p>
            )}
          </>
        )}
      </div>

      {/* 목표 재조정 요약 — 상세·신청은 모달(부모 소유) */}
      {isMidReview && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-elev-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">목표 재조정</h3>
            {myRebaseline && <RebaselineChipBadge status={myRebaseline.status} />}
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {myRebaseline
              ? myRebaseline.status === 'submitted'
                ? '부서장 검토를 기다리고 있어요. 검토 전에는 수정할 수 있어요.'
                : myRebaseline.status === 'approved'
                  ? '재조정이 승인되어 목표에 반영됐어요. 필요하면 새로 신청할 수 있어요.'
                  : '반려됐어요 — 사유 확인 후 수정해 재제출할 수 있어요.'
              : '목표 수치가 현실과 맞지 않으면 재조정을 신청하세요.'}
          </p>
          <Button
            variant={myRebaseline?.status === 'submitted' ? 'secondary' : 'primary'}
            size="sm"
            className="mt-2.5 w-full"
            onClick={onOpenRebaseline}
          >
            {!myRebaseline
              ? '재조정 신청'
              : myRebaseline.status === 'submitted'
                ? '신청 내용 확인·수정'
                : myRebaseline.status === 'rejected'
                  ? '수정·재제출'
                  : '새 재조정 신청'}
          </Button>
        </div>
      )}
    </aside>
  );
}

// 재조정 상태 칩(요약 레일용).
function RebaselineChipBadge({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? { bg: '#E3F7EC', color: '#0B7A47', label: '승인' }
      : status === 'rejected'
        ? { bg: '#FDE8E8', color: '#C81E1E', label: '반려' }
        : { bg: '#EAF2FE', color: '#0257CE', label: '검토 대기' };
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tone.bg, color: tone.color }}>
      {tone.label}
    </span>
  );
}
