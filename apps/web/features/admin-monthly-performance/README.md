# admin-monthly-performance

월별 실적 입력 화면 슬라이스. 그룹·본부별 1~12월 목표/실적을 입력하면
누적 달성률과 측정방식별 등급이 자동 계산된다.

## 구조
- `api.ts` — `@growthx/contracts` 생성 클라이언트(`monthlyPerformanceController*`) 호출 +
  봉투 unwrap(`res.data.data`). 컴포넌트엔 도메인 값(배열/객체)만 반환.
- `hooks.ts` — `useAsync` 기반 데이터 훅(`useMonthlyPerformance`,
  `useMonthlyPerformanceSummary`) + 명령(`monthlyPerformanceCommands.create/update`).
- `ui/MonthlyPerformanceView.tsx` — 화면 본체(부서 선택·요약 스탯·카테고리 현황·
  추이 차트·12개월 입력 표). 등급 배지는 공유 `@/lib/grade`(dark-on-light) 사용.

## 라우트
`app/(main)/admin/monthly-performance/page.tsx` 는 `<MonthlyPerformanceView/>` 만 렌더.

## RBAC
hr_admin·division_head 입력, team_lead 조회 전용(행 수준 강제는 백엔드).
