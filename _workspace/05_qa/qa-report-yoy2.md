# QA 리포트 — YoY 2차 통합 정합성 (기능 A 과거결과 임포트 UI · 기능 B 전년도 연봉 자동 파생)

> 계약 권위: `_workspace/02_contract/contract-yoy.md` · `contract-yoy2.md`. 검증 방식: 양쪽 동시 읽기(생산자↔소비자).
> 회귀 확인: `apps/api` tsc `--noEmit` exit 0, `apps/web` tsc `--noEmit` exit 0. DB(docker): `base_salary integer NULL` 컬럼 적용·마이그레이션 `20260605060000_add_compensation_base_salary` finished(applied=t) 확인(읽기 검증만).
> 작성: qa-inspector · 통지 대상: backend-engineer ∥ frontend-engineer

## 경계면별 PASS/FAIL 요약

### 기능 A — 과거결과 임포트 UI

| # | 경계면 | 판정 |
|---|--------|------|
| A1 | `uploadExcel` 쿼리 직렬화(`?cycleId=`)·multipart field `file`·`{data}` 봉투 unwrap | PASS |
| A2 | `LegacyImportReport` 타입 ↔ 백엔드 응답 camelCase 1:1 | PASS |
| A3 | 기존 조직 임포트(`/excel/import/org`) 시그니처·동작 비회귀 | PASS |
| A4 | hr_admin 가드(프론트 `isHrAdmin` + 백엔드 컨트롤러 `@Roles(hr_admin)`) | PASS |
| A5 | 대상 사이클 셀렉트 closed만 노출 + cycleId 명시 전달 | PASS |

### 기능 B — 전년도 연봉 자동 파생

| # | 경계면 | 판정 |
|---|--------|------|
| B1 | 파생 우선순위(baseSalary→carryover→manual→none) 코드 일치 | PASS |
| B2 | `previousSalarySource` list·simulation·simulation-team 전부 포함 + 프론트 안전(미사용 비회귀) | PASS |
| B3 | simulationTeam N+1 방지(직전 사이클 일괄 조회 맵) | PASS |
| B4 | compute baseSalary=currentSalary 저장(체이닝)·simulated unique 무충돌 | PASS |
| B5 | 기존 보상화면(previousSalary·currentSalary·nextYearSalary) 비회귀 | PASS |
| B6 | baseSalary list 응답 한정 — 프론트 미접근(정합) | PASS |

**결함(FAIL/WARN): 없음.**

---

## 기능 A 상세 (양쪽 동시 읽기 근거)

### [PASS] A1 — uploadExcel 쿼리·multipart·봉투
- 생산자(헬퍼) `apps/web/lib/excel.ts:91-113` `uploadExcel<T>` — `withQuery`(`:10-21`)가 `cycleId` 를 `?cycleId=<enc>` 로 직렬화(undefined/null/'' 생략, 이미 `?` 있으면 `&` 결합). `form.append('file', file)`(`:96-97`)로 multipart field `file`. `json.data` unwrap(`:111-112`), `!res.ok`/`!json.data` 시 `ApiError`.
- 소비자 `apps/web/app/(main)/admin/cycle/page.tsx:444-448` — `uploadExcel<LegacyImportReport>('/excel/import/legacy-results', file, { cycleId: legacyCycleId })`. 제네릭 T=LegacyImportReport, query=`{cycleId}` 정확.
- 백엔드 수신 `apps/api/src/modules/excel/excel.controller.ts:65-74` — `@UseInterceptors(FileInterceptor('file'))` field 일치, `@Query('cycleId') cycleId?: string` 일치, `@UploadedFile()` 없으면 400.

### [PASS] A2 — LegacyImportReport ↔ 백엔드 응답 1:1
- 생산자 `apps/api/src/modules/excel/excel.service.ts:649-662` 응답 `{data:{ ok, cycleId, total, imported, matched, createdResigned, reviewQueue, review[], errors[], legalEntityUpdated }}`.
- 소비자 타입 `apps/web/lib/types.ts:1037-1048` `LegacyImportReport` — 10필드 전부 camelCase 1:1(`review:{row,name,reason}[]`, `errors:{row,message}[]`). 계약 yoy §6·§3 응답과 완전 일치.
- 렌더 `LegacyReportCard`(`page.tsx:58-179`) — `report.imported/matched/createdResigned/legalEntityUpdated/reviewQueue/review[]/errors[]/ok/total/cycleId` 모두 정의된 필드만 접근. snake_case 누출 없음.

### [PASS] A3 — 조직 임포트 비회귀
- 컨트롤러 `excel.controller.ts:49-54` `importOrg(@UploadedFile() file)` — cycleId 무관(불변).
- 소비자 `page.tsx:411` `uploadExcel('/excel/import/org', file)` — query 미전달 → `withQuery` path 무변경. 기본 제네릭 T=`ImportResult`(`:406` `orgResult: ImportResult`). 신규 제네릭 확장이 기존 호출 시그니처를 깨지 않음(query optional). tsc exit 0.

### [PASS] A4 — hr_admin 가드(양면)
- 백엔드: `excel.controller.ts:32-33` 컨트롤러 레벨 `@Controller('excel') @Roles(Role.hr_admin)` → `import/legacy-results`(`:65`) 상속. 프론트만 숨긴 무가드 엔드포인트 아님.
- 프론트: `page.tsx:189` `allowed = !!user && isHrAdmin(user.role)`, `:462` `if (!allowed) return <Forbidden/>` — 비 hr_admin 페이지 진입 차단. 가드 일치.

### [PASS] A5 — closed 사이클 셀렉트 + cycleId 명시
- `page.tsx:423-425` `closedCycles = cycles.filter(c=>c.status==='closed').sort((a,b)=>b.year-a.year)` — closed만, 최신연도 우선.
- `:430-434` 기본 선택 closed 최신연도 1회 설정. `:735-739` 셀렉트 옵션은 `closedCycles` 만 렌더. `:436-440` 미선택 시 danger 토스트 + 차단.
- `:444-448` 선택된 `legacyCycleId` 를 query 로 명시 전달(자동탐색 의존 안 함). closed 0개 시 `:718-725` 안내 빈상태. `EvaluationCycle.status:CycleStatus`·`year:number`(`types.ts:144,147`) 타입 정합.

---

## 기능 B 상세 (양쪽 동시 읽기 근거)

### [PASS] B1 — 파생 우선순위 코드 일치
- `apps/api/src/modules/compensations/compensations.service.ts:67-75` `resolvePrevSalary` — ①`prior.baseSalary != null` → `{value, 'derived'}` ②`prior.nextYearSalary != null` → `'carryover'` ③`manualFallback != null` → `{round(manual), 'manual'}` ④else `{null, 'none'}`. 계약 yoy2 §1 우선순위와 **정확히 일치**.
- 직전 사이클 선택: `derivePreviousSalary:51-59` / `deriveTeamPrevSalaryMap:92-100` `where{simulated:false, cycle:{year:{lt:currentCycleYear}}}` `orderBy{cycle:{year:'desc'}}` → 가장 최근 직전(year<현재 중 최대). 2개 이상 과거 사이클 존재 시 최신 채택(yoy2 §6 QA 포인트 충족).
- 2025(직전 없음): `cycleYearOf`(`:374`) 후 직전 미존재 → manual fallback 또는 `none`. 계약 §6 "2025 source=none 정상" 일치.

### [PASS] B2 — previousSalarySource 3경로 + 프론트 안전
- list: `toDto:245` `previousSalarySource: prev?.source ?? 'none'`.
- simulation(개인): `buildSimulation:564` `previousSalarySource: u.previousSalarySource`(`simulation:388` `prev.source` 주입).
- simulation-team: `buildSimulation:564`(`simulationTeam:490` `prev.source` 주입).
- 프론트 안전: `Compensation`(list, `types.ts:411-423`)·`CompensationSimulation`(`:800-818`) 타입에 `previousSalarySource` **미선언**이나, 보상화면(`compensation/page.tsx`)·전 web 코드에서 `previousSalarySource`/`.baseSalary` **접근 0건**(grep no match). 추가 필드 무시 → 비회귀. 계약 검증포인트 (2) "미사용이어도 비회귀" 충족.

### [PASS] B3 — simulationTeam N+1 방지
- `deriveTeamPrevSalaryMap:92-106` — `findMany({ where:{ userId:{in:userIds}, simulated:false, cycle:{year:{lt}} }, orderBy:{cycle:{year:'desc'}} })` **단일 쿼리**, `priorByUser` 맵에 user별 첫(최신) 행만 채택. `simulationTeam:472-474` 가 전원 userIds 1회 호출.
- list 도 동일: 사이클별 묶어(`:182-207`) `deriveTeamPrevSalaryMap` 1회/사이클 + `cycleYearCache`. 행별 개별 쿼리 없음.

### [PASS] B4 — compute baseSalary 체이닝 + simulated 무충돌
- `compute:289-290` `baseSalary = user.currentSalary != null ? round(currentSalary) : null`. upsert create(`:312`)·update(`:316`) 양쪽 기록.
- 다음 연도 파생이 이 `baseSalary` 를 `derived` 로 읽어감(체이닝 성립). 단 파생 소스는 `simulated:false` 만(`:54,:94`) — simulated=true 에도 baseSalary 채우나(`:312`) 파생서 제외 → 시뮬레이션이 실연봉 파생 오염 안 함(계약 §3 일치).
- unique: `@@unique([userId,cycleId,simulated])`(schema.prisma:570) ↔ upsert key `userId_cycleId_simulated`(`:301-305`). simulated 별 분리 레코드 → 충돌 없음.

### [PASS] B5 — 기존 보상화면 비회귀
- 소비자 `compensation/page.tsx` — `useTeamCompensationSimulation`(`:74`) → `apiGetList<CompensationSimulation>('/compensations/simulation/team')`(hook `:54`). `r.previousSalary`(`:126,:470`)·`r.currentSalary`(`:127,:476`)·`r.projectedSalary`(차기, `:132,:486`) 필드명·타입 불변(`number|null`). `previousSalary` 값 출처만 변경(계약 yoy2 §2-3), 필드명 동일.
- meta(`simulationTeam:511-519` `totalCurrentSalary/totalProjectedSalary/totalIncrease`)는 YoY2 무변경 + 프론트 미사용(`teamSim.data` 만 읽음). 계약 "meta 불변" 일치.
- 라우팅: 컨트롤러 `simulation/team`(controller:24) 정적 선언이 `simulation`(:33)·`@Get()`(:17)보다 먼저 → 동적 오인 없음. hook `/compensations/simulation/team` 일치.

### [PASS] B6 — baseSalary list 한정 ↔ 프론트 정합
- 생산자: `baseSalary` 는 `toDto:241` (list 경로)에만 노출. simulation/simulation-team DTO(`buildSimulation:553-574`)에는 **미포함**.
- 소비자: 프론트 `Compensation`(list 타입)·`CompensationSimulation` 모두 `baseSalary` 미선언, web 전역 `.baseSalary` 접근 0건. 없는 곳에서 접근 안 함 → 정합. 스키마 `Compensation.baseSalary Int?`·User.previousSalary Float?(`:183`) 타입차는 `resolvePrevSalary` 가 manual 만 `round` 처리해 흡수.

---

## DB·마이그레이션 검증(읽기 전용)
- `docker compose exec db psql`: `information_schema.columns` → `compensations.base_salary = integer, nullable=YES`, `next_year_salary = integer, nullable=YES`.
- `_prisma_migrations`: `20260605060000_add_compensation_base_salary` → `applied=t`(finished). 마이그레이션 SQL `ADD COLUMN "base_salary" INTEGER`(additive, NULL 허용 — 기존 데이터 무해).
- 운영 데이터·자격증명 변경 없음.

---

## 릴리스 게이트 판정 (YoY 2차)

**통과(PASS).** 기능 A 5경계면·기능 B 6경계면 전부 PASS, FAIL/WARN 0건. 양 tsc exit 0, DB 컬럼·마이그레이션 적용 확인. 추가 필드(`previousSalarySource`/`baseSalary`)는 additive·프론트 미접근으로 비회귀. 1차 YoY(`qa-report-yoy.md`) RESOLVED 경계면 무회귀 유지. **차단 사유 없음 — 릴리스 게이트 통과.**
