-- 중간점검 진행 이력에 KPI별 검토 판정 스냅샷 추가(2026-07-24).
-- 지금까지 'commented'(1차 코멘트) 이력은 총평(comment)만 남아서, 검토자가 KPI별로
-- 무슨 판정(수락/조정필요)·코멘트를 했는지가 이력에 보존되지 않았다.
-- 기존 행은 손대지 않는다(nullable 단일 컬럼 추가 — 기본값 NULL = 판정 스냅샷 없음).

ALTER TABLE "midterm"."midterm_trails"
  ADD COLUMN "kpi_reviews" JSONB;

COMMENT ON COLUMN "midterm"."midterm_trails"."kpi_reviews" IS
  '1차 코멘트 시점의 KPI별 판정 스냅샷 [{ kpiId, kpiTitle, decision: ''accepted''|''rebaseline''|null, note: string|null }]. kpi_changes(수정 전/후 값)와 별개로 "어떤 검토를 했는지"를 이력에 보존한다.';
