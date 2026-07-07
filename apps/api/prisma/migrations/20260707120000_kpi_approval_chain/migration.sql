-- AlterTable: KPI 순차 결재선 — 완료된 결재 단계 수 + 결재 이력.
-- 체인 = resolveDownwardEvaluators(1차 팀장 → 2차 본부장 → 최종 그룹대표, 부그룹장 압축 포함).
ALTER TABLE "kpi"."kpis" ADD COLUMN     "approval_stage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "kpi"."kpis" ADD COLUMN     "approval_trail" JSONB;

-- 백필: 기존 approved(구 단일 승인 완료) 행은 1차 승인 완료로 간주 — 다음 단계(2차) 대기로 편입.
UPDATE "kpi"."kpis" SET "approval_stage" = 1 WHERE "status" = 'approved';
