# 보상 시뮬 조정 컬럼 — 백엔드 구현 노트

요구사항: `_workspace/00_input/requirements-compensation-sim-columns.md`
실제 운영 엑셀(2026 연봉갱신, Index 시트 T~AC열)의 수기 입력 컬럼(조정분·승격·인센티브·비고)을
보상 시뮬레이션에 반영. 관리자(hr_admin)가 (user, cycle)별로 입력·저장하고, 시뮬 응답에 값+파생값 동봉.

## 변경 파일

### 데이터 모델
- `apps/api/prisma/schema.prisma`
  - 신규 `model CompensationAdjustment` (`@@schema("compensation")`, `@@unique([userId, cycleId])`)
  - 역방향 relation 추가: `User.compensationAdjustments`, `EvaluationCycle.compensationAdjustments`
- `apps/api/prisma/migrations/20260616140000_compensation_adjustment/migration.sql`
  - `compensation.compensation_adjustments` CREATE TABLE + 유니크 인덱스(user_id, cycle_id)
  - 교차스키마 FK: `org.users`, `cycle.evaluation_cycles` (promotion_position_code 는 FK 강제 안 함)
- `prisma generate` 실행 완료(client v5.22.0).

### 서비스/컨트롤러/DTO
- `apps/api/src/modules/compensations/compensation-adjustment.service.ts` (신규, ~100줄)
  - `upsert(dto)` — (userId,cycleId) 멱등 upsert, null=명시적 클리어
  - `mapForUsers(cycleId, userIds)` — 일괄 조회 맵(N+1 금지, `cycleId + userId in` 1회)
  - `valuesFor(cycleId, userId)` — 단건 조회(없으면 empty), `empty()` 폴백
- `apps/api/src/modules/compensations/compensations.service.ts`
  - 생성자에 `CompensationAdjustmentService` 주입, `upsertAdjustment()` 위임(stage 게이팅 없음)
  - `simulation()` — `valuesFor`로 조정값 조회 후 `buildSimulation`에 주입
  - `simulationTeam()` — `mapForUsers`로 일괄 조회, 행별 주입. **meta 합계는 finalProjectedSalary 기준**
    (`totalProjectedSalary`/`totalIncrease` = 조정분 반영 예산; `totalCurrentSalary` 불변)
  - `buildSimulation()` — `adjustment` 파라미터 추가 + 6개 필드 산출(아래)
- `apps/api/src/modules/compensations/dto/compensation.dto.ts`
  - 신규 `UpsertCompensationAdjustmentDto` (class-validator: incentive `@Min(0)`, 나머지 음수 허용, 모두 null 허용)
- `apps/api/src/modules/compensations/dto/compensation-response.dto.ts`
  - `CompensationSimulationDto`에 6개 필드 추가
  - 신규 `CompensationAdjustmentDto` (upsert 응답)
- `apps/api/src/modules/compensations/compensations.controller.ts`
  - `PUT /compensations/adjustment` (`@Roles(hr_admin)`, `@ApiOkEnvelope(CompensationAdjustmentDto)`)
- `apps/api/src/modules/compensations/compensations.module.ts`
  - providers에 `CompensationAdjustmentService` 등록

## 새 엔드포인트 계약 (프론트 소비용)

### `PUT /api/v1/compensations/adjustment` — hr_admin 전용
멱등 upsert. (userId, cycleId) 유니크. 단계(stage) 무관(최종 단계 전에도 입력 가능).

요청 body (`UpsertCompensationAdjustmentDto`):
```jsonc
{
  "cycleId": "string",        // required
  "userId": "string",         // required
  "adjustmentAmount": 0,      // optional, int, 음수 허용, null=클리어
  "promotionPositionCode": "string", // optional, PositionDef.code, null=클리어
  "incentiveAmount": 0,       // optional, int >= 0, null=클리어
  "note": "string"            // optional, null=클리어
}
```
응답 `{ data: CompensationAdjustmentDto }`:
```jsonc
{ "data": {
  "id": "string", "userId": "string", "cycleId": "string",
  "adjustmentAmount": number|null, "promotionPositionCode": string|null,
  "incentiveAmount": number|null, "note": string|null,
  "updatedAt": "date-time", "createdAt": "date-time"
}}
```
에러: 401(미인증) / 403(hr_admin 아님) / 400(VALIDATION_ERROR — incentive 음수 등).

## CompensationSimulationDto — 최종 필드 (GET /compensations/simulation, /simulation/team)
기존 필드(userId·userName·departmentName·cycleId·currentSalary·currentGrade·raiseRate·
projectedSalary·position·previousSalary·previousSalarySource·divisionName·teamName·
groupTier·groupTierBonus·byGrade) **그대로 유지** + 추가:

| 필드 | 타입 | 의미 |
|------|------|------|
| `adjustmentAmount` | number\|null | 조정분(원, 음수 허용) — 엑셀 X열 |
| `promotionPositionCode` | string\|null | 승격 직급 PositionDef.code — 엑셀 AA열 |
| `incentiveAmount` | number\|null | 인센티브(원) — 엑셀 AB열 |
| `note` | string\|null | 비고 — 엑셀 AC열 |
| `finalProjectedSalary` | number\|null | `projectedSalary + (adjustmentAmount ?? 0)`. projectedSalary null이면 null |
| `finalRaiseRate` | number\|null | `round((finalProjectedSalary/currentSalary - 1)*100, 1)`. currentSalary 없으면 null |

- `projectedSalary`(자동, 등급 인상률+그룹보너스)·`raiseRate`(자동)는 **그대로 유지** — 프론트가 자동/최종 둘 다 표시 가능.
- simulation/team `meta.totalProjectedSalary`·`totalIncrease`는 이제 **finalProjectedSalary 합** 기준(조정분 반영 예산).

## codegen / 타입체크 결과 (모두 PASS)
1. `pnpm -C apps/api run openapi` → `nest build`(전체 타입체크) 통과 + `packages/contracts/openapi.json` 재발행(paths=117).
   - 검증: `PUT /api/v1/compensations/adjustment` 등록, `CompensationSimulationDto` 6필드, `CompensationAdjustmentDto`·`UpsertCompensationAdjustmentDto` 스키마 존재.
2. `pnpm -C packages/contracts run generate` → orval 재생성(`@growthx/contracts`):
   - `compensationsControllerUpsertAdjustment` 함수/타입, `UpsertCompensationAdjustmentDto`, `CompensationAdjustmentDto`, 갱신된 `CompensationSimulationDto`.
3. `pnpm -C packages/contracts run typecheck` → EXIT 0.

## 마이그레이션 파일 경로
`apps/api/prisma/migrations/20260616140000_compensation_adjustment/migration.sql`
(미적용 — 배포 시 `prisma migrate deploy`로 적용 필요. 로컬 DB 미기동이라 적용 검증은 미수행.)

## 규약 준수
- 응답 봉투 `{data}` (단건) — `@ApiOkEnvelope`.
- camelCase 일관, RBAC `@Roles(hr_admin)` + 401/403 구분.
- 점수·파생값 전부 백엔드 산정(finalProjectedSalary/finalRaiseRate). 프론트 위임 없음.
- N+1 금지(simulationTeam 일괄 조회). 파일당 ~200줄(조정 로직 별도 파일 분리).
- 범위 밖(monthly-performance/financial WIP) 미변경.

## QA 후속 (2026-06-16) — exportCompensation 컬럼 화면 1:1 재정렬
QA가 `exportCompensation`(excel.service.ts) 컬럼 순서가 CompensationView HEADERS 와 불일치(승격 위치 어긋남·자동projectedSalary/최종 중복) 지적 → 화면 순서로 재정렬: 본부·팀·이름·직급·평가등급·전년도·금년도·**조정분·승격·인센티브·비고·차기년도 연봉(=finalProjectedSalary)·인상률(%=finalRaiseRate)**. 자동 `projectedSalary` 별도 컬럼 제거(화면처럼 차기년도 1개만), money numFmt 목록도 동기화. DTO/계약 불변 → openapi 재발행 불필요. `pnpm -C apps/api run build` EXIT 0.

---

## 보상 엑셀 다운로드 — 화면 컬럼 정합 (2026-06-16)

`GET /excel/export/compensation` 가 화면 "보상 현황"과 컬럼/소스 갭이 있던 것을 해소. 기존엔 `Compensation` 테이블에서 이름·등급·인상률·시뮬 4열만 출력했으나, 이제 화면과 동일하게 `CompensationsService.simulationTeam(user, { cycleId })` 결과를 재사용한다. `ExcelService` 에 `CompensationsService` 를 주입(생성자 4번째 인자), `ExcelModule` 이 `CompensationsModule` 을 import + `CompensationsModule` 이 `CompensationsService` 를 export(순환참조 없음 — compensations 는 excel 비의존). 컨트롤러 `exportCompensation` 에 `@CurrentUser() user` 를 추가해 service 로 전달(hr_admin 전용이라 전체 재직자 행). 워크시트 컬럼 순서는 화면과 1:1 — 본부·팀·이름·직급·평가등급(currentGrade)·전년도 연봉(previousSalary)·금년도 연봉(currentSalary)·차기년도 연봉(자동, projectedSalary)·조정분(adjustmentAmount)·최종 제안연봉(finalProjectedSalary)·인상률%(finalRaiseRate)·승격(promotionPositionCode)·인센티브(incentiveAmount)·비고(note). 금액 6컬럼(전년/금년/차기년도/조정분/최종제안/인센티브)에 number format `#,##0` 적용, null 은 빈칸. 직급·승격 code 는 `PositionDef` 1회 조회 후 code→label 맵으로 변환(N+1 금지, 미등록 code 는 원문 노출). 엔드포인트 시그니처는 Query 동일(@CurrentUser만 추가)이라 OpenAPI 재발행 불필요. `pnpm -C apps/api run build`(nest build) EXIT 0.

변경 파일: `apps/api/src/modules/excel/excel.service.ts`(exportCompensation 재작성 + CompensationsService·AuthUser import/주입), `apps/api/src/modules/excel/excel.controller.ts`(@CurrentUser 추가), `apps/api/src/modules/excel/excel.module.ts`(CompensationsModule import), `apps/api/src/modules/compensations/compensations.module.ts`(CompensationsService export).

`GET /excel/export/compensation` 가 화면 "보상 현황"과 컬럼/소스 갭이 있던 것을 해소. 기존엔 `Compensation` 테이블에서 이름·등급·인상률·시뮬 4열만 출력했으나, 이제 화면과 동일하게 `CompensationsService.simulationTeam(user, { cycleId })` 결과를 재사용한다. `ExcelService` 에 `CompensationsService` 를 주입(생성자 4번째 인자), `ExcelModule` 이 `CompensationsModule` 을 import + `CompensationsModule` 이 `CompensationsService` 를 export. 순환참조 없음(compensations 는 excel 비의존). 컨트롤러는 `@CurrentUser() user` 를 추가해 service 로 전달(hr_admin 전용이라 전체 재직자 행). 컬럼 순서: 본부·팀·이름·직급·평가등급·전년도 연봉·금년도 연봉·차기년도 연봉(자동)·조정분·최종 제안연봉·인상률(