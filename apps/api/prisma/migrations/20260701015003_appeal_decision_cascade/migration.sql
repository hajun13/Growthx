-- CreateEnum
CREATE TYPE "result"."AppealDecisionType" AS ENUM ('uphold', 'score_adjust', 'grade_adjust', 'reevaluate', 'reject');

-- AlterTable
ALTER TABLE "result"."appeals" ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decision_type" "result"."AppealDecisionType",
ADD COLUMN     "new_grade" "evaluation"."Grade",
ADD COLUMN     "new_score" DOUBLE PRECISION,
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "review_started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "result"."appeal_attachments" (
    "id" TEXT NOT NULL,
    "appeal_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appeal_attachments_appeal_id_idx" ON "result"."appeal_attachments"("appeal_id");

-- AddForeignKey
ALTER TABLE "result"."appeal_attachments" ADD CONSTRAINT "appeal_attachments_appeal_id_fkey" FOREIGN KEY ("appeal_id") REFERENCES "result"."appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
