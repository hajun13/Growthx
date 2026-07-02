// 화면 인라인 스타일용 공용 색 토큰 — Part/ 클라이언트 재스킨(2026-07-02).
// SSOT: _workspace/01_design/part-revision-brief.md §1. 파일명은 레거시 호환용으로 유지한다.
export const T = {
  blue50: '#EAF2FE', // primary-subtle
  blue300: '#7FB3F8',
  blue500: '#0257CE', // primary (action blue)
  blue600: '#0246A8', // primary-hover
  blue700: '#023683', // primary-active
  grey50: '#F8F9FD', // surface-page
  grey100: '#F4F5FA', // surface-muted
  grey200: '#E7E9F3', // border-subtle
  grey300: '#D8DCEB', // border-default
  grey400: '#B8BDD4',
  grey500: '#9B98AC', // text-faint
  grey600: '#6B6980', // text-muted
  grey700: '#4A4860',
  grey800: '#2D2A3D', // text-default
  grey900: '#161326', // text-strong
  green500: '#0B7A47',
  red500: '#C81E1E',
  orange500: '#B4790A',
  // 브리프 §1 원시 토큰(사이드바/민트 등 grey/blue 스케일 밖 값).
  sidebar: '#564599',
  sidebarActive: '#4A3B85',
  teal: '#0ED0D9',
  tealSubtle: '#E4FBFB',
} as const;

// KPI 그룹(performance_core / collaboration_growth)별 칩 색.
export const groupChip: Record<string, { bg: string; color: string }> = {
  performance_core: { bg: '#FFFFFF', color: '#2D2A3D' },
  collaboration_growth: { bg: '#F4F5FA', color: '#4A4860' },
};

// KPI 카테고리별 칩 색 — 같은 화면에 여러 색이 튀지 않게 soft tone으로 제한.
export const categoryChip: Record<string, { bg: string; color: string }> = {
  revenue: { bg: '#FFFFFF', color: '#2D2A3D' },
  construction: { bg: '#F8F9FD', color: '#4A4860' },
  orders: { bg: '#F4F5FA', color: '#4A4860' },
  collaboration: { bg: '#F8F9FD', color: '#6B6980' },
  development: { bg: '#F8F9FD', color: '#6B6980' },
};

// 등급(S~D)별 칩 색(solid) — Part/ 브리프 §2 확정값. C는 흰 글씨 대비 AA 미달 → 진갈색 글씨.
export const gradeChipColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#7C3AED', color: '#FFFFFF' },
  A: { bg: '#0EA05E', color: '#FFFFFF' },
  B: { bg: '#F97316', color: '#FFFFFF' },
  C: { bg: '#F5B400', color: '#3D2900' },
  D: { bg: '#EF4444', color: '#FFFFFF' },
};

// 등급(S~D)별 Soft 칩 색(연한 틴트 배경 + 진한 톤 텍스트) — 설명 패널/부차 표시용(브리프 §2).
export const gradeChipSoftColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#F3EBFE', color: '#6D28D9' },
  A: { bg: '#E3F7EC', color: '#0B7A47' },
  B: { bg: '#FFEEDD', color: '#C2570A' },
  C: { bg: '#FFF6DC', color: '#8A5B00' },
  D: { bg: '#FDE8E8', color: '#C81E1E' },
};
