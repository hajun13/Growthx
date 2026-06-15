# org feature

조직도 화면의 수직 슬라이스 — notifications 표준 패턴(architecture.md §5) 복제.

- **책임:** 조직도 트리(그룹→본부→팀) 조회·목록·가시성 설정 화면. HR 관리자는 조직 노드/구성원 CRUD.
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`orgChartControllerGetChart`) — 조직도 데이터 소스. 구성원·부서 CRUD 커맨드(`userCommands`·`departmentCommands`)와 보조 조회(`useUsers`·`usePositions`)는 기존 `@/hooks/*` 유지(이 슬라이스 범위 밖 모듈).
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 컴포넌트엔 도메인 값(`OrgChartNode`)만.
  - `hooks.ts` — `useOrgChartData`(로드·reload).
  - `ui/OrgView.tsx` — 화면(조직도 트리·목록·가시성 매트릭스 + 노드/구성원 모달).
  - 라우트 `app/(main)/org/page.tsx` 는 `<OrgView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 에 마운트(건드리지 않음).
- **불변식:** 인증·baseUrl 은 contracts runtime 에 주입. 봉투 unwrap 은 api.ts 한 곳. RBAC·라우트·데이터 의미·시각/동작 보존(조직도 데이터 소스만 생성 클라이언트로 이관).

## 메모
- 생성 DTO `OrgChartNodeDto` 는 로컬 `OrgChartNode`(@/lib/types)와 구조 동일 → api.ts 에서 그대로 반환(공용 `OrgNodeModal`·`flattenOrg` 가 로컬 타입 사용).
- 등급 배지 없음(이 화면은 인원 카운트만) → `lib/grade` 미사용.
