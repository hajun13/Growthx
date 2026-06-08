-- YoY2: 전년도 연봉 자동 파생 소스. additive(기존 데이터 무해, NULL 허용).
-- AlterTable
ALTER TABLE "compensations" ADD COLUMN     "base_salary" INTEGER;
