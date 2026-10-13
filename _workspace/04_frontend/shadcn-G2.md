# shadcn G2 — KPI 작성·검토 전환 노트

검증: eslint(소유 경로 전체, --max-warnings=0) 0건 / typecheck 내 파일 에러 0(남은 1건은 타 그룹 `admin-competency-items` `DEFAULT_OPTIONS`) / 레거시 래퍼 import grep 0.

## 파일별 변경
- `components/KpiGradingDisplay.tsx` — 인라인 style 전량 제거. 로컬 GradeChip → `Badge grade-sm`, 공용 `GradeCell`/`GradingHeading` 추출, 하이라이트 틴트 `bg-grade-*/6`(정적 맵), `palette` 의존 제거.
- `components/EvaluationSubjectPanel.tsx` — SearchInput/Avatar 래퍼 → `InputGroup` 직접 + `SubjectAvatar`(ui/avatar, 이름 해시 파스텔; 신규 export), 행 raw button → `Button variant="row-select" size="row-select"`. 공개 props 불변.
- `components/EvaluationDetailHeader.tsx` — Avatar → `SubjectAvatar`. 공개 props 불변.
- `features/kpi/ui/` — `KpiWriteView.tsx`(977→633줄): 도메인 헬퍼 `draft.ts`, 하위 패널 `KpiWriteParts.tsx`(잠금 섹션·하단바·체크리스트·가중치 패널·도넛), 상태 `KpiStates.tsx`(EmptyState/ErrorState = Empty·Alert 조합) 로 분리. Modal → AlertDialog(삭제)/Dialog(양식), useToast → sonner, 추가 버튼 → `Button variant="dashed"`. `KpiDraftCard`: raw input/textarea/select/button → Input/Textarea/Select(chip)/Button, SegmentedControl → ToggleGroup. `KpiLockedCard`: Collapsible 래퍼 → ui/collapsible + Card. `KpiDiffPanel`: 미정의 `text-default` → `text-foreground`.
- `features/kpi-review/ui/` — `KpiReviewView`·`KpiReviewSubComponents` 래퍼 전량 L1 전환, 표 행 grid-cols 임의값 → flex + `KPI_COL` 고정 열 폭(`KPI_ROW_GRID`는 이제 `'flex items-center gap-4'`), 카테고리 칩 palette hex → 클래스 맵, 필터/정렬/일괄 승인 다이얼로그를 `KpiReviewControls.tsx`로 분리, 상태 컴포넌트 `ReviewStates.tsx`(Empty/Error/Forbidden), RejectModal → Dialog.

## 예외(eslint-disable)
- 신규 0건. (기존 `react-hooks/exhaustive-deps` 1건은 스텁 규칙, 변경 없음)

## L1 variant 추가 (모두 추가만, 기존 값 불변)
- `button.tsx`: variant `row-select`(좌측 3px 선택 바, `data-active=true` 틴트) + size `row-select`; variant `dashed` + size `dashed`(점선 추가 버튼).
- `select.tsx`: `SelectTrigger` size `chip` + prop `tone`(`chip-primary`|`chip-foreground`) — KPI 그룹 칩 Select.
- `input.tsx`: prop `tone="accent"`(가중치 입력 연한 블루 바탕·블루 글씨).

## 패리티 메모
- 평가 대상 패널 행 그리드 → flex(동일 배치). 검색창 폭 168px = `w-42`.
- KpiGradingDisplay 등급 칩: 모서리 0 → `rounded-xs`(grade-sm), C 등급 글씨 진갈색(토큰 규약).
- KpiDraftCard: Textarea 배경 `bg-muted` → `bg-card`, `resize-none` 제거(리사이즈 핸들 노출), 카드 hover 테두리 강조 제거, 가중치 입력 높이 h-8/폭 w-16, 삭제 버튼 `icon-sm`.
- KpiLockedCard: 좌측 4px 바가 Card 테두리 안쪽 래퍼로 이동(미세한 1px 차이). 빈 등급 `text-disabled`(미정의라 무효였음) → `text-neutral-400`.
- KpiReview: 필터/전체펼치기 칩 Button size sm(13px 텍스트, 구 12.5px), 정렬 select → Radix Select(`aria-label="정렬 기준"` 유지, w-28), 펼침 chevron 버튼 `icon-xs`(28px, 구 ~24px).
- KpiWriteView 삭제 확인은 AlertDialog(role=alertdialog)로 변경(구 role=dialog) — 문구·버튼 라벨 동일. 삭제는 확인 클릭 즉시 닫힘(구: 요청 끝날 때까지 열림).
- 가중치 도넛 숫자 9px → `text-9h`(9.5px).

## 보류/질문
- `KpiWriteView.tsx` 633줄(200줄 상한 초과): 훅·핸들러 본체가 한 컴포넌트에 묶여 있어 추가 분리는 `useKpiDrafts` 훅 추출이 필요(동작 리스크로 보류).
- `KpiReviewView.tsx` 약 440줄 — 동일 사유로 상한 초과 잔존.
- `SubjectAvatar`는 구 L2 `Avatar` 폴백 로직 복제본(T9에서 `Avatar.tsx` 삭제 시 다른 그룹도 필요하면 공용화 검토).
