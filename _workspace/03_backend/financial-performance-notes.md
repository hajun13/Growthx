# 경영실적(월별 손익) 입력 — 백엔드 진행 노트

## 스키마 결정
- **별도 테이블 대신 `MonthlyPerformance` 확장** 채택(권고대로). 기존 소비처(대시보드 performanceWidgets·summary·midterm) 보존이 핵심.
- 신규 컬럼: `costTarget Float?` `costActual Float?` (`@map cost_target/cost_actual`, `compensation` schema).
- 매출은 기존 `targetAmount`/`actualAmount` 그대로 = 대시보드/summary 매출 소스 무변경.
- **전년(2024) 참고값** = `month=0` + `year=year-1` sentinel 행(category=revenue). 연간 단일, 월 분할 없음.
- 마이그레이션: `prisma/migrations/20260616120000_monthly_performance_cost/migration.sql` (ALTER ADD COLUMN ×2, schema-qualified). `prisma generate` 완료.

## 회귀 방지 (month>=1 필터) — 필수
month=0 sentinel 이 합산에 새지 않도록 **4개 소비처 모두** `month >= 1` 필터 추가:
1. `dashboard.service.ts` performanceWidgets — `findMany({ where:{ cycleId, month:{gte:1} } })`
2. `monthly-performance.service.ts` summary — where 에 `month:{gte:1}`
3. `midterm-progress.service.ts` — where 에 `month:{gte:1}`
4. monthly-performance `list` — 그대로 둠(명시적 쿼리, DTO 가 month=0·cost 노출). 단, list 는 집계 아님.
- create DTO `month` validator 는 `Min(1)` 유지(레거시 단건 입력은 1~12만). sentinel 은 bulk 의 `prevYear` 전용 경로로만 생성.

## 엔드포인트
| 메서드 | 경로 | 권한 | 비고 |
|--------|------|------|------|
| POST | `/monthly-performance/bulk` | hr_admin / division_head(본인본부) | 12개월 매출/원가 + prevYear bulk upsert(트랜잭션) + audit |
| GET | `/monthly-performance/financial-grid?cycleId&departmentId&year` | assertReadAccess | 4행×15열 그리드 + 파생값 |
| POST | `/excel/preview/financial-performance` | hr_admin / division_head | .xlsx "경영실적" 시트 파싱 미리보기(적재 안 함) |
- 권한: bulk 는 service `assertWriteAccess`(기존 재사용, public 으로 전환), grid 는 `assertReadAccess`.
- excel 컨트롤러는 class-level `@Roles(hr_admin)` → preview 메서드에 `@Roles(hr_admin, division_head)` 로 핸들러 오버라이드(getAllAndOverride [handler, class] 순).

## 파생식 (financial-grid.builder.ts, 순수 함수)
- 매출총이익 = 매출 − 원가 (목표/실적 각각). 둘 다 null → null, 한쪽 null → 0 취급.
- 매출총이익율(%) = 이익/매출×100, 소수1자리. **매출 0/null → null('-' 표시), DIV/0 안전.**
- 년계 = Σ(1~12월), 값 있으면 합산·전부없으면 null. 전년 합산 제외.

## 파일 (200줄 상한 준수)
- `financial-performance.service.ts` — bulk + grid 조회(약 170줄).
- `financial-grid.builder.ts` — 파생 계산 순수 함수(약 150줄).
- `dto/financial-performance.dto.ts` — 입력 DTO(class-validator).
- `dto/financial-grid-response.dto.ts` — OpenAPI 응답 DTO(@ApiProperty).
- excel 파서는 기존 excel.service.ts 에 `previewFinancialPerformance` 메서드 추가(rawCell/num 재사용).

## 프론트 연동 키
- 저장 `POST /monthly-performance/bulk` { cycleId, departmentId, year, prevYear?, months[] }.
- 조회 `GET /monthly-performance/financial-grid` → `columns[15]` (prevYear, 1~12, yearTotal) 그대로 렌더.
- 율 null → '-' (0% 아님). 업로드 preview → months/prevYear prefill → bulk.
- list 응답에 costTarget/costActual(nullable) 추가.

## 검증
- `npx tsc --noEmit` (root typescript) **0 에러**.
- 회귀: 대시보드/summary/midterm 은 매출(targetAmount/actualAmount)·month>=1 만 읽어 동작 불변.

## 후속/미완료
- 업로드 **적재(commit)** 는 미구현 — preview 만. 프론트가 preview 결과를 bulk 바디로 변환해 저장(2단계)하면 충분(부서 선택 필요). 필요 시 `POST /excel/import/financial-performance?departmentId&cycleId&year` commit 엔드포인트 추가 가능.
- 단위 테스트(financial-grid.builder DIV/0·년계 null) 권장 — 미작성.
- seed 변경 없음(기존 2025/2024 사이클 그대로). 전년 데이터는 화면/업로드로 적재.
