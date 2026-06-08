-- AlterTable
ALTER TABLE "users" ADD COLUMN     "evaluation_exempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evaluation_exempt_reason" TEXT;
