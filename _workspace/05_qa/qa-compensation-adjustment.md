# QA 리포트 — 보상 시뮬 조정 컬럼 (compensation-adjustment)
생성일: 2026-06-16
검증 범위: 정적 교차검증(A~H). 동적 E2E는 Docker 스택 기동 필요 — SKIP(정적 게이트만 수행).

---

## 판정 요약

| 영역 | 항목 | 결과 |
|------|------|------|
| A. API 응답 ↔ 프론트 훅 | DTO 6개 신규 필드 ↔ 프론트 타입 | PASS |
| A. API 응답 ↔ 프론트 훅 | 봉투 unwrap | PASS |
| A. API 응답 ↔ 프론트 훅 | PUT upsert 봉투 ↔ 프론트 api.ts | PASS |
| B. 필드명 snake↔camel | DB 컬럼 → DTO camelCase | PASS |
| C. 라우팅 | 엑셀 다운로드 href | PASS |
| D. 상태 전이 | CompensationAdjustment는 단순 upsert — 상태머신 해당 없음 | N/A |
| E. RBAC | PUT /compensations/adjustment @Roles(hr_admin) 서버 가드 | PASS |
| **E. RBAC** | **프론트 조회 권한 — 스펙 불일치** | **FAIL** |
| F. 도메인 산정 일관성 | finalProjectedSalary / finalRaiseRate 백엔드 단일 책임 | PASS |
| F. 도메인 산정 일관성 | 요약 카드 totalIncreaseWon vs 백엔드 meta.totalIncrease 미묘한 차이 | WARNING |
| G. 마이그레이션 ↔ 스키마 | migration.sql ↔ schema.prisma CompensationAdjustment | PASS |
| H. 파일 줄 수 상한 | CompensationView.tsx(~348줄), CompensationRow.tsx(~278줄) | WARNING |
| H. 엑셀 export 컬럼 순서 | exportCompensation vs 화면 컬럼 순서 | FAIL(경고 수준) |
| I. tsc 타입체크 | admin-compensation 관련 에러 | PASS (0건) |
| I. tsc 타입체크 | pre-existing 에러 3건 (범위 밖) | PASS(기존 미변경) |
| I. nest build | apps/api | PASS (EXIT 0) |

**릴리스 게이트: 조건부 차단** — FAIL 2건 수정 필요. WARNING 2건은 선택 수정.

---

## FAIL 상세

### [FAIL-1] 프론트 보상 현황 조회 권한이 hr_admin만 — 스펙 요구 "hr_admin·그룹대표·본부장" 불일치
**우선순위: HIGH (RBAC 스펙 불일치)**

- 스펙(requirements-compensation-sim-columns.md:28): "조회는 현행 그대로(hr_admin·그룹대표·본부장)."
- 생산자(백엔드): `apps/api/src/modules/compensations/compensations.controller.ts:38` — `@Roles(Role.hr_admin, Role.division_head, Role.team_lead)` — 3역할 허용.
- 소비자(프론트): `apps/web/features/admin-compensation/ui/CompensationView.tsx:76` — `allowed = !!user && isHrAdmin(user.role)` — hr_admin만 허용, division_head·team_lead 차단 → `<Forbidden>` 렌더.

**수정 방법 (프론트):**
`apps/web/features/admin-compensation/ui/CompensationView.tsx` line 76을 아래로 교체:
```ts
// 조회: hr_admin·본부장(division_head)·팀장(team_lead). 편집: hr_admin만.
const canView = !!user && (user.role === 'hr_admin' || user.role === 'division_head' || user.role === 'team_lead');
const canEdit = !!user && user.role === 'hr_admin';
```
- `if (!allowed)` → `if (!canView)` 로 변경
- `useTeamCompensationSimulationData(cycleId, allowed && !!cycleId)` → `canView && !!cycleId` 로 변경
- `<CompensationRow canEdit={allowed} ...>` → `canEdit` 을 별도 변수로 전달

**담당:** 프론트엔드

---

### [FAIL-2] 엑셀 export 컬럼 순서가 화면과 불일치
**우선순위: MEDIUM (데이터 정합)**

- 화면 컬럼 순서 (CompensationView.tsx HEADERS): 이름/본부·팀 → 직급 → 평가등급 → 전년도 연봉 → 금년도 연봉 → (화살표) → 조정분 → 승격 → 인센티브 → 비고 → **차기년도 연봉(최종)** → **인상액(율)**
- 백엔드 exportCompensation 컬럼 순서(excel.service.ts:1433~1448): 본부 → 팀 → 이름 → 직급 → 평가등급 → 전년도 → 금년도 → **차기년도(자동 projectedSalary)** → **조정분** → **최종 제안연봉** → **인상률(%)** → **승격** → **인센티브** → 비고

불일치 포인트:
1. 차기년도(자동, projectedSalary)가 엑셀에는 조정분 앞에 있으나, 화면에는 없음(finalProjectedSalary만 표시). 엑셀에는 두 값 모두 있어 사용자 혼란 최소화 목적에서 허용 가능.
2. **승격 컬럼이 엑셀에서 인상률(%) 뒤에 있으나 화면에서는 조정분 바로 다음.** (excel.service.ts:1445 vs CompensationView.tsx HEADERS:8)

백엔드 노트(compensation-adjustment-notes.md:104 "컬럼 순서: 본부·팀·이름·직급·평가등급·전년도 연봉·금년도 연봉·차기년도 연봉(자동)·조정분·최종 제안연봉·인상률%·승격·인센티브·비고")는 현행 구현과 일치하나, 화면 순서(조정분→승격→인센티브→비고→차기년도→인상액)와 엑셀(차기년도(자동)→조정분→최종→인상률→승격→인센티브→비고)이 다름.

**수정 방법 (백엔드):**
`apps/api/src/modules/excel/excel.service.ts:1433` `ws.columns`를 화면 표시 순서(단 엑셀 전용 '차기년도 자동' 추가 포함)에 맞춰 재정렬:
본부 → 팀 → 이름 → 직급 → 평가등급 → 전년도 → 금년도 → 조정분 → **승격** → 인센티브 → 비고 → 최종 제안연봉 → 인상률(%) [차기년도(자동) 선택 유지]

**담당:** 백엔드

---

## WARNING 상세

### [WARN-1] 요약 카드 totalIncreaseWon와 백엔드 meta.totalIncrease 계산 차이
- 프론트(`CompensationView.tsx:104`): `valid.reduce((s, r) => finalProjectedSalary != null && currentSalary != null ? s + (final - current) : s, 0)` — finalProjectedSalary가 null이면 0으로 스킵.
- 백엔드 meta(`simulationTeam` line 547): `totalProjected = sum(finalProjectedSalary ?? projectedSalary)` — finalProjectedSalary가 null이면 projectedSalary 사용.
- 결과: 조정분 미입력 상태에서 두 합계가 동일하지 않을 수 있음(프론트는 projectedSalary 기반 행을 0으로 처리, 백엔드는 projectedSalary로 계산).
- 심각도: 낮음(요약 카드 표시 전용, 저장·확정 로직과 무관).
- 권고: 프론트에서 meta.totalIncrease/totalProjectedSalary를 hooks.ts가 expose하여 일관화. 또는 현행 허용(표시 목적).

### [WARN-2] 파일 줄 수 ~200줄 상한 초과
- `CompensationView.tsx`: 348줄 (약 74% 초과)
- `CompensationRow.tsx`: 278줄 (약 39% 초과)
- 백엔드 노트에서 "파일당 ~200줄 상한 준수를 위해 CompensationRow 분리"를 명시했으나 두 파일 모두 여전히 초과.
- 아키텍처 규칙(architecture.md)의 ~200줄 상한 소프트 권고이므로 기능 영향은 없음. 리팩터링 권고.
- 권고(선택): `CompensationView.tsx`에서 요약 카드·등급별 기준·필터 섹션을 별도 컴포넌트로 분리.

---

## PASS 상세 (교차검증 결과)

### A. API 응답 ↔ 프론트 훅

**CompensationSimulationDto 신규 6개 필드**
- 백엔드 DTO(`compensation-response.dto.ts:88~112`): `adjustmentAmount: number|null`, `promotionPositionCode: string|null`, `incentiveAmount: number|null`, `note: string|null`, `finalProjectedSalary: number|null`, `finalRaiseRate: number|null` — 모두 `@ApiProperty({ nullable: true })` ✓
- 프론트(`api.ts:15`): `type CompensationSimulation = CompensationSimulationDto` — `@growthx/contracts` 생성 타입 직접 사용 ✓

**봉투 unwrap**
- 팀 시뮬(GET): `res.data.data ?? []` (`api.ts:27`) ✓ — 봉투 `{ data: [...], meta }` 구조에서 `res.data` = HTTP body(봉투), `.data` = 배열
- upsert 응답(PUT): `res.data.data` (`api.ts:35`) ✓ — 봉투 `{ data: CompensationAdjustmentDto }` 구조

**PUT upsert body 4개 필드 전체 전송(클로버 방지)**
- `CompensationRow.tsx:96~103`: `onSave({ cycleId, userId, adjustmentAmount: wanToWon(adjWan), promotionPositionCode: promotion||null, incentiveAmount: wanToWon(incWan), note: note||null })` — 4개 필드 항상 전송 ✓

### B. 필드명

- DB snake_case(`user_id`, `cycle_id`, `adjustment_amount`, `promotion_position_code`, `incentive_amount`, `note`) → Prisma camelCase 자동 변환 → DTO camelCase 일치 ✓
- `toDto()`/`toValues()` 매핑 단순화(직접 필드 접근): `compensation-adjustment.service.ts:84~96` ✓

### C. 라우팅

- 다운로드 href: `CompensationView.tsx:187` — `/excel/export/compensation?cycleId=${cycleId}` ✓
- 컨트롤러: `ExcelController` `@Get('export/compensation')` (line 192) ✓

### E. RBAC (저장)

- 서버: `PUT /compensations/adjustment` — `@Roles(Role.hr_admin)` (compensations.controller.ts:62~63) ✓
- 프론트: `canEdit={allowed}` = `isHrAdmin(user.role)` → 입력 셀 `disabled={!canEdit}` ✓
- 프론트에서 hr_admin 아닌 사용자의 `handleBlurSave` 내 `if (!canEdit) return` 조기 종료(CompensationRow.tsx:90) ✓ — 이중 방어

### F. 산정 일관성

- `finalProjectedSalary = projectedSalary + (adjustmentAmount ?? 0)` — 백엔드 buildSimulation(compensations.service.ts:601~604) 단일 계산, 프론트는 백엔드 값 표시만 ✓
- `finalRaiseRate = Math.round((finalProjectedSalary / currentSalary - 1) * 1000) / 10` — 소수점 1자리 ✓
- 프론트 `CompensationRow.tsx:83~88`: `hasFinal = row.finalProjectedSalary != null && row.currentSalary != null; diffWon = final - current` — 백엔드 필드 직접 사용, 재계산 없음 ✓
- 프론트 요약 카드 `avgRaise = finalRaiseRate ?? raiseRate` (CompensationView.tsx:101) — finalRaiseRate 우선 ✓

### G. 마이그레이션 ↔ 스키마

- `compensation.compensation_adjustments` 테이블명 ✓
- 컬럼 타입: `adjustment_amount INTEGER nullable`, `promotion_position_code TEXT nullable`, `incentive_amount INTEGER nullable`, `note TEXT nullable` ✓
- `@@unique([userId, cycleId])` → `UNIQUE INDEX ...user_id, cycle_id` ✓
- 교차 스키마 FK: `org.users`(userId), `cycle.evaluation_cycles`(cycleId) ✓
- `promotion_position_code` FK 강제 없음(migration.sql에 FK 없음, 스키마에 FK relation 없음) ✓

### I. 타입체크

- `nest build` (apps/api): EXIT 0 ✓
- `tsc --noEmit` (apps/web, 루트 tsc 바이너리 사용): 에러 3건 모두 기존 `admin-competency-items/api.ts`(2건), `competency-eval/api.ts`(1건) — 이번 변경 범위 밖, 회귀 없음 ✓

---

## 모듈 경계 체크 (H)

- `ExcelModule` → `CompensationsModule` import ✓ (순환참조 없음: compensations는 excel 비의존)
- `CompensationsModule` → `CompensationAdjustmentService` providers 등록 ✓
- `ExcelService` 생성자에 `CompensationsService` 4번째 인자 주입 ✓

---

## 조치 요청 요약

| # | 담당 | 파일 | 설명 |
|---|------|------|------|
| FAIL-1 | **프론트엔드** | `apps/web/features/admin-compensation/ui/CompensationView.tsx:76` | `allowed`를 `canView`(hr_admin+division_head+team_lead)와 `canEdit`(hr_admin만)으로 분리 |
| FAIL-2 | **백엔드** | `apps/api/src/modules/excel/excel.service.ts:1433` | exportCompensation 컬럼 순서를 화면 순서에 맞춰 재정렬 |
| WARN-1 | 프론트엔드(선택) | `apps/web/features/admin-compensation/ui/CompensationView.tsx:104` | 총 인건비 증가액을 meta.totalIncrease로 통일하거나 주석 추가 |
| WARN-2 | 프론트엔드(선택) | CompensationView.tsx / CompensationRow.tsx | 200줄 상한 분리 리팩터링 |
