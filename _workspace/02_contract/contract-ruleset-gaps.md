# 계약: 평가 규칙(RuleSet) 3종 갭 편집화

목적: `/admin/rules`에서 편집한 규칙이 **실제 산정에 반영**되도록, 하드코딩·dead code·미노출 3종을 RuleSet으로 편입하고 편집 UI에 노출한다. 단일 기준 — 백엔드/프론트는 아래 필드명·동작을 정확히 따른다.

## 공통 원칙
- 모든 신규 규칙은 `RuleSet.weightPolicy`(JSON) 안에 둔다(기존 패턴 유지, 마이그레이션 불필요한 JSON 확장).
- 모든 신규 필드는 **선택적(optional)** — 미설정 시 백엔드가 2026 기본값으로 폴백(기존 데이터 호환).
- 응답 봉투·camelCase 규약 유지. 편집은 PATCH `/rule-sets/:id`.

---

## 갭 #1 — 그룹실적 tier 경계 (하드코딩 → RuleSet)

현재 `ScoringService.achievementRateToTier(rate)`가 `≥100→excellent / ≥90→standard / 그외 poor`를 코드에 박음.

**신규 필드** `weightPolicy.groupTierThresholds`:
```ts
groupTierThresholds?: { excellent: number; standard: number }
// 의미: 그룹 실적 달성률(%)이 excellent 이상→우수, standard 이상→보통, 그 미만→미흡
// 기본: { excellent: 100, standard: 90 }
```

**백엔드 변경**
- `achievementRateToTier(rate, thresholds?)` 시그니처로 변경 — thresholds 미전달 시 {100,90} 폴백.
- `group-performance.service.ts`가 `loadRuleSetForCycle(cycleId)`로 ruleSet을 읽어 `rules.weightPolicy.groupTierThresholds`를 전달.
- `validateRuleSet`: 제공 시 `excellent > standard`, 둘 다 숫자(0~수백) 검증.
- `seed.ts`: 2026 RuleSet에 `groupTierThresholds: { excellent: 100, standard: 90 }` 추가.

---

## 갭 #2 — 매출 절대금액 등급 (dead code → 실제 연결)  ★사용자 선택: 살려서 연결

현재 `revenueGrade(actualAmount, ruleSet)`가 `weightPolicy.revenueGradeScale`을 읽지만 호출처 없음.

**신규/정식화 필드** `weightPolicy.revenueGradeScale`:
```ts
revenueGradeScale?: { grade: Grade; minAmount: number }[]
// 의미: 실제 매출 절대금액(원)이 minAmount 이상이면 해당 등급(내림차순 매칭)
// 기본: [ {S,1_000_000_000}, {A,800_000_000}, {B,600_000_000}, {C,400_000_000}, {D,0} ]
```

**KPI 스키마 변경** (Prisma `model Kpi`, 마이그레이션 필요):
```prisma
useAbsoluteAmount Boolean @default(false) @map("use_absolute_amount")
// measureType=amount 일 때만 의미.
//  - false(기본): 기존 동작 — 목표 대비 달성률(achievementRate) → gradingScales.amount
//  - true: 실제 매출 절대금액 → revenueGradeScale (목표 없이 절대금액으로 등급)
```

**점수 입력 경로** (KpiScore):
- 절대금액 모드 KPI는 달성률 대신 실제 금액을 받아야 한다. `KpiScore` 입력 DTO에 `actualAmount?: number` 추가(저장 컬럼도 nullable Float 추가, `actual_amount`).
- 평가 제출 시: `useAbsoluteAmount=true && measureType=amount` 면 `measureToGrade`가 revenueGrade 경로를 타고 `actualAmount`로 등급 산출. 그 외는 기존 그대로.

**백엔드 변경**
- `measureToGrade(...)`에 절대금액 분기 추가: 인자로 `useAbsoluteAmount`, `revenueGradeScale`, 절대금액 값을 받아 amount+absolute일 때 `revenueGrade` 사용. (시그니처는 backend 재량으로 정리하되 동작 보장.)
- 호출부(`evaluations.service`, `monthly-performance.service`, `excel.service` 중 amount 산정 경로): kpi.useAbsoluteAmount·rules.weightPolicy.revenueGradeScale·actualAmount 전달.
- `validateRuleSet`: 제공 시 5개 등급(S~D) 존재, minAmount 숫자·내림차순 정합 검증.
- `seed.ts`: revenueGradeScale 기본값 추가. (이미 함수 폴백과 동일 값)
- Kpi 생성/수정 DTO·응답에 `useAbsoluteAmount` 포함.

---

## 갭 #3 — 가중치 정책 노출 (백엔드 로직 존재 → 편집 UI 노출)

이미 `validateWeights`가 읽는 3개 필드를 편집 UI에 노출하고 PATCH로 저장만 하면 됨(백엔드 로직 변경 최소).

**노출 필드** (`weightPolicy` 내 기존 정의):
```ts
kpiGroupWeights?: { performance_core: number; collaboration_growth: number } // 기본 {80,20}
enforceQualitativeCap?: boolean   // 기본 false (정성 비중 ≤ 상한 강제)
enforceGroupRatio?: boolean       // 기본 false (성과중심/협업·성장 비율 강제)
```

**백엔드 변경**
- `validateRuleSet`: kpiGroupWeights 제공 시 `performance_core + collaboration_growth === 100` 검증, 두 플래그는 boolean 검증.
- `seed.ts`: 명시적 기본값 추가(kpiGroupWeights {80,20}, 두 플래그 false — 2026-06-08 전부 서술형 전환 결정 유지).

---

## 프론트엔드 (frontend 스킬 사용 — 사용자 친화적 UIUX)

`apps/web/lib/types.ts`의 `RuleSet['weightPolicy']` 타입에 위 5개 신규 필드 추가.

`apps/web/components/RuleSetEditor.tsx` — 기존 6섹션 시각화 톤(구간바·스택막대·도넛·stepper) 유지하며:
1. **그룹실적 tier 경계**: 기존 "그룹실적 보너스" 섹션에 통합하거나 인접 섹션. 달성률 축 위에 우수/보통/미흡 경계를 슬라이더/stepper로. "달성률 100%↑ 우수" 식 즉시 라벨.
2. **매출 절대금액 등급**: 신규 섹션(아이콘). 금액 단위(억/원) 친화 입력 + 등급별 내림차순 막대. "10억 이상 S" 식 미리보기.
3. **가중치 정책 섹션 확장**: 도넛을 kpiGroupWeights 실제값과 연동(편집 가능, 합100), enforceQualitativeCap·enforceGroupRatio를 토글 스위치 + "켜면 제출 시 강제" 설명.

`RuleSetEditor`의 `RuleSetDraft`/`validateRuleSet`/`toDraft`/`toPatchBody`(rules/page.tsx) 일관 갱신 — 신규 필드 직렬화·역매핑·프론트 즉시검증 추가.

KPI 작성 화면(`apps/web/app/(main)/kpi`): measureType=amount KPI에 "절대금액 기준 등급" 토글(useAbsoluteAmount) 노출 — #2의 사용자 진입점. amount가 아니면 숨김.

## QA 경계면 체크리스트
- weightPolicy 5개 신규 필드: 프론트 타입 ↔ 백엔드 validate/parse 일치.
- groupTierThresholds 편집값이 group-performance tier 산정에 반영.
- useAbsoluteAmount=true KPI 제출 시 revenueGradeScale로 등급 산출(달성률표 아님).
- 기존 RuleSet(신규 필드 없는 행) 폴백 정상(404·NaN 없음).
- PATCH 후 재산정 영향 안내·읽기전용 권한 유지.
