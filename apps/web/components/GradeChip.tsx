'use client';

import { cx, gradeBgClass, gradeSolidClass, fmtScore } from '@/lib/ui';
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
  // 미집계 등급(null): 중립 칩 + "—" 표시. 등급별 색 클래스 인덱싱(undefined) 방지.
  if (grade === null) {
    return (
      <span
        aria-label="집계 전"
        className={cx(
          'inline-flex items-center gap-1 rounded-full font-semibold tabular-nums bg-neutral-100 text-neutral-500',
          size === 'sm' ? 'px-2 py-[2px] text-xs' : 'px-3 py-1 text-sm',
        )}
      >
        <span aria-hidden>—</span>
      </span>
    );
  }
  // C는 solid 대비 경계 → soft 권장(design-tokens §1.7). 호출부 선택 존중.
  const toneClass =
    variant === 'solid' ? gradeSolidClass[grade] : gradeBgClass[grade];
  const ariaLabel =
    showScore !== undefined
      ? `등급 ${grade}, ${fmtScore(showScore)}점`
      : `등급 ${grade}`;
  return (
    <span
      aria-label={ariaLabel}
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-semibold tabular-nums',
        size === 'sm' ? 'px-2 py-[2px] text-xs' : 'px-3 py-1 text-sm',
        toneClass,
      )}
    >
      <span aria-hidden>{grade}</span>
      {showScore !== undefined && (
        <span aria-hidden className="font-medium">
          {fmtScore(showScore)}
        </span>
      )}
    </span>
  );
}
