# 인사평가 솔루션 — API 계약 (M1 + M2, v2 도메인 대정정)

> **계약 우선(Contract-First).** 프론트·백엔드가 구현 전 합의하는 단일 파일.
> 규약: [api-contract-convention.md](../../.claude/skills/eval-harness-orchestrator/references/api-contract-convention.md)
> 도메인: [domain-model.md](../../.claude/skills/eval-harness-orchestrator/references/domain-model.md)
> 규칙: [business-rules.md](../../.claude/skills/eval-harness-orchestrator/references/business-rules.md)
>
> **변경 이력**
> | 날짜 | 변경 | 작성자 |
> |------|------|--------|
> | 2026-06-02 | M1 초안 — health/auth/users/departments/cycles/rule-sets/kpi-templates/kpis/achievements/evaluations/results 전체 명세 | backend-engineer |
> | 2026-06-02 | M1 QA 결함 수정 — D-1(approve/reject `{comment}` body·코멘트 영속화), E-1(kpis 목록 행수준 필터 명시), D-2(KpiStatus `rejected`·`revision_requested` 보강), `DELETE /kpis/:id`(#2) 추가, `EvaluationResult.multiSource` 유형별 grade·comment 노출(#4), `GET /competency-items` 역량 항목 마스터(#5) 추가, `Kpi`·`EvaluationResult` nullable 필드 명시(B-1/B-2) | backend-engineer |
> | 2026-06-02 | **v2 도메인 대정정** — ①역량평가 폐기: `Dimension`/`EvaluationItem`/`competency-items` 제거(평가는 `KpiScore` 만). ②다면 폐기: `EvaluationType`=`self`+`downward`(round 1 팀장·2 본부장), peer·upward 제거. ③조직 4단계 `DepartmentType`=group(최상위)→division→team. ④그룹 풀: GroupPerformance·GradePool=`groupId`. ⑤KPI에 `category`/`group`/`measureType` 추가, `RuleSet.achievementGrades`→`gradingScales`(측정방식별), count는 KPI `grading`. ⑥`EvaluationResult.byType`={self,downward1,downward2}. ⑦M2 추가: group-performance·grade-pools·appeals·compensations·notifications | backend-engineer |
> | 2026-06-04 | **M2 델타**(문서 끝 "M2 델타" 절) — A: rule-sets 전 필드 PATCH + 폴백. B-1: kpi-templates GET/PATCH/DELETE. B-2: cycles/:id/schedules. B-3: evaluations.overallGrade 오버라이드·GradePool headcount/caps·userName/departmentName 비정규화·EvaluationResult.byGroup. C-1: excel import/export + 양식(template/:kind) 다운로드 + 감사로그 export. C-2: notifications 인앱(unread-count·read·read-all)+이메일. C-3: dashboard/summary. C-4: audit-logs | backend-engineer |

---

## 0. 공통 규약

- **베이스 경로:** `/api/v1`
- **인증:** `Authorization: Bearer <accessToken>` (JWT). 401=미인증/만료, 403=권한부족.
- **응답 봉투(예외 없음):**
  - 단건: `{ "data": { ... } }`
  - 목록: `{ "data": [ ... ], "meta": { "page", "pageSize", "total" } }`
  - 에러: `{ "error": { "code", "message", "details": [] } }`
- **필드명:** 전부 camelCase. 식별자 `xxxId`. 날짜 ISO 8601. 불리언 `isXxx`/`hasXxx`.
- **역할(role):** `hr_admin` · `division_head` · `team_lead` · `employee`

### 공통 에러 코드
| HTTP | code | 의미 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | body/쿼리 검증 실패 (가중치 합≠100, 정성>30% 등) |
| 401 | `UNAUTHORIZED` | JWT 없음/만료 |
| 403 | `FORBIDDEN` | 역할/소유권 부족 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `ALREADY_EXISTS` | 중복 생성 |
| 409 | `INVALID_STATE_TRANSITION` | 허용되지 않은 상태 전이 |
| 422 | `POOL_EXCEEDED` | 그룹 등급 풀 상한 초과 (제출 차단) |
| 422 | `COMMENT_REQUIRED` | 평가자 코멘트 미작성 |

---

## 1. Health

### GET /api/v1/health
- 권한: 공개(인증 불요)
- 응답 200: `{ data: { status: "ok", timestamp } }`

---

## 2. Auth

### POST /api/v1/auth/login
- 권한: 공개
- 요청: `{ email, password }`
- 응답 200: `{ data: { accessToken, refreshToken, user: User } }`
- 에러: 400 VALIDATION_ERROR, 401 UNAUTHORIZED(자격 불일치)

### POST /api/v1/auth/refresh
- 권한: 공개(refreshToken 필요)
- 요청: `{ refreshToken }`
- 응답 200: `{ data: { accessToken, refreshToken } }`
- 에러: 401 UNAUTHORIZED

### GET /api/v1/auth/me
- 권한: 인증된 모든 역할
- 응답 200: `{ data: User }`
- 에러: 401 UNAUTHORIZED

**User 객체**
```
{ id, email, name, role, position, departmentId, managerId, jobLevel, createdAt }
```

---

## 3. Users

### GET /api/v1/users
- 권한: hr_admin(전체), division_head(본부), team_lead(팀)
- 쿼리: `page, pageSize, role?, departmentId?, q?`
- 응답 200: `{ data: User[], meta }`

### GET /api/v1/users/:id
- 권한: hr_admin / 본인 / 상위 관리자(행 수준)
- 응답 200: `{ data: User }`
- 에러: 403 FORBIDDEN, 404 NOT_FOUND

### POST /api/v1/users
- 권한: hr_admin
- 요청: `{ email, name, password, role, position, departmentId, managerId?, jobLevel }`
- 응답 201: `{ data: User }`
- 에러: 400, 403, 409 ALREADY_EXISTS

### PATCH /api/v1/users/:id
- 권한: hr_admin
- 요청: `{ name?, role?, position?, departmentId?, managerId?, jobLevel? }`
- 응답 200: `{ data: User }`

---

## 4. Departments

### GET /api/v1/departments
- 권한: 인증된 모든 역할
- 쿼리: `type?(group|division|team), tree?(boolean)`
- 응답 200: `{ data: Department[], meta }` — `tree=true`면 `children[]` 포함 트리 (group 최상위 → division → team)

### GET /api/v1/departments/:id
- 권한: 인증된 모든 역할
- 응답 200: `{ data: Department }`

### POST /api/v1/departments
- 권한: hr_admin
- 요청: `{ name, type, parentId? }`
- 응답 201: `{ data: Department }`

**Department 객체**: `{ id, name, type, parentId, children?: Department[] }`

---

## 5. Cycles (평가 주기)

### GET /api/v1/cycles
- 권한: 인증된 모든 역할
- 쿼리: `status?, year?`
- 응답 200: `{ data: EvaluationCycle[], meta }`

### GET /api/v1/cycles/:id
- 권한: 인증된 모든 역할
- 응답 200: `{ data: EvaluationCycle }`

### POST /api/v1/cycles
- 권한: hr_admin
- 요청: `{ name, year, startDate, endDate, ruleSetId? }`
- 응답 201: `{ data: EvaluationCycle }`

### PATCH /api/v1/cycles/:id/status
- 권한: hr_admin
- 요청: `{ status }` — 전이: `draft→active→mid_review→calibration→closed`
- 응답 200: `{ data: EvaluationCycle }`
- 에러: 409 INVALID_STATE_TRANSITION

**EvaluationCycle 객체**: `{ id, name, year, startDate, endDate, status, ruleSetId, createdAt }`

---

## 6. Rule Sets (규칙 — 설정 가능)

### GET /api/v1/rule-sets
- 권한: 인증된 모든 역할(읽기)
- 응답 200: `{ data: RuleSet[], meta }`

### GET /api/v1/rule-sets/:id
- 권한: 인증된 모든 역할
- 응답 200: `{ data: RuleSet }`

### POST /api/v1/rule-sets
- 권한: hr_admin
- 요청: `{ cycleId, gradeScale, gradingScales, poolRatios, raiseRates, weightPolicy }`
- 응답 201: `{ data: RuleSet }`

### PATCH /api/v1/rule-sets/:id
- 권한: hr_admin
- 요청: 위 필드 부분 갱신
- 응답 200: `{ data: RuleSet }`

**RuleSet 객체 (JSON 필드)**
```
{
  id, cycleId,
  gradeScale: [{ grade:"S", min:96, max:100 }, ...],          // 점수→등급
  gradingScales: {                                            // 측정방식별 달성률→등급
    amount: [{ grade:"S", minRate:110.0001, maxRate:null }, ...],
    rate:   [{ grade:"S", minRate:110.0001, maxRate:null }, ...]
  },
  poolRatios: { excellent:{S,A,B,C,D}, standard:{...}, poor:{...} },
  raiseRates: { S:7, A:5, B:3, C:1, D:0 },
  weightPolicy: { totalMustEqual:100, qualitativeMaxPercent:30 }
}
```
- **측정방식별 등급(v2):** `gradingScales.amount`/`gradingScales.rate`는 달성률(%)→등급. `count`(건수)는 KPI별 `grading`(`Kpi.grading: [{ grade, minCount, maxCount }]`)에서 읽는다. `qualitative`는 평가자가 직접 등급 부여.

---

## 7. KPI Templates (직급별 양식)

### GET /api/v1/kpi-templates
- 권한: 인증된 모든 역할
- 쿼리: `cycleId?, jobLevel?`
- 응답 200: `{ data: KpiTemplate[], meta }`

### POST /api/v1/kpi-templates
- 권한: hr_admin
- 요청: `{ cycleId, jobLevel, items: [{ category, group, sampleStrategy?, defaultMeasureType, defaultWeight, isQualitative }] }`
- 동작: 양식 항목 `defaultWeight` 합=100·정성≤30% 검증.
- 응답 201: `{ data: KpiTemplate }`

**KpiTemplate 객체**: `{ id, cycleId, jobLevel, items: KpiTemplateItem[] }`
**KpiTemplateItem**: `{ id, templateId, category, group, sampleStrategy, defaultMeasureType, defaultWeight, isQualitative }`
**jobLevel**: `division_head | team_lead | senior_plus | senior_minus` (본부장/팀장/5년차↑/5년차↓)
**category**(KpiCategory): `revenue(매출액) | construction(공정액) | orders(수주&업무수행) | collaboration(협업성과) | development(자기개발)`
**group**(KpiGroup): `performance_core(성과중심 70/80%) | collaboration_growth(협업·성장 20/30%)`
**measureType**(MeasureType): `amount(달성금액→달성률) | rate(증감률) | count(건수) | qualitative(정성)`

> **역량 항목(`/competency-items`)은 폐기됨(v2).** 평가는 KPI 성과(`KpiScore`)로만 구성된다. self 화면 탭은 성과중심/협업·성장 두 그룹.

---

## 8. KPIs (개인 KPI/과제)

### GET /api/v1/kpis
- 권한: hr_admin / division_head(본부) / team_lead(팀) / employee(본인)
- 쿼리: `cycleId?, userId?, status?, group?, category?`
- **행 수준 필터(E-1):** 목록 결과는 호출자 가시 범위로 제한된다 — employee=본인, team_lead=자기 팀(직접 보고자·동일 팀 부서), division_head=자기 본부 하위 트리, hr_admin=전체. (타팀/타본부 KPI는 목록에 노출되지 않음.)
- 응답 200: `{ data: Kpi[], meta }`

### GET /api/v1/kpis/:id
- 권한: 소유자 / 상위 관리자 / hr_admin
- 응답 200: `{ data: Kpi }`

### POST /api/v1/kpis
- 권한: employee(본인) / team_lead / division_head / hr_admin
- 요청: `{ cycleId, category, group, title, coreStrategy?, csf?, measureMethod?, measureType, targetValue?, weight, isQualitative, grading?, parentKpiId? }`
  - `grading`(선택): count 측정방식의 건수→등급 임계값 `[{ grade, minCount, maxCount }]`. amount/rate 는 불필요.
- 응답 201: `{ data: Kpi }` (status=`draft`)
- 에러: 400 VALIDATION_ERROR (가중치 합>100 등)

### PATCH /api/v1/kpis/:id
- 권한: 소유자(draft 상태에서만)
- 요청: KPI 필드 부분 갱신
- 응답 200: `{ data: Kpi }`

### DELETE /api/v1/kpis/:id
- 권한: 소유자(draft 상태에서만) / hr_admin
- 동작: draft 상태 본인 KPI 삭제. submitted 이후 상태는 삭제 불가(409).
- 응답 200: `{ data: { id, deleted: true } }`
- 에러: 403 FORBIDDEN(비소유자), 404 NOT_FOUND, 409 INVALID_STATE_TRANSITION(draft 아님)

### POST /api/v1/kpis/:id/submit
- 권한: 소유자
- 동작: `draft → submitted`. **사용자 KPI 가중치 합=100 검증**, 정성 ≤30% 검증.
- 응답 200: `{ data: Kpi }`
- 에러: 409 INVALID_STATE_TRANSITION, 400 VALIDATION_ERROR

### POST /api/v1/kpis/:id/approve
- 권한: team_lead(팀) / division_head / hr_admin
- 요청(선택): `{ comment? }` — 검토 의견. 전달 시 Review(kind=`strength`)로 영속화.
- 동작: `submitted → approved`
- 응답 200: `{ data: Kpi }`

### POST /api/v1/kpis/:id/reject
- 권한: team_lead / division_head / hr_admin
- 요청: `{ reason, comment? }` — `reason`(반려 사유, 필수)은 `rejectReason`에 기록. `comment`(보강 의견, 선택)는 Review(kind=`improvement`)로 영속화.
- 동작: `submitted → draft` (rejected 사유 기록)
- 응답 200: `{ data: Kpi }`

> **검토 의견 영속화:** KPI 검토(K2)에서 입력한 코멘트는 `Review` 레코드로 저장된다(approve→`strength`, reject→`improvement`, `quarter=0`은 KPI 단계 검토 의견을 의미). 프론트는 `GET /kpis/:id/reviews` 없이도 K2 입력값이 유실되지 않음이 보장된다.

### POST /api/v1/kpis/:id/confirm
- 권한: team_lead / division_head / hr_admin
- 동작: `approved → confirmed`
- 응답 200: `{ data: Kpi }`
- 에러: 409 INVALID_STATE_TRANSITION

### POST /api/v1/kpis/:id/link
- 권한: 소유자 / 관리자
- 요청: `{ parentKpiId }` — 상위 KPI 연계(cascade)
- 응답 200: `{ data: Kpi }`

**Kpi 객체**
```
{ id, userId, cycleId,
  category,                       // KpiCategory
  group,                          // KpiGroup
  coreStrategy: string | null,    // nullable (작성 전 빈 값 가능)
  csf: string | null,             // nullable
  title: string,
  measureMethod: string | null,   // nullable
  measureType,                    // MeasureType
  targetValue: number | null,     // nullable
  weight, isQualitative,
  grading: object[] | null,       // count 임계값(nullable)
  parentKpiId: string | null,     // nullable
  status, rejectReason: string | null, createdAt }
```
- **status enum**: `draft | submitted | approved | confirmed`. (도메인 상태머신의 `rejected`·`revision_requested`는 **표시 전용 파생 상태**로, 백엔드는 반려 시 `status=draft` + `rejectReason`을 사용한다. 프론트는 `rejectReason`이 있는 draft를 "반려됨"으로 표시할 수 있다 — 별도 status 값은 반환되지 않음.)
- **nullable 주의(B-2):** `coreStrategy`/`csf`/`measureMethod`/`targetValue`/`parentKpiId`/`rejectReason`는 `null`로 응답될 수 있다. 프론트는 폼 바인딩 시 `?? ''` 폴백 필요.

---

## 9. Achievements (분기 실적)

### GET /api/v1/achievements
- 권한: 소유자 / 상위 관리자 / hr_admin
- 쿼리: `kpiId?, quarter?`
- 응답 200: `{ data: Achievement[], meta }`

### POST /api/v1/achievements
- 권한: KPI 소유자
- 요청: `{ kpiId, quarter, actualValue, evidenceUrl? }`
- 동작: `achievementRate = actualValue / targetValue × 100` 백엔드 계산
- 응답 201: `{ data: Achievement }`

**Achievement 객체**: `{ id, kpiId, quarter, actualValue, achievementRate, evidenceUrl, createdAt }`

---

## 10. Evaluations (평가)

### GET /api/v1/evaluations
- 권한: 평가자/피평가자 본인 / 상위 / hr_admin
- 쿼리: `cycleId?, evaluatorId?, evaluateeId?, type?, status?`
- 응답 200: `{ data: Evaluation[], meta }`

### GET /api/v1/evaluations/:id
- 권한: 평가자/피평가자 / 상위 / hr_admin
- 응답 200: `{ data: EvaluationDetail }` — `kpiScores[]`(KpiScore) + `comments[]` 포함 (역량 항목 `items` 없음)

### POST /api/v1/evaluations
- 권한: hr_admin / 배정된 평가자
- 요청: `{ cycleId, evaluateeId, type, round? }` — `type`=`self`|`downward`. `downward`는 `round`(1=팀장·2=본부장) 필수.
- 응답 201: `{ data: Evaluation }` (status=`not_started`)
- 에러: 409 ALREADY_EXISTS, 400 VALIDATION_ERROR(downward인데 round 누락)

### PATCH /api/v1/evaluations/:id
- 권한: 평가자 본인 (in_progress)
- 요청: `{ kpiScores?: [{ kpiId, achievementRate?, directGrade?, weight }] }`
  - `achievementRate`: amount/rate 달성률(%) 또는 count 실적 건수. `directGrade`: qualitative 의 평가자 직접 등급.
  - **grade·score 는 백엔드가 측정방식·RuleSet 으로 산출**(프론트 위임 금지).
- 동작: `not_started → in_progress`. **측정방식별 raw 등급→점수, totalScore 백엔드 재계산** (`Σ score×weight/100`).
- 응답 200: `{ data: EvaluationDetail }`

### POST /api/v1/evaluations/:id/comment
- 권한: 평가자 본인 (division_head/team_lead 코멘트 필수)
- 요청: `{ quarter, content }`
- 응답 201: `{ data: Comment }`

### POST /api/v1/evaluations/:id/submit
- 권한: 평가자 본인
- 동작: `in_progress → submitted`. **코멘트 필수 검증**, **그룹 등급 풀 상한 검증**(초과 시 차단).
- 응답 200: `{ data: Evaluation }`
- 에러: 422 COMMENT_REQUIRED, 422 POOL_EXCEEDED, 409 INVALID_STATE_TRANSITION

### POST /api/v1/evaluations/:id/finalize
- 권한: hr_admin (캘리브레이션 후)
- 동작: `submitted → finalized`. 최종 등급 확정, EvaluationResult 갱신.
- 응답 200: `{ data: Evaluation }`
- 에러: 409 INVALID_STATE_TRANSITION

**Evaluation 객체**: `{ id, cycleId, evaluatorId, evaluateeId, type, round, status, totalScore, finalGrade, createdAt }`
**KpiScore**: `{ id, evaluationId, kpiId, achievementRate, grade, score, weight }`
**Comment**: `{ id, evaluationId, authorId, quarter, content, createdAt }`

---

## 11. Results (self + downward 집계 결과)

### GET /api/v1/results
- 권한: hr_admin(전체) / division_head(본부) / team_lead(팀) / employee(본인)
- 쿼리: `cycleId?, userId?`
- 응답 200: `{ data: EvaluationResult[], meta }`

### GET /api/v1/results/:userId
- 권한: 본인 / 상위 관리자 / hr_admin (행 수준)
- 쿼리: `cycleId`
- 응답 200: `{ data: EvaluationResultDetail }` — 종합(finalGrade·percentile) + 유형별 비교(self/downward1/downward2)

### POST /api/v1/results/aggregate
- 권한: hr_admin
- 요청: `{ cycleId, userId }`
- 동작: 해당 사용자의 finalized 평가들을 유형·round별 가중 집계 → EvaluationResult 산출. **종합 점수는 부서장 평가 가중**(2차 본부장 우선 → 1차 팀장 → self 참고).
- 응답 200: `{ data: EvaluationResultDetail }`

**EvaluationResult 객체**
```
{ id, userId, cycleId,
  finalGrade: Grade | null,     // nullable (미집계/finalized 없음)
  finalScore: number | null,    // nullable
  percentile: number | null,    // nullable
  companyAvg: number | null,    // nullable
  byType: {                     // 유형별 비교 뷰 — self/1차 팀장/2차 본부장
    self:      { score: number | null, grade: Grade | null, comment: string | null },
    downward1: { score: number | null, grade: Grade | null, comment: string | null },  // 1차 팀장
    downward2: { score: number | null, grade: Grade | null, comment: string | null }   // 2차 본부장
  } | null }
```
- **nullable 주의(B-1):** 결과가 아직 집계되지 않았거나 finalized 평가가 없으면 `finalGrade`/`finalScore`/`percentile`/`companyAvg`가 `null`이다. 프론트는 등급 칩·막대 렌더 전 null 가드 필요.
- **byType(v2):** `downward1`(팀장)·`downward2`(본부장)·`self`(참고) 유형별 점수·등급·최신 코멘트. peer·upward·dimensionGrades 폐기.

---

## 12. Group Performance (그룹 실적 — M2)

### GET /api/v1/group-performance
- 권한: hr_admin / division_head
- 쿼리: `cycleId?, groupId?`
- 응답 200: `{ data: GroupPerformance[], meta }`

### POST /api/v1/group-performance
- 권한: hr_admin
- 요청: `{ groupId, cycleId, revenue?, orders?, profit?, achievementRate }`
- 동작: `tier` 자동 분류(달성률 ≥100 excellent / ≥90 standard / else poor). group 타입 조직만 허용. upsert.
- 응답 201: `{ data: GroupPerformance }`
- 에러: 400 VALIDATION_ERROR(group 타입 아님)

**GroupPerformance 객체**: `{ id, groupId, cycleId, revenue, orders, profit, achievementRate, tier, createdAt }`
**tier**(GroupTier): `excellent(우수) | standard(보통) | poor(미흡)`

---

## 13. Grade Pools (그룹 등급 풀 — M2)

### GET /api/v1/grade-pools
- 권한: hr_admin / division_head / team_lead
- 쿼리: `cycleId?, groupId?`
- 응답 200: `{ data: GradePool[], meta }`

### POST /api/v1/grade-pools/compute
- 권한: hr_admin
- 요청: `{ cycleId, groupId }`
- 동작: 그룹 실적 tier → `RuleSet.poolRatios[tier]` 의 S/A/B/C/D 분포 상한을 적용해 GradePool upsert. 실적 미입력 시 400.
- 응답 200: `{ data: GradePool }`
- 에러: 400 VALIDATION_ERROR(실적 미입력)

**GradePool 객체**: `{ id, cycleId, groupId, tier, sRatio, aRatio, bRatio, cRatio, dRatio }`

> 풀 상한은 `POST /evaluations/:id/submit` 에서 강제된다(그룹 등급 분포 초과 시 422 POOL_EXCEEDED).

---

## 14. Appeals (이의제기 — M2)

### GET /api/v1/appeals
- 권한: hr_admin(전체) / division_head·team_lead(가시 범위) / employee(본인)
- 쿼리: `userId?, status?`
- 응답 200: `{ data: Appeal[], meta }`

### POST /api/v1/appeals
- 권한: employee(본인 결과) / 전 역할(본인)
- 요청: `{ resultId, reason }`
- 동작: 결과 통보 후 **7일 이내**만 접수(초과 시 422). status=`submitted`.
- 응답 201: `{ data: Appeal }`
- 에러: 403 FORBIDDEN(타인 결과), 422 APPEAL_WINDOW_CLOSED

### POST /api/v1/appeals/:id/respond
- 권한: team_lead(1차) / division_head / hr_admin
- 요청: `{ response }`
- 동작: 팀장 1차 답변. `submitted/under_review → answered`.
- 응답 200: `{ data: Appeal }`

### POST /api/v1/appeals/:id/decide
- 권한: hr_admin
- 요청: `{ decision }` — 유지/조정 + 사유.
- 동작: HR 최종 결정. `answered → closed`.
- 응답 200: `{ data: Appeal }`
- 에러: 409 INVALID_STATE_TRANSITION

**Appeal 객체**: `{ id, resultId, userId, reason, status, response, respondedById, decision, decidedById, createdAt, updatedAt }`
**status**(AppealStatus): `submitted → under_review → answered → closed`

---

## 15. Compensations (보상 연동 — M2)

### GET /api/v1/compensations
- 권한: hr_admin(전체) / employee(본인)
- 쿼리: `cycleId?, userId?`
- 응답 200: `{ data: Compensation[], meta }`

### POST /api/v1/compensations/compute
- 권한: hr_admin
- 요청: `{ cycleId, simulated? }` — `simulated`(기본 false): true면 시뮬레이션 레코드.
- 동작: cycle 의 확정 결과(finalGrade) → `RuleSet.raiseRates` 인상률 산정. 결과별 Compensation upsert + 전사 평균 산출.
- 응답 200: `{ data: Compensation[], meta: { ..., companyAvgRaise, exceedsTarget } }` — 전사 평균 인상률·3% 초과 경고 플래그.

**Compensation 객체**: `{ id, userId, cycleId, finalGrade, raiseRate, simulated, userName, departmentName, createdAt }`
- `userName`(string|null), `departmentName`(string|null): B-3c 비정규화 — User·Department 조인 후 동봉(없으면 null). `GET /compensations`·`POST /compensations/compute` 의 `data[]` 각 항목에 동일 적용.

---

## 16. Notifications (알림 — M2)

### GET /api/v1/notifications
- 권한: 인증된 모든 역할(본인 알림만)
- 쿼리: `unreadOnly?('true')`
- 응답 200: `{ data: Notification[], meta }`

### POST /api/v1/notifications
- 권한: hr_admin
- 요청: `{ userId, type, payload? }`
- 응답 201: `{ data: Notification }`

### POST /api/v1/notifications/generate
- 권한: hr_admin
- 요청: `{ cycleId, kind('d7'|'d1'|'d3'), message }`
- 동작: cycle 대상자에게 D-7/D-1/D-3 마감·독촉 알림 일괄 생성.
- 응답 201: `{ data: { count, type } }`

### POST /api/v1/notifications/:id/read
- 권한: 본인
- 동작: 읽음 처리(`readAt` 기록).
- 응답 200: `{ data: Notification }`

**Notification 객체**: `{ id, userId, type, payload, readAt, createdAt }`

---

## 17. 행 수준(소유권) 권한 요약

| 범위 | 구현 위치 | 규칙 |
|------|----------|------|
| 본인 한정 | service | `resource.userId === currentUser.id` |
| 팀 한정 | service | 대상자의 `managerId === currentUser.id` 또는 같은 team department |
| 본부 한정 | service | 대상자의 department가 현재 본부 하위 트리 |
| 전사 | role guard | `hr_admin` |

---

## M2 델타 (2026-06-04, backend-engineer)

> M1 + v2 위에 얹는 **신규/변경 엔드포인트**. 기존 명세(§1~17)는 그대로 유효하다. 응답 봉투·camelCase·전역 RBAC 동일. 프론트는 이 절만 보고 신규 훅·타입을 1:1 정의할 수 있다.
>
> **추가 에러 코드**
> | HTTP | code | 의미 |
> |------|------|------|
> | 422 | `APPEAL_WINDOW_CLOSED` | 이의제기 7일 창 만료 |
>
> **공통 변경(B-3c 비정규화):** `evaluations`·`results`·`appeals`·`grade-pools` 응답에 `userName`(피평가자/본인)·`departmentName`이 동봉된다(없으면 `null`). 프론트는 `id.slice()` 대신 이 값을 표시한다.

### M2-A. Rule Sets — 전 필드 편집 (변경)

#### PATCH /api/v1/rule-sets/:id  *(전 필드 수용)*
- 권한: `hr_admin`
- 요청 body(부분 PATCH, 제공된 필드만 검증):
  ```
  { gradeScale?, gradingScales?, poolRatios?, raiseRates?, weightPolicy? }
  ```
  - `gradeScale`: `[{ grade, min, max }]` — 5등급(S~D) 전부, min≤max, 구간 겹침 없음(단조).
  - `gradingScales`: `{ amount:[{grade,minRate,maxRate|null}], rate:[...] }` — 비어 있으면 400.
  - `poolRatios`: `{ excellent:{S,A,B,C,D}, standard:{...}, poor:{...} }` — 각 tier 합=100(±0.01).
  - `raiseRates`: `{ S,A,B,C,D }` — 전 등급 number.
  - `weightPolicy`: `{ totalMustEqual, qualitativeMaxPercent(0~100) }`.
- 응답 200: `{ data: RuleSet }`
- 에러: 400 `VALIDATION_ERROR`(가중치 합·정성 상한·등급 단조·풀 합), 404 `NOT_FOUND`
- 부수효과: `AuditLog`(entity=`RuleSet`, action=`rule_set.update`, before/after) 기록.

> **폴백(A):** `loadRuleSetForCycle`은 주기 RuleSet 미연결 시 글로벌 default(cycleId=null, 최신)로 폴백 → 404 제거. 주기 생성(`POST /cycles`)은 ruleSetId 미지정 시 글로벌 default를 **복제해 자동 연결**한다. 점수·등급·풀·인상률 전 산정이 RuleSet 경유(하드코딩 0).

### M2-B1. KPI Templates — CRUD 완성 (변경/추가)

#### GET /api/v1/kpi-templates/:id
- 권한: 인증된 모든 역할
- 응답 200: `{ data: KpiTemplate }` (`items[]` 포함)

#### PATCH /api/v1/kpi-templates/:id  *(항목 전체 교체)*
- 권한: `hr_admin`
- 요청: `{ items: [{ category, group, sampleStrategy?, defaultMeasureType, defaultWeight, isQualitative }] }`
- 동작: 기존 items 전부 삭제 후 재생성. `defaultWeight` 합=100·정성≤상한 검증(RuleSet 정책 경유).
- 응답 200: `{ data: KpiTemplate }`
- 에러: 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`

#### DELETE /api/v1/kpi-templates/:id
- 권한: `hr_admin`
- 응답 200: `{ data: { id, deleted: true } }`

### M2-B2. Cycle Schedules — 일정·대상자·알림 (추가)

#### GET /api/v1/cycles/:id/schedules
- 권한: 인증된 모든 역할
- 응답 200: `{ data: CycleSchedule[], meta }` (dueDate 오름차순)

#### PATCH /api/v1/cycles/:id/schedules  *(phase 기준 일괄 upsert)*
- 권한: `hr_admin`
- 요청: `{ schedules: [{ phase, dueDate, notifyOffsets?, notifyEnabled?, targetUserIds?, targetDeptIds? }] }`
  - `phase`: 단계 식별 문자열(예: `prep`/`self`/`downward1`/`downward2`/`result`).
  - `dueDate`: ISO 8601. `notifyOffsets`: 정수 배열(기본 `[7,3,1]` = D-7/D-3/D-1).
  - `targetUserIds`/`targetDeptIds`: 대상자 id 배열(기본 `[]`).
- 응답 200: `{ data: CycleSchedule[], meta }`
- 부수효과: `AuditLog`(entity=`EvaluationCycle`, action=`cycle.schedule.update`).

**CycleSchedule 객체**: `{ id, cycleId, phase, dueDate, notifyOffsets:number[], notifyEnabled:boolean, targetUserIds:string[], targetDeptIds:string[], createdAt, updatedAt }`

> 경로는 복수형 `/schedules`(단건 아님, phase별 컬렉션).

### M2-B3. 이연 백로그 (변경)

- **B-3a 종합등급 오버라이드** — `PATCH /api/v1/evaluations/:id` 요청 body에 `overallGrade?(Grade)`·`overallReason?(string)` 추가.
  - `overallGrade` 설정 시 `overallReason`(사유)은 **필수**(없으면 422 `VALIDATION_ERROR`).
  - `Evaluation` 응답에 `overallGrade`·`overallReason` 필드 추가(없으면 `null`).
  - `finalize` 시 `overallGrade`가 있으면 자동 산정값 대신 그것을 `finalGrade`로 확정.
  - 부수효과: `AuditLog`(action=`evaluation.overall_grade.override`).
- **B-3b GradePool headcount/caps** — `GradePool` 응답에 `headcount`(그룹 하위 트리 정원)·`caps:{S,A,B,C,D}`(등급별 절대 인원 상한, `ceil(ratio% × headcount)`)·`groupName` 추가.
- **B-3c userName/departmentName** — 위 공통 변경 참조.
- **B-3d EvaluationResult.byGroup** — `EvaluationResult` 응답에 `byGroup` 추가:
  ```
  byGroup: {
    performance_core:     { score: number|null, grade: Grade|null },
    collaboration_growth: { score: number|null, grade: Grade|null }
  } | null
  ```
  `POST /results/aggregate`가 확정 기준 평가의 KpiScore를 group별로 가중 집계해 채운다.

### M2-C1. Excel 임포트/익스포트 (신규) — 전부 `hr_admin`

#### POST /api/v1/excel/import/templates?cycleId=...   *(multipart, field=`file`)*
#### POST /api/v1/excel/import/org                       *(multipart, field=`file`)*
#### POST /api/v1/excel/import/achievements              *(multipart, field=`file`)*
- 요청: `multipart/form-data`, 파일 필드명 `file`(.xlsx). templates는 쿼리 `cycleId` 필수.
- 응답 200: `{ data: { validCount, errorCount, imported, ok, errors: [{ row, message }] } }`
  - `errors[]`가 비어 있고 `ok=true`면 전건 반영. templates는 오류가 1건이라도 있으면 전건 미반영(`imported=0`).
- 에러: 400 `VALIDATION_ERROR`(파일/cycleId 누락·빈 시트·가중치 위반)

#### GET /api/v1/excel/export/results?cycleId=...
#### GET /api/v1/excel/export/distribution?cycleId=...
#### GET /api/v1/excel/export/compensation?cycleId=...
- 응답 200: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` **바이너리 스트림**(봉투 없음).
  - 헤더 `Content-Disposition: attachment; filename="...xlsx"`. 프론트는 `blob`으로 받아 다운로드.

#### GET /api/v1/excel/template/:kind   *(kind = `templates` | `org` | `achievements`)*
- 권한: `hr_admin`. 해당 임포트가 기대하는 컬럼 헤더만 담긴 **빈 .xlsx** 양식(헤더 행 1줄 + 회색 예시 행 1줄, 헤더 셀 주석에 필수/허용값 안내).
- 응답 200: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` **바이너리 스트림**(봉투 없음). `Content-Disposition: attachment; filename="template-<kind>.xlsx"`.
- 에러: 400 `VALIDATION_ERROR`(알 수 없는 `kind`).
- 양식 헤더 컬럼(임포트 파서와 단일 출처 `excel.columns.ts` 공유):
  - `templates`: `jobLevel`, `category`, `group`, `measureType`, `weight`, `sampleStrategy`
    - 별칭 허용: jobLevel(`직급`/`양식`), category(`핵심전략`/`카테고리`), group(`지표그룹`/`그룹`), measureType(`측정방식`), weight(`가중치`), sampleStrategy(`전략`/`샘플전략`)
  - `org`: `email`, `name`, `department`
    - 별칭 허용: email(`이메일`), name(`이름`), department(`부서`)
  - `achievements`: `kpiId`, `quarter`, `actualValue`
    - 별칭 허용: kpiId(`KPI`), quarter(`분기`), actualValue(`실적`)
- 프론트 `FileDropzone.templateHref`: `/api/v1/excel/template/templates` · `/api/v1/excel/template/org` · `/api/v1/excel/template/achievements`.

#### GET /api/v1/excel/export/audit
- 권한: `hr_admin`. `GET /api/v1/audit-logs`와 **동일 필터 쿼리** 수용: `actorId?, action?, entity?, entityId?, from?(ISO), to?(ISO)`(페이지네이션 없음 — 매칭 전건, `at` 내림차순).
- 응답 200: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` **바이너리 스트림**(봉투 없음). `Content-Disposition: attachment; filename="audit-logs.xlsx"`.
- 컬럼: `일시`(ISO), `행위자`(actorName, 없으면 userId/`시스템`), `이메일`(actorEmail), `액션`(action), `대상엔티티`(entity), `entityId`, `before`(JSON 요약·최대 500자), `after`(JSON 요약·최대 500자).

> 익스포트·양식만 `{data}` 봉투를 사용하지 않는 **예외**(파일 스트림). 임포트 응답은 정상 봉투.

### M2-C2. Notifications — 인앱 + 이메일 (변경/추가)

#### GET /api/v1/notifications
- 권한: 인증된 모든 역할(본인 알림만). 쿼리 `unreadOnly?('true')`.
- 응답 200: `{ data: Notification[], meta }` (createdAt 내림차순)

#### GET /api/v1/notifications/unread-count
- 권한: 인증된 모든 역할
- 응답 200: `{ data: { count: number } }`

#### PATCH /api/v1/notifications/:id/read
- 권한: 본인. 응답 200: `{ data: Notification }`(readAt 기록)
- 에러: 404 `NOT_FOUND`(타인/없음)

#### PATCH /api/v1/notifications/read-all
- 권한: 본인. 응답 200: `{ data: { updated: number } }`

#### POST /api/v1/notifications/generate  *(기존 — emailMode 추가)*
- 응답 201: `{ data: { count, type, emailMode: 'smtp'|'console' } }`

> **이메일 채널:** 알림 생성 시 본인 이메일로 발송 시도. `SMTP_*` env 미설정 시 콘솔 폴백(`emailMode='console'`, 크래시 없음). 트리거: 일정 `deadline_d7/d3/d1`·`kpi_rejected`·`result_finalized`·`appeal_answered`·`appeal_decided`. 모두 `Notification` 레코드로 이력 저장.
> **Notification.type 값(string):** `deadline_d7`/`deadline_d3`/`deadline_d1`/`kpi_rejected`/`result_finalized`/`appeal_answered`/`appeal_decided`. `payload`는 `{ message?, cycleId?, ... }` JSON(없으면 `null`).

### M2-C3. Dashboard (신규)

#### GET /api/v1/dashboard/summary?cycleId?
- 권한: `hr_admin`. cycleId 미지정 시 최신 `active` 주기.
- 응답 200: `{ data: DashboardSummary }`
  ```
  {
    cycleId: string|null,
    cycleName?: string,
    cycleStatus?: CycleStatus,
    progress: {                       // 위젯1: 단계별 제출 진행률
      self:      { total, submitted, finalized, rate },   // rate = 제출률(%)
      downward1: { total, submitted, finalized, rate },   // 1차 팀장
      downward2: { total, submitted, finalized, rate }    // 2차 본부장
    },
    gradeDistribution: {              // 위젯2: 등급 분포
      company: { S, A, B, C, D },
      byGroup: [{ groupId, groupName, grades: { S,A,B,C,D } }]
    },
    unsubmittedCount: number,         // 위젯3: 미제출자 수
    appeals: {                        // 위젯4: 이의제기 현황
      submitted, under_review, answered, closed, total
    },
    avgRaiseRate: number|null         // 위젯5: 전사 평균 인상률(%) — 미산정 시 null
  }
  ```
  주기 없으면 `cycleId=null` + 빈/0 위젯.

### M2-C4. Audit Logs (신규)

#### GET /api/v1/audit-logs
- 권한: `hr_admin`
- 쿼리: `actorId?, action?, entity?, entityId?, from?(ISO), to?(ISO), page?(기본1), pageSize?(기본50, 최대200)`
- 응답 200: `{ data: AuditLog[], meta: { page, pageSize, total } }`

**AuditLog 객체**: `{ id, entity, entityId, action, before: Json|null, after: Json|null, actorId: string|null, actorName: string|null, actorEmail: string|null, ip: string|null, at }`
- 기록 대상 action: `rule_set.create`/`rule_set.update`·`cycle.schedule.update`·`kpi.approve`/`kpi.reject`·`evaluation.submit`/`evaluation.finalize`/`evaluation.overall_grade.override`·`grade_pool.compute`·`appeal.decide`.
