# eval-midterm feature

6월 중간점검(`/eval/midterm`) 수직 슬라이스 — notifications/reports-summary 표준 패턴.

- **책임(2026-07-23 재구성):** 상반기 중간점검 2단계 흐름 화면.
  `pending →(1차 부서장 코멘트) commented →(본인 목표 수정) revised →(2차 그룹대표 판정) closed | returned →(재수정) revised`
  - "내 중간 점검": 내가 피평가자인 건 — 내 차례면 목표 수정(`MemberRevisionPanel`), 아니면 읽기 전용 이력.
  - "구성원 점검": 내가 1차/2차 검토자로 **배정된** 건 — `FirstReviewPanel`/`FinalReviewPanel`, 차례가 아니면 읽기 전용.
  - ⚠ 탭 노출은 role 이 아니라 **배정 데이터**(`firstReviewerId`/`finalReviewerId`)로 판정한다 —
    부서장은 `Department.headUserId` 로 지정되므로 계정 role 이 `employee` 인 부서장이 존재한다.
  - 폐기: 자가점검 제출·재조정(rebaseline) 신청/검토 화면(백엔드가 두 진입점을 모두 거부).
- **소비 API(생성 클라이언트, `@growthx/contracts`):**
  - `midtermController*`: GetProgress · ListReviews · Detail · Comment · SubmitRevision · Approve · ReturnToMember
  - `actionItemsController*`: List · GetOne · Create · Update · Transition
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 목록은 `{ data, meta }` shape 유지. 반환 타입은 앱 도메인 타입(`@/lib/types`)으로 노출(생성 DTO 와 구조 동일 → 경계 캐스팅).
  - `hooks.ts` — `useMidtermProgress` · `useMidtermReviews` · `useActionItems` + `midtermReviewCommands` · `actionItemCommands`. 기존 `@/hooks/useMidterm` 과 동일 시그니처(`useAsync` 기반)라 이동된 컴포넌트가 데이터 소스만 바꿔 그대로 동작.
  - `ui/MidtermView.tsx` — 페이지(탭 + 내 중간 점검 분기). 라우트 `app/(main)/eval/midterm/page.tsx` 는 `<MidtermView/>` 만 렌더(얇게).
  - `ui/ReviewerQueue.tsx` — "구성원 점검" master-detail(목록 → 상태별 패널 분기, 파일 상한 분리).
  - `ui/FirstReviewPanel.tsx`(1차 코멘트) · `ui/MemberRevisionPanel.tsx`(본인 목표 수정) · `ui/FinalReviewPanel.tsx`(2차 승인/반려) — 단계별 화면.
  - `ui/MidtermTrailTimeline.tsx`(진행 이력) · `ui/midtermFlowHelpers.tsx`(상태 칩·차례 안내 문구·읽기 전용 보기).
  - `ui/MemberDetail.tsx` · `ui/ReviewSplitPanel.tsx` · `ui/KpiCheckInCard.tsx` · `ui/EmployeeMidtermRail.tsx` · `ui/deptHeadHelpers.tsx` — **구 흐름 잔존(현재 소비처 없음)**. 자가점검·재조정 화면(`EmployeeMidterm`·`DeptHeadMidterm`·`Rebaseline*`) 삭제로 고아가 됨 — 정리 대상.
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `components/ApiClientInit.tsx`((main) 레이아웃에 마운트). 건드리지 않음.

## ApiError 두 종류(주의)
생성 클라이언트(customFetch)는 **contracts runtime `ApiError`** 를 throw 한다. 이동된 컴포넌트는
`@/lib/api` 의 `ApiError` 로 `instanceof`·`err.code`(예: `INVALID_STATE_TRANSITION`) 분기를 한다 —
두 클래스는 형태(code/status/message)는 같으나 별개라 `instanceof` 가 어긋난다. 그래서 `api.ts` 의
`translateErrors()` 가 경계에서 **`@/lib/api` `ApiError` 로 변환해 재throw** 한다(컴포넌트 에러 분기 보존).

## 범위 밖
- **재조정(rebaseline) 워크플로우**: 2026-07-23 자로 폐기 — 백엔드 create/update/review 가
  `VALIDATION_ERROR` 로 거부한다. 화면(`RebaselineRequestSection`·`RebaselineReviewQueue`·`RebaselineInlineForm`)은
  삭제했고, `@/hooks/useMidterm` 의 rebaseline 훅은 다른 소비처(`components/RebaselineHistory`)가 있어 남아 있다.
