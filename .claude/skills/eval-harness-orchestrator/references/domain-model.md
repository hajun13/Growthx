# 인사평가 솔루션 — 도메인 모델 (단일 진실 공급원)

에너지엑스㈜ 2026 KPI 운영 고도화 계획을 시스템화한 인사평가 도메인의 표준 정의. 모든 에이전트(디자인·프론트·백엔드·QA·릴리스)가 공유한다. 엔티티명·상태값·권한·평가 유형·KPI 분류의 **이름은 이 문서를 따른다.** 수치 규칙은 [business-rules.md](business-rules.md), 화면은 [reference-ui-screens.md](reference-ui-screens.md) 참조.

> **권위 자료(따라야 할 기준):** `2026년도 임직원 KPI 및 평가 운영 계획_VER3 1.pptx`(운영계획 PPT, 11슬라이드) + `26년 KPI(양식)…xlsx`(KPI 양식)가 최우선이다. 요구사항 정의서·사용자 스토리는 보완.
> **⚠️ 권위 자료 확인 사실:** **연봉·최종등급 산정은 순수 KPI/성과 중심**이다(PPT·xlsx 기준). **다면평가(수평 peer·상향 upward)는 폐기**(레퍼런스에서 오인). 단, **역량평가는 폐기가 아니라 "참고용 백데이터"로 존재**한다 — 연 1회(12월)·10문항·S~D, `CompetencyQuestion`/`CompetencyResponse`로 구현, **연봉·최종등급에는 0% 반영**(기본 `perfCompWeights` perf 1·comp 0), 조회·연도비교 화면에만 표시. 즉 "S~D 라디오 역량을 점수에 합산"하는 구 `EvaluationItem` 구조는 폐기됐지만 별도 competency 모듈은 현존한다. (그룹/본부/팀 조직 계층은 유효 — §2 참조)
> **참고 자료(advisory):** 레퍼런스 솔루션 이미지는 화면 *레이아웃 아이디어*일 뿐이다. 평가 차원·유형·조직은 PPT/xlsx가 이긴다.

## 목차
1. 도입 배경 & 핵심 가치
2. 조직 계층 & 역할 (RBAC)
3. KPI 분류 & 평가 유형
4. 핵심 엔티티
5. 상태 머신
6. 명명 규약

---

## 1. 도입 배경 & 핵심 가치

2024~2025 운영의 4대 문제(성과-평가 불일치, 기준 불통일, 정성 KPI 과의존, 평가 책임 구조 약함)를 해결한다. 핵심 가치: **공정성 · 정량성 · 투명성**. 슬로건: "열심히 한 사람이 아니라 성과를 만든 사람이 평가받는 구조".

핵심 메커니즘 4가지(전부 시스템 강제, PPT 슬라이드 6~9):
- **KPI 연계(캐스케이드):** 그룹 → 본부 → 팀 → 개인
- **그룹 성과 기반 등급 풀(Pool):** 그룹 실적(매출·수주·이익률)이 구성원 S/A/B/C/D 분포 상한을 사전 결정
- **정량 중심 + 코멘트 의무화:** 모든 KPI 수치 목표값 필수(달성률·증감률·건수), 정성 KPI ≤30%, 평가자(본부장+팀장) 코멘트 분기별 필수
- **성과-보상 연동:** 확정 등급 → 연봉 인상률 자동 연동(전사 평균 ≈3%)

## 2. 조직 계층 & 역할 (RBAC)

### 조직 계층 (`Department.type`) — 4단계, 그룹이 최상위
```
group(그룹) → division(본부) → team(팀) → (개인 User)
```
> **그룹(group)이 최상위 조직 단위다.** 에너지엑스 실제 조직은 그룹 아래 본부, 본부 아래 팀, 팀 아래 팀원의 4단계다. KPI는 이 4단계로 연계(cascade)되며, 상위 KPI 달성이 하위 평가에 연동된다. **등급 풀의 "성과 단위"는 그룹**이다(PPT 슬라이드 8: 우수/보통/미흡 그룹). 매출액은 그룹 공동달성, 공정액·수주는 본부별 지표.

### 역할 (`User.role` enum) — 4종

| role | 한글 | 핵심 권한·책임 |
|------|------|---------------|
| `hr_admin` | HR 관리자 | 전사 KPI 양식·일정·규칙 설정, 팀 등급 풀 산정, 전사 등급 분포 모니터링, 이의제기 최종 결정, 보상(인상률) 연동 |
| `division_head` | 본부장 | 본부 KPI 목표 설정, **2차 평가자(round2)**·팀장 평가, 팀 성과 등급 산정, **코멘트 필수** (그룹 부서의 장이면 **최종 round3** 평가자) |
| `team_lead` | 팀장 | 팀원 KPI 검토·승인/반려, **1차 평가자(round1)**+**코멘트 필수**, 이의제기 1차 처리 |
| `employee` | 임직원(피평가자) | 개인 KPI 작성·제출, 실적 입력, 본인평가, 결과 조회, 이의제기 신청 |

> `role`은 **시스템 권한**(RBAC)이다. 조직 **직책**(`position`)과 구분한다.

### 직책 (`User.position`) — 관리형 레지스트리 `PositionDef` (enum 아님)
직책은 **enum이 아니라 관리형 레지스트리** `PositionDef`(code = string)다. hr_admin이 추가/삭제(`custom_*`)할 수 있고, `@prisma/client`의 `Position` enum을 import하지 않고 `position.util.ts`를 쓴다. 시스템 기본 코드(`isSystem`):
```
ceo · vice_president · executive · director · principal · division_head · team_lead · chief · senior · pro
```

`position`(직책)과 `role`(RBAC)은 **별개**다. 대표적 매핑:

| position(code) | 한글 | 기본 role |
|----------|------|-----------|
| `ceo` | 대표이사 | 운영 지정 — 전사 결과 열람 필요 시 `hr_admin` |
| `division_head` | 본부장 | `division_head` |
| `team_lead` | 팀장 | `team_lead` |
| `chief`·`senior`·`pro` 등 | 책임·선임·프로 | `employee` |

> 본 시스템 RBAC는 4역할 기준. `ceo`·임원급은 별도 역할 신설 없이 `hr_admin`/`division_head` 권한으로 운영. 직책은 관리형이므로 위 목록은 시드 기본값이며 운영 중 가감된다. 무소속(부서/직책 미지정) 사용자도 허용.
> KPI 양식(`jobLevel`)은 **본부장 / 팀장 / 5년차↑(senior_plus) / 5년차↓(senior_minus)** 4종. 책임·선임·프로는 연차로 5년차↑/↓에 매핑.
> 평가자(본부장·팀장)도 본인은 피평가자다(본인평가 + 상위자 평가 수검).

## 3. KPI 분류 & 평가 유형

### KPI 분류 (`Kpi.category` + `Kpi.group`) — KPI 양식 xlsx 기준
KPI 양식의 핵심전략(category)과 2대 가중치 그룹(group):

**가중치 그룹 (`KpiGroup`):**
| group | 한글 | 가중치 | 포함 category |
|-------|------|--------|--------------|
| `performance_core` | 성과 중심 지표 | 70% 또는 80% | 매출액·공정액·수주&업무수행성과 |
| `collaboration_growth` | 협업 및 성장 지표 | 20% 또는 30% | 협업성과·자기개발 |

**KPI 카테고리 (`KpiCategory`):**
| category | 한글 | 측정 예시(xlsx) | 측정방식 |
|----------|------|----------------|---------|
| `revenue` | 매출액 | 그룹 공동달성(프로젝트 실적) | 달성금액 → 달성률 |
| `construction` | 공정액 | 본부별 공정액 달성목표(140억) | 달성금액 → 달성률 |
| `orders` | 수주&업무수행성과 | 본부·개인 수주액(28억)·업무수행 | 달성금액 → 달성률 |
| `collaboration` | 협업성과 | 타본부 협업·설계/견적/영업 지원(20건) | 건수 |
| `development` | 자기개발 | 업무효율·AI활용 설계·유대강화(10건) | 건수 / 정성 |

> 측정방식(`measureType`): `amount`(달성금액→달성률) · `rate`(증감률) · `count`(건수) · `qualitative`(정성). **측정방식별로 등급 기준이 다르다**(business-rules §2). 정성 KPI는 전체 가중치의 ≤30%.

### 평가 유형 (`Evaluation.type` enum) — 다면평가 없음
| type | 한글 | 방향 | 비고 |
|------|------|------|------|
| `self` | 본인평가 | 본인 → 본인 | KPI 실적 자기 입력 |
| `downward` | 부서장 평가 | 상위자 → 하위자 | **다단계 부서장 평가(3단계)** — `round=1` 팀장 · `round=2` 본부장 · `round=3` 그룹대표. 단계별 별도 `Evaluation` 행. **코멘트 필수** |

> **수평(peer)·상향(upward)·다면(multi_source) 평가는 없다.** 에너지엑스는 본인평가(self) + **다단계 부서장 평가(downward 3단계)** 만 운영한다.
> **캐스케이드 (위로 올라가며 단계 배정):** 피평가자 부서에서 조직 트리(그룹→본부→팀)를 위로 올라가며 — 첫 **team**의 장 = `round1`(팀장), 첫 **division**의 장 = `round2`(본부장), 첫 **group**의 장 = `round3`(그룹대표). **본인 제외:** 자기가 그 부서의 장이면 그 단계는 건너뛴다(예: 팀장 본인은 round1 없이 round2·round3만, 본부장은 round3만). **레벨 스킵:** 중간 레벨이 비면 그 위 단계로 매핑(최대 깊이 10).
> **종합 점수 = self(참고) + 다단계 부서장 평가 합산.** `finalScore`(실적) = `combineStages`로 **단계가중 0.5/0.3/0.2**(round1/2/3, 없는 단계는 남은 가중치로 재정규화). **평가자 동일인 예외**(`combineStagesWithExceptions`): ①1차 평가자 = 최종 평가자 → 1차 100% ②2차 평가자 = 최종 평가자(1차와 다름·1차 존재) → 1차 70% + 최종 30%. 최종 결합 `combineFinal` = 실적×perf + 역량×comp(**기본 perf 1·comp 0** — 역량 미반영). self는 연봉·등급 미반영 참고용. 가중치·예외비율은 `RuleSet.weightPolicy`로 설정 가능(2026 기본값).

## 4. 핵심 엔티티

| 엔티티 | 설명 | 핵심 필드 |
|--------|------|----------|
| `User` | 사용자 | id, email, name, role, departmentId, managerId, position(직책), jobLevel(본부장/팀장/senior_plus/senior_minus) |
| `Department` | 조직(트리) | id, name, type(**group/division/team**), parentId |
| `EvaluationCycle` | 평가 주기(연도/반기) | id, name, year, startDate, endDate, status, ruleSetId |
| `KpiTemplate` | 직급별 KPI 양식 | id, cycleId, jobLevel, items[] |
| `KpiTemplateItem` | 양식 항목 | id, templateId, category, group, sampleStrategy, defaultMeasureType, defaultWeight |
| `Kpi` | 개인 KPI(과제) | id, userId, cycleId, **category, group**, coreStrategy(핵심전략), csf, title, measureMethod, **measureType**, targetValue, weight, isQualitative, parentKpiId(상위연계), status |
| `Achievement` | 실적(분기별) | id, kpiId, quarter, actualValue, achievementRate, evidenceUrl |
| `GroupPerformance` | 그룹 실적 | id, groupId, cycleId, revenue, orders, profit, achievementRate, tier(excellent/standard/poor) |
| `GradePool` | 등급 풀 | id, cycleId, **groupId**, tier, sRatio, aRatio, bRatio, cRatio, dRatio |
| `Evaluation` | 개별 평가 | id, cycleId, evaluatorId, evaluateeId, type(self/downward), round, status, totalScore |
| `KpiScore` | 과제별 성과 점수 | id, evaluationId, kpiId, achievementRate, grade(S~D), score, weight |
| `Review` | 분기 리뷰 | id, kpiId, quarter, kind(strength/improvement), content, authorId |
| `Comment` | 평가 코멘트(필수) | id, evaluationId, authorId, quarter, content |
| `EvaluationResult` | 최종 결과 | id, userId, cycleId, finalGrade, finalScore(=단계가중 합산 실적, 동일인 예외 적용), percentile, byType(self 참고 + downward round1/2/3), 조직 스냅샷(group/division/teamSnapshot), companyAvg |
| `CompetencyQuestion` | 역량 문항(참고용) | id, cycleId, order, text (연 1회·10문항·S~D) |
| `CompetencyResponse` | 역량 응답(참고용) | id, questionId, evaluateeId, evaluatorId, grade(S~D) — 연봉·등급 0% 반영, 조회·연도비교에만 표시 |
| `Appeal` | 이의제기 | id, resultId, userId, reason, status, response, decidedById |
| `Compensation` | 보상 연동 | id, userId, cycleId, finalGrade, raiseRate, simulated |
| `Notification` | 알림 | id, userId, type, payload, readAt |
| `RuleSet` | 규칙 세트(설정) | id, cycleId, gradeScale, gradingScales(측정방식별), poolRatios, raiseRates, weightPolicy |
| `AuditLog` | 감사 로그 | id, entity, entityId, action, before, after, userId, at |

> **점수에 합산되는 역량 항목(구 `EvaluationItem`, S~D 라디오)은 폐기.** 최종 점수/등급은 KPI 성과(`KpiScore`)로만 산정된다. 단 **참고용 역량평가**(`CompetencyQuestion`/`CompetencyResponse`)는 별도로 존재하며 연봉·등급에 0% 반영(위 §1 노트).

**관계 요약:** `Department` 트리(group→division→team). `User`는 team에 속하고 `managerId`로 상위자(팀장/본부장). `EvaluationCycle`이 `RuleSet`·`KpiTemplate`·평가들을 묶는다. `Kpi`는 category·group을 갖고 `parentKpiId`로 상위 KPI 연계, `Achievement`(분기)·`Review`를 가진다. `Evaluation`은 type(self/downward)별로 존재하며 **downward는 3단계(`round=1` 팀장·`2` 본부장·`3` 그룹대표)**, 각 `KpiScore`(과제 점수)+`Comment`를 가진다. `GroupPerformance`·`GradePool`이 그룹 단위 풀, `EvaluationResult`가 self(참고)+다단계 부서장 합산(단계가중·동일인 예외), `Appeal`·`Compensation`이 후속. `CompetencyResponse`는 참고용 백데이터(점수 미반영).

## 4-1. 바운디드 컨텍스트 ↔ 모듈 ↔ schema 매핑 (모듈 경계의 권위)

`architecture.md`의 모듈 경계는 아래 매핑을 따른다. 각 컨텍스트 = NestJS 모듈 1개 = Postgres `@@schema` 1개. **교차 컨텍스트 참조는 외래키가 아니라 ID + 서비스 인터페이스**(모듈 간 DB 직접 조인 금지). 이것이 미래의 서비스 절단선이다.

| 바운디드 컨텍스트 | 모듈명 | `@@schema` | 소유 엔티티 |
|------------------|--------|-----------|------------|
| 인증 | `auth` | `auth` | (User 자격증명·세션 — 현행은 org/users에 흡수, 목표는 `packages/auth`로 추출) |
| 조직·사용자 | `org` | `org` | `User`(프로필), `Department` |
| 평가 주기·규칙 | `cycles` | `cycle` | `EvaluationCycle`, `RuleSet`, `KpiTemplate`, `KpiTemplateItem` |
| KPI·실적 | `kpi` | `kpi` | `Kpi`, `Achievement`, `Review` |
| 평가 | `evaluations` | `evaluation` | `Evaluation`, `KpiScore`, `Comment` |
| 캘리브레이션·풀 | `calibrations` | `calibration` | `GroupPerformance`, `GradePool` |
| 결과·이의 | `results` | `result` | `EvaluationResult`, `Appeal` |
| 보상 | `compensation` | `compensation` | `Compensation` |
| 알림 | `notifications` | `notification` | `Notification` |
| 감사 | `audit` | `audit` | `AuditLog` |
| 외부 연동 | `integration` | (어댑터 — 자체 테이블 최소) | 외부 API 소비/제공(`integration-adapter.md`) |

> 모듈명(복수 관례)과 `@@schema`명(단수)은 위 표로 고정한다. 컨텍스트 불변식(가중치 합=100·풀 상한·상태전이 등)은 해당 컨텍스트 모듈 README에 명시하며 `business-rules.md`가 규칙값의 SSOT. **목표 Phase 2~3** — 현행 단일 구조에서는 이 매핑을 모듈 분리·schema 도입의 청사진으로 쓴다.

> **⚠ 리포팅/조회 read-model 예외:** "모듈 간 DB 직접 조인 금지"는 **쓰기(명령)·트랜잭션 경계**에 적용된다. `results`/`reports`/YoY처럼 **여러 컨텍스트를 가로지르는 읽기 전용 집계**는 예외다 — 현행 코드도 `results.service`가 EvaluationResult→User→Department·Evaluation·KpiScore·Comment·CompetencyResponse를 Prisma include로 직접 조인한다(ID+서비스호출만 강제하면 N+1 폭증). 패턴: ①읽기 전용 리포팅 컨텍스트(`reports`)가 여러 소유 schema를 읽는 read model/뷰를 허용, ②또는 쓰기 시점에 비정규화 스냅샷을 남긴다 — `EvaluationResult.group/division/teamSnapshot`이 이 권장 패턴(조직 변동에도 결과 시점 조직을 보존). 자세한 규약은 `architecture.md` §6.

## 5. 상태 머신

상태값은 **정확히 이 문자열**을 사용한다. QA가 모든 status 업데이트를 이 맵과 대조한다.

### EvaluationCycle.status
```
draft → active → mid_review → calibration → closed
```
(설정 → 평가 진행 → 6월 중간평가 → 팀 등급 풀 조정·확정 → 결과 공개)

### Kpi.status
```
draft → submitted → approved → confirmed
              ↓ rejected → draft
              ↓ revision_requested → draft   (환경 변화 시 수정요청·승인)
```

### Evaluation.status
```
not_started → in_progress → submitted → finalized
```
(미평가 → 진행중(임시저장) → 제출(수정불가) → 캘리브레이션 후 확정)

### Appeal.status
```
submitted → under_review → answered → closed
```

> **죽은 전이/무단 전이 금지.** 특히 `Evaluation.submitted → finalized`(캘리브레이션 후 확정)와 `Kpi.approved → confirmed`는 누락되기 쉬우니 반드시 구현·검증한다.

## 6. 명명 규약 (snake_case ↔ camelCase)

경계면 불일치의 최대 원인. 전 계층 일관 적용:

| 계층 | 규약 | 예 |
|------|------|-----|
| DB 컬럼 (Postgres/Prisma) | snake_case | `evaluatee_id`, `achievement_rate`, `final_grade`, `team_id` |
| 백엔드 API 응답(JSON) | **camelCase** | `evaluateeId`, `achievementRate`, `finalGrade`, `teamId` |
| 프론트 타입 정의 | camelCase | `evaluateeId: string` |

> DB→API 경계에서 snake→camel 변환을 직렬화 계층 한 곳에서 수행. 응답 봉투(`{data}`/`{data,meta}`/`{error}`)는 [api-contract-convention.md](api-contract-convention.md)에서 고정.
