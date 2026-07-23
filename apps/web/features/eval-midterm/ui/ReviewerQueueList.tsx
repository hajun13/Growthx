'use client';

// "구성원 점검" 좌측 대상 목록 — 상태 필터(전체/내 차례/진행 중/완료) + 검색 + 대기열 안내.
// ReviewerQueue 파일 상한 분리(architecture.md 파일당 ~200줄). 표시 전용이라 선택 요청은
// 상위(ReviewerQueue)로 올려보낸다 — 미저장 입력 가드가 그쪽에 있기 때문이다.
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { FilterChipBar } from '@/components/FilterChipBar';
import { cn } from '@/lib/utils';
import {
  FlowStatusChip,
  isReviewerTurn,
  matchesQueueFilter,
  type ReviewerQueueFilter,
} from './midtermFlowHelpers';
import type { MidtermReview } from '@/lib/types';

export function ReviewerQueueList({
  rows,
  meId,
  selectedId,
  filter,
  onFilterChange,
  search,
  onSearch,
  onSelect,
  className,
}: {
  rows: MidtermReview[];
  meId: string;
  selectedId: string | null;
  filter: ReviewerQueueFilter;
  onFilterChange: (v: ReviewerQueueFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  /** 선택 "요청" — 상위가 미저장 입력을 확인한 뒤 실제 전환 여부를 정한다. */
  onSelect: (id: string) => void;
  className?: string;
}) {
  // 내 차례(= 지금 바로 처리할 수 있는) 건수 — 필터를 걸지 않아도 업무량이 보이도록 칩에 표시.
  const myTurnCount = rows.filter((r) => isReviewerTurn(r, meId)).length;
  const options = [
    { value: 'all', label: '전체' },
    { value: 'mine', label: '내 차례', count: myTurnCount },
    { value: 'inprog', label: '진행 중' },
    { value: 'done', label: '완료' },
  ];

  const items = rows
    .filter((r) => matchesQueueFilter(r, meId, filter))
    .filter((r) => (search ? (r.evaluateeName ?? '').includes(search) : true))
    .map((r) => ({
      id: r.id,
      name: r.evaluateeName ?? r.evaluateeId.slice(0, 8),
      active: r.id === selectedId,
      accessory: <FlowStatusChip status={r.status} />,
      onSelect: () => onSelect(r.id),
    }));

  const emptyMessage = search
    ? '검색 결과가 없어요.'
    : filter === 'mine'
      ? '지금 내 차례인 점검이 없어요.'
      : '해당하는 구성원이 없어요.';

  return (
    <div className={cn('space-y-2.5 self-start', className)}>
      <FilterChipBar
        options={options}
        value={filter}
        onChange={(v) => onFilterChange(v as ReviewerQueueFilter)}
      />
      {/* 대기열이 비었다는 사실은 토스트가 사라진 뒤에도 남아 있어야 한다. */}
      {myTurnCount === 0 && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          지금 내 차례인 점검이 없어요 — 처리할 건이 생기면 여기에 표시돼요.
        </p>
      )}
      <EvaluationSubjectPanel
        title="구성원"
        count={rows.length}
        search={search}
        onSearch={onSearch}
        searchPlaceholder="이름 검색"
        searchAriaLabel="구성원 이름 검색"
        emptyMessage={emptyMessage}
        items={items}
        maxHeightClassName="max-h-[480px]"
      />
    </div>
  );
}
