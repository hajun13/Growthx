# shadcn G4b 진행 노트 (eval-dept-head · eval-my · eval-result · eval-result-detail · appeals)

## 파일별 변경
- appeals: AttachmentsCard(Button/Dialog/sonner, 파일 아이콘 색=정적 클래스, 숨김 file input 예외 1), CreateForm(TitledCard·Label·aria-invalid), DecisionForm(RadioGroup·Input·ToggleGroup 등급 선택, 우측 열 `md:w-59`), DetailPanel(톤 박스 정적 클래스), ListPanel(InputGroup 검색·ui/Select·Button card-row/ghost-muted 페이저·AppealEmpty), Stepper(left-1/6·top-6.25·`--w` 변수), AppealsView(Alert 에러·Skeleton·`xl:grid-cols-8` 3:5 분할·Button asChild Link·StatDot 정적 클래스), useAppealActions(sonner), 신규 AppealEmpty.
- eval-dept-head: DeptHeadEvalView(sonner·Button·ActionDialog·TitledCard·KpiCollapseCard·Alert warning·aria-invalid), DeptHeadHelpers(GradePicker=Button grade-pick, 배너), DeptHeadKpiGroupList, DeptHeadKpiEvalCard(증빙 행=Button file-chip). 신규 HelpHint(Tooltip), KpiCollapseCard(Collapsible+Card+Button row/collapse).
- eval-my: StateViews/TitledCard, 스테퍼 열=정적 맵, 버튼류 Button(asChild Link), leading/min-w 스케일화.
- eval-result: 결과 표 div-grid → L2 DataTable(stickyHeader, role=button 행), 차트 → ChartContainer+CSS 변수 색(Tooltip 은 recharts 직접), 분포 막대 `--w`. 신규 공유 헬퍼 StateViews(EmptyBox/ErrorBox/ForbiddenBox)·TitledCard·ActionDialog (eval-dept-head/eval-my/eval-result-detail 이 import — 다른 그룹에서도 필요하면 공용 L2 승격 후보).
- eval-result-detail: raw table → ui/Table(지브라 행 제거), getButtonClasses → Button asChild, 스케일화.

## 추가한 L1 variant (components/ui/button.tsx, 전부 추가 전용)
variant: `ghost-muted`, `card-row`(size=row), `grade-pick`(data-grade/data-selected), `file-chip`, `outline-primary` · size: `grade-pick`, `file-row`, `collapse`. components/ui/textarea.tsx: 기본 클래스에 `read-only:bg-muted` 추가(읽기전용 muted 배경 — 구 `readOnly && 'bg-muted'` 대체).

## 예외 (eslint-disable)
1건: AppealAttachmentsCard 숨김 `<input type="file">` (no-restricted-syntax, L1 에 파일 선택 없음).

## 패리티 메모
- 등급 선택(GradePicker) C 선택 시 글씨 흰색→진갈색(`text-gradeFg-c`, GradeChip 과 동일).
- 지브라 행(ImportRoundTable) 제거, 평가결과 목록은 grid→table 이라 열 폭 분배가 약간 다름.
- 평가 기간 경고 배너는 Alert warning 토큰색(구: #FEF3C7 계열 인라인), 글자 12.5px→Alert 기본.
- 이의제기 등급 선택 토글: 선택 표시가 ToggleGroup outline 기본 on 스타일.
- 이의제기 좌우 분할: minmax(340px,.9fr/1.5fr) → 3/8:5/8(xl).
- 평가 대상 카드의 `border-neutral-300`→기본 border, 종합등급 헤더 hover.

## 보류/질문
- Avatar: 가이드 §4 가 L2 Avatar 유지로 지정(이름 해시 파스텔 폴백 로직 보유)해 `@/components/Avatar` import 5곳 유지 — 브리프 grep 0 기준과 충돌, 코디네이터 판단 필요.
- components/EvalReport·EvaluatorFlow·ComparisonBar(G4a 소유)는 import 만.
- typecheck 잔여 에러 1건은 타 그룹(admin-competency-items `DEFAULT_OPTIONS`).
