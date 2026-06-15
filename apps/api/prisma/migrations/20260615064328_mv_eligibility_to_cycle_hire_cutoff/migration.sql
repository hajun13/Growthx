/*
  Warnings:

  - You are about to drop the column `eligibility` on the `rule_sets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cycle"."evaluation_cycles" ADD COLUMN     "hire_cutoff_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cycle"."rule_sets" DROP COLUMN "eligibility";
