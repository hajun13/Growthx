# QA Report — M2 (신규 4기능 + RuleSet 완전연결 + 미완완성 + 이연 백로그)

> 작성: qa-inspector · 2026-06-04 · 방법: BE↔FE 양쪽 동시 읽기(정적 교차검증) + Node 빌드 재확인
> 기준 SSOT: `_workspace/02_contract/contract.md` (M2 델타 절) · `_workspace/00_input/requirements-m2.md` · references/{domain-model,business-rules,api-contract-convention}.md

## 게이트 판정: **PASS (조건부)**

Blocker 0건. Major 1건(B-3b 소비자 미연결), Minor 2건. Major는 릴리스 차단 요소가 아니라 "이연 백로그 미완"이며 데모 동작에는 영향 없음(잘못된 라벨 표시일 뿐). 리더 판단으로 즉시 수정 후 릴리스 권장.

빌드: `apps/api` `nest build` 성공(exit 0) · `apps/web` `next build` 성공(exit 0).

---

## 결함표

| # | 심각도 | 영역 | 요약 | 수정 주체 |
|---|--------|------|------|-----------|
| D-1 | **Major** | B-3b 경계면 | GradePool `headcount`/`caps`(절대 인원) BE 제공하나 FE가 무시하고 `sRatio`(%) 재가공 표시 | FE |
| D-2 | Minor | C-1 스코프 | `/excel/import/org`·`/excel/import/achievements` BE+lib 존재하나 렌더하는 FE UI 없음(죽은 엔드포인트) | FE |
| D-3 | Minor | 잔여 추정 | compensation 페이지 `userId.slice(0,8)` 표시(Compensation에 userName 비정규화 없음 — 계약 한계) | (계약/리더 확인) |

---

## 1. 응답 봉투 · unwrap · camelCase  — PASS

- 전역 `EnvelopeInterceptor`(`apps/api/src/common/interceptors/envelope.interceptor.ts`)가 `{data}` 없는 페이로드만 래핑, 이미 `{data}`/`{data,meta}`면 통과. 서비스들이 직접 `{data, meta}` 반환(dashboard·audit-logs·notifications.list·schedules·rule-sets.list) → 이중 래핑 없음.
- **엑셀 스트림 예외 정합 OK:** `excel.controller.ts`의 export/template 핸들러는 `@Res() res` + `res.send(buf)`로 인터셉터를 우회(봉투 없음). FE는 `lib/excel.ts:downloadExcel`(blob) / `ExportButton` / `FileDropzone.downloadTemplate`로 수신 — `apiGet` 오용 없음. 확인: `dashboard`(results), `reports`(distribution), `admin/compensation`(compensation), `admin/audit`(audit) 전부 `ExportButton path` 사용.
- **import 응답 shape 1:1 OK:** BE `excel.service`의 3개 import 메서드 전부 `{ data:{ validCount, errorCount, imported, errors, ok } }` 반환. FE `lib/types.ts:ImportResult`(`validCount,errorCount,imported,ok,errors[]`) 1:1. `errors[]={row,message}` 일치. `FileDropzone`가 `result.validCount/errorCount/ok/errors` 직접 소비.
- camelCase: 신규 응답 전 필드 camelCase(audit-logs는 snake `userId`→`actorId` 매핑까지 service에서 처리, `before/after`는 raw JSON 의도).

## 2. 신규 엔드포인트 ↔ 훅 1:1  — PASS

| 엔드포인트 | BE 위치 | FE 훅/소비 | 판정 |
|-----------|---------|-----------|------|
| `GET /dashboard/summary` | dashboard.controller/service | `useDashboard` → `DashboardSummary` | OK(5위젯 필드·progress.self/downward1/downward2·gradeDistribution.company/byGroup·unsubmittedCount·appeals·avgRaiseRate 전부 1:1) |
| `GET /notifications`(+unreadOnly) | notifications.controller | `useNotifications` | OK |
| `GET /notifications/unread-count` | " | `useUnreadCount` → `{count}` | OK |
| `PATCH /notifications/:id/read` | " | `notificationCommands.read` | OK |
| `PATCH /notifications/read-all` | " | `notificationCommands.readAll` → `{updated}` | OK |
| `POST /notifications/generate` | " | `notificationCommands.generate` → `{count,type,emailMode}` | OK |
| `GET /audit-logs` | audit-logs.controller | `useAuditLogs` → `{data,meta}` | OK(before/after·actorName·actorEmail·actorId·at 1:1) |
| `PATCH /rule-sets/:id`(전필드) | rule-sets.controller | `ruleSetCommands.update` | OK |
| `GET/POST/PATCH/DELETE /kpi-templates(/:id)` | kpi-templates.controller | `useKpiTemplates`/`useKpiTemplate`/`kpiTemplateCommands` | OK |
| `GET/PATCH /cycles/:id/schedules` | cycles.controller→schedules.service | `useSchedules`/`scheduleCommands.upsert` | OK(PATCH는 `{data,meta}` 반환, FE `apiPatch<CycleSchedule[]>`가 `json.data` 배열 unwrap — 정합) |
| `PATCH /evaluations/:id`(overallGrade) | evaluations.controller | `evaluationCommands.patch` | OK |

죽은 훅/죽은 엔드포인트: **D-2(import org/achievements) 외 0건.**

## 3. 이연 백로그 4건  — 3/4 PASS, 1건 Major

- **B-3a overallGrade(사유필수 422):** **PASS.** BE `evaluations.service.patch:166` overallGrade && !overallReason → 422 VALIDATION_ERROR. `finalize:306` overallGrade 우선 적용. FE `eval/dept-head/page.tsx:141` 클라 가드 + `:172` overallGrade 있을 때만 overallReason 동봉. 양쪽 일치.
- **B-3b GradePool headcount·caps:** **FAIL(D-1, Major).** 아래 상세.
- **B-3c userName/departmentName:** **PASS.** BE evaluations/results/appeals/grade-pools `toDto`가 동봉. FE `reports`/`appeals`/`dept-head`는 `r.userName ?? id.slice(0,8)`(폴백만 slice) — 추정 제거 완료.
- **B-3d EvaluationResult.byGroup:** **PASS.** BE `results.service.aggregate:194` byGroup 집계 저장. FE `eval/result/[userId]/page.tsx:197-203` `byGroup.performance_core`/`collaboration_growth` 3박스 소비(null 가드).

### [FAIL] D-1 — GradePool caps 소비자 미연결 (Major)
```
생산자: apps/api/src/modules/grade-pools/grade-pools.service.ts:92-116
        toDto가 headcount(그룹 하위 트리 정원) + caps:Record<Grade,number>(절대 인원 상한, ceil(ratio% × headcount)) 동봉 — 계약/요구 B-3b 충족.
소비자: apps/web/app/(main)/admin/group-performance/page.tsx:133-144
        useMemo로 caps를 pool.sRatio/aRatio/...(비율 %)로 재구성. 코드 주석에
        "그룹 인원 미상이므로 100명 기준 예시 분포 표시" — BE가 준 pool.headcount·pool.caps를 무시.
        :248-259 DistributionBarChart total={100} + "S {ratio}%" 라벨 → 절대 인원 아님.
영향: "FE 추정 계산 제거, 백엔드 값 표시"(req B-3b) 미충족. 데모 동작엔 영향 없으나 표기가 비율(%)이라 정원 기반 절대 상한이 화면에 드러나지 않음.
수정(FE): pool.headcount·pool.caps를 직접 사용.
  const caps = pool ? pool.caps : undefined;            // 절대 인원
  <DistributionBarChart counts={...} caps={pool.caps} total={pool.headcount} ... />
  라벨도 `${g} ${pool.caps[g]}명 / 정원 ${pool.headcount}명` 형태로.
  (lib/types.ts:GradePool에 headcount·caps 이미 정의돼 타입 변경 불필요.)
```

## 4. RuleSet 완전연결  — PASS

- settings 5필드 편집: `admin/settings/page.tsx` + `RuleSetEditor`가 gradeScale·gradingScales(amount/rate)·poolRatios(tier×등급)·raiseRates·weightPolicy 전부 편집. `ruleSetCommands.update`가 5필드 PATCH.
- BE 검증: `rule-sets.service.update`→`scoring.validateRuleSet`(부분 PATCH, 제공 필드만: gradeScale 단조성·gradingScales 비어있음/단조·poolRatios tier합100·raiseRates 전등급·weightPolicy 0~100). 감사로그 `rule_set.update`(before/after) 기록.
- 폴백: `scoring.loadRuleSetForCycle`(주기 RuleSet 없으면 글로벌 default cycleId=null 폴백→404 제거) · `cycles.service.create`(ruleSetId 미지정 시 글로벌 default **복제 연결**).
- 하드코딩 0: scoring 전 산정(measureToGrade·scoreToGrade·checkPool·raiseRateForGrade)·excel import 검증·grade-pools·results·evaluations 모두 `loadRuleSetForCycle` 경유. 상수 박힘 없음.

## 5. 라우팅  — PASS

- 신규 page 존재: `(main)/dashboard`·`(main)/notifications`·`(main)/admin/audit` 전부 `page.tsx` 존재. route group `(main)` 접두사는 URL에서 제거 → `/dashboard`·`/notifications`·`/admin/audit` 정상.
- `nav.ts`: dashboard/audit/settings/compensation roles=`['hr_admin']`, group-performance=`['hr_admin','division_head']` 등 계약 RBAC와 정합. 모든 href가 실제 page와 매칭.
- 로그인 후 랜딩: `nav.ts:landingPath` hr_admin→`/dashboard`, 그 외→`/eval`.
- 알림 클릭 이동(`lib/ui.ts:notificationHref`) 경로 전부 실존(`/eval`,`/kpi`,`/eval/result`,`/appeals`).

## 6. 상태전이 · RBAC · 감사로그  — PASS

- 신규/변경 mutation 엔드포인트 가드 전수 확인: kpi-templates POST/PATCH/DELETE·grade-pools `compute`·group-performance POST·rule-sets PATCH·cycles `:id/schedules` PATCH·dashboard·audit-logs·excel(클래스레벨 `@Roles(hr_admin)`) 모두 `@Roles` 부착. **무방비 mutation 0건.**
- 행수준 소유권: notifications(본인 userId)·evaluations(assertEvaluator+canViewUser)·results(canViewUser)·appeals(본인) service 단 구현.
- 상태전이: `evaluation.submit`(in_progress→submitted, 코멘트필수 422·POOL_EXCEEDED 422)·`finalize`(submitted→finalized, assertTransition) 실제 구현. KPI approve/reject/confirm 유지.
- 감사로그 트리거: BE가 계약 명시 9개 action 전부 기록 — `rule_set.create/update`·`cycle.schedule.update`·`kpi.approve/reject`·`evaluation.submit/finalize/overall_grade.override`·`grade_pool.compute`·`appeal.decide`. AuditService 기록 실패 시 본 트랜잭션 보호(try/catch).

## 7. enum 양쪽 일치  — PASS

- **AuditAction 표기 통일 확인됨:** BE 기록값·FE `lib/ui.ts:auditActionLabel` 키 모두 **점(.)표기** `rule_set.update`(언더스코어 `ruleset_update` 아님). FE 필터 드롭다운이 점표기 값을 `?action=`으로 전송 → BE `where.action` 정확 매칭. (FE 보고서가 지적했던 불일치 우려 해소.)
- notification type: BE `subjectForType`/generate(`deadline_${kind}`)·FE `notificationStyle` 7개 문자열(`deadline_d7/d3/d1`,`kpi_rejected`,`result_finalized`,`appeal_answered`,`appeal_decided`) 일치.
- schedule phase: BE 자유문자열·FE `schedulePhaseLabel`+`DEFAULT_PHASES`(prep/self/downward1/downward2/result) 일치, upsert unique `cycleId_phase`.
- jobLevel: BE `JobLevel`(division_head/team_lead/senior_plus/senior_minus)·FE `JobLevel` 타입+`jobLevelLabel` 일치.
- auditEntity: BE 기록 엔티티(RuleSet/EvaluationCycle/Kpi/Evaluation/GradePool/Appeal)·FE `auditEntityLabel` 일치.

## 8. placeholder / 죽은 버튼 잔재  — 1건 Minor

- settings 3탭(rules/templates/schedule): placeholder 문구 없음. RuleSetEditor·TemplateEditor·ScheduleEditor 실제 렌더+저장. KPI 양식 엑셀 일괄등록 모달(import/templates) 동작.
- **[FAIL] D-2 (Minor) — org/achievements 임포트 UI 미렌더:**
```
생산자: apps/api/src/modules/excel/excel.controller.ts:48-60 (importOrg·importAchievements) + excel.service 구현 완료
        apps/web/lib/excel.ts:uploadExcel 가 임의 경로 지원(org/achievements 호출 가능)
소비자: 없음. grep 결과 FE 어디에도 `/excel/import/org`·`/excel/import/achievements` 렌더 트리거 없음.
        settings는 templates 임포트만 렌더.
판정: 요구 C-1 "조직/대상자·KPI 실적 일괄 업로드" 부분 미충족. 두 엔드포인트는 도달 가능하나 UX상 죽은 엔드포인트.
수정(FE): settings(또는 group-performance/실적 화면)에 FileDropzone 2개 추가 —
  templateHref `/excel/template/org`·`/excel/template/achievements`,
  onSelect → uploadExcel('/excel/import/org'|'/excel/import/achievements', file).
  (template/:kind는 org·achievements 양식 BE 제공 완료 — excel.columns.ts SSOT.)
```

---

## 도메인 특화 재확인 (회귀)
- 가중치 합=100·정성≤상한: `scoring.validateWeights`(백엔드 단일). import/template/kpi 제출 전부 경유. 프론트는 표시·클라가드만.
- 총점 단일계산: `computeTotalScore`(Σ score×weight/100) 백엔드. FE 재계산 없음.
- 그룹 풀 상한 강제: `evaluations.submit`→`assertPoolNotExceeded`→`checkPool` 422 POOL_EXCEEDED(백엔드 강제).
- 평가유형 self/downward(round 1·2)·역할 4값·KPI category/group/measureType·tier·DepartmentType: BE enum ↔ FE type 문자열 전수 일치(peer/upward 없음).
- 코멘트 의무화(downward 본부장·팀장)·이의제기 7일(APPEAL_WINDOW_DAYS=7, APPEAL_WINDOW_CLOSED 422): 백엔드 구현.

## 미검증(범위 외/런타임 필요)
- Docker end-to-end 런타임 스모크(전 라우트 200, SMTP 콘솔 폴백 실발송)는 release-engineer 영역 — 본 리포트는 정적 교차검증 + 빌드 확인까지.
- 엑셀 import 실제 파싱 라운드트립(별칭 헤더 매칭)은 단위테스트 부재로 미검증(코드상 별칭 맵은 contract와 일치).
