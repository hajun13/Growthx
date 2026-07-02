'use client';

import { gradeSolidClass, fmtScore } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';

export interface GradeChipProps {
  // null = 미집계/집계 전(QA B-1). 화면이 깨지지 않게 "—" 칩으로 표시.
  grade: Grade | null;
  size?: 'sm' | 'md';
  /** @deprecated soft 칩 폐기 — 항상 solid 사각 배지(등급 척도 캐논)로 렌더. */
  variant?: 'solid' | 'soft';
  showScore?: number;
}

// 등급 배지 = 평가 규칙 "등급 척도"의 솔리드 사각 배지 단일 스타일.
// S/A/B/D는 흰 글자, C는 흰 글씨 대비 AA 미달이라 진갈색 글자(gradeSolidClass가 처리 — 브리프 §2).
export function GradeChip({ grade, size = 'md', showScore }: GradeChipProps) {
  const box =
    size === 'sm'
      ? 'h-5 w-5 text-[11px] rounded'
      : 'h-6 w-6 text-[12.5px] rounded-md';

  // 미집계 등급(null): 중립 사각 배지 + "—".
  if (grade === null) {
    return (
      <span
        aria-label="집계 전"
        className={cn(
          'inline-flex items-center justify-center bg-muted font-bold leading-none text-muted-foreground',
          box,
        )}
      >
        <span aria-hidden>—</span>
      </span>
    );
  }

  const badge = (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center font-bold leading-none',
        box,
        gradeSolidClass[grade],
      )}
    >
      {grade}
    </span>
  );

  if (showScore === undefined) {
    return (
      <span aria-label={`등급 ${grade}`} className="inline-flex">
        {badge}
      </span>
    );
  }
  return (
    <span
      aria-label={`등급 ${grade}, ${fmtScore(showScore)}점`}
      className="inline-flex items-center gap-1.5"
    >
      {badge}
      <span aria-hidden className="text-sm font-semibold tabular-nums text-foreground">
        {fmtScore(showScore)}
      </span>
    </span>
  );
}
