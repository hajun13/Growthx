# 경영실적(월별 손익) 그리드 — 구현 노트

날짜: 2026-06-16

## 변경 파일

| 파일 | 내용 |
|------|------|
| `apps/web/features/admin-monthly-performance/api.ts` | 전면 교체. @growthx/contracts 의존 제거 → lib/api.ts(apiGet/apiPost) 직접 사용. FinancialGridColumn·BulkSaveBody 등 계약 1:1 타입 추가. |
| `apps/web/features/admin-monthly-performance/hooks.ts` | useMonthlyPerformance 제거 → useFinancialGrid + financialGridCommands.bulk 로 교체. |
| `apps/web/features/admin-monthly-performance/ui/MonthlyPerformanceView.tsx` | 카테고리별 카드·차트·월별 표 폐기 → FinancialGrid 컴포넌트 교체. |
| `apps/web/features/admin-monthly-performance/ui/FinancialGridHelpers.ts` | 신규. 로컬 계산(grossProfit·margin·yearTotal·TSV 파싱·숫자 정규화) 순수 헬퍼. |
| `apps/web/features/admin-monthly-performance/ui/FinancialGrid.tsx` | 신규. 4행×15열 엑셀 양식 그리드 컴포넌트. handlePaste(TSV 복붙) 포함. |

## 설계 결정

### API 레이어
- `@growthx/contracts` codegen 참조 제거(현행 Phase 1 구조). `lib/api.ts`의 `apiGet`/`apiPost` 래퍼 사용.
- 봉투 unwrap은 `apiGet`/`apiPost` 내부에서 단일 처리.
- 기존 `/monthly-performance` list 엔드포인트 훅은 삭제(새 화면 불필요). 라우트 페이지(page.tsx)는 변경 없음.

### 그리드 구조
- 행: 매출(목표/실적) + 원가(목표/실적) = 4 입력 행 + 이익(목표/실적) 2 읽기전용 행 + 이익율(목표/실적) 2 읽기전용 행 = 총 8행.
- 열: 전년(prevYear) + 1~12월 + 년계 = 15열. columns[15] 고정 순서와 1:1 대응.
- 전년 열: 실적만 입력(목표 없음). revenueTarget/costTarget은 읽기전용 '-' 표시.

### 라이브 계산
- 매출총이익 = 매출 − 원가(목표/실적 각각). 한쪽 null → 0 취급.
- 매출총이익율 = grossProfit / 매출 × 100. 매출 0 또는 null → null → '-' 렌더.
- 년계 = 1~12월 합산. 모두 null → null.
- **프론트는 라이브 미리보기용으로만 계산. 저장 후 서버 응답(columns)이 진실 소스.**

### TSV 복붙(handlePaste)
- admin-kpi-import의 handlePaste 패턴을 FinancialGrid에 이식.
- 시작 셀(data-col/data-row) 기준으로 오른쪽(열)·아래(행) 방향으로 채움.
- 전년 열 시작 시 prevYear 열만 채움(월 열로 넘기지 않음).
- 엑셀 천단위 쉼표·억/만 단위·퍼센트 기호를 normalizePasteNum 으로 정규화.

### dirty 추적
- columnsToInitDraft(서버 데이터)와 현재 draft 를 비교. 하나라도 다르면 dirty=true → 저장 버튼 활성.
- 부서/주기 변경 시 draft 리셋.

### 권한
- canEdit = hr_admin || division_head. 나머지는 readOnly(input disabled).
- division_head는 본인 본부만 deptOptions에 노출(프론트 UX 가드, 백엔드 assertWriteAccess 최종 강제).

## 타입 체크
- `node ../../node_modules/typescript/bin/tsc --noEmit`: **오류 0건** (2026-06-16 기준)

## 미완료 / 후속 항목
- 엑셀(.xlsx) 업로드 미리보기(`POST /excel/preview/financial-performance`) 미구현. 1차 범위 외 → 후속 작업.
- 계약 §3 업로드 엔드포인트 연동: 파일 선택 → 미리보기 그리드 prefill → 부서·연도 확인 후 bulk 저장 흐름. 필요 시 KPI 일괄 등록(AdminKpiImportView) 패턴 재사용.
