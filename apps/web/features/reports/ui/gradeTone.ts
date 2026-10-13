// 등급 막대(분포 차트) 구간 색 — 정적 클래스 룩업. 값은 palette gradeChipColor(Solid)와 동일 토큰.
import type { Grade } from '@/lib/types';

export const GRADE_SOLID: Record<Grade, string> = {
  S: 'bg-grade-s text-gradeFg-s',
  A: 'bg-grade-a text-gradeFg-a',
  B: 'bg-grade-b text-gradeFg-b',
  C: 'bg-grade-c text-gradeFg-c',
  D: 'bg-grade-d text-gradeFg-d',
};
