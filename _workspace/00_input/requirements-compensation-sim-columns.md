# 보상 시뮬 — 엑셀(2026 연봉갱신) 컬럼 추가

## 배경
사용자가 실제 운영 엑셀 `2026년 연봉갱신 전달 1.xlsx`(Index 시트 T~AC열)을 기준으로,
현재 `보상 현황`(admin-compensation / CompensationView) 표를 그 양식처럼 만들어 달라 요청.

## 유지 (현행 그대로)
- 이름 / 본부 · 팀
- 직급 (position)
- 평가등급 (currentGrade)
- 전년도 연봉(previousSalary) · 금년도 연봉(currentSalary) · 차기년도 연봉(자동 산정) · 인상액(율)

## 추가 컬럼 (입력·저장 가능 — 관리자 수기 입력)
엑셀 T~AC 중 현행에 없는 4개:
1. **조정분** (adjustmentAmount, 원, 음수 허용) — 엑셀 X열. 등급 자동 인상 위에 수기로 가감.
2. **승격** (promotionPositionCode, PositionDef.code 참조) — 엑셀 AA열. 승격 대상자의 변경 직급.
3. **인센티브 금액** (incentiveAmount, 원) — 엑셀 AB열(전년 인센티브, 차년 2월 지급).
4. **비고/Note** (note, 자유 텍스트) — 엑셀 AC열(예외적 증액/감액/추후지급 등 메모).

## 산정 규칙 (엑셀 정합)
- 엑셀: 제안연봉(Y) = 금년도(V) + 조정분(X), 인상률(Z) = Y/V − 1.
- 앱 병합: **차기년도 연봉(자동) = currentSalary × (1 + 등급인상률+그룹보너스)** [현행 projectedSalary 유지]
  + **최종 제안연봉 = projectedSalary + adjustmentAmount**
  + **최종 인상률 = finalProjectedSalary / currentSalary − 1**
- currentSalary 없으면 모두 null.

## 권한
- 보상 = 민감. 조회는 현행 그대로(hr_admin·그룹대표·본부장).
- 조정분/승격/인센티브/비고 **저장은 hr_admin만**(compute 와 동일 가드).

## 동작 방식
- 입력·저장 가능: 새 테이블 `CompensationAdjustment` (userId, cycleId) 유니크에 4개 필드 upsert.
- 시뮬레이션 응답(CompensationSimulationDto)에 4개 필드 + finalProjectedSalary + finalRaiseRate 동봉.
- 출력(print)·엑셀 export 도 새 컬럼 반영.

## 범위 밖 (건드리지 말 것)
- monthly-performance / financial-performance / financial-grid 관련 WIP (git 미커밋 변경) — 무관.
