# shadcn 전환 노트 G1 — 중간점검

검증: eslint(소유 경로 전체, --max-warnings=0) 0 · typecheck 내 파일 0(남의 `AdminCompetencyItemsView` DEFAULT_OPTIONS 에러만 존재) · 레거시 래퍼 import(절대+상대) 0 · eslint-disable 0건.

## 신규 파일 (소유 경로 안, 레거시 래퍼 대체용 L2 조합 — 전부 L1 조합)
- `components/MidtermStates.tsx` — `EmptyState`/`ErrorState`(Empty·Alert·Button), `CardTitleBar`, `PanelCard`(구 Card title/action/padding 호환), `HiddenLabelTextarea`(구 TextField hideLabel multiline).
- `components/MidtermAvatar.tsx` — ui/avatar 직접 조합(이름 해시 파스텔 5색, 구 L2 Avatar 와 동일 규칙).
- `features/eval-midterm/ui/ConfirmDialog.tsx` — 구 Modal(primary/secondary) 호환 Dialog 조합. 확인 모달 4곳 공용.
- `features/eval-midterm/ui/DecisionControls.tsx` — 코멘트 Input + 수락/조정 ToggleGroup(1차 검토·재조정 검토 공용).
- `features/eval-midterm/ui/FirstReviewRow.tsx` — FirstReviewPanel 에서 표형 KPI 행 분리(475→265줄).

## 파일별 변경 요약
- components: ActionItemStatusBadge·MidtermSignalBadge → `Badge`; TrendIndicator → 토큰 색 클래스; MidtermActionPanel/ResultSummary → L1 Card+CardTitleBar+Badge/Avatar; MidtermProgressTable → L1 `Table`, 그룹/유형 칩 `Badge`; ActionItemRow → Button(ghost-muted icon-xs)·ToggleGroup(상태 토글, role radiogroup/radio 유지)·Label+Textarea.
- features/eval-midterm/ui: 전 파일 Button/Card/Modal/Toast/States/TextField/Avatar/Tabs 레거시 → L1 또는 위 신규 조합. toast.show → sonner(`toast.success`/`toast.error(…,{duration:8000})`/`toast`). raw input/textarea/button → Input/Textarea/Button/ToggleGroup. 인라인 색 칩 → Badge variant. KpiCheckInCard: 진척바 `Progress`, 자가등급 버튼 `Button variant="grade-pick"`(G4b 가 추가한 variant), 등급 기준 칩 `GradeChip`, 3열 grid 임의값 → flex + `md:grow-5/grow-8 basis-0`. FirstReviewRow: `grid-cols-[44px…]` → flex + 고정폭 열(w-11/w-18/w-37.5), 헤더 행도 동일.

## 추가한 L1 variant
없음(G4b 가 추가한 `Button variant/size="grade-pick"`, `ghost-muted` 사용만).

## 패리티 메모
- 신호/상태/판정 칩: Badge xs(h-5, 11px, medium) — 구 칩 대비 높이·폰트 ±0.5px, 테두리 1px(-100 톤) 추가. MidtermSignalBadge `size` prop 은 호환용(sm/md 동일 렌더).
- MidtermProgressTable: 행 hover 틴트 30→50%(TableRow 기본), 셀 세로 패딩 12→10px, 헤더 h-10(L1 기본).
- EmptyState: L1 `Empty`(중앙 정렬·아이콘 칩) — 구 좌측정렬 점선 박스는 래퍼 div 로 점선 테두리만 유지. 텍스트 정렬이 중앙으로 바뀜.
- 수락/조정(재조정) 선택: 선택 시 초록/주황 틴트 → ToggleGroup 선택색(muted)로 변경, 상태는 행 헤더의 판정 배지가 색으로 표시. 그룹 role 은 radiogroup(버튼 아님) — E2E 는 텍스트 로케이터만 사용 확인.
- ActionItemRow 상태 토글도 동일하게 ToggleGroup(활성=muted+semibold, 비허용=disabled).
- 등급 선택 버튼 36→40px 높이, 2px 테두리(grade-pick 규격). 확정 외 `ErrorState`/배너 문구는 불변.
- Button `size="sm"` 안의 아이콘은 `size-3.5`/`size-3` 명시(sm 은 svg 크기 규칙 없음). 로딩 시 좌측 아이콘 숨김은 `!loading &&` 로 유지.
- 등급 기준 아코디언 토글: font-semibold(L1 Button 타이포 소유; font-normal 불가).

## 보류/질문
- 200줄 초과 잔존(기존부터): MemberRevisionPanel 628, ReviewSplitPanel 412, midtermFlowHelpers 335, KpiCheckInCard 329, MidtermOpenPanel 274 — 이번 범위(전환)에서는 분할하지 않음.
- 소유 밖 변경 없음. 사용처 0 컴포넌트 삭제 없음.
