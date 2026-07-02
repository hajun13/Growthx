-- CreateEnum
CREATE TYPE "evaluation"."EvaluationReviewKind" AS ENUM ('revision_requested', 'rejected', 'approved');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "evaluation"."EvaluationStatus" ADD VALUE 'revision_requested';
ALTER TYPE "evaluation"."EvaluationStatus" ADD VALUE 'rejected';

-- CreateTable
CREATE TABLE "evaluation"."evaluation_review_history" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "kind" "evaluation"."EvaluationReviewKind" NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_review_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_review_history_evaluation_id_idx" ON "evaluation"."evaluation_review_history"("evaluation_id");

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_review_history" ADD CONSTRAINT "evaluation_review_history_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluation"."evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation"."evaluation_review_history" ADD CONSTRAINT "evaluation_review_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
