/**
 * EnergyX shared Tailwind preset — 디자인 토큰 SSOT (여러 앱이 동일 디자인 시스템 공유, architecture.md §5).
 * 색 CSS 변수(hsl)는 각 앱 globals.css 의 :root/.dark 에 정의. 도메인 시각화 색(grade/status/chart/pool)은
 * 기능상 값 고정. apps 는 presets:[require('@energyx/ui/tailwind-preset.cjs')] 로 소비하고 content 만 자체 지정.
 *
 * 디자인 시스템 = Part/ 클라이언트 재스킨(2026-07-02, `_workspace/01_design/part-revision-brief.md` SSOT).
 * 컬러풀 카드 + 등급 색 5색(S보라/A초록/B주황/C노랑진갈색글씨/D빨강) 체계로 복귀. 사이드바 전용 보라(#564599),
 * 본문 액션 블루(#0257CE) 단일 강조 + 민트(#0ED0D9) 보조. radius 10px 카드 복원(Notion 저채도 flat 폐기).
 * 레거시 purple 키는 보존하되 값은 신규 팔레트로 리맵 → 잔존 클래스가 자동으로 새 색을 받음.
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
        // 호환용 purple 스케일. 실제 값은 액션 블루(#0257CE) 계열로 매핑한다.
        purple: {
          50: '#EAF2FE', 100: '#D6E7FD', 200: '#ADCEFB', 300: '#7FB3F8',
          400: '#337FEE', 500: '#0257CE', 600: '#0246A8', 700: '#023683',
          800: '#26323B', 900: '#161326',
        },
        // 뉴트럴 스케일 (0 White → 950 Ink) — Part/ 진네이비 텍스트 위계.
        neutral: {
          0: '#FFFFFF', 50: '#F8F9FD', 100: '#F4F5FA', 200: '#E7E9F3',
          300: '#D8DCEB', 400: '#B8BDD4', 500: '#9B98AC', 600: '#6B6980',
          700: '#4A4860', 800: '#2D2A3D', 900: '#1D1B2C', 950: '#161326',
        },
        // 시맨틱은 작은 신호용으로만 사용.
        success: { 50: '#E3F7EC', 100: '#C9F0DC', 500: '#0EA05E', 600: '#0B7A47', 700: '#095F38' },
        warning: { 50: '#FFF6DC', 100: '#FFECB0', 200: '#FFE29A', 300: '#F8D06B', 500: '#F5B400', 600: '#B4790A', 700: '#8A5B00', 800: '#6B4700' },
        danger: { 50: '#FDE8E8', 100: '#FBD0D0', 200: '#F7B4B4', 500: '#EF4444', 600: '#C81E1E', 700: '#A11818' },
        info: { 50: '#EAF2FE', 100: '#D6E7FD', 200: '#BCD9FB', 500: '#0257CE', 600: '#0246A8', 700: '#023683' },
        // 등급 S~D — Part/ 브리프 §2 확정 5색(Solid: 배지 배경+대비 텍스트).
        grade: { s: '#7C3AED', a: '#0EA05E', b: '#F97316', c: '#F5B400', d: '#EF4444' },
        gradeFg: { s: '#FFFFFF', a: '#FFFFFF', b: '#FFFFFF', c: '#3D2900', d: '#FFFFFF' },
        gradeBg: { s: '#F3EBFE', a: '#E3F7EC', b: '#FFEEDD', c: '#FFF6DC', d: '#FDE8E8' },
        // 등급 Soft 세트(연한 틴트 배경 + 진한 톤 텍스트) — 설명 패널/부차 표시용.
        gradeSoftFg: { s: '#6D28D9', a: '#0B7A47', b: '#C2570A', c: '#8A5B00', d: '#C81E1E' },
        status: {
          'not-started-fg': '#6B6980', 'not-started-bg': '#F4F5FA',
          'in-progress-fg': '#0257CE', 'in-progress-bg': '#EAF2FE',
          'submitted-fg': '#0257CE', 'submitted-bg': '#EAF2FE',
          'review-fg': '#B4790A', 'review-bg': '#FFF6DC',
          'revision-fg': '#C2570A', 'revision-bg': '#FFEEDD',
          'finalized-fg': '#0B7A47', 'finalized-bg': '#E3F7EC',
          'danger-fg': '#C81E1E', 'danger-bg': '#FDE8E8',
        },
        chart: {
          'company-avg': '#161326', grid: '#E7E9F3', self: '#6B6980',
          'downward-1': '#0257CE', 'downward-2': '#7C3AED', 'downward-3': '#0ED0D9',
        },
        pool: { 'cap-marker': '#161326', over: '#EF4444' },
        // Part/ §1 원시 토큰 — 사이드바 전용 보라, 액션 블루, 민트 보조.
        sidebar: { DEFAULT: '#564599', active: '#4A3B85' },
        brand: {
          blue: '#0257CE', 'blue-hover': '#0246A8', 'blue-subtle': '#EAF2FE',
          teal: '#0ED0D9', 'teal-subtle': '#E4FBFB', 'teal-strong': '#0E7E85',
        },
      },
      borderRadius: {
        sm: 'var(--ex-radius-label, 6px)',
        md: 'var(--ex-radius-control, 8px)',
        lg: 'var(--ex-radius-card, 10px)',
        xl: 'var(--ex-radius-dialog, 10px)',
        '2xl': '10px',
        pill: 'var(--ex-radius-pill, 9999px)',
      },
      boxShadow: {
        'elev-1': '0 1px 3px rgba(22,19,38,0.06), 0 1px 2px rgba(22,19,38,0.04)',
        'elev-2': '0 4px 12px rgba(22,19,38,0.08), 0 2px 4px rgba(22,19,38,0.05)',
        'elev-3': '0 8px 24px rgba(22,19,38,0.10), 0 2px 6px rgba(22,19,38,0.06)',
        'elev-4': '0 12px 32px rgba(22,19,38,0.12), 0 4px 8px rgba(22,19,38,0.06)',
        focus: '0 0 0 2px rgba(2,87,206,0.22)',
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
