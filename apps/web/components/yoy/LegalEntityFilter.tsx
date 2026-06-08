'use client';

import { cn } from '@/lib/utils';
import { legalEntityLabel } from '@/lib/ui';
import type { LegalEntity } from '@/lib/types';

export type LegalEntityValue = 'all' | LegalEntity;

export interface LegalEntityFilterProps {
  value: LegalEntityValue;
  onChange: (v: LegalEntityValue) => void;
  counts?: Record<LegalEntityValue, number>; // 옵션 — 각 옵션 인원수 뱃지
}

const OPTIONS: { key: LegalEntityValue; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'energyx', label: legalEntityLabel.energyx },
  { key: 'mirae_plan', label: legalEntityLabel.mirae_plan },
];

// 법인별 보기 필터 — 세그먼트(Toss 사각, rounded-none). 집계 필터로만 사용.
export function LegalEntityFilter({
  value,
  onChange,
  counts,
}: LegalEntityFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="법인 필터"
      className="inline-flex items-center gap-0.5 rounded-none border border-border bg-toss-grey100 p-0.5"
    >
      {OPTIONS.map(({ key, label }) => {
        const active = value === key;
        const count = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-none px-2.5 py-1 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {count != null && (
              <span className="text-[11px] font-medium tabular-nums text-toss-grey500">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
