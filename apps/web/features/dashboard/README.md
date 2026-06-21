# dashboard feature

대시보드 화면의 수직 슬라이스 — architecture.md §5 표준 패턴(notifications 레퍼런스와 동일 구조).

- **책임:** HR 대시보드(나의 평가 5단계 진행·KPI 달성률 게이지·목표보드/그룹별 진행·평가 일정·바로가기).
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`dashboardControllerSummary`·`dashboardControllerCompanyAchievement`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 컴포넌트엔 도메인 값만. cycleId 빈 값은 쿼리에서 제외(백엔드가 최신 active 주기 사용).
  - `hooks.ts` — `useDashboardSummary`·`useCompanyAchievement`(공용 `useAsync` 위에 구성, `{ data, loading, error, reload }`).
  - `ui/DashboardView.tsx` — 화면(공용 프리미티브 `@/components/*` + Notion Low Color 토큰). 5단계 진행·게이지·일정 보조 데이터는 기존 도메인 훅(`useEvaluations`·`useKpis`·`useCurrentPhase`·`useMonthlyPerformanceSummary`) 그대로 사용.
  - 라우트 `app/(main)/dashboard/page.tsx` 는 `<DashboardView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 에 마운트됨(건드리지 않음).
- **불변식:** 인증·baseUrl 은 contracts runtime 에 주입. 봉투 unwrap 은 api.ts 한 곳. 등급 배지 색은 `@/lib/grade`(dark-on-light) 단일 출처 사용.

## 마이그레이션 메모
기존 `hooks/useDashboard.ts`(손 fetch `apiGet`)에서 생성 클라이언트로 데이터 소스만 이관. 시각/동작·RBAC·라우트 불변. 등급 배지는 로컬 `gradeChipColor`(흰 텍스트) → `lib/grade.gradeColor()`(연 배경+어두운 텍스트)로 교체.
