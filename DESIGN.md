---
name: Kinetic Enterprise
colors:
  surface: '#f8f9fd'
  surface-dim: '#d9dade'
  surface-bright: '#f8f9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f7'
  surface-container: '#edeef2'
  surface-container-high: '#e7e8ec'
  surface-container-highest: '#e1e2e6'
  on-surface: '#191c1f'
  on-surface-variant: '#484551'
  inverse-surface: '#2e3134'
  inverse-on-surface: '#eff1f5'
  outline: '#797582'
  outline-variant: '#cac4d2'
  surface-tint: '#6251a6'
  primary: '#3f2c80'
  on-primary: '#ffffff'
  primary-container: '#564599'
  on-primary-container: '#cbbeff'
  inverse-primary: '#cbbeff'
  secondary: '#0054ca'
  on-secondary: '#ffffff'
  secondary-container: '#336fe5'
  on-secondary-container: '#fefcff'
  tertiary: '#004346'
  on-tertiary: '#ffffff'
  tertiary-container: '#005c60'
  on-tertiary-container: '#2cdae3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e7deff'
  primary-fixed-dim: '#cbbeff'
  on-primary-fixed: '#1e0160'
  on-primary-fixed-variant: '#4a398c'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b1c5ff'
  on-secondary-fixed: '#001946'
  on-secondary-fixed-variant: '#00419e'
  tertiary-fixed: '#67f6ff'
  tertiary-fixed-dim: '#2ddbe4'
  on-tertiary-fixed: '#002021'
  on-tertiary-fixed-variant: '#004f53'
  background: '#f8f9fd'
  on-background: '#191c1f'
  surface-variant: '#e1e2e6'
typography:
  display-lg:
    fontFamily: Pretendard
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Pretendard
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Pretendard
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Pretendard
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Pretendard
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The brand identity centers on the concept of "Structured Vitality." It is designed for high-stakes enterprise environments where clarity, performance, and reliability are paramount. The target audience includes HR directors, executive leadership, and data-driven managers who require a tool that feels authoritative yet accessible.

The design style is **Corporate Modern with a Minimalist focus**. It utilizes heavy whitespace to reduce cognitive load and a structured grid to imply stability. While the core is professional, the use of vibrant teal and deep purple accents injects a sense of technological forward-movement. Visuals are crisp, avoiding unnecessary decoration in favor of functional elegance and precise alignment.

## Colors

This design system employs a sophisticated, multi-tonal palette to differentiate functional areas:

- **Primary (Deep Purple):** Reserved for high-level brand moments, primary navigation backgrounds (sidebar), and core structural elements. It provides a grounded, premium feel.
- **Secondary (True Blue):** Adjusted to a pure, high-contrast blue (`#0055cb`) for primary actions, links, and signaling progress. It represents the "engine" of the platform with improved digital clarity.
- **Tertiary (Teal/Aqua):** A high-visibility accent for data visualizations, success states, and subtle highlights. It brings "energy" to the interface.
- **Neutral/Surface:** A cool-toned light gray background (`#f8f9fd`) distinguishes the canvas from white content cards, creating a natural sense of depth without relying on heavy borders.

## Typography

The typography uses a single sans-serif family for both headlines and body text.

**Pretendard** is the default typeface across the entire product (프로젝트 확정 — 원본 스펙의 Manrope/Hanken Grotesk를 대체). It is optimized for Korean while remaining highly legible for Latin glyphs and numerals in data-dense environments. Hierarchy is expressed through the size/weight scale above, not through family changes.

For mobile devices, `display-lg` scales down to 32px, and `headline-lg` scales to 24px to maintain visual balance on smaller viewports. All body text maintains a minimum of 16px for accessibility.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for the main content area, housed within a fixed-width container on ultra-wide screens to prevent line lengths from becoming unreadable.

- **Desktop:** 12 columns, 24px gutters, 40px outer margins.
- **Tablet:** 8 columns, 16px gutters, 24px outer margins.
- **Mobile:** 4 columns, 16px gutters, 16px outer margins.

Spacing follows a strict 4px/8px baseline shift. Use `stack-lg` for separating major sections, `stack-md` for elements within a card, and `stack-sm` for tight groupings like labels and inputs.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Soft Ambient Shadows**. 

1.  **Level 0 (Background):** The neutral gray (`#f8f9fd`) acts as the base canvas.
2.  **Level 1 (Cards/Surfaces):** Pure white containers with a subtle 1px border and a very soft, diffused shadow (Offset: 0, 4px; Blur: 12px; Color: `rgba(86, 69, 153, 0.05)`).
3.  **Level 2 (Modals/Dropdowns):** Pure white with a more pronounced shadow to indicate focus and physical lift (Offset: 0, 12px; Blur: 24px; Color: `rgba(0, 0, 0, 0.08)`).

Avoid heavy black shadows; use the primary purple or neutral blue-grey to tint shadows for a more integrated, sophisticated look.

## Shapes

The shape language is consistently **Rounded (8px)**. This radius is applied to cards, buttons, and input fields to soften the "enterprise" feel while maintaining a professional structure. 

- Small components (Chips/Badges) may use a **Pill** shape to differentiate them from interactive buttons.
- Search bars should use the **Pill** shape to signify global utility.
- Container surfaces (Cards) always use the standard 8px radius.

## Components

### Buttons
- **Primary:** Solid Secondary Blue (`#0055cb`) or Primary Purple. White text. 8px radius.
- **Secondary:** Transparent with 1px border of the brand color.
- **Ghost:** No border, brand-colored text. Used for low-priority actions.

### Input Fields
- **Default:** White background, 1px light gray border. 
- **Focus:** Border transitions to Secondary Blue with a 2px soft outer glow.
- **Icons:** Use 20px line-art icons in the `text-muted` color within inputs.

### Chips & Badges
- Used for status indicators (e.g., "In Progress", "Completed").
- Use the Tertiary Teal for positive statuses with a 10% opacity background fill and 100% opacity text.

### Cards
- Standard containers for all dashboard content.
- Must include a consistent 24px internal padding.
- Headers within cards should use `label-md` for metadata and `headline-md` for titles.

### Navigation Sidebar
- Background: Primary Purple (`#564599`).
- Active State: A vertical 4px bar of Tertiary Teal on the left edge with a subtle white text highlight.

---

## 프로젝트 적용 노트 (에너지엑스 인사 평가 전용 — SSOT 보완)

위 본문은 Kinetic Enterprise 원본 스펙이다. 아래는 이 프로젝트(한국어 HR SaaS)에 적용할 때의 확정 규칙으로, 본문과 충돌 시 이 노트가 우선한다.

### 1. 글꼴 — 기본 글꼴 Pretendard (단일 패밀리)
원본 스펙의 Manrope·Hanken Grotesk 대신 **Pretendard를 기본 글꼴로 사용한다** (한글 최적화 — 사용자 확정 2026-06-11). 헤드라인·본문·라벨 모두 동일 패밀리이며, 위계는 frontmatter의 크기·굵기 스케일로만 표현한다:

```
font-family: "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"
```

숫자(KPI 수치·달성률)는 `font-variant-numeric: tabular-nums`로 표 정렬을 유지한다.

### 2. 본문 크기 — 데이터 밀도 보정
원본의 body 16~18px는 마케팅 사이트 기준이다. 데이터 고밀도 화면(테이블·평가 폼)에서는 `label-md`(14px)·`label-sm`(12px)을 본문급으로 적극 사용하되, 일반 설명 텍스트는 `body-md`(16px) 이상을 지킨다.

### 3. 도메인 시맨틱 색 (등급·상태)
팔레트에서 파생해 design-tokens.md에 확정한다. 기준 매핑:

| 토큰 | 파생 기준 |
|------|----------|
| 등급 S | primary 계열 (deep purple — `on-primary-fixed` 텍스트 / `primary-fixed` 배경) |
| 등급 A | secondary 계열 (blue — `on-secondary-fixed-variant` / `secondary-fixed`) |
| 등급 B | tertiary 계열 (teal — `on-tertiary-fixed-variant` / `tertiary-fixed` 10% 톤) |
| 등급 C | **warning 앰버 — 팔레트에 없음. 디자이너가 보완 정의** (예: `#8a5500` / `#ffddb0` 톤, 대비 AA 확인) |
| 등급 D | error 계열 (`on-error-container` / `error-container`) |
| 상태(진행중/완료/경고/오류) | progress=secondary, 완료/긍정=tertiary teal(10% bg + 100% text), 경고=warning 앰버, 오류=error |

등급 색은 항상 **색+텍스트 라벨 병기**(접근성).

### 4. 기존 구현 유지 항목 (UI만 교체)
- 기존 RBAC/인증 로직(useAuth, visibleNav)·API hooks(useKpis, useEvaluations 등)·라우트 구조 유지 — 시각 레이어만 교체.
- 차트는 recharts 유지. 시리즈 색은 tertiary(teal)·secondary(blue)·primary(purple) 순으로 배정.
- 사이드바는 본문 스펙대로 **Primary Purple 배경 + 좌측 4px Teal 활성 바** — 기존 흰 사이드바에서 전환.
