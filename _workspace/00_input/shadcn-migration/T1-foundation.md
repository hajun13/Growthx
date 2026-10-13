# T1 — foundation 세션 명세 (현재 워크트리 `C:\Users\user\orca\Growthx`, 브랜치 feat/shadcn-migration)

먼저 `_workspace/00_input/shadcn-migration/plan.md` 를 읽어라(확정 결정·소유권·공통 규칙). 루트 `DESIGN.md` 가 시각 SSOT.
**코드를 건드리기 전에 `nextjs-frontend` 스킬을 Skill 도구로 먼저 호출하라(예외 없음).** 독립 작업은 서브에이전트(frontend-engineer, sonnet)로
병렬 팬아웃해도 된다 — 단 같은 파일을 두 에이전트가 동시에 만지지 않게 나눠라.

이 세션이 끝나야 기능 그룹 6개 세션(T3~T8)이 시작된다 = **크리티컬 패스**. 품질과 속도 둘 다 중요.

## 현재 사실 (코디네이터 실측)

- `apps/web`: Next 14.2.5, React 18.3.1, Tailwind 3.4.6, `components.json`(style new-york, rsc, cssVariables, tailwind.config 기반) 존재.
- 토큰 SSOT: `packages/ui/tailwind-preset.cjs`(JS preset — 색 hsl 변수 매핑 + neutral/success/warning/danger/info/grade/gradeFg/gradeBg/
  gradeSoftFg/status/chart/pool/sidebar/brand 스케일, radius sm=6 md=8 lg=10 xl=10 2xl=10 pill, shadow elev-1~4/focus,
  accordion 키프레임, `tailwindcss-animate`), `apps/web/app/globals.css`(shadcn hsl 변수 `:root`/`.dark`, `--ex-radius-*`, `.gx-*` 유틸 클래스 다수).
- `components/ui/` 에 shadcn 18종 이미 존재(alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, label, progress,
  radio-group, scroll-area, select, separator, sheet, skeleton, sonner, table, tabs, textarea, tooltip) — forwardRef 스타일, Part 토큰으로 일부 튜닝됨.
- 레거시 래퍼 사용량(import 수): Button 49, States 46, Card 29, Toast 28, PageContainer 28, PageHeader 27, Modal 22, GradeChip 19,
  InfoBanner 15, Avatar 13, HeaderMetrics 11, FilterChipBar 11, DesignLabel 11, SearchInput 8, StatusBadge 6, Select 6, TextField 5,
  HelpTooltip 5, Tabs 4, Collapsible 4, SegmentedControl 3, DataTable 3, Pagination 2.
  `Button.tsx` 는 `@energyx/ui` 의 `getButtonClasses`(packages/design-system 기반) 사용.
- lint 대상 패턴(apps/web): 임의값 `x-[..]` 1308, `style={{` 538, raw `<button` 117, `<input` 53, `<table` 24, `<select` 6.
- `@shadcn/lint@0.2.1`·`eslint@10`·`@typescript-eslint/parser`·`shadcn@4.21` CLI 는 설치돼 있다(설정 파일은 아직 없음).
  README: `node_modules/@shadcn/lint/README.md`. 규칙 문서: https://github.com/shadcn-ui/lint/blob/main/docs/rules.md ,
  adoption: https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md . `settings.shadcn.themeImports`(node_modules 의 디자인시스템 패키지 CSS 를
  테마로 인정) — `@energyx/ui` 는 워크스페이스 링크라 node_modules 경유로 보일 수 있으니 반드시 확인.
- Web Dockerfile: `node:20-alpine`, `pnpm install --frozen-lockfile` 후 `pnpm -C apps/web run build`.

## 할 일 (순서대로, 각 단계 끝에 `pnpm -C apps/web typecheck` + `pnpm -C apps/web build` 그린 유지)

### 1. Tailwind v4 업그레이드 (시각 패리티 최우선)
- `@tailwindcss/upgrade` 를 써도 되지만(워킹트리가 dirty 라 `--force` 필요할 수 있음) 결과를 반드시 검수. 공유 preset 을
  **`packages/ui` 의 CSS 테마 파일**(예: `packages/ui/theme.css` — `@theme`/`@theme inline` + `@custom-variant dark` + tw-animate-css)로 옮기고
  `apps/web/app/globals.css` 가 `@import "tailwindcss"` + 그 테마를 import. `packages/ui/package.json` exports 갱신, `tailwind.config.ts` 제거
  (components.json `tailwind.config` 는 "" 로). JS preset 파일은 소비처가 없어지면 삭제.
- v3→v4 의미 차이 처리: `shadow-sm→shadow-xs`, `shadow→shadow-sm`, `ring→ring-3`, `outline-none→outline-hidden`, `blur`/`rounded` 스케일
  (**radius 는 테마로 sm=6/md=8/lg=10/xl=10/2xl=10 를 재정의해 기존 클래스명 의미를 보존 — rounded-* 클래스명 일괄 리네임 금지**),
  기본 border 색(currentColor) — `* { border-color: var(--border) }` 베이스 유지, 버튼 cursor(pointer) 베이스 규칙, placeholder 색,
  `bg-[--var]`→`bg-(--var)` 문법, `!important` 접미 문법, `space-*`/`divide-*` 셀렉터 변화, 컨테이너 유틸(`@utility container`).
  camelCase 색 키(`gradeFg`, `gradeBg`, `gradeSoftFg`)가 v4 에서도 클래스로 생성되는지 확인(안 되면 kebab 으로 바꾸고 사용처 일괄 치환).
- 패리티 확인: 업그레이드 전후 `next build` 산출 CSS 에 핵심 클래스가 생성되는지 + `next start` 로 로그인/대시보드/표 화면을
  Playwright 스크린샷 비교(전·후 각각, `_workspace/04_frontend/shadcn-foundation-shots/`). DB 가 없으면 로그인 화면·정적 화면만이라도.

### 2. shadcn 설정 + 프리미티브 전체 세트 (L1)
- `components.json` v4 대응(css 경로, baseColor, iconLibrary lucide, aliases 유지). 디자인 토큰은 shadcn 변수 체계(`--background`, `--primary`,
  `--radius`, `--chart-1..5`, `--sidebar-*` 등)로 DESIGN.md 값 매핑(+ 도메인 토큰: grade/status/brand/neutral 스케일은 `@theme` 색으로).
- 필요한 프리미티브를 **shadcn MCP 로 조회 → `pnpm -C apps/web exec shadcn add`** 로 추가: 최소 alert-dialog, popover, command, toggle-group,
  collapsible, pagination, breadcrumb, switch, accordion, chart(recharts 래퍼 — 기존 차트 이관 대상), empty, spinner, field, input-group,
  kbd(필요시), hover-card(필요시), calendar(필요시). 기존 18종도 v4 스타일 기준으로 재점검.
  **덮어쓰기 주의:** 기존 ui 파일은 Part 토큰 튜닝이 있다 — 덮어쓴 뒤 DESIGN.md §7 규칙(버튼 36px·radius 8, 보조=그레이 outline,
  파괴적=red outline, 탭=하단 2px 인디케이터, 표 헤더 #F4F5FA, 카드 10px+옅은 그림자, 배지 pill) 을 cva variants 로 재인코딩.
- **모든 ui 컴포넌트 forwardRef 유지/변환**(plan.md 결정 2). `data-slot` 은 유지.
- 도메인 variant 를 L1 에 둔다: `Badge` status variants(DESIGN.md §2 상태색 6종), grade 표현(GradeChip 이 쓸 수 있게), `Button` 에
  primary/secondary(그레이 outline)/ghost/destructive(red outline)/link + size sm/default/lg/icon(+ 표 내부용 xs 28~32px 필요시),
  `Alert` info/success/warning/destructive, `Tabs` 언더라인 variant 등. 로딩 버튼 패턴(Spinner 자식 or `loading` prop) 하나로 확정.

### 3. @shadcn/lint 인프라 + 게이트
- `apps/web/eslint.config.mjs`(flat): parser = @typescript-eslint/parser(JSX), plugin shadcn, 6규칙. `settings.shadcn`: `ui`(=`@/components/ui`),
  `themeImports`(`@energyx/ui` 테마 CSS), `mergeFunctions`/`variantFunctions` 필요 시. `components/ui/**` override(adoption 문서 권장:
  ui 디렉터리에선 no-restyle·no-arbitrary-values·require-static-classes off, no-raw-colors·no-inline-styles 유지).
  `no-restyle` 계약(contracts): 레이아웃(margin/width/flex/grid 배치)은 허용, 크기/색/모양은 variant 로 — 컴포넌트별 contracts 를 DESIGN.md 에 맞게.
  커스텀 `message` 로 "DESIGN.md / shadcn-guide.md 의 어떤 토큰/variant 를 쓰라" 안내(에이전트 친화).
- **테마 오라클 동작 실증**: `no-raw-colors`·`no-unknown-classes` 가 우리 토큰(`bg-primary`, `text-grade-s`, `bg-status-review-bg` 등)을 인정하고
  `bg-pink-500`, `rounded-huge` 를 잡는지 샘플로 확인해 가이드에 기록.
- 스크립트: `apps/web` `"lint": "eslint . --max-warnings=0"`(+ `next lint` 제거), `next.config.mjs` 에 `eslint.ignoreDuringBuilds: true`
  (Next 14 내장 lint 는 ESLint 10 flat config 비호환 — 우리 lint 는 turbo 로 따로 돈다). 루트 `turbo.json`: `build` 와 `test` 가 `lint` 에 의존
  (`dependsOn: ["^build", "lint"]`), 루트 `package.json` 에 `"verify": "turbo run lint typecheck build"` 와 `test:e2e` 앞 lint 선행.
  Docker 빌드(`pnpm -C apps/web run build`)에서도 lint 가 돌도록 web `build` 스크립트를 `pnpm lint && next build` 로 할지 turbo 로 할지 결정하고
  Dockerfile 이 실제로 lint 를 실행함을 확인(alpine + node 20 에서 @shadcn/lint 의 Node ≥20.19 요구 충족 확인).
- 현재 위반 수 베이스라인 측정(규칙별·디렉터리별 표) → 가이드에 기록. **기능 그룹 세션이 자기 경로를 0 으로 만든다.**
  T1 이 소유한 경로(ui/**, app/**, 공용 L2)는 이 세션에서 0 으로.

### 4. 공용 L2 재구성 + app/**
- plan.md §3 의 공용 L2 목록을 L1 조합으로 재구현(공개 API 는 가능한 유지 — 기능 세션 부담 최소화). 단 shadcn 과 1:1 중복인 범용 래퍼
  (Button/Card/Modal/Toast/Select/Tabs/TextField/Avatar/Collapsible/Pagination/SegmentedControl/Breadcrumb/HelpTooltip/SearchInput/States)는
  **이 단계에선 삭제하지 말고** "deprecated — L1 로 이관 대상" 주석 + 내부를 L1 위임으로 바꿔 빌드를 유지한다(삭제는 T9).
- `app/**`(로그인·레이아웃·에러 페이지 등) 전환 + lint 0. `lib/palette.ts`(인라인 색 토큰 `T`) → 각 키에 대응하는 **클래스 토큰 매핑표**를
  가이드에 제공(기능 세션이 `style={{color:T.x}}` 를 클래스로 바꿀 수 있게). 필요하면 `@theme` 에 누락 토큰 추가.
  타이포 임의값(`text-[13px]`, `text-[12.5px]`, `text-[15px]` 등)·자주 쓰는 임의 크기(`min-h-[128px]` 등)를 조사해 **테마 토큰으로 승격**하고 매핑표 제공.

### 5. 가이드 `_workspace/04_frontend/shadcn-guide.md` (기능 세션의 유일한 입력 — 구체적으로)
- L1 인벤토리와 각 variant/size API, 코드 예시.
- **레거시 → shadcn 매핑표**(예: `<Button variant="secondary" loading leftIcon>` → `<Button variant="outline">…`, `useToast().show({variant,message})` →
  `toast.success/error(message,{duration})`, `<Modal title primaryAction…>` → `Dialog`/`AlertDialog` 조합 예시, `States.EmptyState` → `Empty`, `InfoBanner` → `Alert` …).
- 임의값/인라인 스타일 → 토큰 매핑표, 허용 예외 목록(예: 동적 % 너비는 `ui/progress` 또는 CSS 변수 + 사유 주석), 금지 패턴.
- lint 실행법(`pnpm -C apps/web exec eslint features/<dir>`), 규칙별 대표 위반·수정 예.
- 기능 세션 체크리스트(동작/문구/접근성 이름 불변, forwardRef, 소유 경로 밖 수정 금지).

## 완료 기준
- `pnpm -C apps/web typecheck` 0, `pnpm -C apps/web build` PASS(Tailwind v4), lint 가 build/test 게이트로 연결됨(실행 증거),
  T1 소유 경로 lint 위반 0, 가이드 완성, 패리티 스크린샷 비교 결과(차이 있으면 원인·조치) 기록.
- `_workspace/04_frontend/shadcn-foundation.md` 에 변경 요약·베이스라인 위반 표·남은 리스크.
- `worker_done` 본문에 위 수치와 가이드 경로.
