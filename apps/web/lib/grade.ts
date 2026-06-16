// 등급(S~D) 색 — 단일 출처. 코드 사용 관례에 맞춤:
//   .fg = 채도색(숫자·막대·차트·아이콘·강조 텍스트 등 액센트)  ← 원래 Toss 등급색
//   .bg = 연한 틴트(칩/배경)                                   ← .fg 위 대비 텍스트는 .fg 사용
// 원래 GRADE_BADGE 채도값(S 퍼플·A 블루·B 그린·C 앰버·D 레드)을 .fg 로 복원.
import type { Grade } from '@/lib/types';

export interface GradeColor {
  /** 연한 틴트 배경(칩 배경 등) */
  bg: string;
  /** 채도색 — 액센트/수치/차트/칩 텍스트 */
  fg: string;
}

/** 등급별 색쌍 — .fg=채도 등급색(액센트), .bg=연한 틴트. EnergyX 퍼플+시맨틱 램프. */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#F4EDFC', fg: '#6A2DC0' }, // 퍼플 (purple-50 / purple-600)
  A: { bg: '#EAF1FE', fg: '#1D4FC4' }, // 블루 (info-50 / info-600)
  B: { bg: '#E9F8EF', fg: '#128240' }, // 그린 (success-50 / success-600)
  C: { bg: '#FEF5E7', fg: '#C97E04' }, // 앰버 (warning-50 / warning-600)
  D: { bg: '#FDECEC', fg: '#C8353A' }, // 레드 (danger-50 / danger-600)
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
