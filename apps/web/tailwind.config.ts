import type { Config } from 'tailwindcss';

// 디자인 토큰 1:1 반영 — _workspace/01_design/design-tokens.md
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EBF3FE',
          100: '#D2E4FD',
          200: '#A9CCFB',
          300: '#7DB2F9',
          400: '#509AF7',
          500: '#3182F6',
          600: '#1B64DA',
          700: '#1450B4',
          800: '#0E3C87',
          900: '#0A2C63',
        },
        success: {
          50: '#E7F8EF',
          100: '#C5EFD7',
          500: '#15B66E',
          600: '#0F9457',
          700: '#0B7544',
        },
        warning: {
          50: '#FEF6E6',
          100: '#FCEAC0',
          500: '#F5A623',
          600: '#D98A0E',
          700: '#A66800',
        },
        danger: {
          50: '#FDECEC',
          100: '#FAD2D2',
          500: '#F04452',
          600: '#D6303D',
          700: '#AE222E',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F9FAFB',
          100: '#F2F4F6',
          200: '#E5E8EB',
          300: '#D1D6DB',
          400: '#B0B8C1',
          500: '#8B95A1',
          600: '#6B7684',
          700: '#4E5968',
          800: '#333D4B',
          900: '#191F28',
        },
        // 등급 solid (막대/칩 채움) — design-tokens §1.7
        grade: {
          s: '#1B4DCB',
          a: '#3182F6',
          b: '#15B66E',
          c: '#F5A623',
          d: '#F04452',
        },
        // 등급 텍스트(fg)
        gradeFg: {
          s: '#16409F',
          a: '#1B64DA',
          b: '#0F9457',
          c: '#A66800',
          d: '#AE222E',
        },
        // 등급 연배경(bg)
        gradeBg: {
          s: '#E7EEFC',
          a: '#EBF3FE',
          b: '#E7F8EF',
          c: '#FEF6E6',
          d: '#FDECEC',
        },
        // 평가/KPI 상태 시맨틱 — design-tokens §1.6
        status: {
          'not-started-fg': '#6B7684',
          'not-started-bg': '#F2F4F6',
          'in-progress-fg': '#1B64DA',
          'in-progress-bg': '#EBF3FE',
          'submitted-fg': '#4B43BD',
          'submitted-bg': '#ECEBFB',
          'finalized-fg': '#0F9457',
          'finalized-bg': '#E7F8EF',
          'danger-fg': '#D6303D',
          'danger-bg': '#FDECEC',
        },
        // 차트/비교 보조색 — design-tokens §1.8 (v2: chart-peer 제거)
        chart: {
          'company-avg': '#191F28',
          grid: '#E5E8EB',
          self: '#8B95A1',
          'downward-1': '#3182F6',
          'downward-2': '#1B4DCB',
        },
        // 그룹 풀 상한 마커 — design-tokens §1.8
        pool: {
          'cap-marker': '#191F28',
          over: '#F04452',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        full: '9999px',
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '24px' }],
        md: ['17px', { lineHeight: '26px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['24px', { lineHeight: '32px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['34px', { lineHeight: '42px' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(25,31,40,0.04), 0 1px 3px rgba(25,31,40,0.06)',
        md: '0 2px 8px rgba(25,31,40,0.08), 0 1px 3px rgba(25,31,40,0.06)',
        lg: '0 8px 28px rgba(25,31,40,0.16), 0 2px 8px rgba(25,31,40,0.08)',
        focus: '0 0 0 2px #FFFFFF, 0 0 0 4px #3182F6',
      },
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
      maxWidth: {
        content: '1280px',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        emphasis: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
};

export default config;
