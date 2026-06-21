// 화면 인라인 스타일용 공용 색 토큰 — Notion low-color.
// 파일명은 레거시 호환용으로 유지한다.
export const T = {
  blue50: '#EAF4FF', // primary-subtle
  blue300: '#7FBFFF',
  blue500: '#0075DE', // primary (brand)
  blue600: '#005BAB', // primary-hover
  blue700: '#004780', // primary-active
  grey50: '#F6F5F4',
  grey100: '#F0EFED',
  grey200: '#E6E2DE',
  grey300: '#D8D3CD',
  grey400: '#B8B1AA',
  grey500: '#9A948E',
  grey600: '#615D59',
  grey700: '#45413D',
  grey800: '#2F2E2C',
  grey900: '#111111',
  green500: '#168A45',
  red500: '#C23A3A',
  orange500: '#A66A00',
} as const;

// KPI 그룹(performance_core / collaboration_growth)별 칩 색.
export const groupChip: Record<string, { bg: string; color: string }> = {
  performance_core: { bg: '#FFFFFF', color: '#2F2E2C' },
  collaboration_growth: { bg: '#F0EFED', color: '#45413D' },
};

// KPI 카테고리별 칩 색 — 같은 화면에 여러 색이 튀지 않게 soft tone으로 제한.
export const categoryChip: Record<string, { bg: string; color: string }> = {
  revenue: { bg: '#FFFFFF', color: '#2F2E2C' },
  construction: { bg: '#F6F5F4', color: '#45413D' },
  orders: { bg: '#F0EFED', color: '#45413D' },
  collaboration: { bg: '#F6F5F4', color: '#615D59' },
  development: { bg: '#F6F5F4', color: '#615D59' },
};

// 등급(S~D)별 칩 색(solid) — grade 솔리드 토큰과 동일.
export const gradeChipColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#111111', color: '#fff' },
  A: { bg: '#2F2E2C', color: '#fff' },
  B: { bg: '#615D59', color: '#fff' },
  C: { bg: '#8A8178', color: '#fff' },
  D: { bg: '#C23A3A', color: '#fff' },
};
