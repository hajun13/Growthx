-- CreateTable: competency.competency_categories
CREATE TABLE "competency"."competency_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competency_categories_name_key" ON "competency"."competency_categories"("name");

-- AddColumn targetGroup to competency_questions
ALTER TABLE "competency"."competency_questions" ADD COLUMN "target_group" TEXT NOT NULL DEFAULT 'all';

-- AddColumn categoryId (nullable initially for data migration)
ALTER TABLE "competency"."competency_questions" ADD COLUMN "category_id" TEXT;

-- Insert default categories (seed 전 마이그레이션에서 기본값 삽입)
INSERT INTO "competency"."competency_categories" ("id", "name", "order", "updated_at")
VALUES
  (gen_random_uuid(), '리더십', 0, NOW()),
  (gen_random_uuid(), '협업', 1, NOW()),
  (gen_random_uuid(), '전문성', 2, NOW()),
  (gen_random_uuid(), '혁신', 3, NOW());

-- Migrate existing category string values to categoryId FK
UPDATE "competency"."competency_questions" cq
SET "category_id" = cc."id"
FROM "competency"."competency_categories" cc
WHERE cq."category" = cc."name";

-- For any unmatched categories, default to '전문성'
UPDATE "competency"."competency_questions"
SET "category_id" = (SELECT "id" FROM "competency"."competency_categories" WHERE "name" = '전문성' LIMIT 1)
WHERE "category_id" IS NULL;

-- Now make categoryId NOT NULL
ALTER TABLE "competency"."competency_questions" ALTER COLUMN "category_id" SET NOT NULL;

-- Drop old category column
ALTER TABLE "competency"."competency_questions" DROP COLUMN "category";

-- Drop old appliedLevel column
ALTER TABLE "competency"."competency_questions" DROP COLUMN "applied_level";

-- CreateIndex on category_id
CREATE INDEX "competency_questions_category_id_idx" ON "competency"."competency_questions"("category_id");

-- AddForeignKey
ALTER TABLE "competency"."competency_questions" ADD CONSTRAINT "competency_questions_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "competency"."competency_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
