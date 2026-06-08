# QA 리포트 — 평가 규칙(RuleSet) 3종 갭 통합 정합성

기준 계약: `_workspace/02_contract/contract-ruleset-gaps.md`
대상: 백엔드(`apps/api`) ↔ 프론트(`apps/web`) 경계면 교차검증
판정: **조건부 통과 (CONDITIONAL) — blocker 1건으로 갭#2 end-to-end 미완성**

---

## 게이트 판정 요약

| 갭 | 백엔드 | 프론트(설정/작성) | end-to-end 산정 | 판정 |
|----|--------|------------------|----------------|------|
| #1 groupTierThresholds | 완전 구현 | 완전 구현 | **반영됨** | PASS |
| #2 revenueGradeScale + useAbsoluteAmount | 완전 구현 | KPI 작성 진입점만 구현 | **미반영(항상 D)** | **FAIL (blocker)** |
| #3 kpiGroupWeights·플래그 | 완전 구현 | 완전 구현 | (검증 게이트) | PASS |

---

## 통과 항목 (PASS)

### weightPolicy 5필드 필드명·중첩·기본값 정합 (경계면 A·B)
- 프론트 `lib/types.ts:199` `RuleSetWeightPolicy` 5필드 camelCase ↔ 백엔드 `rule-set.types.ts:45` `WeightPolicy` 1:1 일치.
- 프론트 `admin/rules/page.tsx:125-134` `toPatchBody` 가 5필드 전부 `weightPolicy` 안으로 직렬화(계약 §공통원칙) ↔ 백엔드 `validateRuleSet`(scoring.service.ts:399-471) 가 동일 필드명·중첩 위치로 검증.
- 기본값 일치: seed `seed.ts:214` `{excellent:100,standard:90}` / revenueGradeScale `[S 1e9/A 8e8/B 6e8/C 4e8/D 0]` / `{performance_core:80,collaboration_growth:20}` / 두 플래그 false. 함수 폴백 상수(scoring.service.ts:15-24)와 동일.
- `toDraft`(rules/page.tsx:54-115) 역매핑 시 신규 필드 누락분 기본값 폴백 + revenueGradeScale S~D 5행 보장 → 기존 RuleSet(필드 없는 행) 로드 시 NaN·undefined 없음.
- PATCH `/rule-sets/:id`(controller.ts:37) → service.update → `validateRuleSet` 호출(service.ts:60) → weightPolicy JSON passthrough 저장. 라우팅·검증 경로 정상.

### 갭#1 — groupTierThresholds 반영 경로 (경계면 #2)
- 편집값 → `group-performance.service.ts:53-57` `loadRuleSetForCycle` → `rules.weightPolicy.groupTierThresholds ?? null` → `achievementRateToTier(rate, thresholds)`(scoring.service.ts:283-291) 실제 사용 확인.
- 폴백: thresholds null 시 `DEFAULT_GROUP_TIER_THRESHOLDS {100,90}` 적용. 기존 RuleSet 동작 불변.
- validateRuleSet: `excellent > standard` + 숫자 검증(scoring.service.ts:400-416).

### 갭#3 — 가중치 정책 노출
- 프론트 도넛 연동·토글 + `toPatchBody` 직렬화 ↔ 백엔드 validateRuleSet `performance_core+collaboration_growth===100` + boolean 검증(scoring.service.ts:448-471). 일치.

### 회귀 (경계면 #4)
- 마이그레이션 `20260608043945_ruleset_gaps/migration.sql` 은 additive ALTER(`kpi_scores.actual_amount` nullable, `kpis.use_absolute_amount` default false) — 기존 데이터 안전.
- `measureToGrade` opts 미전달 시 기존 달성률표 경로(scoring.service.ts:144-148) — 기존 amount KPI(useAbsoluteAmount=false) 동작 불변.
- 기존 RuleSet 폴백 정상(404·NaN 없음).

---

## 발견 결함 (심각도순)

### [BLOCKER] 갭#2 end-to-end 단절 — 절대금액 입력 경로 부재로 항상 D 폴백

**원인:** KPI 작성 화면은 `useAbsoluteAmount=true` KPI 생성을 지원하나(진입점 OK), **평가 제출 화면(self/dept-head)에 실제 금액(actualAmount) 입력·전송 경로가 전혀 없다.** 그 결과 절대금액 모드 KPI는 백엔드 `revenueGrade(actualAmount=null)` → **항상 Grade.D** 로 산정된다. "RuleSet을 편집해도 산정에 미반영"되는 사용자 관점 결함.

근거(생산자·소비자 동시 읽기):
- 백엔드(소비자 측 완비): `evaluations.service.ts:305-316` 가 `kpi.useAbsoluteAmount`·`ks.actualAmount`·`revenueGradeScale` 를 `measureToGrade` 에 전달하고 `KpiScore.actualAmount`(line 323) 저장. **백엔드는 완전히 준비됨.**
- DTO 수신부 완비: `evaluation.dto.ts:48-51` `KpiScoreInput.actualAmount?: number` 존재.
- **프론트 송신부 부재(결함 지점):**
  - `apps/web/lib/types.ts:530` `KpiScoreInput` 인터페이스에 `actualAmount` 필드 없음 → 타입상 전송 불가.
  - `apps/web/lib/types.ts:291` `KpiScore`(읽기) 인터페이스에 `actualAmount` 없음 → 복원·표시 불가.
  - `apps/web/app/(main)/eval/self/page.tsx:183-185` — amount KPI는 `else` 분기로 빠져 입력값을 **`achievementRate`** 로만 전송. `actualAmount` 미전송. (measureType별 분기에 amount-absolute 케이스 없음.)
  - `apps/web/app/(main)/eval/dept-head/page.tsx:181-182` — self의 `achievementRate` 만 그대로 전달, `actualAmount` 미전달.
  - `eval/` 디렉터리 전체에서 `actualAmount`·`useAbsoluteAmount` 문자열 0건(grep 확인).

**영향:** revenue 정량 + 절대금액 토글 ON KPI를 만든 사용자가 본인평가/부서장평가를 제출하면, 금액을 아무리 입력해도(실제론 `achievementRate` 칸에 들어가 무시됨) 등급이 D로 고정. revenueGradeScale 편집도 무의미.

**수정방법:**
1. `apps/web/lib/types.ts` — `KpiScoreInput` 에 `actualAmount?: number`, `KpiScore` 에 `actualAmount: number | null` 추가.
2. `apps/web/app/(main)/eval/self/page.tsx`
   - `AchInput` 에 `actualAmount?: number` 추가, 복원 로직(line 126-140)에 `kpi.measureType==='amount' && kpi.useAbsoluteAmount` 분기 추가(`s.actualAmount` 복원).
   - 입력 UI: 해당 KPI는 "실적값(달성률)" 대신 "실제 매출 금액(원/억)" 입력으로 분기(line 502-525 영역).
   - `save()`(line 168-187): 절대금액 KPI는 `{ kpiId, actualAmount: inp.actualAmount, weight }` 전송(achievementRate 대신).
   - 등급기준 표시: `KpiGradingDisplay`(line 526) 대신 revenueGradeScale 기반 표시(아래 MAJOR 참조).
3. `apps/web/app/(main)/eval/dept-head/page.tsx:181-182` — 절대금액 KPI는 `actualAmount: selfScore?.actualAmount` 전달, 연동 실적 표시(line 668-677)도 금액으로.

통지 대상: frontend-engineer(주 수정), backend-engineer(수신부는 완비 — 무변경 확인만).

---

### [MAJOR] 절대금액 KPI 등급기준 표시 불일치 (산정과 다른 기준 노출)

**원인:** 위 BLOCKER가 수정되어 금액을 입력하더라도, self-eval은 절대금액 KPI(`measureType='amount'`)에 대해 `KpiGradingDisplay`로 **달성률표(gradingScales.amount, %)** 를 보여준다(self/page.tsx:526-530). 실제 백엔드 산정은 **revenueGradeScale(절대금액 원)** 기준이므로, 화면에 표시되는 "등급 기준"이 실제 계산 기준과 다르다. 사용자가 잘못된 컷오프를 보고 입력하게 됨.

**수정방법:** self/page.tsx에서 `kpi.useAbsoluteAmount` 인 amount KPI는 `ruleSet.weightPolicy.revenueGradeScale` 기반 기준표(예: "10억 이상 S")를 표시하도록 분기. dept-head 연동 실적 표시도 동일.

통지 대상: frontend-engineer. (BLOCKER와 묶어 처리 권장.)

---

### [MINOR] revenueGrade 폴백 시 actualAmount=null → D 무경고

**원인:** `measureToGrade` 가 amount+absolute인데 actualAmount가 null이면 조용히 D 반환(scoring.service.ts:103, 141-143). 정상 폴백이나, BLOCKER 미수정 상태에선 "왜 전부 D인지" 디버깅을 어렵게 함. 기능 결함은 아님.

**수정방법(선택):** BLOCKER 수정으로 자연 해소. 별도 조치 불요.

---

## 미검증 (NOT TESTED)
- 런타임 실제 PATCH·제출 호출(빌드만 통과 보고 받음, 정적 교차검증 수행). 절대금액 KPI 생성→제출→등급=revenueGradeScale 매칭 시나리오는 BLOCKER 수정 후 통합 스모크 필요.
- `monthly-performance.service`·`dashboard.service` 부서 집계 경로는 단일 KPI useAbsoluteAmount 개념 없음 → 백엔드 노트대로 의도적 비대상(검증 제외 타당).

---

# 재검증 (RE-TEST) — 2026-06-08, 갭#2 BLOCKER 수정 후

frontend-engineer 수정 보고("types.ts·self·dept-head·KpiGradingDisplay·ui.ts")를 **신뢰하지 않고 양쪽 코드 직접 대조**. 갭#2 절대금액 경로를 self/dept-head 입력 → DTO → service KpiScore 생성 → 응답 복원까지 end-to-end 재추적.

## 재검증 판정 요약

| 이전 결함 | 심각도 | 상태 | 근거 |
|----------|--------|------|------|
| 갭#2 end-to-end 단절 (항상 D) | BLOCKER | **해소(RESOLVED)** | self·dept-head 절대금액 분기 송신 + 타입 2필드 + 응답 복원 + 백엔드 도달 전 구간 정합 |
| 절대금액 KPI 등급기준 표시 불일치 | MAJOR | **해소(RESOLVED)** | `RevenueGradeDisplay`(revenueGradeScale, "X 이상")로 분기 표시. 달성률표(`KpiGradingDisplay`) 미사용 |
| revenueGrade null→D 무경고 | MINOR | **자연 해소** | 입력 경로 복구로 정상 폴백만 남음 |

## 갭#2 end-to-end 재추적 (핵심) — [PASS]

생산자·소비자 양쪽 동시 읽기로 전 구간 확인. 끊김 없음.

1. **타입 (lib/types.ts)** — `KpiScoreInput.actualAmount?: number | null`(:551), `KpiScore.actualAmount: number | null`(:300), `Kpi.useAbsoluteAmount: boolean`(:257)/`CreateKpiRequest.useAbsoluteAmount?`(:534), `weightPolicy.revenueGradeScale?`(:207). 송신·복원 모두 타입상 가능.
2. **self 송신 (eval/self/page.tsx)** — `isAbsoluteAmount(k)=measureType==='amount'&&useAbsoluteAmount===true`(:52). `save()`(:218-222) 절대금액 KPI는 `{ kpiId, actualAmount: inp.actualAmount, weight }` 전송(**achievementRate 미전송**). 입력 UI(:546-580) 억→원 변환(`eokToWon`) 후 원 단위 저장. 복원(:168-170) `s.actualAmount` 사용.
3. **dept-head 송신 (eval/dept-head/page.tsx)** — `handleSubmit`(:194-197) 절대금액 KPI는 `{ kpiId, actualAmount: selfScore?.actualAmount, weight }` 전달(self의 금액 그대로, **achievementRate 미전달**). `canSubmit`이 `selfSubmitted` 게이트(:178) → self 미제출 시 undefined 전송 불가.
4. **DTO 수신 (evaluation.dto.ts:48-51)** — `@IsOptional() @IsNumber() actualAmount?` — optional 수용.
5. **service 처리 (evaluations.service.ts:340-365)** — `measureToGrade`에 `useAbsoluteAmount: kpi.useAbsoluteAmount`·`actualAmount: ks.actualAmount`·`revenueGradeScale: rules.weightPolicy.revenueGradeScale` 전달(:348-350). KpiScore 저장 시 `actualAmount: ks.actualAmount ?? null`(:359) 영속화.
6. **등급 산출 (scoring.service.ts:141-143, 99-109)** — amount+useAbsoluteAmount면 `revenueGrade(actualAmount, revenueGradeScale)` 경로. 내림차순 정렬 후 `actualAmount >= minAmount` 첫 등급 — **프론트 `matchRevenueGrade`(KpiGradingDisplay.tsx:17-26)와 동일 알고리즘**.
7. **응답 복원 (evaluations.service.ts:168 toDto)** — `kpiScores: ev.kpiScores` 원본 Prisma 행 passthrough(camelCase, `actualAmount` 컬럼 포함, 필드 화이트리스트 누락 없음) → self 복원(:170)·dept-head 연동 표시(:691 `매출 ${fmtAmount(selfScore.actualAmount)}`) 정상.

→ **입력→전송→수신→산정→저장→복원 전 구간 정합. "항상 D" 결함 종결.**

## MAJOR(등급기준 표시) 재검증 — [PASS]
- self(:581-586)·dept-head(:707-714) 절대금액 KPI는 `RevenueGradeDisplay scale={revenueGradeScale}` 사용 → "(금액)억 이상" 절대금액 컷오프 표시(KpiGradingDisplay.tsx:240). 달성률표(`gradingScales.amount`, %)는 비절대 amount/rate 경로(self:618)에서만 사용 → **표시 기준 = 산정 기준 일치.**
- self는 저장 전에도 `matchRevenueGrade`로 입력 금액 등급 즉시 미리보기(:460-465), 저장 후 `score.actualAmount` 강조(:584).

## 회귀 (REGRESSION) — [PASS]
- **비절대 amount KPI**: `isAbsoluteAmount` false → self(:223-225)·dept-head(:198) 모두 기존대로 `achievementRate` 전송. 백엔드 `measureToGrade` 절대 분기 미진입(scoring.service.ts:141 조건 `opts?.useAbsoluteAmount`) → 달성률표 경로 유지. **불변 확인.**
- **rate/count/qualitative**: 송신 분기·복원 분기 무변경(self:160-173 count/qualitative, dept-head:190-191 qualitative directGrade). **불변.**
- **타입 변경**: 추가 2필드 모두 optional(`actualAmount?`)/응답 nullable — 기존 제출 페이로드(actualAmount 없음) 깨지지 않음. DTO `@IsOptional`. 응답 passthrough라 구 데이터(actualAmount null)도 안전.
- **억↔원 헬퍼 (lib/ui.ts:147-155)**: `EOK=1e8`, `eokToWon`/`wonToEok` 라운드트립 정합. fmtAmount(:135-144) 억/만 표기 정상.

## 빌드 산출
- 프론트 보고(tsc 0·next build 32/32) 신뢰. 위 경계면은 정적 교차검증으로 직접 확인(빌드 통과≠정합이므로 타입 우회 여부까지 확인 — `as`/`any` 우회 없음).

## 잔존/신규 결함
- **없음.** BLOCKER·MAJOR 해소, 신규 회귀 미발견.
- (참고, 비차단) self 미제출 상태에서 dept-head가 절대금액 KPI를 전송하면 `actualAmount=undefined`→백엔드 D 폴백 가능하나, `canSubmit`의 `selfSubmitted` 게이트로 제출 차단됨 → 실사용 경로에서 발생 불가. 조치 불요.

## 미검증(잔존)
- 런타임 통합 스모크(절대금액 KPI 생성→self 금액 입력 제출→dept-head 연동→등급=revenueGradeScale 매칭) — 정적 검증 완료, release-engineer 배포 후 스모크 1회 권장(차단 아님).

## 릴리스 게이트 최종 판정: **통과 (PASS)**
이전 조건부 통과의 유일 차단 사유(갭#2 BLOCKER)가 end-to-end로 닫혔고 MAJOR 동시 해소·회귀 없음. 3종 갭(#1 PASS / #2 RESOLVED / #3 PASS) 모두 정합. 릴리스 진행 가능(런타임 스모크는 권장 사항).
