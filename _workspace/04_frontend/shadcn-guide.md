# shadcn 전환 가이드 — 기능 세션(T3~T8)의 유일한 입력

작성: T1 foundation · 2026-10-13. 디자인 SSOT = 루트 `DESIGN.md`(Part 하이브리드, **불변**). 이 문서는 "겉모습은 그대로, 구현을 shadcn(L1)으로" 옮기는 규칙·매핑표다.
관련: `_workspace/00_input/shadcn-migration/plan.md`(확정 결정·소유권), `_workspace/04_frontend/shadcn-foundation.md`(T1 변경 요약·베이스라인).

## 0. 한 장 요약

1. **3계층**: L1 `components/ui/*`(shadcn, 스타일 "소유") → L2 `components/*`(앱 컴포지션, L1 조합만) → L3 `features/*`·`app/*`(L1/L2 import).
2. 스타일은 **테마 토큰(`packages/ui/theme.css`)·L1 variant·Tailwind 스케일**로만. 임의값 `x-[..]`·인라인 `style={{}}`·hex/원색 금지.
3. raw `<button> <input> <select> <textarea> <table>` 금지 → L1(`Button`, `Input`, `Select`, `Textarea`, `Table`, `Checkbox`, `Switch` …).
4. 동작·문구·접근성 이름(label/버튼 텍스트/role/aria-label) **불변** — E2E(역할/라벨 로케이터)가 회귀 게이트다. 화면 문구 변경 금지.
5. **forwardRef 유지**(Next 14/React 18 — 함수 컴포넌트에 `ref` prop 이 안 넘어감). 새 L1/L2 컴포넌트도 `React.forwardRef` + `displayName`, `data-slot` 유지.
6. 검증: `pnpm -C apps/web exec eslint <소유 경로>` **0** + `pnpm -C apps/web typecheck`. (T1·T9·T10 외에는 `next build`/`next dev` 금지 — `.next` 가 깨진다.)

## 1. lint 실행·읽는 법

```
pnpm -C apps/web exec eslint features/<dir>            # 소유 경로만
pnpm -C apps/web exec eslint features/<dir> -f unix    # 한 줄 요약
pnpm -C apps/web lint                                  # 전체(eslint . --max-warnings=0) — 게이트와 동일
```
`[@shadcn/lint] This project's cn is 0.2.6 …` 한 줄은 정보성(무시). 규칙 6종은 전부 `error`, 위반 0 이 완료 기준. 정당한 예외만 `// eslint-disable-next-line shadcn/<rule> -- <사유>`(사유 필수, 최소화; `rg "eslint-disable.*shadcn/"` 로 감사됨).

| 규칙 | 잡는 것 | 대표 위반 → 수정 |
|---|---|---|
| `no-restyle` | L1 컴포넌트에 `className` 으로 크기/색/모양 변경 | `<Button className="h-9 rounded-full bg-blue-500">` → `<Button size="sm" variant="outline">`. 허용=배치(폭·높이·flex/grid·margin·z-index·overflow). 텍스트 계열(Label·CardTitle·TableCell·DialogTitle …)은 타이포+색(토큰), 컨테이너 계열(Card*·Dialog*·TableRow …)은 padding/gap 도 허용, `Input`/`Textarea`/`SelectTrigger` 는 타이포(text-12·tabular-nums)까지 허용. 정확한 정규식·허용 범주는 `apps/web/eslint.config.mjs` 상단 `noRestyleContracts` |
| `no-raw-colors` | `bg-pink-500`, `text-gray-500`, hex, SVG `fill="#f00"` | → `bg-danger-50`/`text-muted-foreground`/`stroke="var(--color-chart-1)"` |
| `no-arbitrary-values` | `p-[13px]`, `max-w-[440px]`, `top-[2px]`, `grid-cols-[…]` | 메시지가 같은 값의 스케일 클래스를 제안(`p-3.25`, `max-w-110`). 스케일에 없으면 §5 의 승격/예외 절차 |
| `no-inline-styles` | `style={{ width, color … }}`, `<style>` | 클래스로. 정말 동적인 값은 CSS 변수: `style={{ '--w': \`${pct}%\` } as React.CSSProperties}` + `className="w-(--w)"` (이 형태는 통과) |
| `no-unknown-classes` | Tailwind 가 만들지 못하는 클래스(`rounded-huge`, 오타, `.gx-` 미정의) | 오타 수정 / 테마에 토큰 선언 |
| `require-static-classes` | L1 컴포넌트에 `` className={`bg-${c}`} `` 처럼 정적으로 못 읽는 값 | 정적 문자열 + 삼항(`cond ? 'bg-primary' : 'bg-muted'`)은 OK. `cn()`/`cva()` 는 OK |
| (core) `no-restricted-syntax` | raw `<button>/<input>/<select>/<textarea>/<table>` | L1 사용 |

오라클 실증(2026-10-13): `bg-primary`·`text-grade…`·`bg-status-review-bg`·`text-gradeFg-c`·`text-12`·`rounded-xs`·`shadow-md` 통과 / `bg-pink-500`·`text-foo-bar`·`rounded-huge`·`p-[13px]` 검출. 테마 CSS 는 `@import` 체인(`@energyx/ui/theme.css`)을 따라 읽힌다.

## 2. 토큰 매핑

### 2-1. `lib/palette.ts` `T`(인라인 색) → 클래스
| `T.` | 값 | 클래스 접미(접두 `text-`/`bg-`/`border-`) |
|---|---|---|
| blue50 | #EAF2FE | `info-50`(= `accent`) |
| blue300 | #7FB3F8 | `purple-300` |
| blue500 | #0257CE | `primary`(= `brand-blue`) |
| blue600 | #0246A8 | `brand-blue-hover` |
| blue700 | #023683 | `purple-700` |
| grey50 | #F8F9FD | `neutral-50`(= `background`) |
| grey100 | #F4F5FA | `neutral-100`(= `muted`/`secondary`) |
| grey200 | #E7E9F3 | `neutral-200`(= `border`) |
| grey300 | #D8DCEB | `neutral-300`(= `input`) |
| grey400 / 500 | #B8BDD4 / #9B98AC | `neutral-400` / `neutral-500` |
| grey600 | #6B6980 | `neutral-600`(= `muted-foreground`) |
| grey700 / 800 | #4A4860 / #2D2A3D | `neutral-700` / `neutral-800` |
| grey900 | #161326 | `neutral-950`(= `foreground`) |
| green500 | #0B7A47 | `success-600` |
| red500 | #C81E1E | `danger-600` |
| orange500 | #B4790A | `warning-600` |
| sidebar / sidebarActive | #564599 / #4A3B85 | `sidebar` / `sidebar-active` |
| teal / tealSubtle / tealStrong | #0ED0D9 / #E4FBFB / #0E7E85 | `brand-teal` / `brand-teal-subtle` / `brand-teal-strong` |

`groupChip`/`categoryChip`(KPI 칩): 배경 `bg-card`/`bg-neutral-50`/`bg-neutral-100`, 글씨 `text-neutral-800`/`700`/`600` — palette.ts 의 hex 와 1:1. 등급 칩은 `GradeChip`/`Badge variant="grade-*"` 사용(색 직접 지정 금지).

### 2-2. 의미 토큰(권장 — 같은 값이면 시맨틱 이름 우선)
`bg-background`(캔버스) · `bg-card` · `bg-muted` · `text-foreground` · `text-muted-foreground` · `border-border` · `border-input` · `bg-primary text-primary-foreground` · `bg-accent text-accent-foreground`(선택/활성 연한 파랑) · `text-destructive` · `ring-ring`.
도메인: 등급 `bg-grade-{s,a,b,c,d}`(Solid) · `bg-gradeBg-{…}`(틴트) · `text-gradeSoftFg-{…}`(틴트 위 진한 글씨) · `text-gradeFg-{…}`. 상태 `bg-status-{not-started,in-progress,submitted,review,revision,finalized,danger}-bg text-status-…-fg`. 시맨틱 스케일 `success|warning|danger|info-{50,100,500,600,700}`. 차트 `--color-chart-1…5`, `--color-chart-{downward-1,2,3,self,company-avg,grid}`(CSS 변수, SVG 속성에서 사용). 사이드바 `bg-sidebar`, `bg-sidebar-active`, `text-sidebar-foreground`.

### 2-3. 반경 / 그림자 / 폰트
- 반경(**Tailwind 기본 px 와 다름!**): `rounded-xs`=4px(체크박스·미니 칩) · `rounded-sm`=6px(라벨) · `rounded-md`=8px(컨트롤) · `rounded-lg`/`xl`/`2xl`=10px(카드·다이얼로그) · `rounded-pill`/`rounded-full`. 12px↑ 금지. `rounded-[4px]`→`rounded-xs`.
- 그림자(전부 옅은 중립): `shadow-xs`(입력) · `shadow-sm`(카드·패널) · `shadow-md`(드롭다운) · `shadow-lg`(팝오버) · `shadow-xl`(모달). 구 `shadow-elev-1..4` 는 일괄 치환 완료(1→sm, 2→md, 3→lg, 4→xl).
- 폰트: Pretendard(`font-sans` 기본). 숫자 정렬은 `tabular-nums`.

### 2-4. 타이포 px → 토큰 (이미 코드베이스 일괄 치환됨)
`text-[12px]`→`text-12`. 숫자=px, `h`=+0.5px: `text-9h`(9.5) `text-10` `text-10h`(10.5) `text-11` `text-11h`(11.5) `text-12` `text-12h`(12.5) `text-13` `text-13h`(13.5) `text-14` `text-14h` `text-15` `text-15h` `text-16` `text-17` `text-18` `text-20` `text-21` `text-22` `text-30` `text-32` `text-34` `text-40`. 행간은 지정 안 함(상속) — 필요하면 `leading-tight|snug|normal|relaxed`. 자간 `tracking-eyebrow`(0.16em, 로그인 브랜드 라벨). 표준 `text-xs|sm|base…` 도 그대로 쓸 수 있다.
(`text-12` 류가 lint 에서 "글자색"으로 오탐되지 않는 건 `packages/ui/lint-anchor.cjs` no-op `@plugin` 덕분 — 삭제 금지.)

### 2-5. 크기·간격 (임의값 → 스케일)
Tailwind v4 는 **px÷4 의 모든 숫자**가 스케일이다: `w-[88px]`→`w-22`, `h-[22px]`→`h-5.5`, `min-h-[72px]`→`min-h-18`, `max-w-[440px]`→`max-w-110`, `size-[18px]`→`size-4.5`, `top-[2px]`→`top-0.5`, `py-[9px]`→`py-2.25`, `gap-[6px]`→`gap-1.5`. 비율 `w-[55%]`→`w-11/20`. 룰의 에러 메시지가 정확한 대체값을 알려준다. `z-[100]`→`z-100`, `leading-[1.4]`→`leading-snug` 류.
스케일에 없는 값(`calc()`, `max-h-[max(480px,calc(100vh-400px))]`, 복잡한 `grid-cols-[…]`)은: ① 레이아웃을 `grid-cols-12 + col-span`·flex 로 재구성 ② 반복되면 **테마 토큰으로 승격**(`@theme { --container-… }` 등 — T1 에 요청) ③ 최후 수단 예외 주석(사유 필수).

### 2-6. v3→v4 의미 차이 주의
`shadow-sm`(v3 작은 그림자)≠ 현재 `shadow-sm`(카드 그림자 토큰) · `outline-none`→`outline-hidden`(일괄 치환 완료) · `flex-shrink-0`→`shrink-0` · 기본 border 색은 `--border`(베이스 레이어로 보존) · `bg-gradient-to-*`→`bg-linear-to-*` · CSS 변수 값 문법 `w-[--x]`→`w-(--x)`.

## 3. L1 인벤토리 (`@/components/ui/<name>`)
(아래 표는 T1 완료 시점 스냅샷 — 정확한 값은 각 파일의 cva 정의가 정답. 재생성: `PYTHONIOENCODING=utf-8 python _workspace/04_frontend/shadcn-foundation-shots/inventory.py`)

| 파일 | export | variants (cva) |
|---|---|---|
| `accordion` | Accordion, AccordionItem, AccordionTrigger, AccordionContent | — |
| `alert-dialog` | AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger | — |
| `alert` | Alert, AlertTitle, AlertDescription | `variant`: `default` · `info` · `success` · `warning` · `destructive` |
| `avatar` | Avatar, AvatarImage, AvatarFallback | — |
| `badge` | Badge | `variant`: `default` · `secondary` · `destructive` · `outline` · `success` · `warning` · `info` · `neutral` · `muted` · `status-not-started` · `status-in-progress` · `status-submitted` · `status-review` · `status-revision` · `status-finalized` · `status-danger` · `grade-s` · `grade-a` · `grade-b` · `grade-c` · `grade-d` · `grade-soft-s` · `grade-soft-a` · `grade-soft-b` · `grade-soft-c` · `grade-soft-d`<br>`shape`: `label` · `pill`<br>`size`: `default` · `xs` · `grade-sm` · `grade-md` |
| `breadcrumb` | Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis | — |
| `button` | Button | `variant`: `default` · `outline` · `secondary` · `ghost` · `destructive` · `link` · `sidebar` · `help`<br>`size`: `default` · `xs` · `sm` · `lg` · `icon` · `icon-xs` · `icon-sm` · `icon-lg` · `icon-2xs` · `sidebar-group` |
| `calendar` | Calendar, CalendarDayButton | — |
| `card` | Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent | — |
| `chart` | ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle | — |
| `checkbox` | Checkbox | — |
| `collapsible` | Collapsible, CollapsibleTrigger, CollapsibleContent | — |
| `command` | Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator | — |
| `dialog` | Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger | — |
| `dropdown-menu` | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup | — |
| `empty` | Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia | `variant`: `default` · `icon` |
| `field` | Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle | `orientation`: `vertical` · `horizontal` · `responsive` |
| `hover-card` | HoverCard, HoverCardTrigger, HoverCardContent | — |
| `input-group` | InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea | `align`: `inline-start` · `inline-end` · `block-start` · `block-end`<br>`size`: `xs` · `sm` · `icon-xs` · `icon-sm` |
| `input` | Input | — |
| `kbd` | Kbd, KbdGroup | — |
| `label` | Label | — |
| `pagination` | Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis | — |
| `popover` | Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverHeader, PopoverTitle, PopoverDescription | — |
| `progress` | Progress | — |
| `radio-group` | RadioGroup, RadioGroupItem | — |
| `scroll-area` | ScrollArea, ScrollBar | — |
| `select` | Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue | — |
| `separator` | Separator | — |
| `sheet` | Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription | `side`: `top` · `bottom` · `left` · `right` |
| `skeleton` | Skeleton | — |
| `sonner` | Toaster | — |
| `spinner` | Spinner | — |
| `switch` | Switch | — |
| `table` | Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption | `interactive`: `true` · `false`<br>`plain`: `true`<br>`rule`: `default`<br>`tone`: `default` · `soft` · `strong`<br>`sticky`: `true` · `false`<br>`textAlign`: `left`<br>`flush`: `true` |
| `tabs` | Tabs, TabsList, TabsTrigger, TabsContent | — |
| `textarea` | Textarea | — |
| `toggle-group` | ToggleGroup, ToggleGroupItem | — |
| `toggle` | Toggle | `variant`: `default` · `outline`<br>`size`: `default` · `sm` · `lg` |
| `tooltip` | Tooltip, TooltipTrigger, TooltipContent, TooltipProvider | — |


### 핵심 API 노트 (코드 예시)
```tsx
// Button — 로딩은 loading prop 하나(스피너+disabled+aria-busy). 기본 type="button". 높이 xs28/sm32/default40/lg48. icon-* 는 정사각.
<Button variant="outline" size="sm" loading={saving} onClick={save}><Save />저장</Button>
<Button variant="destructive" onClick={remove}>삭제</Button>          // red outline (DESIGN §7: red solid 금지)
<Button asChild variant="link"><Link href="/kpi">KPI 작성</Link></Button>
// Badge — 상태/등급/태그 단일 컴포넌트. shape: label(6px,기본)|pill. size: xs | grade-sm | grade-md(등급 정사각)
<Badge variant="status-review" shape="pill">검토 중</Badge>
<Badge variant="grade-s" size="grade-md">S</Badge>                       // C 만 진갈색 글씨(text-gradeFg-c) — 구 gradeSolidClass 와 동일
// Alert — tone variant, 아이콘은 첫 자식 svg(grid 슬롯)
<Alert variant="warning"><AlertTriangle /><AlertTitle>마감 임박</AlertTitle><AlertDescription>…</AlertDescription></Alert>
// Dialog — size(sm/md/lg/xl)·layout(scroll/scroll-footer) variant 는 DialogContent 에. 위험 확인은 AlertDialog
<Dialog open={open} onOpenChange={setOpen}><DialogContent size="md"><DialogHeader><DialogTitle>제목</DialogTitle></DialogHeader>…<DialogFooter>…</DialogFooter></DialogContent></Dialog>
// 아이콘/접미사 붙은 입력 — padding 으로 덮지 말고 InputGroup
<InputGroup><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput placeholder="검색" /></InputGroup>
// 콤보박스 = Popover + Command (components/UserCombobox.tsx 참고) · 분절 선택 = ToggleGroup(type="single", variant="outline")
// Table — TableRow interactive/plain/rule, TableHead tone/sticky/textAlign, TableCell textAlign/flush. 스크롤·sticky 표는 L2 DataTable.
// 동적 너비(%)는 CSS 변수:  <div style={{ '--w': `${pct}%` } as React.CSSProperties} className="h-2 w-(--w) bg-primary" />  (또는 ui/progress)
```
- 토스트: `import { toast } from 'sonner'` (Toaster 는 app/providers.tsx 에 이미 있음). 레거시 `useToast().show` 는 같은 sonner 로 위임된다.
- 새 L1 variant 추가는 §6 절차. T1 이 추가한 도메인 variant: Button `sidebar`·`help`·`size=sidebar-group|icon-2xs`, Badge `status-*|grade-*|grade-soft-*|muted`·`shape`·`size`, Table·Dialog·Tooltip(`variant="rich"`)·Avatar(`size`/`tone`) 확장.



## 4. 레거시 → shadcn 매핑표
| 레거시(components/*) | L1 로 이관 |
|---|---|
| `<Button variant="primary\|secondary\|ghost\|danger" size="sm\|md\|lg" fullWidth loading leftIcon={<X/>}>` | `<Button variant="default\|outline\|ghost\|destructive" size="sm\|default\|lg" className="w-full" loading><X/>라벨</Button>` |
| `<Modal open onClose title primaryAction secondaryAction size>` | `<Dialog open onOpenChange><DialogContent><DialogHeader><DialogTitle>…</DialogTitle></DialogHeader>본문<DialogFooter>…</DialogFooter></DialogContent></Dialog>` / 위험 확인은 `AlertDialog` |
| `useToast().show({variant:'success'\|'danger'\|'info', message, duration})` | `import { toast } from 'sonner'` → `toast.success(msg,{duration})` / `toast.error(msg)` / `toast(msg)` (에러 기본 8s 는 호출부에서 `{duration:8000}`) |
| `<InfoBanner tone=…>` / `States.ErrorState` | `<Alert variant="info\|success\|warning\|destructive"><Icon/><AlertTitle/><AlertDescription/></Alert>` |
| `States.EmptyState` / 로딩 | `<Empty><EmptyHeader><EmptyTitle/><EmptyDescription/></EmptyHeader><EmptyContent>CTA</EmptyContent></Empty>` / `<Skeleton className="h-4 w-24"/>`, `<Spinner/>` |
| `<StatusBadge status=…>` | `<Badge variant="status-in-progress" shape="pill">…</Badge>` (L2 `StatusBadge` 유지 가능) |
| `<GradeChip grade size>` | L2 `GradeChip` 유지(내부 = `Badge variant="grade-*"`) |
| `<Select options value onChange>` | `<Select value onValueChange><SelectTrigger><SelectValue placeholder/></SelectTrigger><SelectContent><SelectItem value>…` (L2 `Select` 어댑터가 옵션 배열 API 유지) |
| `<TextField label error …>` | `<Field><FieldLabel/><Input aria-invalid/><FieldError/></Field>` 또는 `Label`+`Input` |
| 네이티브 `<input type="checkbox">` / `radio` / switch | `Checkbox` / `RadioGroup`+`RadioGroupItem` / `Switch` (+`Label`) |
| 네이티브 `<select>` / `<textarea>` / `<input>` | `Select…` / `Textarea` / `Input` (아이콘 붙은 입력 = `InputGroup`+`InputGroupAddon`) |
| `<Tabs>` (L2) | `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (언더라인 2px 블루가 기본) |
| `<SegmentedControl>` | `<ToggleGroup type="single" variant="outline">` |
| `<table>` 손스타일 | `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell` (스크롤·sticky 는 L2 `DataTable`) |
| `<Avatar name>` | L2 `Avatar`(내부 = `ui/avatar`) |
| `<Collapsible>` / `<Pagination>` / `<Breadcrumb>` / `<HelpTooltip>` / `<SearchInput>` | `ui/collapsible` / `ui/pagination` / `ui/breadcrumb` / `ui/tooltip` / `InputGroup`+`Search` |
| 인라인 팝오버·콤보박스 | `Popover`(+`Command`) — L2 `UserCombobox` 참고 |
| `.gx-panel` / `.gx-toolbar` … | `@utility` 로 남아 있음(사용 가능). 신규는 `Card` / flex 조합 선호 |

## 5. 허용 예외 / 금지 패턴
**허용(사유 주석 필수 — `// eslint-disable-next-line <rule> -- <사유>`):**
- 라이브러리가 요구하는 인라인 값(recharts 의 `contentStyle` 등)·측정 기반 좌표(툴팁 위치, 가상 스크롤) — 가능하면 CSS 변수 방식.
- 스케일/테마로 표현 불가한 복합 `calc()`/`minmax()` 그리드 템플릿(재구성 우선, 반복되면 T1 에 토큰 승격 요청).
- `<input type="file" hidden>`, 외부 임베드 등 L1 이 없는 원시 요소(`no-restricted-syntax`).
**금지:** hex/원색 클래스·`style` 색 · `rounded-[Npx]`/12px↑ 라운드 · 그라데이션·글래스·컬러 섀도(DESIGN.md §9) · L1 파일에 소비처 전용 하드코딩 · 문구/라벨/aria 변경 · 레거시 래퍼를 새 코드에 신규 사용(이관 대상 — L1 직접).

## 6. 새 variant 가 필요할 때
1. 정말 디자인에 있는 새 처리인지 확인(DESIGN.md). 2. `components/ui/<x>.tsx` 의 cva 에 variant **추가**(기존 값 변경 금지, 다른 세션이 동시에 쓰므로 최소 편집·직전 Read). 3. 진행 노트에 기록. 임의 `className` 덮어쓰기로 우회하면 `no-restyle` 에 걸린다.

## 7. 기능 세션 체크리스트
- [ ] 코드 수정 전 `nextjs-frontend` 스킬 호출.
- [ ] 소유 경로 밖 파일 수정 금지(필요하면 코디네이터에 `ask`). L1/L2/lib/app 은 T1 소유 — 변경이 필요하면 요청.
- [ ] 동작 불변: 훅·API 호출·상태 로직·문구·접근성 이름(label/button text/role/aria) 그대로. E2E 로케이터가 깨지지 않게.
- [ ] 새 컴포넌트는 `forwardRef`·`displayName`·`data-slot`. 파일당 ~200줄.
- [ ] `pnpm -C apps/web exec eslint <경로>` 0, `pnpm -C apps/web typecheck` 새 에러 0, 진행 노트 `_workspace/04_frontend/shadcn-<세션>.md`.
- [ ] 레거시 래퍼(Button/Card/Modal/Toast/Select/Tabs/TextField/Avatar/Collapsible/Pagination/SegmentedControl/Breadcrumb/HelpTooltip/SearchInput/States) import 를 L1 로 치환(T9 에서 래퍼 삭제).
