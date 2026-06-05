'use client';

import { cycleTypeStyle } from '@/lib/ui';
import type { CycleType } from '@/lib/types';

interface CycleTypeBadgeProps {
  cycleType: CycleType | null | undefined;
  size?: 'sm' | 'md';
}

/**
 * 평가 주기 유형(MIDTERM/FINAL) 배지.
 * MIDTERM → 파란색 계열, FINAL → 초록색 계열.
 * cycleType 이 없으면 렌더링하지 않는다.
 */
export function CycleTypeBadge({ cycleType, size = 'md' }: CycleTypeBadgeProps) {
  if (!cycleType) return null;

  const style = cycleTypeStyle[cycleType];
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-0.5 text-[13px]';

  return (
    <span
      className={`inline-flex items-center font-medium ${sizeClass} ${style.className}`}
    >
      {style.label}
    </span>
  );
}
