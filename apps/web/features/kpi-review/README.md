# kpi-review feature

팀장·본부장의 KPI 검토 화면(`/kpi/review`) — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 팀원이 제출한 KPI 검토 — 팀원별 묶음·검증 요약·승인/반려/수정요청·일괄 승인·검토 의견 이력.
- **소비 API:** `@growthx/contracts` 생성 클라이언트
  - 조회: `kpisControllerList`(KpiDto[]), `kpisControllerListReviews`(KpiReviewDto[]), `kpisControllerGet`
  - 명령: `kpisControllerCreate·Update·Remove·Submit·Approve·Reject·Confirm·Link`
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 생성 DTO의 느슨한 enum을 도메인 헬퍼와 호환되는 로컬 `Kpi`/`KpiReview` 타입으로 캐스트해 반환. `kpiReviewCommands`(approve·reject·confirm…)로 명령 노출.
  - `hooks.ts` — `useKpiReviewData(cycleId, enabled)`: 목록+리뷰를 `Promise.all` 로 동시 로드, `reload` 제공.
  - `ui/KpiReviewView.tsx` — 화면 전체(기존 `app/(main)/kpi/review/page.tsx` 로직 이동, 시각/동작 보존).
  - 라우트 `app/(main)/kpi/review/page.tsx` 는 `<KpiReviewView/>` 만 렌더.
- **비고:**
  - 보조 데이터(`useAuth`·`usePermissions`·`useCurrentCycle`·`useRuleSet`·`useUsers`)는 기존 훅 유지 — 주 데이터(KPI·리뷰)만 생성 클라이언트로 이관.
  - 등급 배지가 아닌 KPI **상태** 배지(`STATUS_CFG`)라 `lib/grade` 미적용. 디자인 토큰은 Notion Low Color(DESIGN.md) 인라인 유지.
  - RBAC/인증/라우트/데이터 의미 불변 — 데이터 소스만 교체.
