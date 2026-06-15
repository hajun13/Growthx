-- AlterTable
ALTER TABLE "cycle"."rule_sets" ADD COLUMN     "eligibility" JSONB;

-- AlterTable
ALTER TABLE "org"."users" ADD COLUMN     "hire_date" TIMESTAMP(3);
