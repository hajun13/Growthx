'use client';

import { cn } from '@/lib/utils';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** 접근성 레이블 */
  ariaLabel?: string;
}

/**
 * SegmentedControl — 인라인 세그먼트 선택 컨트롤.
 * Tabs(언더라인 탭)와 구분 — 박스형 내부 슬라이딩 강조.
 * 보통 정렬 기준, 보기 전환(목록/카드), 주기 토글 등 소규모 옵션에 사용.
 *
 * 사용 예:
 * <SegmentedControl options={[{value:'list',label:'목록'},{value:'card',label:'카드'}]} value={view} onChange={setView} />
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel = '옵션 선택',
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-[4px] border border-border bg-card p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-[3px] transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-muted font-semibold text-foreground shadow-none'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
