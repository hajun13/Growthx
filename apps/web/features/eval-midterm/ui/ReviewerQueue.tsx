'use client';

// "구성원 점검" 탭 — 내가 1차·2차 검토자로 배정된 건의 master-detail.
// MidtermView 파일 상한 분리(architecture.md 파일당 ~200줄). 대상 목록은 이미 배정 필드로
// 걸러진 상태로 넘어온다(role 판정 금지 — 부서장은 Department.headUserId 로 지정된다).
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { Modal } from '@/components/Modal';
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
  /** 이 탭 전용 액션 성공 후 상세를 다시 읽게 하는 nonce(패널 key 에 섞는다).
   *  "내 중간 점검" 탭과는 별개 nonce — 공유하면 한쪽 액션이 다른 쪽 패널까지
   *  리마운트시켜 작성 중이던 입력을 지운다. */
  refreshKey: number;
  onDone: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');

  // 입력 중인 코멘트/판정이 있는지(패널이 통지) — 있으면 구성원 전환 전에 확인을 받는다.
  const [dirty, setDirty] = useState(false);
  // 전환이 보류된 대상 id — 확인 모달에서 "이동"을 눌러야 실제로 선택이 바뀐다.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  function selectNow(id: string) {
    setSelectedId(id);
    setMobileView('panel');
  }

  // 구성원 선택 요청 — 미저장 입력이 있으면 즉시 전환하지 않고 확인 모달을 연다.
  function requestSelect(id: string) {
    if (dirty && id !== selected?.id) {
      setPendingId(id);
      return;
    }
    selectNow(id);
  }

  function confirmDiscardAndSwitch() {
    if (pendingId) selectNow(pendingId);
    setPendingId(null);
    setDirty(false);
  }

  function cancelSwitch() {
    setPendingId(null);
  }

  // 액션(코멘트 제출/승인/반려) 성공 시 — 패널이 리마운트되므로 dirty 를 미리 걷어내
  // 다음 선택에서 가드가 헛되이 발동하지 않게 한다.
  function handlePanelDone() {
    setDirty(false);
    onDone();
  }

  const items = rows
    .filter((r) => (search ? (r.evaluateeName ?? '').includes(search) : true))
    .map((r) => ({
      id: r.id,
      name: r.evaluateeName ?? r.evaluateeId.slice(0, 8),
      active: r.id === selected?.id,
      accessory: <FlowStatusChip status={r.status} />,
      onSelect: () => requestSelect(r.id),
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
          onDone={handlePanelDone}
          onDirtyChange={setDirty}
        />
      );
    }
    if (isMidReview && review.finalReviewerId === meId && review.status === 'revised') {
      return (
        <FinalReviewPanel
          key={key}
          reviewId={review.id}
          onDone={handlePanelDone}
          onDirtyChange={setDirty}
        />
      );
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

      <Modal
        open={pendingId !== null}
        onClose={cancelSwitch}
        title="작성 중인 내용을 저장하지 않고 이동할까요?"
        primaryAction={{ label: '이동', onClick: confirmDiscardAndSwitch, variant: 'danger' }}
        secondaryAction={{ label: '취소', onClick: cancelSwitch }}
      >
        <p className="text-sm text-muted-foreground">
          아직 제출하지 않은 코멘트·판정 내용이 있어요. 다른 구성원으로 이동하면 지금까지 입력한
          내용이 사라져요.
        </p>
      </Modal>
    </div>
  );
}
