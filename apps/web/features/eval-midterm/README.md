# eval-midterm feature

6월 중간점검(`/eval/midterm`) 수직 슬라이스 — notifications/reports-summary 표준 패턴.

- **책임:** 상반기 중간점검 화면. 본인 "내 점검"(KPI 진척·자가점검 제출·종합 코멘트·부서장 피드백·보완조치) + 부서장 "구성원 점검"(구성원 진척 검토·자가점검 확인·보완조치·재조정 검토·조직 진척).
- **소비 API(생성 클라이언트, `@growthx/contracts`):**
  - `midtermController*`: GetProgress · ListReviews · SubmitSelf · Confirm
  - `actionItemsController*`: List · GetOne · Create · Update · Transition
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 목록은 `{ data, meta }` shape 유지. 반환 타입은 앱 도메인 타입(`@/lib/types`)으로 노출(생성 DTO 와 구조 동일 → 경계 캐스팅).
  - `hooks.ts` — `useMidtermProgress` · `useMidtermReviews` · `useActionItems` + `midtermReviewCommands` · `actionItemCommands`. 기존 `@/hooks/useMidterm` 과 동일 시그니처(`useAsync` 기반)라 이동된 컴포넌트가 데이터 소스만 바꿔 그대로 동작.
  - `ui/MidtermView.tsx` — 페이지(역할별 탭 분기). 라우트 `app/(main)/eval/midterm/page.tsx` 는 `<MidtermView/>` 만 렌더(얇게).
  - `ui/EmployeeMidterm.tsx` · `ui/EmployeeMidtermRail.tsx`(우측 sticky 요약 레일 — 파일 상한 분리) · `ui/DeptHeadMidterm.tsx` · `ui/OrgProgressCard.tsx` · `ui/RebaselineRequestSection.tsx` · `ui/RebaselineReviewQueue.tsx` — 화면 컴포넌트(공용 프리미티브 `@/components/*` 소비).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `components/ApiClientInit.tsx`((main) 레이아웃에 마운트). 건드리지 않음.

## ApiError 두 종류(주의)
생성 클라이언트(customFetch)는 **contracts runtime `ApiError`** 를 throw 한다. 이동된 컴포넌트는
`@/lib/api` 의 `ApiError` 로 `instanceof`·`err.code`(예: `INVALID_STATE_TRANSITION`) 분기를 한다 —
두 클래스는 형태(code/status/message)는 같으나 별개라 `instanceof` 가 어긋난다. 그래서 `api.ts` 의
`translateErrors()` 가 경계에서 **`@/lib/api` `ApiError` 로 변환해 재throw** 한다(컴포넌트 에러 분기 보존).

## 범위 밖(이 슬라이스에서 이관하지 않음)
- **재조정(rebaseline) 워크플로우**: `useRebaselineRequests` · `useRebaselineRequestDetail` ·
  `rebaselineRequestCommands` · `useRebaselineHistory` 는 배정 함수 목록 밖이라 `RebaselineRequestSection`/
  `RebaselineReviewQueue`/`DeptHeadMidterm` 가 기존 `@/hooks/useMidterm` 의 rebaseline 부분을 계속 사용한다.
  (생성 클라이언트로 이관은 해당 컨트롤러 codegen 후 별도 슬라이스 작업에서.)

## 등급 배지
등급(S~D) 배지 색은 공유 모듈 `@/lib/grade`(`gradeColor()`, dark-on-light) 사용 —
`EmployeeMidterm` 의 로컬 `GRADE_BADGE`(흰 텍스트) 상수를 제거하고 교체했다.
