-- Phase 2-A (SSO): 가산적 스키마 변경. DROP 없음.
-- 설계: EX-DB-API/docs/superpowers/specs/2026-07-08-growthx-keycloak-sso-design.md

-- AlterTable
ALTER TABLE "org"."users" ADD COLUMN     "allow_password_login" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "azure_ad_subject" TEXT;

-- CreateTable
CREATE TABLE "org"."user_email_aliases" (
    "email" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_email_aliases_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "user_email_aliases_user_id_idx" ON "org"."user_email_aliases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_ad_subject_key" ON "org"."users"("azure_ad_subject");

-- AddForeignKey
ALTER TABLE "org"."user_email_aliases" ADD CONSTRAINT "user_email_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "org"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SSO 전환: 비밀번호 변경 강제는 의미를 잃는다(사용자가 자기 비밀번호를 모른다).
-- 이 플래그가 남아 있으면 ForcePasswordChangeGuard 가 SSO 로그인 후 전 요청을 막고,
-- /onboarding/password 화면이 "현재 비밀번호"를 요구한다 → 영구 락아웃.
--
-- 현재 값은 0건이지만 넣는다: users.service.ts / excel.service.ts 가 신규 사용자를
-- mustChangePassword=true 로 만들기 때문에, 이 마이그레이션과 SSO 배포 사이에
-- 입사자가 한 명이라도 추가되면 그 사람만 락아웃된다.
UPDATE "org"."users" SET "must_change_password" = false WHERE "must_change_password" = true;
