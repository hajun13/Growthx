# admin-rules feature

평가 규칙 설정(HR) 화면 — 현재 주기 RuleSet(등급 척도·측정방식별 달성률표·그룹풀 비율·등급별 인상률·그룹실적 보너스·다단계 가중치 정책) 편집. 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 현재 주기에 연결된 RuleSet 조회·편집(인상률·그룹실적 보너스·가중치 정책 저장). 저장 권한은 `시스템 설정` feature 단독 게이트(백엔드 403 정합).
- **소비 API:** `@growthx/contracts` `ruleSetsControllerList`·`ruleSetsControllerGet`·`ruleSetsControllerCreate`·`ruleSetsControllerUpdate` (GET/POST/PATCH `/rule-sets`).
- **구조:** `api.ts`(봉투 `res.data.data` unwrap) · `hooks.ts`(`useRuleSetData`·`ruleSetCommands.update`) · `ui/RulesView.tsx`(편집 모델 `toDraft`/`toPatchBody` + `RuleSetEditor`) · 라우트는 `<RulesView/>`만.
- **타입 비고:** 생성 `RuleSetDto`의 `gradeScale`·`weightPolicy` 등은 OpenAPI 상 느슨한 JSON(`{ [key: string]: unknown }`)으로 발행된다. 런타임 shape 은 도메인 `RuleSet`(`@/lib/types`)과 동일하므로 `api.ts`에서 도메인 타입으로 좁혀 넘긴다(편집 로직이 이 타입에 의존).
- **에러:** 생성 클라이언트는 runtime `ApiError`(`.message`=백엔드 메시지)를 throw — View 저장 핸들러는 `err instanceof Error ? err.message`로 표면화.
- **비고:** `useAuth`·`usePermissions`·`useCurrentCycle` 등 보조 데이터는 기존 훅 유지(주 데이터만 생성 클라이언트로 이관). `RuleSetEditor`(등급 배지 포함)는 공용 컴포넌트로 불변. 디자인 토큰은 `@/components`(Notion Low Color).
