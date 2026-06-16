# 보상 현황 표 재설계 — 프론트엔드 노트

날짜: 2026-06-16

## 작업 개요
엑셀 `2026년 연봉갱신 전달 1.xlsx` Index 시트 K~AC 컬럼 순서로 보상 현황 표를 전면 재설계.
이름/본부·팀 컴팩트화 + 좌측 3컬럼 sticky-left + 22컬럼 가로 스크롤.

## 변경 파일

### 신규
- `apps/web/features/admin-compensation/ui/columns.ts`
  - `ColDef` 인터페이스 + `COLUMNS` 배열 22개 정의 (label·sub·width·numeric·sticky·editable)
  - `STICKY_OFFSETS` 누적 left(px): name=0 / position=148 / grade=216
  - `stickyLeft(colIndex)` 헬퍼, `TABLE_MIN_WIDTH` 합산 상수

### 수정
- `apps/web/features/admin-compensation/ui/CompensationRow.tsx`
  - CSS grid div → semantic `<tr>` + 22개 `<td>` 로 전환
  - 인덱스 0~2: `position: sticky; left: stickyLeft(idx); z-index: 1; background: hover 색`
  - 새 nullable 필드 12개 렌더:
    - hireDate → `fmtDate()` "YYYY.MM.DD"
    - tenureMonths / careerBaseMonths / priorCareerMonths / totalCareerMonths (월, tabular-nums)
    - totalCareerLabel (연월 문자열)
    - careerPosition / serviceYears / considerationExclusion
    - currentSalaryExclTransfer (`?? currentSalary` 폴백)
    - salaryDiffBA (+/- 색상, 증감)
  - 편집 셀 4개 (조정분·승격·인센티브·비고) 기존 blur-upsert 로직 100% 보존
  - null 표시는 `'—'` (muted 색 적용)

- `apps/web/features/admin-compensation/ui/CompensationView.tsx`
  - CSS grid div → `<table>` + `<thead>` + `<tbody>` 전환
  - `<thead><tr>` 헤더: `position: sticky; top: 0; z-index: 10(20)` + sticky-left 교차 셀 `z-index: 20`
  - 표 래퍼: `overflow-x: auto; position: relative` (sticky-left 정상 동작 필수)
  - `handlePrint`: COLUMNS 배열 기반 22컬럼 헤더·행 생성 (편집 셀은 현재값 표시)
  - 요약 카드·본부 필터·등급 인상률 기준 배너 기존 로직 유지
  - `TABLE_MIN_WIDTH` 자동 계산(columns.ts) — 하드코딩 제거

## 컬럼 순서 (최종)
| # | 라벨 | 소스 필드 | sticky/편집 |
|---|------|----------|-------------|
| 1 | 이름/본부·팀 | userName + divisionName + teamName | sticky |
| 2 | 직급 | position (getPositionLabel) | sticky |
| 3 | 등급 | currentGrade (gradeColor 배지) | sticky |
| 4 | 입사일 | hireDate | |
| 5 | 근속력(월) | tenureMonths | numeric |
| 6 | 25.02기준(월) | careerBaseMonths | numeric |
| 7 | 전경력(월) | priorCareerMonths | numeric |
| 8 | 총경력(월) | totalCareerMonths | numeric |
| 9 | 총경력(연월) | totalCareerLabel | |
| 10 | 경력직급 | careerPosition | |
| 11 | 연차 | serviceYears | numeric |
| 12 | 고려대상 열외 | considerationExclusion | |
| 13 | 24년도 연봉 | previousSalary (만원) | numeric |
| 14 | 25년도 이전제외A | currentSalaryExclTransfer ?? currentSalary | numeric |
| 15 | 25년도 이전포함B | currentSalary | numeric |
| 16 | 증감(B-A) | salaryDiffBA (+/- 색상) | numeric |
| 17 | 조정분(만원) | adjustmentAmount | editable |
| 18 | 제안연봉 | finalProjectedSalary (강조) | numeric |
| 19 | 인상률 | finalRaiseRate (+X.X% 색상) | numeric |
| 20 | 승격 | promotionPositionCode select | editable |
| 21 | 인센티브(만원) | incentiveAmount | editable |
| 22 | 비고 | note | editable |

## 결정 사항
- **CSS grid → semantic `<table>`**: sticky-left + sticky-top 헤더 교차 셀 고정은
  CSS grid `display` 방식으로는 `position: sticky`가 제한됨. `<table>`이 표준적이며 동작 신뢰성 높음.
- **파일 분리**: `columns.ts`(상수)·`CompensationRow.tsx`(행)·`CompensationView.tsx`(컨테이너)로 3분리 → 각 ~200줄 이내.
- **null 표시**: 경력 필드 미적재 시 다수 '—'. 수치 '—'는 muted 색(#cac4d2 혹은 #797582)으로 차분하게 처리.
- **salaryDiffBA null**: B와 A가 동일하면 0 → diff 0, 필드 null이면 '—'. 둘 다 자연스럽게 처리.
- **기존 저장 로직 보존**: `handleBlurSave` 4필드 일괄 upsert, 디바운스 150ms, saving 상태 100% 유지.

## 타입체크
`cd apps/web && ../../node_modules/.bin/tsc --noEmit` → **EXIT 0, 에러 0건**
