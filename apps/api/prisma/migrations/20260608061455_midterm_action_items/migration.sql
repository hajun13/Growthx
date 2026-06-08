-- CreateEnum
CREATE TYPE "MidtermReviewStatus" AS ENUM ('pending', 'self_done', 'confirmed');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('planned', 'in_progress', 'done', 'canceled');

-- CreateEnum
CREATE TYPE "ActionItemSource" AS ENUM ('midterm_review');

-- CreateTable
CREATE TABLE "midterm_reviews" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "evaluatee_id" TEXT NOT NULL,
    "status" "MidtermReviewStatus" NOT NULL DEFAULT 'pending',
    "self_note" TEXT,
    "self_submitted_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "reviewer_note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "midterm_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "evaluatee_id" TEXT NOT NULL,
    "kpi_id" TEXT,
    "source" "ActionItemSource" NOT NULL DEFAULT 'midterm_review',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "assignee_id" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'planned',
    "created_by_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completion_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "midterm_reviews_cycle_id_idx" ON "midterm_reviews"("cycle_id");

-- CreateIndex
CREATE INDEX "midterm_reviews_evaluatee_id_idx" ON "midterm_reviews"("evaluatee_id");

-- CreateIndex
CREATE UNIQUE INDEX "midterm_reviews_cycle_id_evaluatee_id_key" ON "midterm_reviews"("cycle_id", "evaluatee_id");

-- CreateIndex
CREATE INDEX "action_items_cycle_id_idx" ON "action_items"("cycle_id");

-- CreateIndex
CREATE INDEX "action_items_evaluatee_id_idx" ON "action_items"("evaluatee_id");

-- CreateIndex
CREATE INDEX "action_items_cycle_id_evaluatee_id_idx" ON "action_items"("cycle_id", "evaluatee_id");

-- CreateIndex
CREATE INDEX "action_items_assignee_id_idx" ON "action_items"("assignee_id");

-- CreateIndex
CREATE INDEX "action_items_kpi_id_idx" ON "action_items"("kpi_id");

-- AddForeignKey
ALTER TABLE "midterm_reviews" ADD CONSTRAINT "midterm_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midterm_reviews" ADD CONSTRAINT "midterm_reviews_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midterm_reviews" ADD CONSTRAINT "midterm_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
