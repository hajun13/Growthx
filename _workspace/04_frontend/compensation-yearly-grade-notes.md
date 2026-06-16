# 보상 현황 — 연도별 평가등급 칩 + 동적 연도 라벨 구현

## 구현 일자
2026-06-16

## 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `apps/web/features/admin-compensation/ui/columns.ts` | `buildColumns(currentCycleYear)` 함수 추가, `COLUMNS` 폴백 유지 |
| `apps/web/features/admin-compensation/ui/GradeChip.tsx` | 신규 생성 — 등급 칩 헬퍼 컴포넌트 (~60줄) |
| `apps/web/features/admin-compensation/ui/CompensationRow.tsx` | col 12/14 셀에 `GradeChip` 삽입, `columns` prop 추가 |
| `apps/web/features/admin-compensation/ui/CompensationView.tsx` | `buildColumns(currentCycleYear)` 사용, handlePrint 연도/등급 반영 |

## 구현 세부

### 1. columns.ts — 동적 라벨 (`buildColumns`)
- `buildColumns(currentCycleYear: number | null | undefined): ColDef[]` 신규 함수.
- col 12 헤더: `${currentCycleYear - 1}년도` (null이면 "전년도" 폴백).
- col 13/14 헤더: `${currentCycleYear}년도` (null이면 "25년도" 폴백).
- col 17 헤더: `${currentCycleYear + 1}년도(제안)` (null이면 "제안연봉" 폴백).
- col 12/14 너비를 88px → 96px로 넓혀 등급 칩 공간 확보.
- `COLUMNS` 상수는 `buildColumns(null)` 폴백으로 유지(기존 import 호환).

### 2. GradeChip.tsx — 신규 헬퍼 컴포넌트
- `GRADE_SYSTEM_START_YEAR = 2025` 상수 정의 (백엔드 노트 일치).
- `GradeChip({ grade, cycleYear })` 표시 규칙:
  - `grade != null` → 등급 칩 (gradeColor S/A/B/C/D).
  - `grade == null && cycleYear != null && cycleYear < 2025` → "도입전" 회색 중립 칩 (bg #f2f3f7, fg #9490a0).
  - 그 외 → null (칩 없음).
- "도입전" 칩은 D(빨강 #F44336)와 색·폰트 굵기 모두 다름.
- 칩 스타일: `marginTop: 3`, `fontSize: 9.5`, `borderRadius: 4`.

### 3. CompensationRow.tsx
- col 12 (전년도 연봉): `<div>금액</div><GradeChip grade={row.previousGrade} cycleYear={row.previousCycleYear} />`.
- col 14 (이전포함B): `<div>금액</div><GradeChip grade={row.currentGrade} cycleYear={row.currentCycleYear} />`.
- `columns?: ColDef[]` prop 추가 — 부모에서 `DYNAMIC_COLS` 전달 시 그것을 사용, 없으면 정적 `COLUMNS` 폴백.
- col 2 (sticky 평가등급) 헤드라인 컬럼은 기존 그대로 유지.

### 4. CompensationView.tsx
- `currentCycleYear` = `rows[0]?.currentCycleYear ?? null` (행 데이터에서 파생).
- `DYNAMIC_COLS = buildColumns(currentCycleYear)` 렌더 시점 계산.
- `dynamicMinWidth` = `DYNAMIC_COLS.reduce(...)` (기존 정적 `TABLE_MIN_WIDTH` 대체).
- `thStyle(idx)`: `DYNAMIC_COLS[idx]` 참조 (이전 `COLUMNS[idx]`).
- `<CompensationRow columns={DYNAMIC_COLS} />` 전달.
- `handlePrint`: 헤더는 `DYNAMIC_COLS` 사용, 연봉 셀은 `printSalaryWithGrade()` 헬퍼 — 등급 있으면 "9,800만원 / S", 도입전이면 "5,600만원 / 도입전", 없으면 금액만.

## 타입 체크
`node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` → **EXIT 0 (에러 0건)**.

## 결정 노트
- 컬럼 추가 없이 셀 2줄(금액 + 칩)로 구현 — 테이블 너비 불변(컬럼 수 22개 유지).
- `previousGrade`·`previousCycleYear`·`currentCycleYear` 필드는 백엔드 `CompensationSimulationDto` codegen 산출물에서 그대로 소비 (추측 캐스팅 없음).
- `GRADE_SYSTEM_START_YEAR` 상수를 `GradeChip.tsx`에서 export — CompensationView의 handlePrint도 import해서 단일 출처 유지.
- 파일상한(~200줄): CompensationRow 261줄(GradeChip import 2줄 추가), GradeChip 65줄 신규. 기존 CompensationRow 자체가 상한 초과였으나 이번 변경은 최소(2줄+1줄) 추가에 그침.
