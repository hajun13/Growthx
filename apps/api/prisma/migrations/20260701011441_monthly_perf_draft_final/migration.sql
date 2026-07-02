-- CreateEnum
CREATE TYPE "compensation"."MonthlyPerformanceStatus" AS ENUM ('draft', 'final');

-- AlterTable
ALTER TABLE "compensation"."monthly_performances" ADD COLUMN     "status" "compensation"."MonthlyPerformanceStatus" NOT NULL DEFAULT 'final';
