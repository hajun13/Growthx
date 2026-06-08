-- CreateEnum
CREATE TYPE "RebaselineRequestStatus" AS ENUM ('submitted', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "rebaseline_requests" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "evaluatee_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "status" "RebaselineRequestStatus" NOT NULL DEFAULT 'submitted',
    "reviewer_id" TEXT,
    "review_comment" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "applied_snapshot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebaseline_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rebaseline_requests_cycle_id_idx" ON "rebaseline_requests"("cycle_id");

-- CreateIndex
CREATE INDEX "rebaseline_requests_evaluatee_id_idx" ON "rebaseline_requests"("evaluatee_id");

-- CreateIndex
CREATE INDEX "rebaseline_requests_cycle_id_evaluatee_id_idx" ON "rebaseline_requests"("cycle_id", "evaluatee_id");

-- CreateIndex
CREATE INDEX "rebaseline_requests_reviewer_id_idx" ON "rebaseline_requests"("reviewer_id");

-- CreateIndex
CREATE INDEX "rebaseline_requests_status_idx" ON "rebaseline_requests"("status");

-- AddForeignKey
ALTER TABLE "rebaseline_requests" ADD CONSTRAINT "rebaseline_requests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebaseline_requests" ADD CONSTRAINT "rebaseline_requests_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebaseline_requests" ADD CONSTRAINT "rebaseline_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
