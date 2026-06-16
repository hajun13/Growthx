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

import { gradeColor } from '@/lib/grade';
import type { Grade } from '@/lib/types';

/** 평가등급제 도입 연도. 이 연도 미만 사이클은 등급 없음. */
export const GRADE_SYSTEM_START_YEAR = 2025;

/** "도입전" 중립 칩 스타일 — D(빨강)와 확실히 구분되는 회색 톤. */
const PRE_INTRO_CHIP: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 500,
  color: '#a0a0ac',
  background: '#efeff2',
  padding: '1px 6px',
  borderRadius: 4,
  display: 'inline-block',
};

/** 등급 칩 스타일 — 솔리드 사각 배지(흰 글자, 채도색 배경). */
function gradeChipStyle(grade: Grade, size: 'sm' | 'md' = 'sm'): React.CSSProperties {
  const gc = gradeColor(grade);
  return {
    fontSize: size === 'md' ? 11 : 9.5,
    fontWeight: 700,
    color: '#fff',
    background: gc.fg,
    padding: size === 'md' ? '2px 8px' : '1px 6px',
    borderRadius: 4,
    display: 'inline-block',
  };
}

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
    return <span style={gradeChipStyle(grade as Grade, size)}>{grade}</span>;
  }
  if (cycleYear != null && cycleYear < GRADE_SYSTEM_START_YEAR) {
    return <span style={{ ...PRE_INTRO_CHIP, fontSize: size === 'md' ? 11 : 9.5 }}>도입전</span>;
  }
  return null;
}

/** 등급이 없거나 연도도 없을 때의 대시 */
const DASH_STYLE: React.CSSProperties = { fontSize: 11, color: '#ccccd4' };

interface GradeTransitionProps {
  previousGrade: Grade | null | undefined;
  previousCycleYear: number | null | undefined;
  currentGrade: Grade | null | undefined;
  currentCycleYear: number | null | undefined;
}

/**
 * GradeTransition — "작년 등급 → 올해 등급" 전환 셀 내용.
 * 고정 3칼럼 그리드(작년 우측정렬 · 화살표 중앙 · 올해 좌측정렬)로
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
    : <span style={DASH_STYLE}>—</span>;

  const currNode = hasCurr
    ? <GradeChip grade={currentGrade} cycleYear={currentCycleYear} size="md" />
    : <span style={DASH_STYLE}>—</span>;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        columnGap: 5,
        width: '100%',
      }}
    >
      <span style={{ justifySelf: 'end', display: 'inline-flex' }}>{prevNode}</span>
      <span style={{ fontSize: 11, color: '#a0a0ac', lineHeight: 1 }}>→</span>
      <span style={{ justifySelf: 'start', display: 'inline-flex' }}>{currNode}</span>
    </div>
  );
}
