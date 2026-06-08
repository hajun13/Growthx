-- 직급(Position) enum → 관리형 레지스트리(PositionDef) 전환 (계약 B-3).
-- ⚠️ Prisma 자동생성은 position 컬럼을 DROP/ADD(데이터 손실)로 만들어 수동 검수·수정함.
--    enum→text 는 USING "position"::text 캐스트로 무손실 전환한다.
--    기존 unique 인덱스(kpi_category_policies_position_key)는 ALTER TYPE 시 자동 보존되므로
--    재생성하지 않는다(중복 인덱스 방지).

-- 1) enum → text (데이터 보존: 'ceo','team_lead' 등 코드 문자열 그대로 유지)
ALTER TABLE "users" ALTER COLUMN "position" TYPE text USING "position"::text;
ALTER TABLE "kpi_category_policies" ALTER COLUMN "position" TYPE text USING "position"::text;

-- 2) enum 타입 제거 (더 이상 참조 없음)
DROP TYPE "Position";

-- 3) 직급 레지스트리 테이블 생성
CREATE TABLE "position_defs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_management" BOOLEAN NOT NULL DEFAULT false,
    "default_role" "Role" NOT NULL DEFAULT 'employee',
    "default_scope" "VisibilityScope" NOT NULL DEFAULT 'self',
    "default_job_level" "JobLevel",
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_defs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "position_defs_code_key" ON "position_defs"("code");
