'use client';

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

// 법인별 보기 필터 — Notion Low Color rounded 세그먼트.
export function LegalEntityFilter({
  value,
  onChange,
  counts,
}: LegalEntityFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="법인 필터"
      className="inline-flex items-center gap-1 rounded-none border border-border bg-muted p-1"
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
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 ${
              active ? 'bg-card text-foreground' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
            }`}
          >
            {label}
            {count != null && (
              <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
