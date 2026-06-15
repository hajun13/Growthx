# reports-summary feature

평가자정리 표(평가 결과 요약) 화면 — 새 아키텍처 표준 패턴(두 번째 적용, [[notifications]] 패턴 복제).

- **책임:** 다단계(1차 팀장·2차 본부장·최종 그룹대표) 평가 합산 표 조회·필터.
- **소비 API:** `@growthx/contracts` `resultsControllerSummary`(타입: `SummaryRowDto`).
- **구조:** `api.ts`(봉투 unwrap) · `hooks.ts`(`useEvaluationSummaryData`) · `ui/EvaluationSummaryView.tsx` · 라우트는 `<EvaluationSummaryView/>`만.
- **백엔드:** `results` 컨트롤러 `GET /summary`에 `@ApiTags('results')`+`@ApiOkEnvelopeArray(SummaryRowDto)` 부착(응답 타입화).
- **비고:** `usePositions`·`useCurrentCycle` 등 보조 데이터는 기존 훅 유지(주 데이터만 생성 클라이언트로 이관). 디자인 토큰은 `@growthx/ui`(Kinetic).
