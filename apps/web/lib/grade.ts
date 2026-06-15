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

/** 등급별 색쌍 — .fg=원래 채도 등급색, .bg=연한 틴트. */
export const GRADE_COLOR: Record<Grade, GradeColor> = {
  S: { bg: '#ece9f6', fg: '#3f2c80' }, // 퍼플
  A: { bg: '#e5edfb', fg: '#0054ca' }, // 블루
  B: { bg: '#e9f7ea', fg: '#4CAF50' }, // 그린
  C: { bg: '#fff3e0', fg: '#FF9800' }, // 앰버
  D: { bg: '#fdeceb', fg: '#F44336' }, // 레드
};

export function gradeColor(grade: Grade): GradeColor {
  return GRADE_COLOR[grade] ?? GRADE_COLOR.B;
}
