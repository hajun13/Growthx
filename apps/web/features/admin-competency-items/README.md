# admin-competency-items feature

역량평가 문항 관리(HR 전용 CRUD) 화면 — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 역량평가 문항(최대 10개)의 목록 조회·필터·생성·수정·활성토글·삭제. 연봉 미반영(참고 데이터).
- **소비 API:** `@growthx/contracts` `competencyControllerListQuestions`(params `{cycleId}`) / `competencyControllerCreateQuestion` / `competencyControllerUpdateQuestion` / `competencyControllerRemoveQuestion`. 타입: `CompetencyQuestionDto`·`CreateCompetencyQuestionDto`·`UpdateCompetencyQuestionDto`.
- **구조:** `api.ts`(생성 클라이언트 호출 + 봉투 `res.data.data` unwrap) · `hooks.ts`(`useCompetencyQuestionsData`·`competencyQuestionCommands`) · `ui/AdminCompetencyItemsView.tsx` · 라우트는 `<AdminCompetencyItemsView/>`만.
- **봉투 gotcha:** orval fetch 함수는 `{ data, status, headers }` 반환, `data`=HTTP 본문(봉투 `{data,meta}`) → 실제 값은 `res.data.data`. `api.ts`에서 한 번 unwrap.
- **비고:** `useAuth`·`useCurrentCycle`·`useToast` 등 보조 데이터/UI 훅은 기존 유지(주 데이터만 생성 클라이언트로 이관). RBAC(`isHrAdmin`)·라우트·동작·시각 보존. 카테고리 배지 색은 도메인 카테고리(리더십/협업/전문성/혁신)용 `catColors`로 유지(등급 S~D 배지가 아니므로 `lib/grade` 미적용). DESIGN.md(Kinetic) 토큰 준수.
