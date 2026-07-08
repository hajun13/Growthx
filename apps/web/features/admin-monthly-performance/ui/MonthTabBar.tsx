'use client';

// 1~12월 탭 선택 바 — image 11: 가로 스크롤 그리드를 대체하는 월별 탭 전환.
// 점 표시: 우상단 = 입력 완료(활성 탭에서도 색 반전으로 유지), 좌상단 amber = 미저장(dirty) 변경.
export function MonthTabBar({
  months,
  active,
  onSelect,
  completeSet,
  dirtySet,
}: {
  months: number[];
  active: number;
  onSelect: (m: number) => void;
  completeSet: Set<number>;
  /** 미저장(dirty) 변경이 있는 월 — amber 점 병기. */
  dirtySet?: Set<number>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {months.map((m) => {
        const isActive = m === active;
        const isComplete = completeSet.has(m);
        const isDirty = dirtySet?.has(m) ?? false;
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
            {isComplete && (
              <span
                className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary-foreground' : 'bg-status-finalized-fg'}`}
                title="입력 완료"
                aria-hidden
              />
            )}
            {isDirty && (
              <span
                className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-warning-500"
                title="저장하지 않은 변경"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
