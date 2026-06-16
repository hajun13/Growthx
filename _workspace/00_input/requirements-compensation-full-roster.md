# 보상 표 — 엑셀(2026 연봉갱신 Index 시트) 전체 컬럼 재현

사용자가 실제 운영 엑셀 `2026년 연봉갱신 전달 1.xlsx`(Index 시트)의 컬럼 전체를 보상 현황 표에 그대로 재현하길 원함.
경력 이력 컬럼까지 전부 + 좌우 스크롤·좌측 고정 레이아웃. 이름/본부·팀은 컴팩트하게.

## 최종 컬럼 순서 (좌→우)
**[좌측 고정(sticky) — 식별]**
1. 이름 / 본부·팀 (컴팩트하게 — 현재 너무 넓음)
2. 직급 (position)
3. 평가등급 (currentGrade)

**[좌우 스크롤 — 엑셀 K~AC 순서]**
4. 입사일 (hireDate) — User.hireDate
5. 근속력(월) — 파생: hireDate→기준일(사이클 연도말 or now)
6. 25.02기준 — User.careerBaseMonths(신규, 적재)
7. 전경력(월) — User.priorCareerMonths(신규, 적재)
8. 총경력(월) — 파생: 근속+전경력
9. 총경력(연월) — 파생: "N년 M개월"
10. 경력직급 — User.careerPosition(신규, 적재)
11. 연차 — User.serviceYears(신규, 적재)
12. 고려대상 열외 — User.considerationExclusion(신규, 적재; 비대상/육아휴직/임원/감리원/대표 등 라벨)
13. 24년도 연봉 — previousSalary
14. 25년도 연봉(이전제외A) — User.currentSalaryExclTransfer(신규, 적재; null이면 currentSalary 폴백)
15. 25년도 연봉(이전포함B) — currentSalary
16. 증감(B-A) — 파생: currentSalary − (currentSalaryExclTransfer ?? currentSalary)
17. 조정분 — CompensationAdjustment.adjustmentAmount (편집)
18. 제안 연봉 — finalProjectedSalary (= 차기년도자동 + 조정분)
19. 인상률(지원금 합산기준) — finalRaiseRate
20. 승격 — CompensationAdjustment.promotionPositionCode (편집)
21. 25년 인센티브 금액(26년 2월 지급) — CompensationAdjustment.incentiveAmount (편집)
22. 비고 — CompensationAdjustment.note (편집)  ← 엑셀 AC, 사용자 목록엔 생략됐으나 유지

## 신규 User 필드 (1:1, org schema)
- priorCareerMonths Int?  (전경력, 월)
- careerBaseMonths   Int?  (25.02기준, 월)
- careerPosition     String? (경력직급)
- serviceYears       Int?  (연차)
- considerationExclusion String? (고려대상 열외 라벨)
- currentSalaryExclTransfer Int? (25년도 이전제외A)

## 시뮬 DTO 파생 필드 (백엔드 산정, 저장 안 함)
- tenureMonths(근속), totalCareerMonths(총경력월), totalCareerLabel(연월), salaryDiffBA(증감)
- 기준일: 사이클 연도말(deterministic) 또는 now — 백엔드 결정. 근속력 = round((기준일−hireDate)/30일, 정수월).

## 데이터 적재
- 신규 스크립트: `2026년 연봉갱신 전달 1.xlsx` Index 시트에서 이름(I열) 매칭으로 6개 신규 필드 + (비파괴)전년/금년 연봉 적재.
- 동명이인(김성호·김광수 등) 다수 → best-effort 이름매칭 + 모호/중복은 검토 큐로 보고(기존 import-org-personal-data.ts 패턴). --dry/--overwrite.
- DB 미기동이라 적재 실행은 사용자 몫(스크립트만 제공·검증).

## 레이아웃
- 좌측 3컬럼(이름/본부·팀·직급·평가등급) sticky-left, 나머지 가로 스크롤. 이름/본부·팀 폭 축소.
- 편집 셀(조정분·승격·인센티브·비고)은 hr_admin만(기존 canEdit 유지). 경력/연봉 컬럼은 표시 전용.
- Kinetic Enterprise 디자인·tabular-nums·sticky 헤더 유지.

## 범위 밖
- monthly-performance/financial WIP 무관.
