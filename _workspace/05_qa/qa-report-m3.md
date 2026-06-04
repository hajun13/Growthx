# QA 리포트 — M3 (Items 4-10) 통합 교차검증

> 작성: qa-inspector / 2026-06-04
> 방식: 양쪽 동시 읽기(백엔드 확정 shape ↔ 프론트 훅/타입/페이지) 교차 대조 + 빌드 검증
> SSOT: contract.md "M3 델타 — 백엔드 구현 확정" 절
> 판정: **릴리스 게이트 통과** (Blocker 0 · Major 4건 직접 수정 완료 · Minor 4건 기록)

## 빌드 검증
- `apps/api`: `npx prisma generate` + `nest build` → **통과** (수정 후 재확인)
- `apps/web`: `npm run build` (타입체크 포함) → **통과**, 22개 라우트 전부 생성
- 신규 페이지 4종(`/admin/monthly-performance`·`/admin/competency`·`/eval/competency`·`/admin/compensation`) 모두 빌드 산출물에 존재

---

## Major 결함 (직접 수정 완료)

### M-1. MonthlyPerformanceSummary 필드명 불일치 — 런타임 깨짐 ✅수정
- **증상:** 프론트 타입이 `totalTarget`/`totalActual`/`year` 사용, 백엔드 확정 응답은 `targetAmount`/`actualAmount`(+`byCategory[]`·`monthlyTrend[]`·`departmentName`, `year` 없음). `admin/monthly-performance/page.tsx`의 "누적 달성 현황" 카드가 `₩undefined` 출력.
- **위치(생산자):** `apps/api/src/modules/monthly-performance/monthly-performance.service.ts:205-217`
- **위치(소비자):** `apps/web/lib/types.ts:567` · `apps/web/app/(main)/admin/monthly-performance/page.tsx:256,262`
- **수정:** types.ts `MonthlyPerformanceSummary` 백엔드 shape로 재정의(+`MonthlyPerformanceSummaryCategory`). page.tsx `summary.totalTarget→targetAmount`, `summary.totalActual→actualAmount`.

### M-2. CurrentPhase 필드명 불일치 — 배너 D-day 미표시 ✅수정
- **증상:** 프론트 타입이 `phase: string`(non-null)·`daysRemaining` 사용. 백엔드는 `phase: string|null`, `daysRemaining` 미제공, `cycleId`·`schedules[]` 추가. PeriodBanner의 D-day 배지가 영구 미표시(`undefined !== null` 통과 못 함), `phase=null`일 때 `schedulePhaseText(null)` 호출 위험.
- **위치(생산자):** `apps/api/src/modules/cycles/schedules.service.ts:100-124`
- **위치(소비자):** `apps/web/lib/types.ts:587` · `apps/web/components/PeriodBanner.tsx:26,46-47`
- **수정:** types.ts `CurrentPhase` 재정의(`phase` nullable·`cycleId`·`schedules[]`, `daysRemaining` 제거). PeriodBanner가 `dueDate`로 `daysRemaining` 직접 산출, `phase===null` 시 배너 미표시 가드 추가.

### M-3. CompensationSimulation 필드 누락 — byGrade 미사용·raiseRate null 표시 ✅수정
- **증상:** 프론트 타입에 `cycleId`·`byGrade[]` 없음, `raiseRate`가 non-null. 백엔드는 `byGrade[]`(등급별 비교 슬라이더, Item8 핵심)·`cycleId` 제공, `raiseRate: number|null`. SalarySimCard가 백엔드 권위값(`byGrade`) 대신 프론트 재계산에 의존(프론트 재계산 금지 원칙 위배), `raiseRate` null 시 `+null%` 출력.
- **위치(생산자):** `apps/api/src/modules/compensations/compensations.service.ts:253-267`
- **위치(소비자):** `apps/web/lib/types.ts:665` · `apps/web/components/SalarySimCard.tsx:20-29,41` · `apps/web/app/(main)/admin/compensation/page.tsx:117`
- **수정:** types.ts `CompensationSimulation`에 `cycleId`·`byGrade[]` 추가·`raiseRate` nullable. SalarySimCard가 `sim.byGrade` 우선(없으면 RuleSet 폴백), `raiseRate` null 가드. compensation page 팀 테이블 `raiseRate` null 가드.

### M-4. Schedules 일괄 PATCH가 isLocked/startDate 무시 — 잠금 토글 미저장 ✅수정
- **증상:** `admin/settings`의 일정 편집이 `isLocked`·`startDate`를 일괄 `PATCH /cycles/:id/schedules`로 전송하나, 백엔드 `ScheduleItemDto`에 두 필드가 없어 전역 ValidationPipe(`whitelist:true`)가 **제거** → 잠금 상태가 절대 저장 안 됨. (전용 `PATCH /schedules/:phase`는 정상이나 settings 화면은 일괄 경로 사용.)
- **위치(생산자):** `apps/api/src/modules/cycles/dto/schedule.dto.ts:13-42` · `schedules.service.ts:25-62`
- **위치(소비자):** `apps/web/app/(main)/admin/settings/page.tsx:305-314,324`
- **수정:** `ScheduleItemDto`에 `isLocked?`·`startDate?` 추가. `schedules.service.upsert` create에 `isLocked: s.isLocked ?? false`, update에 `isLocked` 조건부 반영(미제공 시 기존 유지). `startDate`는 스키마 컬럼 없음 → 수용만 하고 무시(프론트는 이미 `?? ''` 폴백).

---

## Minor 결함 (기록 — 후속 처리 권장)

### m-1. Dashboard 비-hr_admin null 가시성 — 타입 부정확(현재 도달 불가)
- 백엔드는 비-hr_admin에 `progress`·`gradeDistribution`·`unsubmittedCount`·`appeals`·`avgRaiseRate`를 `null` 반환(contract:853-854). 프론트 `DashboardSummaryBase`(types.ts:509)는 이를 non-null로 선언.
- **현재 무해:** `dashboard/page.tsx:38,49`가 hr_admin 전용 게이트(`<Forbidden>`) → 비-admin은 위젯 미도달, 크래시 없음. 타입 미수정 유지(수정 시 hr_admin 경로 destructuring에 불필요한 null-guard 강제).
- **권장:** 향후 비-admin 대시보드 노출 시 해당 필드 nullable화 + null-guard 필요.

### m-2. Item 7 그룹/팀 카드가 비-admin에게 미노출 — 요구사항 기능 갭
- 백엔드 `groupGrades`·`teamGoal`·`monthlyTrend`는 전 역할 가시(본인 그룹/부서 한정)로 구현(contract:855). 그러나 유일한 소비처 `dashboard/page.tsx`가 hr_admin 전용이라, 요구사항(임직원=본인 그룹, 팀장=팀, 본부장=본부 카드)이 UI로 도달 불가.
- **권장:** 비-admin용 대시보드 섹션 또는 별도 진입점에서 `groupGrades`/`teamGoal` 렌더. (백엔드 준비 완료, 프론트 노출만 누락.)

### m-3. 역량 평가 "제출"이 실제로는 임시저장(submittedAt 미기록)
- `eval/competency/page.tsx:103`의 `bulkSubmit`이 `submit:true` 미전송. 백엔드 bulk는 `submit` 미지정 시 임시저장(`submittedAt=null`, contract:844). 버튼 라벨("제출")과 실제 동작(draft 저장) 불일치.
- **권장:** `competencyResponseCommands.bulkSubmit`에 `submit:true` 옵션 추가 후 최종 제출 시 전달. (연봉 미반영 참고 데이터라 영향 경미.)

### m-4. KPI 신규 드래프트 기본 카테고리가 employee에게 비활성
- `kpi/page.tsx:85-86`의 `emptyDraft`가 `group:'performance_core'`+`category:'revenue'`. performance_core의 전 카테고리(revenue/construction/orders)가 employee에게 비활성(Item10) → employee가 새 드래프트 추가 시 카테고리 선택이 전부 잠겨, group을 `collaboration_growth`로 바꾸기 전까지 진행 불가.
- **권장:** employee(`!isPositionHolder`) 시 기본 드래프트를 `group:'collaboration_growth'`/`category:'collaboration'`로. (크래시 아님, UX 트랩.)

---

## 통과 확인 항목 (결함 없음)

### A. 응답 봉투 — 통과
- 신규 단건 API 전부 `{ data }` 봉투, `apiGet`이 `.data` unwrap. 목록은 `{ data, meta }` + `apiGetList`.
- 역량 bulk: 백엔드 `{data:[],meta}` 반환, 프론트 `apiPost`(`.data` 반환=배열) — meta 무시 무해, 정상.
- **바이너리 예외(Item9 export):** `results/:userId/export`가 excel=xlsx·pdf=`text/html` 스트림(봉투 없음). 프론트 `ResultExportButton`이 `fetchBlob`/`downloadExcel`(인증 헤더 fetch→blob)로 처리, 봉투 미가정. `lib/excel.ts` 에러 시에만 JSON 봉투 파싱. **정합.**

### B. 잠금 에러 코드 — 통과
- 백엔드 `CycleLockService`가 423 + `PERIOD_LOCKED` 반환(contract 확정). 프론트는 `LOCKED`/`PERIOD_LOCKED` 코드 문자열을 **체크하지 않고** `phase.isLocked`로 선제 비활성(`kpi/page.tsx:128,195`) → 코드 불일치 무관. useCurrentPhase 주석만 구식(`daysRemaining` 언급) — 무해.

### C. RBAC 경계면 — 통과
- 월별 실적: `POST/PATCH @Roles(hr_admin, division_head)`, service `assertWriteAccess`(division_head 본부 하위트리 한정), `GET`/`summary`는 인증 전 역할(team_lead 조회). 프론트 nav `monthly-performance` 역할=hr_admin/division_head/team_lead. **정합.**
- 역량 질문 CRUD: `@Roles(hr_admin)`(controller:34,43,53). 프론트 nav `competency-admin` 역할=hr_admin. **정합.**
- 연봉: `PATCH /users/:id/salary @Roles(hr_admin)`, serializer가 `currentSalary` 노출. 개인 simulation은 `@Roles` 없음+service `canViewUser`. **정합.**
- KPI revenue/construction/orders: 백엔드 `assertCategoryWritable`(employee 403, kpis.service:268-283), 프론트 employee 비활성(kpi/page:441-451). **양쪽 일치.**
- 팀 simulation: 백엔드 `@Roles(hr_admin, division_head, team_lead)` — 계약(hr_admin/division_head)보다 team_lead 추가 노출이나 service가 부서 하위트리로 스코프, 보안 결함 아님. (계약 문구와 미세 불일치 — advisory.)

### D. 라우팅 — 통과
- 신규 3 페이지 경로 ↔ nav 링크(`lib/nav.ts:48-63`) 일치, `activeKeyForPath`(112-115) 매핑 존재, page.tsx 파일 4종 전부 실재.

### E. 상태 전이 / 잠금 — 통과
- `PATCH /cycles/:id/schedules/:phase`(controller:68) ↔ 전용 토글 존재. `GET /cycles/:id/current-phase`(controller:79) ↔ `useCurrentPhase` 동일 경로.
- `GET /group-performance/my-group`(Item10) ↔ `useMyGroupPerformance` 경로 일치, 라우트 충돌 없음(`:id` GET 부재).

### F. 빌드 — 통과 (상단)
