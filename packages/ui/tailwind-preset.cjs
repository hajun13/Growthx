/**
 * 공유 Tailwind preset — 디자인 토큰 SSOT (여러 앱이 동일 디자인 시스템 공유, architecture.md §5).
 * 색 CSS 변수(hsl)는 각 앱 globals.css 의 :root/.dark 에 정의. 도메인 시각화 색(grade/status/chart/pool)은
 * 기능상 값 고정. apps 는 presets:[require('@growthx/ui/tailwind-preset.cjs')] 로 소비하고 content 만 자체 지정.
 *
 * NOTE: 팔레트 명(toss.*)·일부 값은 기존 코드 보존(동작/시각 불변). Kinetic 네이밍 정리는 별도 디자인 작업.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // toss.* 키명은 레거시 유지 · 값은 Kinetic Enterprise(DESIGN.md) 기준 리맵.
        // 키 리네이밍(toss.* → kinetic.*)은 후속 작업 (소비 3파일 일괄 리팩터링 예정).
        toss: {
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
          green500:  '#005c60',  // tertiary-container (에너지 액센트)
          red500:    '#ba1a1a',  // error
          orange500: '#b56a00',  // warning 앰버 (보완 정의, 대비 4.6:1)
        },
        // success — Kinetic tertiary teal 군
        success: { 50: '#e0fafb', 100: '#b5f3f5', 500: '#005c60', 600: '#004346', 700: '#002b2d' },
        // warning — 앰버 보완 정의 (팔레트 외, 대비 AA 확인)
        warning: { 50: '#fff3e0', 100: '#ffddb0', 500: '#b56a00', 600: '#8a5500', 700: '#5c3800' },
        // danger — Kinetic error 군
        danger: { 50: '#fff0ee', 100: '#ffdad6', 500: '#ba1a1a', 600: '#93000a', 700: '#690005' },
        // grade — dark-on-light (DESIGN.md §3 기준, 흰 텍스트 금지)
        // 호환: grade.s/a/b/c/d는 일반 색 값 (배경색으로 사용 시 gradeBg 참조)
        grade:   { s: '#1e0160', a: '#00419e', b: '#004f53', c: '#8a5500', d: '#93000a' },
        gradeFg: { s: '#1e0160', a: '#00419e', b: '#004f53', c: '#8a5500', d: '#93000a' },
        gradeBg: { s: '#e7deff', a: '#dae2ff', b: '#ccf8fa', c: '#ffddb0', d: '#ffdad6' },
        // status — progress=secondary blue, 완료/긍정=tertiary teal, submitted=primary purple, danger=error
        status: {
          'not-started-fg': '#797582', 'not-started-bg': '#f2f3f7',   // outline / surface-container-low
          'in-progress-fg': '#00419e', 'in-progress-bg': '#dae2ff',   // on-secondary-fixed-variant / secondary-fixed
          'submitted-fg':   '#4a398c', 'submitted-bg':   '#e7deff',   // on-primary-fixed-variant / primary-fixed
          'finalized-fg':   '#004f53', 'finalized-bg':   '#ccf8fa',   // on-tertiary-fixed-variant / tertiary 10% 톤
          'danger-fg':      '#93000a', 'danger-bg':      '#ffdad6',   // on-error-container / error-container
        },
        // chart — 시리즈 순서 tertiary(teal)→secondary(blue)→primary(purple), DESIGN.md §4 기준
        chart: {
          'company-avg': '#191c1f',  // on-surface (전사 평균 마커)
          grid:          '#e7e8ec',  // surface-container-high
          self:          '#797582',  // outline (본인 계열)
          'downward-1':  '#0054ca', // secondary blue (1차 팀장)
          'downward-2':  '#00419e', // on-secondary-fixed-variant (2차 본부장)
          'downward-3':  '#004f53', // on-tertiary-fixed-variant (최종 그룹대표, tertiary teal)
        },
        pool: { 'cap-marker': '#191c1f', over: '#ba1a1a' }, // on-surface / error
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
