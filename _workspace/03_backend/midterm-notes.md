# 백엔드 구현 노트 — 6월 중간평가 (①②③④)

작성 2026-06-08 · 범위: ①②③④ 구현 (④ KPI 목표 재조정 = 아래 E절, 2026-06-08 추가).

## A. Model B 정합화 (§1)
- seed 2026 주기: `cycleType: FINAL`(이전 MIDTERM), `status: mid_review` 유지, 이름 `2026년 정기 성과평가`, endDate 12/31. → `apps/api/prisma/seed.ts:419`
- 실행 중 dev DB 의 기존 2026 MIDTERM 주기도 즉시 `FINAL` 로 업데이트 적용(재시드 불필요).
- `CycleType.MIDTERM` enum 값 **보존**(미사용 옵션).
- 게이팅 기준을 `cycleType` → `cycle.status` 로 전환. 공통 헬퍼 `common/state/cycle-stage.ts`:
  - `isFinalStage(status)` = calibration|closed.
  - `assertFinalStage(prisma, cycleId, message)` → 비최종이면 400 VALIDATION_ERROR.
- 역량평가 차단(competency.service.ts createQuestion/bulkRespond): MIDTERM 타입 검사 → `isFinalStage` 검사로 교체. 메시지: "중간 점검 단계에서는 역량평가를 진행하지 않습니다…".

## B. ① 등급·보상 게이팅
- `results.service.ts aggregate()` 진입부 `assertFinalStage` 추가(hr_admin 권한 검사 직후).
- `compensations.service.ts compute()` 진입부 `assertFinalStage` 추가.
- 시뮬레이션(`simulation`/`simulationTeam`)은 미차단(미리보기, 영속 없음).

## C. ② 진척 점검 + 자가점검/확인
- 신규 `MidtermReview` 모델 (cycle×evaluatee unique). status pending→self_done→confirmed.
- `MidtermProgressService` (신규 실적 모델 없음, 기존 재사용):
  - 개인 KPI: `Achievement`(분기) 누적 → cumulativeRate, currentGrade(measureToGrade), trend(직전 분기 비교), signal(90/70 경계).
  - 조직: 사용자 그룹 루트의 `MonthlyPerformance` 누적(카테고리별 + 월별 추세).
- `MidtermReviewsService`: submitSelf(본인 upsert), confirm(상위 장/HR), list(스코프).
- 부서장 식별 = `resolveDownwardEvaluators`(round1 팀장/round2 본부장/round3 대표) 재사용.

## D. ③ ActionItem
- 신규 `ActionItem` 모델 + `ActionItemStatus`(planned/in_progress/done/canceled) + `ActionItemSource`(midterm_review).
- `ACTION_ITEM_TRANSITIONS` 를 `common/state/transitions.ts` 에 추가(assertTransition 패턴).
- `ActionItemsService` CRUD + transition. RBAC:
  - 생성/수정: 부서장(상위 장)·HR.
  - 상태전이: 담당 본인 + 부서장 + HR.
  - 조회: 본인(피평가자/담당)·부서장·HR.
- AuditLog: create/update/transition + review self_submit/confirm.
- **최종등급 미반영** — 점수 계산 경로(results.aggregate, scoring) 어디에도 ActionItem 참조 없음. 최종평가 화면은 `GET /action-items` 로 조회만.

## E. ④ 중간 KPI 목표 재조정 — **제안→검토→승인 워크플로우**(2026-06-08 재설계)

> **변경:** 이전엔 HR/부서장이 즉시 KPI 를 수정(`POST /midterm/rebaseline`)했으나, **본인 제안 → 부서장 검토 → 승인 시 반영**으로 재설계. 즉시-적용 라우트·`RebaselineDto` 폐기.

- **신규 모델 `RebaselineRequest`** + enum `RebaselineRequestStatus(submitted/approved/rejected)`. 마이그레이션 `20260608150000_rebaseline_requests`(테이블 `rebaseline_requests` + enum + FK cycle(Cascade)/evaluatee(Restrict)/reviewer(SetNull) + index cycle·evaluatee·(cycle,evaluatee)·reviewer·status). KpiSnapshot·AuditLog 는 계속 재사용.
  - 필드: id·cycleId·evaluateeId(=요청자 본인)·reason·items(Json `[{kpiId,targetValue?,targetText?,weight?}]`)·status·reviewerId?·reviewComment?·reviewedAt?·appliedSnapshotId?·createdAt·updatedAt.
  - "한 cycle×evaluatee 당 미결(submitted) 1건"은 조건부라 Postgres `@@unique` 불가 → 서비스 검증(create 시 기존 submitted 있으면 400).
- **상태기계** `common/state/transitions.ts → REBASELINE_REQUEST_TRANSITIONS`: submitted→approved|rejected, rejected→submitted(재제출), approved=종단. `assertTransition` 으로 강제.
- `assertMidReviewStage`(기존 헬퍼) — 생성·수정·검토 모두 mid_review 단계 게이팅.
- **`RebaselineService` 재작성**(`modules/midterm/rebaseline.service.ts`):
  - `create(current, dto)` — 제안 주체=current.id 강제. reason 필수 → mid_review → 미결 중복 → `validateProposal` → RebaselineRequest 생성(submitted) → audit `rebaseline_request.submit`.
  - `update(current, id, dto)` — 본인만. submitted/rejected 에서만(approved 400). 재검증. rejected 면 `assertTransition`(rejected→submitted) 후 status=submitted(reviewer/comment 초기화). audit update/resubmit.
  - `review(current, id, dto)` — `assertReviewerAuth`(부서장 round1/2/3, **HR 도 불가**) → `assertTransition` → reject(코멘트만) | approve(`validateProposal` 재검증 → `applyToKpis` 실제 반영 → status=approved·appliedSnapshotId). audit approve/reject.
  - `applyToKpis(...)` — **기존 즉시-적용 로직을 그대로 이동**(직전 스냅샷 1건 "중간 조정 전 (YYYY-MM-DD)" + KPI update + `kpi.rebaseline` 감사. after 에 reason·snapshotId·requestId·requesterId·reviewerId). 변경 0건이면 snapshotId=null.
  - `validateProposal(...)` — confirmed 한정·소속·중복·정량≥0·최소1필드 + weight 변경 시 confirmed 모집단 `scoring.validateWeights`(합=100). **제출 시 + 승인 시 둘 다** 호출.
  - `list/detail/serialize/toView` — 목록 view(이름 해석) + 상세(items·currentKpis(confirmed)·proposedChanges(현재 vs 제안 diff)·projectedWeightSum·weightValid). forReview=부서장 검토 큐.
  - `history(...)` — **기존 그대로 유지**(라벨 prefix 스냅샷 체인 diff + audit 사유 + createdByName). 승인 반영분만 스냅샷 생기므로 자연히 승인분만 표시.
  - RBAC: 생성/수정=본인. 검토=부서장(`resolveDownwardEvaluators`, `isReviewerOf`). 조회=본인·부서장·HR(`canViewUser`).
- 엔드포인트(MidtermController) — **role 게이트 없음**, 서비스에서 단계·소유권·검토자 검증:
  - `POST /midterm/rebaseline-requests` (본인 제안)
  - `GET /midterm/rebaseline-requests?cycleId=&evaluateeId?&status?&forReview?`
  - `GET /midterm/rebaseline-requests/:id`
  - `PATCH /midterm/rebaseline-requests/:id` (본인 수정·재제출)
  - `PATCH /midterm/rebaseline-requests/:id/review` (부서장 승인/반려)
  - `GET /midterm/rebaseline/history?cycleId=&evaluateeId=` (유지)
  - **제거:** `POST /midterm/rebaseline`(즉시 적용) + `RebaselineDto`.
- DTO: `CreateRebaselineRequestDto`(cycleId·reason·items[≥1], evaluateeId 없음)·`UpdateRebaselineRequestDto`(reason?·items?)·`ReviewRebaselineRequestDto`(decision approve|reject·comment?)·`ListRebaselineRequestsQuery`·`RebaselineItemDto`·`RebaselineHistoryQuery`.

## 마이그레이션
- (①②③) `prisma/migrations/20260608061455_midterm_action_items/` 생성·적용 완료(dev DB sync).
- **④ 워크플로우** `prisma/migrations/20260608150000_rebaseline_requests/` 생성·`migrate deploy` 적용 완료(dev DB `eval@localhost:5432`, migrate status "up to date"). `prisma generate` OK. 테이블 `rebaseline_requests` + enum `RebaselineRequestStatus`.

## 검증
- `npx tsc --noEmit` 통과, `nest build` 통과(④ 워크플로우 재설계 후 재검증 OK).
- 부팅 스모크: 새 라우트 5종 + 기존 history 라우트 RouterExplorer 매핑 확인, 구 `POST /midterm/rebaseline` 미존재 확인. Nest application successfully started.

## 결정/주의 (프론트·QA 공유)
- 진척 신호 경계(90/70%)는 코드 상수. 추후 RuleSet 화 가능하나 이번 범위 미포함.
- MidtermReview 재제출 시 confirmed→self_done 로 되돌림(부서장 재확인 강제).
- ActionItem `done` 재개(→in_progress) 시 completedAt 초기화.
- 게이팅은 status 기준 — calibration 진입 전엔 등급/보상/역량 모두 막힘(프론트도 mid_review 화면에서 해당 액션 숨김 권장).

### ④ 결정/미결 (프론트·QA 공유)
- **편집 대상은 targetValue/targetText/weight 만**으로 한정(요구 §2④). category·measureType·isQualitative 등은 재조정 경로로 변경 불가 — 필요 시 별도 요건.
- ~~재조정은 KPI `status` 무관(submitted/confirmed 도 가능)~~ → **[QA 수정·리더 확정 2026-06-08] 대상·검증 모집단을 `status=confirmed` 로 통일.** 재조정 = 확정 베이스라인 조정. items 의 kpiId 가 confirmed 아니면 400. weight 합=100 검증도 confirmed KPI 집합 기준(QA MAJOR-1: 프론트는 confirmed 만 로드하는데 백엔드는 전체 status 로 검증 → 모집단 불일치로 영구 저장불가/400 가능했음). status 자체는 바꾸지 않음.
- weight 검증: 변경 후 사용자 전체 집합으로 `validateWeights` → 현 제품정책상 **합=100 만 차단**(정성캡·그룹비율은 weightPolicy 옵트인). 일괄 형태라 부분 전송으로 합이 깨지면 400.
- 스냅샷 라벨 = `"중간 조정 전 (YYYY-MM-DD)"`. 같은 날 여러 번 재조정해도 그날 스냅샷 1건(첫 조정 전 원본). 다음 날 재조정 시 새 라벨로 새 스냅샷 → history 가 일자별 타임라인.
- history diff 는 스냅샷 체인 기반(before=스냅샷, after=다음 스냅샷 또는 현재). 재조정 외 경로로 KPI 가 바뀌면(예외적) 그 변화도 가장 최신 entry 의 diff 에 섞여 보일 수 있음 — mid_review 단계에서 KPI 변경 경로는 사실상 재조정뿐이라 실무상 문제 없음.
- (미결정) 재조정 결과를 피평가자에게 알림(Notification) 보낼지 — 이번 범위 미포함(필요 시 추가).

### ④ 워크플로우 재설계 (2026-06-08) — 결정/미결 (프론트·QA 공유)
- **제안 주체 역전:** 기존 부서장/HR 즉시 적용 → **본인 제안 → 부서장 검토 → 승인 반영.** 실제 KPI 변경·스냅샷·`kpi.rebaseline` 감사는 **승인 시점에만**.
- **검토자 = 부서장만(HR 제외).** `resolveDownwardEvaluators` round1(팀장)→없으면 round2(본부장)→round3(대표). HR 은 조회만(승인 시 403). 부서장 식별이 role 기반이라(부서에 팀장 role 없으면 round1 공백→round2 가 검토) 메모 `dept-head-by-role` 정합.
- **미결 1건 제약**은 서비스 검증(조건부 unique 불가). submitted 있으면 신규 create 400 — 프론트는 "수정/재제출"로 유도.
- **검증 2회(제출+승인):** 승인 시점에 confirmed 집합·가중치가 바뀌어 합이 깨졌다면 승인 400 → 본인 재제출 필요. 프론트 상세의 `weightValid`/`projectedWeightSum` 로 사전 경고.
- **history 무변경:** 승인분만 스냅샷이 생기므로 기존 스냅샷-체인 diff·`createdByName`(=승인 부서장) 그대로 동작. 즉시-적용 시절 데이터와 호환.
- **상세 응답 확장:** `items`(제안)·`currentKpis`(confirmed)·`proposedChanges`(현재 vs 제안 diff)·`projectedWeightSum`·`weightValid` 포함 — 프론트가 diff/가중치 검증 UI 를 백엔드 계산값으로 그림(클라 재계산 불필요).
- **⚠️ 프론트 마이그레이션 필요(미완, §6 통지):** `apps/web` 의 `rebaselineCommands.apply`(`POST /midterm/rebaseline`)·`/admin/midterm/rebaseline` 즉시-적용 페이지·`lib/types.ts` 의 `RebaselineRequest`/`RebaselineResult` 가 구 계약 기반. 새 워크플로우 엔드포인트로 전환 필요(백엔드 구 라우트 제거됨). history 훅(`useRebaselineHistory`)은 그대로 동작.

### ④ QA 수정 라운드 (2026-06-08, qa-report-midterm.md ④ 섹션 대응)
- **[MAJOR-1] 가중치 검증 모집단 통일** — 대상 KPI·weight 합=100 검증을 모두 `status=confirmed` 로 통일(리더 확정). `rebaseline.service.ts`: items 루프에 confirmed 아니면 400 추가, weight 검증 `findMany` where 에 `status: confirmed` 추가. 계약 §7 핵심규칙·검증순서·body·에러에 명시.
- **[MINOR-1] 이력 변경자 이름** — `GET /rebaseline/history` 응답에 `createdByName`(실행자 User.name 조회) 추가. distinct createdBy → User.findMany 로 1회 조회·매핑. 계약 §7 RebaselineHistoryEntry 에 `createdByName: string|null` 추가. 프론트가 이 필드로 표시(후보맵 폴백 불필요).
- **[MINOR-2] 정량 목표 음수 방지** — 정량(비정성) KPI 의 `targetValue < 0` 이면 400(null=제거는 허용). 계약 §7 검증규칙·검증순서·에러에 추가.
- 빌드: `npx tsc --noEmit` 통과(④ 수정 후). 마이그레이션 변경 없음(스키마 무변경).

## F. KPI(지표)별 중간 자가점검 (MidtermKpiCheckIn, 2026-06-09 추가)
- 신규 엔티티 `MidtermKpiCheckIn`(midterm_kpi_check_ins): MidtermReview 1:N · Kpi N:1. (midtermReviewId,kpiId) unique. onDelete Cascade(review). 필드: selfActualText(@db.Text)·selfActualValue(Float)·selfNote·selfGrade(Grade?)·reviewerNote·reviewerGrade·confirmedAt.
- 마이그레이션: prisma/migrations/20260609100000_midterm_kpi_check_ins/migration.sql (DB 미기동 → SQL 생성 + prisma generate 로 타입 갱신). seed 영향 없음.
- DTO: MidtermKpiCheckInDto + SubmitMidtermSelfReviewDto.kpiCheckIns?[]. submitSelf 에서 본인·해당 cycle KPI만 허용(일괄 조회 검증, 위반 시 400 VALIDATION_ERROR{invalidKpiIds}). upsert 는 $transaction.
- GET /midterm/reviews · POST /midterm/reviews 응답에 kpiCheckIns[] 동봉(REVIEW_INCLUDE).
- GET /midterm/progress KPI 객체 보강: csf·measureMethod·isQualitative·gradingCriteria 추가 + selfCheckIn{selfActualText,selfActualValue,selfNote,selfGrade}|null.
- tsc·nest build 통과. 기존 사이클단위 selfNote·부서장 confirm 회귀 없음(필드 보존).
