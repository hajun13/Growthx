'use client';

import { cn } from '@/lib/utils';

export interface FilterChipOption {
  value: string;
  label: string;
  count?: number;
}

// 단일 선택
export interface FilterChipBarSingleProps {
  options: FilterChipOption[];
  value: string;
  onChange: (v: string) => void;
  multiple?: false;
  className?: string;
}

// 다중 선택
export interface FilterChipBarMultipleProps {
  options: FilterChipOption[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple: true;
  className?: string;
}

export type FilterChipBarProps = FilterChipBarSingleProps | FilterChipBarMultipleProps;

function isActive(value: string | string[], optValue: string): boolean {
  if (Array.isArray(value)) return value.includes(optValue);
  return value === optValue;
}

/**
 * FilterChipBar — pill 칩 그룹 필터.
 * multiple=false(기본): 단일 선택 토글. multiple=true: 복수 토글.
 *
 * 사용 예(단일):
 * <FilterChipBar options={[{value:'all',label:'전체'},{value:'submitted',label:'제출'}]} value={filter} onChange={setFilter} />
 *
 * 사용 예(다중):
 * <FilterChipBar options={groups} value={selected} onChange={setSelected} multiple />
 */
export function FilterChipBar(props: FilterChipBarProps) {
  const { options, className } = props;

  const handleClick = (optValue: string) => {
    if (props.multiple) {
      const cur = props.value as string[];
      if (cur.includes(optValue)) {
        props.onChange(cur.filter((v) => v !== optValue));
      } else {
        props.onChange([...cur, optValue]);
      }
    } else {
      (props as FilterChipBarSingleProps).onChange(optValue);
    }
  };

  return (
    <div
      role="group"
      aria-label="필터"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {options.map((opt) => {
        const active = isActive(props.value, opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role={props.multiple ? 'checkbox' : 'radio'}
            aria-checked={active}
            onClick={() => handleClick(opt.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[4px] px-3 text-[12.5px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              active
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
