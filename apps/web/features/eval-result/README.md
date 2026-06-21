# eval-result feature

평가결과 목록(검토자 전용) 화면 — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 패턴 복제).

- **책임:** 등급 분포·등급별 인원 차트·필터(등급/부서)·결과 테이블 조회. 행 클릭 시 `/eval/result/:userId` 상세로 이동. 임직원(열람권 없음)은 본인 상세로 리다이렉트.
- **소비 API:** `@growthx/contracts` `resultsControllerList`(목록) · `resultsControllerGetDetail`(상세) · `resultsControllerAggregate`(재집계). 타입: `EvaluationResultDto`.
- **구조:** `api.ts`(봉투 `res.data.data` unwrap) · `hooks.ts`(`useResultsData`) · `ui/EvalResultView.tsx` · 라우트 `app/(main)/eval/result/page.tsx`는 `<EvalResultView/>`만.
- **비고:** `useAuth`·`useCurrentCycle` 등 보조 데이터는 기존 훅 유지(주 데이터만 생성 클라이언트로 이관). 등급 배지 색은 공유 모듈 `@/lib/grade`(`gradeColor` — dark-on-light) 사용. 디자인 토큰은 Notion Low Color(DESIGN.md).
