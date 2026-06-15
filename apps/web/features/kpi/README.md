# kpi feature

KPI 작성 화면(`/kpi`)의 수직 슬라이스 — architecture.md §5 표준 패턴.

- **책임:** 본인 KPI 작성·임시저장·제출, 제출/확정 후 읽기 표시, 1차 확정 대비 변경 내역(diff) 표시.
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`kpisController*`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 조회(`fetchKpis`·`fetchKpisByStatus`·`fetchKpiReviews`·`fetchKpi`)와 명령 묶음(`kpiCommands`: create/update/remove/submit/approve/reject/confirm/link). 컴포넌트엔 도메인 값(`lib/types`)만.
  - `hooks.ts` — `useKpisData(cycleId, userId)` — 기존 `useKpis` 와 동일하게 목록 봉투 형태 `{ data: { data: Kpi[] } }` + `{ loading, error, reload }` 제공(화면 로직 보존).
  - `ui/KpiWriteView.tsx` — 화면(공용 프리미티브 `@/components/*` 소비). 등급 배지 색은 공유 `@/lib/grade`(`gradeColor`).
  - 라우트 `app/(main)/kpi/page.tsx` 는 `<KpiWriteView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 의 `ApiClientInit`.
- **불변식:**
  - 봉투 unwrap 은 `api.ts` 한 곳. 생성 DTO 의 loose JSON 필드(`gradingCriteria`·`grading`)는 `lib/types` 정밀 타입으로 좁혀 넘김(런타임 동일, 정적 타입만 정밀화).
  - 제출 흐름은 저장 후 `fetchKpisByStatus(..., 'draft')` 로 draft 재조회 → 각 건 `submit`(기존 동작 보존).
  - 카테고리 정책·템플릿·스냅샷·룰셋 등 그 외 데이터는 기존 공용 훅(`@/hooks/*`) 그대로 사용 — 이 슬라이스가 옮긴 것은 **KPI 데이터 소스(목록·쓰기)만**.

## 컨트롤러 응답 타입 갱신 시
백엔드 컨트롤러에 `@ApiTags` + `@ApiOkEnvelope(Dto)` 를 달고
`pnpm -C apps/api run openapi && pnpm -C packages/contracts run generate` 재생성(이 슬라이스에서는 직접 regen 금지).
