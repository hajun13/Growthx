# reports-yoy feature

연도 누적(YoY) 비교 화면 (`/reports/yoy`) — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 개인 연도별 등급·점수 타임라인 비교(person 탭) + 조직 등급분포 YoY 비교(org 탭). 법인 필터·퇴사자 토글·비교 사이클 멀티셀렉트·쿼리스트링 동기화.
- **소비 API:** `@growthx/contracts`
  - `resultsControllerCompare` (`GET /results/compare`, DTO: `CompareResultDto`)
  - `resultsControllerDistribution` (`GET /results/distribution`, DTO: `DistributionResultDto`)
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`) + 생성 DTO(nullable) → 도메인 타입(`@/lib/types` `CompareResult`·`DistributionResult`) 매핑.
  - `hooks.ts` — `useYoyCompare`·`useYoyDistribution`(`useAsync` 래핑, 반환 계약 기존과 동일: `{ data, loading, error, reload }`).
  - `ui/YoyCompareView.tsx` — 페이지 셸·탭·필터(기존 `YoyComparePage` 로직 이동).
  - `ui/PersonTimelinePanel.tsx`·`ui/OrgDistributionPanel.tsx` — 탭별 패널(데이터 소스만 feature 훅으로 교체, 시각/동작 보존).
- **라우트:** `app/(main)/reports/yoy/page.tsx`(Suspense) → `YoyComparePage.tsx`(`YoyCompareView` 재내보내기 스텁) → `<YoyCompareView/>`.
- **비고:**
  - 봉투 이중 래핑 주의: orval `customFetch` → `{ data, status }`, 그 `data` 가 다시 HTTP 본문 봉투 `{ data: DTO }` → 실제 DTO 는 `res.data.data`.
  - 등급 배지·강조색은 공유 모듈 `@/lib/grade`(`gradeColor().fg`, dark-on-light)로 통일(로컬 `GRADE_BADGE` 상수 제거).
  - 보조 데이터(`useUsers`·`useDepartments`)는 기존 훅 유지(주 데이터만 생성 클라이언트로 이관). YoY 전용 시각 컴포넌트는 `@/components/yoy/*` 그대로 사용.
