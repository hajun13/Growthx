# 보상 표 — 경력/연봉 컬럼 추가 (백엔드 노트)

엑셀 `2026년 연봉갱신 전달 1.xlsx`(Index 시트) K~AC 컬럼을 보상 시뮬 응답에 재현.

## 변경 파일
- `apps/api/prisma/schema.prisma` — `model User`(org schema)에 신규 스칼라 6개 추가(@map snake_case).
- `apps/api/prisma/migrations/20260616140000_user_career_roster_fields/migration.sql` — `ALTER TABLE org.users ADD COLUMN` 6개.
- `apps/api/src/modules/compensations/career-derivation.ts` — 신규. 순수 파생 함수(근속력·총경력·증감) + `rosterBaseDate`. buildSimulation 비대화 방지로 분리.
- `apps/api/src/modules/compensations/compensations.service.ts` — `buildSimulation`에 `CareerRosterInput` 입력·`baseDate` 인자 추가, 파생 결과 스프레드. `careerInputOf` 헬퍼 추가. `simulation()`/`simulationTeam()` 양쪽 호출부에 경력 입력·`rosterBaseDate(cycleYear)` 전달.
- `apps/api/src/modules/compensations/dto/compensation-response.dto.ts` — `CompensationSimulationDto`에 표시 필드 12개 추가(@ApiProperty).

## 신규 User 필드 (org schema, 모두 nullable)
| 필드 | 컬럼 | 타입 | 의미 |
|---|---|---|---|
| priorCareerMonths | prior_career_months | Int? | 전경력(월) |
| careerBaseMonths | career_base_months | Int? | 25.02기준(월) |
| careerPosition | career_position | String? | 경력직급 |
| serviceYears | service_years | Int? | 연차 |
| considerationExclusion | consideration_exclusion | String? | 고려대상 열외 라벨 |
| currentSalaryExclTransfer | current_salary_excl_transfer | Int? | 25년도 연봉(이전제외A) |

## 파생 계산 (저장 안 함, 표시 전용)
- **기준일** = 사이클 연도말 `Date.UTC(year, 11, 31)` (deterministic). `cycleYearOf(cycleId)`로 year 조회, 없으면 `new Date()`(서버 현재).
- **tenureMonths**(근속력) = `round((기준일 − hireDate)/(1000*60*60*24*30))`. hireDate null → null.
- **totalCareerMonths** = hireDate 있으면 `tenureMonths + (priorCareerMonths ?? 0)`; hireDate 없고 prior만 있으면 prior; 둘 다 없으면 null.
- **totalCareerLabel** = `${Math.floor(m/12)}년 ${m%12}개월` (totalCareerMonths 기반), null이면 null.
- **salaryDiffBA**(증감 B−A) = `currentSalary − (currentSalaryExclTransfer ?? currentSalary)`; currentSalary null이면 null, A 없으면 0.

## 계약 재발행 결과
1. `prisma generate` — OK (client v5.22.0).
2. `pnpm -C apps/api run openapi` — nest build OK + `openapi.json` 발행(paths=117).
3. `pnpm -C packages/contracts run generate` — orval 재생성 OK.
4. `pnpm -C packages/contracts run typecheck` — **EXIT 0**.
신규 필드는 `packages/contracts/src/generated/model/compensationSimulationDto.ts`에 반영 확인.

## 프론트가 소비할 신규 시뮬 필드 (CompensationSimulationDto)
모두 nullable. 기존 필드(previousSalary·currentSalary·adjustmentAmount·finalProjectedSalary·finalRaiseRate·promotionPositionCode·incentiveAmount·note·position·currentGrade·divisionName·teamName·groupTier·groupTierBonus·byGrade) 전부 유지.

| 필드 | 타입 | 엑셀 | 비고 |
|---|---|---|---|
| hireDate | `string \| null` | K | ISO date-time |
| tenureMonths | `number \| null` | L | 파생(근속력 월) |
| careerBaseMonths | `number \| null` | M | User 적재값 |
| priorCareerMonths | `number \| null` | N | User 적재값 |
| totalCareerMonths | `number \| null` | O | 파생(총경력 월) |
| totalCareerLabel | `string \| null` | P | 파생 "N년 M개월" |
| careerPosition | `string \| null` | Q | User 적재값 |
| serviceYears | `number \| null` | R | User 적재값 |
| considerationExclusion | `string \| null` | S | User 적재값(라벨) |
| currentSalaryExclTransfer | `number \| null` | U | 25년 A, null이면 프론트가 currentSalary 폴백 |
| salaryDiffBA | `number \| null` | W | 파생(증감 B−A) |

- 24년도 연봉(엑셀 T)은 **기존 `previousSalary` 재사용**(신규 필드 추가 안 함).
- 25년도 연봉 B(엑셀 V)는 **기존 `currentSalary` 재사용**.

## 범위 밖 / 미실행
- monthly-performance/financial WIP — 무관.

---

## 연봉갱신 Index 시트 적재 스크립트 (2026-06-16 추가)

### 스크립트
`apps/api/prisma/import-compensation-roster.ts`

### 열 매핑 (1-base, 헤더 행 4, 데이터 행 5~)
| 열 | 인덱스 | 엑셀 헤더 (기대) | 필드 | 타입 |
|---|---|---|---|---|
| I | 9 | 이름 | 매칭 키 | — |
| K | 11 | 입사일 | `hireDate` | Date? (비파괴) |
| M | 13 | 25.02기준 | `careerBaseMonths` | Int? |
| N | 14 | 전경력 | `priorCareerMonths` | Int? |
| Q | 17 | 경력직급 | `careerPosition` | String? |
| R | 18 | 연차 | `serviceYears` | Int? (하이픈 → null) |
| S | 19 | 고려대상 열외 | `considerationExclusion` | String? |
| T | 20 | 24년도 연봉 | `previousSalary` | Float? (비파괴) |
| U | 21 | 이전제외A | `currentSalaryExclTransfer` | Int? |
| V | 22 | 이전포함B | `currentSalary` | Float? (비파괴) |
| X | 24 | 조정분 | `CompensationAdjustment.adjustmentAmount` | Int? (--cycleId 필요) |
| AA | 27 | 승격 | `CompensationAdjustment.promotionPositionCode` | String? (PositionDef 역매핑) |
| AB | 28 | 인센티브 | `CompensationAdjustment.incentiveAmount` | Int? (--cycleId 필요) |

### 매칭 전략
- 매칭 키 = I열 이름 (이름 기반 단일 키)
- DB·엑셀 **양쪽 모두 유일**할 때만 자동 매칭
- DB 동명이인 또는 엑셀 이름 중복 → **검토 큐 보고만** (쓰기 안 함)
- DB 미매칭 → **검토 큐 보고만**
- 비파괴 기본: 기존 값이 있으면 skip. `--overwrite` 시 덮어씀.

### 헤더 검증 안전장치
행 4의 각 열을 실제 읽어 기대 텍스트 포함 여부 확인. 불일치 시 WARN 출력 후 계속 진행(오류 종료는 안 함 — 헤더가 다소 달라도 동작 가능하게).

### CompensationAdjustment 선택 기능 (--cycleId)
- X/AA/AB 열 적재는 `--cycleId <id>` 가 있을 때만 실행
- `userId + cycleId` 복합 유니크 키로 upsert
- AA(승격 라벨) → `PositionDef.label` 역매핑으로 `code` 조회; 매핑 실패 시 저장 안 하고 경고만

### 컴파일 검증 결과
```
node_modules/.bin/tsc --noEmit -p tsconfig.json  →  EXIT 0 (에러 0건)
```
- `prisma.positionDef` — `PositionDef` 모델 스키마 확인 완료 (code, label 필드 존재)
- `prisma.compensationAdjustment.upsert` — `@@unique([userId, cycleId])` 확인 완료
- 신규 User 필드 6개 모두 Prisma client 타입과 일치

### 실행법
```bash
# DRY-RUN: 엑셀 파싱·매칭 결과만 출력 (DB 쓰기 없음)
ts-node prisma/import-compensation-roster.ts --dry

# 기본 적재 (비파괴 — 빈 값만 채움)
ts-node prisma/import-compensation-roster.ts

# 덮어쓰기 모드
ts-node prisma/import-compensation-roster.ts --overwrite

# 파일 경로 직접 지정
ts-node prisma/import-compensation-roster.ts "C:/path/to/file.xlsx" --dry

# CompensationAdjustment 포함 적재
ts-node prisma/import-compensation-roster.ts --cycleId <cycleUUID>

# 모든 옵션 조합 예시 (DRY-RUN으로 먼저 확인 권장)
ts-node prisma/import-compensation-roster.ts "C:/Users/user/Downloads/2026년 연봉갱신 전달 1.xlsx" --dry
ts-node prisma/import-compensation-roster.ts "C:/Users/user/Downloads/2026년 연봉갱신 전달 1.xlsx" --overwrite --cycleId <cycleUUID>
```

### 주의사항
- 실제 DB 기동 상태에서만 실행 가능 (`DATABASE_URL` 환경변수 필요)
- `--dry` 먼저 실행해서 검토 큐(동명이인/미매칭)를 확인한 뒤 실제 적재 권장
- 검토 큐 항목은 수동으로 이메일 등 추가 키를 확인해 직접 UPDATE 처리
