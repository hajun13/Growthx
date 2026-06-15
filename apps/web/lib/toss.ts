// Toss 색상 팔레트 — 화면 디자인 교체(Agent C)용 공용 토큰.
// 인라인 스타일로 Toss 비주얼 언어를 재현하기 위한 단일 출처.
export const T = {
  blue50: '#f2f4f6',
  blue300: '#64a8ff',
  blue500: '#3182f6',
  blue600: '#2272eb',
  blue700: '#1b64da',
  grey50: '#f9fafb',
  grey100: '#f2f4f6',
  grey200: '#e5e8eb',
  grey300: '#d1d6db',
  grey400: '#b0b8c1',
  grey500: '#8b95a1',
  grey600: '#6b7684',
  grey700: '#4e5968',
  grey800: '#333d4b',
  grey900: '#191f28',
  green500: '#03b26c',
  red500: '#f04452',
  orange500: '#fe9800',
} as const;

// KPI 그룹(performance_core / collaboration_growth)별 칩 색.
export const groupChip: Record<string, { bg: string; color: string }> = {
  performance_core: { bg: '#3182f6', color: '#fff' },
  collaboration_growth: { bg: '#9333EA', color: '#fff' },
};

// KPI 카테고리별 칩 색(도메인 5종).
export const categoryChip: Record<string, { bg: string; color: string }> = {
  revenue: { bg: '#f57800', color: '#fff' },
  construction: { bg: '#0891B2', color: '#fff' },
  orders: { bg: '#2272eb', color: '#fff' },
  collaboration: { bg: '#03b26c', color: '#fff' },
  development: { bg: '#9333EA', color: '#fff' },
};

// 등급(S~D)별 칩 색.
export const gradeChipColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#1b64da', color: '#fff' },
  A: { bg: '#3182f6', color: '#fff' },
  B: { bg: '#03b26c', color: '#fff' },
  C: { bg: '#fe9800', color: '#fff' },
  D: { bg: '#f04452', color: '#fff' },
};
