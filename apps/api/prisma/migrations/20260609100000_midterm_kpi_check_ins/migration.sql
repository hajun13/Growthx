-- CreateTable
CREATE TABLE "midterm_kpi_check_ins" (
    "id" TEXT NOT NULL,
    "midterm_review_id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,
    "self_actual_text" TEXT,
    "self_actual_value" DOUBLE PRECISION,
    "self_note" TEXT,
    "self_grade" "Grade",
    "reviewer_note" TEXT,
    "reviewer_grade" "Grade",
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "midterm_kpi_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "midterm_kpi_check_ins_midterm_review_id_idx" ON "midterm_kpi_check_ins"("midterm_review_id");

-- CreateIndex
CREATE INDEX "midterm_kpi_check_ins_kpi_id_idx" ON "midterm_kpi_check_ins"("kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "midterm_kpi_check_ins_midterm_review_id_kpi_id_key" ON "midterm_kpi_check_ins"("midterm_review_id", "kpi_id");

-- AddForeignKey
ALTER TABLE "midterm_kpi_check_ins" ADD CONSTRAINT "midterm_kpi_check_ins_midterm_review_id_fkey" FOREIGN KEY ("midterm_review_id") REFERENCES "midterm_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midterm_kpi_check_ins" ADD CONSTRAINT "midterm_kpi_check_ins_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
