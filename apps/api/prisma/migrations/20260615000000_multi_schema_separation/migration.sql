-- Multi-schema separation (bounded-context physical schemas).
-- domain-model.md §4-1 매핑. 데이터 보존 전용 — DROP/CREATE TABLE·DROP TYPE 없음.
-- 기존 객체는 전부 "public" 에 있으며, 여기서 각 컨텍스트 schema 로 SET SCHEMA 이동만 한다.
-- 교차 schema 외래키/relation 은 그대로 유지된다(Postgres 가 교차 schema FK 지원).

-- ── 1) 대상 schema 생성 ───────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS "org";
CREATE SCHEMA IF NOT EXISTS "cycle";
CREATE SCHEMA IF NOT EXISTS "kpi";
CREATE SCHEMA IF NOT EXISTS "evaluation";
CREATE SCHEMA IF NOT EXISTS "calibration";
CREATE SCHEMA IF NOT EXISTS "result";
CREATE SCHEMA IF NOT EXISTS "compensation";
CREATE SCHEMA IF NOT EXISTS "notification";
CREATE SCHEMA IF NOT EXISTS "audit";
CREATE SCHEMA IF NOT EXISTS "competency";
CREATE SCHEMA IF NOT EXISTS "midterm";

-- ── 2) enum 타입 이동 (ALTER TYPE ... SET SCHEMA) ─────────────────────
-- org
ALTER TYPE "public"."Role" SET SCHEMA "org";
ALTER TYPE "public"."VisibilityScope" SET SCHEMA "org";
ALTER TYPE "public"."JobLevel" SET SCHEMA "org";
ALTER TYPE "public"."LegalEntity" SET SCHEMA "org";
ALTER TYPE "public"."EmploymentStatus" SET SCHEMA "org";
ALTER TYPE "public"."DepartmentType" SET SCHEMA "org";
-- cycle
ALTER TYPE "public"."CycleStatus" SET SCHEMA "cycle";
ALTER TYPE "public"."CycleType" SET SCHEMA "cycle";
-- kpi
ALTER TYPE "public"."KpiStatus" SET SCHEMA "kpi";
ALTER TYPE "public"."KpiCategory" SET SCHEMA "kpi";
ALTER TYPE "public"."KpiGroup" SET SCHEMA "kpi";
ALTER TYPE "public"."MeasureType" SET SCHEMA "kpi";
ALTER TYPE "public"."ReviewKind" SET SCHEMA "kpi";
-- evaluation
ALTER TYPE "public"."EvaluationType" SET SCHEMA "evaluation";
ALTER TYPE "public"."EvaluationStatus" SET SCHEMA "evaluation";
ALTER TYPE "public"."Grade" SET SCHEMA "evaluation";
-- calibration
ALTER TYPE "public"."GroupTier" SET SCHEMA "calibration";
-- result
ALTER TYPE "public"."AppealStatus" SET SCHEMA "result";
-- midterm
ALTER TYPE "public"."MidtermReviewStatus" SET SCHEMA "midterm";
ALTER TYPE "public"."ActionItemStatus" SET SCHEMA "midterm";
ALTER TYPE "public"."ActionItemSource" SET SCHEMA "midterm";
ALTER TYPE "public"."RebaselineRequestStatus" SET SCHEMA "midterm";

-- ── 3) 테이블 이동 (ALTER TABLE ... SET SCHEMA) ───────────────────────
-- 테이블명은 schema.prisma 의 @@map 값. FK/인덱스/제약은 테이블과 함께 자동 이동.
-- org
ALTER TABLE "public"."users" SET SCHEMA "org";
ALTER TABLE "public"."departments" SET SCHEMA "org";
ALTER TABLE "public"."position_defs" SET SCHEMA "org";
ALTER TABLE "public"."permission_config" SET SCHEMA "org";
-- cycle
ALTER TABLE "public"."evaluation_cycles" SET SCHEMA "cycle";
ALTER TABLE "public"."rule_sets" SET SCHEMA "cycle";
ALTER TABLE "public"."kpi_templates" SET SCHEMA "cycle";
ALTER TABLE "public"."kpi_template_items" SET SCHEMA "cycle";
ALTER TABLE "public"."cycle_schedules" SET SCHEMA "cycle";
ALTER TABLE "public"."kpi_category_policies" SET SCHEMA "cycle";
-- kpi
ALTER TABLE "public"."kpis" SET SCHEMA "kpi";
ALTER TABLE "public"."achievements" SET SCHEMA "kpi";
ALTER TABLE "public"."reviews" SET SCHEMA "kpi";
ALTER TABLE "public"."kpi_snapshots" SET SCHEMA "kpi";
-- evaluation
ALTER TABLE "public"."evaluations" SET SCHEMA "evaluation";
ALTER TABLE "public"."evaluation_evidence" SET SCHEMA "evaluation";
ALTER TABLE "public"."kpi_scores" SET SCHEMA "evaluation";
ALTER TABLE "public"."comments" SET SCHEMA "evaluation";
-- calibration
ALTER TABLE "public"."group_performances" SET SCHEMA "calibration";
ALTER TABLE "public"."grade_pools" SET SCHEMA "calibration";
-- result
ALTER TABLE "public"."evaluation_results" SET SCHEMA "result";
ALTER TABLE "public"."appeals" SET SCHEMA "result";
-- compensation
ALTER TABLE "public"."compensations" SET SCHEMA "compensation";
ALTER TABLE "public"."monthly_performances" SET SCHEMA "compensation";
-- notification
ALTER TABLE "public"."notifications" SET SCHEMA "notification";
ALTER TABLE "public"."reminder_dispatches" SET SCHEMA "notification";
-- audit
ALTER TABLE "public"."audit_logs" SET SCHEMA "audit";
-- competency
ALTER TABLE "public"."competency_questions" SET SCHEMA "competency";
ALTER TABLE "public"."competency_responses" SET SCHEMA "competency";
-- midterm
ALTER TABLE "public"."midterm_reviews" SET SCHEMA "midterm";
ALTER TABLE "public"."midterm_kpi_check_ins" SET SCHEMA "midterm";
ALTER TABLE "public"."action_items" SET SCHEMA "midterm";
ALTER TABLE "public"."rebaseline_requests" SET SCHEMA "midterm";
