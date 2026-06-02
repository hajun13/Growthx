'use client';

import { gradeBgClass, gradeSolidClass, fmtScore } from '@/lib/ui';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';

export interface GradeChipProps {
  // null = 미집계/집계 전(QA B-1). 화면이 깨지지 않게 "—" 칩으로 표시.
  grade: Grade | null;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'soft';
  showScore?: number;
}

export function GradeChip({
  grade,
  size = 'md',
  variant = 'soft',
  showScore,
}: GradeChipProps) {
  const sizeClass =
    size === 'sm' ? 'px-2 py-[2px] text-xs' : 'px-2.5 py-0.5 text-sm';

  // 미집계 등급(null): 중립 칩 + "—" 표시.
  if (grade === null) {
    return (
      <Badge
        variant="secondary"
        aria-label="집계 전"
        className={cn(
          'gap-1 border-transparent bg-muted font-semibold tabular-nums text-muted-foreground',
          sizeClass,
        )}
      >
        <span aria-hidden>—</span>
      </Badge>
    );
  }
  // C는 solid 대비 경계 → soft 권장. 호출부 선택 존중.
  const toneClass =
    variant === 'solid' ? gradeSolidClass[grade] : gradeBgClass[grade];
  const ariaLabel =
    showScore !== undefined
      ? `등급 ${grade}, ${fmtScore(showScore)}점`
      : `등급 ${grade}`;
  return (
    <Badge
      variant="secondary"
      aria-label={ariaLabel}
      className={cn(
        'gap-1 border-transparent font-semibold tabular-nums',
        sizeClass,
        toneClass,
      )}
    >
      <span aria-hidden>{grade}</span>
      {showScore !== undefined && (
        <span aria-hidden className="font-medium">
          {fmtScore(showScore)}
        </span>
      )}
    </Badge>
  );
}
