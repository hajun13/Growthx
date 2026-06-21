# reports feature

분포 모니터링(등급 분포) + 월별 실적 추이 화면의 수직 슬라이스 — notifications 표준 패턴 복제.

- **책임:** 전사/부서 등급 분포 모니터링, 월별 실적 누적 요약·추이·입력(hr_admin).
- **소비 API:** `@growthx/contracts` 생성 클라이언트 — 손으로 fetch/타입 안 씀.
  - `resultsControllerList`(등급 분포용 결과 목록)
  - `monthlyPerformanceControllerSummary`(부서 월별 누적 요약)
  - `monthlyPerformanceControllerCreate`(월별 실적 upsert, hr_admin)
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 생성 DTO(string 등급/카테고리)를
    도메인 타입(`@/lib/types`)으로 좁혀 컴포넌트엔 기존과 동일한 타입을 넘긴다.
  - `hooks.ts` — `useResultsData`(분포), `useMonthlyPerformanceData`(월별). 로드·reload.
  - `ui/ReportsView.tsx` — 화면(공용 프리미티브 `@/components/*` + Notion Low Color 토큰).
    등급 배지·막대 색은 공유 `@/lib/grade`(`gradeColor`) — dark-on-light(배경 bg, 텍스트 fg).
  - 라우트 `app/(main)/reports/page.tsx` 는 `<ReportsView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 마운트.
- **불변식:** 인증·baseUrl 은 contracts runtime 주입. 봉투 unwrap 은 api.ts 한 곳.
  부서 목록은 공유 `useDepartments` 훅(교차 사용 인프라)을 그대로 소비.
