'use client';

import { cn } from '@/lib/utils';

export interface CycleOption {
  cycleId: string;
  year: number;
  name: string;
}
export interface CycleMultiSelectProps {
  options: CycleOption[]; // closed 사이클만(부모가 필터)
  selected: string[]; // cycleId[]
  onChange: (ids: string[]) => void;
  min?: number; // 기본 1 — 선택 0개 방지
}

// 비교 사이클 다중 선택(토글 칩). 사각·28px. 연도 오름차순.
export function CycleMultiSelect({
  options,
  selected,
  onChange,
  min = 1,
}: CycleMultiSelectProps) {
  const sorted = [...options].sort((a, b) => a.year - b.year);

  function toggle(id: string) {
    const has = selected.includes(id);
    if (has) {
      // min 미만으로 줄어들지 않게 방지.
      if (selected.length <= min) return;
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (sorted.length === 0) {
    return (
      <span className="text-[12px] text-toss-grey500">
        비교 가능한 사이클이 없어요.
      </span>
    );
  }

  return (
    <div
      role="group"
      aria-label="비교 사이클 선택"
      className="flex flex-wrap items-center gap-1.5"
    >
      {sorted.map((o) => {
        const active = selected.includes(o.cycleId);
        return (
          <button
            key={o.cycleId}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.cycleId)}
            title={o.name}
            className={cn(
              'flex h-7 items-center rounded-none border px-2.5 text-[12px] font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-toss-blue50 text-toss-blue700'
                : 'border-border bg-card text-toss-grey600 hover:text-foreground',
            )}
          >
            {o.year}
          </button>
        );
      })}
    </div>
  );
}
