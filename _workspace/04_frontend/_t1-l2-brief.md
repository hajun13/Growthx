# T1 / L2 공용 컴포넌트 재구성 브리프 (서브에이전트 공통)

디렉터리 `C:\Users\user\orca\Growthx`. **코드 수정 전 `nextjs-frontend` 스킬을 Skill 도구로 먼저 호출.** 먼저 `_workspace/00_input/shadcn-migration/plan.md`(§1 확정 결정)·루트 `DESIGN.md` 를 읽어라.
상태: Tailwind v4 로 전환됨(토큰 SSOT = `packages/ui/theme.css`), L1(`apps/web/components/ui/*` shadcn 프리미티브)은 정비 완료, `@shadcn/lint` 게이트가 켜져 있다(`apps/web/eslint.config.mjs`).
**겉모습은 지금 앱과 같아야 한다**(시각 패리티 — 사용자는 디자인을 바꾸라고 하지 않았고 구현만 shadcn 으로 바꾼다). 동작·문구·접근성 이름(라벨/버튼 텍스트/role/aria-label)·공개 API(export 이름·props) 불변.

## 너의 일: 소유 파일을 "L1 조합만"으로 재구현
- 자체 버튼/입력/셀렉트/다이얼로그/표/탭/툴팁/토스트를 직접 만들지 말고 `@/components/ui/*` 를 조합한다. **raw `<button> <input> <select> <textarea> <table>` 금지**(lint `no-restricted-syntax`), 인라인 `style={{…}}` 금지(색·크기·간격 전부 클래스로. 정말 동적인 값(%너비·계산 좌표)은 `style={{ '--x': v } as React.CSSProperties}` + `w-(--x)`/`bg-(--x)` 같은 CSS 변수 방식 — lint 통과함), 임의값 `x-[..]` 금지(스케일/테마 토큰 사용), 원색/hex 금지(테마 토큰만).
- 다음 레거시 래퍼는 **삭제하지 않는다**(삭제는 T9). 파일 상단에 `@deprecated — L1(@/components/ui/<x>) 사용으로 이관 대상` JSDoc 을 달고, 내부를 L1 위임으로 바꿔 **기존 호출부가 그대로 컴파일/동작**하게 유지한다: Button, Card, Modal, Toast, Select, Tabs, TextField, Avatar, Collapsible, Pagination, SegmentedControl, Breadcrumb, HelpTooltip, SearchInput, States. (그 외 컴포넌트 — AppShell, PageHeader, DataTable, StatusBadge, GradeChip 등 — 은 이관 대상이 아니라 "정식 L2"로 남는다.)
- 파일당 ~200줄 상한(architecture.md) — 넘으면 같은 폴더에 분리.

## 레거시 → L1 매핑 (이 표대로)
| 레거시 | L1 |
|---|---|
| `Button variant=primary/secondary/ghost/danger size=sm/md/lg fullWidth loading leftIcon` | `<Button variant="default/outline/ghost/destructive" size="sm/default/lg" className="w-full" loading>` ; leftIcon 은 children 앞에 아이콘 |
| `Modal {open,onClose,title,primaryAction,secondaryAction,size}` | `Dialog` + `DialogContent`(+`DialogHeader/Title/Footer`); 위험 확인류는 `AlertDialog`. 기존 `Modal` 시그니처는 유지하고 내부만 L1 |
| `useToast().show({variant:'success'/'danger'/'info',message,duration})` | 내부는 `sonner` `toast.success/error/…`(이미 어댑터). `ToastProvider` 는 `ui/sonner` 의 `Toaster` 렌더 |
| `InfoBanner` / `States.*` 의 배너·빈/에러 상태 | `Alert`(tone variant: info/success/warning/destructive), 빈 상태는 `Empty`(`EmptyHeader/Title/Description/Content`), 로딩은 `Skeleton`/`Spinner` |
| `StatusBadge` / 상태 pill | `Badge variant="status-*" shape="pill"` |
| `GradeChip` | `Badge variant="grade-s|a|b|c|d"`(Solid, 글씨 흰색) / `grade-soft-*`. size(sm/md/lg)는 L1 에 없으므로 폭·높이는 GradeChip 이 `className`(layout만) 또는 Badge 내부 variant 확장으로 해결 — 필요하면 `components/ui/badge.tsx` 에 `size` variant 를 **추가**(기존 variant 불변)해도 된다 |
| `Select` | `ui/select`(Radix) — 기존 `<option>` 기반 API 를 유지하려면 어댑터로 감싼다(items 배열 → SelectItem) |
| `TextField` | `Label`+`Input`/`Textarea`+에러문구(`Field`, `FieldLabel`, `FieldError` 조합 가능) |
| `Tabs` | `ui/tabs`(Tabs/TabsList/TabsTrigger) — 기존 API 유지 |
| `SegmentedControl` | `ui/toggle-group`(`type="single" variant="outline"`) |
| `Avatar` | `ui/avatar` + 이니셜 색 해시(파스텔 5색 — 색은 클래스 토큰 `bg-info-50 text-info-700` 등으로) |
| `Collapsible` / `Pagination` / `Breadcrumb` / `HelpTooltip` / `SearchInput` | `ui/collapsible` / `ui/pagination` / `ui/breadcrumb` / `ui/tooltip`(+`HelpCircle` 아이콘) / `InputGroup`+`Search` 아이콘 |
| `UserCombobox` | `Popover` + `Command`(cmdk) |
| `DataTable` | `ui/table` 기반(`Table`/`TableHeader`/`TableRow`/`TableHead`/`TableCell`) — sticky 헤더·키보드 행 진입·`bare`/maxHeight 동작 보존 |

## 인라인 색 토큰 `T`(lib/palette.ts) → 클래스 매핑
`T.blue50`→`bg-info-50`(또는 accent) · `blue300`→`purple-300` · `blue500`→`primary` · `blue600`→`brand-blue-hover` · `blue700`→`purple-700` · `grey50`→`neutral-50`(=background) · `grey100`→`neutral-100`(=muted) · `grey200`→`neutral-200`(=border) · `grey300`→`neutral-300`(=input) · `grey400/500`→`neutral-400/500` · `grey600`→`neutral-600`(=muted-foreground) · `grey700/800`→`neutral-700/800` · `grey900`→`neutral-950`(=foreground) · `green500`→`success-600` · `red500`→`danger-600` · `orange500`→`warning-600` · `sidebar`→`sidebar` · `sidebarActive`→`sidebar-active` · `teal*`→`brand-teal` / `brand-teal-subtle` / `brand-teal-strong`. (`text-neutral-600`·`bg-neutral-100` 처럼 `text-/bg-/border-` 접두 + 이름.)
등급: `bg-grade-s|a|b|c|d`, 틴트 `bg-gradeBg-x`, 진한 글씨 `text-gradeSoftFg-x`. 상태: `bg-status-<name>-bg text-status-<name>-fg`. 차트: `var(--color-chart-1..5)`, `--color-grade-s` 등 CSS 변수(SVG attr 에서 허용).
타이포 px 임의값은 토큰으로 승격돼 있다: `text-12`=12px, `text-11h`=11.5px(숫자=px, h=+0.5) — 이미 코드베이스에 일괄 치환돼 있음. 크기(너비/높이/min/max)는 Tailwind v4 숫자 스케일: `w-22`=88px(px÷4), `h-5.5`=22px, `max-w-110`=440px. 레이아웃 그리드 템플릿 등 정말 필요한 임의값은 `components/ui/**` 밖에서는 금지이므로 `grid-cols-12`/`grid-cols-[…]` 대신 스케일·`minmax` 를 테마에 두는 대신 플렉스/그리드 클래스 조합으로 재구성하거나, 불가피하면 `// eslint-disable-next-line shadcn/no-arbitrary-values -- <사유>` (예외는 최소화, 사유 필수).
`.gx-*` 레거시 유틸(gx-panel, gx-toolbar, gx-master-detail …)은 `@utility` 로 theme.css 에 남아 있어 사용 가능하지만, 신규/재구성 코드에서는 가능하면 L1 `Card`/Tailwind 조합으로 대체한다.

## no-restyle 계약 (lint)
기본: L1 컴포넌트의 `className` 에는 **레이아웃(배치·폭·높이·flex/grid·margin·z-index·overflow)만** 허용. 텍스트 계열(Label·CardTitle·DialogTitle·TableCell·Alert 제목 등)은 타이포+색(테마 토큰) 허용, 컨테이너 계열(Card*·Dialog*·TableRow 등)은 spacing(padding/gap) 허용(정확한 정규식은 `eslint.config.mjs`). 크기/색/모양이 필요하면 **L1 의 variant 를 쓰거나** (정말 필요하면) `components/ui/<x>.tsx` 에 variant 를 추가하되 기존 variant 는 바꾸지 말 것. 새 variant 추가 시 최종 보고에 적어라.

## 검증 (각자)
- `pnpm -C apps/web exec eslint <소유 파일들>` 에러 0 (`[@shadcn/lint] cn 0.2.6` 안내 한 줄은 무시).
- `pnpm -C apps/web typecheck` — **너의 파일에서 새로 생기는 에러 0**(다른 에이전트 파일 에러는 보고만). 호출부(features/**)는 **수정 금지** — 공개 API 를 유지하면 컴파일된다. API 를 깨야만 한다면 깨지 말고 보고하라.
- **금지:** `next build`/`next dev`, git 파괴 명령(`checkout --`,`restore`,`reset`,`stash`,`clean`,`commit`), 소유 파일 밖 수정(L1 variant 추가 제외 — `components/ui/**` 는 variant "추가"만 허용, 같은 파일을 다른 에이전트도 건드릴 수 있으니 최소 편집·편집 직전 Read).
- 마지막에 짧게 보고: 파일별 요약, 새로 추가한 L1 variant, 공개 API 가 바뀐 곳(없어야 함), eslint/typecheck 수치, 시각 패리티가 걱정되는 지점(예: 원래 인라인 px 로 맞춘 레이아웃).
