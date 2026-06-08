'use client';

import { cn } from '@/lib/utils';

export interface RuleSetChipProps {
  competencyIncluded: boolean; // 역량평가 포함 여부
  // 역량 점수 반영 여부(역량은 항상 참고용이라 false 가정 — 명시 false 면 "(참고)").
  reflected?: boolean;
  perfWeight?: number; // 실적 가중치(%) — 있으면 "실적 N%", 없으면 "실적 100%".
}

// 사이클 RuleSet 요약 칩 — "실적 100%" 또는 "실적 70%·역량(참고)".
// 배경 회색·사각·소형. 백엔드 ruleSummary 표시만(재계산 없음).
export function RuleSetChip({
  competencyIncluded,
  reflected = false,
  perfWeight,
}: RuleSetChipProps) {
  const perfText = `실적 ${perfWeight != null ? perfWeight : 100}%`;
  // 역량 포함이지만 미반영이면 "역량(참고)" 회색.
  const compText = competencyIncluded
    ? reflected
      ? '역량 반영'
      : '역량(참고)'
    : null;
  const label = compText ? `${perfText}·${compText}` : perfText;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-none bg-toss-grey100 px-1.5 py-px text-[11px] font-medium text-toss-grey600',
      )}
      title={label}
    >
      {label}
    </span>
  );
}
