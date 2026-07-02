'use client';

// 1~12월 탭 선택 바 — image 11: 가로 스크롤 그리드를 대체하는 월별 탭 전환.
export function MonthTabBar({
  months,
  active,
  onSelect,
  completeSet,
}: {
  months: number[];
  active: number;
  onSelect: (m: number) => void;
  completeSet: Set<number>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {months.map((m) => {
        const isActive = m === active;
        const isComplete = completeSet.has(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className={[
              'relative h-8 min-w-[44px] rounded-md px-2.5 text-[13px] font-semibold transition-colors',
              isActive ? 'bg-primary text-primary-foreground shadow-elev-1' : 'text-muted-foreground hover:bg-card hover:text-foreground',
            ].join(' ')}
          >
            {m}월
            {isComplete && !isActive && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-status-finalized-fg" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
