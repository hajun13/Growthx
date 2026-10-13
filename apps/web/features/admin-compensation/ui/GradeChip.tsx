'use client';

/**
 * GradeChip — 등급 칩 (단독 + 전환쌍).
 *
 * GradeChip    — 단일 등급/도입전/없음 표시.
 * GradeTransition — "작년 등급 → 올해 등급" 전환 셀 (col 15).
 *
 * 평가등급제 도입: 2025년부터. 이전 사이클은 "도입전" 회색 중립 칩 표시.
 * ~90줄 파일상한 준수.
 */

import { Badge } from '@/components/ui/badge';
import type { Grade } from '@/lib/types';

/** 평가등급제 도입 연도. 이 연도 미만 사이클은 등급 없음. */
export const GRADE_SYSTEM_START_YEAR = 2025;

const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

interface GradeChipProps {
  /** 해당 연봉 셀의 등급. null = 미산정 or 도입전. */
  grade: Grade | null | undefined;
  /** 해당 사이클 연도. null = 사이클 없음 → 칩 미표시. */
  cycleYear: number | null | undefined;
  /** 칩 크기. 기본 'sm'. */
  size?: 'sm' | 'md';
}

/**
 * 표시 규칙:
 * - grade != null → 등급 칩(S/A/B/C/D).
 * - grade == null && cycleYear != null && cycleYear < 2025 → "도입전" 회색 칩.
 * - 그 외(cycleYear == null, 또는 도입 후 미산정) → null 렌더.
 */
export function GradeChip({ grade, cycleYear, size = 'sm' }: GradeChipProps) {
  if (grade != null) {
    return (
      <Badge variant={GRADE_VARIANT[grade as Grade]} size={size === 'md' ? 'grade-md' : 'grade-sm'}>
        {grade}
      </Badge>
    );
  }
  if (cycleYear != null && cycleYear < GRADE_SYSTEM_START_YEAR) {
    return <Badge variant="muted" size="xs">도입전</Badge>;
  }
  return null;
}

interface GradeTransitionProps {
  previousGrade: Grade | null | undefined;
  previousCycleYear: number | null | undefined;
  currentGrade: Grade | null | undefined;
  currentCycleYear: number | null | undefined;
}

/**
 * GradeTransition — "작년 등급 → 올해 등급" 전환 셀 내용.
 * 좌·우 동일 flex-1 반쪽(작년 우측정렬 · 화살표 중앙 · 올해 좌측정렬)으로
 * 칩/대시 무관하게 작년·올해 배지 x위치를 행마다 동일하게 고정한다.
 */
export function GradeTransition({
  previousGrade,
  previousCycleYear,
  currentGrade,
  currentCycleYear,
}: GradeTransitionProps) {
  const hasPrev = previousGrade != null || (previousCycleYear != null && previousCycleYear < GRADE_SYSTEM_START_YEAR);
  const hasCurr = currentGrade != null;

  const prevNode = hasPrev
    ? <GradeChip grade={previousGrade} cycleYear={previousCycleYear} size="md" />
    : <span className="text-11 text-neutral-400">—</span>;

  const currNode = hasCurr
    ? <GradeChip grade={currentGrade} cycleYear={currentCycleYear} size="md" />
    : <span className="text-11 text-neutral-400">—</span>;

  return (
    <div className="flex w-full items-center gap-1.25">
      <span className="inline-flex flex-1 justify-end">{prevNode}</span>
      <span className="text-11 leading-none text-neutral-500">→</span>
      <span className="inline-flex flex-1 justify-start">{currNode}</span>
    </div>
  );
}
