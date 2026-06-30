'use client';

import type { ReactNode } from 'react';
import { SearchInput } from '@/components/SearchInput';
import { cn } from '@/lib/utils';

export interface EvaluationSubjectItem {
  id: string;
  name: string;
  description?: string | null;
  meta?: string | null;
  active?: boolean;
  accessory?: ReactNode;
  onSelect: () => void;
}

export interface EvaluationSubjectPanelProps {
  title: string;
  count?: number;
  countUnit?: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  emptyMessage?: string;
  items: EvaluationSubjectItem[];
  className?: string;
  maxHeightClassName?: string;
}

export function EvaluationSubjectPanel({
  title,
  count,
  countUnit = '명',
  search,
  onSearch,
  searchPlaceholder = '검색',
  searchAriaLabel,
  emptyMessage = '검색 결과가 없어요.',
  items,
  className,
  maxHeightClassName = 'max-h-[640px]',
}: EvaluationSubjectPanelProps) {
  return (
    <aside
      className={cn(
        'gx-rail overflow-hidden self-start',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
        <h3 className="shrink-0 text-[13px] font-bold text-foreground">
          {title}
          {count !== undefined && (
            <span className="ml-1 font-semibold tabular-nums text-muted-foreground">
              {count}{countUnit}
            </span>
          )}
        </h3>
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel ?? searchPlaceholder}
          className="ml-auto h-9 min-w-0 w-[168px]"
        />
      </div>

      <div className={cn('overflow-y-auto', maxHeightClassName)}>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={item.onSelect}
                  className={cn(
                    'grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-l-[3px] px-4 py-3 text-left transition-colors',
                    item.active
                      ? 'border-l-primary bg-primary/[0.08]'
                      : 'border-l-transparent hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white',
                      item.active ? 'bg-primary' : 'bg-primary',
                    )}
                    aria-hidden
                  >
                    {item.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold leading-snug text-foreground">
                      {item.name}
                      {item.meta && (
                        <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                          {item.meta}
                        </span>
                      )}
                    </span>
                    {item.description && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.accessory && (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.accessory}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
