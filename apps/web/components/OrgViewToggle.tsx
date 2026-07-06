'use client';

import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrgViewToggleProps {
  view: 'card' | 'list';
  onChange: (v: 'card' | 'list') => void;
}

// 카드/리스트 뷰 전환 — 세그먼트 버튼(신규 스타일 없음).
export function OrgViewToggle({ view, onChange }: OrgViewToggleProps) {
  const items: { key: 'card' | 'list'; label: string; Icon: typeof LayoutGrid }[] =
    [
      { key: 'card', label: '카드', Icon: LayoutGrid },
      { key: 'list', label: '리스트', Icon: List },
    ];
  return (
    <div
      role="tablist"
      aria-label="보기 전환"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
    >
      {items.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card font-semibold text-foreground shadow-none'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
