// 등급(S~D) 배지 색 — 단일 출처(12파일 인라인 중복 GRADE_BADGE 통합).
// DESIGN.md §3 Kinetic 매핑: dark-on-light(연한 배경 + 어두운 텍스트, WCAG AA). 흰 텍스트 금지.
import type { Grade } from '@/lib/types';

export interface GradeColor {
  /** 연한 배경 */
  bg: string;
  /** 어두운 텍스트/수치 색 */
  fg: string;
}

/** 등급별 Kinetic 색쌍. 배경은 bg, 텍스트·수치는 fg 를 쓴다. */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#e7deff', fg: '#1e0160' }, // primary (deep purple)
  A: { bg: '#dae2ff', fg: '#00419e' }, // secondary (blue)
  B: { bg: '#ccf8fa', fg: '#004f53' }, // tertiary (teal)
  C: { bg: '#ffddb0', fg: '#8a5500' }, // warning (amber, 보완)
  D: { bg: '#ffdad6', fg: '#93000a' }, // error
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
