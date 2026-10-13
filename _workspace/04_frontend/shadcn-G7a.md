# G7a — reports / reports-summary / reports-yoy / dashboard / ExportButton (shadcn L1 전환)

검증: eslint(소유 경로) 0 · 레거시 import grep 0 · 소유 파일 tsc 0(임시 tsconfig로 소유 경로만 — 타 그룹 파일 구문 오류로 전체 typecheck는 불가). reports-yoy는 README만 존재(코드 없음).

## 파일별
- components/ExportButton: Button(ui)+sonner toast.error(8s), 아이콘은 자식.
- dashboard: 패널 section→Card, ChecklistGrid 버튼→Button outline xs, StatCards 진행바 width→`--w`, 도넛 T.* 색→stroke 클래스, OrgProgressDonut slice `color`(hex)→`tone`('done'|'active'|'idle') 클래스 룩업, PhaseStepper grid/left/right/width→CSS 변수, RecentChangesTable grid-cols 임의값→flex+w-14/22/18, EvalSchedulePanel left-[15.5px]→left-4+-translate-x-1/2, DashboardView ErrorState/Skeleton/Button→L1(Alert 인라인).
- reports: ReportsView SegmentedControl→ToggleGroup, DistFilters 등급 버튼→Button(aria-pressed), DistResultList raw table→Table(bare)+TableHead sticky, 페이지 크기 select→Select, Avatar→PersonAvatar, DistCompanyBar/DistDeptBars 인라인 색/너비→GRADE_SOLID 룩업+`--w`, MonthlyPerfTab recharts→ChartContainer/ChartTooltip(+폼은 MonthlyPerfForm 분리, 카테고리 표→Table), DistMonitorTab 카드→ReportCard·그리드 minmax→grid-cols-5 col-span-2/3.
- reports-summary: 결과표 raw table→Table, SummaryFilters→FilterSearch/FilterSelect, SummaryGradeStats Card+Tooltip(help Button)+bar `--w`, SummaryRowExpand TableRow/TableCell(flush)+내부 div 틴트.
- 신규(reports/ui): ReportStates(ReportEmpty/Error/Forbidden), ReportCard, FilterControls(FilterSelect/FilterSearch), ResultPagination, PersonAvatar, gradeTone(GRADE_SOLID), MonthlyPerfForm. reports-summary가 reports/ui 의 일부를 import(교차 feature) — T-integrate 에서 L2 승격 후보.

## eslint-disable (3건)
- DashboardView `min-h-[calc(100vh-124px)]`, DistMonitorTab `min-h-[calc(100vh-250px)]`, EvaluationSummaryView `max-h-[max(480px,calc(100vh-400px))]` — 뷰포트 채움 복합 calc, 스케일 표현 불가.

## 추가한 L1 variant: 없음.

## 패리티 메모
- Empty 계열은 L1 `border` 금지라 점선 프레임 없음, 중앙 정렬(구 EmptyState 는 좌측 정렬+테두리).
- 등급 막대 글씨: C 등급 진갈색(text-gradeFg-c) — 구 렌더는 전 등급 흰색.
- 결과표/결과목록 셀 패딩·헤더 높이는 L1 TableHead/TableCell 기본값(구: px-2.5 py-2 / 헤더 py-2.5) — 약간 여유로움. 결과표 정렬 토글은 ghost xs 버튼(파란 글씨).
- 필터의 등급 버튼 높이 32px(sm, 글자 13px), 페이지 크기 Select 높이 32px(구 36px), 결과 "상세보기" 버튼 xs(28px).
- 카테고리 누적 표·차트 Tooltip 은 ChartTooltipContent(L1 스타일) 사용.
- DistMonitorTab 하단 그리드 minmax(360px,.8fr/1.2fr)→5열 2:3(최소폭 제한 없음), MonthlyPerf 11:9.

## 보류/질문
- E2E 로케이터: 'select' 기반이던 필터 라벨(그룹/본부/…)은 `aria-label` 유지 — combobox role 로 노출.
