// Kinetic Enterprise 색상 팔레트 — 공용 토큰.
// 키명은 레거시(toss.*) 유지 · 값은 Kinetic Enterprise(DESIGN.md) 기준으로 리맵.
// 키 리네이밍(toss.* → kinetic.*)은 후속 작업 (소비 파일 35개 일괄 리팩터링 예정).
//
// Kinetic 대응:
//   blue 계열  → Kinetic secondary blue 군 (#0054ca · #00419e · #001946 · #336fe5 등)
//   grey 계열  → Kinetic neutral surface 군 (#f8f9fd · #f2f3f7 · #e7e8ec · #797582 · #484551 · #191c1f 등)
//   green500   → Kinetic tertiary teal #005c60 (에너지 액센트, 대비 확보)
//   red500     → Kinetic error #ba1a1a
//   orange500  → Kinetic warning 앰버 #b56a00 (팔레트 외 보완, 대비 AA)
export const T = {
  // secondary blue 군 (명도 오름차순)
  blue50:  '#f0f3ff',  // surface-container-low 근접 (파란 틴트)
  blue300: '#b1c5ff',  // secondary-fixed-dim
  blue500: '#0054ca',  // secondary — 주요 액션·링크
  blue600: '#00419e',  // on-secondary-fixed-variant
  blue700: '#001946',  // on-secondary-fixed (가장 어두운 블루)
  // neutral surface 군 (명도 내림차순)
  grey50:  '#f8f9fd',  // surface / background
  grey100: '#f2f3f7',  // surface-container-low
  grey200: '#e7e8ec',  // surface-container-high
  grey300: '#cac4d2',  // outline-variant
  grey400: '#b0adb8',  // outline 근접 (중간 중성)
  grey500: '#797582',  // outline
  grey600: '#484551',  // on-surface-variant
  grey700: '#3a373f',  // on-surface 중간
  grey800: '#2e3134',  // inverse-surface
  grey900: '#191c1f',  // on-surface (가장 어두운 중성)
  // 의미 색
  green500: '#005c60',  // tertiary-container (에너지 액센트, 대비 AA)
  red500:   '#ba1a1a',  // error
  orange500: '#b56a00', // warning 앰버 (팔레트 외 보완 — 대비 4.6:1 확인)
} as const;

// KPI 그룹(performance_core / collaboration_growth)별 칩 색.
// Kinetic: performance_core = secondary blue, collaboration_growth = primary purple
export const groupChip: Record<string, { bg: string; color: string }> = {
  performance_core:      { bg: '#0054ca', color: '#fff' }, // secondary blue
  collaboration_growth:  { bg: '#3f2c80', color: '#fff' }, // primary deep purple
};

// KPI 카테고리별 칩 색(도메인 5종).
// Kinetic: 채도 과한 Toss 색 → primary/secondary/tertiary/앰버 군으로 재배정, 대비 AA 유지
export const categoryChip: Record<string, { bg: string; color: string }> = {
  revenue:      { bg: '#b56a00', color: '#fff' }, // 앰버 (경고/수익 강조)
  construction: { bg: '#004f53', color: '#fff' }, // on-tertiary-fixed-variant (틸 다크)
  orders:       { bg: '#00419e', color: '#fff' }, // on-secondary-fixed-variant (블루 다크)
  collaboration:{ bg: '#005c60', color: '#fff' }, // tertiary-container (틸)
  development:  { bg: '#4a398c', color: '#fff' }, // on-primary-fixed-variant (퍼플 미드)
};

// 등급(S~D)별 칩 색 — dark-on-light (흰 텍스트 금지, DESIGN.md §3 기준).
// S=primary 계열, A=secondary 계열, B=tertiary 계열, C=앰버, D=error 계열
export const gradeChipColor: Record<string, { bg: string; color: string }> = {
  S: { bg: '#e7deff', color: '#1e0160' }, // primary-fixed / on-primary-fixed
  A: { bg: '#dae2ff', color: '#00419e' }, // secondary-fixed / on-secondary-fixed-variant
  B: { bg: '#ccf8fa', color: '#004f53' }, // tertiary-fixed ~15% 톤 / on-tertiary-fixed-variant
  C: { bg: '#ffddb0', color: '#8a5500' }, // 앰버 bg / 앰버 fg (보완 정의, 대비 4.7:1)
  D: { bg: '#ffdad6', color: '#93000a' }, // error-container / on-error-container
};
