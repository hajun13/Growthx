# shadcn 전환 노트 G7b — admin-monthly-performance · admin-group-performance · admin-kpi-import

범위: `apps/web/features/{admin-monthly-performance,admin-group-performance,admin-kpi-import}/**` (+ 아래 "추가한 L1 variant" 3건은 `components/ui` 가산 편집).

## 파일별 변경 요약
**admin-monthly-performance/ui**
- `MonthlyPerformanceView.tsx` — Card/Button/Modal/States → L1(`Card*`,`Button`,`Dialog*`,`Skeleton`) + 로컬 `StateBlocks`. 최종저장 확인 모달=`Dialog size="sm" layout="scroll-footer"`(구 Modal 과 동일 구조). `xl:grid-cols-[minmax(0,1fr)_300px]` → `flex xl:flex-row` + `min-w-0 flex-1` / `xl:w-75 xl:shrink-0`.
- `StateBlocks.tsx`(신규) — EmptyState/ErrorState/Forbidden = L1 `Empty`·`Alert`·`Button`. 문구·버튼 라벨("접근 불가"·"메인으로"·"다시 시도") 동일.
- `MonthTabBar.tsx` — raw button → `Button`(활성 `default`, 비활성 신규 `tab` variant).
- `MonthInputTable.tsx` — raw table → `Table*`(+ `divider` variant), `style minWidth` → `min-w-190`.
- `PerfCharts.tsx` — recharts 직접 → `ChartContainer`+`ChartConfig`(색 `var(--color-chart-*)`, 격자 `--color-chart-grid`), `Tooltip`→`ChartTooltip`(동일 prop). `h-[260px]`→`h-65`.
- `PerfSummaryCards.tsx` — 막대 `style width` → `--w` CSS 변수 + `w-(--w)`.
- `usePerfSave.ts` — `useToast` → `sonner toast`(에러 8s).

**admin-group-performance/ui**
- `GroupPerformanceView.tsx` — 701→464줄. 래퍼 이관(Card→`SectionCard`(L1 Card 조합), Button, Modal→`AlertDialog`(위험 확인), toast→sonner). 표시 조각 분리.
- `GroupParts.tsx`(신규: SectionCard·Item·StatusNote·ActionStep), `PoolRowsEditor.tsx`(신규: 등급별 −/슬라이더/＋/숫자입력), `GroupStatusTable.tsx`(신규: raw table → `Table*`), `StateBlocks.tsx`(신규, monthly 와 동일 사본).
- raw `<input type=range>` accentColor 인라인 → `accent-grade-{s..d}` 정적 룩업. raw number input → `Input`. −/＋ → `Button icon-sm`.

**admin-kpi-import/ui**
- `AdminKpiImportView.tsx` — 836→373줄. 로직 불변, 화면 분리·래퍼 이관.
- `importModel.ts`(신규: 상수·타입·행 변환·`guessUserId` 등 순수 로직 이동), `EditableGrid.tsx`(신규: raw table/input/select → `Table*`/`Input`/`Select`/`Button`), `FileEntryRow.tsx`(신규: 파일 한 행), `ImportParts.tsx`(신규: SectionCard·ImportStatusBadge·ImportStepper·ResultCard), `StateBlocks.tsx`(신규: Forbidden).
- 재파싱 확인 모달 = `AlertDialog`(위험), 파일 선택 = `Button asChild`+`<label>`+hidden input.

## eslint-disable 예외 (2건, 모두 `no-restricted-syntax`)
1. `PoolRowsEditor.tsx` — `<input type="range">`: L1 에 Slider 없음.
2. `AdminKpiImportView.tsx` — `<input type="file" className="hidden">`: L1 에 file input 프리미티브 없음(label 이 트리거).

## 추가한 L1 variant (모두 가산, 기존 값 불변)
- `button.tsx` `variant: tab` — `text-muted-foreground hover:bg-card hover:text-foreground` (월 탭 비활성 항목, 조용한 아이콘 버튼[행 삭제·파일 제거]).
- `table.tsx` — `TableHead`/`TableCell` `divider`(열 구분 세로선 `border-r border-border/60 last:border-r-0`), `TableCell` `dense`(`px-2 py-1.5 align-top`), `TableRow` `flag="warning"`(`bg-warning-50 hover:bg-warning-50`, 검토 필요 행).

## 패리티 메모 (시각 차이 가능 지점)
- 빈/접근불가 블록: 구 States 는 좌측정렬+아이콘 박스, L1 `Empty` 는 중앙정렬(아이콘 박스 제거). 점선 박스·배경 유지.
- 차트 막대(매출총이익) 색 `#A78BFA`(토큰 없음) → `chart-2`(#7C3AED, 더 진함). 그 외 hex 는 토큰 1:1(#0257CE=chart-1, #0EA05E=chart-4, #F97316=chart-5, #E7E9F3=chart-grid).
- `StatusNote` danger 테두리 `border-danger-300`(테마 미선언) → `border-danger-200`.
- 월 탭·정성/정량·−/＋ 버튼: Button 높이/폰트가 구 raw 와 약간 다름(월 탭 h-8 유지, 정성/정량 xs=28px, −/＋ `text-sm`).
- 경영실적 표 헤더 `h-8.5`, 열 정렬 center; KPI 편집 그리드 입력 `h-7` + L1 `px-3`(구 px-1.5), 헤더 `px-3`(구 2.5), `sticky` 제거(구 코드도 세로 스크롤 컨테이너가 없어 무효).
- 행 삭제/파일 제거 아이콘: `tab` variant(회색→hover 진한 글자). 구 hover 는 danger 색.
- KPI 그리드 제목 비어있는 행 입력 테두리: 래퍼 `ring-1 ring-warning-500`(L1 Input 은 aria-invalid=red 만).
- 숫자 입력 `PoolCountInput` `font-bold` 유지, 기본 높이 h-8.

## 검증
- `eslint <3 features> --max-warnings=0` → 0 problems
- `pnpm typecheck` → 내 파일 에러 0 (남의 파일: `admin-competency-items/AdminCompetencyItemsView.tsx(98) DEFAULT_OPTIONS`, `eval-midterm/FirstReviewRow.tsx(78,197,207) categoryChip·cn` — 다른 그룹 진행 중)
- 레거시 래퍼 import grep → 0

## 보류/질문
- 없음. (공유 `StateBlocks` 3벌 복제는 T-integrate 에서 L2 로 승격 고려 — monthly·group 동일, kpi-import 는 Forbidden 만.)
