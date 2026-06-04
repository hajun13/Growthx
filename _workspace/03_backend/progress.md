# 백엔드 구현 현황 — v2 도메인 대정정 재빌드

> SSOT: requirements.md(v2) · domain-model.md · business-rules.md · api-backend/SKILL.md
> 작성: backend-engineer / 2026-06-02 (M1 재빌드 + M2)

## 요약
옛 도메인(역량평가·다면평가) 기반 M1 백엔드를 **새 SSOT(순수 KPI/성과 중심)**로 정정 재빌드. 인프라(봉투 인터셉터·RBAC 가드·snake→camel 직렬화·상태전이맵·규칙엔진 골격·health)는 재사용, 도메인만 교체. M2 모듈 5종 추가.

## 핵심 도메인 변경 (반영 완료)
1. **역량평가 삭제** — `Dimension`·`JobCompetencySubtype` enum, `EvaluationItem`·`CompetencyItem` 모델, `competency-items` 모듈 제거. 평가는 `KpiScore`(과제별 성과)로만 구성.
2. **다면 삭제** — `EvaluationType` = `self` + `downward`(round 1 팀장·2 본부장). peer·upward 제거. round 필수 검증(downward).
3. **조직 4단계** — `DepartmentType` = `group`(최상위)/`division`/`team`. seed 트리: 성장그룹 > 사업본부 > 플랫폼팀.
4. **그룹 풀** — `GroupPerformance`(groupId)·`GradePool`(groupId). 풀 검증은 피평가자의 상위 group 으로 resolve.
5. **KPI 분류** — `Kpi.category`(KpiCategory)·`group`(KpiGroup)·`measureType`(MeasureType) 추가. `KpiTemplateItem`도 category/group/defaultMeasureType/defaultWeight 로 재정의.
6. **측정방식별 등급** — `RuleSet.achievementGrades` → `gradingScales`(amount/rate 달성률표). count 임계값은 KPI별 `Kpi.grading`(CountGradeBand[]). qualitative 는 평가자 직접 부여(`directGrade`).
7. **EvaluationResult** — `dimensionGrades`·`multiSource` 제거 → `byType`(self/downward1/downward2) Json. 종합점수 = 2차 본부장 우선 → 1차 팀장 → self(참고).

## A. 계약 (`_workspace/02_contract/contract.md`)
- 변경이력에 v2 항목 추가.
- §4 Departments: type 순서 group|division|team.
- §6 RuleSet: `gradingScales`(측정방식별) 명세, count=Kpi.grading 주석.
- §7 KpiTemplates: item = category/group/sampleStrategy/defaultMeasureType/defaultWeight. `/competency-items` 폐기 명시.
- §8 KPIs: 생성 body·Kpi 객체에 category/group/measureType/grading 추가, 목록 쿼리 group/category.
- §10 Evaluations: PATCH body = kpiScores(achievementRate/directGrade/weight), grade·score 백엔드 산출. EvaluationItem 제거.
- §11 Results: byType(self/downward1/downward2). aggregate 가중 규칙 명시.
- **신규 §12~16(M2):** group-performance · grade-pools · appeals · compensations · notifications 전체 명세.

## B. 스키마·모듈 정정 (`apps/api/`)
- **prisma/schema.prisma** — enum 추가: KpiCategory·KpiGroup·MeasureType. enum 제거: Dimension·JobCompetencySubtype. EvaluationItem·CompetencyItem 모델 제거. Department.type 재정렬. RuleSet.gradingScales. Kpi.category/group/measureType/grading. KpiScore.grade 추가. EvaluationResult.byType. Appeal.respondedById/decision/respondedBy. Compensation `@@unique([userId,cycleId,simulated])`.
  - **마이그레이션 미생성**(기존 migrations 디렉터리 없음) — release 단계에서 `prisma db push`/`migrate` 수행. 스키마 일관성 우선.
- **prisma/seed.ts** — 조직 그룹→본부→팀, 역할별 사용자 5명, RuleSet 2026(gradingScales 포함), KPI 양식 2종(senior_plus·division_head, category/group/measureType), GroupPerformance·GradePool(excellent), 데모 KPI 2건(amount·count grading). 역량 시드 제거.
- **scoring.service** — `measureToGrade`(측정방식 분기) + `rateToGrade`/`countToGrade`, `gradeToScore`, `computeTotalScore`(Σ score×weight/100), `checkPool`(그룹 풀 상한), `achievementRateToTier`(신규), `raiseRateForGrade`. `achievementRateToGrade` 제거.
- **rule-set.types** — `GradingScales`/`RateGradeBand`/`CountGradeBand` 추가, `AchievementGradeBand` 제거.
- **evaluations** — patch: KpiScore 입력→측정방식별 등급/점수 산출→totalScore. EvaluationItem 로직 제거. 코멘트 필수는 downward 한정. 풀 검증은 group resolve + 하위 트리 멤버 수집(round 일치).
- **results** — byType(self/downward round1/round2) 집계, 부서장 가중 최종점수, percentile/companyAvg.
- **kpis / kpi-templates / rule-sets** — DTO·서비스에 category/group/measureType/gradingScales 반영.

## C. M2 모듈 추가
- **group-performance** — 실적 입력(upsert)·tier 자동분류·조회. RBAC: 입력 hr_admin, 조회 hr_admin/division_head.
- **grade-pools** — tier→poolRatios 산정(compute)·조회. RBAC: compute hr_admin.
- **appeals** — 신청(7일 윈도우)·팀장 1차 답변(respond)·HR 최종 결정(decide). 상태전이 submitted→under_review→answered→closed. RBAC + 행수준.
- **compensations** — 확정등급→인상률 산정/시뮬(compute), 전사 평균·3% 초과 경고. RBAC: hr_admin/employee(본인).
- **notifications** — 본인 조회·단건 생성·D-7/D-1/D-3 일괄 생성(generate)·읽음 처리. RBAC.
- app.module 에 5개 모듈 등록, competency-items 제거.

## 규율 준수
- 봉투(`{data}`/`{data,meta}`/`{error}`)·camelCase·RBAC 가드·상태전이맵 유지.
- 점수/등급/풀/인상률/집계 = 전부 백엔드(규칙엔진 경유), 프론트 위임 없음.
- **잔재 0건 확인**: `Dimension|EvaluationItem|competency|peer|upward|multiSource|dimensionGrades|achievementGrades|JobCompetencySubtype|subtype` self-grep 결과 — 기능 코드 0건(schema/seed의 "제거됨" 설명 주석만 잔존).
- 복합 유니크 키 참조 일치 확인(groupId_cycleId / cycleId_groupId / userId_cycleId_simulated / userId_cycleId).

## 알려진 미완성 / 결정 노트
- **빌드 미검증**: 이 머신 Node 미설치 → `prisma generate`·`tsc`·`nest build` 미실행. 정합성은 수동 보장. release 단계에서 빌드·마이그레이션 검증 필요.
- **마이그레이션 파일 없음**: schema 만 정정. 기존 DB 없으면 `db push`, 있으면 파괴적 변경(EvaluationItem 등 drop)이라 release 가 재생성 전략 결정 필요.
- **알림 generate 대상자**: 현재 전 사용자 대상. 실제 cycle 대상자(미입력자/코멘트 미작성자) 좁히기는 후속(스케줄러 없이 수동 트리거).
- **appeals 3일 미응답 HR 자동 알림**: 스케줄러 미구현(요구사항 §8). notifications.generate 로 수동 대체 가능, 자동화는 후속.
- **KPI grading(count) 검증**: 입력 시 형식 검증은 느슨(`IsArray`). 밴드 구조 strict 검증은 후속.
- **users/cycles/achievements 모듈**: 도메인 무관(User/Cycle/Achievement 불변) → 그대로 재사용, 변경 없음.

---

## M2 (2026-06-04) — 신규 4기능 + 미완 완성 + RuleSet 완전 연결

> SSOT: `requirements-m2.md` A~C. 계약 = contract.md 끝 "M2 델타" 절. 빌드(tsc)·prisma generate 통과.

### A. RuleSet 완전 연결
- `scoring.loadRuleSetForCycle`: 주기 RuleSet 미연결 → 글로벌 default(cycleId=null, 최신) 폴백 → 404 제거.
- `cycles.create`: ruleSetId 미지정 시 글로벌 default를 복제해 자동 연결.
- `PATCH /rule-sets/:id`: gradeScale·gradingScales·poolRatios·raiseRates·weightPolicy 전 필드 수용. `scoring.validateRuleSet`(등급 단조성·달성률표·풀 합100·인상률·정성상한) 검증. 변경 시 AuditLog.
- `CreateRuleSetDto`의 `@IsObject` → `@IsDefined`로 수정(gradeScale 배열을 IsObject가 거부하던 잠재 버그). 구조 검증은 scoring 단일 책임.

### B. 미완 완성
- B-1 kpi-templates: GET/:id·PATCH/:id(items 전체 교체·가중치 재검증)·DELETE/:id 추가(hr_admin).
- B-2 schedules: `CycleSchedule` 모델(phase·dueDate·notifyOffsets·notifyEnabled·targetUserIds·targetDeptIds). `GET/PATCH /cycles/:id/schedules`(phase upsert) + AuditLog.
- B-3a: Evaluation.overallGrade/overallReason. PATCH 수용, 오버라이드 시 사유 필수(422), finalize가 오버라이드 우선, AuditLog.
- B-3b: GradePool 응답 headcount(그룹 하위 트리 정원)·caps(등급별 절대 상한)·groupName.
- B-3c: evaluations·results·appeals·grade-pools 응답에 userName·departmentName 비정규화.
- B-3c (D-3 보강): compensations(list·compute) 응답 각 항목에도 userName·departmentName 동봉(User·Department 조인 후 toDto 매핑, 없으면 null). 계약 §15 갱신.
- B-3d: EvaluationResult.byGroup(performance_core·collaboration_growth 각 score·grade). results.aggregate가 group별 가중 집계.

### C. 신규
- C-1 excel: `exceljs`. import/templates·org·achievements(multipart `file`, `{validCount,errorCount,imported,ok,errors[]}`), export/results·distribution·compensation(.xlsx buffer 스트림). hr_admin.
- C-2 notifications: 인앱 list·unread-count·:id/read·read-all + 이메일(`MailService` nodemailer, SMTP_* 미설정 시 콘솔 폴백, 크래시 없음). notifyUser 헬퍼를 kpis.reject·evaluations.finalize·appeals.respond/decide·notifications.generate에서 트리거. 이력은 Notification 레코드.
- C-3 dashboard: `GET /dashboard/summary`(hr_admin) — progress(self/downward1/2)·gradeDistribution(company/byGroup)·unsubmittedCount·appeals·avgRaiseRate 한 응답.
- C-4 audit: `AuditLog` 모델 + `common/audit/AuditService.record`(실패가 트랜잭션 안 깸). `GET /audit-logs`(hr_admin, actor·action·entity·기간 필터·페이지네이션, actorName/actorEmail 동봉).

### 신규 npm 패키지 (apps/api)
- `exceljs@^4.4.0`, `nodemailer@^6.10.1`, `@types/nodemailer@^6.4.23`. (`@types/multer@^2.1.0`는 기존.) package-lock 동기화 완료.

### 검증
- `npm install` → `npx prisma generate`(v5.22) → `npm run build`(nest/tsc) **모두 통과**. seed.ts 타입체크 통과.
- 마이그레이션 디렉터리 없음 → entrypoint `db push` 폴백 유지. seed에 RuleSet 주기연결·kpiTemplate·cycleSchedule·데모 notification 3건·데모 auditLog 포함.

### 새 env (release-engineer)
- `SMTP_HOST`·`SMTP_PORT`·`SMTP_SECURE`·`SMTP_USER`·`SMTP_PASS`·`SMTP_FROM` — 미설정 시 이메일 콘솔 폴백(안전). `.env.example`·`apps/api/.env.example`에 키만 주석으로 존재.

---

## M3 (Items 4-10) — backend-engineer, 2026-06-04

> 회의 녹취록(requirements-m3.md) Items 4-10. Items 1-3(엑셀 일괄등록·초기비번·비직책자 KPI제한)은 별도 에이전트. 동일 `schema.prisma`에 양측 변경이 공존(충돌 없음, 모두 additive).

### 스키마 추가
- 신규 모델 3: `MonthlyPerformance`(월별 실적, `@@unique([cycleId,departmentId,year,month,category])`)·`CompetencyQuestion`·`CompetencyResponse`(`@@unique([questionId,userId,cycleId])`).
- 필드 추가: `CycleSchedule.isLocked Boolean @default(false)`·`User.currentSalary Float?` (Items 1-3가 같은 User에 mustChangePassword·visibilityScope·isActive도 추가 — 공존).
- 검증: `prisma validate` 통과 → `prisma db push`로 실 DB(eval@localhost:5432, docker growthx-db-1) 적용 성공.

### 신규 모듈
- `modules/monthly-performance/` — list/create(upsert)/update/summary. summary가 누적 달성률→Grade(amount 달성률표, ScoringService.measureToGrade)·byCategory·monthlyTrend 산출. 쓰기 RBAC: hr_admin 전체, division_head 본인 본부 하위트리(isDepartmentUnder).
- `modules/competency/` — 질문 CRUD(hr_admin)·응답 bulk upsert(본인, submit→submittedAt)·summary 집계(질문별 등급분포, hr_admin/division_head/team_lead). 컨트롤러 `@Controller()`로 competency-questions·competency-responses 경로 동시 보유.

### 기존 모듈 수정
- `cycles/`: `CycleLockService`(423 PERIOD_LOCKED) 신설·export. `SchedulesService.setLock`(PATCH :id/schedules/:phase)·`currentPhase`(GET :id/current-phase) 추가.
- `kpis/`: CyclesModule import. create/update에서 `assertKpiWritable`(잠금 423)·`assertCategoryWritable`(revenue/construction/orders는 hr_admin/division_head/team_lead만, employee 403).
- `dashboard/`: summary에 groupGrades·teamGoal·monthlyTrend 추가(ScoringService 주입). 가시성 정정 — 비 hr_admin엔 전사 위젯(progress·gradeDistribution·appeals 등) null. 컨트롤러 @Roles 제거(인증 전 역할, service가 가시성 강제).
- `compensations/`: simulation(개인)·simulationTeam(부서 하위트리, meta 합계) 추가. byGrade[] 슬라이더 포함. canViewUser/descendantDeptIds 접근제어.
- `users/`: PATCH :id/salary(hr_admin) + serializer에 currentSalary 노출.
- `group-performance/`: GET my-group(본인 그룹 목표/실적, 인증 전 역할).
- `results/` + `excel/`: GET :userId/export?format=pdf|excel. ExcelModule export→ResultsModule import. excel=xlsx(KPI+역량 2시트), pdf=인쇄용 HTML(text/html, puppeteer 불필요). canViewUser 접근제어.

### app.module
- MonthlyPerformanceModule·CompetencyModule 등록.

### 계약
- `_workspace/02_contract/contract.md` 끝에 "M3 델타 — 백엔드 구현 확정" 추가. 프론트 선반영 절 shape 정정: 잠금 code `LOCKED`→`PERIOD_LOCKED`, MonthlyPerformanceSummary 필드명(totalTarget→targetAmount)·byCategory/monthlyTrend, CurrentPhase(daysRemaining 없음·404 대신 phase=null), CompensationSimulation byGrade[], 대시보드 가시성 null 규칙.

### 검증
- `npx prisma validate` 통과, `npx prisma generate`(v5.22), `npm run build`(nest/tsc) **통과**.
- 정식 마이그레이션 파일 미생성(보류): 동일 schema.prisma를 Items 1-3 에이전트와 동시 편집 중 → migrate dev가 양측 변경을 한 파일에 엮음. db push로 적용·검증만 수행. 오케스트레이터가 양측 안정화 후 `migrate dev --name m3-...` 1회 생성 권장.

### 후속 협의 필요
- 프론트: 위 정정 shape 반영(특히 PERIOD_LOCKED·MonthlyPerformanceSummary 필드명·대시보드 null 가시성). qa-inspector: results export(바이너리/HTML 봉투 예외)·423 잠금·simulation RBAC 경계 검증 요청.

---

## M3 Items1-3 + 조직도 (backend-engineer, 2026-06-04)

### 추가/변경 엔드포인트 (경로 · 권한)
- `POST /auth/change-password` (인증, 강제변경 사용자 허용) · `POST /auth/logout` (인증)
- `POST /excel/import/roster` (hr_admin, multipart) · `GET /excel/template/roster` (hr_admin)
- `GET /users` (인증 전 역할, scope 축소) · `POST /users` (hr_admin) · `PATCH /users/:id` (hr_admin) · `DELETE /users/:id` (hr_admin, soft)
- `GET /org-chart` (인증 전 역할, scope 내)
- `GET /kpi-category-policy` (hr_admin) · `GET /kpi-category-policy/allowed` (인증) · `PATCH /kpi-category-policy` (hr_admin)
- KPI enforcement: `POST /kpis`·`PATCH /kpis/:id`·`POST /kpis/:id/submit` 에 카테고리 허용 422 추가.

### 신규 Prisma 모델/필드/enum + 마이그레이션
- enum `Position` 확장(+vice_president·executive·director·principal, 총 10) · 신규 enum `VisibilityScope`(self/team/division/group/company).
- `User`: `mustChangePassword`(default false)·`visibilityScope`(default self)·`isActive`(default true).
- 신규 모델 `KpiCategoryPolicy`(position unique, allowed Json).
- 마이그레이션 `prisma/migrations/20260604120000_m3_items1_3/migration.sql` — Items1-3 + 타 스트림 누적 델타 포함. fresh `migrate deploy` 통과. (기존 init 마이그레이션은 보존.)

### 임포트 실증 결과 (fresh DB, 실 xlsx)
- `에너지엑스_임직원명부(조직도연동).xlsx` → **validCount=117, errorCount=0**.
- 조직 트리: **그룹 5 / 본부 10 / 팀 24**. IT개발팀(본부 빈값) → 그룹 직속 정상.
- 직급 자동기본: pro→employee/self·mcp=true·jobLevel=senior_minus, ceo→division_head/group, division_head→division_head/division, 인사총무팀→hr_admin/company.
- 멱등: 재임포트 시 validCount=117, 사용자 수 117 유지(증가 없음).
- scope 가드: division_head가 형제 본부 구성원 canViewUser=false, 본인 본부 구성원=true.
- 카테고리: pro 허용=construction·collaboration·development (revenue/orders 차단), division_head=전부.

### FE가 알 계약 핵심 (응답 shape)
- User DTO에 `mustChangePassword`·`visibilityScope`·`isActive` 추가. login/me/change-password 응답 user에 반영.
- 강제변경: 403 코드 `FORCE_PASSWORD_CHANGE` → 비번변경 화면 라우팅. change-password 성공 시 새 토큰 교체 필수.
- roster import 응답: `{ validCount, errorCount, imported, errors:[{row,message}], ok }`.
- org-chart: 회사 가상 루트(`id:'company'`) → 그룹들. 노드 `directCount`/`totalCount`.
- 카테고리 차단: 422 `CATEGORY_NOT_ALLOWED`. 작성 화면은 `GET /kpi-category-policy/allowed?userId=`로 선택지 필터.

### release가 알 점
- entrypoint는 `prisma migrate deploy` 유지 — 신규 마이그레이션 자동 적용됨. (Docker DB가 이미 push로 객체 보유 시 `migrate resolve --applied` 1회 필요했음; fresh 배포는 무관.)
- 실 117명 적재 = **`POST /excel/import/roster` 로 xlsx 업로드**(seed 아님). 데모 seed는 fallback 데모 데이터로 유지(`KpiCategoryPolicy` 기본 10행 upsert 포함).
- 초기 비번 `1234` → 첫 로그인 시 강제 변경. 검증용 hr_admin = 인사총무팀 임포트 계정(또는 데모 hr@energyx.co.kr).
