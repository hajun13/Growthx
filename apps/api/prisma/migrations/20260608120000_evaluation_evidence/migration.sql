-- CreateTable
CREATE TABLE "evaluation_evidence" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "kpi_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_evidence_evaluation_id_idx" ON "evaluation_evidence"("evaluation_id");

-- CreateIndex
CREATE INDEX "evaluation_evidence_evaluation_id_kpi_id_idx" ON "evaluation_evidence"("evaluation_id", "kpi_id");

-- AddForeignKey
ALTER TABLE "evaluation_evidence" ADD CONSTRAINT "evaluation_evidence_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_evidence" ADD CONSTRAINT "evaluation_evidence_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
