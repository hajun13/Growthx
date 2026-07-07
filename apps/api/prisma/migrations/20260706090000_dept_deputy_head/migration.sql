-- AlterTable: 그룹 부(副)장(부대표) 지정 — 다단계 하향평가의 중간 단계(팀장 2차·본부장 1차).
ALTER TABLE "org"."departments" ADD COLUMN     "deputy_head_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "org"."departments" ADD CONSTRAINT "departments_deputy_head_user_id_fkey" FOREIGN KEY ("deputy_head_user_id") REFERENCES "org"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
