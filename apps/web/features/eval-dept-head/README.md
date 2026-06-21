# eval-dept-head feature

부서장 평가 화면(`/eval/dept-head`) — 새 아키텍처 표준 패턴(notifications·reports-summary 패턴 복제).

- **책임:** 부서장(팀장 1차·본부장 2차·그룹대표 최종, role 식별)이 자기 단계 배정 팀원의 본인평가(self) 실적을 연동 조회하고, 정성 과제 등급·문항별/종합 코멘트·(선택)종합등급 오버라이드를 작성해 제출. 본인평가 증빙 인라인 미리보기.
- **소비 API:** `@growthx/contracts` 생성 클라이언트 —
  `evaluationsControllerList`·`evaluationsControllerGet`·`evaluationsControllerListEvidence`·`evaluationsControllerCreate`·`evaluationsControllerPatch`·`evaluationsControllerComment`·`evaluationsControllerSubmit`·`evaluationsControllerFinalize`.
- **구조:** `api.ts`(생성 클라이언트 호출 + 봉투 `res.data.data` unwrap) · `hooks.ts`(`useEvaluations`·`useEvaluationDetail`·`useEvaluationEvidence` — `useAsync` 래핑, 호출부 소비 shape 보존) · `ui/DeptHeadEvalView.tsx`(전 로직) · 라우트 `page.tsx`는 `<DeptHeadEvalView/>`만.
- **gotcha:**
  - orval fetch 클라이언트는 `{ data: <봉투>, status, headers }` 반환 → 실제 값은 `res.data.data`. `api.ts` 에서 한 번 unwrap.
  - 생성 `EvaluationsControllerListParams` 에는 `type`/`status` 필터가 없어 `fetchEvaluations` 가 클라이언트 측에서 후필터(downward/self 구분).
  - GET `:id/evidence` 의 `kpiId` 는 백엔드 optional 이나 생성 타입은 required → `kpiId: undefined` 전달(URL 빌더가 쿼리 생략 → 전체 조회, 원래 동작 보존).
- **등급 배지:** 공유 `@/lib/grade`(`gradeColor()` — dark-on-light `{bg,fg}`). 기존 로컬 `GRADE_BADGE`(흰 텍스트) 상수 제거.
- **비고:** `useAuth`·`useCurrentCycle`·`useKpis`·`useRuleSet` 등 보조 데이터는 기존 공용 훅 유지(주 데이터=평가만 생성 클라이언트로 이관). 등급풀은 전체관리자 전용 화면에서만 노출하고, 제출 검증은 서버가 전사 기준으로 수행한다. 디자인 토큰은 Notion Low Color(DESIGN.md).
