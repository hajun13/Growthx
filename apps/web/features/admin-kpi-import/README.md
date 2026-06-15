# admin-kpi-import feature

개인별 KPI 엑셀 일괄 등록 화면(HR 전용)의 수직 슬라이스 — notifications 표준 패턴(architecture.md §5).

- **책임:** 회사 표준 KPI 엑셀 양식(1인 1파일) 다중 업로드 → 대상자 매칭 → 미리보기·편집 → draft 적재 → (선택) 제출.
- **소비 API:** `@growthx/contracts` 생성 클라이언트
  - `excelControllerCommitKpi`(JSON) — 편집된 행 draft 적재.
  - `excelControllerSubmitImportedKpi`(JSON) — 적재된 draft 제출(2단계).
  - `getExcelControllerPreviewKpiUrl` — 미리보기 경로 단일화(아래 멀티파트 예외 참조).
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 응답 타입은 생성 DTO 로 고정, 요청 타입은 앱 도메인(`@/lib/types`)을 쓰고 DTO 변환 캐스팅을 한 곳에 격리.
  - `hooks.ts` — `useKpiImport`(preview·commit·submit 커맨드).
  - `ui/AdminKpiImportView.tsx` — 화면(드롭존·진행 스텝·파일 목록·편집 그리드·결과 카드). 상태(파일 목록·편집 행)는 View 보유.
  - 라우트 `app/(main)/admin/kpi-import/page.tsx` 는 `<AdminKpiImportView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 에 마운트(건드리지 않음).

## 멀티파트 미리보기 예외 (중요)
미리보기 엔드포인트(`POST /excel/import/kpi/preview`)는 `FileInterceptor('file')` 멀티파트다.
orval 커스텀 mutator(`customFetch`)가 `Content-Type: application/json` 을 강제하고 생성 함수
(`excelControllerPreviewKpi`)는 파일 인자를 받지 않아, 멀티파트 boundary 가 깨진다. 따라서
미리보기는 admin-cycle 의 YoY 임포트와 동일하게 `@/lib/excel` 의 `uploadExcel`(멀티파트 전용 +
봉투 unwrap)을 쓰되, **경로는 생성 클라이언트의 URL 헬퍼**(`getExcelControllerPreviewKpiUrl`)로
단일화하고 **응답 타입은 생성 DTO**(`KpiImportPreviewDto`)로 고정한다. commit·submit 은 JSON 이라
생성 클라이언트를 그대로 호출한다.

## 불변식
- 인증·baseUrl 은 contracts runtime 에 주입(앱이 단일 소스). 봉투 unwrap 은 api.ts 한 곳.
- RBAC(`isHrAdmin`)·라우트·데이터 의미·시각/동작 보존 — 이번 작업은 데이터 소스만 생성 클라이언트로 이관.
- 등급 색 배지는 이 화면에 없음(등급 S~D 는 정성 기준 텍스트 입력 셀). `lib/grade` 미적용.
