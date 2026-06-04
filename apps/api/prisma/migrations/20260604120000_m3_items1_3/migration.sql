-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('self', 'team', 'division', 'group', 'company');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Position" ADD VALUE 'vice_president';
ALTER TYPE "Position" ADD VALUE 'executive';
ALTER TYPE "Position" ADD VALUE 'director';
ALTER TYPE "Position" ADD VALUE 'principal';

-- AlterTable
ALTER TABLE "cycle_schedules" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "current_salary" DOUBLE PRECISION,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility_scope" "VisibilityScope" NOT NULL DEFAULT 'self';

-- CreateTable
CREATE TABLE "monthly_performances" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "KpiCategory" NOT NULL,
    "target_amount" DOUBLE PRECISION NOT NULL,
    "actual_amount" DOUBLE PRECISION NOT NULL,
    "entered_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_questions" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "hint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_responses" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "comment" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_category_policies" (
    "id" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "allowed" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_category_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_performances_cycle_id_idx" ON "monthly_performances"("cycle_id");

-- CreateIndex
CREATE INDEX "monthly_performances_department_id_idx" ON "monthly_performances"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_performances_cycle_id_department_id_year_month_cate_key" ON "monthly_performances"("cycle_id", "department_id", "year", "month", "category");

-- CreateIndex
CREATE INDEX "competency_questions_cycle_id_idx" ON "competency_questions"("cycle_id");

-- CreateIndex
CREATE INDEX "competency_responses_cycle_id_idx" ON "competency_responses"("cycle_id");

-- CreateIndex
CREATE INDEX "competency_responses_user_id_idx" ON "competency_responses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_responses_question_id_user_id_cycle_id_key" ON "competency_responses"("question_id", "user_id", "cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_category_policies_position_key" ON "kpi_category_policies"("position");

-- AddForeignKey
ALTER TABLE "monthly_performances" ADD CONSTRAINT "monthly_performances_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_performances" ADD CONSTRAINT "monthly_performances_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_performances" ADD CONSTRAINT "monthly_performances_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_questions" ADD CONSTRAINT "competency_questions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_questions" ADD CONSTRAINT "competency_questions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_responses" ADD CONSTRAINT "competency_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "competency_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_responses" ADD CONSTRAINT "competency_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_responses" ADD CONSTRAINT "competency_responses_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

