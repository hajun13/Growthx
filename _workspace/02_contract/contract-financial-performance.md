# API 계약 — 경영실적(월별 손익) 입력

기존 `monthly-performance` 모듈 확장. 응답은 전부 봉투(`{data}` / `{data,meta}` / `{error}`), 필드 camelCase.
기준연도(year)는 현재 사이클 연도(예: 2025), 전년(prevYear)은 year-1(2024) 참고값.

저장 진실값 = **매출(revenue) + 원가(cost)** 의 목표/실적뿐.
파생값(매출총이익·매출총이익율·년계)은 백엔드가 계산해 응답에 포함(저장 안 함).

---

## 데이터 모델

`MonthlyPerformance` 확장(별도 테이블 없음 — 기존 대시보드/summary 소비처 보존):
- 기존 `targetAmount` / `actualAmount` = **매출** 목표/실적 (대시보드·summary 매출 소스, 무변경).
- 신규 `costTarget Float?` / `costActual Float?` = **원가** 목표/실적.
- 경영실적 그리드는 항상 `category = revenue` 단일 행에 매출+원가를 함께 저장.
- **전년(2024) 참고값** = `month = 0`, `year = year-1` **sentinel 행**(연간 단일, 월 분할 없음).
  - 집계 회귀 방지: 대시보드/summary/midterm/monthly-summary 의 모든 합산 쿼리에 `month >= 1` 필터 추가 → sentinel 제외.

---

## 1) 일괄 적재 — `POST /api/v1/monthly-performance/bulk`

부서·연도 단위로 12개월 매출/원가 목표·실적 + 전년 참고를 한 번에 bulk upsert(트랜잭션).

- **권한:** `hr_admin`(전체) / `division_head`(본인 본부 하위 트리만 — service `assertWriteAccess`).
- **요청 body:**
```json
{
  "cycleId": "uuid",
  "departmentId": "uuid",
  "year": 2025,
  "prevYear": {                  // optional — 2024 참고값
    "revenueActual": 1200000,
    "costActual": 900000,
    "revenueTarget": null,       // optional (보통 실적만)
    "costTarget": null
  },
  "months": [                    // 입력된 월만(1~12). 미입력 셀은 생략 또는 null
    { "month": 1, "revenueTarget": 100000, "revenueActual": 95000, "costTarget": 70000, "costActual": 68000 },
    { "month": 2, "revenueTarget": 110000, "revenueActual": 0, "costTarget": null, "costActual": null }
  ]
}
```
  - 셀 미입력(null) → 매출은 0 으로, 원가는 null 로 저장(원가 미입력과 0 구분).
  - upsert 키 = `(cycleId, departmentId, year, month, category=revenue)`.
- **응답 `data`:**
```json
{ "ok": true, "cycleId": "...", "departmentId": "...", "year": 2025, "upsertedMonths": 12, "prevYearSaved": true }
```
- **audit:** `monthly_performance.upsert` (entityId = `<departmentId>:<year>`).
- **에러:** 401 미인증 / 403 `FORBIDDEN`(부서 범위 밖) / 400 `VALIDATION_ERROR`(month 1~12 외, year 범위 외).

---

## 2) 그리드 조회 — `GET /api/v1/monthly-performance/financial-grid`

4행(매출·원가·매출총이익·매출총이익율) × (2024 + 1~12월[목표/실적] + 년계) 표 구성용. 파생값 포함.

- **권한:** 조회 — `assertReadAccess`(hr_admin/company 전체, 그 외 본인 가시 부서만).
- **쿼리:** `?cycleId=uuid&departmentId=uuid&year=2025`
- **응답 `data`:**
```json
{
  "cycleId": "...", "departmentId": "...", "departmentName": "감리본부",
  "year": 2025, "prevYear": 2024,
  "columns": [
    {
      "key": "prevYear", "label": "2024년", "isPrevYear": true, "isYearTotal": false,
      "revenue": { "target": null, "actual": 1200000 },
      "cost":    { "target": null, "actual": 900000 },
      "grossProfit": { "target": null, "actual": 300000 },
      "grossProfitMarginTarget": null,
      "grossProfitMarginActual": 25.0
    },
    { "key": "1", "label": "1월", "isPrevYear": false, "isYearTotal": false,
      "revenue": { "target": 100000, "actual": 95000 },
      "cost":    { "target": 70000, "actual": 68000 },
      "grossProfit": { "target": 30000, "actual": 27000 },
      "grossProfitMarginTarget": 30.0, "grossProfitMarginActual": 28.4 },
    /* … 2~12월 … */
    { "key": "yearTotal", "label": "년계", "isPrevYear": false, "isYearTotal": true,
      "revenue": { "target": 1200000, "actual": 1140000 },
      "cost":    { "target": 840000, "actual": 816000 },
      "grossProfit": { "target": 360000, "actual": 324000 },
      "grossProfitMarginTarget": 30.0, "grossProfitMarginActual": 28.4 }
  ]
}
```
  - `columns` 순서 = `[prevYear, 1, 2, …, 12, yearTotal]` (고정 15개).

### 파생 계산식(프론트는 그대로 표시만, 백엔드가 계산)
- **매출총이익** `grossProfit = 매출 − 원가` (목표/실적 각각). 둘 다 null 이면 null, 한쪽 null 은 0 취급.
- **매출총이익율(%)** `= grossProfit / 매출 × 100`, 소수1자리. **매출이 0 또는 null 이면 `null`** → 프론트는 `'-'` 표시(DIV/0 안전).
- **년계** `yearTotal = Σ(1~12월)` (목표/실적 각각). 값이 하나라도 있으면 합산, 전부 없으면 null. 전년은 합산 제외.

---

## 3) (선택) 엑셀 업로드 미리보기 — `POST /api/v1/excel/preview/financial-performance`

`.xlsx`(multipart, field `file`) 업로드 → "…경영실적" 시트 파싱 → 미리보기. **적재 안 함**(부서 선택 후 bulk 로 저장하는 2단계).

- **권한:** `hr_admin` / `division_head`.
- **열 매핑(1-indexed):** col5=2024 전년실적, col6~29=1~12월×(목표,실적)[6=1월목표 7=1월실적 …], col30/31=년계(무시 — 백엔드 Σ 재계산). 사용 행 R6=매출, R7=원가. 본부명/항목명(col2~4) 무시 — 부서는 화면에서 선택.
- **응답 `data`:**
```json
{
  "ok": true, "fileName": "...xlsx", "sheetName": "2025년 경영실적",
  "prevYear": { "revenueActual": 1200000, "costActual": 900000 },
  "months": [ { "month": 1, "revenueTarget": 100000, "revenueActual": 95000, "costTarget": 70000, "costActual": 68000 }, … ],
  "warnings": []
}
```
  - `months` + `prevYear` 는 그대로 **bulk 바디**로 변환 가능(`cycleId/departmentId/year` 만 추가).

---

## 프론트 연동 키 요약
- 저장: `POST /monthly-performance/bulk` ← 그리드 입력값(복붙 포함) + 전년.
- 조회: `GET /monthly-performance/financial-grid?cycleId&departmentId&year` → `columns[15]` 그대로 표 렌더.
- 매출총이익율 `null` → `'-'` 렌더(0% 아님). 수치는 `tabular-nums`.
- 업로드: `POST /excel/preview/financial-performance` → `months`/`prevYear` 받아 그리드 prefill → 부서·연도 확인 후 bulk 저장.
- 기존 `GET /monthly-performance` (list) 응답에 `costTarget`/`costActual` 추가됨(둘 다 nullable).
