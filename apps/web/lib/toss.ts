// 화면 인라인 스타일용 공용 색 토큰 — EnergyX Common Design System 2026.
// (파일명은 레거시 toss 이나 값은 EnergyX 뉴트럴/퍼플/시맨틱. 신규 코드는 Tailwind 토큰 우선.)
export const T = {
  blue50: '#F4EDFC', // purple-50
  blue300: '#B184E8', // purple-300
  blue500: '#7A37D8', // purple-500 (brand)
  blue600: '#6A2DC0', // purple-600
  blue700: '#56229F', // purple-700
  grey50: '#F7F7F9',
  grey100: '#EFEFF2',
  grey200: '#E3E3E8',
  grey300: '#CCCCD4',
  grey400: '#A0A0AC',
  grey500: '#74747F',
  grey600: '#565660',
  grey700: '#3F3F47',
  grey800: '#2A2A30',
  grey900: '#18181C',
  green500: '#16A34A',
  red500: '#E5484D',
  orange500: '#F59E0B',
} as const;

// KPI 그룹(performance_core / collaboration_growth)별 칩 색.
export const groupChip: Record<string, { bg: string; color: string }> = {
  performance_core: { bg: '#7A37D8', color: '#fff' }, // 퍼플 (핵심 성과)
  collaboration_growth: { bg: '#56229F', color: '#fff' }, // 딥 퍼플
};

// KPI 카테고리별 칩 색(도메인 5종) — 단색 톤 구분.
export const categoryChip: Record<string, { bg: string; color: string }> = {
  revenue: { bg: '#7A37D8', color: '#fff' }, // 퍼플
  construction: { bg: '#2563EB', color: '#fff' }, // info 블루
  orders: { bg: '#56229F', color: '#fff' }, // 딥 퍼플
  collaboration: { bg: '#16A34A', color: '#fff' }, // success 그린
  development: { bg: '#C97E04', color: '#fff' }, // warning 앰버
};

// 등급(S~D)별 칩 색(solid) — grade 솔리드 토큰과 동일.
export const gradeChipColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#7A37D8', color: '#fff' },
  A: { bg: '#2563EB', color: '#fff' },
  B: { bg: '#16A34A', color: '#fff' },
  C: { bg: '#F59E0B', color: '#fff' },
  D: { bg: '#E5484D', color: '#fff' },
};
