-- 경영실적(월별 손익) 입력 — MonthlyPerformance 에 원가(cost) 목표/실적 컬럼 추가.
-- 매출(target_amount/actual_amount)은 기존 그대로 대시보드/summary 매출 소스로 유지.
-- 매출총이익 = 매출 − 원가, 매출총이익율 = 이익/매출 은 응답에서 파생(저장 안 함).
-- 전년도(2024) 참고값은 month=0 sentinel 행으로 저장(집계 시 month>=1 필터로 제외).
ALTER TABLE "compensation"."monthly_performances" ADD COLUMN "cost_target" DOUBLE PRECISION;
ALTER TABLE "compensation"."monthly_performances" ADD COLUMN "cost_actual" DOUBLE PRECISION;
