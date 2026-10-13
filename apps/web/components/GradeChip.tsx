'use client';

import { Badge } from '@/components/ui/badge';
import { fmtScore } from '@/lib/ui';
import type { Grade } from '@/lib/types';

export interface GradeChipProps {
  // null = 미집계/집계 전(QA B-1). 화면이 깨지지 않게 "—" 칩으로 표시.
  grade: Grade | null;
  size?: 'sm' | 'md';
  /** @deprecated soft 칩 폐기 — 항상 solid 사각 배지(등급 척도 캐논)로 렌더. */
  variant?: 'solid' | 'soft';
  showScore?: number;
}

const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

// 등급 배지 = 평가 규칙 "등급 척도"의 솔리드 사각 배지 단일 스타일(L1 Badge grade-* + grade-sm/md 크기).
// 전 등급 흰 글씨(사용자 확정 2026-07-06 — lib/grade.ts text 와 동일).
export function GradeChip({ grade, size = 'md', showScore }: GradeChipProps) {
  const badgeSize = size === 'sm' ? 'grade-sm' : 'grade-md';

  // 미집계 등급(null): 중립 사각 배지 + "—".
  if (grade === null) {
    return (
      <Badge variant="muted" size={badgeSize} aria-label="집계 전">
        <span aria-hidden>—</span>
      </Badge>
    );
  }

  const badge = (
    <Badge aria-hidden variant={GRADE_VARIANT[grade]} size={badgeSize}>
      {grade}
    </Badge>
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
