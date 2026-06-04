-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('MIDTERM', 'FINAL');

-- AlterTable
ALTER TABLE "compensations" ADD COLUMN     "next_year_salary" INTEGER;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "is_engineering" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "evaluation_cycles" ADD COLUMN     "cycle_type" "CycleType" NOT NULL DEFAULT 'FINAL';
