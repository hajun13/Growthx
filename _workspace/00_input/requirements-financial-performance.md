# 요구사항 — 경영실적(월별 손익) 입력: 엑셀 양식 기반

## 배경
사용자가 "실적 입력"을 이 엑셀 양식으로 **확정(픽스)**. 권위 파일:
`2026년 에너지엑스 엔지니어링그룹 감리본부 경영계획 기초DATA (수정) 1 (1).xlsx`
→ 시트 **"2025년 경영실적"**의 **상단 4개 행만** 사용(아래 "사용 범위" 참조).

## 사용자 결정(확정)
1. **기존 화면 교체** — 기존 `/admin/monthly-performance`("월별 실적 입력", 카테고리별 매출/공정액/수주 목표·실적)를 이 엑셀 양식 그리드로 **교체**. 기존 카테고리별 입력 방식은 폐기.
2. **2024년 열 포함** — 엑셀 맨 앞 2024년(전년도 단일 실적값) 열을 참고/비교용으로 포함.
3. **DB 영속화** — KPI 일괄 등록처럼 백엔드에 저장.

## 엑셀 구조(시트 "2025년 경영실적", 권위)
헤더 3행(병합): R3=연도대분류, R4=월, R5=목표/실적.
열 매핑(1-indexed):
- col 2~4: 구분(본부명 / 항목명) — **본부·그룹명은 가변**(예: "감리본부"), 사용자가 부서 선택으로 대체
- col 5: **2024년**(전년도 단일 실적값, 항목별 1개)
- col 6~29: 2025년 1~12월 × (목표, 실적) 쌍 → 6=1월목표 7=1월실적 8=2월목표 9=2월실적 … 28=12월목표 29=12월실적
- col 30: 년계 목표(=Σ 월목표), col 31: 년계 실적(=Σ 월실적)

### 사용 범위 = 상단 4개 행(나머지 판관비/영업이익 등은 미사용)
| 행 | 항목 | 종류 | 수식 |
|----|------|------|------|
| R6 | 매출 | **입력**(목표/실적) | 년계=Σ월 |
| R7 | 원가 | **입력**(목표/실적) | 년계=Σ월 |
| R8 | 매출총이익 | **수식**(저장 안 함) | = 매출 − 원가 (목표·실적·년계 각각) |
| R9 | 매출총이익율 | **수식**(저장 안 함) | = 매출총이익 / 매출 (0이면 표시 '-' 또는 0%) |

**핵심:** 저장 입력값은 **매출 목표/실적 + 원가 목표/실적**(월별)뿐. 매출총이익·매출총이익율·년계는 **수식 그대로 자동계산**(프론트 라이브 + 백엔드 응답에 파생값 포함). "#DIV/0!"(매출 0) 셀은 안전 처리(표시 '-').

## 입력 방식(KPI 일괄 등록과 동일 패턴)
1. **그리드 직접 입력** — 부서·연도 선택 후 매출/원가 행 × 1~12월 목표/실적 셀 입력. 매출총이익/율/년계는 읽기전용 자동계산.
2. **엑셀 복사-붙여넣기** — 엑셀에서 셀 블록 복사 → 그리드에 TSV 붙여넣기(시작 셀 기준 오른쪽·아래 채움, KPI 일괄 등록 `handlePaste` 패턴 재사용).
3. **(선택) .xlsx 업로드** — 이 양식 파일 업로드 → 파서가 "2025년 경영실적" 시트의 4개 행을 추출 → 미리보기 그리드 채움 → 적재. (그리드+복붙이 1차, 업로드는 KPI 일괄 등록처럼 편의 제공)

## 데이터 모델 권고(backend 최종 결정)
**기존 `MonthlyPerformance` 소비처 보존이 핵심.** 대시보드 위젯(`dashboard.service.ts performanceWidgets`)·`monthly-performance summary`가 `targetAmount`/`actualAmount`(=매출) 합으로 그룹 달성률·등급을 산출 중. 이를 깨지 않는 방향:

- **권고: `MonthlyPerformance` 확장** — `costTarget Float?`, `costActual Float?` 컬럼 추가. 새 화면은 (cycleId, departmentId, year, month, category=`revenue`) 단일 행에 매출(targetAmount/actualAmount)+원가(costTarget/costActual)를 함께 upsert. → 대시보드/summary는 targetAmount/actualAmount(매출) 그대로 읽어 **무변경 동작**. 매출총이익/율은 cost 컬럼에서 파생.
- **2024년 참고값**: 전년도 연간 단일값(월 분할 없음). 저장 방식은 backend 재량(예: `month=0`=연간 sentinel + year=2024 행, 또는 별도 경량 컬럼/테이블). `month` validator(Min 1) 조정 필요 시 반영.
- 신규 별도 테이블(`MonthlyFinancials`)을 택할 경우 대시보드·summary·reports를 새 소스(revenueActual/revenueTarget)로 **반드시 repoint**(깨짐 방지).

## 백엔드 산출물
- Prisma 스키마 변경 + 마이그레이션(`compensation` schema, multiSchema FK 규약 준수)
- 일괄 적재 엔드포인트(부서·연도 단위로 12개월 매출/원가 목표·실적 bulk upsert) — KPI 일괄 등록의 commit과 유사한 JSON 바디
- (선택) .xlsx 업로드 미리보기/파싱 — `excel.service.ts`에 "경영실적" 시트 파서 추가(위 열 매핑, 수식 result 풀이 = 기존 `str()/num()/rawCell()` 재사용)
- summary/조회 응답에 매출총이익·매출총이익율·년계 파생값 포함
- 계약을 `_workspace/02_contract/contract-financial-performance.md`에 기록 + `@nestjs/swagger` DTO 갱신
- 파일당 ~200줄 상한·모듈 경계 준수

## 프론트 산출물
- `apps/web/features/admin-monthly-performance` 화면을 엑셀 양식 그리드로 교체:
  - 부서 선택 + 기준연도(현재 사이클) + 2024 참고 열
  - 행: 매출/원가(입력) + 매출총이익/매출총이익율(자동) , 열: 2024 + 1~12월(목표/실적) + 년계
  - 엑셀 복붙(handlePaste 재사용), 저장(bulk), 빈/0 매출시 율 '-' 처리, tabular-nums, sticky 헤더
  - 디자인: Kinetic Enterprise(루트 DESIGN.md), 기존 화면 톤 유지
- nextjs-frontend 스킬 필수 선호출

## QA
- 응답 봉투/필드명(camelCase)·훅 타입 정합, 권한 가드(hr_admin·division_head 입력 / 조회), 대시보드·summary 무회귀, 수식(매출총이익=매출-원가, 율=이익/매출, 년계=Σ월) 정합, DIV/0 안전.
