-- AlterTable: 역량평가 문항에 카테고리/가중치/적용 직급 컬럼 추가 (M3 Item 6 확장)
ALTER TABLE "competency_questions" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '전문성';
ALTER TABLE "competency_questions" ADD COLUMN IF NOT EXISTS "weight" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "competency_questions" ADD COLUMN IF NOT EXISTS "applied_level" TEXT NOT NULL DEFAULT '전 직급';
