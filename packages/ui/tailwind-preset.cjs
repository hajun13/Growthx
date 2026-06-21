/**
 * 공유 Tailwind preset — 디자인 토큰 SSOT (여러 앱이 동일 디자인 시스템 공유, architecture.md §5).
 * 색 CSS 변수(hsl)는 각 앱 globals.css 의 :root/.dark 에 정의. 도메인 시각화 색(grade/status/chart/pool)은
 * 기능상 값 고정. apps 는 presets:[require('@growthx/ui/tailwind-preset.cjs')] 로 소비하고 content 만 자체 지정.
 *
 * 디자인 시스템 = EnergyX Notion-Low-Color (웜 캔버스 + 흑백/그레이 + Notion Blue #0075DE).
 * 레거시 purple 키는 보존하되 값은 블루/그레이로 리맵 → 잔존 클래스가 자동 저채도화됨.
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
        // 호환용 purple 스케일. 실제 값은 Notion Blue/neutral로 매핑한다.
        purple: {
          50: '#EAF4FF', 100: '#D6EAFF', 200: '#ADD6FF', 300: '#7FBFFF',
          400: '#3398EA', 500: '#0075DE', 600: '#005BAB', 700: '#004780',
          800: '#26323B', 900: '#111111',
        },
        // 웜 뉴트럴 스케일 (0 White → 950 Ink)
        neutral: {
          0: '#FFFFFF', 50: '#F6F5F4', 100: '#F0EFED', 200: '#E6E2DE',
          300: '#D8D3CD', 400: '#B8B1AA', 500: '#9A948E', 600: '#615D59',
          700: '#45413D', 800: '#2F2E2C', 900: '#1D1C1A', 950: '#111111',
        },
        // 시맨틱은 작은 신호용으로만 사용.
        success: { 50: '#F5F5F3', 100: '#E6E2DE', 500: '#168A45', 600: '#12733A', 700: '#0F5F31' },
        warning: { 50: '#F5F5F3', 100: '#E6E2DE', 500: '#A66A00', 600: '#8A5900', 700: '#6E4700' },
        danger: { 50: '#F5F5F3', 100: '#E6E2DE', 500: '#C23A3A', 600: '#A83232', 700: '#8A2929' },
        info: { 50: '#EAF4FF', 100: '#D6EAFF', 500: '#0075DE', 600: '#005BAB', 700: '#004780' },
        // 등급 S~D — 저채도 배지/차트용.
        grade: { s: '#111111', a: '#2F2E2C', b: '#615D59', c: '#8A8178', d: '#C23A3A' },
        gradeFg: { s: '#111111', a: '#2F2E2C', b: '#615D59', c: '#8A8178', d: '#8A2929' },
        gradeBg: { s: '#FFFFFF', a: '#FFFFFF', b: '#F6F5F4', c: '#F0EFED', d: '#FFFFFF' },
        status: {
          'not-started-fg': '#615D59', 'not-started-bg': '#F0EFED',
          'in-progress-fg': '#0075DE', 'in-progress-bg': '#EAF4FF',
          'submitted-fg': '#005BAB', 'submitted-bg': '#EAF4FF',
          'finalized-fg': '#168A45', 'finalized-bg': '#F5F5F3',
          'danger-fg': '#C23A3A', 'danger-bg': '#F5F5F3',
        },
        chart: {
          'company-avg': '#111111', grid: '#E6E2DE', self: '#615D59',
          'downward-1': '#0075DE', 'downward-2': '#2F2E2C', 'downward-3': '#9A948E',
        },
        pool: { 'cap-marker': '#111111', over: '#C23A3A' },
      },
      borderRadius: {
        sm: 'var(--ex-radius-panel, 0px)',
        md: 'var(--ex-radius-control, 4px)',
        lg: 'var(--ex-radius-card, 0px)',
        xl: 'var(--ex-radius-dialog, 0px)',
        '2xl': '0px',
        pill: 'var(--ex-radius-pill, 9999px)',
      },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(17,17,17,0.06)',
        'elev-2': '0 10px 28px rgba(17,17,17,0.14)',
        'elev-3': '0 10px 28px rgba(17,17,17,0.14)',
        'elev-4': '0 10px 28px rgba(17,17,17,0.14)',
        focus: '0 0 0 2px rgba(0,117,222,0.22)',
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
