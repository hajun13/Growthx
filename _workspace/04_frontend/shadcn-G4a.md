# G4a — EvalReport / EvaluatorFlow / ComparisonBar

## 파일별 변경
- `components/EvalReport.tsx` (698→226줄): 인라인 style 351건 제거. 공개 export(`EvalReport`, `EvalReportData`, `EvalReportProps`) 유지. Printer/닫기 버튼 → L1 `Button`, 토스트 → `sonner`, 아바타 → L1 `Avatar`/`AvatarFallback`(L2 래퍼와 같은 해시 톤 규칙을 로컬 함수로).
- 신규 `EvalReportParts.tsx`(GradeBox·GradePill·SectionTitle·ScoreBar·GroupCard), `EvalReportLive.tsx`(LiveBody), `EvalReportImport.tsx`(ImportBody) — 200줄 상한 분리. 표 → L1 `Table*`, 칩 → `Badge`, 등급 알약 → `Badge grade-*`.
- `ComparisonBar.tsx`: 인라인 width/left → CSS 변수(`w-(--w)`, `left-(--avg)`), `top-[-4px]`→`-top-1`, `w-[2px]`→`w-0.5`.
- `EvaluatorFlow.tsx`: 변경 없음(이미 lint 0).

## 인쇄(핵심 동작 변경 주의)
인쇄창은 별도 document 라 Tailwind 클래스가 안 먹는다. `handlePrint` 가 화면의 `<link rel=stylesheet>`/`<style>` 을 인쇄창 head 에 복제한다. 구 인쇄 CSS 의 `* {margin:0;padding:0}` 리셋은 레이어 밖 규칙이라 Tailwind 유틸을 덮어써서 제거(preflight 가 대체). 인쇄 트리거는 `load` 이벤트(+200ms) / 2초 폴백. **실제 인쇄 미리보기 육안 확인 필요**(실행은 금지라 미검증).

## 패리티 메모
- 구 렌더는 radius 0 — DESIGN.md 토큰대로 카드 `rounded-md`/시트 `rounded-lg`/칩 `rounded-sm`로 정렬.
- 인쇄 버튼 진한 먹색 → `Button` 기본(액션 블루). 닫기 → outline.
- 합산 실적 행 파란 배경 → `TableFooter`(muted; DESIGN §7 컬러 행 배경 금지), 글씨는 `text-brand-blue-hover` 유지.
- C 등급 글씨: 구 EvalReport 는 흰색 → 토큰(`gradeFg-c` 진갈색, 앱 전역 GradeChip 과 동일).
- 표 헤더 높이 40px(L1 `TableHead h-10`), 행 line-height 1.5(preflight).

## 예외 / 추가 variant
- eslint-disable 0건, L1 variant 추가 0건.

## 검증
- eslint 소유 6파일 `--max-warnings=0`: 0. 레거시 import grep: 0.
- typecheck: 내 파일 에러 0 (남의 파일: `features/admin-users/ui/AdminUsersView.tsx` 518/523 `OrgTabPanels` 미정의).
