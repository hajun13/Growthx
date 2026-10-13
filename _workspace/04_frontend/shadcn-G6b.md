# shadcn 전환 노트 — G6b (평가 운영·보상·역량 문항·재조정 + 공용 3종)

소유: `features/{admin-cycle,admin-compensation,admin-competency-items,admin-midterm-rebaseline}/**`, `components/{ScheduleEditor,FileDropzone,ResultTable}.tsx`.
검증: eslint(소유 경로) 0 / `pnpm typecheck` 0(전체) / 레거시 래퍼 import grep 0. `shadcn/*` eslint-disable 0건(react-hooks 스텁 주석은 기존 그대로).

## 파일별 변경
- **components/ResultTable.tsx** — 동적 className 제거: `TableHead tone="soft" textAlign`, `TableRow plain|interactive`, `TableCell textAlign`.
- **components/FileDropzone.tsx** — Button/States/Toast 레거시 → L1 Button·Input(file, hidden)·Spinner·sonner. 로딩 스피너는 `role=status aria-label` 래퍼 유지.
- **components/ScheduleEditor.tsx** — raw table/input/checkbox/button → Table 계열·Input(date)·Checkbox+Label·Badge(warning/success)·Button(outline xs). 잠금 배지 라벨·aria-label 유지.
- **admin-cycle** — `CycleOpsView`(Card/Button/Toast/States → L1, 좌측 메뉴 raw button → Button `menu-row` variant, 2단 grid 임의값 → flex+폭 스케일), `CycleOpsModals`(Modal → 로컬 `ConfirmDialog`=Dialog 조합), `CycleSelectorBar`, `LegacyReportCard`(Card header 패턴·sticky TableHead), `StateViews.tsx` 신설(Empty/Forbidden, L1 Empty 조합).
- **admin-compensation** — `CompensationView`(287줄), 신설 `CompensationTable.tsx`(스크롤 컨테이너·sticky 헤더/좌측 2열/합계 tfoot), `compensationPrint.ts`(출력 HTML 빌더·공용 포맷 헬퍼를 View 에서 분리 — 로직 그대로), `CompensationRow`(인라인 style 87건 → TableCell variants·클래스. 편집 셀 blur 저장·150ms 디바운스·saved/error 피드백·원값 복원 로직 불변), `GradeChip`(인라인 24건 → Badge grade-*), `CompensationIndexImportSection`(Card/Button/Toast → L1, 미리보기 표를 신설 `IndexPreviewTable.tsx` 로 분리), `StateViews.tsx` 신설.
- **admin-competency-items** — `AdminCompetencyItemsView`(357줄), 신설 `QuestionForm.tsx`(폼·QuestionMetric·draft 타입/상수), `CompositionCards.tsx`, `QuestionTable.tsx`(CSS grid 인라인 템플릿 → L1 Table bare + sticky TableHead `top-(--gx-header-h)`), `ConfirmDialog.tsx`, `StateViews.tsx`, `CategoryManager`. 토글 raw switch → `Switch`, 대상 라디오 → `RadioGroup`, 활성 체크 → `Checkbox`, SearchInput → `InputGroup`(role=searchbox·aria-label·지우기 버튼 동일).
- **admin-midterm-rebaseline** — 변경 없음(redirect 전용 뷰, 위반 0).

## 추가한 L1 variant (모두 추가만, 기존 값 불변)
- `button.tsx`: variant `menu-row`·`menu-row-active`(좌측 세로 메뉴 행), `bare`(칩 안 투명 버튼, 부모 글자색·크기 상속); size `menu-row`, `bare`.
- `table.tsx`: TableHead `groupStart`·`edgeEnd`; TableCell `groupStart`·`edgeEnd`·`rowRule`·`pin`(`start`=sticky 좌측 열 불투명 배경, `foot`=sticky 합계 행). 보상 표 sticky 열/그룹 구분선/합계 행 전용. (`border-separate` 표라 tr 보더가 안 그려져 셀 단위 `rowRule` 필요)

## 패리티 메모 (시각 차이 가능)
- 보상 표: 줄무늬(#FCFCFD) 제거, hover 는 TableRow 기본 틴트(sticky 좌측 2열은 hover 시 흰색 유지). 편집 셀이 L1 Input(h-7, 테두리·px-3)·Select(`size=sm` h-8)로 바뀌어 편집 칸이 약간 크고 비편집(읽기 전용) 사용자에겐 disabled 회색 박스로 보임. 저장 중 입력 글자색 흐림 처리 제거(`saving` 상태 삭제 — 동작엔 영향 없음). 등급 칩 sm/md → Badge `grade-sm`(20px)/`grade-md`(24px) 정사각.
- 보상 승격 셀: 네이티브 select → Radix Select. 빈 값은 센티넬 `__none__`("—" 항목), 저장은 기존처럼 trigger blur 시.
- ScheduleEditor: 날짜 입력 px 10→12, 체크박스 라벨 gap 6→8, 잠금 배지 24→22px, 잠금 버튼 h-7 `outline`.
- CycleOpsView: 좌측 메뉴·우측 패널 카드의 외곽 padding 은 구 `Card`(CardContent p-4 md:p-5) 그대로 보존. 아이콘 14px → L1 기본 16px(size 속성 제거).
- 역량 문항 표: grid → table(고정폭 100/90/72/96/72px 열 힌트), 카테고리/대상 칩 폭은 내용 기준. 편집/삭제 아이콘 버튼은 outline(28px).
- 카테고리 칩의 X 버튼: Button `bare`(투명) — 크기 11px→12px.
- 업로드 "파일 선택"(보상 인덱스): 파란 테두리 라벨 → outline Button(asChild label) — 중립 테두리.
- 로컬 `StateViews`/`ConfirmDialog` 는 레거시 States/Modal 을 L1 Empty·Dialog 로 재조합한 feature 내부 헬퍼(공유 L2 아님). 다른 그룹에도 유사 파일이 있어 T9 에서 공용 L2 수렴 후보.

## 보류/질문
- `CompensationRow` 314줄(19셀 나열이라 분리 이득 작음) — 200줄 상한 초과, 필요시 후속 분리.
- 출력(새 창) HTML 은 `.ts` 문자열 템플릿이라 lint 대상 아님 — 그대로 둠.
- 브라우저 실검증(스크린샷)은 규칙상(`next dev` 금지) 미수행 — 보상 표 sticky 열/합계 행, 좌측 메뉴 활성 바는 T9 시각 패리티 확인 권장.
