# QA 리포트 — 보상 현황 화면 재구성 (경계면 정합성)

- 모듈: 보상 시뮬레이션 → 레퍼런스 "보상 현황" 재구성
- 일자: 2026-06-05
- 검증 방식: 양쪽 동시 읽기(생산자↔소비자) + 타입체크
- 판정: **PASS (조건부 — 결함 1건은 LOW, 권고 수정)**

## 빌드 결과
| 대상 | 명령 | 결과 |
|------|------|------|
| API | `apps/api` `npx tsc --noEmit` | 에러 0 (PASS) |
| Web | `apps/web` `npx tsc --noEmit` | 에러 0 (PASS) |

## 교차검증 체크리스트

### 1. 백엔드 응답 ↔ 프론트 타입
- [x] 봉투 일치 — `simulationTeam` → `{data,meta}`, `apiGetList` unwrap, 페이지 `teamSim?.data ?? []`. EnvelopeInterceptor 통과(이중 래핑 없음).
- [x] 신규 4필드 필드명 일치 — `position`/`previousSalary`/`divisionName`/`teamName` 양쪽 동일 (camelCase).
- [x] `previousSalary`/`divisionName`/`teamName` nullable 일치 (`number|null`/`string|null`).
- [~] `position` nullable 불일치 (LOW) — 아래 결함 1 참조. 런타임 안전(DB 비널 enum)하나 타입 계약 불일치.
- [x] `currentSalary`/`currentGrade`/`raiseRate`/`projectedSalary` nullable 양쪽 일치.
- [x] `byGrade[]` 유지 — 백엔드 `buildSimulation` 여전히 산정, `SalarySimCard` 소비처 정상.

### 2. 화면 ↔ 응답 봉투 / 단위 / 분모
- [x] unwrap 방식 `{data,meta}` 일치.
- [x] 원→만원 변환 `/10000` 일관 (`toManwon`·`toManwonPrint` 동일 로직).
- [x] 인상률 % 계산 분모 0/null 방어 — 화면 `r.currentSalary !== 0` 가드(L366), print `r.currentSalary !== 0`(L130), `hasDiff` 널 가드(L359-360). 안전.

### 3. 죽은 코드 제거
- [x] recharts/Slider/"대상자 인상률 산출" 섹션 grep 결과 0건. import·참조 잔존 없음.

### 4. 권한 가드
- [x] 프론트 `isHrAdmin(user.role)` 가드 유지(L61, Forbidden 폴백).
- [x] **백엔드 가드 존재** — 컨트롤러 `simulation/team`에 `@Roles(hr_admin, division_head, team_lead)`. service에서 부서 하위 트리 행수준 RBAC(`isDepartmentUnder`/`descendantDeptIds`). 프론트만 숨긴 보안 결함 없음.

### 5. 마이그레이션 ↔ schema.prisma
- [x] `20260605010019_add_user_previous_salary/migration.sql`: `ALTER TABLE "users" ADD COLUMN "previous_salary" DOUBLE PRECISION;` (nullable) == schema `previousSalary Float? @map("previous_salary")`. 일치.

### 6. 출력(print) 로직
- [x] print 컬럼(본부/팀/이름/직급/전년도/금년도/등급/차기/인상액)이 화면 테이블과 동일 항목.
- [x] 단위·null 처리 일관 — `toManwonPrint` null→'-', `positionLabel[r.position] ?? '-'`, 등급 null '-'.

---

## 결함 목록

### [LOW] 결함 1 — `position` nullable 타입 계약 불일치 (런타임 안전, 권고)
- 생산자: `apps/api/src/modules/compensations/compensations.service.ts:189,252,318` — `position: u.position ?? null`, `buildSimulation` 파라미터 타입 `position: string | null`(L292), 반환 `position: u.position`(L318)이 `string|null`로 추론됨.
- 소비자: `apps/web/lib/types.ts:729` — `position: Position;` (non-null).
- 영향: 런타임은 안전. `User.position`이 Prisma 필수 enum(`schema.prisma:163 position Position`, DB NOT NULL)이라 실제 null 불가. 또한 화면/print 모두 `positionLabel[r.position] ?? '-'`로 null 방어됨. 따라서 크래시 없음.
- 그러나 타입 계약상 생산자가 `string|null`로 흘리고 소비자가 `Position`(non-null)로 단언하는 비대칭이 존재. 향후 position을 nullable로 바꾸거나 소비처에서 `positionLabel` 폴백을 제거하면 잠재 버그.
- 수정 방법(택1, 백엔드 권장):
  - (권장) `buildSimulation` 파라미터·반환 타입을 `position: Position`(non-null)로 좁히고 `u.position ?? null` → `u.position`로 변경. `User.position`이 비널 enum이므로 `?? null` 불필요.
  - (대안) 프론트 `types.ts:729`를 `position: Position | null;`로 완화하고 현 폴백 유지(이미 `?? '-'` 존재하므로 무해).

---

## 회귀(regression) 확인
- `CompensationSimulation` 타 소비처 `apps/web/components/SalarySimCard.tsx` — `byGrade`/`raiseRate`/`projectedSalary` 사용, 백엔드 유지 필드라 정상. 슬라이더 제거가 개인 시뮬 카드에 영향 없음.

## 통지 대상
- 결함 1: backend(생산자) + frontend(소비자) 양쪽. LOW이므로 릴리스 차단 아님.
