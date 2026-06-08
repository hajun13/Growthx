-- YoY (연도 누적 평가 비교): User 법인·재직상태 + EvaluationResult 조직 스냅샷.
-- 모든 신규 컬럼은 기본값/널 → 기존 데이터 무해.

-- CreateEnum
CREATE TYPE "LegalEntity" AS ENUM ('energyx', 'mirae_plan');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'on_leave', 'resigned');

-- AlterTable: users — 법인·재직상태·퇴사일
ALTER TABLE "users"
  ADD COLUMN "legal_entity" "LegalEntity" NOT NULL DEFAULT 'energyx',
  ADD COLUMN "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "resigned_at" TIMESTAMP(3);

-- AlterTable: evaluation_results — 당시 조직 스냅샷(조직개편 무관 비교)
ALTER TABLE "evaluation_results"
  ADD COLUMN "group_snapshot" TEXT,
  ADD COLUMN "division_snapshot" TEXT,
  ADD COLUMN "team_snapshot" TEXT;
