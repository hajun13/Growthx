# shadcn 전환 노트 — G3 (본인평가·역량평가)

## 파일별 변경
- `components/GradeCriteriaPicker.tsx` — 인라인 style 전량 제거. 행 = 래퍼 div(등급색 테두리·틴트 룩업맵) + `Button variant="ghost" size="choice"`, 등급 박스 = `Badge grade-sm|muted`. props 불변.
- `components/AchievementField.tsx` — 단위 접미 입력 `InputGroup`+`InputGroupAddon`, `bg-background` 제거(L1 기본 bg-card).
- `components/KpiCard.tsx` — Badge 동적 className → variant(`neutral`/`secondary`/`outline`), raw 삭제 버튼 → `Button ghost-muted xs`.
- `components/EvidencePreview.tsx` — 손수 만든 portal 모달 → `Dialog`(size `2xl`, layout `viewer`). Esc/오버레이 닫기는 Radix. 헤더/닫기(aria-label "닫기")/다운로드 유지. props 불변.
- `components/EvaluationActionPanel.tsx` — `section` → L1 `Card`(sticky 시 하단 고정 그대로). props 불변.
- `features/eval-self/ui/SelfEvaluationView.tsx` — Modal→Dialog, Button/Collapsible/Toast/States 래퍼 → L1/sonner. 624→518줄(아래 분리).
  - 신규 `SelfStates.tsx`(Skeleton·Empty·Error·경고 배너 `Alert`·PromptCard·LinkButton), `KpiGroupList.tsx`(그룹별 접이식 카드, 구 Collapsible 래퍼 인라인 구현).
- `features/eval-self/ui/KpiCard.tsx` — raw input/textarea → `Input`/`Textarea`, style maxWidth → `max-w-*`.
- `features/eval-self/ui/EvidenceSection.tsx` — Button/Toast 이관, hidden file input → `Input type="file" hidden`(예외 불필요), Loader2 → `Spinner`.
- `features/eval-self/ui/SelfProgressCard.tsx` — 진행바 `--w` CSS 변수.
- `features/competency-eval/ui/SheetTable.tsx`·`OpinionSection.tsx` — raw table → `Card`+`Table grid`/`TableHead`/`TableCell`, 점수 1~5 버튼 → `Button size="score"`(role="radio"/aria-checked 유지).
- `features/competency-eval/ui/SubmitPanel.tsx` — Button 이관, 진행바 CSS 변수. `CompetencyEvalView.tsx` — States→신규 `CompetencyStates.tsx`, 상태 칩 → `Badge`. `useCompetencyForm.ts` — `useToast` → sonner(에러 8s).

## 예외(eslint-disable): 0건

## 추가한 L1 variant (모두 추가 전용)
- `button.tsx`: size `score`(17×24 점수 셀), size `choice`(등급 기준 선택 행, disabled 도 흐리지 않음)
- `table.tsx`: `Table` prop `grid`(모든 셀 격자 테두리 — 엑셀 양식 표)
- `dialog.tsx`: size `2xl`(960px), layout `viewer`(패딩 0·고정 높이 85vh)
- (사용) 타 그룹이 추가한 `button ghost-muted` 재사용

## 패리티 메모
- Table 셀 패딩이 L1 기본(px-3 py-2.5)이라 역량평가서 표 행 높이가 약 2px 커짐. 점수 버튼 미선택 색 = outline variant(border-input, 글씨 secondary-foreground).
- Empty 블록: 구 EmptyState 의 좌측 정렬 가로 배치 → L1 Empty 의 중앙 정렬(점선 박스 래퍼는 유지).
- 경고 배너: 구 임의 hex(#FEF3C7 등) → Alert `warning`/`destructive` 토큰색.
- 증빙 미리보기 높이 min(88vh,900px) → 85vh. KpiCard 그룹 칩 font-medium → Badge 기본 semibold.
- 버튼 로딩 시 좌측 아이콘은 숨김(스피너만) — 구 래퍼와 동일 의도.

## 검증
- eslint(소유 경로 전체) --max-warnings=0 → 0건, 소유 경로 레거시 래퍼 import 0.
- 전체 `pnpm typecheck` 는 타 그룹(eval-midterm 등) 파일의 구문 오류로 실패 중이라(내 소유 아님), 내 파일 + 전이 import 만 별도 tsconfig 로 tsc → 에러 0.
