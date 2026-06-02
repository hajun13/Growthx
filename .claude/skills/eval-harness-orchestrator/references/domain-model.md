# 인사평가 솔루션 — 도메인 모델 (단일 진실 공급원)

에너지엑스㈜ 2026 KPI 운영 고도화 계획을 시스템화한 인사평가 도메인의 표준 정의. 모든 에이전트(디자인·프론트·백엔드·QA·릴리스)가 공유한다. 엔티티명·상태값·권한·평가 유형·KPI 분류의 **이름은 이 문서를 따른다.** 수치 규칙은 [business-rules.md](business-rules.md), 화면은 [reference-ui-screens.md](reference-ui-screens.md) 참조.

> **권위 자료(따라야 할 기준):** `2026년도 임직원 KPI 및 평가 운영 계획_VER3 1.pptx`(운영계획 PPT, 11슬라이드) + `26년 KPI(양식)…xlsx`(KPI 양식)가 최우선이다. 요구사항 정의서·사용자 스토리는 보완.
> **⚠️ 권위 자료 확인 사실:** PPT·KPI 양식 어디에도 **"역량평가"(공통/리더십/직무/가치역량)는 없다.** 평가 체계는 **순수 KPI/성과 중심**이다. 과거 버전의 역량 차원·다면평가(수평/상향)는 레퍼런스 이미지(advisory)에서 잘못 끌어온 것이므로 **폐기**한다. (그룹/본부/팀 조직 계층은 유효 — §2 참조)
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
| `division_head` | 본부장 | 본부 KPI 목표 설정, **2차 평가자**(팀원 최종 평가)·팀장 평가, 팀 성과 등급 산정, **코멘트 필수** |
| `team_lead` | 팀장 | 팀원 KPI 검토·승인/반려, **1차 평가자**(팀원 등급 산정)+**코멘트 필수**, 이의제기 1차 처리 |
| `employee` | 임직원(피평가자) | 개인 KPI 작성·제출, 실적 입력, 본인평가, 결과 조회, 이의제기 신청 |

> `role`은 **시스템 권한**(RBAC)이다. 조직 **직책**(`position`)과 구분한다.

### 직책 (`User.position` enum) — 에너지엑스 직책 체계
```
ceo(대표이사) → division_head(본부장) → team_lead(팀장) → chief(책임) → senior(선임) → pro(프로)
```

`position`(직책)과 `role`(RBAC)은 **별개**다. 기본 매핑:

| position | 한글 | 기본 role |
|----------|------|-----------|
| `ceo` | 대표이사 | 운영 지정 — 전사 결과 열람 필요 시 `hr_admin` 권한 부여 |
| `division_head` | 본부장 | `division_head` |
| `team_lead` | 팀장 | `team_lead` |
| `chief` | 책임 | `employee` |
| `senior` | 선임 | `employee` |
| `pro` | 프로 | `employee` |

> 본 시스템 RBAC는 4역할 기준. `ceo`는 별도 역할 신설 없이 `hr_admin` 권한으로 운영.
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
| `downward` | 부서장 평가 | 상위자 → 하위자 | `round`(1=1차 팀장, 2=2차 본부장). **코멘트 필수** |

> **수평(peer)·상향(upward)·다면(multi_source) 평가는 없다.** 에너지엑스는 본인평가 + 1·2차 부서장 평가만 운영한다(PPT 슬라이드 10: 평가자 = 본부장+팀장). 한 팀원의 종합 = self(참고) + downward 1차(팀장) + downward 2차(본부장)를 가중 집계해 `EvaluationResult` 산출.

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
| `EvaluationResult` | 최종 결과 | id, userId, cycleId, finalGrade, finalScore, percentile, byType(self/downward1/downward2 점수·등급), companyAvg |
| `Appeal` | 이의제기 | id, resultId, userId, reason, status, response, decidedById |
| `Compensation` | 보상 연동 | id, userId, cycleId, finalGrade, raiseRate, simulated |
| `Notification` | 알림 | id, userId, type, payload, readAt |
| `RuleSet` | 규칙 세트(설정) | id, cycleId, gradeScale, gradingScales(측정방식별), poolRatios, raiseRates, weightPolicy |
| `AuditLog` | 감사 로그 | id, entity, entityId, action, before, after, userId, at |

> **역량 항목(EvaluationItem) 엔티티는 폐기.** 평가는 KPI 성과(`KpiScore`)로만 구성된다. S~D 라디오로 역량을 매기는 구조는 없다.

**관계 요약:** `Department` 트리(group→division→team). `User`는 team에 속하고 `managerId`로 상위자(팀장/본부장). `EvaluationCycle`이 `RuleSet`·`KpiTemplate`·평가들을 묶는다. `Kpi`는 category·group을 갖고 `parentKpiId`로 상위 KPI 연계, `Achievement`(분기)·`Review`를 가진다. `Evaluation`은 type(self/downward)·round별로 존재하며 `KpiScore`(과제 점수)+`Comment`를 가진다. `GroupPerformance`·`GradePool`이 그룹 단위 풀, `EvaluationResult`가 self+downward 집계, `Appeal`·`Compensation`이 후속.

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
