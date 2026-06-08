# RuleSet 3종 갭 — 백엔드 구현 노트

기준 계약: `_workspace/02_contract/contract-ruleset-gaps.md`. 모든 신규 RuleSet 필드는 optional·폴백(기존 데이터 호환, 404·NaN 금지).

## 갭 #1 — 그룹실적 tier 경계 (하드코딩 → RuleSet)
- `WeightPolicy.groupTierThresholds?: { excellent: number; standard: number }` 추가(rule-set.types.ts).
- `ScoringService.achievementRateToTier(rate, thresholds?)` — thresholds 미전달/null 시 `{ excellent:100, standard:90 }`(모듈 상수 `DEFAULT_GROUP_TIER_THRESHOLDS`) 폴백. `rate>=excellent→excellent, >=standard→standard, else poor`.
- `group-performance.service.upsert`가 `loadRuleSetForCycle(dto.cycleId)`로 ruleSet 로드 → `rules.weightPolicy.groupTierThresholds ?? null` 전달.
- validateRuleSet: groupTierThresholds 제공 시 excellent·standard 숫자 + excellent > standard 검증.
- seed: 2026/2025 RuleSet에 `{excellent:100,standard:90}`(2025는 spread 상속).

## 갭 #2 — 매출 절대금액 등급 (dead code → 실제 연결, 살려서 연결)
- `WeightPolicy.revenueGradeScale?: { grade: Grade; minAmount: number }[]` 정식 추가.
- Prisma: `Kpi.useAbsoluteAmount Boolean @default(false) @map("use_absolute_amount")`, `KpiScore.actualAmount Float? @map("actual_amount")`.
  - 마이그레이션: `prisma/migrations/20260608043945_ruleset_gaps/migration.sql` (additive ALTER TABLE 2건, 기존 데이터 안전).
- `ScoringService.revenueGrade(actualAmount, scale?)` 시그니처 정리 — `string`→`Grade` 반환, null·빈 scale 시 `DEFAULT_REVENUE_GRADE_SCALE`(S 1e9 / A 8e8 / B 6e8 / C 4e8 / D 0) 폴백, actualAmount null → D.
- `measureToGrade(...)`에 6번째 선택 인자 `opts?: { useAbsoluteAmount?; actualAmount?; revenueGradeScale? }` 추가. `measureType=amount && opts.useAbsoluteAmount` 면 `revenueGrade(actualAmount, revenueGradeScale)` 경로. opts 미전달이면 기존 달성률표 경로(폴백) — 기존 호출부 무변경 동작 보장.
- 호출부:
  - `evaluations.service.patch`(KpiScore 생성, ~304): kpi.useAbsoluteAmount · ks.actualAmount · rules.weightPolicy.revenueGradeScale 전달, KpiScore에 actualAmount 저장.
  - `monthly-performance.service`(요약 누적 달성률) · `dashboard.service`: 부서 집계 달성률 경로 — 단일 KPI의 useAbsoluteAmount 개념 없음 → opts 미전달로 기존 동작 유지(의도된 비대상).
  - `excel.service`: per-KPI amount measureToGrade 산정 경로 없음(결과 임포트는 scoreToGrade 사용) → 변경 불필요.
- DTO: `KpiScoreInput.actualAmount?: number`(evaluation.dto), `CreateKpiDto/UpdateKpiDto.useAbsoluteAmount?: boolean`(kpi.dto). kpis.service create/update에 반영. 응답은 Prisma 객체 직렬화로 useAbsoluteAmount 자동 노출.
- validateRuleSet: revenueGradeScale 제공 시 5등급(S~D) 존재 + minAmount 숫자 + S>A>B>C>D minAmount 내림차순 검증.
- seed: 기본 revenueGradeScale(함수 폴백과 동일값) 추가.

## 갭 #3 — 가중치 정책 노출 (검증만 보강)
- validateRuleSet: kpiGroupWeights 제공 시 `performance_core + collaboration_growth === 100` 검증, performance_core·collaboration_growth 숫자 검증.
- enforceQualitativeCap·enforceGroupRatio 제공 시 boolean 검증.
- seed: kpiGroupWeights {80,20}, enforceQualitativeCap:false, enforceGroupRatio:false 명시(2026-06-08 전부 서술형 전환 유지).
- validateWeights 동작은 기존 그대로(이미 두 플래그·kpiGroupWeights 사용 중).

## 결정 노트
- measureToGrade 시그니처: 기존 5개 위치인자를 보존하고 신규는 단일 opts 객체로 추가 → 호출부 영향 최소·계약 "동작 보장" 충족. 계약 §갭2가 "시그니처는 backend 재량"으로 허용.
- revenueGrade 반환형을 `string`→`Grade`로 좁힘(타입 안전). measureToGrade가 Grade 반환이므로 일관.
- 부서 집계 달성률 경로(monthly/dashboard)는 절대금액 모드 대상 아님 — 단일 KPI 속성이 없는 합산 통계라 의도적으로 기존 rate 경로 유지.

## 검증 결과
- `npx prisma generate`: OK (client v5.22.0 재생성, 신규 필드 타입 반영).
- `npm run build`(nest build): 에러 0.
- `npx tsc --noEmit`: 에러 0(seed 포함).
- 마이그레이션 SQL 생성: `prisma/migrations/20260608043945_ruleset_gaps/migration.sql` (DB 미적용 — `--create-only`).
