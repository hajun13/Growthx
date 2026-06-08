-- AlterTable
ALTER TABLE "kpi_scores" ADD COLUMN     "actual_amount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "kpis" ADD COLUMN     "use_absolute_amount" BOOLEAN NOT NULL DEFAULT false;
