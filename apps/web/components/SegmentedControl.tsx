'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
 * @deprecated — L1(@/components/ui/toggle-group) 사용으로 이관 대상.
 * 인라인 세그먼트 선택 컨트롤(박스형). ToggleGroup single/outline 위임.
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
    <ToggleGroup
      type="single"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'default'}
      value={value}
      // 같은 항목 재클릭 시 Radix 가 빈 값을 내보냄 — 선택 해제 불가(라디오 동작) 유지.
      onValueChange={(v) => v && onChange(v)}
      aria-label={ariaLabel}
      className={className}
    >
      {options.map((opt) => (
        <ToggleGroupItem key={opt.value} value={opt.value}>
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
