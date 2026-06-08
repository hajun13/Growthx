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

---

## 2026-06-05 — 보상 현황: 팀 연봉 시뮬레이션 응답 필드 확장 (backend-engineer)

레퍼런스 "보상 현황" 화면 정합을 위해 연봉 시뮬레이션 응답 행에 4필드 추가. 데모 seed 미추가(데이터 연동만, 빈 값 허용).

**변경 파일**
- `apps/api/prisma/schema.prisma` — `User.previousSalary Float? @map("previous_salary")` 추가(전년도 연봉, null=미입력).
- `apps/api/prisma/migrations/20260605010019_add_user_previous_salary/migration.sql` — `ALTER TABLE "users" ADD COLUMN "previous_salary" DOUBLE PRECISION;` (create-only 생성).
- `apps/api/src/modules/compensations/compensations.service.ts` — `buildSimulation`·`simulation`·`simulationTeam` 확장, `divisionNameOf`/`teamNameOf` 헬퍼 추가, user 조회에 `department.parent` include.

**시뮬레이션 행(개인 `simulation` `{data}`·팀 `simulationTeam` `{data,meta}` 동일 shape) 최종 필드**
- `userId: string`
- `userName: string | null`
- `departmentName: string | null`
- `cycleId: string`
- `currentSalary: number | null` (원 단위)
- `currentGrade: 'S'|'A'|'B'|'C'|'D' | null`
- `raiseRate: number | null` (%)
- `projectedSalary: number | null` (원)
- `position: string | null` (Position enum 문자열)  ← 신규
- `previousSalary: number | null` (원, 전년도)        ← 신규
- `divisionName: string | null` (본부명)              ← 신규
- `teamName: string | null` (팀명)                   ← 신규
- `byGrade: { grade, raiseRate, projectedSalary }[]`

**divisionName/teamName 도출 규칙**
- divisionName: dept.type==='division' → dept.name; dept.type==='team' → dept.parent?.type==='division' ? dept.parent.name : null; 그 외 null.
- teamName: dept.type==='team' ? dept.name : null.

**봉투/규약**: 팀 `{data,meta}`(meta 불변), 개인 `{data}`. 등급 S/A/B/C/D 유지(B+ 미도입). 단위 원 유지. RBAC 가드 불변.
**마이그레이션**: DB(localhost:5432) 접속 가능 → `prisma migrate dev --create-only` 로 SQL만 생성(미적용), `prisma generate`로 클라이언트 갱신.
**검증**: `npx tsc --noEmit` → exit 0(에러 0).

## D. 부서장(downward) 평가 자동 배정 (2026-06-05)
- **access.util.ts** `resolveDownwardEvaluators(prisma, evaluateeId)` 추가 — 피평가자 부서부터 parent 트리를 group 까지 상향(최대 깊이 10)하며 각 부서의 '장'을 순서대로 수집. heads[0]=round1, heads[1]=round2. 본인 제외·중복 제거. 헬퍼 `deptHeadUserId`: team→position=team_lead / division→division_head / group→{ceo>vice_president>executive>director} 최상위 1명(직책 우선순위→id 정렬, 결정적). isActive=true만.
  - **그룹 직속 팀 케이스**: 본부(division)가 없으면 그 단계의 장이 없어 자연 패스 → 다음 parent(group)의 그룹장이 round2 로 채워짐. (round1=팀장, round2=그룹장)
- **evaluations.service.ts** `autoAssignDownward(cycleId)` 추가 — 활성 사용자 전원 순회, round1/2 평가자가 있으면 Evaluation(type=downward, round, status=not_started) 생성. **멱등**: 기존 (evaluateeId, round) 키 Set 으로 skip(평가자 동일 여부 무관). 자기 자신 평가자 방지. 생성은 $transaction 배치. 반환 {created, skipped, evaluatees}.
- **트리거**: `cycles.service.updateStatus` 에서 **draft → active** 전이 시 autoAssignDownward 호출. CyclesModule 이 EvaluationsModule 을 import(EvaluationsService export), 단방향 의존이라 forwardRef 불필요.
- **신규 엔드포인트** `POST /evaluations/auto-assign` (@Roles hr_admin, body {cycleId}) — 시드/진행 중 주기 재배정용.
- 스키마 변경 없음(마이그레이션 불필요). tsc --noEmit EXIT=0.

### D-2. 단일 부서장(downward) 캐스케이드로 정정 (2026-06-08)
> 확정 구조: 대표→그룹장→본부장→팀장→팀원, 각자 바로 위 1명이 평가. 중간 레벨이 비면 레벨 스킵(그 위 부서장이 평가). 부서장 평가 = 피평가자 1명당 평가자 1명, 모든 downward `round=1`. **1차/2차 구분 폐기**(round2 생성 안 함). `finalScore` = 단일 부서장 점수. self 는 참고용.
- **access.util.ts** `resolveDownwardEvaluators` (line ~208) — **가장 가까운 부서장 1명만** 수집해 `{ round1 }` 반환(round2 미반환). 트리 상향 중 첫 `deptHeadUserId` 발견 시 즉시 return. 레벨 스킵·본인 제외는 기존 `deptHeadUserId` 동작 그대로. docstring "직속(최근접) 부서장 1명, 레벨 스킵, 본인 제외"로 갱신.
- **evaluations.service.ts** `autoAssignDownward` (line ~205) — round 배열(round1/round2 루프) 제거, `round1` 단건만 처리. 멱등 키 `evaluateeId:1`, $transaction·요약 반환 유지. docstring 갱신.
- **다운스트림(변경 없음·확인 완료)**: `results.service.ts` byType `{self, downward1, downward2, downward3, source}` shape 유지(downward2/3 는 단일 모델에서 빈 항목 null). finalScore 가중 분모 1개(downward1만) → 단일 점수 그대로 통과. `primaryEval` 폴백 round3→2→1→self 가 round1 선택. YoY 임포트 shape `{round1,round2,final}` 무영향. 제출 코멘트 필수(downward division_head/team_lead) 유지.
- `resolveDownwardEvaluators` 호출처는 `autoAssignDownward` 1곳뿐(가시성 등 타 용도 없음). tsc --noEmit EXIT=0.

---

## YoY — 연도 누적(YoY) 평가 비교 (2026-06-05, backend-engineer)

> 계약: `_workspace/02_contract/contract-yoy.md`(델타). 요구사항: `_workspace/00_input/requirements-yoy.md`.

### 스키마 (마이그레이션 `20260605030000_yoy_legacy_results`)
- enum `LegalEntity{energyx,mirae_plan}` · `EmploymentStatus{active,on_leave,resigned}` 신설.
- `User`: `legalEntity`(기본 energyx)·`employmentStatus`(기본 active)·`resignedAt DateTime?` 추가.
- `EvaluationResult`: `groupSnapshot`/`divisionSnapshot`/`teamSnapshot`(String?) 추가 — 당시 조직 스냅샷.
- 라운드별 원형 점수는 기존 `byType` Json 확장: 임포트 결과는 `{round1,round2,final:{perf,comp}, source:"import"}`. 라이브(2026) `{self,downward1,downward2}` 와 키로 공존.
- 모든 신규 컬럼 기본값/널 → 기존 데이터 무해. `migrate deploy` + `prisma generate` 통과.

### 2025 사이클·RuleSet seed (멱등)
- `seed.ts` `seedYoY2025()` — `year=2025` 탐색 upsert. `EvaluationCycle(name:"2025년 정기평가", cycleType:FINAL, status:closed)` + 전용 RuleSet(`weightPolicy.competencyIncluded=false`, `sourcePriority:"import"`). 재실행 안전.

### 과거결과 임포트 (`ExcelService.importLegacyResults`)
- `POST /api/v1/excel/import/legacy-results?cycleId=`(@Roles hr_admin). cycleId 생략 시 2025 자동탐색.
- `평가자정리` 시트: 헤더 4·5행 2단, 데이터 6행~. **위치 기반 파서**(`rawCell` 컬럼 인덱스). 수식 셀 `.result`·리치텍스트·Date·Excel serial·텍스트 날짜 모두 정규화(`toDate`).
- 이름 매칭 3분기: 단일매칭=재직 연결(+legalEntity 엑셀 기준 갱신) / 다중매칭=그룹·본부 보조매칭→여전히 모호하면 검토큐(미적재) / 무매칭=퇴사 User upsert(`isActive=false`, `employmentStatus=resigned`, 결정적 placeholder 이메일 `resigned-{hex}-{hex}@import.local`, departmentId=null·스냅샷만).
- 적재: `(userId,cycleId)` upsert. 원본 finalScore/finalGrade 우선, 없으면 2025 RuleSet 으로 실적 기반 재계산. 멱등(재임포트 시 결과 수·퇴사 User 수 불변).
- AuditService(@Global) 주입 — `cycle.legacy_results.import` 로그.

### 비교 API (`ComparisonService`, results 모듈)
- `GET /results/compare?userId=&cycleIds=` — 개인 연도별 타임라인(year 오름차순). finalGrade/finalScore/percentile/perf/comp/org 스냅샷 + `ruleSummary`(competencyIncluded·gradeScaleLabel·source). 규칙 정규화(S~D·100점 공통축), 규칙차이는 메타로만.
- `GET /results/distribution?scope=group|division|team&deptId=&cycleIds=&legalEntity=` — 사이클별 등급분포(counts/ratios). **조직 스냅샷명 기준** 집계(조직개편 무관). overall + bucket(deptName).
- RBAC: `canViewUser`/`visibleDeptIds` 재사용. compare 타인 userId→403, distribution 권한 밖 deptId→403. hr_admin/company 전체.
- 라우트 순서: `compare`·`distribution` 정적 경로를 `:userId` 보다 먼저 선언(param 캡처 방지).

### 드라이런 (실제 원본 xlsx, 88행)
- 1차: total=88, imported=88, matched=86, createdResigned=2(박준상·권영은), reviewQueue=0, errors=0, legalEntityUpdated=14.
- 2차(멱등): createdResigned=0, EvaluationResult=88 유지, resigned User=2 유지.
- 등급분포: S3·A48·B25·C8·D4 (원본 일치). distribution 그룹별 분포가 `결론` 시트 서술과 일치(친환경기술·엔지니어링 A편중, 건축설계 B편중).
- 빌드: `tsc -p tsconfig.build.json --noEmit` + `nest build` EXIT=0.

### 프론트 주의점
- `byType`는 라이브(self/downward) vs 임포트(round1/2/final) **키 공존** — `byType.source` 또는 키 존재로 분기. 기존 결과 화면 비회귀.
- 역량(comp)은 참고용(연봉·등급 미반영). finalScore/Grade는 실적 기준.
- 퇴사 User는 `/users`(includeInactive 기본 제외)·`/org-chart`(isActive:true)에서 자동 숨김. 비교 화면에서만 퇴사 뱃지(`employmentStatus`).
- enum 값(`energyx`/`mirae_plan`)은 snake_case 그대로 응답(기존 role/position 관례) — 한글 라벨은 프론트 매핑.

---

## 무소속 사용자 + 직급 레지스트리 (계약 `contract-positions-org.md`, 2026-06-05)

### Part A — 무소속 사용자 (조직 선택 옵션화)
- `CreateUserDto.departmentId/managerId`: `@IsOptional() @ValidateIf(!==null) @IsString() @IsNotEmpty()` → 빈 문자열 거부·null 허용. `position`: `@IsEnum(Position)` → `@IsString() @IsNotEmpty()`.
- `UpdateUserDto`: 동일 패턴(명시적 null 로 해제 가능). `position` optional string.
- `users.service.update`: `departmentId: dto.departmentId===undefined ? undefined : dto.departmentId`(managerId 동일) — undefined=변경없음, null=해제.
- `users.service.create`: 직급 기본값을 **레지스트리(PositionDef)에서** 읽음(없으면 400 VALIDATION_ERROR). HR 부서 소속이면 hr_admin/company 오버라이드(departmentId 있을 때만 판정).

### Part B — 직급 enum → 관리형 레지스트리(PositionDef)
- **schema.prisma**: `enum Position` 삭제. `User.position`·`KpiCategoryPolicy.position` → `String`. 신규 `model PositionDef`(code unique·label·sortOrder·isManagement·defaultRole/Scope/JobLevel·isSystem·isActive).
- **마이그레이션** `20260605054309_position_registry`: Prisma 자동생성이 position 컬럼을 DROP/ADD(데이터 손실)로 만들어 **수동 수정** → `ALTER COLUMN position TYPE text USING "position"::text`(무손실) + `DROP TYPE "Position"` + position_defs 생성. kpi_category_policies unique 인덱스는 ALTER TYPE 시 자동 보존되므로 재생성 제거(중복 방지). **적용·검증 완료: 117명 데이터 보존, position=text, enum drop 확인.**
- **position.util.ts**: `export const Position = {...} as const; export type Position = string;`(값+타입 병합). `Record<Position,…>` → `Record<string,…>`. 기존 함수(POSITION_LABEL/KOREAN_POSITION_MAP/defaultRoleScope/deriveJobLevel/isTitleHolder/defaultAllowedCategories)는 시스템 직급 폴백으로 보존.
- **임포트 교체**: `import { Position } from '@prisma/client'` 쓰던 5개 파일(position.util·access.util·user.dto·kpi-category-policy.dto·kpi-category-policy.service)을 position.util 에서 가져오도록 분리. `Position.team_lead` 값 비교는 그대로 동작.
- **excel.service.importRoster**: 라벨→코드 변환 = 레지스트리 label 우선 → KOREAN_POSITION_MAP 폴백. role/scope/jobLevel 도 레지스트리 기본값(HR 오버라이드 유지).
- **kpi-category-policy.service**: `Object.values(Position)` → `prisma.positionDef.findMany({orderBy sortOrder})`. 폴백=isManagement 기준(직책자 전체/비직책자 revenue·orders 차단). label=`def.label ?? POSITION_LABEL ?? code`.
- **seed.ts**: ROSTER 임포트 전 PositionDef 10행 upsert(B-5 표값, isSystem=true). 시드 실행·검증 완료(10행 정확히 일치).

### 신규 모듈 `positions` (`apps/api/src/modules/positions/`)
| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/positions` | 인증 전체 | 목록(기본 isActive=true, `?includeInactive=true` 전체), sortOrder asc. `{data,meta:{total}}` |
| POST | `/positions` | hr_admin | 커스텀 추가. code 자동(label 슬러그→충돌 시 custom_n)/검증(`^[a-z][a-z0-9_]*$`). label·code 중복 409. isSystem=false 고정 |
| PATCH | `/positions/:id` | hr_admin | label/sortOrder/isManagement/defaultRole/Scope/JobLevel/isActive 수정. code·isSystem 불변. label 중복 409 |
| DELETE | `/positions/:id` | hr_admin | isSystem→409 FORBIDDEN, 참조 유저(활성·비활성)→409 IN_USE. 통과 시 PositionDef + 동일 code KpiCategoryPolicy 삭제. 감사로그 |
- AppModule 등록. AuditService(전역) 사용. 응답 camelCase 봉투.

### 빌드·검증
- `npx prisma generate` 성공. `npm run build`(nest/tsc) **EXIT=0**. seed `ts-node` 컴파일·실행 성공.
- `migrate deploy` 적용 후 무손실 검증(117 users, text 컬럼, enum drop, PositionDef 10행).

### 프론트 주의점(Part C 연계)
- `GET /positions` 가 직급 드롭다운·라벨·정렬의 단일 출처. 응답 아이템 키: `id·code·label·sortOrder·isManagement·defaultRole·defaultScope·defaultJobLevel·isSystem·isActive`(camelCase).
- `User.position` 은 여전히 코드 문자열(`'ceo'`…). 라벨은 레지스트리 우선 매핑.
- 무소속 사용자: 생성 시 `departmentId` 생략, 수정 시 `departmentId:null`/`managerId:null` 로 해제.

---

## 보상 인상률 — 그룹 실적 tier 보너스 연동 (2026-06-05)

### 변경
- `compute()` **버그 수정**: 기존 `groupPerformance.findFirst({where:{cycleId}})`(첫 행을 전원에 적용) → 사용자별 `groupRootOf(dept)` → `GroupPerformance(cycleId, groupId).tier` 정확 매칭.
- 공통 헬퍼 `groupTierFor(cycleId, deptId, tierBonusMap, tx?)` 추가 — `{tier, bonus}` 반환. dept/그룹실적 없으면 `{null,0}`.
- `groupTierBonusMap(weightPolicy)` 헬퍼 — `weightPolicy.groupTierBonus` 읽되 기본값 `{excellent:2,standard:0,poor:-1}` 병합.
- `buildSimulation(...)` 에 `tierBonus:number`, `groupTier:GroupTier|null` 인자 추가. `raiseRate`·`projectedSalary`·`byGrade[].raiseRate`·`byGrade[].projectedSalary` 모두 `raiseRateForGrade(grade)+tierBonus` 로 산정. 응답에 `groupTier`·`groupTierBonus` 필드 추가.
- `simulation()`: 대상 user dept 로 tier 산출 후 전달.
- `simulationTeam()`: 그룹실적 1회 조회 → `groupId→tier` 맵 + `deptId→groupId` 캐시로 N+1 방지. user별 보너스 전달. 합계(totalProjectedSalary 등)도 보너스 반영.
- `rule-set.types.ts WeightPolicy.groupTierBonus?` 1급 필드로 명시.
- `scoring.validateRuleSet`: groupTierBonus 제공 시 각 tier 값 숫자(음수·소수 허용) 가벼운 검증.

### 미변경(의도)
- rule-sets API(list/get/create/update)는 손대지 않음. `weightPolicy.groupTierBonus` PATCH → 그대로 저장.
- 응답 봉투/camelCase/트랜잭션 패턴 유지.

### 검증
- `npx tsc --noEmit -p tsconfig.json` **EXIT=0** (에러 0).

### 프론트 주의점
- 시뮬 응답에 `groupTier`(excellent|standard|poor|null)·`groupTierBonus`(number) 추가. `byGrade[].raiseRate`/`projectedSalary` 는 이미 tier 보너스 포함 — 프론트 재계산 금지.

---

## YoY 2차 — 전년도 연봉 자동 파생 (2026-06-05, backend-engineer)

### 스키마/마이그레이션
- `Compensation.baseSalary Int? @map("base_salary")` 추가(additive, NULL 허용). 그 사이클의 연봉 산정 기준(=확정 시점 currentSalary). 다음 사이클 전년도연봉 파생 소스.
- 마이그레이션 `20260605060000_add_compensation_base_salary` 생성·`migrate deploy` 적용·`prisma generate` 완료.

### 파생 규칙 (compensations.service.ts)
- `derivePreviousSalary(userId, currentCycleYear, manualFallback)` (단건) / `deriveTeamPrevSalaryMap(userIds, year, manualByUser)` (일괄, N+1 방지) / `resolvePrevSalary(prior, manual)` (공통 우선순위) / `cycleYearOf(cycleId)`.
- 우선순위: 직전 사이클(year<현재 중 최대, simulated=false Compensation 존재) `baseSalary`→`derived` / `nextYearSalary`→`carryover` / `User.previousSalary`→`manual` / `null`→`none`.
- 일괄: user별 직전 simulated=false Compensation 을 `cycle.year desc` 1쿼리로 조회 → 첫 행 채택 → 맵. (직전 사이클 1회 탐색 + Compensation 일괄.)

### 적용처
- `list`: 사이클별로 묶어 `deriveTeamPrevSalaryMap` 호출 → 행별 prev 주입. `toDto(r, prev)` 가 `previousSalary`·`previousSalarySource`·`baseSalary` 출력.
- `simulation`(개인): `derivePreviousSalary` 로 파생 → `buildSimulation` 에 value+source 전달.
- `simulationTeam`: 전원 일괄 파생(N+1 방지) → user별 prev 주입.
- `compute`(persist): upsert create/update 에 `baseSalary = round(currentSalary)` 기록(simulated 무관). 체이닝 시작점.
- `buildSimulation`: `previousSalarySource` 인자·응답 필드 추가.

### 검증
- `npx tsc --noEmit` EXIT=0, `npx nest build` EXIT=0, `prisma generate`/`migrate deploy` OK.

### 프론트 주의점
- `previousSalary` 의미 변경: 수기값 → **파생값**(수기 fallback). 필드명·타입·봉투·RBAC 불변, 값 출처만 변경.
- 신규 `previousSalarySource: 'derived'|'carryover'|'manual'|'none'` — UI 배지/툴팁(예: 'derived'=직전 사이클 자동, 'manual'=수기, 'none'=미상). list·simulation·simulation-team 모두 포함.
- `baseSalary`(number|null)는 list 응답에 추가(시뮬 응답엔 없음). 프론트 재계산 금지 — 파생은 전부 백엔드.
- 2025(연봉 컬럼 없는 사이클): previousSalary=null·source='none' 정상. 2026↑ compute 후 자동으로 derived 채워짐.

---

## 사용자 라이프사이클 (퇴사·복직·하드삭제 2모드) — 2026-06-05

> SSOT: requirements-userlifecycle.md · 계약: 02_contract/contract-userlifecycle.md

### 엔드포인트(신규/변경)
- `PATCH /users/:id/resign` (hr_admin) — 신규. employmentStatus=resigned·resignedAt=now()(보존)·isActive=false. 멱등. 본인 403. 감사 user.resign.
- `PATCH /users/:id/reactivate` (hr_admin) — 신규. employmentStatus=active·resignedAt=null·isActive=true. 감사 user.reactivate.
- `DELETE /users/:id (?force=true)` (hr_admin) — **의미 변경**: soft-deactivate → 하드삭제 2모드.
  - 공통전제: isActive=true→409, 본인→403, 마지막 활성 hr_admin→409.
  - 기본: 평가이력 카운트(11종)>0 → 409+details. 0이면 notifications삭제·auditLog SetNull·reports.managerId=null·삭제. `{data:{id}}`.
  - force: 트랜잭션 cascade 완전삭제. `{data:{id,purged:true}}`. 감사 user.purge.

### 삭제 차단·cascade 로직
- countHistory(): results·evaluations(evaluator+evaluatee)·kpis·compensations·appeals·competencyResponses·monthlyPerformances·kpiSnapshots·reviews·comments·competencyQuestions.
- purge 순서: comments(author)→reviews(author)→appeals(respondedBy/decidedBy SetNull→userId 삭제)→evaluations(evaluator|evaluatee; KpiScore·Comment cascade)→results→compensations→kpis(parentKpiId SetNull→삭제; Achievement·Review·KpiScore cascade)→competencyResponses→competencyQuestions→monthlyPerformances→kpiSnapshots→notifications→auditLog SetNull→reports.managerId=null→user.
- 스키마 변경 없음(enum EmploymentStatus·resignedAt 기존). 마이그레이션 불필요.

### serializer 변경
- toUserDto: legalEntity·employmentStatus·resignedAt **추가**(기존 필드 불변, 비회귀).

### 빌드
- tsc --noEmit 통과, nest build EXIT=0.

### 프론트 주의점
- DELETE 의미가 하드삭제로 변경됨 — 기존 "비활성화했어요" 호출부는 resign 또는 PATCH(isActive:false)로 전환 필요.
- User 타입에 legalEntity·employmentStatus·resignedAt 추가. 409 details는 [{key,count}] 배열.

## 전역 검색 (2026-06-05)
- 신규 모듈 `modules/search` (controller·service·dto) + app.module 등록.
- `GET /api/v1/search?q=&limit=` → `{ data: { users, departments } }`. 사용자=name·email contains, 부서=name contains.
- 가시 범위: `applyUserScope`(사용자)·`visibleDeptIds`(부서)로 축소 — RBAC 우회 불가.
- tsc --noEmit 통과(api·web). 프론트 NavSearch(명령 팔레트)에서 디바운스 200ms·2글자↑ 호출, 메뉴 검색은 클라이언트.

## 개인별 KPI 엑셀 일괄 임포트 (2026-06-05)

SSOT: `_workspace/02_contract/kpi-import-contract.md`. 9개 실제 양식으로 파서 검증 후 구현.

### 스키마
- `Kpi.targetText String? @map("target_text")` + `Kpi.gradingCriteria Json? @map("grading_criteria")` 추가(둘 다 nullable, 기존 데이터 안전).
- 마이그레이션: `apps/api/prisma/migrations/20260605073627_kpi_qualitative_grading/migration.sql` (DB 적용·prisma generate 완료, 라이브 DB 컬럼 존재 확인).

### 파서(위치 기반, excel.service)
- `pickKpiSheet`: 정규화 `includes('개인별KPI작성')` → `(2)` 변이 시트(류정미) 포괄, 못 찾으면 첫 시트.
- 데이터 8행~. C열(핵심전략) 매핑 실패 행은 데이터 끝/안내문/합계행으로 skip(에러 아님).
- 매핑 `KPI_CATEGORY_MAP`: 정규화(공백·`&` 제거) 후 includes. **계약 §2 표 보완**: orders 키에 `업무수행`·`업무수행평가` 스템 추가(실양식 변이 — 김수성·최선영 2파일이 '업무수행평가' 사용, 미추가 시 6개 행 누락). → 계약 변경통지 필요(api-contract-convention §6).
- 가중치: H~K(8~11) 첫 비0·비'-' 값 ×100 반올림 정수. measureType=qualitative·isQualitative=true·targetValue=null·targetText=F열·gradingCriteria=L~P({S..D}, '-'/빈칸 제외).

### 파서 검증 결과(9파일)
| 파일 | 시트 | KPI행 | weightSum |
|---|---|---|---|
| 권영은 | 개인별 KPI작성 | 0 | 0 |
| 최선영책임 | 개인별 KPI작성 | 8 | 80 |
| 정재훈 팀장 | 개인별 KPI작성 | 6 | 100 |
| 진희선 프로 | 개인별 KPI작성 | 6 | 100 |
| 어라윤선임 | 개인별 KPI작성 | 5 | 100 |
| 김수성프로 | 개인별 KPI작성 | 6 | 90 |
| 류정미 | 개인별 KPI작성 (2) | 5 | 100 |
| 장한샘프로 | 개인별 KPI작성 | 5 | 100 |
| 경영기획팀 | 개인별 KPI작성 | 9 | 130 |
- **권영은 = 0행(알려진 한계)**: 구버전 레이아웃(핵심전략 C열 없음, 헤더 2~4행, 가중치 G단일열, 카테고리=채권회수·M&A 등 도메인 미매핑). 계약 §1 표준 양식(5~7행 헤더·C=핵심전략)과 불일치 → 매핑 실패로 전 행 무시. 표준 양식 재제출 필요. (계약상 "미매칭=무시" 정상 동작이나 적재량 0.)
- weightSum<100(최선영 80·김수성 90): 가중치가 직급별 단일열(H/I/J/K 중 하나)에만 있고 본인 해당 열 합이 100 미만 — warning만(차단 X). 경영기획팀 130%=팀 마스터템플릿(4열 모두 채움, 첫칸 H 합산) → warning.
- 라이브 DB 통합 테스트(어라윤 파일): 트랜잭션 5행 적재→read-back에서 targetText·gradingCriteria(S~D)·qualitative·targetValue=null·weight 정상→삭제 정리 통과.

### 엔드포인트(@Roles(hr_admin), FileInterceptor('file'), 봉투 {data})
- `POST /excel/import/kpi/preview` — body file. 적재 안 함. 응답 `{data:{fileName,rows[],validCount,errorCount,weightSum,errors[]}}`. rows 항목: `{category,group,csf,title,targetText,measureMethod,weight,gradingCriteria,valid,message}`.
- `POST /excel/import/kpi?userId&cycleId` — userId 필수(없으면 400), cycleId 생략 시 status=active 사이클(없으면 400), 대상 user 없으면 404. 멱등: 트랜잭션에서 (userId,cycleId) status=draft 삭제 후 생성. validateWeights 우회(합은 warning). 감사 `kpi.import`. 응답 `{data:{ok,userId,cycleId,imported,deletedDrafts,weightSum,errors[],warnings[]}}`.
- 경로 prefix 는 글로벌 `/api/v1` (기존 excel 라우트와 동일).

### DTO/직렬화·감사
- CreateKpiDto/UpdateKpiDto: `targetText?:string`, `gradingCriteria?:Record<string,string>` optional 추가 + kpis.service create/update 통과(향후 사이트 작성 대비).
- KPI list/get 은 Prisma 모델 직반환(serializer·select 제한 없음) → 신규 필드 자동 노출.
- AUDIT_ACTION_LABEL 에 `'kpi.import':'KPI 일괄 등록'` 추가. (프론트 lib/ui.ts 동기화는 프론트 담당)

### 미완/생략
- 빈 양식 다운로드(`GET /excel/template/kpi`) 생략: 병합 2단 헤더라 기존 buildTemplate(단일 헤더) 불가, 별도 빌더 필요. 계약 §4-3 우선순위 낮음 → "회사 표준 양식 사용" 안내로 대체.
- 프론트 업로드 화면(§5)·QA(§7)는 각 담당.

### 빌드
- `cd apps/api && npx tsc --noEmit` 통과(에러 0).

---

## 개인별 KPI 파서 — 헤더 기반 동적 열 매핑 재작성 (2026-06-05)

**문제:** 기존 `parseKpiSheet`/`extractKpiWeight`/`extractGradingCriteria` 가 고정 위치(가중치 8~11, 등급 12~16, 데이터 8행~) 라 양식 레이아웃 변이에서 등급기준이 엉뚱한 칸에서 읽혀 S~D 가 깨짐. 실측 3종 레이아웃 확인:
- 변형A(16열): 가중치 H~K 4칸, 등급 L~P(12~16). 헤더 5행.
- 변형B(14열): 가중치 H 단일칸(8), 등급 I~M(9~13). 헤더 5행. → **기존 파서가 등급을 12~16 에서 읽어 전부 깨짐**(예: 장한샘프로).
- 구버전(12열): 좌측 패딩 없음(카테고리 2열), 가중치 7, 등급 8~12, **헤더 2행**. → 기존 파서 완전 오작동.

**수정:** `apps/api/src/modules/excel/excel.service.ts`
- 신규 `detectKpiColumns(ws)` (약 L824~) — 1~8행에서 '핵심전략'+('성과관리지표/KPI'|'측정방식') 있는 행을 헤더 상단행으로 탐지 → 상단행 텍스트로 category/csf/title/targetText/measureMethod 열 매핑, 상단행='가중치' 열 집합(병합1칸~4칸) 수집, 하위행(상단행+1)이 정확히 S/A/B/C/D 인 열로 등급기준 매핑. dataStart=headerRow+2.
- `extractKpiWeight(ws,row,weightCols)` — 동적 가중치 열 집합 중 첫 비0 숫자칸 ×100.
- `extractGradingCriteria(ws,row,grading)` — 동적 등급 열 매핑으로 {S..D} 텍스트.
- `parseKpiSheet` — detectKpiColumns 사용, 헤더 미탐지 시 row:0 에러. 응답 shape/필드 불변(계약 kpi-import-contract 유지).
- `normHeader` 헬퍼 추가(헤더 텍스트 공백·개행 제거 정규화).

**9파일 검증표 (행수 / weightSum / grading 정합):**

| 파일 | 레이아웃 | 헤더행 | 가중치열 | 등급열(S..D) | 행수 | weightSum | grading |
|---|---|---|---|---|---|---|---|
| 권영은 | 구버전12열 | 2 | 7 | 8~12 | 2 | 20 | 정합* |
| 최선영책임 | 변형A | 5 | 8~11 | 12~16 | 8 | 80 | 정합 |
| 정재훈 팀장 | 변형A | 5 | 8~11 | 12~16 | 6 | 100 | 정합 |
| 진희선 프로 | 변형A | 5 | 8~11 | 12~16 | 6 | 100 | 정합 |
| 어라윤선임 | 변형A | 5 | 8~11 | 12~16 | 5 | 100 | 정합 |
| 김수성프로 | 변형A | 5 | 8~11 | 12~16 | 6 | 90 | 정합 |
| 류정미 | 변형A | 5 | 8~11 | 12~16 | 5 | 100 | 정합 |
| 장한샘프로 | **변형B** | 5 | **8(단일)** | **9~13** | 5 | 100 | **정합(기존 깨짐→수정)** |
| 경영기획팀 | 변형A | 5 | 8~11 | 12~16 | 9 | 130 | 정합 |

원본 셀 대조 확인:
- 장한샘프로 R8: col8=0.25(→25), col9~13 = "요청 일정 기준 100% 대응"/"95% 이상 대응"/"90% 이상 대응"/"85% 이상 대응"/"85% 미만" → gradingCriteria.{S,A,B,C,D} 정확 일치.
- 권영은 R9~R10: col7=가중치, col8~12=S~D 값 정확 매핑(헤더 2행 자동 탐지).

**한계:**
- *권영은: 헤더 탐지·열 매핑은 정상이나, 비표준 핵심전략(운전자본효율화/내부관리체계확립/경영안정화/M&A)이 KPI_CATEGORY_MAP 5종(매출/공정/수주·업무수행/협업/자기개발)에 없어 자기개발 2행만 적재됨. category 매핑 SSOT 한계이며 파서 버그 아님. 해당 전략 적재가 필요하면 계약 §2 매핑표 확장 통지 필요.
- 경영기획팀 weightSum=130: 행마다 가중치 4칸이 모두 채워진 양식(미완성/직급분리 미정리)이라 첫 칸 채택 후 합이 100 초과. 원본 데이터 이슈(파서는 규약대로 첫 비0칸 채택). 임포트 시 weightSum≠100 경고로 노출됨.
- 가중치 다칸일 때 "첫 비0칸"을 택함(계약 §1 규약). 직급별 정확 선택은 대상자 직급 컨텍스트 필요 — 향후 개선 여지.

**빌드:** `cd apps/api && npx tsc --noEmit` → exit 0.

---

## 2026-06-08 — KPI 일괄 임포트: 편집 행 적재(commit) + 정성/정량 제안

**배경:** 시범운영 — 관리자가 미리보기에서 ①각 KPI 정성/정량 토글 ②엑셀 누락분 보완한 뒤 *편집된 행 그대로* draft 적재 필요. 기존 `POST /excel/import/kpi`는 파일 재파싱이라 화면 편집 미반영.

**신규 엔드포인트:** `POST /excel/import/kpi/commit` (hr_admin, **JSON body**, multipart 아님).
- DTO: `apps/api/src/modules/excel/dto/kpi-import-commit.dto.ts` — `KpiImportCommitDto`(userId 필수·cycleId?·fileName?·rows[]) + `KpiImportCommitRowDto`(category/group/csf?/title/targetText?/measureMethod?/weight 0~100/isQualitative/gradingCriteria?) + `KpiImportGradingCriteriaDto`(S~D? nullable). class-validator + `@ValidateNested`+`@Type`(전역 ValidationPipe transform:true).
- service `commitKpi(dto, actorId)`: importKpi의 멱등 트랜잭션·audit·결과 shape 재사용. (userId,cycleId) draft 삭제 후 rows 생성. `measureType=qualitative` 상수, `isQualitative=row.isQualitative`(토글값), `targetValue=null`. title 빈 행 스킵+warning, weightSum≠100 warning(차단 안 함), validateWeights 우회. csf/targetText/measureMethod 빈칸→null, gradingCriteria 빈칸·'-'·null 제거. audit `action:'kpi.import.commit'`(라벨 'KPI 일괄 등록(편집 적재)').
- 응답 data = 기존 `KpiImportResult` 동일: `{ok,userId,cycleId,fileName,imported,deletedDrafts,weightSum,errors,warnings}`. 봉투 `{data}`.

**리팩터:** importKpi/commitKpi 공용 `resolveImportTarget(userId,cycleId)` private 헬퍼 추출(사용자 존재·활성 + 사이클 결정·400/404). importKpi 중복 제거.

**미리보기 보강:** `parseKpiSheet` 행 + previewKpi 응답 rows에 `isQualitative:boolean` 추가. 휴리스틱 `suggestQualitative(gradingCriteria)` — 등급기준(S~D) 텍스트에 수치 토큰(`/[%]|\d+\s*(건|일|억|회|개|점|명|원|만|천)|\d/`) 없고 서술만이면 true, 그 외/빈칸은 보수적 false. **제안값일 뿐** — 관리자 화면 토글로 override → commit으로 반영.

**하위호환:** `POST /excel/import/kpi`(파일 재파싱·isQualitative=true 하드코딩) 유지.

**계약:** `_workspace/02_contract/kpi-import-contract.md` §4-4(commit) + §4-1 isQualitative 기재.

**빌드:** `cd apps/api && npx tsc --noEmit` → exit 0.
