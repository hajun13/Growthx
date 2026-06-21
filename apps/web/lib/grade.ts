// 등급(S~D) 색 — 저채도 단일 출처.
//   .fg = 등급 텍스트/작은 차트 신호
//   .bg = 흰색 또는 웜 그레이 계열의 낮은 배경
import type { Grade } from '@/lib/types';

export interface GradeColor {
  /** 연한 틴트 배경(칩 배경 등) */
  bg: string;
  /** 채도색 — 액센트/수치/차트/칩 텍스트 */
  fg: string;
}

/** 등급별 색쌍 — 색 수를 줄이기 위해 S~C는 잉크/그레이, D만 위험색을 사용한다. */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#FFFFFF', fg: '#111111' },
  A: { bg: '#FFFFFF', fg: '#2F2E2C' },
  B: { bg: '#F6F5F4', fg: '#615D59' },
  C: { bg: '#F0EFED', fg: '#8A8178' },
  D: { bg: '#FFFFFF', fg: '#C23A3A' },
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
