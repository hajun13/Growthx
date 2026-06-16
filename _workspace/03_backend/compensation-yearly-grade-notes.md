# 보상 시뮬 — 연도별 평가등급 추가 (백엔드)

## 목적
보상 표의 각 연봉(전년도/금년도) 셀에 그 해 **평가등급 칩**을 표시하기 위해, 시뮬레이션 응답에 직전 사이클 등급·연도 라벨을 추가. 평가등급제는 **2025년부터 도입** → 2024 이하 사이클에는 등급이 없다.

## 변경 파일
- `apps/api/src/modules/compensations/compensations.service.ts`
- `apps/api/src/modules/compensations/dto/compensation-response.dto.ts`
- (재발행) `packages/contracts/openapi.json` + `packages/contracts/src/generated/**` (orval codegen 산출물)

## 신규 DTO 필드 (CompensationSimulationDto — 모두 nullable, @ApiProperty)
프론트가 보상 표에 쓸 필드:

| 필드 | 타입 | 의미 |
|------|------|------|
| `previousGrade` | `Grade \| null` | 직전 사이클 평가등급. **도입(2025) 이전이면 null**, 직전 사이클 자체가 없어도 null. 전년도 연봉(previousSalary) 셀의 등급 칩. |
| `previousCycleYear` | `number \| null` | 직전 사이클 연도. previousGrade 의 연도 라벨이자 **도입전 판정**(`<2025`)·전년도 칩 표시 여부 결정. 직전 사이클 없으면 null. |
| `currentCycleYear` | `number \| null` | 조회(금년도) 사이클 연도. currentGrade 의 연도 라벨. 사이클 없으면 null. |

기존 필드(`currentGrade`·`previousSalary`·`previousSalarySource`·`currentSalary`·`byGrade` 등) 전부 유지.

### 프론트 '도입전' vs '—' 구분 가이드
- `previousCycleYear == null` → 직전 사이클 없음 → 칩 미표시(또는 '—').
- `previousCycleYear < 2025 && previousGrade == null` → **등급제 도입전** → "도입전" 배지 표시 가능.
- `previousCycleYear >= 2025 && previousGrade == null` → 도입 후이나 미산정 → '—'.
- `previousGrade != null` → 해당 등급 칩 + `previousCycleYear` 라벨.

## 로직

### 1. 직전 사이클 등급 파생 (`derivePreviousCycleGrades`)
- "직전 사이클" = `evaluationCycle` 중 `year < 현재 사이클 year` 인 것의 **최대 year 1개**(`findFirst` orderBy year desc). 없으면 `previousCycleYear=null`.
- 그 사이클 `EvaluationResult` 를 **1회 `findMany`** → `userId → finalGrade` 맵. **N+1 없음.**
  - `simulation()`(단건): `userIds=[userId]` 로 한정 조회.
  - `simulationTeam()`(목록): `userIds = 전체 user id` 로 1회 조회, 루프 밖에서 1회만 호출.

### 2. 등급제 도입연도 게이팅 (`gatePreviousGrade`)
- 상수 `GRADE_SYSTEM_START_YEAR = 2025` (service 상단, 주석 "2025부터 평가등급제 도입").
- `previousCycleYear != null && previousCycleYear < 2025` 이면 `previousGrade = null`(도입 전엔 등급 자체가 없음). 그 외엔 직전 사이클 finalGrade(없으면 null).
- `currentGrade` 는 기존대로 조회 사이클 finalGrade. 과거(<2025) 사이클 조회 시엔 자연히 result 없어 null.

### 3. 배선 (`buildSimulation`)
- 입력 user 객체에 `previousGrade`·`previousCycleYear` 추가.
- `currentCycleYear` 는 cycle 단위라 함수 인자로 주입(호출부에서 `cycleYearOf` 결과 전달).
- 반환 객체에 3필드 포함.

## codegen 결과
1. `pnpm -C apps/api run openapi` → `openapi.json 발행 완료 (paths=117)` (nest build = tsc 통과)
2. `pnpm -C packages/contracts run generate` → orval EXIT 0
3. `pnpm -C packages/contracts run typecheck` → tsc --noEmit **EXIT 0**
- 생성 확인: `compensationSimulationDto.ts` 에 `currentCycleYear`·`previousCycleYear`·`previousGrade`(nullable enum) 반영.

## 참고/주의
- `previousGrade` 는 직전 *EvaluationCycle* 의 등급이며, 기존 `previousSalary` 파생(직전 *Compensation* 행)과는 **다른 축**(전자=등급제 사이클, 후자=보상 누적). 의도적으로 별도 헬퍼로 분리.
- 봉투·camelCase·기존 스타일 준수. 범위 밖(monthly-performance/financial WIP·화면) 미변경.
- `compensations.service.ts` 가 777줄로 파일상한(~200줄) 초과 — 본 작업 이전부터 비대(708줄). 별도 리팩터 후보(use-case 파일 분할), 이번 범위에선 미수행.
