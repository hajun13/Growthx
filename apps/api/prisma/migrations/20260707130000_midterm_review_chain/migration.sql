-- AlterTable: 중간점검 확인 순차 결재(KPI 결재선과 동일 체인) — 완료 단계 수 + 확인 이력.
ALTER TABLE "midterm"."midterm_reviews" ADD COLUMN     "review_stage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "midterm"."midterm_reviews" ADD COLUMN     "review_trail" JSONB;

-- 백필: 기존 confirmed(구 단일 확인 완료) 행은 1차 확인 완료로 간주.
UPDATE "midterm"."midterm_reviews" SET "review_stage" = 1 WHERE "status" = 'confirmed';
