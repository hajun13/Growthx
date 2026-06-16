/**
 * 공유 Tailwind preset — 디자인 토큰 SSOT (여러 앱이 동일 디자인 시스템 공유, architecture.md §5).
 * 색 CSS 변수(hsl)는 각 앱 globals.css 의 :root/.dark 에 정의. 도메인 시각화 색(grade/status/chart/pool)은
 * 기능상 값 고정. apps 는 presets:[require('@growthx/ui/tailwind-preset.cjs')] 로 소비하고 content 만 자체 지정.
 *
 * 디자인 시스템 = EnergyX Common Design System 2026 (블랙 잉크 #0E0E14 + 퍼플 #7A37D8 + 화이트).
 * 레거시 toss.* 키는 보존하되 값은 EnergyX 뉴트럴/퍼플로 리맵 → 잔존 클래스가 자동 정정됨.
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
        // EnergyX 브랜드 퍼플 스케일 (50–900, 500 = #7A37D8)
        purple: {
          50: '#F4EDFC', 100: '#E6D6F8', 200: '#CDADF0', 300: '#B184E8',
          400: '#975CE0', 500: '#7A37D8', 600: '#6A2DC0', 700: '#56229F',
          800: '#401A77', 900: '#2C1251',
        },
        // 뉴트럴 그레이 스케일 (0 White → 950 Brand Ink #0E0E14)
        neutral: {
          0: '#FFFFFF', 50: '#F7F7F9', 100: '#EFEFF2', 200: '#E3E3E8',
          300: '#CCCCD4', 400: '#A0A0AC', 500: '#74747F', 600: '#565660',
          700: '#3F3F47', 800: '#2A2A30', 900: '#18181C', 950: '#0E0E14',
        },
        // 시맨틱 (EnergyX 신 hex — 틸 secondary 폐기)
        success: { 50: '#E9F8EF', 100: '#C9EED7', 500: '#16A34A', 600: '#128240', 700: '#0E6633' },
        warning: { 50: '#FEF5E7', 100: '#FCE6BF', 500: '#F59E0B', 600: '#C97E04', 700: '#9A6103' },
        danger: { 50: '#FDECEC', 100: '#F9CFCF', 500: '#E5484D', 600: '#C8353A', 700: '#A0282D' },
        info: { 50: '#EAF1FE', 100: '#CDDDFB', 500: '#2563EB', 600: '#1D4FC4', 700: '#173F9B' },
        // 레거시 toss.* — EnergyX 뉴트럴/퍼플로 리맵 (잔존 클래스 자동 정정)
        toss: {
          blue50: '#F4EDFC', blue300: '#B184E8', blue500: '#7A37D8',
          blue600: '#6A2DC0', blue700: '#56229F',
          grey50: '#F7F7F9', grey100: '#EFEFF2', grey200: '#E3E3E8',
          grey300: '#CCCCD4', grey400: '#A0A0AC', grey500: '#74747F',
          grey600: '#565660', grey700: '#3F3F47', grey800: '#2A2A30',
          grey900: '#18181C',
          green500: '#16A34A', red500: '#E5484D',
          orange500: '#F59E0B',
        },
        // 등급 S~D — 퍼플 + 시맨틱 램프 (solid bg / fg 텍스트 / soft bg)
        grade: { s: '#7A37D8', a: '#2563EB', b: '#16A34A', c: '#F59E0B', d: '#E5484D' },
        gradeFg: { s: '#56229F', a: '#173F9B', b: '#0E6633', c: '#9A6103', d: '#A0282D' },
        gradeBg: { s: '#F4EDFC', a: '#EAF1FE', b: '#E9F8EF', c: '#FEF5E7', d: '#FDECEC' },
        status: {
          'not-started-fg': '#565660', 'not-started-bg': '#EFEFF2',
          'in-progress-fg': '#56229F', 'in-progress-bg': '#F4EDFC',
          'submitted-fg': '#1D4FC4', 'submitted-bg': '#EAF1FE',
          'finalized-fg': '#0E6633', 'finalized-bg': '#E9F8EF',
          'danger-fg': '#C8353A', 'danger-bg': '#FDECEC',
        },
        chart: {
          'company-avg': '#0E0E14', grid: '#E3E3E8', self: '#74747F',
          'downward-1': '#7A37D8', 'downward-2': '#56229F', 'downward-3': '#C97E04',
        },
        pool: { 'cap-marker': '#0E0E14', over: '#E5484D' },
      },
      borderRadius: {
        // EnergyX 반경 스케일 — 컨트롤 8 · 카드 12 · 모달 16 · 칩/토글 pill
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        pill: '9999px',
      },
      boxShadow: {
        // EnergyX 엘레베이션 — 중립 다크 섀도 5단계 (카드=elev-1 · 모달=elev-4)
        'elev-1': '0 1px 2px rgba(14,14,20,0.06), 0 1px 3px rgba(14,14,20,0.08)',
        'elev-2': '0 2px 4px rgba(14,14,20,0.06), 0 4px 12px rgba(14,14,20,0.10)',
        'elev-3': '0 4px 8px rgba(14,14,20,0.08), 0 12px 28px rgba(14,14,20,0.14)',
        'elev-4': '0 8px 16px rgba(14,14,20,0.10), 0 24px 56px rgba(14,14,20,0.22)',
        focus: '0 0 0 3px rgba(122,55,216,0.32)',
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
