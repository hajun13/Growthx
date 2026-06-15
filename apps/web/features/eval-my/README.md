# eval-my feature

내 평가표 화면(`/eval/my`) — 새 아키텍처 표준 슬라이스([[notifications]]·[[reports-summary]] 패턴 복제).

- **책임:** 본인 KPI 상태 집계 + 다단계 평가 진행 현황 + 캘리브레이션 완료 후 결과 상세(등급·점수·유형별 비교) 표시.
- **소비 API:** `@growthx/contracts` `resultsControllerGetDetail`(타입: `EvaluationResultDto`). 결과 상세가 주 데이터.
- **구조:** `api.ts`(봉투 `res.data.data` unwrap) · `hooks.ts`(`useMyResultDetail`) · `ui/MyEvaluationView.tsx` · 라우트는 `<MyEvaluationView/>`만.
- **에러 처리:** 결과는 캘리브레이션 후 공개 → 미공개 시 404. `hooks.ts` 가 생성 클라이언트의 `ApiError`(`@growthx/contracts`)를 **그대로 보존**한다(useAsync 는 404/403 상태를 NETWORK_ERROR 로 재포장하므로 미사용). View 는 `error.isForbidden`(403)→Forbidden, `status === 404`→미공개 graceful degrade, 그 외→ErrorState.
- **보조 데이터:** `useAuth`·`useCurrentCycle`·`useCurrentPhase`·`useKpis`·`useEvaluations` 기존 훅 유지(주 데이터=결과 상세만 생성 클라이언트로 이관).
- **디자인:** Kinetic 토큰. 등급 배지는 공유 `@/lib/grade`(`gradeColor` — dark-on-light) 사용(기존 로컬 `GRADE_HEX` 흰텍스트 → 연한 배경+어두운 텍스트로 교체). 시각/동작은 기존 페이지와 동일하게 보존.
