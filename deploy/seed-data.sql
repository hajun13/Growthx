--
-- PostgreSQL database dump
--

\restrict U6eIpiuILX3lbcLr5C3T5MZ3hzdmF23ZtTffeeHk5uUTa9ra1Dnm1GCTNHDgll1

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_manager_id_fkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_kpi_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_author_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reminder_dispatches DROP CONSTRAINT IF EXISTS reminder_dispatches_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rebaseline_requests DROP CONSTRAINT IF EXISTS rebaseline_requests_reviewer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rebaseline_requests DROP CONSTRAINT IF EXISTS rebaseline_requests_evaluatee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rebaseline_requests DROP CONSTRAINT IF EXISTS rebaseline_requests_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.monthly_performances DROP CONSTRAINT IF EXISTS monthly_performances_entered_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.monthly_performances DROP CONSTRAINT IF EXISTS monthly_performances_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.monthly_performances DROP CONSTRAINT IF EXISTS monthly_performances_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.midterm_reviews DROP CONSTRAINT IF EXISTS midterm_reviews_reviewer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.midterm_reviews DROP CONSTRAINT IF EXISTS midterm_reviews_evaluatee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.midterm_reviews DROP CONSTRAINT IF EXISTS midterm_reviews_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpis DROP CONSTRAINT IF EXISTS kpis_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpis DROP CONSTRAINT IF EXISTS kpis_parent_kpi_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpis DROP CONSTRAINT IF EXISTS kpis_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_templates DROP CONSTRAINT IF EXISTS kpi_templates_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_template_items DROP CONSTRAINT IF EXISTS kpi_template_items_template_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_snapshots DROP CONSTRAINT IF EXISTS kpi_snapshots_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_snapshots DROP CONSTRAINT IF EXISTS kpi_snapshots_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_scores DROP CONSTRAINT IF EXISTS kpi_scores_kpi_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_scores DROP CONSTRAINT IF EXISTS kpi_scores_evaluation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.group_performances DROP CONSTRAINT IF EXISTS group_performances_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.group_performances DROP CONSTRAINT IF EXISTS group_performances_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grade_pools DROP CONSTRAINT IF EXISTS grade_pools_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grade_pools DROP CONSTRAINT IF EXISTS grade_pools_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_evaluator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_evaluatee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_results DROP CONSTRAINT IF EXISTS evaluation_results_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_results DROP CONSTRAINT IF EXISTS evaluation_results_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_evidence DROP CONSTRAINT IF EXISTS evaluation_evidence_kpi_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_evidence DROP CONSTRAINT IF EXISTS evaluation_evidence_evaluation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_cycles DROP CONSTRAINT IF EXISTS evaluation_cycles_rule_set_id_fkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_head_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cycle_schedules DROP CONSTRAINT IF EXISTS cycle_schedules_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.competency_responses DROP CONSTRAINT IF EXISTS competency_responses_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.competency_responses DROP CONSTRAINT IF EXISTS competency_responses_question_id_fkey;
ALTER TABLE IF EXISTS ONLY public.competency_responses DROP CONSTRAINT IF EXISTS competency_responses_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.competency_questions DROP CONSTRAINT IF EXISTS competency_questions_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.competency_questions DROP CONSTRAINT IF EXISTS competency_questions_created_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compensations DROP CONSTRAINT IF EXISTS compensations_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compensations DROP CONSTRAINT IF EXISTS compensations_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comments DROP CONSTRAINT IF EXISTS comments_evaluation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_result_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_responded_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_decided_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_kpi_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_evaluatee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_created_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_assignee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.achievements DROP CONSTRAINT IF EXISTS achievements_kpi_id_fkey;
DROP INDEX IF EXISTS public.users_manager_id_idx;
DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public.users_department_id_idx;
DROP INDEX IF EXISTS public.reviews_kpi_id_idx;
DROP INDEX IF EXISTS public.reminder_dispatches_cycle_id_phase_offset_key;
DROP INDEX IF EXISTS public.reminder_dispatches_cycle_id_idx;
DROP INDEX IF EXISTS public.rebaseline_requests_status_idx;
DROP INDEX IF EXISTS public.rebaseline_requests_reviewer_id_idx;
DROP INDEX IF EXISTS public.rebaseline_requests_evaluatee_id_idx;
DROP INDEX IF EXISTS public.rebaseline_requests_cycle_id_idx;
DROP INDEX IF EXISTS public.rebaseline_requests_cycle_id_evaluatee_id_idx;
DROP INDEX IF EXISTS public.position_defs_code_key;
DROP INDEX IF EXISTS public.notifications_user_id_idx;
DROP INDEX IF EXISTS public.monthly_performances_department_id_idx;
DROP INDEX IF EXISTS public.monthly_performances_cycle_id_idx;
DROP INDEX IF EXISTS public.monthly_performances_cycle_id_department_id_year_month_cate_key;
DROP INDEX IF EXISTS public.midterm_reviews_evaluatee_id_idx;
DROP INDEX IF EXISTS public.midterm_reviews_cycle_id_idx;
DROP INDEX IF EXISTS public.midterm_reviews_cycle_id_evaluatee_id_key;
DROP INDEX IF EXISTS public.kpis_user_id_idx;
DROP INDEX IF EXISTS public.kpis_parent_kpi_id_idx;
DROP INDEX IF EXISTS public.kpis_cycle_id_idx;
DROP INDEX IF EXISTS public.kpi_templates_cycle_id_idx;
DROP INDEX IF EXISTS public.kpi_template_items_template_id_idx;
DROP INDEX IF EXISTS public.kpi_snapshots_cycle_id_user_id_idx;
DROP INDEX IF EXISTS public.kpi_scores_evaluation_id_idx;
DROP INDEX IF EXISTS public.kpi_category_policies_position_key;
DROP INDEX IF EXISTS public.group_performances_group_id_cycle_id_key;
DROP INDEX IF EXISTS public.grade_pools_cycle_id_group_id_key;
DROP INDEX IF EXISTS public.evaluations_evaluatee_id_idx;
DROP INDEX IF EXISTS public.evaluations_cycle_id_idx;
DROP INDEX IF EXISTS public.evaluations_cycle_id_evaluator_id_evaluatee_id_type_round_key;
DROP INDEX IF EXISTS public.evaluation_results_user_id_cycle_id_key;
DROP INDEX IF EXISTS public.evaluation_results_team_id_snapshot_idx;
DROP INDEX IF EXISTS public.evaluation_results_group_id_snapshot_idx;
DROP INDEX IF EXISTS public.evaluation_results_division_id_snapshot_idx;
DROP INDEX IF EXISTS public.evaluation_evidence_evaluation_id_kpi_id_idx;
DROP INDEX IF EXISTS public.evaluation_evidence_evaluation_id_idx;
DROP INDEX IF EXISTS public.evaluation_cycles_rule_set_id_key;
DROP INDEX IF EXISTS public.departments_parent_id_idx;
DROP INDEX IF EXISTS public.cycle_schedules_cycle_id_phase_key;
DROP INDEX IF EXISTS public.cycle_schedules_cycle_id_idx;
DROP INDEX IF EXISTS public.competency_responses_user_id_idx;
DROP INDEX IF EXISTS public.competency_responses_question_id_user_id_cycle_id_key;
DROP INDEX IF EXISTS public.competency_responses_cycle_id_idx;
DROP INDEX IF EXISTS public.competency_questions_cycle_id_idx;
DROP INDEX IF EXISTS public.compensations_user_id_cycle_id_simulated_key;
DROP INDEX IF EXISTS public.comments_evaluation_id_idx;
DROP INDEX IF EXISTS public.audit_logs_user_id_idx;
DROP INDEX IF EXISTS public.audit_logs_entity_entity_id_idx;
DROP INDEX IF EXISTS public.audit_logs_at_idx;
DROP INDEX IF EXISTS public.audit_logs_action_idx;
DROP INDEX IF EXISTS public.appeals_result_id_idx;
DROP INDEX IF EXISTS public.action_items_kpi_id_idx;
DROP INDEX IF EXISTS public.action_items_evaluatee_id_idx;
DROP INDEX IF EXISTS public.action_items_cycle_id_idx;
DROP INDEX IF EXISTS public.action_items_cycle_id_evaluatee_id_idx;
DROP INDEX IF EXISTS public.action_items_assignee_id_idx;
DROP INDEX IF EXISTS public.achievements_kpi_id_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.rule_sets DROP CONSTRAINT IF EXISTS rule_sets_pkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.reminder_dispatches DROP CONSTRAINT IF EXISTS reminder_dispatches_pkey;
ALTER TABLE IF EXISTS ONLY public.rebaseline_requests DROP CONSTRAINT IF EXISTS rebaseline_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.position_defs DROP CONSTRAINT IF EXISTS position_defs_pkey;
ALTER TABLE IF EXISTS ONLY public.permission_config DROP CONSTRAINT IF EXISTS permission_config_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.monthly_performances DROP CONSTRAINT IF EXISTS monthly_performances_pkey;
ALTER TABLE IF EXISTS ONLY public.midterm_reviews DROP CONSTRAINT IF EXISTS midterm_reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.kpis DROP CONSTRAINT IF EXISTS kpis_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_templates DROP CONSTRAINT IF EXISTS kpi_templates_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_template_items DROP CONSTRAINT IF EXISTS kpi_template_items_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_snapshots DROP CONSTRAINT IF EXISTS kpi_snapshots_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_scores DROP CONSTRAINT IF EXISTS kpi_scores_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_category_policies DROP CONSTRAINT IF EXISTS kpi_category_policies_pkey;
ALTER TABLE IF EXISTS ONLY public.group_performances DROP CONSTRAINT IF EXISTS group_performances_pkey;
ALTER TABLE IF EXISTS ONLY public.grade_pools DROP CONSTRAINT IF EXISTS grade_pools_pkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_pkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_results DROP CONSTRAINT IF EXISTS evaluation_results_pkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_evidence DROP CONSTRAINT IF EXISTS evaluation_evidence_pkey;
ALTER TABLE IF EXISTS ONLY public.evaluation_cycles DROP CONSTRAINT IF EXISTS evaluation_cycles_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.cycle_schedules DROP CONSTRAINT IF EXISTS cycle_schedules_pkey;
ALTER TABLE IF EXISTS ONLY public.competency_responses DROP CONSTRAINT IF EXISTS competency_responses_pkey;
ALTER TABLE IF EXISTS ONLY public.competency_questions DROP CONSTRAINT IF EXISTS competency_questions_pkey;
ALTER TABLE IF EXISTS ONLY public.compensations DROP CONSTRAINT IF EXISTS compensations_pkey;
ALTER TABLE IF EXISTS ONLY public.comments DROP CONSTRAINT IF EXISTS comments_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_pkey;
ALTER TABLE IF EXISTS ONLY public.action_items DROP CONSTRAINT IF EXISTS action_items_pkey;
ALTER TABLE IF EXISTS ONLY public.achievements DROP CONSTRAINT IF EXISTS achievements_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.rule_sets;
DROP TABLE IF EXISTS public.reviews;
DROP TABLE IF EXISTS public.reminder_dispatches;
DROP TABLE IF EXISTS public.rebaseline_requests;
DROP TABLE IF EXISTS public.position_defs;
DROP TABLE IF EXISTS public.permission_config;
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.monthly_performances;
DROP TABLE IF EXISTS public.midterm_reviews;
DROP TABLE IF EXISTS public.kpis;
DROP TABLE IF EXISTS public.kpi_templates;
DROP TABLE IF EXISTS public.kpi_template_items;
DROP TABLE IF EXISTS public.kpi_snapshots;
DROP TABLE IF EXISTS public.kpi_scores;
DROP TABLE IF EXISTS public.kpi_category_policies;
DROP TABLE IF EXISTS public.group_performances;
DROP TABLE IF EXISTS public.grade_pools;
DROP TABLE IF EXISTS public.evaluations;
DROP TABLE IF EXISTS public.evaluation_results;
DROP TABLE IF EXISTS public.evaluation_evidence;
DROP TABLE IF EXISTS public.evaluation_cycles;
DROP TABLE IF EXISTS public.departments;
DROP TABLE IF EXISTS public.cycle_schedules;
DROP TABLE IF EXISTS public.competency_responses;
DROP TABLE IF EXISTS public.competency_questions;
DROP TABLE IF EXISTS public.compensations;
DROP TABLE IF EXISTS public.comments;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.appeals;
DROP TABLE IF EXISTS public.action_items;
DROP TABLE IF EXISTS public.achievements;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public."VisibilityScope";
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."ReviewKind";
DROP TYPE IF EXISTS public."RebaselineRequestStatus";
DROP TYPE IF EXISTS public."MidtermReviewStatus";
DROP TYPE IF EXISTS public."MeasureType";
DROP TYPE IF EXISTS public."LegalEntity";
DROP TYPE IF EXISTS public."KpiStatus";
DROP TYPE IF EXISTS public."KpiGroup";
DROP TYPE IF EXISTS public."KpiCategory";
DROP TYPE IF EXISTS public."JobLevel";
DROP TYPE IF EXISTS public."GroupTier";
DROP TYPE IF EXISTS public."Grade";
DROP TYPE IF EXISTS public."EvaluationType";
DROP TYPE IF EXISTS public."EvaluationStatus";
DROP TYPE IF EXISTS public."EmploymentStatus";
DROP TYPE IF EXISTS public."DepartmentType";
DROP TYPE IF EXISTS public."CycleType";
DROP TYPE IF EXISTS public."CycleStatus";
DROP TYPE IF EXISTS public."AppealStatus";
DROP TYPE IF EXISTS public."ActionItemStatus";
DROP TYPE IF EXISTS public."ActionItemSource";
--
-- Name: ActionItemSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActionItemSource" AS ENUM (
    'midterm_review'
);


--
-- Name: ActionItemStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActionItemStatus" AS ENUM (
    'planned',
    'in_progress',
    'done',
    'canceled'
);


--
-- Name: AppealStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AppealStatus" AS ENUM (
    'submitted',
    'under_review',
    'answered',
    'closed'
);


--
-- Name: CycleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CycleStatus" AS ENUM (
    'draft',
    'active',
    'mid_review',
    'calibration',
    'closed'
);


--
-- Name: CycleType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CycleType" AS ENUM (
    'MIDTERM',
    'FINAL'
);


--
-- Name: DepartmentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DepartmentType" AS ENUM (
    'group',
    'division',
    'team'
);


--
-- Name: EmploymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmploymentStatus" AS ENUM (
    'active',
    'on_leave',
    'resigned'
);


--
-- Name: EvaluationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvaluationStatus" AS ENUM (
    'not_started',
    'in_progress',
    'submitted',
    'finalized'
);


--
-- Name: EvaluationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvaluationType" AS ENUM (
    'self',
    'downward'
);


--
-- Name: Grade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Grade" AS ENUM (
    'S',
    'A',
    'B',
    'C',
    'D'
);


--
-- Name: GroupTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GroupTier" AS ENUM (
    'excellent',
    'standard',
    'poor'
);


--
-- Name: JobLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobLevel" AS ENUM (
    'division_head',
    'team_lead',
    'senior_plus',
    'senior_minus'
);


--
-- Name: KpiCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KpiCategory" AS ENUM (
    'revenue',
    'construction',
    'orders',
    'collaboration',
    'development'
);


--
-- Name: KpiGroup; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KpiGroup" AS ENUM (
    'performance_core',
    'collaboration_growth'
);


--
-- Name: KpiStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."KpiStatus" AS ENUM (
    'draft',
    'submitted',
    'approved',
    'confirmed'
);


--
-- Name: LegalEntity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LegalEntity" AS ENUM (
    'energyx',
    'mirae_plan'
);


--
-- Name: MeasureType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MeasureType" AS ENUM (
    'amount',
    'rate',
    'count',
    'qualitative'
);


--
-- Name: MidtermReviewStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MidtermReviewStatus" AS ENUM (
    'pending',
    'self_done',
    'confirmed'
);


--
-- Name: RebaselineRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RebaselineRequestStatus" AS ENUM (
    'submitted',
    'approved',
    'rejected'
);


--
-- Name: ReviewKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewKind" AS ENUM (
    'strength',
    'improvement'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'hr_admin',
    'division_head',
    'team_lead',
    'employee'
);


--
-- Name: VisibilityScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VisibilityScope" AS ENUM (
    'self',
    'team',
    'division',
    'group',
    'company'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id text NOT NULL,
    kpi_id text NOT NULL,
    quarter integer NOT NULL,
    actual_value double precision NOT NULL,
    achievement_rate double precision NOT NULL,
    evidence_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_items (
    id text NOT NULL,
    cycle_id text NOT NULL,
    evaluatee_id text NOT NULL,
    kpi_id text,
    source public."ActionItemSource" DEFAULT 'midterm_review'::public."ActionItemSource" NOT NULL,
    title text NOT NULL,
    detail text,
    assignee_id text NOT NULL,
    due_date timestamp(3) without time zone,
    status public."ActionItemStatus" DEFAULT 'planned'::public."ActionItemStatus" NOT NULL,
    created_by_id text NOT NULL,
    completed_at timestamp(3) without time zone,
    completion_note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: appeals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appeals (
    id text NOT NULL,
    result_id text NOT NULL,
    user_id text NOT NULL,
    reason text NOT NULL,
    status public."AppealStatus" DEFAULT 'submitted'::public."AppealStatus" NOT NULL,
    response text,
    responded_by_id text,
    decision text,
    decided_by_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    before jsonb,
    after jsonb,
    user_id text,
    ip text,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id text NOT NULL,
    evaluation_id text NOT NULL,
    author_id text NOT NULL,
    quarter integer NOT NULL,
    content text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: compensations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensations (
    id text NOT NULL,
    user_id text NOT NULL,
    cycle_id text NOT NULL,
    final_grade public."Grade" NOT NULL,
    raise_rate double precision NOT NULL,
    simulated boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    next_year_salary integer,
    base_salary integer
);


--
-- Name: competency_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competency_questions (
    id text NOT NULL,
    cycle_id text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    text text NOT NULL,
    hint text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    category text DEFAULT '전문성'::text NOT NULL,
    weight integer DEFAULT 0 NOT NULL,
    applied_level text DEFAULT '전 직급'::text NOT NULL,
    options text[] DEFAULT ARRAY[]::text[] NOT NULL
);


--
-- Name: competency_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competency_responses (
    id text NOT NULL,
    question_id text NOT NULL,
    user_id text NOT NULL,
    cycle_id text NOT NULL,
    grade public."Grade" NOT NULL,
    comment text,
    submitted_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: cycle_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cycle_schedules (
    id text NOT NULL,
    cycle_id text NOT NULL,
    phase text NOT NULL,
    due_date timestamp(3) without time zone NOT NULL,
    notify_offsets jsonb DEFAULT '[7, 3, 1]'::jsonb NOT NULL,
    notify_enabled boolean DEFAULT true NOT NULL,
    target_user_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    target_dept_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    start_date timestamp(3) without time zone
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id text NOT NULL,
    name text NOT NULL,
    type public."DepartmentType" NOT NULL,
    parent_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_engineering boolean DEFAULT false NOT NULL,
    head_user_id text
);


--
-- Name: evaluation_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_cycles (
    id text NOT NULL,
    name text NOT NULL,
    year integer NOT NULL,
    start_date timestamp(3) without time zone NOT NULL,
    end_date timestamp(3) without time zone NOT NULL,
    status public."CycleStatus" DEFAULT 'draft'::public."CycleStatus" NOT NULL,
    rule_set_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    cycle_type public."CycleType" DEFAULT 'FINAL'::public."CycleType" NOT NULL
);


--
-- Name: evaluation_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_evidence (
    id text NOT NULL,
    evaluation_id text NOT NULL,
    kpi_id text NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size integer NOT NULL,
    data bytea NOT NULL,
    uploaded_by_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: evaluation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_results (
    id text NOT NULL,
    user_id text NOT NULL,
    cycle_id text NOT NULL,
    final_grade public."Grade",
    final_score double precision,
    percentile double precision,
    by_type jsonb,
    by_group jsonb,
    company_avg double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    group_snapshot text,
    division_snapshot text,
    team_snapshot text,
    division_id_snapshot text,
    group_id_snapshot text,
    team_id_snapshot text
);


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id text NOT NULL,
    cycle_id text NOT NULL,
    evaluator_id text NOT NULL,
    evaluatee_id text NOT NULL,
    type public."EvaluationType" NOT NULL,
    round integer,
    status public."EvaluationStatus" DEFAULT 'not_started'::public."EvaluationStatus" NOT NULL,
    total_score double precision,
    final_grade public."Grade",
    overall_grade public."Grade",
    overall_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: grade_pools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_pools (
    id text NOT NULL,
    cycle_id text NOT NULL,
    group_id text NOT NULL,
    tier public."GroupTier" NOT NULL,
    s_ratio double precision NOT NULL,
    a_ratio double precision NOT NULL,
    b_ratio double precision NOT NULL,
    c_ratio double precision NOT NULL,
    d_ratio double precision NOT NULL
);


--
-- Name: group_performances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_performances (
    id text NOT NULL,
    group_id text NOT NULL,
    cycle_id text NOT NULL,
    revenue double precision,
    orders double precision,
    profit double precision,
    achievement_rate double precision NOT NULL,
    tier public."GroupTier" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: kpi_category_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_category_policies (
    id text NOT NULL,
    "position" text NOT NULL,
    allowed jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: kpi_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_scores (
    id text NOT NULL,
    evaluation_id text NOT NULL,
    kpi_id text NOT NULL,
    achievement_rate double precision,
    grade public."Grade",
    score double precision NOT NULL,
    weight integer NOT NULL,
    self_note text,
    actual_amount double precision,
    reviewer_note text
);


--
-- Name: kpi_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_snapshots (
    id text NOT NULL,
    cycle_id text NOT NULL,
    user_id text NOT NULL,
    label text NOT NULL,
    data jsonb NOT NULL,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: kpi_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_template_items (
    id text NOT NULL,
    template_id text NOT NULL,
    category public."KpiCategory" NOT NULL,
    "group" public."KpiGroup" NOT NULL,
    sample_strategy text,
    default_measure_type public."MeasureType" NOT NULL,
    default_weight integer NOT NULL,
    is_qualitative boolean DEFAULT false NOT NULL
);


--
-- Name: kpi_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_templates (
    id text NOT NULL,
    cycle_id text NOT NULL,
    job_level public."JobLevel" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpis (
    id text NOT NULL,
    user_id text NOT NULL,
    cycle_id text NOT NULL,
    category public."KpiCategory" NOT NULL,
    "group" public."KpiGroup" NOT NULL,
    core_strategy text,
    csf text,
    title text NOT NULL,
    measure_method text,
    measure_type public."MeasureType" NOT NULL,
    target_value double precision,
    weight integer NOT NULL,
    is_qualitative boolean DEFAULT false NOT NULL,
    grading jsonb,
    parent_kpi_id text,
    status public."KpiStatus" DEFAULT 'draft'::public."KpiStatus" NOT NULL,
    reject_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    grading_criteria jsonb,
    target_text text,
    use_absolute_amount boolean DEFAULT false NOT NULL
);


--
-- Name: midterm_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.midterm_reviews (
    id text NOT NULL,
    cycle_id text NOT NULL,
    evaluatee_id text NOT NULL,
    status public."MidtermReviewStatus" DEFAULT 'pending'::public."MidtermReviewStatus" NOT NULL,
    self_note text,
    self_submitted_at timestamp(3) without time zone,
    reviewer_id text,
    reviewer_note text,
    confirmed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: monthly_performances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_performances (
    id text NOT NULL,
    cycle_id text NOT NULL,
    department_id text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    category public."KpiCategory" NOT NULL,
    target_amount double precision NOT NULL,
    actual_amount double precision NOT NULL,
    entered_by_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    read_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: permission_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_config (
    id text DEFAULT 'singleton'::text NOT NULL,
    matrix jsonb DEFAULT '{}'::jsonb NOT NULL,
    nav_visibility jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    updated_by_id text
);


--
-- Name: position_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.position_defs (
    id text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer NOT NULL,
    is_management boolean DEFAULT false NOT NULL,
    default_role public."Role" DEFAULT 'employee'::public."Role" NOT NULL,
    default_scope public."VisibilityScope" DEFAULT 'self'::public."VisibilityScope" NOT NULL,
    default_job_level public."JobLevel",
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: rebaseline_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rebaseline_requests (
    id text NOT NULL,
    cycle_id text NOT NULL,
    evaluatee_id text NOT NULL,
    reason text NOT NULL,
    items jsonb NOT NULL,
    status public."RebaselineRequestStatus" DEFAULT 'submitted'::public."RebaselineRequestStatus" NOT NULL,
    reviewer_id text,
    review_comment text,
    reviewed_at timestamp(3) without time zone,
    applied_snapshot_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: reminder_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminder_dispatches (
    id text NOT NULL,
    cycle_id text NOT NULL,
    phase text NOT NULL,
    "offset" integer NOT NULL,
    recipients integer DEFAULT 0 NOT NULL,
    dispatched_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id text NOT NULL,
    kpi_id text NOT NULL,
    quarter integer NOT NULL,
    kind public."ReviewKind" NOT NULL,
    content text NOT NULL,
    author_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: rule_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule_sets (
    id text NOT NULL,
    cycle_id text,
    grade_scale jsonb NOT NULL,
    grading_scales jsonb NOT NULL,
    pool_ratios jsonb NOT NULL,
    raise_rates jsonb NOT NULL,
    weight_policy jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role public."Role" NOT NULL,
    "position" text NOT NULL,
    job_level public."JobLevel",
    department_id text,
    manager_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    current_salary double precision,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    visibility_scope public."VisibilityScope" DEFAULT 'self'::public."VisibilityScope" NOT NULL,
    previous_salary double precision,
    legal_entity public."LegalEntity" DEFAULT 'energyx'::public."LegalEntity" NOT NULL,
    employment_status public."EmploymentStatus" DEFAULT 'active'::public."EmploymentStatus" NOT NULL,
    resigned_at timestamp(3) without time zone,
    evaluation_exempt boolean DEFAULT false NOT NULL,
    evaluation_exempt_reason text
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
71546793-47c1-4b70-935d-4b6efa3cce08	cf3c2ff1ed6a91de4df38ff777653ace87ede6c58df94f847fc62e1b0b981ada	2026-06-04 04:11:36.136143+00	20260604001028_init	\N	\N	2026-06-04 04:11:35.859045+00	1
42f31073-03a5-495a-9096-b4a2cc3cc3be	3794049102ab61ecbcdcdc5204129e0528e58efc19a6b5fed41aa5ab8832936d	2026-06-08 01:18:22.342532+00	20260608011822_eval_result_dept_id_snapshot	\N	\N	2026-06-08 01:18:22.317682+00	1
8b94725e-716a-449e-878b-2a76f90bf016	4d26d5d88eaa07a0760bae4fa10c5e4f93e7ec0bb74a56e7a5cadd2679bec37c	2026-06-04 04:11:36.203007+00	20260604120000_m3_items1_3	\N	\N	2026-06-04 04:11:36.137659+00	1
cdb9f248-46f0-44d4-8754-b96ccb75bd46	14ecc1b672e39970a7827a8fc9e485a5191fa5841912ed112029df3224902a99	2026-06-04 05:36:42.050642+00	20260604130000_cycle_schedule_start_date	\N	\N	2026-06-04 05:36:42.041074+00	1
91434adb-4c34-4dda-978d-994dcbaf1b58	e36d6eabff9e754992dd2f497fb39ca202da86914e110140799b3d483fe5c8ab	2026-06-08 06:15:07.4991+00	20260608061455_midterm_action_items	\N	\N	2026-06-08 06:15:07.439557+00	1
d8dcadc0-4c02-44a7-8ffa-efa24fa8d803	0396fa139d198a66b390907a02103726de318a3d310dabc71a76469124822407	2026-06-04 06:06:18.44276+00	20260604060618_m4_eval_enhancements	\N	\N	2026-06-04 06:06:18.434695+00	1
fc243107-4de6-49bc-8c52-fdcb3abc60ec	15719a2584fd027381354db62fa9d869e7ad9aca89e56188f7093767c8f8fd49	2026-06-08 01:25:59.516276+00	20260608100000_add_competency_options	\N	\N	2026-06-08 01:25:59.507924+00	1
a9710809-483b-4078-bbeb-a932fce45071	7ffb445c224ef4c6f57f4cd03de534b83f0b2f99a6b7e22db86a88e531eace2f	2026-06-04 23:46:41.723049+00	20260604234641_add_kpi_score_self_note	\N	\N	2026-06-04 23:46:41.712147+00	1
8b519063-47ef-491e-aee5-9a8ea59c46f9	76fbacc74c39c7c77a3fdee1793d95187776d30e1b88a25b9941aff78fcdba83	2026-06-05 00:10:39.039764+00	20260605000000_add_competency_fields	\N	\N	2026-06-05 00:10:39.029044+00	1
b3a93519-7ea9-4631-a484-c2a3f7be71f4	964472c774d3917cd96abf09db090956256d159f9fae740e692df696a7f28e7c	2026-06-05 01:07:52.057129+00	20260605010019_add_user_previous_salary	\N	\N	2026-06-05 01:07:52.048671+00	1
f8a29efd-8bd9-4238-bf47-3a1d3f59557f	4ee1bc156648739736993c7754ae38cdfe772e226b3206e88fa4087cf32f7a2a	2026-06-08 01:51:03.110591+00	20260608110000_reminder_dispatches	\N	\N	2026-06-08 01:51:03.083956+00	1
905d5fd6-abe6-4d08-afdc-873fc192ac04	4953f9351a5689a820a24e56a56a9d719dde4566852b186f5832563714b24547	2026-06-05 04:47:52.234592+00	20260605020000_kpi_snapshots	\N	\N	2026-06-05 04:47:52.185257+00	1
d2b98ba8-01ed-43d2-8751-6d53847de870	187d8df61df4ee5473c054581e27fb18e28d43d86e6e756a3e6ddd99c728f77a	2026-06-05 04:54:50.257328+00	20260605030000_yoy_legacy_results	\N	\N	2026-06-05 04:54:50.24702+00	1
a0aac722-4022-48e3-bce0-bb7f4fe546a1	fc2a916f6ff84348b48fc3ecdda1f85b69945330f2b6f66b9e0bdac5a1489c8e	2026-06-05 05:43:53.04159+00	20260605054309_position_registry	\N	\N	2026-06-05 05:43:52.979228+00	1
0ec5b286-5b9b-4ed4-b251-3233547db98a	22f443adcf98871b14124ebb304cd4f8873d72ae82e46a156ecdf323892afbf4	2026-06-08 04:04:58.555053+00	20260608040458_add_department_head	\N	\N	2026-06-08 04:04:58.5414+00	1
5d9ac2e5-e2ec-453d-9f88-d3539c72048c	6a9d9bff1321f443715cec80b82122007643022e5da5e8d1434281c6ee826015	2026-06-05 06:19:35.255273+00	20260605060000_add_compensation_base_salary	\N	\N	2026-06-05 06:19:35.241367+00	1
29aaedcb-f35d-4b32-9154-1c36c1e8f7d3	bc7f07574a6f235c35ca08f306bb1ed70fbc9f9be30b0448e8194ad5f17fe9c7	2026-06-05 07:36:27.712563+00	20260605073627_kpi_qualitative_grading	\N	\N	2026-06-05 07:36:27.70288+00	1
ce1e6c9e-dc7f-4aff-809d-8dbd562cddef	8b85f78293a798609e61015ebdd8ba6d11180d36de7558c0636ebd2db9f55b21	2026-06-08 06:38:41.163612+00	20260608140000_competency_excluded_stage_exceptions	\N	\N	2026-06-08 06:38:41.150648+00	1
e7181f72-e09a-4fa7-96ee-a06f061546c9	659febe3d9a118422fcf613bc901d98494be401ec3cbc2e2b42e7aa1af39419d	2026-06-08 00:44:02.975393+00	20260608093500_permission_config	\N	\N	2026-06-08 00:44:02.95152+00	1
b098020f-e078-4e3d-9a77-792dc3b2e34a	aa922c31a23a73ec5c1b591de87bd46c9a773123f8a79f1f3a312b91a1497f0e	2026-06-08 04:29:46.388622+00	20260608042946_add_evaluation_exempt	\N	\N	2026-06-08 04:29:46.380945+00	1
d5fc41d4-c9d5-4959-8ade-80dde2547e82	ff9cadfd7f314029fee47b076c3aa37287c7a3e0ec37334c28de022fadfffa72	2026-06-08 05:08:43.041129+00	20260608043945_ruleset_gaps	\N	\N	2026-06-08 05:08:43.029344+00	1
9461899d-0617-4caa-8859-437644c92581	986a60528a9f59b8b1f079f19e1986e68ac5eddf2c393986b4d996679fba7901	2026-06-08 05:08:43.071181+00	20260608120000_evaluation_evidence	\N	\N	2026-06-08 05:08:43.042445+00	1
bd76d46b-3747-4bbe-822f-fb163ae39361	e31106be817f9b4cae7a9fac3b2b1e4974f663d4fb66ebacfcff672ce5b90a8c	2026-06-08 07:38:06.023218+00	20260608150000_rebaseline_requests	\N	\N	2026-06-08 07:38:05.974227+00	1
8bce6e06-32fd-4f0a-b38e-cc304eb83158	7c12c5adfc79bf9768f0431a77c2067accae8817cca41e4e11c8feeb62531c96	2026-06-08 05:26:54.137434+00	20260608130000_kpiscore_reviewer_note	\N	\N	2026-06-08 05:26:54.126957+00	1
\.


--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.achievements (id, kpi_id, quarter, actual_value, achievement_rate, evidence_url, created_at) FROM stdin;
\.


--
-- Data for Name: action_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_items (id, cycle_id, evaluatee_id, kpi_id, source, title, detail, assignee_id, due_date, status, created_by_id, completed_at, completion_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: appeals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appeals (id, result_id, user_id, reason, status, response, responded_by_id, decision, decided_by_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, entity, entity_id, action, before, after, user_id, ip, at) FROM stdin;
0765f660-2129-4c9c-abda-132419dacd27	PositionDef	ecc0b0e6-1b6a-48af-b997-814766670538	position.update	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": false, "defaultJobLevel": "senior_plus"}	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": true, "defaultJobLevel": "senior_plus"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 06:04:56.141
a68c4cd8-37b1-48ae-8c7e-a7e7a6e75091	PositionDef	ecc0b0e6-1b6a-48af-b997-814766670538	position.update	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": true, "defaultJobLevel": "senior_plus"}	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": false, "defaultJobLevel": "senior_plus"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 06:05:04.773
4ca2b57f-45ea-4335-8ba5-4521a4ea1760	PositionDef	ecc0b0e6-1b6a-48af-b997-814766670538	position.update	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": false, "defaultJobLevel": "senior_plus"}	{"id": "ecc0b0e6-1b6a-48af-b997-814766670538", "code": "principal", "label": "수석", "isActive": true, "isSystem": true, "sortOrder": 70, "defaultRole": "employee", "defaultScope": "self", "isManagement": true, "defaultJobLevel": "senior_plus"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 06:05:23.096
7a31356c-660d-4561-b51d-4d1a0e59621d	EvaluationCycle	741257eb-3aaa-46dc-b4ca-720d430e3b9d	cycle.legacy_results.import	null	{"total": 88, "matched": 86, "imported": 88, "reviewQueue": 0, "createdResigned": 2}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 06:32:27.062
2e4f2463-54f7-4994-af60-79e84f0fa0ee	PositionDef	46ccae10-4391-4b16-a55d-655c71d418f0	position.delete	{"id": "46ccae10-4391-4b16-a55d-655c71d418f0", "code": "team_lead", "label": "팀장", "isActive": true, "isSystem": true, "sortOrder": 60, "defaultRole": "team_lead", "defaultScope": "team", "isManagement": true, "defaultJobLevel": "team_lead"}	null	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:13:35.362
f83758ee-f29e-4381-a691-7810c969c30c	Kpi	7e9828e0-935f-458f-8597-1255c5748269	kpi.import	null	{"userId": "7e9828e0-935f-458f-8597-1255c5748269", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 90, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:56:55.013
31687d5c-2c9f-43e5-81a4-a5ac931b43a0	Kpi	f74dc4d0-0afe-4040-8b22-0d69a5140a53	kpi.import	null	{"userId": "f74dc4d0-0afe-4040-8b22-0d69a5140a53", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 8, "weightSum": 80, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:56:55.057
df5a46bb-d6df-4809-b022-a8287517adfa	Kpi	7f1892b1-58ac-46a1-8d6b-ac86151ea107	kpi.import	null	{"userId": "7f1892b1-58ac-46a1-8d6b-ac86151ea107", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:56:55.104
9e224617-32df-4cff-8727-4dc1f67f56f9	Kpi	718a8acf-0790-46e5-84cb-5620338dba3d	kpi.import	null	{"userId": "718a8acf-0790-46e5-84cb-5620338dba3d", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:56:55.144
9350bd70-409f-4d9d-a543-1ed9e5666c29	Kpi	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	kpi.import	null	{"userId": "d50ecde7-3cd4-48f7-b3b2-7bedd614e070", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:56:55.184
34ced524-501d-4944-842e-bbb345386fa6	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:57.876
29660541-19da-4201-a328-21d448fd0d35	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:57.928
1f1512a1-d88d-4264-8ee7-10577be780ab	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:57:35.589
143c7e94-ebe8-4313-a34a-5733b2e3b463	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:57:35.621
7548f141-9a17-4b16-99a9-0d514d60325a	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 0, "weightSum": 0, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:57:35.653
1f849f8e-2962-471c-bb9d-7b4d76dffd67	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:58:46.64
3224f230-0a7d-430c-962d-ae2fb8a7d3ce	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 0, "weightSum": 0, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 07:58:46.678
eb126259-c5b4-4bc2-9db0-dff560f9fffe	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 2, "weightSum": 20, "deletedDrafts": 0}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:57.964
18b6ce8f-7fda-4e73-b495-38d08fa2512b	Kpi	7e9828e0-935f-458f-8597-1255c5748269	kpi.import	null	{"userId": "7e9828e0-935f-458f-8597-1255c5748269", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 90, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:58.013
82283390-8609-4720-a034-00a248c57b19	Kpi	f74dc4d0-0afe-4040-8b22-0d69a5140a53	kpi.import	null	{"userId": "f74dc4d0-0afe-4040-8b22-0d69a5140a53", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 8, "weightSum": 80, "deletedDrafts": 8}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:58.064
5190af2f-702c-4cc0-8f42-3a776f2f74d9	Kpi	7f1892b1-58ac-46a1-8d6b-ac86151ea107	kpi.import	null	{"userId": "7f1892b1-58ac-46a1-8d6b-ac86151ea107", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:58.107
1ea99890-7b6f-47b6-9cce-0b313d056f6f	Kpi	718a8acf-0790-46e5-84cb-5620338dba3d	kpi.import	null	{"userId": "718a8acf-0790-46e5-84cb-5620338dba3d", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:58.145
381e2bbe-bb4b-435f-876f-6909ba314b22	Kpi	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	kpi.import	null	{"userId": "d50ecde7-3cd4-48f7-b3b2-7bedd614e070", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-07 22:57:58.18
167efabe-4550-420c-bbde-96636796d0ef	Kpi	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	kpi.import.commit	null	{"userId": "d50ecde7-3cd4-48f7-b3b2-7bedd614e070", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:45.466
055840eb-a3d4-4495-928b-534f21dd0ee6	Kpi	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	kpi.import.submit	null	{"userId": "d50ecde7-3cd4-48f7-b3b2-7bedd614e070", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 6, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:46.967
ab3e570b-69ec-4047-ae26-9599104a50ca	Kpi	56971ed9-3506-40eb-9153-f520e112f6b0	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.567
74f85c75-fd96-440f-bcec-aa1c18a022b5	Kpi	88d02afc-1971-4d42-ae0b-d717abeddb60	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.584
1ae6f744-c144-44e3-8408-6041b427a598	Kpi	6d28a2ae-833a-47aa-a32c-403da35dbed4	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.6
68059917-8a62-43c8-8bd8-22ddcd72bce6	Kpi	baa4d99b-c3df-488f-b9e4-d213ef9397f9	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.616
f55e30e2-8ca3-4c36-aacd-2f7544189234	Kpi	c9389928-5cae-411d-afb0-391a3c0d0087	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.631
aaab23bd-9366-40a0-b3af-ebfd1dcb55c2	Kpi	73a1e324-3f53-43bb-8b95-8eb4f8eee0c5	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:01:48.648
5f5df6db-53d3-4a2f-8831-bcfc4d318eac	Kpi	ae709460-52c1-4f7f-98e6-4330d8557d18	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.117
c2d5efd0-de36-480f-b803-254507a80fbe	Kpi	1b708f79-734d-4d4c-bf4e-aeb4f2d6bfe1	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.145
d5c2109b-be26-4fd6-9151-a679c82a1baa	Kpi	6d36b9a8-4ab4-4a81-b113-76b5cf380b1a	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.169
25db4b22-2e53-43e9-adf3-ea56582db158	Kpi	d4989e7e-a1db-4cdd-8491-1258b63dff6f	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.193
ce8f1d63-0f6d-4925-bee2-20ac0c23cc99	Kpi	c8112d72-3640-4ea3-8598-7dd30c72f1cc	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.217
2005c955-c635-4e78-b426-53aec28ce752	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-05 08:04:07.375
d8689a21-ce00-4e77-9dbf-be69cef7771f	Kpi	7e9828e0-935f-458f-8597-1255c5748269	kpi.import.commit	null	{"userId": "7e9828e0-935f-458f-8597-1255c5748269", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 90, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:14:21.495
0e6f571a-8535-4742-8795-6412ff0abb6e	Kpi	f74dc4d0-0afe-4040-8b22-0d69a5140a53	kpi.import.commit	null	{"userId": "f74dc4d0-0afe-4040-8b22-0d69a5140a53", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 8, "weightSum": 80, "deletedDrafts": 8}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:14:49.467
338de744-8933-40e6-a502-847b88ba781e	Kpi	7f1892b1-58ac-46a1-8d6b-ac86151ea107	kpi.import.commit	null	{"userId": "7f1892b1-58ac-46a1-8d6b-ac86151ea107", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:15:06.9
2dc5456f-c103-43a2-9d6d-ba11351f26ad	Kpi	718a8acf-0790-46e5-84cb-5620338dba3d	kpi.import.commit	null	{"userId": "718a8acf-0790-46e5-84cb-5620338dba3d", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:15:18.482
d36f90fa-cb27-44e3-82eb-546c1caf9b6d	Kpi	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	kpi.import.commit	null	{"userId": "d50ecde7-3cd4-48f7-b3b2-7bedd614e070", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:15:34.275
83367911-79db-493f-9b91-2000efde8592	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import.commit	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:15:45.729
5ca172e0-f211-400e-bb3f-3f2ed03d0e7d	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import.commit	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:15:52.958
1dd1b0ac-258c-4038-bffc-b3d525590cc1	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:20:29.343
62cf2448-07a4-4e1d-8749-b90d97214985	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 85, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:20:55.497
af69f717-7b17-4110-880f-b2ae065fc165	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 85, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:20:59.589
3027771c-a8a3-4f76-b9c1-ed1d44a05114	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 85, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:21:01.353
07515b05-4eb3-4c9a-be91-1dc83aa39eb7	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 2, "weightSum": 20, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:21:23.603
9bc98347-ca5b-445f-a856-6b8eacdd4143	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import.commit	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:26:45.089
a0333ada-5ffc-4c6d-a8fe-bfe1a3b07785	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import.commit	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:26:49.645
3d52c63a-eff5-4a23-ab4c-ab3b3abbbde8	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 2}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:27:56.131
43f68522-a1a7-4ae5-b2b2-a46226cfbbda	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import.commit	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:35:39.13
e2789a6c-4007-4c3f-a01e-93973929eb2d	Kpi	f03c187a-253c-4361-897b-19a970a6054e	kpi.import.submit	null	{"userId": "f03c187a-253c-4361-897b-19a970a6054e", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 5, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:35:39.799
cb6e3764-ea42-47c4-9c5a-a424283c08f8	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import.commit	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:35:49.189
7e30c2c2-da4c-45f3-8600-4d6cbb97c038	Kpi	c213f7bc-d2c2-4eed-b026-1116bac4d004	kpi.import.submit	null	{"userId": "c213f7bc-d2c2-4eed-b026-1116bac4d004", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 5, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:35:49.854
bc2b694c-05f9-4a8f-8adc-e29bbfdf3c90	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:36:42.265
c0aea7e4-154a-4107-a5c6-c1f7ea607e7c	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.commit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 2}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 00:21:01.854
5309908e-ebfd-4425-8323-d9372ca3dfca	Kpi	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	kpi.import.submit	null	{"userId": "cb0bacd9-6489-4b1e-97a9-30edad5f87ac", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 6, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:36:43.693
ffb5f862-9296-4686-bf1c-b96dd658502d	Kpi	7e9828e0-935f-458f-8597-1255c5748269	kpi.import.commit	null	{"userId": "7e9828e0-935f-458f-8597-1255c5748269", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 90, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:36:59.692
3a423ee0-affd-4f38-b818-366da937a686	Kpi	7e9828e0-935f-458f-8597-1255c5748269	kpi.import.commit	null	{"userId": "7e9828e0-935f-458f-8597-1255c5748269", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 90, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:37:45.325
9d0c380c-518c-4d25-88dd-1eb2f36d4b3a	Kpi	f74dc4d0-0afe-4040-8b22-0d69a5140a53	kpi.import.commit	null	{"userId": "f74dc4d0-0afe-4040-8b22-0d69a5140a53", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 8, "weightSum": 80, "deletedDrafts": 8}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:38:23.624
9634688f-827a-4b6e-bc8c-47e32402a4d4	Kpi	7f1892b1-58ac-46a1-8d6b-ac86151ea107	kpi.import.commit	null	{"userId": "7f1892b1-58ac-46a1-8d6b-ac86151ea107", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 5, "weightSum": 100, "deletedDrafts": 5}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:11.253
f9debc77-4f82-4fbd-bb78-0a73e0949227	Kpi	7f1892b1-58ac-46a1-8d6b-ac86151ea107	kpi.import.submit	null	{"userId": "7f1892b1-58ac-46a1-8d6b-ac86151ea107", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 5, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:12.527
0f100bc3-e9e8-4186-b5e7-9f6ce350ab95	Kpi	718a8acf-0790-46e5-84cb-5620338dba3d	kpi.import.commit	null	{"userId": "718a8acf-0790-46e5-84cb-5620338dba3d", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "imported": 6, "weightSum": 100, "deletedDrafts": 6}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:32.254
d553325e-58e0-4d6a-b37d-d63f9f82a03d	Kpi	718a8acf-0790-46e5-84cb-5620338dba3d	kpi.import.submit	null	{"userId": "718a8acf-0790-46e5-84cb-5620338dba3d", "cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235", "submitted": 6, "weightSum": 100}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 01:39:34.919
6b1d31ea-9af1-440c-be63-9d4471c90009	Kpi	08006fe7-ae6d-44e0-bdb5-2201019fcd55	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:18:11.242
e207e191-8461-4684-9167-2e30af891b66	Evaluation	c6210a61-8c90-4597-87dd-2763fcc2dfd6	evaluation.submit	{"status": "in_progress"}	{"status": "submitted", "totalScore": 93}	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	\N	2026-06-08 02:21:28.582
58d966e2-93f3-4d46-9ccf-bcfc02722333	Kpi	3e5afd49-8219-482c-bb11-5c6bdbbcc023	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.418
4e41246b-b9aa-4fb0-a5c6-ee8a9f6da9f9	Kpi	a5e30763-4726-44e4-9982-99b1abe78e32	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.449
3b124f37-eaf7-4a5e-9f1e-851983abcb48	Kpi	2d8cac06-81ae-4315-8768-45ef155cfb84	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.478
7945c2ea-9eac-4ae9-bed7-59fe393168b9	Kpi	62a3cc6f-a9bd-4677-84f1-7ab847242997	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.508
18f32c6b-5a5c-452f-b1b7-5f6b4817854f	Kpi	a619a43a-e585-470a-8cf2-45195e813319	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.541
3b11e6be-2ca0-4382-9744-ce0c868f2dfa	Kpi	25caec31-cd1f-4afa-b6a7-a4fa30f1f66a	kpi.approve	{"status": "submitted"}	{"status": "approved"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 02:32:33.569
639a7d05-69c2-4430-b7d0-b7405a498f09	Evaluation	49d11397-37f6-4db0-8d3e-ed7be8dfd26c	evaluation.submit	{"status": "in_progress"}	{"status": "submitted", "totalScore": 93}	718a8acf-0790-46e5-84cb-5620338dba3d	\N	2026-06-08 02:33:26.04
d56cc569-728f-4710-a97e-38fb0fe1f004	MidtermReview	a236ac2b-f240-4fa1-bb4a-9f351f9bc7ca	midterm_review.self_submit	null	{"cycleId": "af9f51ff-ab4f-41fb-ba94-f10552590235"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 06:22:55.714
dd1a7229-62ca-482b-96eb-fe56318ab134	ActionItem	e40d901e-0fe5-4a8f-b123-9f49a8291e1c	action_item.create	null	{"title": "CRM 교육 이수", "assigneeId": "970d36ef-b0f7-47f4-95ff-894d66080f5e", "evaluateeId": "970d36ef-b0f7-47f4-95ff-894d66080f5e"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 06:22:55.74
b61a7d36-c381-487f-b82a-10ee350383d2	ActionItem	e40d901e-0fe5-4a8f-b123-9f49a8291e1c	action_item.transition	{"status": "planned"}	{"status": "in_progress"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 06:22:55.757
808577a8-6cc6-44fe-9a0e-1b2a26bd9168	ActionItem	e40d901e-0fe5-4a8f-b123-9f49a8291e1c	action_item.transition	{"status": "in_progress"}	{"status": "canceled"}	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	\N	2026-06-08 06:22:55.772
e8f819e7-c128-4a0b-acd0-a7bcd73b99c3	CompetencyQuestion	ab93ad71-d32d-4f23-b574-f51da706acb5	competency_question.create	null	{"text": "협업 역량"}	970d36ef-b0f7-47f4-95ff-894d66080f5e	\N	2026-06-08 06:23:35.015
f2e23dae-ed7c-48a9-87ea-f72573b406f4	EvaluationCycle	af9f51ff-ab4f-41fb-ba94-f10552590235	cycle.delete	{"name": "2026년 상반기 정기 성과평가", "year": 2026, "status": "mid_review"}	null	970d36ef-b0f7-47f4-95ff-894d66080f5e	\N	2026-06-08 08:06:59.132
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comments (id, evaluation_id, author_id, quarter, content, created_at) FROM stdin;
\.


--
-- Data for Name: compensations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compensations (id, user_id, cycle_id, final_grade, raise_rate, simulated, created_at, next_year_salary, base_salary) FROM stdin;
\.


--
-- Data for Name: competency_questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competency_questions (id, cycle_id, "order", text, hint, is_active, created_by_id, created_at, updated_at, category, weight, applied_level, options) FROM stdin;
\.


--
-- Data for Name: competency_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.competency_responses (id, question_id, user_id, cycle_id, grade, comment, submitted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cycle_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cycle_schedules (id, cycle_id, phase, due_date, notify_offsets, notify_enabled, target_user_ids, target_dept_ids, created_at, updated_at, is_locked, start_date) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, type, parent_id, created_at, is_engineering, head_user_id) FROM stdin;
883bc609-9a46-4736-9905-81d7889675be	이노베이션그룹	group	\N	2026-06-05 05:44:30.16	f	\N
865a2de0-4663-4402-b05c-81855ba277be	건축설계그룹	group	\N	2026-06-05 05:44:30.165	f	\N
ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	엔지니어링그룹	group	\N	2026-06-05 05:44:30.167	t	\N
48f4d055-6419-49a3-b876-bef1ee4944ea	건축디자인본부	division	865a2de0-4663-4402-b05c-81855ba277be	2026-06-05 05:44:30.172	f	\N
599f0440-4eb5-4d93-83fc-47122cb6ee6b	주거디자인본부	division	865a2de0-4663-4402-b05c-81855ba277be	2026-06-05 05:44:30.176	f	\N
4d813556-b97d-4b6d-836c-046d4842259a	친환경디자인본부	division	865a2de0-4663-4402-b05c-81855ba277be	2026-06-05 05:44:30.178	f	\N
bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	신재생기술본부	division	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	2026-06-05 05:44:30.18	t	\N
2174264a-4640-457b-b2d3-98d7bae6603b	감리본부	division	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	2026-06-05 05:44:30.182	t	\N
20dbae03-1f71-4e92-b9e5-00189b8a954f	친환경CS1본부	division	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	2026-06-05 05:44:30.183	f	\N
3692e6dd-0e49-4c7d-a389-26238b2f48ba	친환경CS2본부	division	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	2026-06-05 05:44:30.185	f	\N
89428ad4-084d-4c3a-ad65-e7f3505783ea	친환경SA본부	division	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	2026-06-05 05:44:30.187	f	\N
ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	환경평가본부	division	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	2026-06-05 05:44:30.189	f	\N
c3291603-7d1d-4574-865d-36dc668d4148	경영관리본부	division	7ab6895d-4d5b-43c2-b956-6df79ed2af29	2026-06-05 05:44:30.191	f	\N
bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	IT개발팀	team	883bc609-9a46-4736-9905-81d7889675be	2026-06-05 05:44:30.192	f	\N
9d111826-cc3a-4445-b5c6-817c78ef82d0	신재생기술1팀	team	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	2026-06-05 05:44:30.196	t	\N
cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	신재생기술2팀	team	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	2026-06-05 05:44:30.197	t	\N
58cc7087-f2c4-42ee-99fa-f2cbffd4a2fd	신재생기술3팀	team	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	2026-06-05 05:44:30.199	t	\N
09ba8db1-b6c1-4b79-98ab-120e913c71ca	SI팀	team	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	2026-06-05 05:44:30.201	t	\N
26a7e4bc-8e33-4c78-a19a-cb95a8ea393a	기술팀	team	2174264a-4640-457b-b2d3-98d7bae6603b	2026-06-05 05:44:30.203	t	\N
bdb922c7-9b81-4a03-8b39-5a2890b05cec	기술영업팀	team	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	2026-06-05 05:44:30.207	t	\N
d59d8d16-d9ff-4195-9ddd-be096a156cad	CS1본부 1팀	team	20dbae03-1f71-4e92-b9e5-00189b8a954f	2026-06-05 05:44:30.21	f	\N
086f444d-5222-4cf2-8519-9c2bb56179df	CS1본부 2팀	team	20dbae03-1f71-4e92-b9e5-00189b8a954f	2026-06-05 05:44:30.212	f	\N
3b003c17-aecc-4af0-8620-e85bd53fcf7e	CS1본부 3팀	team	20dbae03-1f71-4e92-b9e5-00189b8a954f	2026-06-05 05:44:30.214	f	\N
1990a4db-2151-4dd7-bbd0-020566cfef55	CS2본부 1팀	team	3692e6dd-0e49-4c7d-a389-26238b2f48ba	2026-06-05 05:44:30.215	f	\N
605cd05b-4bab-4184-b6e2-6d03c489bc7c	CS2본부 2팀	team	3692e6dd-0e49-4c7d-a389-26238b2f48ba	2026-06-05 05:44:30.217	f	\N
8007ed4f-a263-472b-bd84-1706766b6d07	CS2본부 3팀	team	3692e6dd-0e49-4c7d-a389-26238b2f48ba	2026-06-05 05:44:30.219	f	\N
8c544a7b-bc1d-4dbd-b180-a653302aaa50	LEED팀	team	3692e6dd-0e49-4c7d-a389-26238b2f48ba	2026-06-05 05:44:30.22	f	\N
6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	친환경SA1팀	team	89428ad4-084d-4c3a-ad65-e7f3505783ea	2026-06-05 05:44:30.223	f	\N
225a963c-263f-4e44-9945-31d2ed537999	친환경SA2팀	team	89428ad4-084d-4c3a-ad65-e7f3505783ea	2026-06-05 05:44:30.225	f	\N
05c7c7bc-861a-4160-99bb-1df3c09aaeae	환경평가팀	team	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	2026-06-05 05:44:30.228	f	\N
87ece94d-728f-46a2-bf07-c06dc3d8086e	기술전략팀	team	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	2026-06-05 05:44:30.229	f	\N
e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	경영기획팀	team	c3291603-7d1d-4574-865d-36dc668d4148	2026-06-05 05:44:30.231	f	\N
729bf597-4cfc-4269-9d1b-8d4fba27939c	인사총무팀	team	c3291603-7d1d-4574-865d-36dc668d4148	2026-06-05 05:44:30.233	f	\N
98faf6ef-81ff-40d8-8b20-3f08cedd9553	재무팀	team	c3291603-7d1d-4574-865d-36dc668d4148	2026-06-05 05:44:30.234	f	\N
7ab6895d-4d5b-43c2-b956-6df79ed2af29	경영그룹	group	\N	2026-06-05 05:44:30.17	f	3494ff1f-a963-483d-af09-775069446d66
b782c886-fe88-4c58-bfec-d55e7f2ae6fe	친환경기술그룹	group	\N	2026-06-05 05:44:30.168	f	178d1fde-79d3-482a-abf5-f2107e33e197
c509500f-387f-4b10-ac8b-a074adaa595a	연구팀	team	883bc609-9a46-4736-9905-81d7889675be	2026-06-05 05:44:30.194	f	\N
1073e163-4f5e-46a6-b73e-5d861a10fec9	기술개발팀	team	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	2026-06-05 05:44:30.208	t	\N
aaf64e93-8104-47a6-b8ae-8ebc3b57f6d6	입찰팀	team	2174264a-4640-457b-b2d3-98d7bae6603b	2026-06-05 05:44:30.205	t	\N
\.


--
-- Data for Name: evaluation_cycles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluation_cycles (id, name, year, start_date, end_date, status, rule_set_id, created_at, updated_at, cycle_type) FROM stdin;
741257eb-3aaa-46dc-b4ca-720d430e3b9d	2025년 정기평가	2025	2025-01-01 00:00:00	2025-12-31 00:00:00	closed	3a472b0b-1ee9-4ccb-b614-5f7d4a1bbd5a	2026-06-05 05:44:30.811	2026-06-05 06:08:21.919	FINAL
1af1c6ff-e450-4ab0-925f-1ee9de9cbed9	2026년 KPI 평가	2026	2026-03-01 00:00:00	2026-11-30 00:00:00	draft	853b514e-2b2d-4ac6-98ef-5f13837f8c90	2026-06-08 08:06:55.231	2026-06-08 08:06:55.231	FINAL
\.


--
-- Data for Name: evaluation_evidence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluation_evidence (id, evaluation_id, kpi_id, filename, mime_type, size, data, uploaded_by_id, created_at) FROM stdin;
\.


--
-- Data for Name: evaluation_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluation_results (id, user_id, cycle_id, final_grade, final_score, percentile, by_type, by_group, company_avg, created_at, updated_at, group_snapshot, division_snapshot, team_snapshot, division_id_snapshot, group_id_snapshot, team_id_snapshot) FROM stdin;
e0a2e606-39ee-4396-912c-b21d83db66f5	418360c3-8a88-4e64-9544-a8334ad20e61	741257eb-3aaa-46dc-b4ca-720d430e3b9d	S	96.7975	\N	{"sum": {"comp": 92.125, "perf": 98.8}, "final": {"comp": 83, "perf": 95}, "round1": {"comp": 96.75, "perf": 99.75}, "round2": {"comp": 90.5, "perf": 99.75}, "source": "import"}	\N	\N	2026-06-05 06:32:26.567	2026-06-08 05:44:29.837	엔지니어링그룹	신재생기술본부	SI팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	09ba8db1-b6c1-4b79-98ab-120e913c71ca
929534c3-167f-441b-a4bf-39a00f7f8248	8099c92c-558b-4e53-88ef-922bc6c4882a	741257eb-3aaa-46dc-b4ca-720d430e3b9d	S	96.10749999999999	\N	{"sum": {"comp": 92.625, "perf": 97.6}, "final": {"comp": 91.75, "perf": 99}, "round1": {"comp": 93, "perf": 97}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.571	2026-06-08 05:44:29.841	친환경기술그룹	친환경CS1본부	\N	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
49cd7745-e7f6-450c-8b26-41f48e704ba2	052417ae-0ae9-45fb-837d-e1dd3d801644	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.92749999999998	\N	{"sum": {"comp": 89.92499999999998, "perf": 98.5}, "final": {"comp": 75.75, "perf": 95}, "round1": {"comp": 96, "perf": 100}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.575	2026-06-08 05:44:29.844	엔지니어링그룹	신재생기술본부	신재생기술1팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	9d111826-cc3a-4445-b5c6-817c78ef82d0
c37ab7db-8f62-4374-aa05-6a39ffc42fbd	423677ec-9275-457b-b5f1-65f4d58feb60	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.57499999999999	\N	{"sum": {"comp": 89.1, "perf": 98.35000000000001}, "final": {"comp": 90.5, "perf": 98.5}, "round1": {"comp": 91, "perf": 98.5}, "round2": {"comp": 85, "perf": 98}, "source": "import"}	\N	\N	2026-06-05 06:32:26.581	2026-06-08 05:44:29.852	친환경기술그룹	친환경CS1본부	CS1본부 3팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	3b003c17-aecc-4af0-8620-e85bd53fcf7e
9e3e9602-7080-49d0-9ab5-3b24dee1b706	408d92a5-854e-4e8c-ac13-28b81669d4c0	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.41999999999999	\N	{"sum": {"comp": 92.19999999999999, "perf": 96.8}, "final": {"comp": 75.75, "perf": 94}, "round1": {"comp": 99.25, "perf": 98}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.585	2026-06-08 05:44:29.855	엔지니어링그룹	감리본부	기획팀	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	aaf64e93-8104-47a6-b8ae-8ebc3b57f6d6
315bc775-57d9-42c7-a9a5-28a039b03128	4a2b3846-6ab1-4de6-b31c-e9f85414cc4f	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.39999999999999	\N	{"sum": {"comp": 92.25, "perf": 96.75}, "final": {"comp": 92.25, "perf": 96.75}, "round1": {"comp": 92.25, "perf": 96.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.589	2026-06-08 05:44:29.858	친환경기술그룹	\N	\N	\N	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
f4618d46-1b76-434d-b804-2e7734f9d2bb	f48c8ba5-1e4f-4ecc-af12-c9d85ef01f80	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.2475	\N	{"sum": {"comp": 90.92500000000001, "perf": 97.10000000000001}, "final": {"comp": 78, "perf": 94.75}, "round1": {"comp": 96.5, "perf": 98.25}, "round2": {"comp": 90.25, "perf": 96.75}, "source": "import"}	\N	\N	2026-06-05 06:32:26.599	2026-06-08 05:44:29.867	엔지니어링그룹	신재생기술본부	SI팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	09ba8db1-b6c1-4b79-98ab-120e913c71ca
e1da7298-d085-4143-a348-b8a8db60b5af	5712674c-a7f0-4b10-8ebe-7403edc32616	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.12499999999999	\N	{"sum": {"comp": 90.75, "perf": 96.99999999999999}, "final": {"comp": 90.75, "perf": 97}, "round1": {"comp": 90.75, "perf": 97}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.602	2026-06-08 05:44:29.869	친환경기술그룹	친환경SA본부	친환경SA본부1팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6
2fa18f50-e7f7-49af-bd2d-c27d8dd22694	6d97232d-15ef-4875-87b0-7e14aa7e4d99	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.7475	\N	{"sum": {"comp": 92, "perf": 95.92500000000001}, "final": {"comp": 89.75, "perf": 95.75}, "round1": {"comp": 96.5, "perf": 94.75}, "round2": {"comp": 86, "perf": 98}, "source": "import"}	\N	\N	2026-06-05 06:32:26.606	2026-06-08 05:44:29.872	엔지니어링그룹	신재생기술본부	신재생기술2팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf
4aac3141-5a61-4d49-a7ce-71e590f6d16d	cdd7bc48-fb24-415a-899a-502179f35c82	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.6275	\N	{"sum": {"comp": 93, "perf": 95.32499999999999}, "final": {"comp": 93, "perf": 95.5}, "round1": {"comp": 93, "perf": 95.25}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.612	2026-06-08 05:44:29.875	친환경기술그룹	환경평가본부	\N	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
681beb93-412e-4fc9-999a-ed664af5e9c7	6cc02189-3f2d-4c75-aafe-4cad04390909	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.16749999999999	\N	{"sum": {"comp": 92.925, "perf": 94.69999999999999}, "final": {"comp": 94.5, "perf": 95.75}, "round1": {"comp": 92.25, "perf": 94.25}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.62	2026-06-08 05:44:29.881	친환경기술그룹	친환경SA본부	\N	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
e5edae9c-c5f6-4d5c-b5df-07d3a28e5e59	577fc503-13fd-419a-ba7c-d11d9f5ec6e2	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.1375	\N	{"sum": {"comp": 93.69999999999999, "perf": 94.325}, "final": {"comp": 86, "perf": 92.75}, "round1": {"comp": 97, "perf": 95}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.628	2026-06-08 05:44:29.884	건축설계그룹	주거디자인본부	\N	599f0440-4eb5-4d93-83fc-47122cb6ee6b	865a2de0-4663-4402-b05c-81855ba277be	\N
04d3af1f-70fe-4692-aa9a-531de7ab3af2	b62ae5ff-3c66-4630-a9a0-496dc6a698c2	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.05	\N	{"sum": {"comp": 88.8, "perf": 96.3}, "final": {"comp": 82.5, "perf": 93.5}, "round1": {"comp": 91.5, "perf": 97.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.631	2026-06-08 05:44:29.886	엔지니어링그룹	신재생기술본부	신재생기술2팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf
78974f57-35a3-4020-99cb-0b939a378e04	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.8325	\N	{"sum": {"comp": 94.27499999999999, "perf": 96.5}, "final": {"comp": 97.25, "perf": 96.5}, "round1": {"comp": 93, "perf": 96.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.578	2026-06-08 05:44:29.849	친환경기술그룹	친환경CS2본부	\N	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
a2e055fb-ee1c-4ee1-89e7-3c567eacd8b3	11f2f0f1-3e9f-48e5-8dd7-020929dec5fe	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.83249999999998	\N	{"sum": {"comp": 88.775, "perf": 96}, "final": {"comp": 84.75, "perf": 96}, "round1": {"comp": 89.5, "perf": 96}, "round2": {"comp": 90.25, "perf": 96}, "source": "import"}	\N	\N	2026-06-05 06:32:26.648	2026-06-08 05:44:29.899	친환경기술그룹	친환경CS1본부	CS1본부 2팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	086f444d-5222-4cf2-8519-9c2bb56179df
f1c3d39a-c111-44b3-ac62-dcccb64c753b	e0eec138-1189-48c6-a2f8-0357e67fdec6	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.43999999999998	\N	{"sum": {"comp": 88.39999999999999, "perf": 95.6}, "final": {"comp": 78.25, "perf": 90}, "round1": {"comp": 92.75, "perf": 98}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.661	2026-06-08 05:44:29.909	엔지니어링그룹	\N	기술개발팀	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	1073e163-4f5e-46a6-b73e-5d861a10fec9
ef0d0f96-0ea1-4dad-ada4-0acaa88bc71c	52fef0a2-8311-4c7c-b2d8-eb3c41f52544	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.38749999999999	\N	{"sum": {"comp": 96.625, "perf": 92}, "final": {"comp": 96, "perf": 92}, "round1": {"comp": 97.25, "perf": 92}, "round2": {"comp": 96, "perf": 92}, "source": "import"}	\N	\N	2026-06-05 06:32:26.666	2026-06-08 05:44:29.912	친환경기술그룹	친환경CS1본부	CS1본부 3팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	3b003c17-aecc-4af0-8620-e85bd53fcf7e
45bcf0ea-200b-4517-9a76-4943eba1911e	08d4e449-a18a-4a88-a000-16d7c36e6ccc	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.32749999999999	\N	{"sum": {"comp": 82.425, "perf": 98}, "final": {"comp": 84.75, "perf": 98}, "round1": {"comp": 81.75, "perf": 98}, "round2": {"comp": 82, "perf": 98}, "source": "import"}	\N	\N	2026-06-05 06:32:26.672	2026-06-08 05:44:29.915	친환경기술그룹	환경평가본부	환경평가팀	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	05c7c7bc-861a-4160-99bb-1df3c09aaeae
9858207b-ed61-443c-939b-bc386357ac64	6e1ea2ef-2e8d-44d5-8c90-e4ea30c879b7	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.25	\N	{"sum": {"comp": 88, "perf": 95.5}, "final": {"comp": 88, "perf": 95.5}, "round1": {"comp": 88, "perf": 95.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.677	2026-06-08 05:44:29.918	친환경기술그룹	친환경SA본부	친환경SA본부1팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6
732f0062-c4de-4594-90e0-9a687547b5d4	36b4ce11-bba9-442f-9cf6-2d5213bb8bde	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.82499999999999	\N	{"sum": {"comp": 92.3, "perf": 93.05}, "final": {"comp": 86, "perf": 92.35}, "round1": {"comp": 95, "perf": 93.35}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.687	2026-06-08 05:44:29.924	엔지니어링그룹	감리본부	기술팀	2174264a-4640-457b-b2d3-98d7bae6603b	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	26a7e4bc-8e33-4c78-a19a-cb95a8ea393a
8f2c6a1d-c4b8-4e25-86b4-bb81e9651d38	ebbf5119-8e68-4d5c-88ef-d427de1b82ab	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.80749999999999	\N	{"sum": {"comp": 90.02499999999999, "perf": 94}, "final": {"comp": 86, "perf": 94}, "round1": {"comp": 91.75, "perf": 94}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.692	2026-06-08 05:44:29.927	이노베이션그룹	\N	IT개발팀	\N	883bc609-9a46-4736-9905-81d7889675be	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e
788959b3-4fd3-4b40-9890-27f0080625e2	9bececb1-1086-4ecb-814a-7e069f82b4dc	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.6975	\N	{"sum": {"comp": 90.825, "perf": 93.5}, "final": {"comp": 91, "perf": 93.5}, "round1": {"comp": 95, "perf": 93.5}, "round2": {"comp": 83.75, "perf": 93.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.7	2026-06-08 05:44:29.93	친환경기술그룹	친환경SA본부	친환경SA본부2팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	225a963c-263f-4e44-9945-31d2ed537999
705de8b5-9797-4579-a459-de89c1e9c8f3	d023afbf-a84d-482c-ab3b-c17a1329f090	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.68499999999999	\N	{"sum": {"comp": 84.95, "perf": 96}, "final": {"comp": 81.25, "perf": 96}, "round1": {"comp": 87.75, "perf": 96}, "round2": {"comp": 82.75, "perf": 96}, "source": "import"}	\N	\N	2026-06-05 06:32:26.706	2026-06-08 05:44:29.933	친환경기술그룹	환경평가본부	환경평가팀	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	05c7c7bc-861a-4160-99bb-1df3c09aaeae
07f7bc7e-01ea-4226-9661-fe83693dcfa8	74691c87-f233-407e-ac27-0550a33df3fa	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.63	\N	{"sum": {"comp": 85.35, "perf": 95.75}, "final": {"comp": 72.75, "perf": 94}, "round1": {"comp": 90.75, "perf": 96.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.711	2026-06-08 05:44:29.935	엔지니어링그룹	감리본부	기획팀	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	aaf64e93-8104-47a6-b8ae-8ebc3b57f6d6
743b548b-1994-4044-8aaf-f66d72d2d44b	1f182dd0-8430-4e39-9f1e-2bb2f4ce6f5e	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.375	\N	{"sum": {"comp": 86.25, "perf": 95}, "final": {"comp": 86.25, "perf": 95}, "round1": {"comp": 86.25, "perf": 95}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.719	2026-06-08 05:44:29.941	친환경기술그룹	친환경SA본부	친환경SA본부1팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6
9672610f-3f19-473f-8acd-b7a9831d95a4	7c5b293b-5811-4044-95f8-9c900b7438db	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.255	\N	{"sum": {"comp": 86.75, "perf": 98.89999999999999}, "final": {"comp": 86.75, "perf": 97.5}, "round1": {"comp": 86.75, "perf": 99.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.596	2026-06-08 05:44:29.864	엔지니어링그룹	신재생기술본부	SI팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	09ba8db1-b6c1-4b79-98ab-120e913c71ca
39434ea2-046c-4441-9e42-82ea6839179e	3e982676-9e1c-43e1-9c00-99de10b2211c	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.785	\N	{"sum": {"comp": 83.7, "perf": 95.25}, "final": {"comp": 83.75, "perf": 95.25}, "round1": {"comp": 85, "perf": 95.25}, "round2": {"comp": 81.5, "perf": 95.25}, "source": "import"}	\N	\N	2026-06-05 06:32:26.742	2026-06-08 05:44:29.956	친환경기술그룹	친환경CS2본부	CS2본부 1팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	1990a4db-2151-4dd7-bbd0-020566cfef55
abbadcd7-df5e-41ff-8224-56096372c86b	3b54e7fb-2a26-4910-a716-720a1b99e39a	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.68249999999999	\N	{"sum": {"comp": 82.94999999999999, "perf": 95.425}, "final": {"comp": 84, "perf": 95.25}, "round1": {"comp": 82.5, "perf": 95.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.745	2026-06-08 05:44:29.959	친환경기술그룹	친환경SA본부	친환경SA본부1팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6
5983cb49-0f78-4fb2-b2a4-6f49ee370a14	9fa3f3bd-6aea-4905-9fa5-c54e143e64b1	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.55249999999998	\N	{"sum": {"comp": 82.225, "perf": 95.55}, "final": {"comp": 80, "perf": 94.75}, "round1": {"comp": 78, "perf": 94.25}, "round2": {"comp": 90.75, "perf": 98.25}, "source": "import"}	\N	\N	2026-06-05 06:32:26.748	2026-06-08 05:44:29.962	엔지니어링그룹	신재생기술본부	신재생기술2팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf
e4d0757e-8bc7-4515-bb4a-e39fc1678d33	7ee418e4-5b76-4f82-b1e5-6d0e7bb7a5c5	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.40249999999997	\N	{"sum": {"comp": 84.875, "perf": 94.19999999999999}, "final": {"comp": 77, "perf": 90}, "round1": {"comp": 88.25, "perf": 96}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.751	2026-06-08 05:44:29.965	엔지니어링그룹	신재생기술본부	신재생기술3팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	58cc7087-f2c4-42ee-99fa-f2cbffd4a2fd
f951fdae-fd72-41a3-afc5-5b79382006e6	e199f15a-10a1-4e36-94fb-22a5ae12cf0f	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.165	\N	{"sum": {"comp": 84.2, "perf": 94.15}, "final": {"comp": 93.25, "perf": 93.75}, "round1": {"comp": 78.75, "perf": 93.5}, "round2": {"comp": 87.25, "perf": 95.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.761	2026-06-08 05:44:29.974	엔지니어링그룹	신재생기술본부	신재생기술2팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf
f72e39b5-f5ec-4c1d-8c71-07864b7a0044	4c588584-229b-48ce-bbe1-84f54b436ef5	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.1125	\N	{"sum": {"comp": 91.375, "perf": 91}, "final": {"comp": 91, "perf": 91}, "round1": {"comp": 91.75, "perf": 91}, "round2": {"comp": 91, "perf": 91}, "source": "import"}	\N	\N	2026-06-05 06:32:26.763	2026-06-08 05:44:29.977	친환경기술그룹	친환경CS1본부	CS1본부 2팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	086f444d-5222-4cf2-8519-9c2bb56179df
b083d985-9a2f-41fd-af6d-f19d22a67d25	85c1476f-21d9-4e7c-aacd-0c76ffb9013a	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.07249999999999	\N	{"sum": {"comp": 92.175, "perf": 90.6}, "final": {"comp": 92, "perf": 92}, "round1": {"comp": 92.25, "perf": 90}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.769	2026-06-08 05:44:29.982	이노베이션그룹	\N	IT개발팀	\N	883bc609-9a46-4736-9905-81d7889675be	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e
8e8af1a5-27e4-4b44-ad32-5694656afa07	12d9fd3a-d3b0-4553-993e-73e4fbf39de0	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.0625	\N	{"sum": {"comp": 83.27499999999999, "perf": 94.4}, "final": {"comp": 79.25, "perf": 93}, "round1": {"comp": 85, "perf": 95}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.772	2026-06-08 05:44:29.985	엔지니어링그룹	\N	기술영업팀	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	bdb922c7-9b81-4a03-8b39-5a2890b05cec
d4f0de9d-b29a-4fa4-8ad4-a233283aaa09	f09cf015-3fcf-4cf4-92d7-ed5bb3d171da	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	90.72749999999999	\N	{"sum": {"comp": 84.725, "perf": 93.3}, "final": {"comp": 73, "perf": 92.25}, "round1": {"comp": 89.75, "perf": 93.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.778	2026-06-08 05:44:29.988	건축설계그룹	주거디자인본부	\N	599f0440-4eb5-4d93-83fc-47122cb6ee6b	865a2de0-4663-4402-b05c-81855ba277be	\N
c50e82d2-bb42-4fc1-831b-5a5350343a3b	b5471373-688b-4541-b6f0-9a8fc12f1e95	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	90.5675	\N	{"sum": {"comp": 79.875, "perf": 95.15}, "final": {"comp": 93, "perf": 95.75}, "round1": {"comp": 74.25, "perf": 95}, "round2": {"comp": 80.5, "perf": 95}, "source": "import"}	\N	\N	2026-06-05 06:32:26.78	2026-06-08 05:44:29.991	친환경기술그룹	친환경CS2본부	CS2본부 2팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	605cd05b-4bab-4184-b6e2-6d03c489bc7c
cacaf70c-f995-4b81-9689-148dd115520d	288e2eb4-68eb-4d5a-9486-df466fe87807	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	90.14999999999999	\N	{"sum": {"comp": 83.5, "perf": 93}, "final": {"comp": 83.5, "perf": 93}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.784	2026-06-08 05:44:29.994	경영그룹	경영관리본부	\N	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	\N
e9ee4eec-f3be-4ce5-a0a8-435afdb2aaa6	32ede1d8-3b88-40fc-a1fc-dd2ef3c8e0c3	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	90.07499999999999	\N	{"sum": {"comp": 83.25, "perf": 93}, "final": {"comp": 83.25, "perf": 93}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.786	2026-06-08 05:44:29.996	엔지니어링그룹	\N	기술영업팀	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	bdb922c7-9b81-4a03-8b39-5a2890b05cec
9bfe0660-0897-4c16-a2e7-2a1a4522b1ef	712f26c3-9cb1-47e9-b6b6-1907b8e99d93	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	89.725	\N	{"sum": {"comp": 83.25, "perf": 92.5}, "final": {"comp": 83.25, "perf": 92.5}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.801	2026-06-08 05:44:30.005	건축설계그룹	건축디자인본부	\N	48f4d055-6419-49a3-b876-bef1ee4944ea	865a2de0-4663-4402-b05c-81855ba277be	\N
e3d5003d-8997-419b-8739-b0ee5e506fb1	fec8efeb-c6f7-41a9-8a91-147d538ca405	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	89.675	\N	{"sum": {"comp": 80.75, "perf": 93.5}, "final": {"comp": 80.75, "perf": 93.5}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.805	2026-06-08 05:44:30.009	엔지니어링그룹	신재생기술본부	SI팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	09ba8db1-b6c1-4b79-98ab-120e913c71ca
775dac4b-2c33-4b00-8065-b0b4436b3718	6bb2bb8c-364f-49b4-a67d-49b7689facfe	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	89	\N	{"sum": {"comp": 85.5, "perf": 90.5}, "final": {"comp": 85.5, "perf": 90.5}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.809	2026-06-08 05:44:30.012	엔지니어링그룹	감리본부	\N	2174264a-4640-457b-b2d3-98d7bae6603b	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	\N
d6dd9f31-a2c0-4d0d-994b-1f01066bd5e2	6ce2d0dc-674f-4c97-81a8-cf58dc9d4f16	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.99499999999999	\N	{"sum": {"comp": 84.375, "perf": 90.975}, "final": {"comp": 76.5, "perf": 91.5}, "round1": {"comp": 87.75, "perf": 90.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.813	2026-06-08 05:44:30.015	건축설계그룹	건축디자인본부	\N	48f4d055-6419-49a3-b876-bef1ee4944ea	865a2de0-4663-4402-b05c-81855ba277be	\N
9d8a42b9-60ae-42fa-836c-d5a4becee272	03f5689a-8b5d-4e64-9c83-68d941369255	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.69999999999999	\N	{"sum": {"comp": 81, "perf": 92}, "final": {"comp": 81, "perf": 92}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.816	2026-06-08 05:44:30.018	친환경기술그룹	\N	기술전략팀	\N	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	87ece94d-728f-46a2-bf07-c06dc3d8086e
e50b582b-91ed-4960-a918-897b53f970e3	8132b9b8-7f4b-448d-af5f-bb4086167cc6	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.43249999999999	\N	{"sum": {"comp": 74.8, "perf": 94.27499999999999}, "final": {"comp": 68.5, "perf": 93.75}, "round1": {"comp": 77.5, "perf": 94.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.826	2026-06-08 05:44:30.024	건축설계그룹	친환경디자인본부	\N	4d813556-b97d-4b6d-836c-046d4842259a	865a2de0-4663-4402-b05c-81855ba277be	\N
cc155b03-a001-487f-9924-4f215074ce36	7f1892b1-58ac-46a1-8d6b-ac86151ea107	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.16499999999999	\N	{"sum": {"comp": 78.75, "perf": 92.2}, "final": {"comp": 78.75, "perf": 91.5}, "round1": {"comp": 78.75, "perf": 92.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.828	2026-06-08 05:44:30.027	경영그룹	경영관리본부	재무팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	98faf6ef-81ff-40d8-8b20-3f08cedd9553
abd90bb7-eada-49d6-a1b6-4d939665072a	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.05	\N	{"sum": {"comp": 83.5, "perf": 90}, "final": {"comp": 83.5, "perf": 90}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.831	2026-06-08 05:44:30.03	이노베이션그룹	\N	IT개발팀	\N	883bc609-9a46-4736-9905-81d7889675be	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e
036d65f6-c03e-4460-9ca2-ab2cc579a6f2	54f07fc1-fc75-45ec-8ed0-66ca82ca37df	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	87.89999999999999	\N	{"sum": {"comp": 83, "perf": 90}, "final": {"comp": 83, "perf": 90}, "round1": {"comp": 85.25, "perf": 90}, "round2": {"comp": 79.25, "perf": 90}, "source": "import"}	\N	\N	2026-06-05 06:32:26.918	2026-06-08 05:44:30.039	친환경기술그룹	친환경CS2본부	CS2본부2팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	605cd05b-4bab-4184-b6e2-6d03c489bc7c
18e9261a-9feb-4a5d-b01e-b2fc6ba2a510	37a5cc7f-1f4d-4eeb-accb-3b918a49dbf3	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	87.24999999999999	\N	{"sum": {"comp": 79.725, "perf": 90.475}, "final": {"comp": 75, "perf": 91}, "round1": {"comp": 81.75, "perf": 90.25}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.924	2026-06-08 05:44:30.041	건축설계그룹	건축디자인본부	\N	48f4d055-6419-49a3-b876-bef1ee4944ea	865a2de0-4663-4402-b05c-81855ba277be	\N
b90c9e91-78f7-4846-814f-6c4f23eac9ab	04774821-15c3-488b-bb1e-59aa57924a7c	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	86.65	\N	{"sum": {"comp": 80, "perf": 89.5}, "final": {"comp": 80, "perf": 89.5}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.001	2026-06-08 05:44:30.05	엔지니어링그룹	신재생기술본부	\N	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	\N
84325f5c-d63f-4c0f-a800-83fea94a04fc	31c19c79-80d9-4df4-a3ea-8fb779e44355	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	85.99999999999999	\N	{"sum": {"comp": 72, "perf": 92}, "final": {"comp": 72, "perf": 92}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.008	2026-06-08 05:44:30.053	건축설계그룹	주거디자인본부	\N	599f0440-4eb5-4d93-83fc-47122cb6ee6b	865a2de0-4663-4402-b05c-81855ba277be	\N
d96a12dc-a7a7-4aec-8188-1f028a1e053d	f3981680-513a-4548-80b6-0f3cb3559bbe	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	85.92749999999998	\N	{"sum": {"comp": 77.82499999999999, "perf": 89.39999999999999}, "final": {"comp": 76.25, "perf": 88}, "round1": {"comp": 78.5, "perf": 90}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.011	2026-06-08 05:44:30.056	이노베이션그룹	\N	IT개발팀	\N	883bc609-9a46-4736-9905-81d7889675be	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e
f27bcd9c-6f98-4447-b00a-acf40c59c297	b4b9012d-448e-4cc5-ada4-54a9095bd295	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	85.49499999999999	\N	{"sum": {"comp": 79.65, "perf": 88}, "final": {"comp": 84.25, "perf": 88}, "round1": {"comp": 78.5, "perf": 88}, "round2": {"comp": 78.5, "perf": 88}, "source": "import"}	\N	\N	2026-06-05 06:32:27.013	2026-06-08 05:44:30.058	친환경기술그룹	친환경CS1본부	CS1본부 1팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	d59d8d16-d9ff-4195-9ddd-be096a156cad
98dd114c-29f9-482c-be0b-d65c0ad830bc	2ab318ae-028d-449d-ae52-3e42b0ff6608	741257eb-3aaa-46dc-b4ca-720d430e3b9d	S	96.875	\N	{"sum": {"comp": 97.75, "perf": 96.5}, "final": {"comp": 97.75, "perf": 96.5}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.557	2026-06-08 05:44:29.83	친환경기술그룹	\N	\N	\N	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N
6fe6d1da-aadd-4d22-a563-672e2a4d44b0	d240ee30-e2e1-4778-96d7-7fb4aa7f961f	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	95.35499999999999	\N	{"sum": {"comp": 93.15, "perf": 96.3}, "final": {"comp": 80, "perf": 93.5}, "round1": {"comp": 98.5, "perf": 97}, "round2": {"comp": 93, "perf": 97}, "source": "import"}	\N	\N	2026-06-05 06:32:26.593	2026-06-08 05:44:29.861	엔지니어링그룹	신재생기술본부	SI팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	09ba8db1-b6c1-4b79-98ab-120e913c71ca
5f29c81c-25fd-4450-8d9e-88a61281a9ab	8bef685e-ddb4-4f43-aab4-8f8178c6203c	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	94.43749999999999	\N	{"sum": {"comp": 86.82499999999999, "perf": 97.69999999999999}, "final": {"comp": 80, "perf": 93.5}, "round1": {"comp": 89.75, "perf": 99.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.617	2026-06-08 05:44:29.878	엔지니어링그룹	감리본부	지원팀	2174264a-4640-457b-b2d3-98d7bae6603b	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	26a7e4bc-8e33-4c78-a19a-cb95a8ea393a
60656ab2-5bcc-460f-b890-dabb3ba54a7f	623bf8c3-e457-4090-acf4-bb77ca58c427	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.04999999999998	\N	{"sum": {"comp": 81.225, "perf": 90.975}, "final": {"comp": 74.75, "perf": 91.5}, "round1": {"comp": 84, "perf": 90.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.912	2026-06-08 05:44:30.033	건축설계그룹	건축디자인본부	\N	48f4d055-6419-49a3-b876-bef1ee4944ea	865a2de0-4663-4402-b05c-81855ba277be	\N
6839e760-771d-446e-b5f3-5733d973632e	cb0bacd9-6489-4b1e-97a9-30edad5f87ac	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	86.9875	\N	{"sum": {"comp": 77.625, "perf": 91}, "final": {"comp": 72.25, "perf": 90}, "round1": {"comp": 83, "perf": 92}, "round2": {"comp": 72.25, "perf": 90}, "source": "import"}	\N	\N	2026-06-05 06:32:26.995	2026-06-08 05:44:30.044	경영그룹	경영관리본부	경영기획팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc
44e1991c-0659-4526-903e-c7d4edc42ded	217911ce-0ac9-4233-a7f5-6f3cddbfa998	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	84.47	\N	{"sum": {"comp": 80.55, "perf": 86.15}, "final": {"comp": 76, "perf": 90}, "round1": {"comp": 82.5, "perf": 84.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.019	2026-06-08 05:44:30.064	이노베이션그룹	\N	IT개발팀	\N	883bc609-9a46-4736-9905-81d7889675be	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e
42d9ecb3-a9c2-4d29-a216-4278e81b1bce	9d1fec38-7541-424a-8f9e-8c93d15e34a7	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	84.05250000000001	\N	{"sum": {"comp": 79.97500000000001, "perf": 85.80000000000001}, "final": {"comp": 85.75, "perf": 87}, "round1": {"comp": 78.25, "perf": 85.5}, "round2": {"comp": 79, "perf": 85.5}, "source": "import"}	\N	\N	2026-06-05 06:32:27.026	2026-06-08 05:44:30.067	친환경기술그룹	친환경SA본부	친환경SA본부2팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	225a963c-263f-4e44-9945-31d2ed537999
1810f9c5-385b-43fe-9c78-ba4ff0a1f403	607cbeea-69ca-4187-b70a-45dc07667574	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	83.594	\N	{"sum": {"comp": 68.25, "perf": 90.17}, "final": {"comp": 70, "perf": 90.1}, "round1": {"comp": 67.5, "perf": 90.2}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.032	2026-06-08 05:44:30.073	경영그룹	경영관리본부	경영기획팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc
f25545cc-9d4c-4572-ac9e-98d27d08a6e5	7bbe4d91-ffaf-49cc-b3c7-e6011162fba2	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	83.08999999999999	\N	{"sum": {"comp": 67.55, "perf": 89.75}, "final": {"comp": 83.5, "perf": 88.5}, "round1": {"comp": 63, "perf": 91}, "round2": {"comp": 64.5, "perf": 88.5}, "source": "import"}	\N	\N	2026-06-05 06:32:27.038	2026-06-08 05:44:30.079	친환경기술그룹	친환경CS2본부	CS2본부 3팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8007ed4f-a263-472b-bd84-1706766b6d07
52d1159b-6450-4f04-8cdd-2e530915b543	cede320f-e362-41be-8c92-b1241b064b3d	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	82.10499999999999	\N	{"sum": {"comp": 87.6, "perf": 79.75}, "final": {"comp": 83, "perf": 79.75}, "round1": {"comp": 97, "perf": 79.75}, "round2": {"comp": 75, "perf": 79.75}, "source": "import"}	\N	\N	2026-06-05 06:32:27.042	2026-06-08 05:44:30.081	친환경기술그룹	친환경CS2본부	LEED팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8c544a7b-bc1d-4dbd-b180-a653302aaa50
8c3b5424-b603-450f-99f5-efb45130d57b	8065ee7b-0e27-4d06-952a-58d0c65b6bd1	741257eb-3aaa-46dc-b4ca-720d430e3b9d	D	76.925	\N	{"sum": {"comp": 76.75, "perf": 77}, "final": {"comp": 76.75, "perf": 77}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.044	2026-06-08 05:44:30.084	이노베이션그룹	\N	연구팀	\N	883bc609-9a46-4736-9905-81d7889675be	c509500f-387f-4b10-ac8b-a074adaa595a
9c473b1e-ba9c-46fa-b185-7e732ec1bad7	718a8acf-0790-46e5-84cb-5620338dba3d	741257eb-3aaa-46dc-b4ca-720d430e3b9d	D	75.7125	\N	{"sum": {"comp": 49.375, "perf": 87}, "final": {"comp": 49, "perf": 86.5}, "round1": {"comp": 49.75, "perf": 87.5}, "round2": {"comp": 49, "perf": 86.5}, "source": "import"}	\N	\N	2026-06-05 06:32:27.052	2026-06-08 05:44:30.09	경영그룹	경영관리본부	재무팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	729bf597-4cfc-4269-9d1b-8d4fba27939c
e89f0b62-3e43-4fc8-98a5-16886e59746e	21c58b49-a96d-4d93-be1f-3920f9f7e8e9	741257eb-3aaa-46dc-b4ca-720d430e3b9d	D	71.44999999999999	\N	{"sum": {"comp": 72.5, "perf": 71}, "final": {"comp": 72.5, "perf": 71}, "round1": null, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:27.059	2026-06-08 05:44:30.093	건축설계그룹	친환경디자인본부	\N	4d813556-b97d-4b6d-836c-046d4842259a	865a2de0-4663-4402-b05c-81855ba277be	\N
c1fb3d7d-25cb-42ec-b323-ea5c24c65f2c	36bb4320-d3a2-4ca0-a7d7-5b855553c743	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.90499999999999	\N	{"sum": {"comp": 83.3, "perf": 98.45}, "final": {"comp": 80.5, "perf": 97.75}, "round1": {"comp": 84.5, "perf": 98.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.642	2026-06-08 05:44:29.893	건축설계그룹	친환경디자인본부	\N	4d813556-b97d-4b6d-836c-046d4842259a	865a2de0-4663-4402-b05c-81855ba277be	\N
40c33b4a-c8f6-48d3-a29e-5d8f39f19763	54052507-656a-4f3b-a00a-1ff03e3c7e68	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.83	\N	{"sum": {"comp": 91.1, "perf": 95}, "final": {"comp": 90.5, "perf": 95}, "round1": {"comp": 89.75, "perf": 95}, "round2": {"comp": 93.75, "perf": 95}, "source": "import"}	\N	\N	2026-06-05 06:32:26.651	2026-06-08 05:44:29.902	친환경기술그룹	친환경CS1본부	CS1본부 1팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	d59d8d16-d9ff-4195-9ddd-be096a156cad
a5f2650f-39bf-4ae1-8a96-96b7c9ff58f9	d7a79869-6548-46a1-96d8-c6913a425095	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.9375	\N	{"sum": {"comp": 88.125, "perf": 95}, "final": {"comp": 89, "perf": 95}, "round1": {"comp": 89.5, "perf": 95}, "round2": {"comp": 85.25, "perf": 95}, "source": "import"}	\N	\N	2026-06-05 06:32:26.68	2026-06-08 05:44:29.921	친환경기술그룹	환경평가본부	환경평가팀	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	05c7c7bc-861a-4160-99bb-1df3c09aaeae
f17e14fc-4af8-4b35-a513-623ede759f83	55868d8b-c8cb-433e-a33d-49df056a3550	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.38499999999999	\N	{"sum": {"comp": 83.95, "perf": 96}, "final": {"comp": 82, "perf": 96}, "round1": {"comp": 84.25, "perf": 96}, "round2": {"comp": 84.75, "perf": 96}, "source": "import"}	\N	\N	2026-06-05 06:32:26.715	2026-06-08 05:44:29.939	친환경기술그룹	환경평가본부	환경평가팀	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	05c7c7bc-861a-4160-99bb-1df3c09aaeae
de5bb0ed-1fb4-46e5-ac9e-50ee91f50dd6	927f2cd9-fdd8-4b3c-a49c-faf168d8d436	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.36249999999998	\N	{"sum": {"comp": 87.375, "perf": 94.5}, "final": {"comp": 86.75, "perf": 94.5}, "round1": {"comp": 88, "perf": 94.5}, "round2": {"comp": 86.75, "perf": 94.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.727	2026-06-08 05:44:29.947	친환경기술그룹	친환경CS2본부	CS2본부 1팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	1990a4db-2151-4dd7-bbd0-020566cfef55
7208951a-098d-4038-a01c-11cd65d5f913	c4c835c6-4697-4cc8-a1ae-0c288483e80b	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.82249999999999	\N	{"sum": {"comp": 84.175, "perf": 95.1}, "final": {"comp": 82.75, "perf": 94}, "round1": {"comp": 84.25, "perf": 95}, "round2": {"comp": 85, "perf": 96}, "source": "import"}	\N	\N	2026-06-05 06:32:26.736	2026-06-08 05:44:29.953	경영그룹	경영관리본부	경영기획팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc
43ff270e-3d76-4d10-9d4d-833c45196060	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.387	\N	{"sum": {"comp": 84.1, "perf": 94.50999999999999}, "final": {"comp": 83.75, "perf": 92.2}, "round1": {"comp": 84.25, "perf": 95.5}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.754	2026-06-08 05:44:29.967	경영그룹	경영관리본부	인사총무팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	729bf597-4cfc-4269-9d1b-8d4fba27939c
5f780964-63b2-4fb5-9e58-133311b3e98e	0750af9d-98c7-48e7-9fd8-71962bc630dc	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	89.96249999999998	\N	{"sum": {"comp": 83.57499999999999, "perf": 92.69999999999999}, "final": {"comp": 80.25, "perf": 92}, "round1": {"comp": 85, "perf": 93}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.793	2026-06-08 05:44:29.999	건축설계그룹	주거디자인본부	\N	599f0440-4eb5-4d93-83fc-47122cb6ee6b	865a2de0-4663-4402-b05c-81855ba277be	\N
32e777cb-02c3-40cc-b85c-d7a8c9a40f2f	a03c86dc-2e10-439c-89ee-e30ec5943ffd	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.49	\N	{"sum": {"comp": 73.3, "perf": 95}, "final": {"comp": 84.75, "perf": 95.5}, "round1": {"comp": 68, "perf": 94.5}, "round2": {"comp": 74.5, "perf": 95.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.819	2026-06-08 05:44:30.02	친환경기술그룹	친환경CS2본부	CS2본부3팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8007ed4f-a263-472b-bd84-1706766b6d07
c61e1df3-b16e-4f96-adb7-6eaecba3096e	f74dc4d0-0afe-4040-8b22-0d69a5140a53	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	86.97999999999999	\N	{"sum": {"comp": 76.2, "perf": 91.6}, "final": {"comp": 77.25, "perf": 91.25}, "round1": {"comp": 75.75, "perf": 91.75}, "round2": null, "source": "import"}	\N	\N	2026-06-05 06:32:26.997	2026-06-08 05:44:30.047	경영그룹	경영관리본부	재무팀	c3291603-7d1d-4574-865d-36dc668d4148	7ab6895d-4d5b-43c2-b956-6df79ed2af29	98faf6ef-81ff-40d8-8b20-3f08cedd9553
c25b926a-a8fd-4122-991d-35ecdefbf1b2	75bbaacb-301b-40ca-ab6e-28dac5a4b42c	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	84.63749999999999	\N	{"sum": {"comp": 69.5, "perf": 91.125}, "final": {"comp": 51.5, "perf": 85}, "round1": {"comp": 87.5, "perf": 97.25}, "round2": {"comp": 51.5, "perf": 85}, "source": "import"}	\N	\N	2026-06-05 06:32:27.016	2026-06-08 05:44:30.061	친환경기술그룹	환경평가본부	환경평가팀	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	05c7c7bc-861a-4160-99bb-1df3c09aaeae
95dfa92e-aebe-403e-a3b3-64c83e08a045	4fda1bc3-04fc-4ea6-bc53-747a57ffcf7d	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	83.8725	\N	{"sum": {"comp": 80.075, "perf": 85.5}, "final": {"comp": 86.25, "perf": 85.5}, "round1": {"comp": 77.5, "perf": 85.5}, "round2": {"comp": 80.25, "perf": 85.5}, "source": "import"}	\N	\N	2026-06-05 06:32:27.029	2026-06-08 05:44:30.07	친환경기술그룹	친환경CS1본부	CS1본부 1팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	d59d8d16-d9ff-4195-9ddd-be096a156cad
552bbb38-6545-4f95-87d7-cdcb9edf4db3	b1787d61-70e1-4ba0-9996-021777ee00bc	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.94	\N	{"sum": {"comp": 86.8, "perf": 97}, "final": {"comp": 93.5, "perf": 97}, "round1": {"comp": 85.5, "perf": 97}, "round2": {"comp": 84.5, "perf": 97}, "source": "import"}	\N	\N	2026-06-05 06:32:26.635	2026-06-08 05:44:29.89	친환경기술그룹	친환경CS2본부	CS2본부 1팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	1990a4db-2151-4dd7-bbd0-020566cfef55
298fa2aa-95ec-4695-bdc0-bd820c9c1469	dc5d78f9-7141-4884-bf26-9aae9138acc2	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.90249999999999	\N	{"sum": {"comp": 83.175, "perf": 98.5}, "final": {"comp": 74, "perf": 95}, "round1": {"comp": 79.75, "perf": 99}, "round2": {"comp": 95, "perf": 100}, "source": "import"}	\N	\N	2026-06-05 06:32:26.645	2026-06-08 05:44:29.896	엔지니어링그룹	신재생기술본부	신재생기술1팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	9d111826-cc3a-4445-b5c6-817c78ef82d0
3a4c1260-6a73-4283-a998-440ad2973251	88dc1c04-2096-4961-b102-db563ecbc8cb	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	93.71499999999999	\N	{"sum": {"comp": 89.55, "perf": 95.5}, "final": {"comp": 87.75, "perf": 95.5}, "round1": {"comp": 90, "perf": 95.5}, "round2": {"comp": 90, "perf": 95.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.656	2026-06-08 05:44:29.906	친환경기술그룹	친환경CS2본부	CS2본부 1팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	1990a4db-2151-4dd7-bbd0-020566cfef55
39a8ae1f-1cf6-4df8-9936-499539a95af2	f7733eee-5b8c-4225-ab0d-0337f1a039af	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.3675	\N	{"sum": {"comp": 88.325, "perf": 94.10000000000001}, "final": {"comp": 88.25, "perf": 94.5}, "round1": {"comp": 92, "perf": 94}, "round2": {"comp": 82.25, "perf": 94}, "source": "import"}	\N	\N	2026-06-05 06:32:26.723	2026-06-08 05:44:29.944	친환경기술그룹	친환경CS1본부	CS1본부 2팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	086f444d-5222-4cf2-8519-9c2bb56179df
70ca3ecd-1e08-465c-9c1c-1a425ed024ac	f3e41b5f-d468-4b20-a8ef-79d124ac8e96	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	92.1875	\N	{"sum": {"comp": 83.525, "perf": 95.89999999999999}, "final": {"comp": 91.75, "perf": 96.5}, "round1": {"comp": 79.5, "perf": 95.75}, "round2": {"comp": 84.75, "perf": 95.75}, "source": "import"}	\N	\N	2026-06-05 06:32:26.732	2026-06-08 05:44:29.95	친환경기술그룹	친환경CS2본부	CS2본부3팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8007ed4f-a263-472b-bd84-1706766b6d07
c3873dfc-36b8-4c1f-b7d7-dde3222c4e85	ac4b09ed-bb0b-4179-96ea-b697ebb8d7d7	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.2675	\N	{"sum": {"comp": 79.35000000000001, "perf": 96.375}, "final": {"comp": 84.5, "perf": 96.75}, "round1": {"comp": 79, "perf": 96}, "round2": {"comp": 76.5, "perf": 96.75}, "source": "import"}	\N	\N	2026-06-05 06:32:26.758	2026-06-08 05:44:29.97	친환경기술그룹	친환경CS2본부	CS2본부3팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8007ed4f-a263-472b-bd84-1706766b6d07
3604c68d-a0b1-47e6-915c-0297a083b8c9	ce67c707-40b5-4157-967b-2959a0026406	741257eb-3aaa-46dc-b4ca-720d430e3b9d	A	91.07249999999999	\N	{"sum": {"comp": 83.075, "perf": 94.5}, "final": {"comp": 73.5, "perf": 93}, "round1": {"comp": 83.5, "perf": 94.5}, "round2": {"comp": 88.75, "perf": 95.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.766	2026-06-08 05:44:29.98	엔지니어링그룹	신재생기술본부	신재생기술1팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	9d111826-cc3a-4445-b5c6-817c78ef82d0
e521ec98-72ba-4db6-b87a-ea7b5640abbe	2eba90a7-6da6-4b72-b346-9bd709aebd67	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	89.865	\N	{"sum": {"comp": 79.75, "perf": 94.2}, "final": {"comp": 83, "perf": 93.75}, "round1": {"comp": 75.75, "perf": 93.75}, "round2": {"comp": 84.25, "perf": 95.25}, "source": "import"}	\N	\N	2026-06-05 06:32:26.796	2026-06-08 05:44:30.002	엔지니어링그룹	신재생기술본부	신재생기술2팀	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf
6f004936-1d9c-4dc3-866e-c7d0c1573c87	dd756554-b2d7-4731-b812-2ada2b4e1222	741257eb-3aaa-46dc-b4ca-720d430e3b9d	B	88.00500000000001	\N	{"sum": {"comp": 80.9, "perf": 91.05000000000001}, "final": {"comp": 88.25, "perf": 92}, "round1": {"comp": 80, "perf": 91}, "round2": {"comp": 77.5, "perf": 90.5}, "source": "import"}	\N	\N	2026-06-05 06:32:26.915	2026-06-08 05:44:30.036	친환경기술그룹	친환경CS2본부	LEED팀	3692e6dd-0e49-4c7d-a389-26238b2f48ba	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	8c544a7b-bc1d-4dbd-b180-a653302aaa50
c0f60efb-2db8-43d8-90b8-8f6ea6d64ed6	6012b708-4bd6-4784-86f3-673c86bb01f3	741257eb-3aaa-46dc-b4ca-720d430e3b9d	C	83.57	\N	{"sum": {"comp": 77.89999999999999, "perf": 86}, "final": {"comp": 81.5, "perf": 86}, "round1": {"comp": 77, "perf": 86}, "round2": {"comp": 77, "perf": 86}, "source": "import"}	\N	\N	2026-06-05 06:32:27.035	2026-06-08 05:44:30.076	친환경기술그룹	친환경CS1본부	CS1본부 1팀	20dbae03-1f71-4e92-b9e5-00189b8a954f	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	d59d8d16-d9ff-4195-9ddd-be096a156cad
b4230a8f-6ab2-41a9-aeca-e302bfeb31b1	cbeb8d5a-1108-433c-93ab-f36f43b299a9	741257eb-3aaa-46dc-b4ca-720d430e3b9d	D	76.24	\N	{"sum": {"comp": 63.675, "perf": 81.625}, "final": {"comp": 74.25, "perf": 81.75}, "round1": {"comp": 60, "perf": 81.5}, "round2": {"comp": 62.75, "perf": 81.75}, "source": "import"}	\N	\N	2026-06-05 06:32:27.049	2026-06-08 05:44:30.087	친환경기술그룹	친환경SA본부	친환경SA본부2팀	89428ad4-084d-4c3a-ad65-e7f3505783ea	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	225a963c-263f-4e44-9945-31d2ed537999
\.


--
-- Data for Name: evaluations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluations (id, cycle_id, evaluator_id, evaluatee_id, type, round, status, total_score, final_grade, overall_grade, overall_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: grade_pools; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grade_pools (id, cycle_id, group_id, tier, s_ratio, a_ratio, b_ratio, c_ratio, d_ratio) FROM stdin;
\.


--
-- Data for Name: group_performances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.group_performances (id, group_id, cycle_id, revenue, orders, profit, achievement_rate, tier, created_at) FROM stdin;
\.


--
-- Data for Name: kpi_category_policies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpi_category_policies (id, "position", allowed, created_at, updated_at) FROM stdin;
794abbd1-a2b8-414a-b9b7-cfa648d18a66	ceo	["revenue", "construction", "orders", "collaboration", "development"]	2026-06-04 04:11:38.305	2026-06-05 05:44:30.762
8d3b40df-fbe0-4e77-a596-c8a1251a91cf	vice_president	["revenue", "construction", "orders", "collaboration", "development"]	2026-06-04 04:11:38.308	2026-06-05 05:44:30.765
00038406-c208-46e4-bda2-d8c1cdc3dc6d	executive	["revenue", "construction", "orders", "collaboration", "development"]	2026-06-04 04:11:38.31	2026-06-05 05:44:30.766
39498159-774d-4948-842a-5810f48a6816	director	["revenue", "construction", "orders", "collaboration", "development"]	2026-06-04 04:11:38.312	2026-06-05 05:44:30.768
a1f40bff-591c-43a3-a317-0557132bb374	division_head	["revenue", "construction", "orders", "collaboration", "development"]	2026-06-04 04:11:38.314	2026-06-05 05:44:30.77
b47cbca0-8b4b-473b-bab1-cb7616eb9308	principal	["construction", "collaboration", "development"]	2026-06-04 04:11:38.325	2026-06-05 05:44:30.775
946a68dd-e17a-4e8d-901f-09bef8bc34a9	chief	["construction", "collaboration", "development"]	2026-06-04 04:11:38.328	2026-06-05 05:44:30.778
90b30570-c358-4da7-9978-ac6c8dd89f40	senior	["construction", "collaboration", "development"]	2026-06-04 04:11:38.33	2026-06-05 05:44:30.78
e86e2e92-52d6-4982-82a8-84ced17c2197	pro	["construction", "collaboration", "development"]	2026-06-04 04:11:38.333	2026-06-05 05:44:30.782
\.


--
-- Data for Name: kpi_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpi_scores (id, evaluation_id, kpi_id, achievement_rate, grade, score, weight, self_note, actual_amount, reviewer_note) FROM stdin;
\.


--
-- Data for Name: kpi_snapshots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpi_snapshots (id, cycle_id, user_id, label, data, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: kpi_template_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpi_template_items (id, template_id, category, "group", sample_strategy, default_measure_type, default_weight, is_qualitative) FROM stdin;
\.


--
-- Data for Name: kpi_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpi_templates (id, cycle_id, job_level, created_at) FROM stdin;
\.


--
-- Data for Name: kpis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kpis (id, user_id, cycle_id, category, "group", core_strategy, csf, title, measure_method, measure_type, target_value, weight, is_qualitative, grading, parent_kpi_id, status, reject_reason, created_at, updated_at, grading_criteria, target_text, use_absolute_amount) FROM stdin;
\.


--
-- Data for Name: midterm_reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.midterm_reviews (id, cycle_id, evaluatee_id, status, self_note, self_submitted_at, reviewer_id, reviewer_note, confirmed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: monthly_performances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.monthly_performances (id, cycle_id, department_id, year, month, category, target_amount, actual_amount, entered_by_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, payload, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: permission_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permission_config (id, matrix, nav_visibility, updated_at, updated_by_id) FROM stdin;
\.


--
-- Data for Name: position_defs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.position_defs (id, code, label, sort_order, is_management, default_role, default_scope, default_job_level, is_system, is_active, created_at, updated_at) FROM stdin;
bfc8490e-c288-4590-b543-b93a7103133a	ceo	대표이사	10	t	division_head	group	division_head	t	t	2026-06-05 05:44:30.128	2026-06-05 05:44:30.128
c3620c2b-5cc0-4676-989d-60a905b1c621	vice_president	부대표	20	t	division_head	group	division_head	t	t	2026-06-05 05:44:30.132	2026-06-05 05:44:30.132
741a2d5a-db96-46c1-b505-398e77e3ae63	executive	상무	30	t	division_head	group	division_head	t	t	2026-06-05 05:44:30.133	2026-06-05 05:44:30.133
f9faa062-a8a2-49e4-906b-3b78763eca8c	director	이사	40	t	division_head	group	division_head	t	t	2026-06-05 05:44:30.135	2026-06-05 05:44:30.135
b281202e-a005-46fa-844e-9acf328d6aef	division_head	본부장	50	t	division_head	division	division_head	t	t	2026-06-05 05:44:30.137	2026-06-05 05:44:30.137
29ea5d61-5090-4a79-a72f-df56a955a326	chief	책임	80	f	employee	self	senior_plus	t	t	2026-06-05 05:44:30.153	2026-06-05 05:44:30.153
76b9f40e-2bde-49fd-9108-04c0ac301150	senior	선임	90	f	employee	self	senior_minus	t	t	2026-06-05 05:44:30.155	2026-06-05 05:44:30.155
91173e4f-f2a4-4dde-bb6d-773d864ae20a	pro	프로	100	f	employee	self	senior_minus	t	t	2026-06-05 05:44:30.158	2026-06-05 05:44:30.158
ecc0b0e6-1b6a-48af-b997-814766670538	principal	수석	70	t	employee	self	senior_plus	t	t	2026-06-05 05:44:30.148	2026-06-05 06:05:23.093
ab2f6ec6-a6ed-4d4e-8580-03426b2fedfa	president	사장	15	t	division_head	group	division_head	t	t	2026-06-07 23:40:29.632	2026-06-07 23:40:29.632
\.


--
-- Data for Name: rebaseline_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rebaseline_requests (id, cycle_id, evaluatee_id, reason, items, status, reviewer_id, review_comment, reviewed_at, applied_snapshot_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reminder_dispatches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reminder_dispatches (id, cycle_id, phase, "offset", recipients, dispatched_at) FROM stdin;
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, kpi_id, quarter, kind, content, author_id, created_at) FROM stdin;
\.


--
-- Data for Name: rule_sets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule_sets (id, cycle_id, grade_scale, grading_scales, pool_ratios, raise_rates, weight_policy, created_at, updated_at) FROM stdin;
3a472b0b-1ee9-4ccb-b614-5f7d4a1bbd5a	\N	[{"max": 100, "min": 96, "grade": "S"}, {"max": 95, "min": 91, "grade": "A"}, {"max": 90, "min": 85, "grade": "B"}, {"max": 84, "min": 80, "grade": "C"}, {"max": 79, "min": 0, "grade": "D"}]	{"rate": [{"grade": "S", "maxRate": null, "minRate": 110.0001}, {"grade": "A", "maxRate": 110, "minRate": 101}, {"grade": "B", "maxRate": 100, "minRate": 100}, {"grade": "C", "maxRate": 99, "minRate": 90}, {"grade": "D", "maxRate": 89.9999, "minRate": 0}], "amount": [{"grade": "S", "maxRate": null, "minRate": 110.0001}, {"grade": "A", "maxRate": 110, "minRate": 101}, {"grade": "B", "maxRate": 100, "minRate": 100}, {"grade": "C", "maxRate": 99, "minRate": 90}, {"grade": "D", "maxRate": 89.9999, "minRate": 0}]}	{"poor": {"A": 7, "B": 60, "C": 25, "D": 5, "S": 3}, "standard": {"A": 10, "B": 60, "C": 20, "D": 5, "S": 5}, "excellent": {"A": 20, "B": 50, "C": 15, "D": 5, "S": 10}}	{"A": 5, "B": 3, "C": 1, "D": 0, "S": 7}	{"gradeScale": [{"grade": "S", "minScore": 96}, {"grade": "A", "minScore": 90}, {"grade": "B", "minScore": 80}, {"grade": "C", "minScore": 70}, {"grade": "D", "minScore": 0}], "groupTierBonus": {"poor": -1, "standard": 0, "excellent": 2}, "sourcePriority": "import", "totalMustEqual": 100, "kpiGroupWeights": {"performance_core": 80, "collaboration_growth": 20}, "perfCompWeights": {"comp": 0, "perf": 1}, "evaluatorWeights": {"ceo": 0.2, "teamLeader": 0.5, "divisionHead": 0.3}, "competencyIncluded": false, "qualitativeMaxPercent": 30, "stageExceptionWeights": {"ex2Final": 0.3, "ex2Round1": 0.7}}	2026-06-05 05:44:30.809	2026-06-05 05:44:30.809
853b514e-2b2d-4ac6-98ef-5f13837f8c90	\N	[{"max": 100, "min": 96, "grade": "S"}, {"max": 95, "min": 91, "grade": "A"}, {"max": 90, "min": 85, "grade": "B"}, {"max": 84, "min": 80, "grade": "C"}, {"max": 79, "min": 0, "grade": "D"}]	{"rate": [{"grade": "S", "maxRate": null, "minRate": 110.0001}, {"grade": "A", "maxRate": 110, "minRate": 101}, {"grade": "B", "maxRate": 100, "minRate": 100}, {"grade": "C", "maxRate": 99, "minRate": 90}, {"grade": "D", "maxRate": 89.9999, "minRate": 0}], "amount": [{"grade": "S", "maxRate": null, "minRate": 110.0001}, {"grade": "A", "maxRate": 110, "minRate": 101}, {"grade": "B", "maxRate": 100, "minRate": 100}, {"grade": "C", "maxRate": 99, "minRate": 90}, {"grade": "D", "maxRate": 89.9999, "minRate": 0}]}	{"poor": {"A": 7, "B": 60, "C": 25, "D": 5, "S": 3}, "standard": {"A": 10, "B": 60, "C": 20, "D": 5, "S": 5}, "excellent": {"A": 20, "B": 50, "C": 15, "D": 5, "S": 10}}	{"A": 5, "B": 3, "C": 1, "D": 0, "S": 7}	{"gradeScale": [{"grade": "S", "minScore": 96}, {"grade": "A", "minScore": 90}, {"grade": "B", "minScore": 80}, {"grade": "C", "minScore": 70}, {"grade": "D", "minScore": 0}], "groupTierBonus": {"poor": -1, "standard": 0, "excellent": 2}, "sourcePriority": "import", "totalMustEqual": 100, "kpiGroupWeights": {"performance_core": 80, "collaboration_growth": 20}, "perfCompWeights": {"comp": 0, "perf": 1}, "evaluatorWeights": {"ceo": 0.2, "teamLeader": 0.5, "divisionHead": 0.3}, "competencyIncluded": false, "qualitativeMaxPercent": 30, "stageExceptionWeights": {"ex2Final": 0.3, "ex2Round1": 0.7}}	2026-06-08 08:06:55.227	2026-06-08 08:06:55.227
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, password_hash, role, "position", job_level, department_id, manager_id, created_at, updated_at, current_salary, is_active, must_change_password, visibility_scope, previous_salary, legal_entity, employment_status, resigned_at, evaluation_exempt, evaluation_exempt_reason) FROM stdin;
577fc503-13fd-419a-ba7c-d11d9f5ec6e2	wjung7929@energyx.co.kr	정욱	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	599f0440-4eb5-4d93-83fc-47122cb6ee6b	31c19c79-80d9-4df4-a3ea-8fb779e44355	2026-06-05 05:44:30.282	2026-06-05 06:32:26.625	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
c16adb73-c06d-4890-853e-3565eab71a4e	ssong@energyx.co.kr	송상민	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	president	\N	ea0de4f3-2b21-45a9-ac7b-b6c62ccc5b3b	\N	2026-06-05 05:44:30.299	2026-06-05 05:44:30.299	\N	t	f	group	\N	energyx	active	\N	f	\N
712f26c3-9cb1-47e9-b6b6-1907b8e99d93	kjlee@energyx.co.kr	이교재	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	48f4d055-6419-49a3-b876-bef1ee4944ea	891c194f-4db0-4bf4-ba5c-8d1e0e853e49	2026-06-05 05:44:30.27	2026-06-05 06:32:26.799	\N	t	f	division	\N	mirae_plan	active	\N	f	\N
21c58b49-a96d-4d93-be1f-3920f9f7e8e9	yjkim@energyx.co.kr	김영진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	4d813556-b97d-4b6d-836c-046d4842259a	891c194f-4db0-4bf4-ba5c-8d1e0e853e49	2026-06-05 05:44:30.288	2026-06-05 06:32:27.055	\N	t	f	division	\N	mirae_plan	active	\N	f	\N
04774821-15c3-488b-bb1e-59aa57924a7c	yjpark@energyx.co.kr	박용진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	bd4abbaa-0203-4b56-ac84-d4eb779f4fc7	c16adb73-c06d-4890-853e-3565eab71a4e	2026-06-05 05:44:30.301	2026-06-05 05:44:30.549	\N	t	f	division	\N	energyx	active	\N	f	\N
6bb2bb8c-364f-49b4-a67d-49b7689facfe	klee@energyx.co.kr	이경재	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	2174264a-4640-457b-b2d3-98d7bae6603b	c16adb73-c06d-4890-853e-3565eab71a4e	2026-06-05 05:44:30.303	2026-06-05 05:44:30.551	\N	t	f	division	\N	energyx	active	\N	f	\N
8099c92c-558b-4e53-88ef-922bc6c4882a	dglee@energyx.co.kr	이대길	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	20dbae03-1f71-4e92-b9e5-00189b8a954f	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.359	2026-06-05 05:44:30.616	\N	t	f	division	\N	energyx	active	\N	f	\N
6cc02189-3f2d-4c75-aafe-4cad04390909	hnlim@energyx.co.kr	임하나	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	89428ad4-084d-4c3a-ad65-e7f3505783ea	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.363	2026-06-05 05:44:30.62	\N	t	f	division	\N	energyx	active	\N	f	\N
85c1476f-21d9-4e7c-aacd-0c76ffb9013a	jjeong@energyx.co.kr	정종만	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.247	2026-06-05 05:44:30.497	\N	t	f	self	\N	energyx	active	\N	f	\N
d7a79869-6548-46a1-96d8-c6913a425095	sback5964@energyx.co.kr	백소영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_plus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	cdd7bc48-fb24-415a-899a-502179f35c82	2026-06-05 05:44:30.45	2026-06-05 05:44:30.721	\N	t	f	self	\N	energyx	active	\N	f	\N
75bbaacb-301b-40ca-ab6e-28dac5a4b42c	ssul7587@energyx.co.kr	설수빈	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_plus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.451	2026-06-05 05:44:30.723	\N	t	f	self	\N	energyx	active	\N	f	\N
d63b663e-f009-45ef-b5ff-964782a65781	slee6477@energyx.co.kr	이상헌	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_plus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.453	2026-06-05 05:44:30.725	\N	t	f	self	\N	energyx	active	\N	f	\N
288e2eb4-68eb-4d5a-9486-df466fe87807	hlee5032@energyx.co.kr	이현우	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	director	division_head	c3291603-7d1d-4574-865d-36dc668d4148	76453350-cb40-4bef-a73b-398371cc0b11	2026-06-05 05:44:30.465	2026-06-05 05:44:30.734	\N	t	f	division	\N	energyx	active	\N	f	\N
970d36ef-b0f7-47f4-95ff-894d66080f5e	hr@energyx.co.kr	관리자	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	hr_admin	ceo	division_head	729bf597-4cfc-4269-9d1b-8d4fba27939c	\N	2026-06-08 02:23:24.443	2026-06-08 06:23:05.129	\N	t	f	company	\N	energyx	active	\N	t	\N
6ce2d0dc-674f-4c97-81a8-cf58dc9d4f16	byunjb@energyx.co.kr	변준범	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	48f4d055-6419-49a3-b876-bef1ee4944ea	712f26c3-9cb1-47e9-b6b6-1907b8e99d93	2026-06-05 05:44:30.274	2026-06-05 06:32:26.811	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
8132b9b8-7f4b-448d-af5f-bb4086167cc6	jsr@energyx.co.kr	정소라	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	4d813556-b97d-4b6d-836c-046d4842259a	21c58b49-a96d-4d93-be1f-3920f9f7e8e9	2026-06-05 05:44:30.292	2026-06-05 06:32:26.823	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
37a5cc7f-1f4d-4eeb-accb-3b918a49dbf3	mjoh@energyx.co.kr	오민진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	48f4d055-6419-49a3-b876-bef1ee4944ea	712f26c3-9cb1-47e9-b6b6-1907b8e99d93	2026-06-05 05:44:30.276	2026-06-05 06:32:26.921	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
5182032a-9e1f-4d46-a062-b16b268d1c29	bjung@energyx.co.kr	정보경	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	president	\N	883bc609-9a46-4736-9905-81d7889675be	\N	2026-06-05 05:44:30.237	2026-06-05 05:44:30.237	\N	t	f	group	\N	energyx	active	\N	f	\N
891c194f-4db0-4bf4-ba5c-8d1e0e853e49	kky@energyx.co.kr	김광영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	president	\N	865a2de0-4663-4402-b05c-81855ba277be	\N	2026-06-05 05:44:30.268	2026-06-05 05:44:30.268	\N	t	f	group	\N	energyx	active	\N	f	\N
623bf8c3-e457-4090-acf4-bb77ca58c427	jspark@energyx.co.kr	박준상	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	48f4d055-6419-49a3-b876-bef1ee4944ea	712f26c3-9cb1-47e9-b6b6-1907b8e99d93	2026-06-05 05:44:30.272	2026-06-08 04:06:27.223	\N	t	f	self	\N	energyx	active	\N	f	\N
217911ce-0ac9-4233-a7f5-6f3cddbfa998	slee6873@energyx.co.kr	이승원	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.249	2026-06-05 05:44:30.499	\N	t	f	self	\N	energyx	active	\N	f	\N
ebbf5119-8e68-4d5c-88ef-d427de1b82ab	ijeon5374@energyx.co.kr	전인종	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.251	2026-06-05 05:44:30.501	\N	t	f	self	\N	energyx	active	\N	f	\N
f3981680-513a-4548-80b6-0f3cb3559bbe	clee0597@energyx.co.kr	이청흰	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.253	2026-06-05 05:44:30.504	\N	t	f	self	\N	energyx	active	\N	f	\N
a231300a-498c-4011-a430-8cf609a66308	hkim3553@energyx.co.kr	김호정	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.256	2026-06-05 05:44:30.506	\N	t	f	self	\N	energyx	active	\N	f	\N
bc42280d-ed8b-4f22-9228-1a123f6a1614	bjeon7765@energyx.co.kr	전병민	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.258	2026-06-05 05:44:30.509	\N	t	f	self	\N	energyx	active	\N	f	\N
40db97f2-de41-4ec5-9792-33c0f4d3477f	jkim2006@energyx.co.kr	김지원	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	2026-06-05 05:44:30.26	2026-06-05 05:44:30.511	\N	t	f	self	\N	energyx	active	\N	f	\N
ae56e7c3-ef61-482d-9f2c-d5d2588bde7c	bkim4124@energyx.co.kr	김병민	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	c509500f-387f-4b10-ac8b-a074adaa595a	8065ee7b-0e27-4d06-952a-58d0c65b6bd1	2026-06-05 05:44:30.264	2026-06-05 05:44:30.514	\N	t	f	self	\N	energyx	active	\N	f	\N
97d2b0c1-ad2c-4c12-9a29-f24fbb9217d8	sgo4422@energyx.co.kr	고수민	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	c509500f-387f-4b10-ac8b-a074adaa595a	8065ee7b-0e27-4d06-952a-58d0c65b6bd1	2026-06-05 05:44:30.266	2026-06-05 05:44:30.516	\N	t	f	self	\N	energyx	active	\N	f	\N
88325795-aa10-46ac-829b-4eeddbd8098c	gcha2278@energyx.co.kr	차가을	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	599f0440-4eb5-4d93-83fc-47122cb6ee6b	31c19c79-80d9-4df4-a3ea-8fb779e44355	2026-06-05 05:44:30.286	2026-06-05 05:44:30.537	\N	t	f	self	\N	energyx	active	\N	f	\N
792a769a-9f55-4f92-a32a-9a74f6facc25	sbaek1591@energyx.co.kr	백선경	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	4d813556-b97d-4b6d-836c-046d4842259a	21c58b49-a96d-4d93-be1f-3920f9f7e8e9	2026-06-05 05:44:30.297	2026-06-05 05:44:30.547	\N	t	f	self	\N	energyx	active	\N	f	\N
dc5d78f9-7141-4884-bf26-9aae9138acc2	kchoi@energyx.co.kr	조경진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	9d111826-cc3a-4445-b5c6-817c78ef82d0	052417ae-0ae9-45fb-837d-e1dd3d801644	2026-06-05 05:44:30.308	2026-06-05 05:44:30.556	\N	t	f	self	\N	energyx	active	\N	f	\N
ce67c707-40b5-4157-967b-2959a0026406	sryu9508@energyx.co.kr	류수경	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	9d111826-cc3a-4445-b5c6-817c78ef82d0	052417ae-0ae9-45fb-837d-e1dd3d801644	2026-06-05 05:44:30.311	2026-06-05 05:44:30.558	\N	t	f	self	\N	energyx	active	\N	f	\N
36b4ce11-bba9-442f-9cf6-2d5213bb8bde	mmin@energyx.co.kr	민명기	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	executive	\N	26a7e4bc-8e33-4c78-a19a-cb95a8ea393a	6bb2bb8c-364f-49b4-a67d-49b7689facfe	2026-06-05 05:44:30.336	2026-06-08 04:02:08.088	\N	t	f	team	\N	energyx	active	\N	f	\N
12d9fd3a-d3b0-4553-993e-73e4fbf39de0	bkim4965@energyx.co.kr	김복수	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	bdb922c7-9b81-4a03-8b39-5a2890b05cec	32ede1d8-3b88-40fc-a1fc-dd2ef3c8e0c3	2026-06-05 05:44:30.348	2026-06-08 04:02:22.199	\N	t	f	team	\N	energyx	active	\N	f	\N
e0eec138-1189-48c6-a2f8-0357e67fdec6	sji8562@energyx.co.kr	지선용	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	1073e163-4f5e-46a6-b73e-5d861a10fec9	c16adb73-c06d-4890-853e-3565eab71a4e	2026-06-05 05:44:30.35	2026-06-08 04:02:40.274	\N	t	f	team	\N	energyx	active	\N	f	\N
54052507-656a-4f3b-a00a-1ff03e3c7e68	skpark@energyx.co.kr	박신규	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	d59d8d16-d9ff-4195-9ddd-be096a156cad	8099c92c-558b-4e53-88ef-922bc6c4882a	2026-06-05 05:44:30.367	2026-06-08 04:02:47.188	\N	t	f	team	\N	energyx	active	\N	f	\N
2eba90a7-6da6-4b72-b346-9bd709aebd67	ykang0359@energyx.co.kr	강연군	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	04774821-15c3-488b-bb1e-59aa57924a7c	2026-06-05 05:44:30.315	2026-06-05 05:44:30.562	\N	t	f	self	\N	energyx	active	\N	f	\N
e199f15a-10a1-4e36-94fb-22a5ae12cf0f	djang8065@energyx.co.kr	장동식	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	b62ae5ff-3c66-4630-a9a0-496dc6a698c2	2026-06-05 05:44:30.317	2026-06-05 05:44:30.564	\N	t	f	self	\N	energyx	active	\N	f	\N
6d97232d-15ef-4875-87b0-7e14aa7e4d99	hlim9359@energyx.co.kr	임홍식	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	b62ae5ff-3c66-4630-a9a0-496dc6a698c2	2026-06-05 05:44:30.319	2026-06-05 05:44:30.566	\N	t	f	self	\N	energyx	active	\N	f	\N
9fa3f3bd-6aea-4905-9fa5-c54e143e64b1	hkim4000@energyx.co.kr	김현규	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	b62ae5ff-3c66-4630-a9a0-496dc6a698c2	2026-06-05 05:44:30.321	2026-06-05 05:44:30.568	\N	t	f	self	\N	energyx	active	\N	f	\N
f48c8ba5-1e4f-4ecc-af12-c9d85ef01f80	sjung8264@energyx.co.kr	정순경	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	09ba8db1-b6c1-4b79-98ab-120e913c71ca	7c5b293b-5811-4044-95f8-9c900b7438db	2026-06-05 05:44:30.328	2026-06-05 05:44:30.575	\N	t	f	self	\N	energyx	active	\N	f	\N
d240ee30-e2e1-4778-96d7-7fb4aa7f961f	sshin9632@energyx.co.kr	신수연	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	09ba8db1-b6c1-4b79-98ab-120e913c71ca	7c5b293b-5811-4044-95f8-9c900b7438db	2026-06-05 05:44:30.33	2026-06-05 05:44:30.577	\N	t	f	self	\N	energyx	active	\N	f	\N
418360c3-8a88-4e64-9544-a8334ad20e61	hchoi0287@energyx.co.kr	최형석	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	09ba8db1-b6c1-4b79-98ab-120e913c71ca	7c5b293b-5811-4044-95f8-9c900b7438db	2026-06-05 05:44:30.332	2026-06-05 05:44:30.579	\N	t	f	self	\N	energyx	active	\N	f	\N
fec8efeb-c6f7-41a9-8a91-147d538ca405	wji2117@energyx.co.kr	지원영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	09ba8db1-b6c1-4b79-98ab-120e913c71ca	7c5b293b-5811-4044-95f8-9c900b7438db	2026-06-05 05:44:30.334	2026-06-05 05:44:30.581	\N	t	f	self	\N	energyx	active	\N	f	\N
8bef685e-ddb4-4f43-aab4-8f8178c6203c	jyong7071@energyx.co.kr	서용준	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	26a7e4bc-8e33-4c78-a19a-cb95a8ea393a	36b4ce11-bba9-442f-9cf6-2d5213bb8bde	2026-06-05 05:44:30.338	2026-06-05 05:44:30.585	\N	t	f	self	\N	energyx	active	\N	f	\N
74691c87-f233-407e-ac27-0550a33df3fa	eheo@energyx.co.kr	허은혁	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	aaf64e93-8104-47a6-b8ae-8ebc3b57f6d6	408d92a5-854e-4e8c-ac13-28b81669d4c0	2026-06-05 05:44:30.344	2026-06-05 05:44:30.589	\N	t	f	self	\N	energyx	active	\N	f	\N
32ede1d8-3b88-40fc-a1fc-dd2ef3c8e0c3	sseo@energyx.co.kr	서성원	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	executive	\N	bdb922c7-9b81-4a03-8b39-5a2890b05cec	c16adb73-c06d-4890-853e-3565eab71a4e	2026-06-05 05:44:30.346	2026-06-05 05:44:30.592	\N	t	f	self	\N	energyx	active	\N	f	\N
2ab318ae-028d-449d-ae52-3e42b0ff6608	jphong@energyx.co.kr	홍종필	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	vice_president	\N	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.355	2026-06-05 05:44:30.609	\N	t	f	group	\N	energyx	active	\N	f	\N
4a2b3846-6ab1-4de6-b31c-e9f85414cc4f	Jinokyu@energyx.co.kr	유진옥	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.357	2026-06-05 05:44:30.614	\N	t	f	self	\N	energyx	active	\N	f	\N
4fda1bc3-04fc-4ea6-bc53-747a57ffcf7d	yangrn@energyx.co.kr	양리나	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	d59d8d16-d9ff-4195-9ddd-be096a156cad	8099c92c-558b-4e53-88ef-922bc6c4882a	2026-06-05 05:44:30.369	2026-06-05 05:44:30.627	\N	t	f	self	\N	energyx	active	\N	f	\N
6012b708-4bd6-4784-86f3-673c86bb01f3	jsjung@energyx.co.kr	정지수	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	d59d8d16-d9ff-4195-9ddd-be096a156cad	54052507-656a-4f3b-a00a-1ff03e3c7e68	2026-06-05 05:44:30.371	2026-06-05 05:44:30.629	\N	t	f	self	\N	energyx	active	\N	f	\N
b4b9012d-448e-4cc5-ada4-54a9095bd295	ypark8689@energyx.co.kr	박예림	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	d59d8d16-d9ff-4195-9ddd-be096a156cad	54052507-656a-4f3b-a00a-1ff03e3c7e68	2026-06-05 05:44:30.374	2026-06-05 05:44:30.631	\N	t	f	self	\N	energyx	active	\N	f	\N
4c588584-229b-48ce-bbe1-84f54b436ef5	kwonhr@energyx.co.kr	권혁래	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	086f444d-5222-4cf2-8519-9c2bb56179df	f7733eee-5b8c-4225-ab0d-0337f1a039af	2026-06-05 05:44:30.378	2026-06-05 05:44:30.635	\N	t	f	self	\N	energyx	active	\N	f	\N
9d1fec38-7541-424a-8f9e-8c93d15e34a7	kclee@energyx.co.kr	이기철	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	225a963c-263f-4e44-9945-31d2ed537999	9bececb1-1086-4ecb-814a-7e069f82b4dc	2026-06-05 05:44:30.437	2026-06-05 06:32:27.022	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
cbeb8d5a-1108-433c-93ab-f36f43b299a9	rson6958@energyx.co.kr	손령빈	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	225a963c-263f-4e44-9945-31d2ed537999	9bececb1-1086-4ecb-814a-7e069f82b4dc	2026-06-05 05:44:30.44	2026-06-05 06:32:27.047	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
423677ec-9275-457b-b5f1-65f4d58feb60	shkwon@energyx.co.kr	권순현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	8099c92c-558b-4e53-88ef-922bc6c4882a	2026-06-05 05:44:30.384	2026-06-08 04:02:59.899	\N	t	f	team	\N	energyx	active	\N	f	\N
b5471373-688b-4541-b6f0-9a8fc12f1e95	jhkim@energyx.co.kr	김준호	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	605cd05b-4bab-4184-b6e2-6d03c489bc7c	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.404	2026-06-08 04:03:14.535	\N	t	f	team	\N	energyx	active	\N	f	\N
dd756554-b2d7-4731-b812-2ada2b4e1222	jpark3185@energyx.co.kr	박진성	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	senior	senior_plus	8c544a7b-bc1d-4dbd-b180-a653302aaa50	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.421	2026-06-08 04:03:33.724	\N	t	f	team	\N	energyx	active	\N	f	\N
907e61a5-fb28-4bcf-ac1f-3bf9a54ba12c	dsson@energyx.co.kr	손대승	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	6cc02189-3f2d-4c75-aafe-4cad04390909	2026-06-05 05:44:30.426	2026-06-08 04:03:42.665	\N	t	f	team	\N	energyx	active	\N	f	\N
9bececb1-1086-4ecb-814a-7e069f82b4dc	jhseo@energyx.co.kr	서종현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	225a963c-263f-4e44-9945-31d2ed537999	6cc02189-3f2d-4c75-aafe-4cad04390909	2026-06-05 05:44:30.435	2026-06-08 04:03:48.074	\N	t	f	team	\N	mirae_plan	active	\N	f	\N
52fef0a2-8311-4c7c-b2d8-eb3c41f52544	shimhj@energyx.co.kr	심효진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	423677ec-9275-457b-b5f1-65f4d58feb60	2026-06-05 05:44:30.386	2026-06-05 05:44:30.645	\N	t	f	self	\N	energyx	active	\N	f	\N
cd847d84-a871-4369-9b12-2882fd8ea621	djyou@energyx.co.kr	유다정	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	423677ec-9275-457b-b5f1-65f4d58feb60	2026-06-05 05:44:30.388	2026-06-05 05:44:30.647	\N	t	f	self	\N	energyx	active	\N	f	\N
3458ee48-209d-448f-b6ca-f2fd7f911927	sjmin@energyx.co.kr	민수지	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	423677ec-9275-457b-b5f1-65f4d58feb60	2026-06-05 05:44:30.39	2026-06-05 05:44:30.649	\N	t	f	self	\N	energyx	active	\N	f	\N
005aa6b0-79c9-4dc1-8bcc-5a26a815aefe	sjung2682@energyx.co.kr	정석명	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	423677ec-9275-457b-b5f1-65f4d58feb60	2026-06-05 05:44:30.392	2026-06-05 05:44:30.652	\N	t	f	self	\N	energyx	active	\N	f	\N
56006827-51b9-4601-be7b-6d97a2205551	mshim4824@energyx.co.kr	심민서	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	3b003c17-aecc-4af0-8620-e85bd53fcf7e	423677ec-9275-457b-b5f1-65f4d58feb60	2026-06-05 05:44:30.394	2026-06-05 05:44:30.654	\N	t	f	self	\N	energyx	active	\N	f	\N
88dc1c04-2096-4961-b102-db563ecbc8cb	ucchoi@energyx.co.kr	최유창	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	1990a4db-2151-4dd7-bbd0-020566cfef55	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.398	2026-06-05 05:44:30.659	\N	t	f	self	\N	energyx	active	\N	f	\N
927f2cd9-fdd8-4b3c-a49c-faf168d8d436	hjson@energyx.co.kr	손혜진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	1990a4db-2151-4dd7-bbd0-020566cfef55	b1787d61-70e1-4ba0-9996-021777ee00bc	2026-06-05 05:44:30.4	2026-06-05 05:44:30.661	\N	t	f	self	\N	energyx	active	\N	f	\N
3e982676-9e1c-43e1-9c00-99de10b2211c	hrlee@energyx.co.kr	이하람	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	1990a4db-2151-4dd7-bbd0-020566cfef55	b1787d61-70e1-4ba0-9996-021777ee00bc	2026-06-05 05:44:30.402	2026-06-05 05:44:30.663	\N	t	f	self	\N	energyx	active	\N	f	\N
48675424-b9c0-4710-aed6-3219eedc5d84	yyu4345@energyx.co.kr	유예지	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	605cd05b-4bab-4184-b6e2-6d03c489bc7c	b5471373-688b-4541-b6f0-9a8fc12f1e95	2026-06-05 05:44:30.406	2026-06-05 05:44:30.668	\N	t	f	self	\N	energyx	active	\N	f	\N
54f07fc1-fc75-45ec-8ed0-66ca82ca37df	parkeh@energyx.co.kr	박은혜	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	605cd05b-4bab-4184-b6e2-6d03c489bc7c	b5471373-688b-4541-b6f0-9a8fc12f1e95	2026-06-05 05:44:30.409	2026-06-05 05:44:30.67	\N	t	f	self	\N	energyx	active	\N	f	\N
306e6892-a81e-4b75-a90c-e0b40da7969e	ykim7242@energyx.co.kr	김예진	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	605cd05b-4bab-4184-b6e2-6d03c489bc7c	b5471373-688b-4541-b6f0-9a8fc12f1e95	2026-06-05 05:44:30.411	2026-06-05 05:44:30.672	\N	t	f	self	\N	energyx	active	\N	f	\N
ac4b09ed-bb0b-4179-96ea-b697ebb8d7d7	jiheyseo@energyx.co.kr	서지혜	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	8007ed4f-a263-472b-bd84-1706766b6d07	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.415	2026-06-05 05:44:30.677	\N	t	f	self	\N	energyx	active	\N	f	\N
a03c86dc-2e10-439c-89ee-e30ec5943ffd	dsna@energyx.co.kr	나대수	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	8007ed4f-a263-472b-bd84-1706766b6d07	f3e41b5f-d468-4b20-a8ef-79d124ac8e96	2026-06-05 05:44:30.417	2026-06-05 05:44:30.679	\N	t	f	self	\N	energyx	active	\N	f	\N
7bbe4d91-ffaf-49cc-b3c7-e6011162fba2	ycho7405@energyx.co.kr	조영재	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	8007ed4f-a263-472b-bd84-1706766b6d07	f3e41b5f-d468-4b20-a8ef-79d124ac8e96	2026-06-05 05:44:30.419	2026-06-05 05:44:30.68	\N	t	f	self	\N	energyx	active	\N	f	\N
cede320f-e362-41be-8c92-b1241b064b3d	hjshin@energyx.co.kr	신현정	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	8c544a7b-bc1d-4dbd-b180-a653302aaa50	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.424	2026-06-05 05:44:30.692	\N	t	f	self	\N	energyx	active	\N	f	\N
6e1ea2ef-2e8d-44d5-8c90-e4ea30c879b7	gsw@energyx.co.kr	권숙원	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	907e61a5-fb28-4bcf-ac1f-3bf9a54ba12c	2026-06-05 05:44:30.43	2026-06-05 05:44:30.699	\N	t	f	self	\N	energyx	active	\N	f	\N
3b54e7fb-2a26-4910-a716-720a1b99e39a	kshin5239@energyx.co.kr	신경준	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	907e61a5-fb28-4bcf-ac1f-3bf9a54ba12c	2026-06-05 05:44:30.431	2026-06-05 05:44:30.701	\N	t	f	self	\N	energyx	active	\N	f	\N
1f182dd0-8430-4e39-9f1e-2bb2f4ce6f5e	dlee7821@energyx.co.kr	이다현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	907e61a5-fb28-4bcf-ac1f-3bf9a54ba12c	2026-06-05 05:44:30.433	2026-06-05 05:44:30.703	\N	t	f	self	\N	energyx	active	\N	f	\N
f03c187a-253c-4361-897b-19a970a6054e	jryu6459@energyx.co.kr	류정미	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	98faf6ef-81ff-40d8-8b20-3f08cedd9553	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.484	2026-06-08 02:31:36.979	\N	t	f	team	\N	energyx	active	\N	f	\N
718a8acf-0790-46e5-84cb-5620338dba3d	hjin3542@energyx.co.kr	진희선	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	729bf597-4cfc-4269-9d1b-8d4fba27939c	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	2026-06-05 05:44:30.482	2026-06-08 02:33:14.477	\N	t	f	self	\N	energyx	active	\N	f	\N
76453350-cb40-4bef-a73b-398371cc0b11	spark@energyx.ai	박성현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	hr_admin	ceo	\N	7ab6895d-4d5b-43c2-b956-6df79ed2af29	\N	2026-06-05 05:44:30.461	2026-06-05 05:44:30.461	\N	t	f	company	\N	energyx	active	\N	f	\N
3494ff1f-a963-483d-af09-775069446d66	dhong@energyx.co.kr	홍두화	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	hr_admin	ceo	\N	7ab6895d-4d5b-43c2-b956-6df79ed2af29	76453350-cb40-4bef-a73b-398371cc0b11	2026-06-05 05:44:30.463	2026-06-05 05:44:30.732	\N	t	f	company	\N	energyx	active	\N	f	\N
7ee418e4-5b76-4f82-b1e5-6d0e7bb7a5c5	jpark1022@energyx.co.kr	박준영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	58cc7087-f2c4-42ee-99fa-f2cbffd4a2fd	04774821-15c3-488b-bb1e-59aa57924a7c	2026-06-05 05:44:30.324	2026-06-08 04:01:54.123	\N	t	f	team	\N	energyx	active	\N	f	\N
408d92a5-854e-4e8c-ac13-28b81669d4c0	hkim9099@energyx.co.kr	김현석	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	aaf64e93-8104-47a6-b8ae-8ebc3b57f6d6	c16adb73-c06d-4890-853e-3565eab71a4e	2026-06-05 05:44:30.341	2026-06-08 04:02:15.145	\N	t	f	team	\N	energyx	active	\N	f	\N
03f5689a-8b5d-4e64-9c83-68d941369255	dlee3517@energyx.co.kr	이두환	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	87ece94d-728f-46a2-bf07-c06dc3d8086e	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.459	2026-06-08 04:04:00.227	\N	t	f	team	\N	energyx	active	\N	f	\N
d50ecde7-3cd4-48f7-b3b2-7bedd614e070	jjh@energyx.co.kr	정재훈	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	principal	senior_plus	729bf597-4cfc-4269-9d1b-8d4fba27939c	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.478	2026-06-08 06:22:28.558	\N	t	f	team	\N	energyx	active	\N	f	\N
8065ee7b-0e27-4d06-952a-58d0c65b6bd1	mjseo@energyx.co.kr	서민정	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	c509500f-387f-4b10-ac8b-a074adaa595a	5182032a-9e1f-4d46-a062-b16b268d1c29	2026-06-05 05:44:30.262	2026-06-05 05:44:30.512	\N	t	f	self	\N	energyx	active	\N	f	\N
d023afbf-a84d-482c-ab3b-c17a1329f090	leeyn@energyx.co.kr	이유나	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.448	2026-06-05 05:44:30.719	\N	t	f	self	\N	energyx	active	\N	f	\N
c4c835c6-4697-4cc8-a1ae-0c288483e80b	schoi3503@energyx.co.kr	최순기	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.469	2026-06-05 05:44:30.738	\N	t	f	self	\N	energyx	active	\N	f	\N
c213f7bc-d2c2-4eed-b026-1116bac4d004	hjang7305@energyx.co.kr	장한샘	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	607cbeea-69ca-4187-b70a-45dc07667574	2026-06-05 05:44:30.474	2026-06-05 05:44:30.743	\N	t	f	self	\N	energyx	active	\N	f	\N
651340e8-b62e-48eb-b99f-27f9fea063b3	jkim0609@energyx.co.kr	김지희	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	729bf597-4cfc-4269-9d1b-8d4fba27939c	d50ecde7-3cd4-48f7-b3b2-7bedd614e070	2026-06-05 05:44:30.48	2026-06-05 05:44:30.749	\N	t	f	self	\N	energyx	active	\N	f	\N
f74dc4d0-0afe-4040-8b22-0d69a5140a53	schoi6133@energyx.co.kr	최선영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	98faf6ef-81ff-40d8-8b20-3f08cedd9553	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.486	2026-06-05 05:44:30.755	\N	t	f	self	\N	energyx	active	\N	f	\N
7f1892b1-58ac-46a1-8d6b-ac86151ea107	reo9921@energyx.co.kr	어라윤	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	98faf6ef-81ff-40d8-8b20-3f08cedd9553	f03c187a-253c-4361-897b-19a970a6054e	2026-06-05 05:44:30.488	2026-06-05 05:44:30.758	\N	t	f	self	\N	energyx	active	\N	f	\N
b1787d61-70e1-4ba0-9996-021777ee00bc	bhkang@energyx.co.kr	강보형	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	1990a4db-2151-4dd7-bbd0-020566cfef55	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.396	2026-06-08 04:03:05.989	\N	t	f	team	\N	energyx	active	\N	f	\N
f3e41b5f-d468-4b20-a8ef-79d124ac8e96	shpark@energyx.co.kr	박승현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	8007ed4f-a263-472b-bd84-1706766b6d07	37d915cc-8be5-4e91-b1d6-dc8d72930a5c	2026-06-05 05:44:30.413	2026-06-08 04:03:22.068	\N	t	f	team	\N	energyx	active	\N	f	\N
f09cf015-3fcf-4cf4-92d7-ed5bb3d171da	sgh@energyx.co.kr	사공환희	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	599f0440-4eb5-4d93-83fc-47122cb6ee6b	31c19c79-80d9-4df4-a3ea-8fb779e44355	2026-06-05 05:44:30.28	2026-06-05 06:32:26.775	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
0750af9d-98c7-48e7-9fd8-71962bc630dc	naml1511@energyx.co.kr	임남혁	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	599f0440-4eb5-4d93-83fc-47122cb6ee6b	31c19c79-80d9-4df4-a3ea-8fb779e44355	2026-06-05 05:44:30.284	2026-06-05 06:32:26.79	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
052417ae-0ae9-45fb-837d-e1dd3d801644	eyoon@energyx.co.kr	윤은식	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	9d111826-cc3a-4445-b5c6-817c78ef82d0	04774821-15c3-488b-bb1e-59aa57924a7c	2026-06-05 05:44:30.305	2026-06-08 04:01:39.654	\N	t	f	team	\N	energyx	active	\N	f	\N
178d1fde-79d3-482a-abf5-f2107e33e197	pcy@energyx.co.kr	박창영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	hr_admin	ceo	\N	b782c886-fe88-4c58-bfec-d55e7f2ae6fe	\N	2026-06-05 05:44:30.353	2026-06-05 05:44:30.353	\N	t	f	company	\N	energyx	active	\N	f	\N
cdd7bc48-fb24-415a-899a-502179f35c82	yakim@energyx.co.kr	김연아	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	ca69cb4e-6e06-4d93-bcda-a9f4be5bc6b9	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.365	2026-06-05 06:32:26.609	\N	t	f	division	\N	mirae_plan	active	\N	f	\N
7c5b293b-5811-4044-95f8-9c900b7438db	csung5934@energyx.co.kr	성창현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	director	\N	09ba8db1-b6c1-4b79-98ab-120e913c71ca	04774821-15c3-488b-bb1e-59aa57924a7c	2026-06-05 05:44:30.326	2026-06-08 04:02:01.163	\N	t	f	team	\N	energyx	active	\N	f	\N
08d4e449-a18a-4a88-a000-16d7c36e6ccc	hsy@energyx.co.kr	한상윤	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.444	2026-06-08 04:03:54.4	\N	t	f	team	\N	energyx	active	\N	f	\N
b62ae5ff-3c66-4630-a9a0-496dc6a698c2	ycho8609@energyx.co.kr	조유현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	cf2c30ba-e96c-4ce5-a640-dfd355cbd5cf	04774821-15c3-488b-bb1e-59aa57924a7c	2026-06-05 05:44:30.313	2026-06-08 04:01:46.598	\N	t	f	team	\N	energyx	active	\N	f	\N
f3ccef62-e2e2-482e-8ee5-b4c34ba0e830	jsong1699@energyx.co.kr	송지훈	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	team_lead	bf5ad56c-9ff0-4c3e-91fa-80efb8dddb7e	5182032a-9e1f-4d46-a062-b16b268d1c29	2026-06-05 05:44:30.243	2026-06-05 06:06:03.802	\N	t	f	team	\N	energyx	active	\N	f	\N
36bb4320-d3a2-4ca0-a7d7-5b855553c743	jsh@energyx.co.kr	진성현	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	4d813556-b97d-4b6d-836c-046d4842259a	21c58b49-a96d-4d93-be1f-3920f9f7e8e9	2026-06-05 05:44:30.295	2026-06-05 06:32:26.639	\N	t	f	self	\N	mirae_plan	active	\N	f	\N
31c19c79-80d9-4df4-a3ea-8fb779e44355	jkjin@energyx.co.kr	진정근	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	599f0440-4eb5-4d93-83fc-47122cb6ee6b	891c194f-4db0-4bf4-ba5c-8d1e0e853e49	2026-06-05 05:44:30.278	2026-06-05 06:32:27.004	\N	t	f	division	\N	mirae_plan	active	\N	f	\N
cb0bacd9-6489-4b1e-97a9-30edad5f87ac	ykwon8354@energyx.co.kr	권영은	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	607cbeea-69ca-4187-b70a-45dc07667574	2026-06-05 05:44:30.471	2026-06-07 22:59:16.837	\N	t	f	self	\N	energyx	active	\N	f	\N
607cbeea-69ca-4187-b70a-45dc07667574	mkim@energyx.co.kr	김명근	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	senior	senior_plus	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.467	2026-06-08 02:31:10.021	\N	t	f	team	\N	energyx	active	\N	f	\N
11f2f0f1-3e9f-48e5-8dd7-020929dec5fe	lhi@energyx.co.kr	이혜인	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	086f444d-5222-4cf2-8519-9c2bb56179df	f7733eee-5b8c-4225-ab0d-0337f1a039af	2026-06-05 05:44:30.38	2026-06-05 05:44:30.637	\N	t	f	self	\N	energyx	active	\N	f	\N
ca662f14-1063-48a8-a6f7-10d5532ed3cc	jyun8160@energyx.co.kr	윤재희	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	086f444d-5222-4cf2-8519-9c2bb56179df	f7733eee-5b8c-4225-ab0d-0337f1a039af	2026-06-05 05:44:30.382	2026-06-05 05:44:30.64	\N	t	f	self	\N	energyx	active	\N	f	\N
5712674c-a7f0-4b10-8ebe-7403edc32616	kjy@energyx.co.kr	김제영	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	chief	senior_plus	6eb3a1aa-5a8a-43e5-9a33-afef232f35d6	6cc02189-3f2d-4c75-aafe-4cad04390909	2026-06-05 05:44:30.428	2026-06-05 05:44:30.696	\N	t	f	self	\N	energyx	active	\N	f	\N
d89d1128-98fb-4376-8bd9-6f2b8f0d8bf9	mkim4819@energyx.co.kr	김미소	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	225a963c-263f-4e44-9945-31d2ed537999	9bececb1-1086-4ecb-814a-7e069f82b4dc	2026-06-05 05:44:30.442	2026-06-05 05:44:30.713	\N	t	f	self	\N	energyx	active	\N	f	\N
97a03d1a-9d55-4771-a0c9-5dc3a43ca7f1	glee8626@energyx.co.kr	이기환	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.456	2026-06-05 05:44:30.728	\N	t	f	self	\N	energyx	active	\N	f	\N
a9fd13f4-8bd5-4651-8c3a-b8267d9351bb	ilee@energyx.co.kr	이임태	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	senior	senior_plus	e1e9eb02-b3c3-4d2a-bbf4-dfa923a2b6bc	288e2eb4-68eb-4d5a-9486-df466fe87807	2026-06-05 05:44:30.476	2026-06-05 05:44:30.745	\N	t	f	self	\N	energyx	active	\N	f	\N
7e9828e0-935f-458f-8597-1255c5748269	skim4817@energyx.co.kr	김수성	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_minus	98faf6ef-81ff-40d8-8b20-3f08cedd9553	f03c187a-253c-4361-897b-19a970a6054e	2026-06-05 05:44:30.491	2026-06-05 05:44:30.76	\N	t	f	self	\N	energyx	active	\N	f	\N
37d915cc-8be5-4e91-b1d6-dc8d72930a5c	hskim@energyx.co.kr	김현수	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	division_head	executive	division_head	3692e6dd-0e49-4c7d-a389-26238b2f48ba	178d1fde-79d3-482a-abf5-f2107e33e197	2026-06-05 05:44:30.361	2026-06-05 05:44:30.618	\N	t	f	division	\N	energyx	active	\N	f	\N
55868d8b-c8cb-433e-a33d-49df056a3550	ohjy@energyx.co.kr	오재용	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	employee	pro	senior_plus	05c7c7bc-861a-4160-99bb-1df3c09aaeae	d7a79869-6548-46a1-96d8-c6913a425095	2026-06-05 05:44:30.446	2026-06-05 05:44:30.717	\N	t	f	self	\N	energyx	active	\N	f	\N
f7733eee-5b8c-4225-ab0d-0337f1a039af	kbkim@energyx.co.kr	김기범	$2a$10$TLffDMxKjJM4fivox58KN.yZmABhxXwUekzLPCcH3rDle1G.p0W2a	team_lead	chief	senior_plus	086f444d-5222-4cf2-8519-9c2bb56179df	8099c92c-558b-4e53-88ef-922bc6c4882a	2026-06-05 05:44:30.376	2026-06-08 04:02:52.867	\N	t	f	team	\N	energyx	active	\N	f	\N
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: action_items action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_pkey PRIMARY KEY (id);


--
-- Name: appeals appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: compensations compensations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT compensations_pkey PRIMARY KEY (id);


--
-- Name: competency_questions competency_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_questions
    ADD CONSTRAINT competency_questions_pkey PRIMARY KEY (id);


--
-- Name: competency_responses competency_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_responses
    ADD CONSTRAINT competency_responses_pkey PRIMARY KEY (id);


--
-- Name: cycle_schedules cycle_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_schedules
    ADD CONSTRAINT cycle_schedules_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: evaluation_cycles evaluation_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_cycles
    ADD CONSTRAINT evaluation_cycles_pkey PRIMARY KEY (id);


--
-- Name: evaluation_evidence evaluation_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_evidence
    ADD CONSTRAINT evaluation_evidence_pkey PRIMARY KEY (id);


--
-- Name: evaluation_results evaluation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_pkey PRIMARY KEY (id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: grade_pools grade_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_pools
    ADD CONSTRAINT grade_pools_pkey PRIMARY KEY (id);


--
-- Name: group_performances group_performances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_performances
    ADD CONSTRAINT group_performances_pkey PRIMARY KEY (id);


--
-- Name: kpi_category_policies kpi_category_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_category_policies
    ADD CONSTRAINT kpi_category_policies_pkey PRIMARY KEY (id);


--
-- Name: kpi_scores kpi_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_scores
    ADD CONSTRAINT kpi_scores_pkey PRIMARY KEY (id);


--
-- Name: kpi_snapshots kpi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_snapshots
    ADD CONSTRAINT kpi_snapshots_pkey PRIMARY KEY (id);


--
-- Name: kpi_template_items kpi_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_template_items
    ADD CONSTRAINT kpi_template_items_pkey PRIMARY KEY (id);


--
-- Name: kpi_templates kpi_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_templates
    ADD CONSTRAINT kpi_templates_pkey PRIMARY KEY (id);


--
-- Name: kpis kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_pkey PRIMARY KEY (id);


--
-- Name: midterm_reviews midterm_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.midterm_reviews
    ADD CONSTRAINT midterm_reviews_pkey PRIMARY KEY (id);


--
-- Name: monthly_performances monthly_performances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performances
    ADD CONSTRAINT monthly_performances_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: permission_config permission_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_config
    ADD CONSTRAINT permission_config_pkey PRIMARY KEY (id);


--
-- Name: position_defs position_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_defs
    ADD CONSTRAINT position_defs_pkey PRIMARY KEY (id);


--
-- Name: rebaseline_requests rebaseline_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rebaseline_requests
    ADD CONSTRAINT rebaseline_requests_pkey PRIMARY KEY (id);


--
-- Name: reminder_dispatches reminder_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_dispatches
    ADD CONSTRAINT reminder_dispatches_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: rule_sets rule_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_sets
    ADD CONSTRAINT rule_sets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: achievements_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievements_kpi_id_idx ON public.achievements USING btree (kpi_id);


--
-- Name: action_items_assignee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_assignee_id_idx ON public.action_items USING btree (assignee_id);


--
-- Name: action_items_cycle_id_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_cycle_id_evaluatee_id_idx ON public.action_items USING btree (cycle_id, evaluatee_id);


--
-- Name: action_items_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_cycle_id_idx ON public.action_items USING btree (cycle_id);


--
-- Name: action_items_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_evaluatee_id_idx ON public.action_items USING btree (evaluatee_id);


--
-- Name: action_items_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_kpi_id_idx ON public.action_items USING btree (kpi_id);


--
-- Name: appeals_result_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appeals_result_id_idx ON public.appeals USING btree (result_id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_at_idx ON public.audit_logs USING btree (at);


--
-- Name: audit_logs_entity_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_entity_entity_id_idx ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: comments_evaluation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_evaluation_id_idx ON public.comments USING btree (evaluation_id);


--
-- Name: compensations_user_id_cycle_id_simulated_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX compensations_user_id_cycle_id_simulated_key ON public.compensations USING btree (user_id, cycle_id, simulated);


--
-- Name: competency_questions_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX competency_questions_cycle_id_idx ON public.competency_questions USING btree (cycle_id);


--
-- Name: competency_responses_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX competency_responses_cycle_id_idx ON public.competency_responses USING btree (cycle_id);


--
-- Name: competency_responses_question_id_user_id_cycle_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX competency_responses_question_id_user_id_cycle_id_key ON public.competency_responses USING btree (question_id, user_id, cycle_id);


--
-- Name: competency_responses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX competency_responses_user_id_idx ON public.competency_responses USING btree (user_id);


--
-- Name: cycle_schedules_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cycle_schedules_cycle_id_idx ON public.cycle_schedules USING btree (cycle_id);


--
-- Name: cycle_schedules_cycle_id_phase_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cycle_schedules_cycle_id_phase_key ON public.cycle_schedules USING btree (cycle_id, phase);


--
-- Name: departments_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_parent_id_idx ON public.departments USING btree (parent_id);


--
-- Name: evaluation_cycles_rule_set_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX evaluation_cycles_rule_set_id_key ON public.evaluation_cycles USING btree (rule_set_id);


--
-- Name: evaluation_evidence_evaluation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluation_evidence_evaluation_id_idx ON public.evaluation_evidence USING btree (evaluation_id);


--
-- Name: evaluation_evidence_evaluation_id_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluation_evidence_evaluation_id_kpi_id_idx ON public.evaluation_evidence USING btree (evaluation_id, kpi_id);


--
-- Name: evaluation_results_division_id_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluation_results_division_id_snapshot_idx ON public.evaluation_results USING btree (division_id_snapshot);


--
-- Name: evaluation_results_group_id_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluation_results_group_id_snapshot_idx ON public.evaluation_results USING btree (group_id_snapshot);


--
-- Name: evaluation_results_team_id_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluation_results_team_id_snapshot_idx ON public.evaluation_results USING btree (team_id_snapshot);


--
-- Name: evaluation_results_user_id_cycle_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX evaluation_results_user_id_cycle_id_key ON public.evaluation_results USING btree (user_id, cycle_id);


--
-- Name: evaluations_cycle_id_evaluator_id_evaluatee_id_type_round_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX evaluations_cycle_id_evaluator_id_evaluatee_id_type_round_key ON public.evaluations USING btree (cycle_id, evaluator_id, evaluatee_id, type, round);


--
-- Name: evaluations_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluations_cycle_id_idx ON public.evaluations USING btree (cycle_id);


--
-- Name: evaluations_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluations_evaluatee_id_idx ON public.evaluations USING btree (evaluatee_id);


--
-- Name: grade_pools_cycle_id_group_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX grade_pools_cycle_id_group_id_key ON public.grade_pools USING btree (cycle_id, group_id);


--
-- Name: group_performances_group_id_cycle_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_performances_group_id_cycle_id_key ON public.group_performances USING btree (group_id, cycle_id);


--
-- Name: kpi_category_policies_position_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kpi_category_policies_position_key ON public.kpi_category_policies USING btree ("position");


--
-- Name: kpi_scores_evaluation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpi_scores_evaluation_id_idx ON public.kpi_scores USING btree (evaluation_id);


--
-- Name: kpi_snapshots_cycle_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpi_snapshots_cycle_id_user_id_idx ON public.kpi_snapshots USING btree (cycle_id, user_id);


--
-- Name: kpi_template_items_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpi_template_items_template_id_idx ON public.kpi_template_items USING btree (template_id);


--
-- Name: kpi_templates_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpi_templates_cycle_id_idx ON public.kpi_templates USING btree (cycle_id);


--
-- Name: kpis_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpis_cycle_id_idx ON public.kpis USING btree (cycle_id);


--
-- Name: kpis_parent_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpis_parent_kpi_id_idx ON public.kpis USING btree (parent_kpi_id);


--
-- Name: kpis_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpis_user_id_idx ON public.kpis USING btree (user_id);


--
-- Name: midterm_reviews_cycle_id_evaluatee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX midterm_reviews_cycle_id_evaluatee_id_key ON public.midterm_reviews USING btree (cycle_id, evaluatee_id);


--
-- Name: midterm_reviews_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX midterm_reviews_cycle_id_idx ON public.midterm_reviews USING btree (cycle_id);


--
-- Name: midterm_reviews_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX midterm_reviews_evaluatee_id_idx ON public.midterm_reviews USING btree (evaluatee_id);


--
-- Name: monthly_performances_cycle_id_department_id_year_month_cate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX monthly_performances_cycle_id_department_id_year_month_cate_key ON public.monthly_performances USING btree (cycle_id, department_id, year, month, category);


--
-- Name: monthly_performances_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_performances_cycle_id_idx ON public.monthly_performances USING btree (cycle_id);


--
-- Name: monthly_performances_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_performances_department_id_idx ON public.monthly_performances USING btree (department_id);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: position_defs_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX position_defs_code_key ON public.position_defs USING btree (code);


--
-- Name: rebaseline_requests_cycle_id_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rebaseline_requests_cycle_id_evaluatee_id_idx ON public.rebaseline_requests USING btree (cycle_id, evaluatee_id);


--
-- Name: rebaseline_requests_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rebaseline_requests_cycle_id_idx ON public.rebaseline_requests USING btree (cycle_id);


--
-- Name: rebaseline_requests_evaluatee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rebaseline_requests_evaluatee_id_idx ON public.rebaseline_requests USING btree (evaluatee_id);


--
-- Name: rebaseline_requests_reviewer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rebaseline_requests_reviewer_id_idx ON public.rebaseline_requests USING btree (reviewer_id);


--
-- Name: rebaseline_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rebaseline_requests_status_idx ON public.rebaseline_requests USING btree (status);


--
-- Name: reminder_dispatches_cycle_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminder_dispatches_cycle_id_idx ON public.reminder_dispatches USING btree (cycle_id);


--
-- Name: reminder_dispatches_cycle_id_phase_offset_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reminder_dispatches_cycle_id_phase_offset_key ON public.reminder_dispatches USING btree (cycle_id, phase, "offset");


--
-- Name: reviews_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_kpi_id_idx ON public.reviews USING btree (kpi_id);


--
-- Name: users_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_department_id_idx ON public.users USING btree (department_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_manager_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_manager_id_idx ON public.users USING btree (manager_id);


--
-- Name: achievements achievements_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: action_items action_items_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: action_items action_items_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: action_items action_items_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: action_items action_items_evaluatee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: action_items action_items_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: appeals appeals_decided_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_decided_by_id_fkey FOREIGN KEY (decided_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: appeals appeals_responded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_responded_by_id_fkey FOREIGN KEY (responded_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: appeals appeals_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.evaluation_results(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: appeals appeals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: comments comments_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: compensations compensations_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT compensations_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: compensations compensations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensations
    ADD CONSTRAINT compensations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: competency_questions competency_questions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_questions
    ADD CONSTRAINT competency_questions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: competency_questions competency_questions_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_questions
    ADD CONSTRAINT competency_questions_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: competency_responses competency_responses_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_responses
    ADD CONSTRAINT competency_responses_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: competency_responses competency_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_responses
    ADD CONSTRAINT competency_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.competency_questions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: competency_responses competency_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competency_responses
    ADD CONSTRAINT competency_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cycle_schedules cycle_schedules_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cycle_schedules
    ADD CONSTRAINT cycle_schedules_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: departments departments_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: evaluation_cycles evaluation_cycles_rule_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_cycles
    ADD CONSTRAINT evaluation_cycles_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES public.rule_sets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: evaluation_evidence evaluation_evidence_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_evidence
    ADD CONSTRAINT evaluation_evidence_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evaluation_evidence evaluation_evidence_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_evidence
    ADD CONSTRAINT evaluation_evidence_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evaluation_results evaluation_results_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evaluation_results evaluation_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_results
    ADD CONSTRAINT evaluation_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evaluations evaluations_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evaluations evaluations_evaluatee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: evaluations evaluations_evaluator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: grade_pools grade_pools_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_pools
    ADD CONSTRAINT grade_pools_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: grade_pools grade_pools_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_pools
    ADD CONSTRAINT grade_pools_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: group_performances group_performances_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_performances
    ADD CONSTRAINT group_performances_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: group_performances group_performances_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_performances
    ADD CONSTRAINT group_performances_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kpi_scores kpi_scores_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_scores
    ADD CONSTRAINT kpi_scores_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpi_scores kpi_scores_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_scores
    ADD CONSTRAINT kpi_scores_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kpi_snapshots kpi_snapshots_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_snapshots
    ADD CONSTRAINT kpi_snapshots_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpi_snapshots kpi_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_snapshots
    ADD CONSTRAINT kpi_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kpi_template_items kpi_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_template_items
    ADD CONSTRAINT kpi_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.kpi_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpi_templates kpi_templates_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_templates
    ADD CONSTRAINT kpi_templates_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kpis kpis_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kpis kpis_parent_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_parent_kpi_id_fkey FOREIGN KEY (parent_kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: kpis kpis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: midterm_reviews midterm_reviews_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.midterm_reviews
    ADD CONSTRAINT midterm_reviews_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: midterm_reviews midterm_reviews_evaluatee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.midterm_reviews
    ADD CONSTRAINT midterm_reviews_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: midterm_reviews midterm_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.midterm_reviews
    ADD CONSTRAINT midterm_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: monthly_performances monthly_performances_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performances
    ADD CONSTRAINT monthly_performances_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: monthly_performances monthly_performances_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performances
    ADD CONSTRAINT monthly_performances_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_performances monthly_performances_entered_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performances
    ADD CONSTRAINT monthly_performances_entered_by_id_fkey FOREIGN KEY (entered_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rebaseline_requests rebaseline_requests_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rebaseline_requests
    ADD CONSTRAINT rebaseline_requests_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rebaseline_requests rebaseline_requests_evaluatee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rebaseline_requests
    ADD CONSTRAINT rebaseline_requests_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rebaseline_requests rebaseline_requests_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rebaseline_requests
    ADD CONSTRAINT rebaseline_requests_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reminder_dispatches reminder_dispatches_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_dispatches
    ADD CONSTRAINT reminder_dispatches_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.evaluation_cycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reviews reviews_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict U6eIpiuILX3lbcLr5C3T5MZ3hzdmF23ZtTffeeHk5uUTa9ra1Dnm1GCTNHDgll1

