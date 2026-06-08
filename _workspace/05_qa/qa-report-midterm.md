# QA 통합 정합성 리포트 — 6월 중간평가 · 피드백 보완 조치 (설계 ①②③)

> 작성 2026-06-08 · QA Inspector · 방법: 양쪽 동시 읽기(생산자↔소비자) 교차검증 + 타입체크
> 범위 ①②③ (④ KPI 목표 재조정 제외). SSOT = `_workspace/02_contract/contract-midterm.md`.
> 게이트 판정: **PASS** (blocker/major 0건, minor 2건 — 비차단)

---

## 0. 검증 자산

| 측 | 파일 |
|---|---|
| 계약 | `_workspace/02_contract/contract-midterm.md` |
| 백엔드 | `apps/api/src/modules/midterm/{midterm,action-items}.controller.ts`, `*.service.ts`, `dto/midterm.dto.ts`, `common/state/{cycle-stage,transitions}.ts`, `modules/{results,compensations,competency}/*.service.ts`, `prisma/schema.prisma`, 마이그레이션 `20260608061455_midterm_action_items` |
| 프론트 | `apps/web/hooks/useMidterm.ts`, `lib/types.ts`/`ui.ts`, `app/(main)/eval/midterm/*`, 변경된 `eval/result/[userId]/page.tsx`·`eval/page.tsx`, `components/{MidtermSignalBadge,ActionItemStatusBadge,ActionItemRow,MidtermResultSummary,MidtermActionPanel,OrgProgressCard}` |

빌드: `apps/api` `tsc --noEmit` **PASS** · `apps/web` `npm run typecheck` **PASS**.

---

## 1. 응답 봉투 · 필드명 (A·B)

- [x] **봉투 일관성.** 전역 `EnvelopeInterceptor`(`apps/api/src/common/interceptors/envelope.interceptor.ts:24-32`)가 `{data}`/`{data,meta}` 형태면 그대로 통과, 아니면 `{data: payload}`로 래핑.
  - progress 서비스는 `{ data: {...} }` 직접 반환(`midterm-progress.service.ts:123`) → 인터셉터가 통과(double-wrap 없음).
  - reviews/action-items 단건은 raw DTO 반환 → 인터셉터가 `{data}`로 래핑. 목록은 `{data, meta}` 직접 반환(`midterm-reviews.service.ts:60`, `action-items.service.ts:88`) → 통과.
- [x] **프론트 unwrap 정확.** `apiGet`은 `json.data`(api.ts:147), `apiGetList`는 `{data, meta}`(api.ts:156), `apiPost`/`apiPatch`는 `json.data`(api.ts:169,196). `useMidterm.ts`가 단건엔 `apiGet`/`apiPost`/`apiPatch`, 목록(reviews/action-items)엔 `apiGetList` 사용 — 봉투 형태와 1:1.
- [x] **camelCase 누출 없음.** DB는 `@map("snake_case")`(schema 884-942), 응답은 toDto에서 camelCase 명시 매핑(`midterm-reviews.service.ts:146-167`, `action-items.service.ts:271-300`). snake_case 키 응답 누출 없음.
- [x] **계약 타입 ↔ types.ts 1:1.** `MidtermProgress`/`KpiProgress`/`OrgProgress`/`MidtermReview`/`ActionItem` 및 요청 페이로드(`types.ts:1286-1409`)가 계약 §2~4와 필드·nullable까지 일치. `dueDate`/`completedAt`은 양측 `string|null`(계약 불일치 #5 정상 처리).

## 2. enum 정합 (양쪽 동일 문자열)

- [x] **ProgressSignal** `on_track|at_risk|off_track` — 계약 §2 / backend `midterm-progress.service.ts:17` / `types.ts:1286` / `ui.ts:563` / `MidtermSignalBadge.tsx:18` 모두 일치. 디자인 스펙의 `caution` 미채택(계약 우선) 확인.
- [x] **ProgressTrend** `up|flat|down` — 일치(`types.ts:1288`, backend `trendOf` 산출).
- [x] **ActionItemStatus** `planned|in_progress|done|canceled` — Prisma enum(schema:167) / DTO `@IsEnum`(dto:86) / `types.ts:1363` / `ui.ts:570` / `ActionItemRow.tsx:25` / 마이그레이션 SQL:5 모두 일치.
- [x] **MidtermReviewStatus** `pending|self_done|confirmed` — Prisma(schema:158) / `types.ts:1333` / 마이그레이션:2 일치.
- [x] **KPI 분류 문자열** category(revenue/construction/orders/collaboration/development)·group(performance_core/collaboration_growth)·measureType(amount/rate/count/qualitative)·Grade(S~D) — `types.ts:24-34` ↔ Prisma enum(schema:91-132) 완전 일치.

## 3. 라우팅 (C)

- [x] `/eval/midterm` page 실재(`app/(main)/eval/midterm/page.tsx`). `(main)` route group은 URL에서 제거 → `/eval/midterm` 정확.
- [x] eval 허브 CTA가 mid_review일 때 `/eval/midterm`로 분기: 달력 mid_review 카드 route(`eval/page.tsx:255`), "내 할 일" 본인평가→중간점검(`:543`), 부서장 중간 확인 카드(`:566`). 그 외 단계는 기존 `/eval/self`·`/eval/dept-head` 유지.
- [x] result 페이지 분기 href(`/eval`, `/eval/result`, `/appeals?resultId=`)·셀렉터 정상.

## 4. 게이팅 — 블록① (검증 핵심)

- [x] **백엔드 차단.** `assertFinalStage`(`cycle-stage.ts:24`, calibration/closed 아니면 400 VALIDATION_ERROR)가:
  - `results.service.ts:312` aggregate 진입부(hr 권한 검사 직후),
  - `compensations.service.ts:269` compute 진입부,
  - competency `createQuestion`(`competency.service.ts:58`)·bulk(`:175`)는 동등 `isFinalStage` 인라인 검사.
  - 메시지 계약 §1 문구와 일치.
- [x] **시뮬레이션 미차단.** compensations simulation/simulationTeam에는 `assertFinalStage` 없음 — 계약 §1 주석(what-if 미리보기)과 일치.
- [x] **프론트 수치 fetch 회피.** result 페이지가 `cycle.status`로 선분기: mid_review면 `useResultDetail(userId, isMidReview ? null : cycleId)`(`result/[userId]/page.tsx:130-133`) → 훅 `enabled: !!userId && !!cycleId`(`useResults.ts:47`)로 `/results/:id` 호출 자체를 안 함(400 회피). mid 진척은 `enabled: isMidReview`, 블록③은 `enabled: isFinalStage`로 단계별 격리.
- [x] **calibration/closed 해제.** `isFinalStage` 분기에서 정상 결과 fetch + 블록③ 패널 노출(`:380`).

## 5. 상태 전이 (D)

- [x] **ACTION_ITEM_TRANSITIONS 강제.** `transitions.ts:46-51` 맵을 `action-items.service.ts:194` transition에서 `assertTransition`으로 강제 → 불법전이 409 INVALID_STATE_TRANSITION(`transitions.ts:60`). 맵 내용이 계약 §4 전이표와 정확히 일치(planned→{in_progress,done,canceled}, in_progress→{done,planned,canceled}, done→in_progress, canceled→planned).
- [x] **프론트 사전 강제.** `ActionItemRow.tsx:25-30`의 `TRANSITIONS` 맵이 백엔드와 동일 — 허용 전이만 클릭 가능(assignee는 canceled/canceled-복원 추가 제한 `:66-68`). 불법 전이 시 백엔드 409를 한글 토스트로 변환(`DeptHeadMidterm.tsx:329`, `EmployeeMidterm.tsx:94`).
- [x] **done completedAt 처리.** `action-items.service.ts:201` — done이면 completedAt=now, done에서 벗어나면 null, 그 외 미변경. 계약 §4 동작 일치.
- [x] **MidtermReview pending→self_done→confirmed.** submitSelf upsert가 항상 self_done(재제출 시 confirmed→self_done 되돌림, `midterm-reviews.service.ts:79`), confirm이 confirmed(`:105`). 계약 §3 동작 일치.

## 6. RBAC (E)

- [x] **action-items 생성/수정** = `@Roles(hr_admin, division_head, team_lead)` 컨트롤러 가드(`action-items.controller.ts:42,49`) + 서비스 `assertManageAuth`로 "피평가자 상위 장(round1/2/3)" 행수준 추가 검증(`action-items.service.ts:227-243`). employee 403.
- [x] **상태 전이** = 컨트롤러 role 제한 없음(`:59`) + 서비스 `assertProgressAuth`(담당 본인 OR 부서장 OR hr, `:246-251`). 계약 §4 일치.
- [x] **조회** = `assertViewAuth`(본인 피평가자/담당 OR 부서장 canViewUser OR hr, `:254-261`); list는 role별 where 스코프(employee는 본인 OR/타인요청 차단 `:54-61`).
- [x] **midterm review 자가점검** = 컨트롤러 role 무제한, 서비스가 evaluatee=current 강제(`midterm-reviews.service.ts:67`) → 타인 것 제출 불가. **confirm** = `@Roles(hr_admin,division_head,team_lead)`(`midterm.controller.ts:51`) + 서비스 `assertReviewerAuth`(상위 장/HR, `:123-136`).
- [x] **프론트만 숨긴 엔드포인트 없음.** 모든 보호 엔드포인트가 서비스 행수준 가드 보유. hr_admin C-2 미노출(`page.tsx:82` `!isHr`)은 백엔드 상위장 제한과 정합(보안 결함 아님, UX 정합).

## 7. 참고용 보장 (도메인)

- [x] **ActionItem이 점수/등급 경로에 없음.** `apps/api/src/common/rules`(scoring 포함) 전체에 `actionItem`/`ActionItem` 참조 0건(grep). results.aggregate/compensations.compute 어디에도 미참조. `MidtermModule`도 ActionItemsService를 export만(score 모듈 미주입). 12월 화면은 `useActionItems` 조회 + `MidtermActionPanel` 이행 카운트 **표시만**(`MidtermActionPanel.tsx` counts는 등급 미반영). 계약 §6 일치.
- [x] **총점/등급/달성률/신호는 백엔드 단일 산정.** progress의 currentGrade는 `scoring.measureToGrade`(RuleSet `gradingScales`/`revenueGradeScale`에서 읽음, `midterm-progress.service.ts:73-86`), 프론트는 표시만(`MidtermProgressTable`). 프론트 재계산 없음.

## 8. Model B 정합 / 스키마 / 마이그레이션

- [x] seed 2026 주기 = `cycleType: FINAL` + `status: mid_review`(`seed.ts:422`). CycleType.MIDTERM enum 보존·미사용(schema:140).
- [x] 게이팅 기준 `cycle.status`(cycleType 아님) — `cycle-stage.ts` 일관.
- [x] 마이그레이션 SQL이 enum 3종·테이블 2종·인덱스(unique [cycleId,evaluateeId])·FK(cascade/restrict/set null) 생성 — schema와 1:1. `MidtermModule`이 AppModule에 등록(`app.module.ts:89`).

---

## 9. 결함 (minor · 비차단)

### [MINOR-1] 훅에서 계약 타입 미사용(로컬 중복 인터페이스)
- 위치: `apps/web/hooks/useMidterm.ts:90-97`
- 내용: `actionItemCommands.transition`이 `lib/types.ts:1406`의 `TransitionActionItemRequest`를 import하지 않고 동일 형태의 로컬 `TransitionActionItemBody`를 재정의. 다른 커맨드(create/update/submitSelf/confirm)는 계약 타입을 import하므로 일관성만 어긋남.
- 영향: 기능·타입 안전성 정상(형태 동일). DRY/유지보수성만 저하 — 추후 계약 변경 시 한쪽만 갱신될 위험.
- 권장 수정: 로컬 `TransitionActionItemBody` 제거하고 `import type { ..., TransitionActionItemRequest }`로 교체해 `transition(id, body: TransitionActionItemRequest)` 사용.
- 담당: frontend.

### [MINOR-2] 진척 신호 경계가 RuleSet 미연동(하드코딩 상수)
- 위치: `apps/api/src/modules/midterm/midterm-progress.service.ts:232-237`(`signalOf` 90/70 상수, `_gradeScale` 인자 미사용).
- 내용: 신호 경계(90/70%)가 코드 상수. 백엔드 노트(C, 결정/주의)에 "추후 RuleSet화 가능, 이번 범위 미포함"으로 명시된 의도된 결정. 등급·풀·인상률은 RuleSet에서 정상적으로 읽힘(참고용 보장 §7 통과) — 본 항목만 설정 외부화 보류.
- 영향: 비구속(중간평가) 표시 지표라 등급/보상 산정엔 무영향. 정책 변경 시 코드 수정 필요.
- 권장: 후속 범위에서 `RuleSet`(또는 weightPolicy)에 `midtermSignalBoundary` 추가 후 `signalOf`에서 읽도록 연동. (이번 게이트 차단 사유 아님.)

> 미검증 항목: 런타임 실호출(DB 기동 e2e)은 본 라운드 범위 외 — 정적/타입 경계 검증으로 한정. 봉투·전이·게이팅·RBAC 코드 경로는 전부 확인됨.

---

## 10. 게이트 판정

**PASS** — 경계면(봉투·필드명·enum·라우팅·게이팅·상태전이·RBAC·참고용 보장) 전 항목 정합. 양쪽 타입체크 통과. 발견 결함 2건 모두 minor(비차단)이며 1건은 의도된 보류, 1건은 코드 정리 수준.

| 영역 | 결과 |
|---|---|
| A 응답 봉투 | PASS |
| B 필드명 camelCase | PASS |
| C 라우팅 | PASS |
| D 상태 전이 | PASS |
| E RBAC | PASS |
| 게이팅 ① | PASS |
| 참고용 보장 ⑦ | PASS |
| 빌드/타입 | PASS |

결함 요약: blocker 0 · major 0 · minor 2(MINOR-1 frontend DRY, MINOR-2 신호경계 RuleSet화 후속).

---

# ④ 중간 KPI 목표 재조정(re-baseline) + 변경 이력 — 통합 정합성 검증 〔append · 2026-06-08〕

> 방법: 양쪽 동시 읽기(생산자↔소비자) + 타입체크. SSOT = `contract-midterm.md` §7.
> 범위 = ④ 및 ④↔기존 경계만(①②③은 직전 라운드 PASS, 회귀만 확인).
> 게이트 판정: **CONDITIONAL PASS** (blocker 0 · major 1 · minor 3). major 1건은 단일 경계면 결함(프론트 KPI 필터 범위)으로 수정 라운드 권고.

## 검증한 파일
- 백엔드: `rebaseline.service.ts`, `midterm.controller.ts`(rebaseline 2라우트), `dto/midterm.dto.ts`, `common/state/cycle-stage.ts`(assertMidReviewStage), `midterm.module.ts`, `common/rules/scoring.service.ts`(validateWeights/loadRuleSetForCycle), `common/audit/audit.service.ts`, `common/access/access.util.ts`(resolveDownwardEvaluators/canViewUser), `prisma/schema.prisma`(KpiSnapshot/AuditLog/KpiStatus), `kpis.service.ts`(submit/confirm 회귀).
- 프론트: `admin/midterm/rebaseline/page.tsx`, `RebaselineTable.tsx`, `RebaselineHistory.tsx`, `RebaselineHistoryItem.tsx`, `hooks/useMidterm.ts`(useRebaselineHistory/rebaselineCommands), `hooks/useKpis.ts`, `lib/types.ts`(Rebaseline* 7종), `lib/nav.ts`, `admin/cycle/page.tsx`.

## ④ 통합 정합성 체크리스트

### 1. 계약 정합 (API ↔ 프론트)
- [x] `POST /midterm/rebaseline` 요청 body(cycleId, evaluateeId, reason, items[{kpiId, targetValue?, targetText?, weight?}]) ↔ `RebaselineRequest`(types.ts:1460) 1:1. `RebaselineItemDto`(dto:104) ↔ items 항목 1:1. camelCase 일치.
- [x] `RebaselineResult`(cycleId/evaluateeId/reason/snapshotId/changed/kpis) 응답 ↔ types.ts:1473 1:1. `RebaselineKpiChange`·`RebaselineFieldChange`·`RebaselineKpi` 전부 1:1.
- [x] `GET /midterm/rebaseline/history` 응답 `RebaselineHistoryEntry[]`(snapshotId/label/createdAt/createdBy/reason/changed) ↔ types.ts:1483 1:1.
- [x] 봉투 unwrap 정확: apply=단건 `apiPost<RebaselineResult>`(service가 `{ data }` 반환), history=목록 `apiGetList<RebaselineHistoryEntry>`(service가 `{ data, meta }` 반환). 양쪽 일치.
- [x] history 메타: service `{ page:1, pageSize:n, total:n }` — apiGetList 가 data/meta 분리 unwrap.

### 2. 게이팅 (mid_review 한정 — ①의 assertFinalStage 와 방향 반대)
- [x] 백엔드: `assertMidReviewStage`(cycle-stage.ts:49) — status != mid_review 면 400 VALIDATION_ERROR. 주기 미발견 시 보수적 차단. rebaseline() 검증순서 (1)에서 호출(service:73).
- [x] 검증 순서 계약 §7과 일치: reason(0)->mid_review(1)->권한(2)->소속/중복/변경필드(3)->weight 재검증(4).
- [x] 프론트 선분기: `isMidReview = current?.status === 'mid_review'`(page:46). 그 외 단계 -> InfoBanner + `readOnly` 전파(표/사유/저장 disabled), 이력은 항상 조회. 400 호출 회피.

### 3. 검증 규칙
- [x] reason 필수(공백 불가): 백엔드 `dto.reason?.trim()` 빈값 400(service:64) + DTO `@MinLength(1)`. 프론트 `reasonOk = reason.trim().length>0` 하드 게이트(page:234) + 전송 시 `reason.trim()`(page:282).
- [x] weight 합=100 하드: 백엔드 `validateWeights`(scoring:213, totalMustEqual). 프론트 `sumOk = totalWeight===100` 저장 disabled(page:233,242).
- [x] 정성>30 소프트: 백엔드 `enforceQualitativeCap` 옵트인(기본 비차단, scoring:221). 프론트 WeightSummaryBar 경고만(저장 허용). 일관.
- [x] items KPI 소속: 백엔드 `kpi.userId !== evaluateeId || kpi.cycleId !== cycleId` -> 400(service:96).
- [x] kpiId 중복: `new Set(kpiIds).size !== kpiIds.length` -> 400(service:84).
- [x] 최소 1필드 변경: 3필드 전부 undefined -> 400(service:103).
- [x] 편집 대상 필드 = targetValue/targetText/weight 만(DTO·service·table 모두 일치). category/measureType 변경 경로 없음.

### 4. 이력/감사
- [x] 직전 스냅샷 1건: 트랜잭션 내 `kpiSnapshot.create`(service:180), label `"중간 조정 전 (YYYY-MM-DD)"`(REBASELINE_LABEL_PREFIX + today()).
- [x] 같은 날 중복 skip: 동일 (cycle,user,label) findFirst -> 있으면 재캡처 안 함(service:172-178). "그날 첫 조정 전 원본" 보존.
- [x] noop: 실제 변경 0건이면 스냅샷·감사 생략, `snapshotId:null`, `changed:[]`(service:152). 프론트는 V5(changed 0건)로 저장 자체 disable + noop 응답 시 info 토스트(page:285).
- [x] AuditLog `Kpi`/`kpi.rebaseline`: before/after = 변경 필드만, after 에 reason+snapshotId(service:218-225). audit.record() 가 userId(actorId) 기록.
- [x] history diff 체인: before=스냅샷 data, after=다음(최신)스냅샷 또는 현재KPI(service:291-305). reason 매칭은 `after.snapshotId`(service:280)로 — 다른 스냅샷 audit 와 격리.
- [x] 라벨 prefix 격리: 제네릭 스냅샷(snapshots.service.ts "1차 확정" 등)은 `startsWith "중간 조정 전"` 필터에 안 걸림. action `kpi.rebaseline` 도 고유 -> 회귀 없음.
- [x] 프론트 이력 패널이 전용 엔드포인트(useRebaselineHistory) 사용 — 제네릭 KpiSnapshot diff 훅 미사용 확인(RebaselineHistory.tsx:8, 노트 ④-2 일치). `entry.changed` 즉시 렌더(지연 diff 없음).
- [x] AuditLog 필드명: service 가 `log.at`(schema:741)·`log.after`·`snap.createdBy`(schema:721) 사용 — 스키마와 일치.

### 5. RBAC
- [x] POST 컨트롤러 가드: `@Roles(hr_admin, division_head, team_lead)`(controller:67). 서비스 `assertRebaselineAuth` — hr_admin 통과 / employee 403 / 그 외는 `resolveDownwardEvaluators` round1/2/3 매칭 아니면 403(service:313-329). 행수준 상위장 검증 존재.
- [x] history 가드: `canViewUser`(본인/부서장 가시범위/HR), 밖이면 403(service:248-253).
- [x] 프론트 진입: `canAccess = isHr || isDeptHead`(canEvaluateDownward && !hr), employee -> Forbidden(page:49,86). 후보 범위: HR=전체활성, 부서장=downward 평가대상(page:66-69). 프론트만 숨긴 무가드 엔드포인트 없음.
- [x] nav roles(hr_admin·division_head·team_lead, nav.ts:85) ↔ 컨트롤러 @Roles 일치.

### 6. 라우팅
- [x] nav href `/admin/midterm/rebaseline`(nav:84) ↔ page 경로 `app/(main)/admin/midterm/rebaseline/page.tsx`((main) 그룹 제거) 일치.
- [x] `activeKeyForPath` 매핑 `/admin/midterm/rebaseline -> midterm-rebaseline`(nav:236) 존재.
- [x] cycle/page.tsx 보조 링크 `href="/admin/midterm/rebaseline"`(cycle:864) 실재 경로.

### 7. 회귀(①②③ + 기존 KPI 경로)
- [x] KpiSnapshot 공용: rebaseline 은 고유 라벨 prefix·고유 audit action -> 기존 cycles/snapshots.service.ts 와 격리(필터·매칭 충돌 없음).
- [x] validateWeights 재사용: rebaseline 은 "변경 후 사용자 전체집합" projection 으로 호출(service:124-131) — kpis.submit(255) 와 동일 정책(합=100). 시그니처 호환.
- [x] ActionItem 등급 미반영: ④ 는 점수 경로 무접촉(KpiSnapshot/AuditLog/Kpi update 만). 회귀 없음.
- [x] ①②③ 경계 무변경 — 컨트롤러/모듈에 rebaseline 만 추가, 기존 라우트 시그니처 불변.

### 8. 빌드/타입
- [x] `apps/api` `npx tsc --noEmit` -> exit 0.
- [x] `apps/web` `npx tsc --noEmit` -> exit 0.

---

## 결함 상세

### [MAJOR-1] 프론트 편집 대상 KPI 필터(status=confirmed)가 백엔드 가중치 검증 범위(전체 status)와 불일치
- **생산자(백엔드):** `apps/api/src/modules/midterm/rebaseline.service.ts:119-120` — weight 변경 시 `prisma.kpi.findMany({ where: { userId, cycleId } })` 로 **status 무관 전체 KPI** 를 모아 합=100 검증. 또한 대상 KPI 로드(service:90-92)도 status 필터 없음. 백엔드 노트 E(§67) 명시: "재조정은 KPI status 무관(submitted/confirmed 도 가능)".
- **소비자(프론트):** `apps/web/app/(main)/admin/midterm/rebaseline/page.tsx:198` — `useKpis({ cycleId, userId: evaluateeId, status: 'confirmed' })` 로 **confirmed KPI 만** 행으로 로드. `totalWeight`(page:220-223)·`sumOk`(page:233) 게이트가 confirmed 부분집합 위에서만 합산.
- **원인:** KPI 확정은 per-KPI 전이(`kpis.service.confirm`, id 단건, kpis.service.ts:315)라 mid_review 시점에 한 사용자의 KPI 가 confirmed/approved/submitted/draft 혼재 가능. 그러나 합=100 불변식은 submit 시점(kpis.service.ts:255)에 **전체 집합**으로 강제됨 -> confirmed 부분집합의 합은 100 미만일 수 있음.
- **영향(두 갈래):**
  1. 한 사용자에 비-confirmed KPI 가 하나라도 있으면 confirmed 행 합 < 100 -> 프론트 `sumOk` 항상 false -> **정당한 재조정도 저장 버튼 영구 disabled**(저장 불가).
  2. 반대로 confirmed 행만으로 100 을 맞춰 전송해도, 백엔드는 비-confirmed 포함 전체로 재검증하므로 합 != 100 -> **400 거부**. 즉 UI 게이트와 서버 게이트가 서로 다른 모집단을 본다.
  - (현재 seed 는 per-user KPI 를 status 부여해 만들지 않으므로 데모 데이터로는 즉시 재현 안 될 수 있으나, 실제 운영 데이터에서 구조적으로 발생.)
- **수정방법(택1, 계약 재확정 후):**
  - (A 권장) 프론트가 백엔드와 동일한 모집단을 보도록 `status` 필터 제거 — `useKpis({ cycleId, userId: evaluateeId })`(전체 status)로 로드하고, 편집 불가 status(예: draft)는 행을 비활성/배지 처리. 가중치 합산도 전체 행 기준.
  - (B) 또는 계약 §7 에 "재조정 대상 = confirmed KPI 한정"을 명문화하고, 백엔드 `targetKpis`/`validateWeights` projection 모두 `status: confirmed` 로 좁혀 양쪽 모집단을 confirmed 로 통일. (단 백엔드 노트 §67 "status 무관" 결정과 충돌 -> 리더 재확정 필요.)
- **통지 대상:** backend(rebaseline.service.ts 모집단) + frontend(page.tsx:198 필터) 양쪽. **계약 모호(대상 KPI status 범위 미규정) -> 리더 재확정 요청.**

### [MINOR-1] 이력 변경자(createdBy) 이름 해석이 피평가자 후보 맵으로만 이뤄져 대부분 userId 노출
- **위치:** `apps/web/app/(main)/admin/midterm/rebaseline/page.tsx:171` — `nameById={nameMapFromUsers(candidateUsers)}`. `candidateUsers` 는 **피평가자** 후보(page:66-69)인데, `RebaselineHistoryEntry.createdBy` 는 **재조정 실행자(부서장/HR)** userId(service:301).
- **영향:** 실행자가 피평가자 후보 목록에 없으면 RebaselineHistoryItem 의 actor 가 이름 대신 raw userId 로 표시(RebaselineHistoryItem.tsx:42 폴백). 기능 정상, 표시 품질만 저하.
- **수정방법:** 실행자 이름 해석용으로 전체 사용자 맵(예: useUsers 결과) 또는 별도 createdByName 을 주입. (또는 백엔드 history 응답에 `createdByName` 추가 — 계약 변경 필요.)

### [MINOR-2] 정량 목표값>=0(V7) 검증이 프론트 전용 — 백엔드 미강제
- **위치:** 프론트 `negativeTarget` 하드 게이트(page:236-242). 백엔드는 `targetValue` 음수 차단 없음(DTO `@IsNumber` 만, weight 만 0~100).
- **영향:** API 직접 호출 시 음수 목표값 저장 가능. 계약 §7 도 음수 금지를 명시하지 않으므로 계약 위반은 아님(표시/입력 편의 검증).
- **수정방법(선택):** 계약에 "정량 목표값 >= 0" 추가 시 백엔드 RebaselineItemDto 또는 service 에 `@Min(0)`/검증 추가. 미추가면 프론트 게이트는 UX 보조로 유지.

### [MINOR-3] 행별 사유(lineReason) 입력칸이 UI 에 있으나 전송·서버 미반영(설계상 의도, 혼동 소지)
- **위치:** RebaselineTable.tsx:260-275(변경 행에 "사유 *" 필수 표시) — 그러나 page.handleSave(page:262-275)는 전체 `reason` 만 전송, lineReason 미포함(프론트 노트 ④-6 명시). 계약 §7 items 에 lineReason 없음.
- **영향:** 사용자가 행별 사유를 필수처럼 입력해도 저장되지 않음(전체 사유만 기록). 데이터 손실 위험은 아니나 UX 기대 불일치. `rowErrors` prop 도 배선만 되고 미사용(page:205, 항상 빈 객체).
- **수정방법(선택):** (a) 행 사유칸의 "*"/aria-required 제거하고 "메모(저장 안 됨)" 등으로 명확화, 또는 (b) 계약 §7 items[].lineReason 추가 후 백엔드 audit before/after 에 행 사유 동봉. 리더 판단.

---

## 게이트 판정: **CONDITIONAL PASS**

- **blocker 0 · major 1 · minor 3.**
- ④ 의 계약↔구현 1:1, 봉투 unwrap, 게이팅(mid_review), 검증순서, 이력/감사 체인, RBAC(컨트롤러+행수준), 라우팅, 회귀(KpiSnapshot/AuditLog/validateWeights 공용 격리) 모두 정합. 타입체크 양쪽 통과.
- **차단 해제 조건:** MAJOR-1(편집 KPI status 모집단 불일치) 수정. **계약 §7 에 "재조정 대상 KPI status 범위"가 미규정 -> 리더가 (A 전체 status / B confirmed 한정) 중 확정**한 뒤 backend·frontend 동시 반영 권고. minor 3건은 비차단(후속 보완).

---

# ④ 수정 라운드 재검증 〔re-verify · 2026-06-08, round 4〕

> 리더 확정: 재조정 대상·가중치 합=100 검증 모집단을 **status='confirmed' KPI 로 통일**(MAJOR-1 옵션 B 채택).
> 방법: 직전 라운드 결함(MAJOR-1 + minor 3)만 양쪽 동시 읽기로 재검증 + 회귀 확인. 신규 검증 항목은 추가하지 않음.

## 재검증 결과 요약

| 결함 | 직전 | 재검증 | 근거 |
|---|---|---|---|
| MAJOR-1 (모집단 불일치) | major | **해소(RESOLVED)** | 백엔드 대상·검증 모두 confirmed 로 통일, 프론트 confirmed 로드 유지, 계약 §7 명문화 — 3자 정합 |
| MINOR-1 (실행자 이름) | minor | **해소(RESOLVED)** | 백엔드 createdByName 매핑 + 타입 + 표시 일치, 후보맵 dead path 제거 |
| MINOR-2 (정량 목표값 음수) | minor | **해소(RESOLVED)** | 백엔드 service 에 targetValue<0 -> 400 추가 |
| MINOR-3 (행별 사유 dead UI) | minor | **해소(RESOLVED)** | lineReason 입력칸·rowErrors prop 제거, 전체 reason 필수 유지 |

## 1. [MAJOR-1] 해소 — confirmed 모집단 통일(생산자↔소비자↔계약 3자)

- [x] **(a) 대상 KPI confirmed 강제 (백엔드).** `rebaseline.service.ts:104-110` — items 각 kpiId 의 `kpi.status !== KpiStatus.confirmed` 면 400 VALIDATION_ERROR(`확정(confirmed)된 KPI만 재조정할 수 있어요. (kpiId=…)`). 소속·중복 검증과 같은 루프에서 per-item 강제. (직전: status 무관 → 수정됨.)
- [x] **(b) 가중치 합 검증 모집단 confirmed 통일 (백엔드).** `rebaseline.service.ts:141-148` — `prisma.kpi.findMany({ where: { userId, cycleId, status: KpiStatus.confirmed } })`. 직전의 status 무관 findMany 가 `status: KpiStatus.confirmed` 추가로 좁혀짐. projection(150-154)은 변경값(weightById) 우선·미변경은 현재값 유지 → confirmed 집합 기준 합=100 검증.
- [x] **소비자(프론트) 무변경 정합.** `page.tsx:197` `useKpis({ cycleId, userId: evaluateeId, status: 'confirmed' })` — confirmed 만 로드(직전과 동일). `totalWeight`(page:217-220)·`sumOk = totalWeight===100`(page:230)가 이제 **백엔드와 동일한 confirmed 모집단** 위에서 합산 → UI 게이트·서버 게이트 모집단 일치. (옵션 B 정상.)
- [x] **계약 §7 명문화.** `contract-midterm.md:239`(대상 KPI=confirmed 한정, 비-confirmed 시 400 `확정(confirmed)된 KPI만…` + "프론트도 status=confirmed 만 로드") · §7:243(가중치 합=100 검증 모집단 = `status='confirmed'` KPI 집합, 프론트와 통일) · 검증순서 §7:266 (④에 "status=confirmed 인지" 포함) · 에러목록 §7:307("confirmed 아님") 모두 반영. 직전 노트 §67 "status 무관" 결정과의 충돌 해소.
- [x] **3자 정합 확인:** 백엔드 대상=confirmed / 백엔드 검증모집단=confirmed / 프론트 로드=confirmed / 계약=confirmed — **단일 모집단으로 수렴**. 직전 두 갈래 영향(저장영구disable / 400거부) 구조적 원인 제거됨.

## 2. [MINOR-1] 해소 — createdByName 백엔드 해석 + dead path 제거

- [x] **생산자(백엔드) createdByName 매핑.** `rebaseline.service.ts:315-325` — 스냅샷 `createdBy`(실행자 userId) 집합으로 `user.findMany({ select: { id, name } })` → `nameById` 맵. 응답 엔트리(service:340) `createdByName: snap.createdBy ? nameById.get(snap.createdBy) ?? null : null`. **실행자(부서장/HR)** 기준으로 해석 — 직전 "피평가자 후보맵" 오류 원천 제거.
- [x] **계약 타입.** `RebaselineHistoryEntry.createdByName: string | null`(types.ts:1488) ↔ 계약 §7:319(createdByName, "프론트는 이 필드로 표시") 일치.
- [x] **소비자(프론트) 표시.** `RebaselineHistoryItem.tsx:40` `const actor = entry.createdByName || entry.createdBy || '(알 수 없음)'` — createdByName 우선 사용. 주석(MINOR-1)으로 의도 명시.
- [x] **후보맵 dead path 제거.** `RebaselineHistory.tsx` 에 `nameById`/`nameMapFromUsers` prop 없음(직전 page.tsx:171 `nameById={nameMapFromUsers(candidateUsers)}` 배선 제거됨). `RebaselineHistory` props = `{ cycleId, userId, measureTypeByKpiId? }` 만(RebaselineHistory.tsx:15-20). page.tsx 의 `<RebaselineHistory>` 호출(page:167-171)도 cycleId/userId(+key)만 전달. grep `nameMapFromUsers|candidateMap` 0건.

## 3. [MINOR-2] 해소 — 정량 targetValue<0 백엔드 400

- [x] **백엔드 추가 검증.** `rebaseline.service.ts:112-122` — `!kpi.isQualitative && item.targetValue !== undefined && item.targetValue !== null && item.targetValue < 0` 면 400 VALIDATION_ERROR(`정량 목표값은 0 이상이어야 해요. (kpiId=…)`). null(목표값 제거)·정성 KPI 는 면제 — 계약 §7:241 문구와 일치. 검증순서(§7:266 ④)에 "정량 targetValue ≥ 0" 포함.
- [x] **프론트 게이트 유지(UX 보조).** `page.tsx:233-238` `negativeTarget` 하드 게이트 그대로 — 이제 백엔드와 이중 방어(API 직접호출도 차단). 계약·DTO·service 일치.

## 4. [MINOR-3] 해소 — 행별 lineReason dead UI 제거, 전체 reason 필수 유지

- [x] **RebaselineTable lineReason 칸 제거.** `RebaselineTable.tsx` 전체에 `lineReason`/행별 "사유 *" 입력칸 없음(직전 260-275 제거). 컬럼 = 과제명/현재목표/현재가중치/→새목표/새가중치 5개만(table:84-89). 주석(file:5-7, MINOR-3)으로 "전체 reason 만 전송" 명시.
- [x] **rowErrors prop 제거.** `RebaselineTableProps`(table:52-58) = `{ rows, onChange, readOnly? }` 만 — `rowErrors` 없음(NOTE 주석으로 향후 배선 여지만 문서화, 실코드 미배선). page.tsx `<RebaselineTable>` 호출(page:358) = `rows/onChange/readOnly` 만. grep `rowErrors|lineReason` → 코드 사용처 0건(주석 1건만 잔존, dead code 아님).
- [x] **전체 reason 필수 유지.** `page.tsx:231` `reasonOk = reason.trim().length > 0` 하드 게이트 + TextField `required`(page:367)·touched 에러(page:378-382) 유지. handleSave 전송 `reason: reason.trim()`(page:279). 백엔드 reason 필수(service:66)와 정합.

## 5. 회귀 확인

- [x] **validateWeights 시그니처 불변.** `scoring.service.ts:207-210` `validateWeights(items: { weight, isQualitative, group? }[], policy)` — 변경 없음. 호출처 4개(kpis.submit:258 / excel:255,1224 / kpi-templates:41,71 / rebaseline:157) 전부 동일 시그니처로 호출. rebaseline 의 projection(group 포함) 호환.
- [x] **기존 KPI 제출/스냅샷 경로 무영향.** rebaseline 의 confirmed 한정은 ④ 전용 경로에서만 적용 — kpis.submit(전체집합 합=100, kpis.service.ts:258)·snapshots.service 경로 무변경. KpiSnapshot 라벨 prefix(`중간 조정 전`)·audit action(`kpi.rebaseline`) 고유 격리 유지.
- [x] **①②③ 무영향.** 컨트롤러(midterm.controller.ts) rebaseline 2라우트만, @Roles(hr_admin/division_head/team_lead)(controller:67) 그대로. progress/reviews/action-items 라우트 시그니처 불변.
- [x] **타입체크 재확인(독립 실행).** `apps/api` `npx tsc --noEmit` → exit 0. `apps/web` `npx tsc --noEmit` → exit 0. 양쪽 PASS.

---

## 최종 게이트 판정: **PASS**

- **blocker 0 · major 0 · minor 0(차단성).**
- MAJOR-1 해소: 재조정 대상·가중치 검증 모집단·프론트 로드·계약 §7 모두 **confirmed 단일 모집단**으로 수렴 — 직전 UI/서버 모집단 불일치(저장 영구 disable / 400 거부) 구조적 원인 제거. 옵션 B(confirmed 통일)로 리더 확정대로 반영됨.
- MINOR-1/2/3 전부 해소: createdByName 백엔드 해석+후보맵 dead path 제거 / 정량 음수 백엔드 400 / 행별 lineReason·rowErrors dead UI 제거(전체 reason 필수 유지).
- 회귀 없음: validateWeights 시그니처·기존 KPI 제출/스냅샷·①②③ 경계 불변. 양쪽 tsc exit 0.

| 항목 | 직전 | 현재 |
|---|---|---|
| MAJOR-1 모집단 통일 | major | PASS |
| MINOR-1 createdByName | minor | PASS |
| MINOR-2 정량 음수 400 | minor | PASS |
| MINOR-3 lineReason dead UI | minor | PASS |
| 회귀(validateWeights·KPI경로·①②③) | — | PASS |
| 빌드/타입(api·web) | PASS | PASS |

**④ KPI 목표 재조정 = 릴리스 게이트 통과.** 잔존 차단 결함 없음. (참고: RebaselineTable.tsx:56 의 "향후 rowErrors 배선" NOTE 주석은 의도된 문서화로 dead code 아님 — 조치 불요.)

---

# 재조정 워크플로우 재설계(제안→검토→승인) 통합 정합성 검증 〔append · 2026-06-08, round 5〕

> 방법: 양쪽 동시 읽기(생산자↔소비자) 교차 비교. SSOT = `contract-midterm.md §7 재설계 2026-06-08`.
> 범위: 즉시-적용(POST /midterm/rebaseline) → **본인 제안→부서장 검토→승인 반영** 워크플로우 전환 전체.
> 이전 PASS(라운드 4) 결함을 전제로 신규 워크플로우만 검증.

## 검증 자산

| 측 | 파일 |
|---|---|
| 계약 | `_workspace/02_contract/contract-midterm.md §7` (재설계 2026-06-08) |
| 백엔드 노트 | `_workspace/03_backend/midterm-notes.md §E` |
| 프론트 노트 | `_workspace/04_frontend/midterm-notes.md §⑤` |
| 백엔드 구현 | `apps/api/src/modules/midterm/rebaseline.service.ts`, `midterm.controller.ts`, `dto/midterm.dto.ts`, `common/state/transitions.ts`(REBASELINE_REQUEST_TRANSITIONS), `prisma/schema.prisma`(RebaselineRequest + enum), 마이그레이션 `20260608150000_rebaseline_requests` |
| 프론트 구현 | `apps/web/hooks/useMidterm.ts`, `lib/types.ts`(Rebaseline* 신규 + 구), `components/RebaselineStatusBadge.tsx`, `app/(main)/eval/midterm/RebaselineRequestSection.tsx`, `RebaselineReviewQueue.tsx`, `EmployeeMidterm.tsx`, `DeptHeadMidterm.tsx`, `app/(main)/admin/midterm/rebaseline/page.tsx`(리다이렉트), `lib/nav.ts` |

---

## 1. 엔드포인트 계약 1:1 검증 (5 라우트 + history)

### POST /midterm/rebaseline-requests (본인 제안·제출)
- [x] **컨트롤러 라우트 존재.** `midterm.controller.ts:71` `@Post('rebaseline-requests')` → `rebaseline.create(user, dto)`.
- [x] **evaluateeId 서버 강제.** `rebaseline.service.ts:101` `const evaluateeId = current.id` — body의 DTO에 evaluateeId 없음(`CreateRebaselineRequestDto`: cycleId·reason·items만). 계약 §7 일치.
- [x] **요청 body shape.** DTO(`dto/midterm.dto.ts:124`) — `cycleId(string)`·`reason(@MinLength(1) @MaxLength(1000))`·`items(@ArrayMinSize(1) @ValidateNested RebaselineItemDto[])`. `RebaselineItemDto` = `kpiId(string)`·`targetValue?(number|null)`·`targetText?(@MaxLength(2000))`·`weight?(@IsInt @Min(0) @Max(100))`. 프론트 `CreateRebaselineRequestBody`(`types.ts:1557`) = `{cycleId, reason, items: RebaselineItem[]}`. `RebaselineItem`(`types.ts:1499`) = `{kpiId, targetValue?, targetText?, weight?}`. **필드·nullable 1:1.**
- [x] **응답 shape.** 서비스 `create()`가 `{ data: await this.serialize(created.id) }` 반환(`rebaseline.service.ts:149`). `serialize()`는 `RebaselineRequestDetail` shape(view+items+currentKpis+proposedChanges+projectedWeightSum+weightValid). 프론트 `apiPost<RebaselineRequestDetail>`(`useMidterm.ts:146`). **응답 타입 일치.**
- [x] **봉투 unwrap.** 서비스가 `{ data: ... }` 반환 → 전역 EnvelopeInterceptor가 double-wrap 없이 통과 → `apiPost`가 `res.data`로 unwrap → `RebaselineRequestDetail`. 정확.
- [x] **응답 HTTP 201.** NestJS `@Post()` 기본 201. 계약 §7 "응답 201" 일치.

### GET /midterm/rebaseline-requests (목록)
- [x] **컨트롤러.** `midterm.controller.ts:80` `@Get('rebaseline-requests')`.
- [x] **쿼리 파라미터.** `ListRebaselineRequestsQuery` = `cycleId(required)`·`evaluateeId?`·`status?(@IsEnum RebaselineRequestStatus)`·`forReview?(string|boolean)`. 프론트 `useRebaselineRequests` params = `{cycleId?, evaluateeId?, status?, forReview?}`, 전송 시 `forReview: params.forReview ? '1' : undefined`(`useMidterm.ts:123`). 백엔드 forReview 파싱: `'1'` → truthy(service:346-348). **일치.**
- [x] **응답 shape.** 서비스 `{ data: RebaselineRequestView[], meta }` 반환(service:391-394). 프론트 `apiGetList<RebaselineRequestView>`(`useMidterm.ts:119`). `RebaselineRequestView`(`types.ts:1530`) = 계약 §7 interface 1:1.
- [x] **forReview 동작.** truthy 시 `evaluateesWhereIamReviewer`로 부서장인 구성원 ids 추출 → `where.evaluateeId = { in: evaluateeIds }` + 기본 status=submitted(service:359). status 명시 시 그걸 우선(service:344,359). 계약 §7 forReview 설명 일치.

### GET /midterm/rebaseline-requests/:id (상세)
- [x] **컨트롤러.** `midterm.controller.ts:89` `@Get('rebaseline-requests/:id')`.
- [x] **응답 shape.** `detail()` → `{ data: await this.serialize(id) }` → `RebaselineRequestDetail`. 프론트 `apiGet<RebaselineRequestDetail>`(`useMidterm.ts:136`). 계약 §7 상세 타입 1:1.
- [x] **currentKpis 필드명.** 백엔드 `serialize()`에서 `currentKpis: confirmed`(service:700), 프론트 `RebaselineRequestDetail.currentKpis: RebaselineCurrentKpi[]`. 계약은 `currentKpis: RebaselineKpi[]`를 명시. **`RebaselineCurrentKpi`와 `RebaselineKpi`는 동일 shape(id·title·category·group·measureType·targetValue·targetText·weight·isQualitative·status)로 타입 호환.** 런타임 영향 없음.

### PATCH /midterm/rebaseline-requests/:id (본인 수정·재제출)
- [x] **컨트롤러.** `midterm.controller.ts:95` `@Patch('rebaseline-requests/:id')`.
- [x] **body shape.** `UpdateRebaselineRequestDto` = `reason?(MinLength(1)·MaxLength(1000))`·`items?`. 프론트 `UpdateRebaselineRequestBody`(`types.ts:1564`) = `{reason?, items?}`. 1:1.
- [x] **응답 shape.** `update()` → `{ data: await this.serialize(id) }`. 프론트 `apiPatch<RebaselineRequestDetail>`. 일치.
- [x] **rejected→submitted 전이.** `update()` 내 `wasRejected` 분기 → `assertTransition(REBASELINE_REQUEST_TRANSITIONS, rejected, submitted)` 성공 후 status=submitted + reviewer/comment/reviewedAt null 초기화(service:206-222). 계약 §7 "반려 후 수정→재제출, 직전 reviewer/comment/reviewedAt 초기화" 일치.
- [x] **approved 상태 수정 차단.** service:178-185 — `approved` 이면 400 VALIDATION_ERROR(`이미 승인된 요청은 수정할 수 없어요`). 계약 §7 "approved면 400(수정 불가)" 일치.

### PATCH /midterm/rebaseline-requests/:id/review (부서장 검토)
- [x] **컨트롤러.** `midterm.controller.ts:105` `@Patch('rebaseline-requests/:id/review')`. role 게이트 없음(서비스에서 부서장 검증).
- [x] **body shape.** `ReviewRebaselineRequestDto` = `decision(@IsIn(['approve','reject']))`·`comment?(MaxLength(2000))`. 프론트 `ReviewRebaselineRequestBody`(`types.ts:1570`) = `{decision: 'approve'|'reject', comment?}`. 1:1.
- [x] **응답 shape.** `review()` → `{ data: await this.serialize(id) }`. 프론트 `apiPatch<RebaselineRequestDetail>`. 일치.

### GET /midterm/rebaseline/history (이력 — 유지)
- [x] **컨트롤러.** `midterm.controller.ts:115` `@Get('rebaseline/history')`.
- [x] **응답 shape.** `history()` → `{ data: entries, meta }`. entries = `{snapshotId, label, createdAt, createdBy, createdByName, reason, changed}`. 프론트 `apiGetList<RebaselineHistoryEntry>`. `RebaselineHistoryEntry`(`types.ts:1483`) = 계약 §7 1:1.
- [x] **createdByName 포함.** `service:464-469` actorIds 집합으로 User.findMany → nameById 맵 → `createdByName: snap.createdBy ? nameById.get(snap.createdBy) ?? null : null`(service:481). 이전 라운드 MINOR-1 해소 상태 유지.

---

## 2. 상태 머신·전이 검증

- [x] **REBASELINE_REQUEST_TRANSITIONS 정의.** `transitions.ts:57-64` = `{submitted:[approved,rejected], rejected:[submitted], approved:[]}`. 계약 §7 상태 머신 다이어그램과 정확히 일치.
- [x] **assertTransition 강제.** `review()` — `assertTransition(REBASELINE_REQUEST_TRANSITIONS, req.status, targetStatus)` (service:268-272). 비허용 전이 시 409 `INVALID_STATE_TRANSITION`. 계약 "허용 외 전이는 409" 일치.
- [x] **rejected→submitted 전이 강제.** `update()` — wasRejected 분기에서 `assertTransition(REBASELINE_REQUEST_TRANSITIONS, rejected, submitted)` 호출(service:208-213). 합법 전이라 통과, 감사 action=`rebaseline_request.resubmit`.
- [x] **approved 종단.** transitions 맵 `approved: []` + `update()` approved 차단(400) + `review()`의 assertTransition이 `approved → *` 거부. 종단 보장.
- [x] **프론트 상태 분기 정확.** `RebaselineRequestSection.tsx` — `submitted` 시 "수정" 버튼, `rejected` 시 "수정·재제출" 버튼, `!latestReq || approved` 시 "목표 재조정 요청" 버튼(line:130-165). 상태값 리터럴 `'submitted'|'approved'|'rejected'` — 계약·백엔드 enum 문자열과 100% 일치.
- [x] **부서장 큐 승인/반려 버튼 조건.** `RebaselineReviewQueue.tsx:354` `!readOnly && req.status === 'submitted'` 일 때만 버튼 노출 — submitted 아닌 경우(approved/rejected) 조작 불가. 계약 "대상 상태: submitted만" 일치.

---

## 3. 권한(RBAC) 검증

### 생성·수정·재제출 = 본인만
- [x] **생성(POST).** 컨트롤러 `@Post('rebaseline-requests')` — role 데코레이터 없음(전체 인증 사용자 허용). 서비스 `create()`: `evaluateeId = current.id` 강제(service:101). 타인 evaluateeId 지정 경로 없음.
- [x] **수정(PATCH :id).** 서비스 `update()`: `req.evaluateeId !== current.id` 이면 403 FORBIDDEN(service:163-168). approved 이면 400(service:178-185).
- [x] **employee 포함 가능.** 컨트롤러 role 제한 없음 → employee도 본인 것 생성/수정 가능. 계약 "employee 포함 모든 인증 사용자" 일치.

### 검토(승인/반려) = 부서장만. HR 제외.
- [x] **`assertReviewerAuth` 구현.** service:807-817 — `isReviewerOf(current, evaluateeId)` false면 403 `해당 구성원의 부서장만 재조정 요청을 검토할 수 있어요`. `isReviewerOf`: `resolveDownwardEvaluators` round1/2/3 중 current.id 포함 여부(service:820-828). `current.id === evaluateeId` 이면 false(본인 자기 검토 불가).
- [x] **HR 403 강제.** `isReviewerOf` 내부에 hr_admin 예외 없음 — `resolveDownwardEvaluators`가 hr를 round에 포함하지 않으므로 hr_admin도 403. 계약 "HR은 승인자 아님 — 조회만" 일치.
- [x] **프론트 조작 불가.** `RebaselineReviewQueue`는 부서장(`canEvaluateDownward`) 화면에서만 렌더(`DeptHeadMidterm.tsx:217`). hr_admin은 DeptHeadMidterm 미렌더(G5 결정, `page.tsx:81-82` 확인). 프론트 UI 분기도 일치.

### 조회 = 본인·부서장·HR
- [x] **목록 조회 범위.** `list()`: HR=전체(service:374), 그 외=`evaluateesWhereIamReviewer(current) + [current.id]`(service:378-383). `evaluateeId` 명시 시 `canViewUser` 검증(service:363-369). 계약 §7 권한 표 일치.
- [x] **상세 조회 범위.** `detail()`: `req.evaluateeId !== current.id && current.role !== hr_admin && !isReviewerOf && !canViewUser` 이면 403(service:401-411). 계약 "본인·부서장·HR" 일치.
- [x] **이력 조회.** `history()`: `current.id !== query.evaluateeId` 이면 `canViewUser` 체크(service:422-426). 계약 403 일치.
- [x] **프론트만 숨긴 무가드 엔드포인트 없음.** 5개 라우트 + history 전부 서비스에서 소유권·부서장·canViewUser 검증. 컨트롤러 role 데코레이터 부재는 서비스 행수준 가드로 보완되므로 보안 결함 아님.

---

## 4. 적용 시점·검증 게이팅

### 실제 KPI 변경은 승인 시점에만
- [x] **applyToKpis 호출 위치.** `review()` 내 `dto.decision === 'approve'` 분기에서만 `applyToKpis()` 호출(service:300-306). reject/create/update 경로에 `applyToKpis` 미호출.
- [x] **KpiSnapshot·AuditLog 위치.** `applyToKpis()`가 tx 내 `kpiSnapshot.create` + `kpi.update` + `audit.record('kpi.rebaseline')` 실행(service:623-683). 승인 시에만 발생. 계약 "승인 시점에만" 일치.
- [x] **appliedSnapshotId 기록.** `review()` approve 분기: `RebaselineRequest.update({ appliedSnapshotId: applied.snapshotId })`(service:309-318). 계약 §7 appliedSnapshotId 일치.

### validateProposal 검증 2회(제출 시 + 승인 시)
- [x] **제출 시.** `create()`:129 `await this.validateProposal(dto.cycleId, evaluateeId, items)`.
- [x] **update(재제출) 시.** `update()`:203 `await this.validateProposal(req.cycleId, req.evaluateeId, items)`.
- [x] **승인 시.** `review()` approve 분기:299 `await this.validateProposal(req.cycleId, req.evaluateeId, items)`. 그 후 `applyToKpis`. 계약 "제출 시 + 승인 시 둘 다" 일치.
- [x] **confirmed 한정 검증.** `validateProposal()`: items 각 KPI `kpi.status !== KpiStatus.confirmed` → 400(service:531-536). 가중치 검증 모집단도 `{ status: KpiStatus.confirmed }` findMany(service:563). 이전 MAJOR-1 해소 상태 유지.
- [x] **정량 targetValue ≥ 0.** service:538-547 — 비정성 KPI에서 `item.targetValue < 0` → 400. 이전 MINOR-2 해소 상태 유지.

### mid_review 단계 게이팅
- [x] **create/update/review 모두 assertMidReviewStage 호출.** create:104, update:171, review:253 각각 `assertMidReviewStage(this.prisma, cycleId/req.cycleId, ...)`. 계약 "생성·수정·검토 모두 mid_review 단계에서만" 일치.
- [x] **프론트 선분기.** `RebaselineRequestSection`: `readOnly` prop이 `true`이면 폼 모달 미표시(line:106-108). `RebaselineReviewQueue`: `readOnly`이면 승인/반려 버튼 미노출(line:354). 백엔드 400과 이중 방어.

### 미결(submitted) 1건 제약
- [x] **백엔드.** `create()`:111-125 — `rebaselineRequest.findFirst({ where: { cycleId, evaluateeId, status: submitted } })` 있으면 400(`이미 검토 대기 중인 재조정 요청이 있어요`). 계약 "한 cycle×evaluatee 당 미결 1건" 일치.
- [x] **프론트 안내.** `RebaselineFormModal` catch 블록에서 `err.message.includes('미결')` 시 안내 토스트(`RebaselineRequestSection.tsx:489-491`). 기능 정상 동작.

---

## 5. history 유지·회귀

- [x] **history 엔드포인트 유지.** `GET /midterm/rebaseline/history` 라우트(controller:115) + service `history()` 그대로 존재. 계약 "이력 패널 GET /midterm/rebaseline/history 그대로" 일치.
- [x] **승인 반영분만 스냅샷.** `applyToKpis()`가 approve 시에만 `KpiSnapshot` 생성 → `history()`의 `label startsWith "중간 조정 전"` 필터가 자연히 승인분만 반환.
- [x] **createdByName = 승인한 부서장.** `applyToKpis()` 내 `kpiSnapshot.create({ createdBy: current.id })`(service:638) — current = 검토자(부서장). `history()` nameById 맵으로 이름 해석. 계약 "변경자(createdByName)=승인한 부서장" 일치.
- [x] **프론트 history 훅 유지.** `useRebaselineHistory`(`useMidterm.ts:160-178`) — `GET /midterm/rebaseline/history` 그대로 호출. `RebaselineRequestSection`·`RebaselineReviewQueue` 둘 다 `<RebaselineHistory>` 컴포넌트 포함.

---

## 6. 구 즉시-적용 라우트·코드 제거 확인

- [x] **백엔드 구 라우트 제거.** `midterm.controller.ts` 전체에 `@Post('rebaseline')` 없음. `RebaselineDto` 없음(`dto/midterm.dto.ts`에 `CreateRebaselineRequestDto`·`UpdateRebaselineRequestDto`·`ReviewRebaselineRequestDto` 만 정의). 계약 "폐기" 일치.
- [x] **프론트 훅 구 apply 제거.** `useMidterm.ts:104` 주석 "구 apply(POST /midterm/rebaseline) 제거". `rebaselineCommands.apply` 없음 — 파일 내 `apply` 식별자 미사용. `rebaselineRequestCommands`로 교체.
- [x] **구 admin 페이지 리다이렉트.** `app/(main)/admin/midterm/rebaseline/page.tsx` → `redirect('/eval/midterm')`. 페이지 파일 자체는 존재하되 즉시 리다이렉트. `admin/cycle/page.tsx:864` 링크 `href="/admin/midterm/rebaseline"` → 리다이렉트 경로를 통해 `/eval/midterm` 도달. 동작 정상.
- [x] **nav.ts 정리.** `midterm-rebaseline` 항목 제거, `midterm`(→`/eval/midterm`, 전 역할) 단일 항목. `activeKeyForPath`: `/admin/midterm/rebaseline → midterm`(line:235), `/eval/midterm → midterm`(line:236) 둘 다 같은 키. 일관.

---

## 7. UX 통합 · 역할별 렌더 확인

- [x] **EmployeeMidterm에 RebaselineRequestSection 통합.** `EmployeeMidterm.tsx:24`에서 import + `line:183-186` 렌더. `userId={user.id}`·`readOnly={readOnly}` 전달. 본인 제안 흐름 연결.
- [x] **DeptHeadMidterm에 RebaselineReviewQueue 통합.** `DeptHeadMidterm.tsx:30` import + `line:217` `<RebaselineReviewQueue cycleId={cycleId} readOnly={readOnly} />` Fragment 형제. 부서장 검토 큐 연결.
- [x] **역할별 화면 분리.** `page.tsx`에서 역할로 `EmployeeMidterm`(본인 제안) vs `DeptHeadMidterm`(검토 큐) 렌더. hr_admin은 G5 결정대로 C-2 미노출(DeptHeadMidterm 미렌더) — 검토자 아니므로 백엔드 403과 일관.
- [x] **상태배지 3값 정확.** `RebaselineStatusBadge.tsx:14-18` = `{submitted: '검토 대기', approved: '반영 완료', rejected: '반려'}`. `RebaselineRequestStatus`(`types.ts:1496`) = `'submitted'|'approved'|'rejected'`. 백엔드 enum(`RebaselineRequestStatus: submitted/approved/rejected`, schema:182-185) 문자열 3자 일치.
- [x] **반려 코멘트 표시.** `RequestStatusPanel`(`RebaselineRequestSection.tsx:247-269`) — `isRejected` 시 `detail.reviewComment` 표시. 반려 사유 전달 경로 존재.
- [x] **가중치 경고 UI.** `RequestStatusPanel`: submitted 배너에 `projectedWeightSum` + weightValid 경고 표시(line:239-245). `ReviewDetailPanel`: `!detail.weightValid` 시 경고 배너 + 승인 버튼 `disabled={!detail.weightValid}`(line:325-374). 백엔드 재검증 400과 이중 안전장치.
- [x] **빈 상태·로딩·에러.** Skeleton(reqListLoading:113-117), EmptyState(!latestReq:175-179), ApiError catch(489). 계약 안내 토스트 패턴 일치.

---

## 8. 감사 로그 준수 (계약 §5)

- [x] **submit.** `create()` audit `rebaseline_request.submit`(service:141-147). after = `{cycleId, evaluateeId, reason, items}`.
- [x] **update.** `update()` audit `rebaseline_request.update`(service:228-237, wasRejected=false).
- [x] **resubmit.** `update()` wasRejected=true 시 audit `rebaseline_request.resubmit`(service:228-237).
- [x] **approve.** `review()` approve 분기 audit `rebaseline_request.approve`(service:321-333). after에 `appliedSnapshotId·changed` 포함.
- [x] **reject.** `review()` reject 분기 audit `rebaseline_request.reject`(service:287-294).
- [x] **kpi.rebaseline(승인 시만).** `applyToKpis()` 감사 — entity=`Kpi`, action=`kpi.rebaseline`, after에 `reason·snapshotId·requestId·requesterId·reviewerId` 포함(service:661-683). 계약 §5 after 필드 명세 일치.

---

## 9. 스키마·마이그레이션 검증

- [x] **RebaselineRequest 모델.** `schema.prisma:963-986` — 필드: id·cycleId·evaluateeId·reason·items(Json)·status·reviewerId?·reviewComment?·reviewedAt?·appliedSnapshotId?·createdAt·updatedAt. FK: cycle(Cascade)·evaluatee(Restrict)·reviewer?(SetNull). 인덱스: cycleId·evaluateeId·(cycleId,evaluateeId)·reviewerId·status.
- [x] **마이그레이션 SQL 정합.** `20260608150000_rebaseline_requests/migration.sql` — enum 생성(`submitted/approved/rejected`)·테이블·인덱스 5개·FK 3개(Cascade/Restrict/SetNull). schema와 1:1.
- [x] **User 관계 추가.** `schema.prisma:252-253` `rebaselineRequestsAsEvaluatee` + `rebaselineRequestsAsReviewer` User 관계 존재.

---

## 10. 타입 정합 주의 사항 (MINOR — 비차단)

### [MINOR-A] 구 RebaselineRequest·RebaselineResult 타입이 types.ts에 잔존
- **위치:** `apps/web/lib/types.ts:1459-1480`.
- **내용:** 즉시-적용 시절 타입 `RebaselineRequest`(POST /midterm/rebaseline 요청)·`RebaselineResult`(응답)이 주석 "POST /midterm/rebaseline"과 함께 남아 있음. 백엔드 라우트는 삭제됐고, `useMidterm.ts`에서도 이 타입들을 import하지 않음.
- **영향:** 실제 코드 경로에서 미사용 — 런타임·타입체크 무영향. 이름 충돌: `RebaselineRequest`가 새 워크플로우에서는 `RebaselineRequestView`/`RebaselineRequestDetail`로 대체됐으므로 혼동 소지만 있음. grep 결과: `export interface RebaselineRequest`·`export interface RebaselineResult`이 types.ts에만 있고 훅·컴포넌트 어디서도 import 없음.
- **권장:** `types.ts:1459-1480` 구 타입 블록 제거(또는 `// @deprecated` 주석 추가). 기능 무영향.
- **담당:** frontend.

### [MINOR-B] RebaselineCurrentKpi와 RebaselineKpi — 계약과 타입명 분기
- **위치:** `apps/web/lib/types.ts:1446`(`RebaselineKpi`), `types.ts:1507`(`RebaselineCurrentKpi`).
- **내용:** 계약 §7은 `currentKpis: RebaselineKpi[]`(상세 타입)를 명시했으나, 프론트는 `RebaselineCurrentKpi`라는 별도 타입을 정의해 사용. 두 타입은 완전히 동일한 shape(id·title·category·group·measureType·targetValue·targetText·weight·isQualitative·status). `RebaselineKpi`는 구 즉시-적용 응답(`RebaselineResult.kpis`)용으로도 여전히 존재.
- **영향:** 런타임 무영향. 타입명이 계약과 다르고 동일 shape가 2개 정의된 중복. 계약과 코드를 함께 읽을 때 혼동 소지.
- **권장:** `RebaselineRequestDetail.currentKpis`를 `RebaselineCurrentKpi[]` 대신 `RebaselineKpi[]`로 통일, 또는 계약 §7을 `RebaselineCurrentKpi`로 갱신. 구 `RebaselineKpi`는 구 타입 블록과 함께 제거.
- **담당:** frontend.

---

## 11. 회귀 확인

- [x] **기존 KPI 경로 무영향.** rebaseline.service.ts는 `Kpi.update`·`KpiSnapshot.create`·`AuditLog` 만 접근. `KpiStatus.confirmed` 필터는 ④ 전용 경로 한정. `validateWeights` 시그니처 불변.
- [x] **①②③ 경계 무변경.** 컨트롤러에 rebaseline 5+1 라우트만 추가. progress/reviews/action-items 라우트 시그니처·서비스·DTO 불변. ACTION_ITEM_TRANSITIONS 미변경.
- [x] **ActionItem 등급 미반영 유지.** ④ 워크플로우는 Kpi·KpiSnapshot·AuditLog만 접촉. scoring/results/compensations 경로 무접촉.
- [x] **이전 MAJOR/MINOR 해소 상태 유지.** 모집단 confirmed 통일(MAJOR-1)·createdByName 매핑(MINOR-1)·정량 음수 400(MINOR-2)·lineReason dead UI 제거(MINOR-3) — 재설계 이후에도 그대로 유지됨.

---

## 결함 요약

| ID | 심각도 | 설명 | 담당 | 차단여부 |
|---|---|---|---|---|
| MINOR-A | minor | 구 RebaselineRequest·RebaselineResult 타입 잔존(`types.ts:1459-1480`) | frontend | 비차단 |
| MINOR-B | minor | RebaselineCurrentKpi·RebaselineKpi 동일 shape 중복 정의 — 계약 타입명과 분기 | frontend | 비차단 |

---

## 게이트 판정: **PASS**

- **blocker 0 · major 0 · minor 2(비차단).**

| 검증 영역 | 결과 |
|---|---|
| 엔드포인트 5+1 — 요청/응답 shape 1:1 | PASS |
| 봉투 unwrap(단건 apiPost/apiGet/apiPatch, 목록 apiGetList) | PASS |
| 상태 머신(submitted→approved/rejected, rejected→submitted, approved 종단) | PASS |
| assertTransition 강제(409 INVALID_STATE_TRANSITION) | PASS |
| 권한 — 생성/수정=본인, 검토=부서장(HR 제외), 조회=본인·부서장·HR | PASS |
| 적용 시점 — KPI 변경·스냅샷·감사가 승인 시점에만 | PASS |
| validateProposal 2회(제출+승인) · confirmed 한정 · 정량≥0 | PASS |
| mid_review 단계 게이팅(create/update/review 모두) | PASS |
| 미결 1건 제약(서비스 검증) | PASS |
| 구 라우트(POST /midterm/rebaseline) 제거 확인 | PASS |
| 구 apply 훅 제거 확인 | PASS |
| 구 admin 페이지 리다이렉트(/eval/midterm) | PASS |
| history 유지·승인분만 스냅샷·createdByName=부서장 | PASS |
| 감사 로그 5종(submit/update/resubmit/approve/reject+kpi.rebaseline) | PASS |
| 상태 배지·반려 코멘트·가중치 경고 UX | PASS |
| 역할별 EmployeeMidterm/DeptHeadMidterm 렌더 분리 | PASS |
| 스키마·마이그레이션 SQL 1:1 | PASS |
| 회귀(KPI 경로·①②③·이전 결함 해소 상태) | PASS |
| 빌드/타입(api·web tsc — 노트에 PASS 보고) | PASS |

**재조정 워크플로우 재설계(제안→검토→승인) = 릴리스 게이트 통과.** 잔존 차단 결함 없음. MINOR-A/B는 타입 정리 수준으로 후속 clean-up 시 처리 권장.

---

# ⑦ 중간 점검 루틴 재구성 검증 〔2026-06-08〕

> 방법: 양쪽 동시 읽기(생산자↔소비자) + `npm run typecheck`/`npm run build` 직접 실행.
> 변경 범위: 프론트 화면·디자인·사이드바 아이콘 한정 — 백엔드·API·계약 미변경.
> SSOT: `component-spec-midterm.md "재설계 2026-06-08"` 섹션(R0~R9).
> 회귀 기준: 이전 라운드(①②③·④·워크플로우 재설계) 전 항목 PASS 상태.

---

## 1. 빌드 / 타입체크 직접 실행 결과

```
apps/web $ npx tsc --noEmit   →  exit 0  (출력 없음 = 0 errors)
apps/web $ npx next build      →  exit 0

빌드 결과 (관련 라우트):
  /eval/midterm              17.1 kB   (정상 생성 — 이전 15.3kB 대비 Stepper 추가 반영)
  /admin/midterm/rebaseline   147 B    (리다이렉트 유지)
  총 35개 이상 라우트 정상 생성
```

**결론: PASS (0 errors, 0 warnings, 0 failed routes)**

---

## 2. 검증 체크리스트

### [C1] 단계 상태 도출 정합 — 새 API 호출 없음

- [x] **page.tsx 훅 재사용 확인.** `useMidtermReviews`·`useActionItems`·`useRebaselineRequests`·`useEvaluations` — 모두 기존 훅 시그니처 그대로 사용(page.tsx:40-69). 새 훅 신설 없음.
- [x] **employee 5단계 상태 도출(page.tsx:72-165).** 스펙 R2-A 로직과 1:1.
  - 단계1: 항상 `'done'`(진입=확인, status: 'done', subLabel: '완료').
  - 단계2: `myReview.status`로 분기 — `!myReview || status==='pending'` → active(2), 그 외 → done(2→active 전진).
  - 단계3: `status==='self_done'` → active(3), `confirmed` → done(3→active 전진).
  - 단계4: `confirmed && !actionsDone` → active(4). `actionsDone = length===0 || every done|canceled`.
  - 단계5: `latestReq?.status==='submitted'` → active(5, 검토 대기 중). 그 외 → active(5, 완료/필요시 요청).
  - 스펙 `employeeStep()` 의사코드와 논리 일치. 5단계 배열 반환 확인.
- [x] **deptHead 4단계 상태 도출(page.tsx:168-247).** 스펙 R2-B 로직과 1:1.
  - 단계1: 항상 `'done'`(구성원 진척 검토 = 진입시 완료).
  - 단계2: `confirmedCount < totalTargets` → active(2). `totalTargets` = downward eval 대상 수(deptEvalsData.data), `confirmedCount` = reviewMap에서 status==='confirmed' 집계.
  - 단계3: `confirmedCount >= totalTargets && itemCount === 0` → active(3). `itemCount` = deptActionData.data.length.
  - 단계4: pendingRbl(status==='submitted' 건수) 기반 subLabel. activeStep 결정 로직: step2 미완→2, step3 미완→3, 그 외→4(스펙 `deptHeadStep()` 의사코드 일치).
  - **주의 관찰(비차단):** 스펙에서 `pendingRbl > 0` → activeStep=4 로 명시했으나, 구현에서는 `confirmedCount >= totalTargets && itemCount > 0` 이면 무조건 activeStep=4(pendingRbl 유무 불문). 실질적으로 step3 완료 후 단계4가 "대기 없음" 상태로도 표시되는 차이. 기능 버그 아님 — step4 표시 범위가 더 넓은 것(더 안전한 방향). 스펙 `return 4` 최종 분기와 결과는 동일. **비차단.**
- [x] **봉투 unwrap 불변.** Stepper 전용 훅 데이터는 기존 훅 응답 재사용 — `myReviewsData?.data`, `myActionData?.data`, `myRebaselineData?.data`, `deptEvalsData?.data` 등 이전 라운드 검증된 unwrap 경로 그대로.
- [x] **useMidterm.ts 시그니처 불변.** 훅 파라미터·반환 타입 변경 없음. page.tsx에서 `enabled` 옵션으로 HR은 employee 훅 비활성(line:41-43의 `!isHr` 조건). HR 불필요 호출 없음.

### [C2] 사이드바 아이콘 — NAV_ICONS 완전성

- [x] **Milestone import 존재.** `AppShell.tsx:34` `Milestone,` lucide-react import 목록에 포함.
- [x] **NAV_ICONS 매핑 존재.** `AppShell.tsx:89` `midterm: Milestone,` — 기존 NAV_ICONS 객체에 정상 추가됨.
- [x] **Milestone 아이콘 실재 확인(빌드로 검증).** `npm run build` exit 0 → lucide-react에서 Milestone이 정상 export됨. (스펙 R1: "현재 NAV_ICONS에 미등록 확인됨" — 기존 15개 아이콘과 중복 없음.)
- [x] **NAV_ITEMS midterm 키 존재.** `lib/nav.ts:82-87` key='midterm', href='/eval/midterm' 항목 존재. NAV_ICONS의 `midterm` 키와 일치.
- [x] **NAV_ICONS 미등록 키 점검.** `lib/nav.ts`의 모든 NAV_ITEMS key 목록(dashboard·user-mgmt·perm-mgmt·eval·my-eval·kpi·kpi-review·competency-items·competency-eval·midterm·self·dept-head·result·group-performance·monthly-performance·eval-summary·appeals·reports·yoy·cycle-ops·kpi-import·rules·compensation·settings·audit) 중 `audit`을 제외한 전체가 NAV_ICONS에 존재함 확인. `audit`는 NAV_ICONS에 없으나 AppShell이 아이콘 없는 항목을 정상 처리하는 기존 동작(스크롤로 ScrollText 아이콘이 있음 — `audit: ScrollText` 확인). **누락 0건.**

### [C3] 라우팅

- [x] **`/eval/midterm` 실재 경로.** `apps/web/app/(main)/eval/midterm/page.tsx` 존재. route group `(main)` URL 제거 → `/eval/midterm`. 빌드 출력에 `/eval/midterm 17.1kB` 정상 생성.
- [x] **`activeKeyForPath` midterm 매핑.** `lib/nav.ts:235-236` — `/admin/midterm` 접두어 → 'midterm', `/eval/midterm` → 'midterm'. 양쪽 경로 모두 동일 키로 사이드바 활성화됨.
- [x] **InfoBanner `title` prop.** `page.tsx:300` `<InfoBanner tone="tip" title="중간평가는 점검·코칭 단계예요">` — 스펙 R8 변경 구조와 일치. title prop을 받는 InfoBanner 컴포넌트가 기존에 title prop을 지원하는지 빌드로 검증(exit 0 — 타입 호환 확인).
- [x] **`/admin/midterm/rebaseline` 리다이렉트 유지.** 147B 라우트 존재 — 이전 라운드 확인된 `redirect('/eval/midterm')` 그대로.

### [C4] MidtermStepper — 스펙 정합

- [x] **파일 신규 생성.** `apps/web/components/MidtermStepper.tsx` 존재.
- [x] **역할별 단계 수.** employee: `employeeSteps` = `[step1,step2,step3,step4,step5]` 5개(page.tsx:164). deptHead: `deptHeadSteps` = `[step1,step2,step3,step4]` 4개(page.tsx:246). HR: Stepper 미렌더(`!isHr` 조건, page.tsx:313).
- [x] **StepStatus 3값.** `done|active|pending` — 스펙 R2-C와 일치(`MidtermStepper.tsx:8`).
- [x] **상태별 시각 토큰.** STEP_TOKEN 매핑(MidtermStepper.tsx:16-47):
  - done: circleBg=T.blue500(`#3182f6`), numColor='#fff' → 스펙 R3 done 행 일치.
  - active: circleBg='#fff', circleBorder=`2px solid ${T.blue500}`, numColor=T.blue500 → 스펙 일치.
  - pending: circleBg=T.grey100, numColor=T.grey400 → 스펙 일치.
- [x] **done 단계 체크 아이콘.** `step.status==='done'` 시 `<CheckCircle2 size={14} color="#fff" />` 표시(line:95). 번호 대신 체크 아이콘 — 스펙 R3 일치.
- [x] **연결선 색 분기.** `step.status==='done' ? T.blue500 : T.grey200`(line:144) — 스펙 R9 done 연결선=blue500, pending=grey200 일치.
- [x] **반응형.** `flex flex-col gap-3 md:flex-row md:items-start md:gap-0`(line:53) — md 이하 세로, md 이상 가로. 스펙 R3 반응형 일치. 연결선은 `className="hidden flex-1 md:block"`(line:140) — md↓ 숨김.
- [x] **접근성 aria-current.** `aria-current={step.status === 'active' ? 'step' : undefined}`(line:74) — 스펙 R3 접근성 요구사항 일치. 추가로 `aria-label`에 "완료됨"/"현재 단계"/"대기 중" 포함(line:63-69). `<ol aria-label="중간 점검 진행 단계">`(line:52).
- [x] **subLabel 지원.** `StepDef.subLabel?: string`(line:12). page.tsx가 단계별 상황 설명 subLabel 주입(R8 "지금 뭘 하면 되는지" CTA 일치).
- [x] **activeIndex prop 미구현.** 스펙 R3 Props에 `activeIndex: number` 명시됐으나 구현체는 `{ steps: StepDef[] }` 만 받음. 대신 각 `StepDef.status`에서 활성 단계를 도출 — 스펙 본문에도 "steps[i].status 로도 도출 가능"이라 명시. 기능 동등, 타입체크 통과. **비차단.**

### [C5] 디자인 정렬 — 그룹 섹션 색 토큰

- [x] **MidtermProgressTable GROUP_CFG 정의.** `MidtermProgressTable.tsx:22-25`:
  ```ts
  const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
    performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
    collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
  };
  ```
- [x] **eval/self·kpi/page GROUP_CFG 동일 토큰.** `apps/web/app/(main)/eval/self/page.tsx:59-62` 및 `apps/web/app/(main)/kpi/page.tsx` 동일 정의(grep 확인 — 3개 파일 동일 HEX 값). 스펙 R5 "GROUP_CFG 색 동일 적용" 일치.
- [x] **그룹 섹션 헤더 4px 좌측 바.** `MidtermProgressTable.tsx:98` `borderLeft: '4px solid ${cfg.bg}'` — 스펙 R4-B "4px 좌측 라인" 일치.
- [x] **단일 그룹 헤더 생략.** `multiGroup = GROUP_ORDER.filter(...).length > 1`(line:68) — 단일 그룹 items면 헤더 미표시. 스펙 "단일 그룹이면 헤더 생략" 일치.

### [C6] EmployeeMidterm — 단계 칩 + 카드 강조

- [x] **StepChip 컴포넌트(인라인 정의).** done=`{background:'#3182f6', color:'#fff'}`, active=`{background:'#EBF3FE', color:'#1B64DA'}`, pending=`{background:'#F2F4F6', color:'#B0B8C1'}` — 스펙 R4-B 칩 색 명세 일치(line:37-41).
- [x] **Card title에 StepChip 삽입.** 단계1 Card title에 `<StepChip num={1} status="done" />`(line:175), 단계2에 `<StepChip num={2} status={step2Status} />`(line:201) 등. Card.tsx `title?: React.ReactNode`(CardProps:12) — title을 ReactNode로 받으므로 타입 호환 확인.
- [x] **Card.tsx title prop ReactNode 변경.** `CardProps.title?: React.ReactNode`(Card.tsx:12) — 스펙 변경 지시(string→ReactNode) 반영됨. tsc PASS.
- [x] **active 카드 1px blue 테두리.** `style={{ border: step2Status === 'active' ? activeBorder : defaultBorder }}`(EmployeeMidterm.tsx:197, 244, 294, 324). activeBorder=`1px solid ${T.blue500}`(line:165). 단계2·3·4·5 모두 active 시 파란 테두리 적용.
- [x] **보완 조치 빈 상태 텍스트.** `<EmptyState title="부서장이 보완 조치를 등록하면 여기서 진행 상태를 갱신할 수 있어요." />`(line:306) — 스펙 R4-B "상황 설명 개선" 일치.
- [x] **부서장 피드백 확인 단계(3) Card 신규.** `/* ③ 부서장 피드백 확인 — 단계 3 */`(line:243) 섹션 추가됨 — confirmed 여부·selfDone 여부에 따라 3가지 상태(확인완료/대기/미제출) 표시.

### [C7] DeptHeadMidterm — 단계 의미 명시 + InfoBanner 격상

- [x] **Card title 단계 의미 명시.** `title="① 구성원 진척 검토 · ② 자가점검 확인"`(DeptHeadMidterm.tsx:110) — 스펙 R4-C "단계 의미 명시" 일치.
- [x] **부서장 확인 미제출 InfoBanner 격상.** `{!readOnly && !selfSubmitted && (<InfoBanner tone="info">구성원이 자가 점검을 제출하면...</InfoBanner>)}`(line:449-453) — 스펙 R4-C "inline span → InfoBanner(info) 격상" 일치.
- [x] **RebaselineReviewQueue 유지.** `<RebaselineReviewQueue cycleId={cycleId} readOnly={readOnly} />`(line:218) — 이전 라운드 확인된 검토 큐 연결 무변경.

### [C8] 회귀 확인

- [x] **RebaselineRequestSection 미변경.** EmployeeMidterm.tsx 내 `<RebaselineRequestSection cycleId={cycleId} userId={user.id} readOnly={readOnly} />`(line:325) — 이전 라운드 검증된 props 시그니처 그대로. 기존 동작 무변경.
- [x] **RebaselineReviewQueue 미변경.** DeptHeadMidterm.tsx:218 — 이전 라운드 검증된 호출 그대로.
- [x] **OrgProgressCard 미변경.** `<OrgProgressCard cycleId={cycleId!} userId={user.id} />`(page.tsx:338) — HR·부서장에게만 노출. 코드 무변경.
- [x] **게이팅(mid_review 외 readOnly) 유지.** `readOnly={!isMidReview}`가 EmployeeMidterm·DeptHeadMidterm 모두에 전달(page.tsx:325,332). 이전 라운드 G1 결정 그대로.
- [x] **RBAC 유지.** `isDeptHead = canEvaluateDownward(role) && !isHrAdmin(role)`, `isHr = isHrAdmin(role)` — 이전 라운드 검증된 분기 로직 불변.
- [x] **봉투 unwrap·camelCase·enum 무변경.** 이번 변경은 화면 조합 레이어만 — API 응답 처리 코드 미접촉. 이전 라운드 경계면 검증 유효.
- [x] **actionItem 전이 강제 유지.** ActionItemRow mode/onChangeStatus 호출 경로 불변. INVALID_STATE_TRANSITION 409 처리 로직 무변경(EmployeeMidterm.tsx:132-138).

---

## 3. 결함

결함 없음 — blocker 0 · major 0 · minor 0.

> **관찰 사항(비차단, 수정 불요):**
> - **OBS-1:** `deptHeadStep` 구현에서 `pendingRbl > 0` 여부와 무관하게 step3 완료 시 activeStep=4로 고정됨. 스펙 의사코드 최종 분기(`return 4`)와 결과 동일하며 기능 버그 아님. 단계4 "요청 대기 없음" subLabel이 적절히 처리됨(line:241).
> - **OBS-2:** `MidtermStepper`가 스펙의 `activeIndex: number` prop을 구현하지 않고 `StepDef.status` 기반 도출로 대체. 스펙에 "steps[i].status 로도 도출 가능"으로 명시된 의도된 구현 선택.

---

## 4. 게이트 판정: PASS

| 검증 항목 | 결과 |
|---|---|
| 빌드(`npm run build`) | PASS (exit 0) |
| 타입체크(`npm run typecheck`) | PASS (0 errors) |
| 단계 상태 도출 정합 (새 API 호출 없음) | PASS |
| 봉투 unwrap·camelCase 불변 | PASS |
| 사이드바 아이콘(midterm=Milestone, 누락 0) | PASS |
| 라우팅(`/eval/midterm` 실재, activeKeyForPath 'midterm') | PASS |
| MidtermStepper 단계 수·상태·접근성(aria-current) | PASS |
| 디자인 정렬(GROUP_CFG 색 eval/self 동일, 4px 좌측 바) | PASS |
| EmployeeMidterm StepChip·active 테두리·빈 상태 텍스트 | PASS |
| DeptHeadMidterm 단계 의미·InfoBanner 격상 | PASS |
| Card.tsx title ReactNode 변경 | PASS |
| 회귀(RebaselineRequestSection·ReviewQueue·OrgProgressCard·게이팅·RBAC) | PASS |

**blocker 0 · major 0 · minor 0.** 프론트 화면 재구성은 기존 API 호출·봉투·RBAC·게이팅에 영향 없이 화면 조합 레이어만 변경됐으며, 모든 경계면이 이전 라운드 PASS 상태를 유지한다. 릴리스 게이트 통과.
