-- CreateEnum
CREATE TYPE "Role" AS ENUM ('hr_admin', 'division_head', 'team_lead', 'employee');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('ceo', 'division_head', 'team_lead', 'chief', 'senior', 'pro');

-- CreateEnum
CREATE TYPE "JobLevel" AS ENUM ('division_head', 'team_lead', 'senior_plus', 'senior_minus');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('group', 'division', 'team');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('draft', 'active', 'mid_review', 'calibration', 'closed');

-- CreateEnum
CREATE TYPE "KpiStatus" AS ENUM ('draft', 'submitted', 'approved', 'confirmed');

-- CreateEnum
CREATE TYPE "KpiCategory" AS ENUM ('revenue', 'construction', 'orders', 'collaboration', 'development');

-- CreateEnum
CREATE TYPE "KpiGroup" AS ENUM ('performance_core', 'collaboration_growth');

-- CreateEnum
CREATE TYPE "MeasureType" AS ENUM ('amount', 'rate', 'count', 'qualitative');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('self', 'downward');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('not_started', 'in_progress', 'submitted', 'finalized');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('S', 'A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "GroupTier" AS ENUM ('excellent', 'standard', 'poor');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('submitted', 'under_review', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('strength', 'improvement');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "position" "Position" NOT NULL,
    "job_level" "JobLevel",
    "department_id" TEXT,
    "manager_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DepartmentType" NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'draft',
    "rule_set_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_sets" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "grade_scale" JSONB NOT NULL,
    "grading_scales" JSONB NOT NULL,
    "pool_ratios" JSONB NOT NULL,
    "raise_rates" JSONB NOT NULL,
    "weight_policy" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_templates" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "job_level" "JobLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "category" "KpiCategory" NOT NULL,
    "group" "KpiGroup" NOT NULL,
    "sample_strategy" TEXT,
    "default_measure_type" "MeasureType" NOT NULL,
    "default_weight" INTEGER NOT NULL,
    "is_qualitative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kpi_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "category" "KpiCategory" NOT NULL,
    "group" "KpiGroup" NOT NULL,
    "core_strategy" TEXT,
    "csf" TEXT,
    "title" TEXT NOT NULL,
    "measure_method" TEXT,
    "measure_type" "MeasureType" NOT NULL,
    "target_value" DOUBLE PRECISION,
    "weight" INTEGER NOT NULL,
    "is_qualitative" BOOLEAN NOT NULL DEFAULT false,
    "grading" JSONB,
    "parent_kpi_id" TEXT,
    "status" "KpiStatus" NOT NULL DEFAULT 'draft',
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "actual_value" DOUBLE PRECISION NOT NULL,
    "achievement_rate" DOUBLE PRECISION NOT NULL,
    "evidence_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_performances" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION,
    "orders" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "achievement_rate" DOUBLE PRECISION NOT NULL,
    "tier" "GroupTier" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_pools" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "tier" "GroupTier" NOT NULL,
    "s_ratio" DOUBLE PRECISION NOT NULL,
    "a_ratio" DOUBLE PRECISION NOT NULL,
    "b_ratio" DOUBLE PRECISION NOT NULL,
    "c_ratio" DOUBLE PRECISION NOT NULL,
    "d_ratio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "grade_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "evaluatee_id" TEXT NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "round" INTEGER,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'not_started',
    "total_score" DOUBLE PRECISION,
    "final_grade" "Grade",
    "overall_grade" "Grade",
    "overall_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_scores" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,
    "achievement_rate" DOUBLE PRECISION,
    "grade" "Grade",
    "score" DOUBLE PRECISION NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "kpi_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "final_grade" "Grade",
    "final_score" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "by_type" JSONB,
    "by_group" JSONB,
    "company_avg" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'submitted',
    "response" TEXT,
    "responded_by_id" TEXT,
    "decision" TEXT,
    "decided_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "final_grade" "Grade" NOT NULL,
    "raise_rate" DOUBLE PRECISION NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_schedules" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "notify_offsets" JSONB NOT NULL DEFAULT '[7, 3, 1]',
    "notify_enabled" BOOLEAN NOT NULL DEFAULT true,
    "target_user_ids" JSONB NOT NULL DEFAULT '[]',
    "target_dept_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "user_id" TEXT,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_cycles_rule_set_id_key" ON "evaluation_cycles"("rule_set_id");

-- CreateIndex
CREATE INDEX "kpi_templates_cycle_id_idx" ON "kpi_templates"("cycle_id");

-- CreateIndex
CREATE INDEX "kpi_template_items_template_id_idx" ON "kpi_template_items"("template_id");

-- CreateIndex
CREATE INDEX "kpis_user_id_idx" ON "kpis"("user_id");

-- CreateIndex
CREATE INDEX "kpis_cycle_id_idx" ON "kpis"("cycle_id");

-- CreateIndex
CREATE INDEX "kpis_parent_kpi_id_idx" ON "kpis"("parent_kpi_id");

-- CreateIndex
CREATE INDEX "achievements_kpi_id_idx" ON "achievements"("kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_performances_group_id_cycle_id_key" ON "group_performances"("group_id", "cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_pools_cycle_id_group_id_key" ON "grade_pools"("cycle_id", "group_id");

-- CreateIndex
CREATE INDEX "evaluations_cycle_id_idx" ON "evaluations"("cycle_id");

-- CreateIndex
CREATE INDEX "evaluations_evaluatee_id_idx" ON "evaluations"("evaluatee_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_cycle_id_evaluator_id_evaluatee_id_type_round_key" ON "evaluations"("cycle_id", "evaluator_id", "evaluatee_id", "type", "round");

-- CreateIndex
CREATE INDEX "kpi_scores_evaluation_id_idx" ON "kpi_scores"("evaluation_id");

-- CreateIndex
CREATE INDEX "reviews_kpi_id_idx" ON "reviews"("kpi_id");

-- CreateIndex
CREATE INDEX "comments_evaluation_id_idx" ON "comments"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_results_user_id_cycle_id_key" ON "evaluation_results"("user_id", "cycle_id");

-- CreateIndex
CREATE INDEX "appeals_result_id_idx" ON "appeals"("result_id");

-- CreateIndex
CREATE UNIQUE INDEX "compensations_user_id_cycle_id_simulated_key" ON "compensations"("user_id", "cycle_id", "simulated");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "cycle_schedules_cycle_id_idx" ON "cycle_schedules"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_schedules_cycle_id_phase_key" ON "cycle_schedules"("cycle_id", "phase");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_cycles" ADD CONSTRAINT "evaluation_cycles_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_templates" ADD CONSTRAINT "kpi_templates_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_template_items" ADD CONSTRAINT "kpi_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "kpi_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_parent_kpi_id_fkey" FOREIGN KEY ("parent_kpi_id") REFERENCES "kpis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_performances" ADD CONSTRAINT "group_performances_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_performances" ADD CONSTRAINT "group_performances_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_pools" ADD CONSTRAINT "grade_pools_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_pools" ADD CONSTRAINT "grade_pools_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_scores" ADD CONSTRAINT "kpi_scores_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_scores" ADD CONSTRAINT "kpi_scores_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "evaluation_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_schedules" ADD CONSTRAINT "cycle_schedules_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

