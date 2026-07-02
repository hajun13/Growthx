# reports feature

분포 모니터링(등급 분포) + 월별 실적 추이 화면의 수직 슬라이스 — notifications 표준 패턴 복제.

- **책임:** 전사/부서 등급 분포 모니터링, 월별 실적 누적 요약·추이·입력(hr_admin).
- **소비 API:** `@growthx/contracts` 생성 클라이언트 — 손으로 fetch/타입 안 씀.
  - `resultsControllerList`(등급 분포용 결과 목록)
  - `resultsControllerSummary`(그룹/본부/팀/직급 캐스케이드 필터용 — `SummaryRowDto`, P18에서 추가 소비)
  - `monthlyPerformanceControllerSummary`(부서 월별 누적 요약)
  - `monthlyPerformanceControllerCreate`(월별 실적 upsert, hr_admin)
- **구조 (분포 모니터링 탭 = image 14 재현, 2026-07-02 Part/ 수정요청 P18):**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`).
  - `hooks.ts` — `useResultsData`(분포), `useResultsSummaryData`(캐스케이드 필터용), `useMonthlyPerformanceData`(월별).
  - `ui/ReportsView.tsx` — 탭 전환 오케스트레이션만(분포/월별실적).
  - `ui/DistMonitorTab.tsx` — 분포 탭 본체(필터·전사분포·부서분포·결과리스트 조립).
  - `ui/DistGradeCards.tsx` — 상단 S~D 등급 카드(인원+비율 강조).
  - `ui/DistCompanyBar.tsx` — 전사 등급 분포 컬러 막대.
  - `ui/DistDeptBars.tsx` — 부서별 등급 분포 컬러 누적바 + 팀 인원수(더보기).
  - `ui/DistResultList.tsx` — 결과 리스트(Avatar·순위·최종점수·등급배지·상세보기).
  - `ui/DistFilters.tsx` — 그룹/본부/팀/직급/등급 캐스케이드 + 정렬 + 필터 초기화.
  - `ui/DistFootnote.tsx` — 하단 안내문(점수산정·등급기준·반영방식).
  - `ui/MonthlyPerfTab.tsx` — "월별 실적" 탭(P18 범위 밖, 기존 구조 그대로 이관).
  - 라우트 `app/(main)/reports/page.tsx` 는 `<ReportsView/>` 만 렌더(얇게).
- **API 갭 (P18):** `EvaluationResultDto`(분포 목록)는 `departmentName` 단일 문자열만 가져 그룹/본부/팀/직급 개별 필터가 불가 → `resultsControllerSummary`(`SummaryRowDto` — group/division/team/position 분리 필드)를 별도로 소비해 필터링용 userId 집합만 얻고, 표시는 여전히 `EvaluationResultDto` 기준.
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 마운트.
- **불변식:** 인증·baseUrl 은 contracts runtime 주입. 봉투 unwrap 은 api.ts 한 곳.
  부서 목록은 공유 `useDepartments` 훅(교차 사용 인프라)을 그대로 소비.
