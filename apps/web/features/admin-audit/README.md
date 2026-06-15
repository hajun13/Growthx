# admin-audit feature

감사 로그(`/admin/audit`) 화면의 수직 슬라이스 — notifications 표준 패턴 복제.

- **책임:** 민감 변경 이력 조회·엔티티 필터·클라이언트 검색·페이지네이션·변경 내역(diff) 모달.
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`auditLogsControllerList`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 쿼리(page/pageSize)는 문자열로 직렬화. 컴포넌트엔 `{ data, meta }` 도메인 값만.
  - `hooks.ts` — `useAuditLogsData(filter, { enabled })` (로드·reload, `{ data, loading }` 형태).
  - `ui/AdminAuditView.tsx` — 화면(공용 프리미티브 `@/components/*` + Kinetic 토큰). 시각/동작은 기존 page.tsx 그대로 보존.
  - 라우트 `app/(main)/admin/audit/page.tsx` 는 `<AdminAuditView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 에 마운트(건드리지 않음).
- **불변식:** RBAC(`isHrAdmin` + `hasFeature('감사로그')`)·라우트·데이터 의미 불변. 봉투 unwrap 은 api.ts 한 곳.

## 비고
- 감사 로그 행/배지는 등급(S~D)이 아니라 엔티티 색(`ENTITY_FILTERS`)을 쓰므로 `lib/grade` 미사용.
- `before/after` 는 자유형태 JSON → api.ts 에서 화면 `AuditLog` 타입으로 캐스팅(DiffViewer 호환).
