# API 계약 델타 — YoY 2차: 전년도 연봉 자동 파생

> 작성: backend-engineer · 2026-06-05 · 기준: requirements-yoy2.md §S2.
> 봉투(`{data}`/`{data,meta}`/`{error}`)·camelCase·RBAC 는 기존과 **동일**. 신규 엔드포인트 없음 — 기존 보상 응답에 필드 추가·`previousSalary` 의미 변경.

---

## 1. 핵심 변경: `previousSalary` 의미

기존: `previousSalary` = 수기 입력값(`User.previousSalary`)을 그대로 노출.
**변경: `previousSalary` = 누적된 직전 사이클 연봉 기록에서 자동 파생.** 수기 값은 fallback 으로만 사용. 사이클이 쌓일수록 자동 갱신.

응답 필드명(`previousSalary`)·타입(`number | null`)은 **불변**. 출처를 알리는 `previousSalarySource` 필드를 추가한다.

### 파생 우선순위 (백엔드 단일 책임)
대상 사이클 연도(`year`)보다 작은 **직전 사이클**(그 사이클에 `simulated=false` Compensation 이 존재하는, year 최대) 의:
1. `baseSalary`(있으면) → `source: "derived"`
2. 없으면 그 Compensation 의 `nextYearSalary`(이월 기준) → `source: "carryover"`
3. 직전 사이클 Compensation 자체가 없으면 `User.previousSalary`(수기 fallback) → `source: "manual"`
4. 그것도 없으면 `null` → `source: "none"`

```ts
type PreviousSalarySource = 'derived' | 'carryover' | 'manual' | 'none';
```

---

## 2. 영향 받는 응답

### 2-1. `GET /compensations` (목록) — `data[]` 각 행
| 필드 | 타입 | 의미 |
|------|------|------|
| `previousSalary` | `number \| null` | **파생된** 전년도 연봉(수기 fallback). |
| `previousSalarySource` | `PreviousSalarySource` | 출처. **신규.** |
| `baseSalary` | `number \| null` | 이 사이클의 연봉 산정 기준(=그 시점 currentSalary). 확정 저장 시 기록. **신규.** |

(기존 필드 `id`·`userId`·`cycleId`·`finalGrade`·`raiseRate`·`nextYearSalary`·`simulated`·`userName`·`departmentName`·`createdAt` 불변.)

### 2-2. `GET /compensations/simulation` (개인) — `data`
### 2-3. `GET /compensations/simulation-team` (팀/부서) — `data[]` 각 행
| 필드 | 타입 | 의미 |
|------|------|------|
| `previousSalary` | `number \| null` | **파생된** 전년도 연봉. (기존 필드, 값 출처만 변경.) |
| `previousSalarySource` | `PreviousSalarySource` | 출처. **신규.** |

(기존 필드 `userId`·`userName`·`departmentName`·`cycleId`·`currentSalary`·`currentGrade`·`raiseRate`·`projectedSalary`·`position`·`divisionName`·`teamName`·`groupTier`·`groupTierBonus`·`byGrade[]` 불변. simulation-team `meta` 합계 불변.)

---

## 3. persist 동작 (체이닝)

`POST /compensations/compute`(simulated 기본 false)로 보상 확정·저장 시, 각 Compensation 의 `baseSalary = round(user.currentSalary)` 를 기록. 다음 연도 사이클의 simulation/list 가 이 `baseSalary` 를 `previousSalary` 로 읽어간다. simulated=true 에도 baseSalary 를 채우지만, 파생은 `simulated=false` Compensation 만 소스로 사용.

---

## 4. 스키마 (additive)

`Compensation.baseSalary Int?` (`@map("base_salary")`). NULL 허용, 기존 데이터 무해. 마이그레이션 `20260605060000_add_compensation_base_salary`.

---

## 5. RBAC / 봉투

기존과 동일. `GET /compensations*` 행 수준 스코프(employee=본인, hr_admin/company=전체, 그 외=가시 부서) 불변. 401/403 구분 불변. 파생은 추가 권한 노출 없음(이미 접근 가능한 행에만 값 채움).

---

## 6. QA 포인트

- 직전 사이클 `baseSalary` 우선 → 없으면 `nextYearSalary` → 수기 → null 의 fallback 체인.
- `previousSalarySource` 값이 실제 채워진 소스와 일치.
- 직전 사이클(year<현재 중 최대) 선택이 정확(2개 이상 과거 사이클 존재 시 가장 최근).
- 기존 보상화면(`/admin/compensation`) 비회귀: `previousSalary` 필드 그대로 내려가되 값 출처만 변경. `currentSalary`(금년)·`nextYearSalary`(차기) 로직 불변.
- N+1 없음: simulation-team·list 는 직전 사이클 Compensation 일괄 조회로 맵 캐시.
- 2025(연봉 컬럼 없는) 사이클: `previousSalary=null`·`source="none"` 정상(2025 자체 연봉 비어도 됨). 2026↑ compute 후 baseSalary 가 쌓이면 다음 연도부터 `derived` 로 자동 채워짐.
