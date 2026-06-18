# admin-monthly-performance

경영실적(월별 손익) 입력 화면 슬라이스. 엑셀 "경영실적" 양식 그대로 —
부서(그룹/본부)·기준연도 단위로 **매출·원가**의 1~12월 목표/실적과 전년 실적을
입력하면 **매출총이익(=매출−원가)·매출총이익율(=이익/매출)·년계(=Σ월)**가
수식으로 자동계산된다. (매출 0/null → 율 '-'.) 엑셀 복사-붙여넣기 입력 지원.
그룹 부서 저장 시 등급풀 산정에 쓰이는 연간 그룹 실적도 함께 동기화된다.

## 구조
- `api.ts` — `@/lib/api`(`apiGet`/`apiPost`) 직접 호출. 봉투 unwrap은 `lib/api.ts`가 수행.
  타입은 계약(`contract-financial-performance.md`) 1:1 수기 정의(`FinancialGridData`/
  `FinancialGridColumn`/`BulkSaveBody`/`BulkSaveResult`). `@growthx/contracts` codegen 미사용.
- `hooks.ts` — `useAsync` 기반 `useFinancialGrid` + 명령 `financialGridCommands.bulk`.
- `ui/MonthlyPerformanceView.tsx` — 화면 본체(부서·연도 선택, 그리드, 저장, 권한 분기).
- `ui/FinancialGrid.tsx` — 그리드 셸(헤더·colgroup·TSV 복붙 handlePaste·셀 값 결정).
- `ui/FinancialGridRows.tsx` — `EditableRows`(매출·원가 입력행) + `DerivedRows`(이익·이익율 자동행).
- `ui/FinancialGridHelpers.ts` — 순수 계산(grossProfit·margin·년계·라이브 파생·TSV 파싱·붙여넣기 정규화).
- `ui/FinancialGridStyles.ts` — Kinetic 팔레트·표 스타일·포맷터(fmtMargin/fmtProfit).

## 엔드포인트
- `GET /monthly-performance/financial-grid?cycleId&departmentId&year` → 그리드(columns[15]).
- `POST /monthly-performance/bulk` → 매출/원가 12개월 + 전년 일괄 저장.

## 라우트
`app/(main)/admin/monthly-performance/page.tsx` 는 `<MonthlyPerformanceView/>` 만 렌더.

## RBAC
hr_admin 전체 입력, 그룹대표/본부장 입력은 본인 scope 하위로 제한, team_lead 조회 전용.
백엔드 `assertWriteAccess`/`assertReadAccess` 가 최종 행 수준 권한을 강제한다.
