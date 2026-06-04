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
