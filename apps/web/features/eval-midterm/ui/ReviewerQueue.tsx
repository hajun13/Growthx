'use client';

// "구성원 점검" 탭 — 내가 1차·2차 검토자로 배정된 건의 master-detail.
// MidtermView 파일 상한 분리(architecture.md 파일당 ~200줄). 대상 목록은 이미 배정 필드로
// 걸러진 상태로 넘어온다(role 판정 금지 — 부서장은 Department.headUserId 로 지정된다).
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { cn } from '@/lib/utils';
import { FirstReviewPanel } from './FirstReviewPanel';
import { FinalReviewPanel } from './FinalReviewPanel';
import { FlowStatusChip, MidtermReadOnlyView, reviewerTurnLine } from './midtermFlowHelpers';
import type { MidtermReview } from '@/lib/types';

export function ReviewerQueue({
  rows,
  meId,
  cycleId,
  isMidReview,
  refreshKey,
  onDone,
}: {
  rows: MidtermReview[];
  meId: string;
  cycleId: string;
  /** 중간평가 단계에서만 쓰기 가능(백엔드 게이트와 동일) — 그 밖에는 읽기 전용. */
  isMidReview: boolean;
  /** 액션 성공 후 상세를 다시 읽게 하는 nonce(패널 key 에 섞는다). */
  refreshKey: number;
  onDone: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const items = rows
    .filter((r) => (search ? (r.evaluateeName ?? '').includes(search) : true))
    .map((r) => ({
      id: r.id,
      name: r.evaluateeName ?? r.evaluateeId.slice(0, 8),
      active: r.id === selected?.id,
      accessory: <FlowStatusChip status={r.status} />,
      onSelect: () => {
        setSelectedId(r.id);
        setMobileView('panel');
      },
    }));

  // 내 차례일 때만 쓰기 패널. 그 외(앞 단계 대기·마감·기간 밖)는 읽기 전용 + 차례 안내.
  function panelFor(review: MidtermReview) {
    const key = `${review.id}-${refreshKey}`;
    if (isMidReview && review.firstReviewerId === meId && review.status === 'pending') {
      return (
        <FirstReviewPanel
          key={key}
          reviewId={review.id}
          evaluateeId={review.evaluateeId}
          cycleId={cycleId}
          onDone={onDone}
        />
      );
    }
    if (isMidReview && review.finalReviewerId === meId && review.status === 'revised') {
      return <FinalReviewPanel key={key} reviewId={review.id} onDone={onDone} />;
    }
    return (
      <MidtermReadOnlyView key={key} reviewId={review.id} turnLine={reviewerTurnLine(review)} />
    );
  }

  return (
    <div className="gx-master-detail">
      <EvaluationSubjectPanel
        title="구성원"
        count={rows.length}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="이름 검색"
        searchAriaLabel="구성원 이름 검색"
        emptyMessage="검색 결과가 없어요."
        items={items}
        maxHeightClassName="max-h-[480px]"
        className={mobileView === 'panel' ? 'hidden lg:block' : 'block'}
      />

      <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block')}>
        {!selected ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-16 text-[13px] text-muted-foreground">
            좌측에서 구성원을 선택하세요.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-primary lg:hidden"
            >
              <ChevronLeft size={14} /> 구성원 목록
            </button>
            {panelFor(selected)}
          </>
        )}
      </div>
    </div>
  );
}
