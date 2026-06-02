import type { Config } from 'tailwindcss';

// shadcn/ui (Tailwind v3) 표준 테마 + Pretendard 글꼴.
// CSS 변수는 app/globals.css 의 :root/.dark 에 정의(HSL).
// 도메인 데이터 시각화용 색(grade/status/chart/pool/success/warning/danger)은 보존.
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
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
        // ── 도메인 데이터 시각화 색(기능상 유지) ──
        success: { 50: '#E7F8EF', 100: '#C5EFD7', 500: '#15B66E', 600: '#0F9457', 700: '#0B7544' },
        warning: { 50: '#FEF6E6', 100: '#FCEAC0', 500: '#F5A623', 600: '#D98A0E', 700: '#A66800' },
        danger: { 50: '#FDECEC', 100: '#FAD2D2', 500: '#F04452', 600: '#D6303D', 700: '#AE222E' },
        grade: { s: '#1B4DCB', a: '#3182F6', b: '#15B66E', c: '#F5A623', d: '#F04452' },
        gradeFg: { s: '#16409F', a: '#1B64DA', b: '#0F9457', c: '#A66800', d: '#AE222E' },
        gradeBg: { s: '#E7EEFC', a: '#EBF3FE', b: '#E7F8EF', c: '#FEF6E6', d: '#FDECEC' },
        status: {
          'not-started-fg': '#6B7684', 'not-started-bg': '#F2F4F6',
          'in-progress-fg': '#1B64DA', 'in-progress-bg': '#EBF3FE',
          'submitted-fg': '#4B43BD', 'submitted-bg': '#ECEBFB',
          'finalized-fg': '#0F9457', 'finalized-bg': '#E7F8EF',
          'danger-fg': '#D6303D', 'danger-bg': '#FDECEC',
        },
        chart: {
          'company-avg': '#191F28', grid: '#E5E8EB', self: '#8B95A1',
          'downward-1': '#3182F6', 'downward-2': '#1B4DCB',
        },
        pool: { 'cap-marker': '#191F28', over: '#F04452' },
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

export default config;
