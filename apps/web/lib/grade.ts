// 등급(S~D) 색 — 단일 출처. Part/ 브리프 §2 Solid 등급 색(gradeChipColor·GradeChip과 동일 값).
//   .fg = 등급 액센트/작은 차트 신호/칩 배경(솔리드)
//   .bg = 연한 틴트 배경
//   .text = fg 배경 위 글자색 (C만 진갈색 — 흰 글씨 대비 AA 미달)
import type { Grade } from '@/lib/types';

export interface GradeColor {
  /** 연한 틴트 배경(칩 배경 등) */
  bg: string;
  /** 채도색 — 액센트/수치/차트/솔리드 칩 배경 */
  fg: string;
  /** fg 배경 위 글자색 */
  text: string;
}

/** 등급별 색쌍 — 클라이언트 확정 5색 체계(S 보라/A 초록/B 주황/C 노랑/D 빨강). */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#F1EAFD', fg: '#7C3AED', text: '#FFFFFF' },
  A: { bg: '#E6F6EE', fg: '#0EA05E', text: '#FFFFFF' },
  B: { bg: '#FEF0E4', fg: '#F97316', text: '#FFFFFF' },
  C: { bg: '#FDF6DE', fg: '#F5B400', text: '#3D2900' },
  D: { bg: '#FDEAEA', fg: '#EF4444', text: '#FFFFFF' },
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
