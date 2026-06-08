-- CreateTable
-- 권한 설정 싱글톤(PermissionConfig) — 권한 매트릭스 + 사이드바 nav 가시성 서버 영속.
CREATE TABLE "permission_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "matrix" JSONB NOT NULL DEFAULT '{}',
    "nav_visibility" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "permission_config_pkey" PRIMARY KEY ("id")
);
