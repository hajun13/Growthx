'use client';

import { cycleTypeStyle } from '@/lib/ui';
import type { CycleType } from '@/lib/types';
import { DesignLabel } from '@/components/DesignLabel';

interface CycleTypeBadgeProps {
  cycleType: CycleType | null | undefined;
}

/**
 * 평가 주기 유형(MIDTERM/FINAL) 배지.
 * MIDTERM → 파란색 계열, FINAL → 초록색 계열.
 * cycleType 이 없으면 렌더링하지 않는다.
 */
export function CycleTypeBadge({ cycleType }: CycleTypeBadgeProps) {
  if (!cycleType) return null;

  const style = cycleTypeStyle[cycleType];
  const tone = cycleType === 'FINAL' ? 'green' : 'blue';

  return <DesignLabel tone={tone}>{style.label}</DesignLabel>;
}
