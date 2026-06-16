-- 보상 현황 표(2026 연봉갱신 Index 시트) 경력/연봉 컬럼 추가.
-- 엑셀 K~AC 컬럼을 보상 표에 재현하기 위한 User 신규 스칼라(모두 nullable, 적재 미완료 허용).
ALTER TABLE "org"."users" ADD COLUMN "prior_career_months" INTEGER;
ALTER TABLE "org"."users" ADD COLUMN "career_base_months" INTEGER;
ALTER TABLE "org"."users" ADD COLUMN "career_position" TEXT;
ALTER TABLE "org"."users" ADD COLUMN "service_years" INTEGER;
ALTER TABLE "org"."users" ADD COLUMN "consideration_exclusion" TEXT;
ALTER TABLE "org"."users" ADD COLUMN "current_salary_excl_transfer" INTEGER;
