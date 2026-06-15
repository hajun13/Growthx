// 등급(S~D) 배지 색 — 단일 출처(인라인 중복 GRADE_BADGE 통합).
// 원래 디자인(흰 글씨 + 채도 배경) 복원: bg=채도색, fg=흰색.
// 채도색 자체를 텍스트/수치 색으로 쓸 때도 bg 를 사용한다(fg 는 bg 위의 대비 텍스트).
import type { Grade } from '@/lib/types';

export interface GradeColor {
  /** 채도 배경(배지 배경 · 수치/액센트 색으로도 사용) */
  bg: string;
  /** bg 위의 대비 텍스트(흰색) */
  fg: string;
}

/** 등급별 색쌍 — 원래 GRADE_BADGE 값(흰 글씨 칩). */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#3f2c80', fg: '#ffffff' },
  A: { bg: '#0054ca', fg: '#ffffff' },
  B: { bg: '#4CAF50', fg: '#ffffff' },
  C: { bg: '#FF9800', fg: '#ffffff' },
  D: { bg: '#F44336', fg: '#ffffff' },
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
