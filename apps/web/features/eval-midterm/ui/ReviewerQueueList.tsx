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
  isMidReview,
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
  /** 중간점검 기간 여부 — 기간 밖에서는 어떤 건도 "내 차례"가 아니다(쓰기 패널이 안 열린다). */
  isMidReview: boolean;
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
  // 기간 밖이면 0 이 된다(눌러도 읽기 전용인 건을 업무량으로 세지 않는다).
  const myTurnCount = rows.filter((r) => isReviewerTurn(r, meId, isMidReview)).length;
  const options = [
    { value: 'all', label: '전체' },
    { value: 'mine', label: '내 차례', count: myTurnCount },
    { value: 'inprog', label: '진행 중' },
    { value: 'done', label: '완료' },
  ];

  const matched = rows.filter((r) => matchesQueueFilter(r, meId, filter, isMidReview));
  const items = matched
    .filter((r) => (search ? (r.evaluateeName ?? '').includes(search) : true))
    .map((r) => ({
      id: r.id,
      name: r.evaluateeName ?? r.evaluateeId.slice(0, 8),
      active: r.id === selectedId,
      accessory: <FlowStatusChip status={r.status} />,
      onSelect: () => onSelect(r.id),
    }));

  // 목록이 빈 이유를 정확히 말한다 — 검색어가 있어도 필터가 이미 비웠으면 원인은 필터다.
  // 내 차례 0 건은 위 상시 안내가 이미 같은 말을 하고 있으므로, 여기서는 다음 행동을 안내한다.
  const emptyMessage =
    matched.length === 0
      ? filter === 'mine'
        ? '전체 필터에서 다른 구성원의 진행 상황을 볼 수 있어요.'
        : '해당하는 구성원이 없어요.'
      : '검색 결과가 없어요.';

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
          {isMidReview
            ? '지금 내 차례인 점검이 없어요 — 처리할 건이 생기면 여기에 표시돼요.'
            : '지금은 중간점검 기간이 아니라 처리할 점검이 없어요 — 진행 상황만 볼 수 있어요.'}
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
