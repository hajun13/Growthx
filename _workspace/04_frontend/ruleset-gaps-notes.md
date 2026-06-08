# 프론트 구현 노트 — 평가 규칙 3종 갭(weightPolicy 신규 5필드)

기준 계약: `_workspace/02_contract/contract-ruleset-gaps.md`
디자인 SSOT: 루트 `DESIGN.md`(Toss: Primary #3182f6, Dark #191f28, border-radius 0, 컴팩트, Pretendard)

## 결정·구현 요약

신규 5필드는 모두 `weightPolicy`(JSON) 안에 직렬화(계약 §공통 원칙). 프론트 타입은 camelCase로 계약과 1:1. 모두 optional(미설정 시 기본값 폴백). 기존 RuleSetEditor의 시각화 톤(Stepper, HintBox, ContentHeader, GradeBadge, TierBadge, FieldError)을 그대로 재사용.

### 갭 #1 — groupTierThresholds: { excellent, standard }
- 위치: 기존 "그룹실적 보너스" 섹션을 **"그룹실적 경계·보너스"로 통합**(의미 짝 — tier 경계가 보너스 tier를 정의). 섹션 상단에 tier 경계 카드, 하단에 기존 보너스 3카드.
- UI: 달성률 축(0~axisMax, 최소 120%) 위에 우수/보통/미흡 구간을 색칠(미흡 #fef3c7 / 보통 grey200 / 우수 #e6f9f2)하고 두 경계 마커. 우수·보통 경계를 Stepper(step 5, suffix %)로 편집. "달성률 {excellent}%↑ 우수 · {standard}~{excellent-1}% 보통 · {standard}% 미만 미흡" 즉시 라벨.
- 검증: `excellent > standard`(같거나 작으면 빨강), 둘 다 숫자.

### 갭 #2 — revenueGradeScale: { grade, minAmount }[]
- 위치: **신규 좌측 메뉴 섹션** `revenueGradeScale`(아이콘 Banknote, bg #0E9F6E). 측정방식 달성률 섹션 바로 아래(②-b).
- UI: 억 단위 친화 입력(원 저장, `wonToEok`/`eokToWon`/`formatWonShort` 헬퍼) Stepper(step 0.5억) + 등급별 내림차순 비례 막대 + "10억 이상 → S" 미리보기 칩. S~D 5행 보장.
- 검증: S~D 5개 존재, minAmount 0 이상 숫자, **내림차순**(위 등급 > 아래 등급, 위반 시 행 빨강).

### 갭 #3 — kpiGroupWeights / enforceQualitativeCap / enforceGroupRatio
- 위치: 기존 WeightPolicySection 확장.
- 도넛: 표시용 고정(70/30) → **kpiGroupWeights 실제값 연동·편집 가능**. conic-gradient가 입력 비율 따라 즉시 변함. 성과중심/협업·성장 Stepper(합 100 검증, 중앙 합계 배지가 빨강/초록) + 100% 스택 막대.
- 토글: enforceQualitativeCap·enforceGroupRatio를 **ToggleSwitch**(사각형 Toss 스타일) + "켜면 제출 시 강제(현재 전부 서술형 전환으로 기본 꺼짐)" 설명. `ToggleRow` 컴포넌트.
- 검증: kpiGroupWeights 합 100(±0.01).

## 동반 변경 파일
- `apps/web/lib/types.ts` — `RuleSetWeightPolicy` 인터페이스 신설(기존 2필드 + 신규 5필드 optional). `RuleSet.weightPolicy` 타입 교체. `Kpi.useAbsoluteAmount`(boolean), `CreateKpiRequest.useAbsoluteAmount?`(optional) 추가.
- `apps/web/components/RuleSetEditor.tsx` — RuleSetDraft 확장, validateRuleSet(3종 즉시검증) 확장, SectionKey/menuSummary/MENU 갱신, RevenueGradeScaleSection 신설, GroupTierBonusSection에 tier 경계 카드 통합, WeightPolicySection 전면 개편(연동 도넛+토글), Stepper/ToggleSwitch/ToggleRow/억 환산 헬퍼.
- `apps/web/app/(main)/admin/rules/page.tsx` — toDraft 역매핑(신규 5필드 + S~D 5행 보장 + 기본값 폴백), toPatchBody 직렬화(weightPolicy 안으로 5필드 전부). DEFAULT_* 상수 추가.
- `apps/web/app/(main)/kpi/page.tsx` — DraftKpi.useAbsoluteAmount, toDraft/emptyDraft/loadTemplate 갱신. `canUseAbsoluteAmount`(category==='revenue' && !isQualitative) 게이트. draftToPayload: 게이트 통과+토글 ON 시 measureType='amount' + useAbsoluteAmount=true 전송, 아니면 기존 'qualitative'. AbsoluteAmountToggle 컴포넌트(상세행 상단, 게이트 통과 시에만 노출).

## #2 진입점 설계 노트(중요)
KPI 작성 폼은 측정방식을 서술형으로 통일해 measureType을 'qualitative' 상수로 전송해 왔다(기존). 계약은 "measureType=amount KPI에 토글 노출, amount 아니면 숨김"을 요구. 매출(revenue) 카테고리 정량 KPI가 절대금액 측정의 도메인 진입점이므로, **revenue 카테고리 + 정량(non-qualitative) 행에서만 토글을 노출**하고, 켜면 그 행만 measureType='amount' + useAbsoluteAmount=true로 전송한다. 카테고리를 revenue 밖으로 바꾸거나 정성으로 토글하면 게이트가 닫혀(toggle 숨김 + payload에서 useAbs=false) 자동으로 기존 서술형 경로로 복귀한다. 계약 필드명은 변경하지 않음.

## 접근성·잠금
- ToggleSwitch/AbsoluteAmountToggle: role="switch" + aria-checked + aria-label, 키보드 클릭 가능. Stepper는 기존 aria-label 유지.
- 읽기전용(canEdit=false): rules/page.tsx의 기존 pointerEvents:none + opacity 잠금 그대로 신규 섹션에도 적용(에디터 전체 래퍼). 백엔드 403도 유지.

## 검증 결과
- `npx tsc --noEmit` (apps/web): 에러 0.
- `npx next build`: 성공, /admin/rules 16.2 kB · /kpi 11.6 kB 정상 컴파일.

## 백엔드 협업 메모(backend-engineer)
- 프론트는 신규 5필드를 weightPolicy 안에 camelCase로 PATCH 전송. 계약 §갭1~3의 validateRuleSet/seed/parse가 동일 필드명·동작이어야 정합.
- KPI 생성/수정 시 useAbsoluteAmount 전송(매출 정량+토글ON 행만 true, measureType='amount' 동반). 계약 §갭2 KpiScore.actualAmount 입력 경로·measureToGrade 절대금액 분기 필요.

---

# 추가 수정 — QA BLOCKER+MAJOR: 절대금액(actualAmount) 소비 경로 닫기 (2026-06-08)

기준 QA: `_workspace/05_qa/qa-report-ruleset-gaps.md` (갭#2 end-to-end 단절 — 평가 제출 화면에 actualAmount 입력·전송 경로 부재로 절대금액 KPI가 항상 Grade.D 폴백).
백엔드: 무변경(수신부 `evaluations.service.ts:305-323` + `evaluation.dto.ts` KpiScoreInput.actualAmount 완비). 계약 필드명 불변.

## [BLOCKER] 절대금액 입력·전송 경로 추가

### 타입 (apps/web/lib/types.ts)
- `KpiScoreInput` 에 `actualAmount?: number | null` 추가(송신부) — useAbsoluteAmount && measureType=amount KPI는 achievementRate 대신 이 값 전송.
- `KpiScore` 에 `actualAmount: number | null` 추가(서버 응답 복원·표시용).
- `Kpi.useAbsoluteAmount: boolean` 는 이미 존재(확인 완료, self/dept-head 모두 읽음).

### 공용 헬퍼 (apps/web/lib/ui.ts)
- 억↔원 환산 헬퍼 `EOK`/`wonToEok`/`eokToWon` 추가(RuleSetEditor 와 동일 톤, null-safe). /admin/rules·/kpi 입력 톤과 일관. 표시는 기존 `fmtAmount`(억/만 표기) 재사용.

### 공용 컴포넌트 (apps/web/components/KpiGradingDisplay.tsx)
- `matchRevenueGrade(amount, scale)` export — revenueGradeScale 내림차순 매칭(백엔드 revenueGrade 로직 동치). 입력 금액의 즉시 등급 미리보기에 사용.
- `RevenueGradeDisplay({ scale, inputAmount, bare })` export — 절대금액 모드 KPI의 등급기준을 **revenueGradeScale(금액 원)** 기준으로 표시("X억 이상"), inputAmount 가 드는 등급 강조. 기존 KpiGradingDisplay 의 GradeChip·하이라이트 패턴 재사용. (MAJOR 해소용.)

### 본인평가 (apps/web/app/(main)/eval/self/page.tsx)
- `isAbsoluteAmount(k)` 헬퍼(`measureType==='amount' && useAbsoluteAmount===true`).
- `AchInput.actualAmount?: number` 추가. 복원 로직에 절대금액 분기(`s.actualAmount` 복원). `isComplete`·진행률 판정에 actualAmount 반영.
- 입력 UI 분기: 절대금액 KPI는 달성률(%) 대신 **억 단위 매출 금액 입력**(원 저장, `wonToEok`/`eokToWon`), `= X억 (원)` 보조표기, aria-label 부여, readOnly 잠금 동일.
- `save()`: 절대금액 KPI는 `{ kpiId, actualAmount, weight }` 전송(achievementRate 미전송). 그 외 기존 경로 불변.
- 등급기준 표시: 절대금액 KPI는 `RevenueGradeDisplay`(score.actualAmount ?? 입력값 하이라이트). 카드 헤더 liveGrade 도 저장 전엔 `matchRevenueGrade` 로 즉시 미리보기.

### 부서장평가 (apps/web/app/(main)/eval/dept-head/page.tsx)
- `useRuleSet(current?.ruleSetId)` 추가로 revenueGradeScale 확보.
- `handleSubmit`: 절대금액 KPI는 self 의 `actualAmount` 를 그대로 전달(`{ kpiId, actualAmount: selfScore?.actualAmount, weight }`) — [[dept-head-links-self]] 원칙(부서장은 self 의 수치 실적값을 그대로 제출).
- 연동 실적 표시: 절대금액 KPI는 `매출 {fmtAmount(actualAmount)}` 로 표기(달성률 대신). `KpiEvalCard` 에 `RevenueGradeDisplay`(self.actualAmount 강조) 추가 — 산정과 동일 기준 노출(MAJOR 해소).

## [MAJOR] 절대금액 KPI 등급기준 표시 일치
- self·dept-head 모두 절대금액 KPI는 `KpiGradingDisplay`(달성률표) 대신 `RevenueGradeDisplay`(revenueGradeScale 금액기준)로 분기. 입력/연동 금액이 드는 등급 즉시 강조. → 화면 표시 기준 == 백엔드 산정 기준.

## 경로 요약 (입력→전송→산정)
1. 작성: /kpi 에서 매출 정량 KPI + "절대금액 기준 등급" 토글 ON → `useAbsoluteAmount=true, measureType='amount'`.
2. 본인평가: 억 단위 매출 금액 입력 → `eokToWon` → `KpiScoreInput.actualAmount`(원) 전송. RevenueGradeDisplay 로 미리보기.
3. 백엔드(무변경): `useAbsoluteAmount && measureType=amount` → `measureToGrade` 가 `revenueGradeScale` + `actualAmount` 로 등급 산출·`KpiScore.actualAmount` 저장.
4. 부서장평가: self.actualAmount 그대로 전달(실적 미변경) + 동일 기준 표시.
5. 복원: 서버 `KpiScore.actualAmount` → 화면 입력/표시값 복원.

## 검증 결과(추가 수정)
- `npx tsc --noEmit` (apps/web): 에러 0.
- `npx next build`: 성공(32/32). /eval/self 6.56 kB · /eval/dept-head 9.17 kB 정상 컴파일.
- 접근성: 신규 금액 입력에 aria-label, 읽기전용(submitted/finalized) 시 disabled 잠금. 기존 달성률/건수/정성 KPI 회귀 없음(분기 추가만, 기존 경로 불변).
