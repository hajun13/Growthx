# admin-monthly-performance

경영실적(월별 손익) 입력 화면 슬라이스. **image 11 시안 재현(2026-07-02, Part/ 수정요청 P15)** —
가로 스크롤 엑셀 그리드를 폐기하고 **1~12월 탭 선택 방식**으로 교체했다.
부서(그룹/본부)·기준연도 단위로 **매출·원가**의 월별 목표/실적과 전년 실적을
입력하면 **매출총이익(=매출−원가)·매출총이익율(=이익/매출)·년계(=Σ월)**가
수식으로 자동계산된다. (매출 0/null → 율 '-'.)
그룹 부서 저장 시 등급풀 산정에 쓰이는 연간 그룹 실적도 함께 동기화된다.

## 구조
- `api.ts` — `@/lib/api`(`apiGet`/`apiPost`) 직접 호출. 봉투 unwrap은 `lib/api.ts`가 수행.
  타입은 계약(`contract-financial-performance.md`) 1:1 수기 정의(`FinancialGridData`/
  `FinancialGridColumn`/`BulkSaveBody`/`BulkSaveResult`). `@growthx/contracts` codegen 미사용.
- `hooks.ts` — `useAsync` 기반 `useFinancialGrid` + 명령 `financialGridCommands.bulk`.
- `ui/MonthlyPerformanceView.tsx` — 화면 오케스트레이션(부서 선택, 저장 버튼, 레이아웃 조립).
- `ui/useScopedDeptOptions.ts` — 부서 옵션(그룹/본부/팀 통합 + visibilityScope 하위 트리 제한).
- `ui/usePerfDerived.ts` — draft 기반 파생 계산(차트 데이터·년계 요약·선택월 4행·달성 현황).
- `ui/usePerfSave.ts` — 저장 커맨드(최종저장=bulk API 호출 / 임시저장=로컬 draft만, API 갭).
- `ui/PerfSummaryCards.tsx` — 상단 요약 카드 7종(누적매출/원가/매출총이익/이익률/입력완료/예상달성률/저장상태).
- `ui/PerfCharts.tsx` — 매출 목표vs실적(라인) / 매출총이익vs이익률(바+라인 이중Y축) 분리 차트.
- `ui/MonthTabBar.tsx` — 1~12월 탭 선택 바(입력완료 월 도트 표시).
- `ui/MonthInputTable.tsx` — 선택 월 1개월치 입력 표(전년/목표/실적/달성률/전년대비증감/비고).
- `ui/AchievementPanel.tsx` — 우측 "목표 대비 달성 현황" 패널(양호/주의/위험 배지).
- `ui/InputGuide.tsx` — 하단 입력 가이드(실적입력/입력기간/목표달성기준/저장안내).
- `ui/perfFormat.ts` — 억/만 축약, 퍼센트, 증감률, 달성 톤 판정 포맷터.
- `ui/FinancialGridHelpers.ts` — 순수 계산(grossProfit·margin·년계·라이브 파생). 셀 선택/TSV 붙여넣기
  헬퍼는 옛 엑셀 그리드 전용이라 미사용 제거(dead code) — 필요 시 git 이력에서 복구 가능.

## 엔드포인트
- `GET /monthly-performance/financial-grid?cycleId&departmentId&year` → 그리드(columns[15]).
- `POST /monthly-performance/bulk` → 매출/원가 12개월 + 전년 일괄 저장(=최종저장).

## API 갭 (P15)
- **임시/최종저장 구분 없음**: API는 `bulk` 단일 저장만 존재. UI는 "임시저장"(로컬 draft만 유지,
  서버 미호출) / "최종저장"(bulk 호출)으로 구분 표시하되, 새로고침 시 임시저장 내용은 유실된다.
  진짜 서버측 draft 상태가 필요하면 `MonthlyPerformance`에 `status: draft|final` 필드 추가 필요.
- **비고(월별 코멘트) 필드 없음**: 입력 표 "비고" 열은 UI만 존재, 저장하지 않음(placeholder).

## 라우트
`app/(main)/admin/monthly-performance/page.tsx` 는 `<MonthlyPerformanceView/>` 만 렌더.

## RBAC
hr_admin 전체 입력, 그룹대표/본부장 입력은 본인 scope 하위로 제한, team_lead 조회 전용.
백엔드 `assertWriteAccess`/`assertReadAccess` 가 최종 행 수준 권한을 강제한다.
