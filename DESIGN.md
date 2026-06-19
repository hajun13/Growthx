---
name: EnergyX Common Design System
version: "2026-v2"
brand: ENERGYX (에너지엑스)
primary: "#7A37D8"
typeface: Pretendard
language: ko-KR
---

# EnergyX Common Design System 2026 V2

에너지엑스 제품 전반에서 일관된 UI를 만들기 위한 공통 디자인 시스템. 저수준 파운데이션(색·타이포·간격·엘레베이션)부터 재사용 컴포넌트까지 정의한다. **이 파일이 시각 언어 SSOT**이며 코드의 `packages/ui/tailwind-preset.cjs`와 `apps/web/app/globals.css`는 이 파일에서 파생된다.

> **2026-06-18 V2 적용:** Figma guide boards 01-16은 로컬 패키지 `C:\Users\user\workspace\Design`의 `@energyx/v2-design-system`으로 변환되어 있고, Docker 빌드 호환을 위해 레포 내부 `packages/design-system`으로 vendoring한다. `apps/web`은 이 패키지를 `workspace:*` 의존성으로 연결하고 `@energyx/v2-design-system/styles.css`를 앱 루트에서 import한다. 보드별 세부 규격은 `packages/design-system/docs/*.md`, CSS 계약은 `packages/design-system/styles/*.css`, headless helper는 `packages/design-system/src/*.mjs`를 따른다.

> **코드 권위:** 토큰 값이 이 문서와 `tailwind-preset.cjs` 사이에 충돌하면 **코드(tailwind-preset.cjs)가 우선**한다. 이 문서는 그 코드에 정합하도록 유지한다.

---

## 1. 브랜드 비브

- **컬러 비브:** 거의 검정에 가까운 **Brand Ink `#0E0E14`** + **퍼플 `#7A37D8`** + 화이트 3색 중심.
- 퍼플은 핵심 액션·선택 상태에만 절제해서 사용한다. 장식·그라데이션에 사용하지 않는다.
- **배경:** 솔리드만. 풀블리드 이미지·패턴·텍스처 없음. 페이지 `#F7F7F9`(neutral-50), 카드 흰색.
- **언어·카피:** 한국어 기본. 요청형·청유형 어조(`~하세요`, `~할까요?`). 이모지 사용 금지 — 상태는 색·아이콘으로.
- **숫자:** tabular-nums 고정폭. 단위는 suffix 분리(`120 kW`). 날짜 `2026.06.16` 형식.
- **애니메이션:** 120~200ms ease. 모달 8px 상승 + scale .98→1. 바운스·무한 루프 없음.

---

## 2. 컬러 팔레트

### 2-1. 브랜드 퍼플 (50–900)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--purple-50` | `#F4EDFC` | soft 배경, 등급 S 배경 |
| `--purple-100` | `#E6D6F8` | 호버 틴트 |
| `--purple-200` | `#CDADF0` | 포커스 보더 보조 |
| `--purple-300` | `#B184E8` | — |
| `--purple-400` | `#975CE0` | — |
| `--purple-500` | `#7A37D8` | **PRIMARY** — 핵심 액션·선택 상태 |
| `--purple-600` | `#6A2DC0` | 호버, 등급 S 텍스트 액센트 |
| `--purple-700` | `#56229F` | 프레스, 사이드바 활성 배경 |
| `--purple-800` | `#401A77` | — |
| `--purple-900` | `#2C1251` | — |

### 2-2. 뉴트럴 그레이 (0–950)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--neutral-0` | `#FFFFFF` | 카드·모달 배경 |
| `--neutral-50` | `#F8FAFC` | V2 페이지 캔버스(`--surface-page`) |
| `--neutral-100` | `#EEF2F7` | V2 sunken 배경, 구분선 배경 |
| `--neutral-200` | `#E3E3E8` | subtle 보더 |
| `--neutral-300` | `#CCCCD4` | 기본 보더 |
| `--neutral-400` | `#A0A0AC` | strong 보더, disabled 텍스트 |
| `--neutral-500` | `#74747F` | muted 텍스트 |
| `--neutral-600` | `#565660` | — |
| `--neutral-700` | `#3F3F47` | 보조 텍스트 |
| `--neutral-800` | `#2A2A30` | 기본 텍스트 |
| `--neutral-900` | `#18181C` | — |
| `--neutral-950` | `#0E0E14` | **Brand Ink** — 최고 명도 텍스트·사이드바 |

### 2-3. 시맨틱 색 (Semantic)

| 카테고리 | 50 (soft bg) | 500 (solid) | 600 (hover) | 700 (text/fg) |
|----------|-------------|-------------|-------------|----------------|
| success | `#E9F8EF` | `#16A34A` | `#128240` | `#0E6633` |
| warning | `#FEF5E7` | `#F59E0B` | `#C97E04` | `#9A6103` |
| danger | `#FDECEC` | `#E5484D` | `#C8353A` | `#A0282D` |
| info | `#EAF1FE` | `#2563EB` | `#1D4FC4` | `#173F9B` |

### 2-4. 시맨틱 별칭 토큰 (컴포넌트에서 사용)

| 토큰 | 참조 | 설명 |
|------|------|------|
| `--color-primary` | `--purple-500` | 퍼플 기본 |
| `--color-primary-hover` | `--purple-600` | 호버 |
| `--color-primary-active` | `--purple-700` | 프레스 |
| `--color-primary-subtle` | `--purple-50` | 틴트 배경 |
| `--color-on-primary` | `--neutral-0` | 퍼플 위 텍스트 |
| `--text-strong` | `--neutral-950` | 최고 명도 텍스트 |
| `--text-default` | `--neutral-800` | 기본 텍스트 |
| `--text-muted` | `--neutral-500` | 보조 텍스트 |
| `--text-disabled` | `--neutral-400` | 비활성 |
| `--text-placeholder` | `--neutral-400` | 플레이스홀더 |
| `--text-on-fill` | `--neutral-0` | 채움 배경 위 텍스트 |
| `--text-link` | `--purple-500` | 링크 |
| `--surface-page` | `--neutral-50` | 페이지 배경 |
| `--surface-card` | `--neutral-0` | 카드 배경 |
| `--surface-sunken` | `--neutral-100` | 들어간 영역 |
| `--surface-hover` | `--neutral-50` | 호버 배경 |
| `--surface-active` | `--neutral-100` | 활성 배경 |
| `--surface-inverse` | `--neutral-950` | 반전 배경(툴팁 등) |
| `--border-subtle` | `--neutral-200` | 가벼운 구분선 |
| `--border-default` | `--neutral-300` | 기본 보더 |
| `--border-strong` | `--neutral-400` | 강조 보더 |
| `--border-focus` | `--purple-500` | 포커스 보더 |
| `--status-success-bg` | `--success-50` | — |
| `--status-success-fg` | `--success-700` | — |
| `--status-success-solid` | `--success-500` | — |
| `--status-warning-bg` | `--warning-50` | — |
| `--status-warning-fg` | `--warning-700` | — |
| `--status-warning-solid` | `--warning-500` | — |
| `--status-danger-bg` | `--danger-50` | — |
| `--status-danger-fg` | `--danger-700` | — |
| `--status-danger-solid` | `--danger-500` | — |
| `--status-info-bg` | `--info-50` | — |
| `--status-info-fg` | `--info-700` | — |
| `--status-info-solid` | `--info-500` | — |
| `--focus-ring` | `0 0 0 3px rgba(122,55,216,.32)` | 키보드 포커스 링 |
| `--overlay` | `rgba(14,14,20,.55)` | 모달 스크림 |

---

## 3. 타이포그래피

### 3-1. 서체

- **단일 패밀리:** Pretendard (한국어 최적화). 헤드라인·본문·라벨 모두 동일 패밀리.
- 위계는 크기·굵기 스케일로만 표현한다 (패밀리 변경 금지).
- **폴백 스택:** `"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`
- **행간:** 1.5~1.6 (한글 가독성). **자간:** -0.01~-0.025em (Pretendard 최적값).
- 숫자(KPI 수치·달성률) → `font-variant-numeric: tabular-nums`

### 3-2. 사이즈 스케일

| 토큰 | px | 굵기 | 행간 | 자간 | 용도 |
|------|----|------|------|------|------|
| `--fs-display-l` | 48 | 800 ExtraBold | 1.25 | -0.025em | 랜딩 히어로 |
| `--fs-display-m` | 40 | 800 | 1.25 | -0.025em | — |
| `--fs-display-s` | 32 | 700 Bold | 1.3 | -0.025em | — |
| `--fs-heading-l` | 28 | 700 | 1.35 | -0.02em | 페이지 대제목 |
| `--fs-heading-m` | 24 | 600 SemiBold | 1.4 | -0.02em | 섹션 제목 |
| `--fs-heading-s` | 20 | 600 | 1.4 | -0.02em | 카드 제목 |
| `--fs-title` | 18 | 600 | 1.5 | -0.01em | 서브 타이틀 |
| `--fs-body-l` | 16 | 400 Regular | 1.6 | -0.01em | 기본 본문 |
| `--fs-body-m` | 15 | 400 | 1.6 | -0.01em | 보조 본문 |
| `--fs-body-s` | 14 | 400 | 1.5 | -0.01em | 소형 본문, 고밀도 테이블 |
| `--fs-label` | 13 | 500 Medium | 1.4 | 0 | 라벨·메타데이터 |
| `--fs-caption` | 12 | 500 | 1.4 | 0 | 캡션·뱃지 텍스트 |

> **데이터 고밀도 보정:** 테이블·평가 폼에서 `--fs-body-s`(14px)·`--fs-caption`(12px)을 본문급으로 적극 사용. 일반 설명 텍스트는 `--fs-body-l`(16px) 이상 유지.

---

## 4. 간격 (Spacing)

4px 베이스 그리드. 모든 내부 패딩·레이아웃 간격을 동일 스케일로 통일한다.

| 토큰 | 값 | 용도 |
|------|----|------|
| `--space-1` | 4px | 최소 간격 |
| `--space-2` | 8px | 타이트 그룹 |
| `--space-3` | 12px | 인라인 요소 간격 |
| `--space-4` | 16px | 기본 패딩 |
| `--space-5` | 20px | 섹션 내 간격 |
| `--space-6` | 24px | 카드 내부 패딩, 가로 거터 |
| `--space-8` | 32px | 섹션 간격(stack-lg) |
| `--space-10` | 40px | 데스크탑 아우터 마진 |
| `--space-12` | 48px | — |
| `--space-16` | 64px | — |

### 그리드 & 브레이크포인트

| | Mobile | Tablet | Desktop |
|--|--------|--------|---------|
| 기준 | 360px | 768px | 1024px |
| 컬럼 | 4 | 8 | 12 |
| 거터 | 16px | 24px | 24px |
| 아우터 마진 | 16px | 32px | 40px |
| 컨테이너 최대 | — | — | 1440px |

---

## 5. 모서리 반경 (Radius)

| 토큰 | 값 | 적용 대상 |
|------|----|----------|
| `--ex-radius-label` | 8px | 상태 라벨, 등급 라벨, 표 내부 메타 태그 |
| `--ex-radius-panel` | 8px | 표 컨테이너, 헤더 셀, 미세 패널 |
| `--ex-radius-control` | 8px | **버튼·입력·선택 컨트롤** |
| `--ex-radius-card` | 8px | **카드·정보 패널** |
| `--ex-radius-dialog` | 8px | **모달·팝오버·드롭다운** |
| `--ex-radius-pill` | 8px | 필터 칩·토글·검색바·아바타·진행바 |

**원칙:** 컴포넌트 반경은 8px로 통일한다. 단, 페이지 구성은 8px 카드만 반복하지 않고 무반경 구분선·flat section·테이블 행을 섞어 실제 업무툴처럼 보이게 한다. `rounded-full`, `rounded-xl` 이상, pill 남발은 신규 UI에서 금지한다.

---

## 6. 엘레베이션 (Elevation)

중립 다크 섀도 5단계. 컬러 섀도 없음.

| 레벨 | 토큰 | 그림자 값 | 적용 대상 |
|------|------|-----------|----------|
| 0 | `--elevation-0` | `none` | Flat (보더만으로 구분) |
| 1 | `--elevation-1` | `0 1px 2px rgba(14,14,20,.06), 0 1px 3px rgba(14,14,20,.08)` | **카드** |
| 2 | `--elevation-2` | `0 2px 4px rgba(14,14,20,.06), 0 4px 12px rgba(14,14,20,.10)` | 호버 카드, Raised |
| 3 | `--elevation-3` | `0 4px 8px rgba(14,14,20,.08), 0 12px 28px rgba(14,14,20,.14)` | 드롭다운·팝오버·툴팁 |
| 4 | `--elevation-4` | `0 8px 16px rgba(14,14,20,.10), 0 24px 56px rgba(14,14,20,.22)` | **모달·다이얼로그** |
| focus | `--elevation-focus` | `0 0 0 3px rgba(122,55,216,.32)` | 키보드 포커스 링 |

---

## 7. 아이콘

- **공식 세트:** [Lucide](https://lucide.dev) — `stroke-width: 2`, round linecap/linejoin.
- **스타일:** 라인(스트로크) 전용. 채움형(filled) 사용 금지.
- **크기:** 인라인 16px / 버튼·입력 내부 18–20px / 강조 영역 24px.
- **색상:** 항상 `currentColor` 상속. 브랜드 퍼플 단독 강조 최소화.
- 이모지·유니코드를 아이콘 대용으로 사용하지 않는다.

```tsx
import { Plus, BarChart2, AlertCircle } from "lucide-react";
// 버튼 내부: size={18}
// 강조 영역: size={24}
// 인라인 텍스트: size={16}
```

---

## 8. 인터랙션 상태

| 상태 | 규칙 |
|------|------|
| 호버 | 솔리드 버튼: 한 단계 어둡게(`-600`). 고스트·secondary: `--surface-hover` 배경 |
| 프레스 | 0.5px translateY 하강 + 더 어두운 색(`-700`) |
| 포커스 | 아웃라인 제거 + `--focus-ring` 적용 (퍼플 ring 3px) |
| 비활성 | `opacity: 0.45` + `cursor: not-allowed` |
| 보더 | 기본 1px `--border-default` → 호버 `--border-strong` → 포커스 `--border-focus` + ring |

---

## 9. 컴포넌트 규격 요약

### 9-1. Button

| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `variant` | `primary \| secondary \| tertiary \| danger \| subtle` | `primary` | 스타일 변형 |
| `size` | `sm \| md \| lg` | `md` | 높이 32/40/48px |
| `fullWidth` | boolean | false | 100% 너비 |
| `loading` | boolean | false | 스피너 + disabled |
| `leftIcon` | ReactNode | — | 좌측 아이콘 |
| `rightIcon` | ReactNode | — | 우측 아이콘 |

- **radius:** 8px. 아이콘 버튼도 동일 반경을 기본으로 한다.
- **focus:** `box-shadow: var(--focus-ring)`
- **primary:** `background: var(--color-primary)` → 호버 `var(--color-primary-hover)`
- **secondary:** 흰 배경 + `var(--border-default)` 보더
- **tertiary(ghost):** 투명 배경, `var(--text-default)` 텍스트
- **danger:** `var(--status-danger-solid)` 배경

### 9-2. IconButton

- Button의 정사각형 변형. `size` sm(32)/md(40)/lg(48)px.
- `aria-label` 필수.

### 9-3. Badge

| prop | 타입 | 기본값 |
|------|------|--------|
| `color` | `neutral \| primary \| success \| warning \| danger \| info` | `neutral` |
| `appearance` | `soft \| solid \| outline` | `soft` |
| `pill` | boolean | false |
| `dot` | boolean | false |

- 높이 22px, `--fs-caption`(12px), `weight-semibold`.
- pill 변형은 신규 UI에서 만들지 않는다. 기존 호환 prop이 필요하면 시각 반경은 8px로 렌더링한다.
- soft: 카테고리-50 배경 + 카테고리-700 텍스트.
- solid: 카테고리-500 배경 + 흰 텍스트.
- outline: 투명 배경 + 1px inset border.

### 9-4. Chip

- 선택형(toggle) 또는 삭제 가능 칩. 반경은 8px.
- 선택됨: `--color-primary-subtle` 배경 + `--color-primary-active` 텍스트 + 1px 퍼플 보더.
- 미선택: `--neutral-100` 배경.

### 9-5. Tabs

| variant | 설명 |
|---------|------|
| `line` | 하단 2px 퍼플 언더라인, 기본 탭 |
| `pill` | 호환용 이름. 실제 시각 반경은 8px |

- 비활성: `--text-muted`. 활성: `--color-primary`.
- `role="tablist"` + `aria-selected`.

### 9-6. Pagination

- `chevron-left / chevron-right` Lucide 아이콘.
- 현재 페이지: `--color-primary` 배경 + 흰 텍스트.
- 비활성 화살표: `--text-disabled`.

### 9-7. Input / Textarea / Select

- 기본: 흰 배경 + 1px `--border-default` + `--ex-radius-control`(8px), 높이 40px.
- 포커스: 1px `--border-focus`(퍼플) + `--focus-ring`.
- 오류: 1px `--status-danger-solid` + 아래 `--status-danger-fg` 메시지.
- 비활성: `--surface-sunken` 배경 + `opacity .6`.
- 선행 아이콘: Lucide 18px `--text-muted`.

### 9-8. Checkbox / Radio / Switch

- Checkbox·Radio: 체크됨 → `--color-primary` 채움.
- Switch: 켜짐 → `--color-primary` 트랙. 트랙 높이 22px, 너비 40px, 반경 8px.
- 모두 `--focus-ring` 포커스 지원.

### 9-9. FormField

- `label` + 입력 컴포넌트 + `helperText` / `errorText` 조합.
- `required` 시 `*` 표시(`--status-danger-solid` 색).

### 9-10. DatePicker

- Input 외형. 캘린더 팝오버 `--elevation-3`.
- 선택일: `--color-primary` 배경 + 흰 텍스트. 오늘: 퍼플 점 표시.

### 9-11. Tooltip

- 트리거 호버/포커스 시 나타남. 250ms delay.
- `--surface-inverse`(#0E0E14) 배경 + 흰 텍스트, 반경 8px, `--elevation-3`.
- `role="tooltip"`.

### 9-12. Modal

- 스크림 `--overlay`(rgba(14,14,20,.55)).
- 패널 흰 배경 + `--ex-radius-dialog`(8px) + `--elevation-4`.
- 최대 너비 560px. 모바일 하단 시트.
- 8px 상승 + scale .98→1 진입 애니메이션.
- `aria-modal="true"`, `aria-labelledby`.

### 9-13. ConfirmDialog

- Modal의 단순화 변형. 제목 + 설명 + 버튼 2개(취소/확인).
- 위험 작업: 확인 버튼 `variant="danger"`.

### 9-14. Toast / ToastStack

- `success / warning / danger / info` 4종.
- 우하단 고정, 스택. 자동 닫힘 5초(dismiss 가능).
- `role="status"` / `role="alert"`.

### 9-15. Drawer

- 우측 패널. 너비 360px(기본)~560px.
- `--elevation-4` 그림자. 스크림 옵션.
- 닫기: ESC + 외부 클릭.

### 9-16. DropdownMenu

- 트리거 클릭 시 `--elevation-3` 패널.
- 항목 호버: `--surface-hover`. 위험 항목: `--status-danger-fg` 텍스트.
- `role="menu"`, `role="menuitem"`.

---

## 10. 프로젝트 적용 노트 (에너지엑스 인사 평가 전용)

이 섹션은 인사평가 솔루션(`apps/web`)에 디자인 시스템을 적용할 때의 확정 규칙이다. 위 본문과 충돌 시 이 노트가 우선한다.

### 10-1. 토큰 SSOT 위치

| 파일 | 역할 |
|------|------|
| `packages/design-system` | Figma guide boards 01-16에서 내려온 V2 패키지의 레포 내부 사본. Docker 빌드와 CI는 이 workspace 패키지를 사용. |
| `packages/ui/tailwind-preset.cjs` | 색(purple/neutral/semantic/grade/status/chart/pool)·radius·boxShadow elev-* Tailwind 확장. **여러 앱이 공유하는 코드 SSOT.** |
| `apps/web/app/globals.css` | shadcn HSL CSS 변수(`--background`, `--primary` 등)와 `--ex-radius-*` 앱 전용 오버라이드. |
| `apps/web/app/layout.tsx` | `@energyx/v2-design-system/styles.css` 전역 import 위치. |
| `apps/web/lib/grade.ts` | 등급 S~D `GradeColor` 레코드(bg/fg). 컴포넌트가 직접 참조. |
| `apps/web/lib/ui.ts` | `gradeBgClass`, `gradeSolidClass` 유틸 함수. |

### 10-2. 글꼴 로드

```ts
// tailwind-preset.cjs fontFamily.sans
['"Pretendard Variable"', 'Pretendard', '-apple-system', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif']
```

Pretendard Variable은 npm 패키지(`@jsdevtools/pretendard` 또는 CDN)로 로드. OTF 9 웨이트 대체 가능.

### 10-3. 등급 색 (S~D) — 확정

등급 색은 항상 **색 + 텍스트 라벨을 병기**한다(접근성 대비 AA 준수).

| 등급 | solid(`grade.*`) | soft bg(`gradeBg.*`) | text/fg(`gradeFg.*`) | 의미 |
|------|-----------------|---------------------|---------------------|------|
| S | `#7A37D8` purple-500 | `#F4EDFC` purple-50 | `#56229F` purple-700 | 최우수 |
| A | `#2563EB` info-500 | `#EAF1FE` info-50 | `#173F9B` info-700 | 우수 |
| B | `#16A34A` success-500 | `#E9F8EF` success-50 | `#0E6633` success-700 | 양호 |
| C | `#F59E0B` warning-500 | `#FEF5E7` warning-50 | `#9A6103` warning-700 | 보통 |
| D | `#E5484D` danger-500 | `#FDECEC` danger-50 | `#A0282D` danger-700 | 미흡 |

`lib/grade.ts`의 `GRADE_COLOR`: `bg = gradeBg`, `fg = gradeFg(600 음영)`.

### 10-4. 평가 상태 색

| 상태 | bg | fg |
|------|----|----|
| `not_started` | `--neutral-100` (#EFEFF2) | `--neutral-600` (#565660) |
| `in_progress` | `--purple-50` (#F4EDFC) | `--purple-700` (#56229F) |
| `submitted` | `--info-50` (#EAF1FE) | `--info-600` (#1D4FC4) |
| `finalized` | `--success-50` (#E9F8EF) | `--success-700` (#0E6633) |
| `rejected` | `--danger-50` (#FDECEC) | `--danger-600` (#C8353A) |

### 10-5. 사이드바

- **배경:** Brand Ink `#0E0E14`(neutral-950) — 솔리드.
- **활성 항목:** 좌측 4px 퍼플(`#7A37D8`) 바 + 흰 텍스트 + `--purple-50` 배경.
- **비활성 텍스트:** `rgba(255,255,255,0.65)`.
- **호버:** `rgba(255,255,255,0.08)` 배경.
- 그라데이션 사용 금지.

### 10-6. 차트 색 시리즈

| 시리즈 | 색 | Tailwind 키 |
|--------|----|-------------|
| downward-1(1차 팀장) | `#7A37D8` | `chart.downward-1` |
| downward-2(2차 본부장) | `#56229F` | `chart.downward-2` |
| downward-3(최종 그룹대표) | `#C97E04` | `chart.downward-3` |
| self(본인) | `#74747F` | `chart.self` |
| 전사 평균 마커 | `#0E0E14` | `chart.company-avg` |
| 그리드 선 | `#E3E3E8` | `chart.grid` |

### 10-7. 카드 패딩 표준

- 일반 카드: `p-6`(24px).
- 데이터 고밀도 카드(테이블 포함): `p-4`(16px) 헤더 + 테이블 셀 `py-3 px-4`.
- AppShell `<main>`이 `px-4 py-6 lg:px-8` 여백을 제공하므로 **페이지 루트에 추가 패딩 금지**.

### 10-8. 보존 항목 (재스킨 범위 밖)

- RBAC/인증 로직(`useAuth`, `visibleNav`) 및 API hooks (`useKpis`, `useEvaluations` 등) 변경 금지.
- recharts 유지. 시리즈 색만 §10-6으로 교체.
- 라우트 구조 불변.

### 10-9. 폐기 항목

| 폐기 | 대체 |
|------|------|
| Kinetic Enterprise 팔레트 (primary `#3f2c80`, secondary `#0054ca`, tertiary teal `#004346`) | EnergyX 팔레트 (primary `#7A37D8`, semantic 4종) |
| Toss 디자인 언어(`#3182f6`, `gradeChipColor`) | EnergyX 등급색(`GRADE_COLOR`) |
| 글래스/오로라/그라데이션 배경 | 솔리드 배경만 |
| 틸 secondary 역할 | 폐기 — success `#16A34A`로 대체 |
| `tds-design-language.md` | 이 파일(DESIGN.md) |

---

*최종 갱신: 2026-06-18 — EnergyX V2 Design System 패키지 연결 및 라운드 스케일 재정의*
