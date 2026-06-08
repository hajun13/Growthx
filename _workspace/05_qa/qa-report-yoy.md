# QA 리포트 — 연도 누적(YoY) 평가 비교 통합 정합성

> 계약 권위: `_workspace/02_contract/contract-yoy.md`. 검증 방식: 양쪽 동시 읽기(생산자↔소비자).
> 회귀 확인: `apps/api` tsc `--noEmit` exit 0, `apps/web` tsc `--noEmit` exit 0 (타입 레벨 무회귀).
> 작성: qa-inspector · 통지 대상: backend-engineer ∥ frontend-engineer

## 경계면별 PASS/FAIL 요약

| # | 경계면 | 판정 |
|---|--------|------|
| 1 | 응답 봉투/타입 (compare·distribution 단건 `{data}` ↔ `apiGet` unwrap, 필드 1:1) | PASS |
| 2 | enum/snake_case (LegalEntity·EmploymentStatus ↔ 한글 라벨 매핑) | PASS |
| 3 | 라우팅 (정적 compare/distribution < :userId 순서, nav href, activeKey 순서) | PASS |
| 4 | RBAC (compare·distribution visibilityScope 행수준 가드 → 403 → ErrorState) | PASS |
| 5 | byType 키 공존 — 기존 결과 화면 비회귀 | **FAIL (HIGH)** |
| 6 | 스냅샷 조직명 ↔ 현재 부서명 매칭 (distribution 빈 분포/overall 폴백) | **WARN (MEDIUM)** |
| 7 | 임포트 멱등/매칭 + 퇴사 User 숨김 | PASS (분포 7-b WARN) |
| 8 | null/빈상태 (finalGrade·comp null → "—"·라인 단절) | PASS |

---

## [FAIL · HIGH] #5 — 임포트 byType(round1/2/final) 가 기존 결과 화면을 런타임 크래시시킴

**원인:** 임포트 결과는 `byType = { round1, round2, final, source }` 형태(생산자: `excel.service.ts:594-599`).
라이브 결과는 `byType = { self, downward1, downward2 }`. 두 키 집합은 **공존**하며 `EvaluationResult` 상세 응답(`results.service.ts:90-99,118-133` `getDetail`→`toDto`)은 **byType 를 분기 없이 그대로 통과**시킨다. 소비 측 3개 화면이 라이브 shape 를 단정하고 `bt.self.score` / `bt.downward1.comment` 를 직접 접근 → 임포트 결과(2025 사이클)를 열면 `TypeError: Cannot read properties of undefined`.

소비자(크래시 지점):
- `apps/web/app/(main)/eval/result/[userId]/page.tsx:32` — `bt.self.score !== null` (`if(!bt)return[]` 만 가드, `bt.self` 자체는 undefined). 같은 패턴 `:39,:47` 및 `:133-138` `bt?.downward1.comment`.
- `apps/web/components/EvalReport.tsx:328` — `bt?.downward1.comment` (옵셔널 체인이 `bt?` 에서만 끊겨 `undefined.comment` 평가 → throw). `:337,:340,:343` 동일.
- `apps/web/app/(main)/eval/my/page.tsx:132-134` — `mk('본인평가','본인', bt?.self, ...)` 로 entry 를 넘기므로 `mk` 가 null-guard 하면 안전(확인 필요), 단 `bt?.self` 는 undefined 전달.

**재현 경로:** 평가결과 상세 화면 헤더의 사이클 셀렉터(`page.tsx:153-155` `useCurrentCycle` 의 `cycles`)에서 **closed 상태의 2025 정기평가 사이클**을 선택하면 임포트 결과가 로드됨 → 크래시. compare 탭에서 결과상세로 딥링크 진입 시에도 동일.

**왜 tsc 가 못 잡나:** `toDto` 가 `byType: unknown` 을 반환하고 프론트 `EvaluationResultDetail.byType: EvaluationByType | null` 로 단정 캐스트 → 런타임 shape 불일치를 컴파일러가 우회.

**수정(택1, 생산자 측 권장):**
- (백엔드 권장) `results.service.ts` `toDto` 에서 `byType.source === 'import'`(또는 `round1`/`final` 키 존재) 인 경우 **상세 응답용으로 정규화** — 라이브 키(`self/downward1/downward2`)를 `null` entry 로 채워 내려보내거나, `byType` 를 라이브 화면이 기대하는 형태로 매핑. 임포트 결과는 라운드별 원형이므로 상세 화면 표시 정책을 계약에 명시 필요(현재 계약 §2 는 "소비 측이 source 로 분기"라고만 규정 → 기존 상세 화면은 미대응).
- (프론트엔드 보강, 필수) 세 소비자에서 `bt.self`/`bt.downward1`/`bt.downward2` 접근 전 **존재 검사** 추가: `const live = bt && 'self' in bt ? bt : null;` 후 `live?.self?.score ?? null`. `EvalReport.tsx:328,334,340` 의 `bt?.downward1.comment` → `bt?.downward1?.comment` 로 옵셔널 체인 연장. `EvaluationByType` 타입을 `{ self?:..., downward1?:..., downward2?:... }` 또는 유니온으로 완화해 컴파일러가 강제하도록.

> backend·frontend **양쪽 통지**. 계약상 임포트 결과를 기존 상세 화면에서 어떻게 표시할지(라운드별 표시 vs 차단)가 미정의 → 리더에게 계약 보완 요청 권장.

---

## [WARN · MEDIUM] #6 — distribution OrgPicker: 현재 부서명 vs 스냅샷 조직명 (조직개편/개명 시 미스매치)

**메커니즘(양쪽 동시 확인):**
- 소비자 `OrgDistributionPanel.tsx:53,90` — OrgPicker 후보는 `useDepartments({type:scope})`(현재 부서). 선택값은 **현재 `dept.id`**, 버킷 매칭은 `selectedDeptName = depts.find(d=>d.id===deptId)?.name`(`:90`) → `c.buckets.find(b=>b.deptName===selectedDeptName)`(`:95`).
- 생산자 `comparison.service.ts:181-187,226-229` — `query.deptId` → 현재 `Department.name` 으로 환원(`:182-186`) 후, **스냅샷 조직명**(`groupSnapshot/divisionSnapshot/teamSnapshot`, `:202-210`)과 문자열 비교로 필터.

**정합성:** 양쪽 모두 **이름(name) 기준**으로 키를 맞추므로 contract 위반은 아님(계약 §4 "스냅샷 조직명 기준"). 그러나 현재 부서명 == 스냅샷 조직명일 때만 성립. **조직 개명/개편으로 현재 부서명이 과거 스냅샷명과 달라지면:**
1. 백엔드: `deptNameFilter`(현재명) 가 어떤 스냅샷 버킷과도 불일치 → 해당 사이클 버킷 0개.
2. 프론트: `bucket` undefined → `c.overall`(전체) 로 **조용히 폴백**(`OrgDistributionPanel.tsx:94-104`) → 사용자는 "특정 조직 선택"했는데 전체 분포를 봄(오해 유발, 에러·빈상태 없음).

또한 OrgPicker 는 현재 조직표에 **없는 과거(폐지) 조직** 스냅샷을 선택지로 제공하지 못함 → 폐지 조직 분포는 deptId 미지정(전체)에서만 보임.

**판정:** 하드 결함 아님(폴백 동작·당시조직 안내 배너 `:228` 존재). 단 **조직개편 환경에서 침묵 폴백은 UX 리스크**. 프론트가 사전 플래그한 항목과 일치.

**권고(프론트):** `selectedDeptName != null` 인데 `bucket === undefined` 면 overall 폴백 대신 "해당 사이클에 이 조직의 당시 데이터가 없어요" 빈상태/주석 표시. 장기적으로 OrgPicker 후보를 응답 `buckets[].deptName`(스냅샷명) 합집합에서 도출하면 폐지 조직도 선택 가능(계약에 분포 응답 기반 옵션화 추가 검토).

---

## [WARN · LOW] #7-b — `includeResigned` 토글이 distribution 집계에 미반영

**확인:** `YoyComparePage.tsx:32` `includeResigned`(분포 탭 기본 ON) 를 `OrgDistributionPanel` 에 prop 으로 전달하나, `OrgDistributionPanel`(`:38-42`)는 이를 **구조분해에서 누락**하고 `useYoyDistribution`(`:60-65`)에도 전달하지 않음. distribution API(`comparison.service.ts:190-199`)는 `user.isActive` 와 무관하게 **모든 EvaluationResult 를 스냅샷 기준으로 집계**(퇴사자 결과 포함). 즉 분포는 항상 "당시 인원(퇴사 포함)" 기준 — 계약 §4 의도(스냅샷 기준)와 일치하므로 **결과적으로 정상**. 다만 토글이 분포 탭에서 **아무 효과 없음**(개인 탭 PersonPicker 후보에만 영향). UI 가 토글에 hint(`:77 hint={tab==='org'}`)를 주지만 동작 안 함 → 사용자 혼선.
**권고(프론트):** 분포 탭에서 토글을 숨기거나, hint 문구를 "분포는 항상 당시 인원(퇴사 포함) 기준" 안내로 고정. API 변경 불필요.

---

## PASS 상세 (양쪽 동시 읽기 근거)

### #1 응답 봉투/타입 — PASS
- 생산자 `comparison.service.ts:122-130`(`return {data:{...}}`), `:279`(`{data:{scope,cycles}}`) 단건 봉투.
- 소비자 `useYoyCompare.ts:18` `apiGet<CompareResult>`, `useYoyDistribution.ts:31` `apiGet<DistributionResult>` — `apiGet`(`api.ts:145-148`)이 `json.data` unwrap. 목록 봉투(`apiGetList`) 오용 없음, 이중 `res.data` 접근 없음.
- 필드 1:1: `CompareTimelineEntry`(perf/comp/org{group,division,team}/ruleSummary{competencyIncluded,gradeScaleLabel,source}) ↔ `lib/types.ts:929-940`, `DistributionBucket`(deptName/total/counts/ratios) ↔ `:950-955`, `DistributionCycle.overall` ↔ `:956-966`. 계약 §6 과 완전 일치.

### #2 enum/snake_case — PASS
- 응답 enum 원형 유지: `legalEntity:"energyx"|"mirae_plan"`, `employmentStatus:"active"|"on_leave"|"resigned"`(`comparison.service.ts:77,126-127`). 마이그레이션 enum `migration.sql:5-8` 일치.
- 한글 라벨 매핑 프론트 전담: `lib/ui.ts:363-377`(energyx→에너지엑스㈜, mirae_plan→미래환경플랜, resigned→퇴사). `PersonTimelinePanel.tsx:173-184` 에서 `legalEntityLabel`·퇴사 뱃지 사용. snake_case 누출 없음.

### #3 라우팅 — PASS
- 컨트롤러 선언 순서 `results.controller.ts`: `compare`(:41) → `distribution`(:46) → `:userId/export`(:58) → `:userId`(:79). **정적 경로가 동적 `:userId` 보다 먼저** → `compare`/`distribution` 가 userId 로 오인되지 않음.
- nav href `/reports/yoy`(`nav.ts:123`) ↔ 페이지 경로 `app/(main)/reports/yoy/page.tsx` 일치((main) 그룹 제거).
- `activeKeyForPath`(`nav.ts:199-201`) `/reports/yoy` 가 `/reports` 보다 **먼저** 매칭 → 연도비교에서 '분포 모니터링' 오활성 없음.

### #4 RBAC — PASS
- compare: `comparison.service.ts:70-73` `canViewUser` 행수준 가드, 권한 밖 userId → `ForbiddenException`(403). 소비자 `PersonTimelinePanel.tsx:221-225` `error.isForbidden` → `<Forbidden/>`, 그 외 `<ErrorState/>`.
- distribution: `:156-177` hr_admin/company 전체, 그 외 `visibleDeptIds`+`expandDeptIds` 로 제한, 권한 밖 deptId → 403(`:165-167`). 프론트만 숨긴 무가드 엔드포인트 없음.
- 임포트 `excel.controller.ts:32-33` 컨트롤러 레벨 `@Roles(hr_admin)` → `import/legacy-results` 상속.

### #7 임포트 멱등/매칭 — PASS
- 멱등 upsert `(userId,cycleId)`: `excel.service.ts:601-621`. 재임포트 시 중복 EvaluationResult 없음.
- 퇴사 User 결정적 placeholder 이메일(`resignedEmail` name+group hex, `:686-690`) 로 upsert(`:534-561`) → 재임포트 시 중복 User 미생성. `createdResigned` 는 **신규(before==null)만 카운트**(`:564`) → 2차 임포트 createdResigned=0 코드상 확인.
- 퇴사 User `isActive=false`·`employmentStatus=resigned`·`departmentId=null`(`:543-546`). 조직도/유저목록은 `isActive` 필터로 숨김(기존 정책 유지) — `importLegacyResults` 가 활성화하지 않음.
- 카운트 무결성: `total = imported + review.length + errors.length`(`:627`), `ok = errors==0 && review==0`(`:628`) — 계약 §0·§7 일치.

### #8 null/빈상태 — PASS
- `YearDetailCard.tsx:70` `<GradeChip grade={finalGrade}/>`(null 허용), `:88-89` comp null → "—". `YoyTimelineChart.tsx:54,66,149,166` null 등급 → 회색 점·라인 단절·"—" 글자. compare 빈 timeline → `PersonTimelinePanel.tsx:236-237` EmptyState. 양쪽 일관.

### seed/2025 — PASS
- `seed.ts:185-215` 2025 정기평가(year=2025, status=closed, FINAL) + 전용 RuleSet(`competencyIncluded:false`, `sourcePriority:'import'`) **year=2025 탐색 upsert**(멱등). `comparison.service.ts:97-99` 가 `wp.sourcePriority==='import'` 를 source 폴백으로 사용 — seed 와 일치.

---

## 릴리스 게이트 판정 (1차)

**조건부 차단.** #5(HIGH) 는 기존 평가결과 상세/내평가표 화면이 임포트(2025) 결과 로드 시 런타임 크래시 → **선행 수정 필요**. #6·#7-b 는 동반 개선 권장(차단 아님). 타입 회귀 없음(양 tsc exit 0).

---

# 재검증 라운드 (2026-06-05) — 계약 §4-1 신설 후

> 계약 권위: `contract-yoy.md` §4-1 "임포트 결과 표시 정책"(byType 두 shape·source 분기) 신설됨.
> 검증 방식: 양쪽 동시 읽기(생산자↔소비자). 양 tsc `--noEmit` exit 0 재확인.

## 재검증 요약

| # | 결함 | 1차 판정 | 재검증 |
|---|------|---------|--------|
| 5 | byType import shape 가 라이브 상세화면 크래시 | FAIL (HIGH) | **RESOLVED** |
| 6 | distribution 선택조직 버킷 부재 시 overall 침묵 폴백 | WARN (MEDIUM) | **RESOLVED** |
| 7-b | includeResigned 토글 분포탭 무효과(혼선) | WARN (LOW) | **RESOLVED** |
| 회귀 | 봉투·enum·라우팅·RBAC·멱등·null | PASS | **유지(무회귀)** |

---

## [RESOLVED · HIGH] #5 — 임포트 byType source 분기

**계약(§4-1):** byType 은 live(`self/downward1/downward2[/downward3]`)·import(`round1/round2/final`) 두 shape 공존, **`source` 항상 존재**(누락 시 toDto 가 `'live'` 기본 주입), 소비측은 `source`로 분기.

**생산자(백엔드) — 양쪽 읽기:**
- `results.service.ts:108-114` `withSource(byType)` 신설 — `o.source` 가 비어있으면 `{...o, source:'live'}` 주입(이미 있으면 불변, 임포트 키 가짜 미주입). `toDto:140` 가 `byType: this.withSource(r.byType)` 로 전 직렬화 경로(`list`/`getDetail`/`aggregate`)에 적용.
- `aggregate:208` 라이브 byType 에 `source:'live' as const` 영속(upsert create/update 모두).
- 임포트 생산자 `excel.service.ts:594-598` `source:'import' as const` 영속(불변).
- ⇒ source 흐름 end-to-end 일관: import→`'import'`, live→`'live'`(영속), 과거 누락→`withSource` 폴백 `'live'`.

**소비자(프론트) — 세 화면 모두 분기 확인:**
- 타입: `lib/types.ts:309-320` `EvaluationByType` 모든 키 optional 유니온(live+import), `:323-329` `isImportByType()`(source 우선, 누락 시 라이브 키 부재로 판별).
- `eval/result/[userId]/page.tsx:129-135` `isImport` 메모 → `toRows`/`toFlow`(live 전용)는 `!isImport` 일 때만 호출, `toImportRows`(`:96-109`)는 `isImport` 일 때만. import 분기 UI(`:203-207` 안내배너, `:276-283` 라운드 요약표). 코멘트(`:163-172`)는 `isImport ? [] : [...]` + `bt?.downward1?.comment` 옵셔널체인. live 경로의 `bt.self.score`(`:36-57`)는 `toRows` 내부(=`!isImport`)이고 직전 `if(bt.self?.score!=null)` 가드 뒤라 안전.
- `EvalReport.tsx:126` `isImport` → `overallRows`(`:152-162`)·`evaluators`(`:164-174`) 분기, 코멘트(`:177-178`) `isImport?null:bt?.downward1?.comment`. import 시 `bt?.round1?.perf` 옵셔널체인.
- `eval/my/page.tsx:112,132-134` `bt?.self` 등 옵셔널 전달, `mk`(`:118-128`)가 `!!entry && entry.score!==null` null-guard → import shape(undefined)면 evaluations 상태로 폴백, 크래시 없음. EvalReport 렌더(`:393`)는 내부 분기.

**라이브 비회귀:** 라이브 결과 키·렌더 경로 불변. 추가된 옵셔널 체인(`?.`)은 값이 존재하는 라이브 경로에서 동작 무변(이미 non-null). tsc exit 0.

> backend·frontend 양쪽 RESOLVED 통지.

---

## [RESOLVED · MEDIUM] #6 — distribution 선택조직 버킷 부재 빈상태

**소비자 `OrgDistributionPanel.tsx` — 양쪽 읽기:**
- `:91` `hasDeptSelected = !!deptId && selectedDeptName != null`.
- `:96-98` 버킷 매칭은 **deptId 선택 시에만**(`hasDeptSelected ? find : undefined`).
- `:101-112` deptId 선택했는데 버킷 부재 → `missing:true` + 0 채움 행 반환(**overall 무단대체 제거**).
- `:114-120` `bucket` 없을 때 overall 사용은 `hasDeptSelected===false`(미선택 전체보기) 경로에서만 도달 ⇒ 계약 §4 "deptId 미선택 시만 overall" 일치.
- 빈상태 렌더: `YoyDistributionGroup.tsx:75-101`(SVG "해당 연도 데이터 없음" 회색 트랙), `DistRatioTable.tsx:48-59`(colSpan "해당 연도 데이터 없음" 행). 침묵 폴백 없음.

생산자 `comparison.service.ts` 스냅샷명 매칭 계약은 불변(이름 매칭이 계약, §4-1 #6 확정). 백엔드 무변경 — 소비측 빈상태 처리로 해소.

---

## [RESOLVED · LOW] #7-b — includeResigned 분포탭 노출 제거

**소비자 `YoyComparePage.tsx:76-85`:** `ResignedToggle` 은 `tab==='person'` 일 때만 렌더, 분포탭(`org`)에서는 고정 안내 문구 "분포는 당시 재직 인원 기준이에요"(`:82-84`) 노출. 무효과 토글로 인한 혼선 제거.
`OrgDistributionPanel`(`:38-42`)은 `includeResigned` prop 을 구조분해하지 않아(미사용) 분포 집계에 무영향 — 계약상 분포=당시 인원 기준 고정과 일치.

---

## 회귀 스팟체크 — 무회귀

- 응답 봉투/타입(#1): `results.controller.ts` 단건/목록 봉투 불변, hooks(`useResults`/`useYoyCompare`/`useYoyDistribution`) unwrap 불변. 신규 `useKpiSnapshots.ts`(별도 cycle-ops 기능)는 `apiGetList`/`apiGet` 정상 — YoY 무관.
- enum/snake_case(#2): legalEntity·employmentStatus 원형·한글 매핑 불변.
- 라우팅(#3): `results.controller.ts:41,46,58,79` `compare`→`distribution`→`:userId/export`→`:userId` **정적 우선 순서 유지**(동적 오인 없음).
- RBAC(#4): compare/distribution 행수준 가드·import `@Roles(hr_admin)` 불변.
- 임포트 멱등(#7): `excel.service.ts:594-598` source:'import' 영속, upsert 멱등 불변.
- null/빈상태(#8): GradeChip null·comp "—" 불변.
- 타입: `apps/api` tsc exit 0, `apps/web` tsc exit 0.

---

## 릴리스 게이트 판정 (재검증 — 최종)

**통과(PASS).** #5(HIGH)·#6(MEDIUM)·#7-b(LOW) 전부 RESOLVED. 계약 §4-1 명문화에 생산자(withSource·source 영속)·소비자(3화면 source 분기) 양쪽 정합. 라이브 경로 비회귀·이전 PASS 경계면 무회귀. 양 tsc exit 0. **차단 사유 없음 — 릴리스 게이트 통과.**
